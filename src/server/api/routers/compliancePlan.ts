/**
 * Bridge to Compliance Plan (POA&M) — Epic 1 router.
 *
 * Named, owned compliance plans and their control-anchored items. Writes are
 * gated to compliance-capable roles; reads are available to any org member.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  Prisma,
  AuditAction,
  UserRole,
  ComplianceStatus,
  ControlExceptionStatus,
  RemediationStatus,
  CompliancePlanStatus,
  CompliancePlanControlKind,
  CompliancePlanItemStatus,
  CompliancePlanSourceKind,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/** Compliance statuses that count as a gap to bridge (locked decision). */
const COMPLIANCE_GAP_STATUSES = [
  ComplianceStatus.NON_COMPLIANT,
  ComplianceStatus.PARTIALLY_COMPLIANT,
];

type StaleInput = {
  id: string;
  sourceKind: CompliancePlanSourceKind | null;
  sourceId: string | null;
  sourceSignature: string | null;
};

/**
 * Derive which bridged items are stale — their source record's current
 * status/value no longer matches the signature snapshotted at bridge time, or
 * the source is gone (FR18, AR1). Manual items (no source) are never stale.
 */
async function computeStaleness(
  db: PrismaClient,
  items: StaleInput[],
): Promise<Set<string>> {
  const stale = new Set<string>();

  const comp = items.filter(
    (i) => i.sourceKind === CompliancePlanSourceKind.COMPLIANCE_ASSESSMENT && i.sourceId,
  );
  if (comp.length) {
    const rows = await db.controlAssessmentScore.findMany({
      where: { id: { in: comp.map((i) => i.sourceId!) } },
      select: { id: true, status: true },
    });
    const current = new Map(rows.map((r) => [r.id, r.status as string]));
    for (const it of comp) {
      const now = current.get(it.sourceId!);
      if (now === undefined || now !== it.sourceSignature) stale.add(it.id);
    }
  }

  const mat = items.filter(
    (i) => i.sourceKind === CompliancePlanSourceKind.MATURITY_ASSESSMENT && i.sourceId,
  );
  if (mat.length) {
    const rows = await db.maturityDomainScore.findMany({
      where: { id: { in: mat.map((i) => i.sourceId!) } },
      select: { id: true, currentLevel: true, targetLevel: true },
    });
    const current = new Map(rows.map((r) => [r.id, `${r.currentLevel ?? "null"}/${r.targetLevel ?? "null"}`]));
    for (const it of mat) {
      const now = current.get(it.sourceId!);
      if (now === undefined || now !== it.sourceSignature) stale.add(it.id);
    }
  }

  const exc = items.filter(
    (i) => i.sourceKind === CompliancePlanSourceKind.STANDARD_EXCEPTION && i.sourceId,
  );
  if (exc.length) {
    const rows = await db.controlException.findMany({
      where: { id: { in: exc.map((i) => i.sourceId!) } },
      select: { id: true, status: true },
    });
    const current = new Map(rows.map((r) => [r.id, r.status as string]));
    for (const it of exc) {
      const now = current.get(it.sourceId!);
      if (now === undefined || now !== it.sourceSignature) stale.add(it.id);
    }
  }

  const def = items.filter(
    (i) => i.sourceKind === CompliancePlanSourceKind.ORG_DEFICIENCY && i.sourceId,
  );
  if (def.length) {
    const rows = await db.orgControlDeficiency.findMany({
      where: { id: { in: def.map((i) => i.sourceId!) } },
      select: { id: true, remediationStatus: true },
    });
    const current = new Map(rows.map((r) => [r.id, r.remediationStatus as string]));
    for (const it of def) {
      const now = current.get(it.sourceId!);
      if (now === undefined || now !== it.sourceSignature) stale.add(it.id);
    }
  }

  return stale;
}

/** Signature snapshot for a maturity domain score (used by bridge + staleness). */
function maturitySignature(currentLevel: number | null, targetLevel: number | null): string {
  return `${currentLevel ?? "null"}/${targetLevel ?? "null"}`;
}

/**
 * Render a CSV field safely. Neutralizes formula injection (Excel/Sheets/
 * LibreOffice execute cells starting with = + - @ tab or CR) by prefixing a
 * single quote, then quotes/escapes if the value contains a comma, quote, or
 * newline.
 */
function csvField(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Fire-and-forget audit for a bridge run (NFR5). */
function auditBridge(orgId: string, userId: string, planId: string, source: string, added: number): void {
  void createAuditLog({
    organizationId: orgId,
    userId,
    action: AuditAction.BRIDGE_COMPLIANCE_PLAN,
    entityType: "CompliancePlan",
    entityId: planId,
    changes: { after: { source, added } },
  });
}

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";

/** Writes require a compliance-capable role (NFR2). */
const complianceWriteProcedure = organizationProcedure.use(
  requireRole([UserRole.ORG_ADMIN, UserRole.GRC_MANAGER, UserRole.GRC_ANALYST]),
);

const CLOSED_ITEM_STATUSES = ["COMPLETE", "RISK_ACCEPTED"] as const;

type ResolvedControl = { identifier: string; title: string; description: string | null };

/**
 * Resolve the polymorphic control references for a batch of items across all
 * four control types (NFR3, NFR6). Returns a map keyed by `${kind}:${controlId}`;
 * a missing entry means the control was deleted → the item renders "removed".
 */
async function resolveControls(
  db: PrismaClient,
  items: { controlKind: CompliancePlanControlKind; controlId: string }[],
): Promise<Map<string, ResolvedControl>> {
  const idsByKind: Record<CompliancePlanControlKind, string[]> = {
    FRAMEWORK_CONTROL: [],
    STANDARD_CONTROL: [],
    ORGANIZATIONAL_CONTROL: [],
    MATURITY_CONTROL: [],
    MATURITY_DOMAIN: [],
  };
  for (const it of items) idsByKind[it.controlKind].push(it.controlId);

  const map = new Map<string, ResolvedControl>();

  if (idsByKind.FRAMEWORK_CONTROL.length) {
    const rows = await db.control.findMany({
      where: { id: { in: idsByKind.FRAMEWORK_CONTROL } },
      select: { id: true, controlId: true, title: true, description: true },
    });
    for (const r of rows)
      map.set(`FRAMEWORK_CONTROL:${r.id}`, { identifier: r.controlId, title: r.title, description: r.description });
  }
  if (idsByKind.STANDARD_CONTROL.length) {
    const rows = await db.standardControl.findMany({
      where: { id: { in: idsByKind.STANDARD_CONTROL } },
      select: { id: true, code: true, title: true, description: true },
    });
    for (const r of rows)
      map.set(`STANDARD_CONTROL:${r.id}`, { identifier: r.code, title: r.title, description: r.description });
  }
  if (idsByKind.ORGANIZATIONAL_CONTROL.length) {
    const rows = await db.organizationalControl.findMany({
      where: { id: { in: idsByKind.ORGANIZATIONAL_CONTROL } },
      select: { id: true, localControlId: true, name: true, description: true },
    });
    for (const r of rows)
      map.set(`ORGANIZATIONAL_CONTROL:${r.id}`, { identifier: r.localControlId, title: r.name, description: r.description });
  }
  if (idsByKind.MATURITY_CONTROL.length) {
    const rows = await db.maturityQuestion.findMany({
      where: { id: { in: idsByKind.MATURITY_CONTROL } },
      select: { id: true, practiceCode: true, questionText: true },
    });
    for (const r of rows)
      map.set(`MATURITY_CONTROL:${r.id}`, { identifier: r.practiceCode ?? "—", title: r.questionText, description: r.questionText });
  }
  if (idsByKind.MATURITY_DOMAIN.length) {
    const rows = await db.maturityDomain.findMany({
      where: { id: { in: idsByKind.MATURITY_DOMAIN } },
      select: { id: true, code: true, name: true },
    });
    for (const r of rows)
      map.set(`MATURITY_DOMAIN:${r.id}`, { identifier: r.code, title: r.name, description: null });
  }

  return map;
}

export const compliancePlanRouter = createTRPCRouter({
  /** Create a named, owned compliance plan (FR1). Defaults to DRAFT. */
  create: complianceWriteProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(5000).optional(),
        ownerId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.create({
        data: {
          organizationId: ctx.organizationId!,
          name: input.name,
          description: input.description,
          ownerId: input.ownerId ?? null,
          createdById: ctx.session!.user.id,
        },
      });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.CREATE_COMPLIANCE_PLAN,
        entityType: "CompliancePlan",
        entityId: plan.id,
        changes: { after: { name: plan.name } },
      });
      return plan;
    }),

  /** Update a plan's name, description, owner, or status (FR2, FR4). */
  update: complianceWriteProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(5000).nullable().optional(),
        ownerId: z.string().nullable().optional(),
        status: z.nativeEnum(CompliancePlanStatus).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.compliancePlan.update({ where: { id }, data });
    }),

  /** Archive a plan (FR4). */
  archive: complianceWriteProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.compliancePlan.update({
        where: { id: input.id },
        data: { status: CompliancePlanStatus.ARCHIVED },
      });
    }),

  /** List plans with owner, item count, progress %, and overdue count (FR3, FR18). */
  list: organizationProcedure.query(async ({ ctx }) => {
    const plans = await ctx.db.compliancePlan.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        Owner: { select: { id: true, name: true } },
        items: { select: { status: true, targetDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    return plans.map((p) => {
      const itemCount = p.items.length;
      const closed = p.items.filter((i) =>
        (CLOSED_ITEM_STATUSES as readonly string[]).includes(i.status),
      ).length;
      const overdueCount = p.items.filter(
        (i) =>
          i.targetDate !== null &&
          i.targetDate < now &&
          !(CLOSED_ITEM_STATUSES as readonly string[]).includes(i.status),
      ).length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        owner: p.Owner ? { id: p.Owner.id, name: p.Owner.name } : null,
        itemCount,
        progressPct: itemCount ? Math.round((closed / itemCount) * 100) : 0,
        overdueCount,
      };
    });
  }),

  /** Fetch a plan with its items, each with its resolved control (FR9, NFR3). */
  get: organizationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          ownerId: true,
          createdAt: true,
          Owner: { select: { id: true, name: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              controlKind: true,
              controlId: true,
              ownerId: true,
              status: true,
              targetDate: true,
              evidenceNeeded: true,
              notes: true,
              acceptanceCriteria: true,
              evidenceLinks: true,
              sourceKind: true,
              sourceId: true,
              sourceSignature: true,
              Owner: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const resolved = await resolveControls(ctx.db, plan.items);
      const stale = await computeStaleness(ctx.db, plan.items);

      // Resolve linked evidence titles (FR19).
      const evidenceIds = [...new Set(plan.items.flatMap((i) => i.evidenceLinks))];
      const evidenceRows = evidenceIds.length
        ? await ctx.db.evidence.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, title: true } })
        : [];
      const evidenceTitle = new Map(evidenceRows.map((e) => [e.id, e.title]));

      const { Owner, items, ...planRest } = plan;

      // Progress + overdue (FR21).
      const now = new Date();
      const isClosed = (s: string) => (CLOSED_ITEM_STATUSES as readonly string[]).includes(s);
      const closedCount = items.filter((i) => isClosed(i.status)).length;
      const overdueCount = items.filter(
        (i) => i.targetDate !== null && i.targetDate < now && !isClosed(i.status),
      ).length;

      return {
        ...planRest,
        owner: Owner,
        progressPct: items.length ? Math.round((closedCount / items.length) * 100) : 0,
        overdueCount,
        items: items.map((it) => {
          const { Owner: itemOwner, ...itemRest } = it;
          return {
            ...itemRest,
            owner: itemOwner,
            control: resolved.get(`${it.controlKind}:${it.controlId}`) ?? null,
            sourceStale: stale.has(it.id),
            overdue: it.targetDate !== null && it.targetDate < now && !isClosed(it.status),
            linkedEvidence: it.evidenceLinks
              .filter((eid) => evidenceTitle.has(eid))
              .map((eid) => ({ id: eid, title: evidenceTitle.get(eid)! })),
          };
        }),
      };
    }),

  /** List the org's bridge sources — compliance/maturity assessments, standards
   * (open exceptions), and an org-wide open-deficiencies option (Epic 2 UI). */
  listBridgeSources: organizationProcedure.query(async ({ ctx }) => {
    const [compliance, maturity, standards, openDeficiencies] = await Promise.all([
      ctx.db.complianceAssessment.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
      ctx.db.maturityAssessment.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
      ctx.db.standard.findMany({ select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
      ctx.db.orgControlDeficiency.count({ where: { remediationStatus: RemediationStatus.OPEN } }),
    ]);
    return [
      ...compliance.map((a) => ({ kind: "COMPLIANCE" as const, id: a.id, name: a.name })),
      ...maturity.map((a) => ({ kind: "MATURITY" as const, id: a.id, name: a.name })),
      ...standards.map((s) => ({ kind: "STANDARD" as const, id: s.id, name: s.title })),
      ...(openDeficiencies > 0
        ? [{ kind: "ORG_DEFICIENCY" as const, id: "", name: `Open control deficiencies (${openDeficiencies})` }]
        : []),
    ];
  }),

  /** Unified control search across all four control types, for the add-item picker (FR5). */
  searchControls: organizationProcedure
    .input(z.object({ query: z.string().trim().max(200).default("") }))
    .query(async ({ ctx, input }) => {
      const q = input.query;
      const contains = q ? { contains: q, mode: "insensitive" as const } : undefined;
      const take = 10;
      const results: { kind: CompliancePlanControlKind; controlId: string; identifier: string; title: string }[] = [];

      // Framework controls (org-scoped by the org-filter).
      const fw = await ctx.db.control.findMany({
        where: contains ? { OR: [{ controlId: contains }, { title: contains }] } : {},
        select: { id: true, controlId: true, title: true },
        take,
      });
      for (const c of fw) results.push({ kind: "FRAMEWORK_CONTROL", controlId: c.id, identifier: c.controlId, title: c.title });

      // Organizational controls (org-scoped by the org-filter).
      const oc = await ctx.db.organizationalControl.findMany({
        where: contains ? { OR: [{ localControlId: contains }, { name: contains }] } : {},
        select: { id: true, localControlId: true, name: true },
        take,
      });
      for (const c of oc) results.push({ kind: "ORGANIZATIONAL_CONTROL", controlId: c.id, identifier: c.localControlId, title: c.name });

      // Standard controls — scope to this org's standards (StandardControl is allowlisted).
      const stds = await ctx.db.standard.findMany({ select: { id: true } });
      if (stds.length) {
        const sc = await ctx.db.standardControl.findMany({
          where: {
            standardId: { in: stds.map((s) => s.id) },
            ...(contains ? { OR: [{ code: contains }, { title: contains }] } : {}),
          },
          select: { id: true, code: true, title: true },
          take,
        });
        for (const c of sc) results.push({ kind: "STANDARD_CONTROL", controlId: c.id, identifier: c.code, title: c.title });
      }

      // Maturity controls — scope to this org's (or system) frameworks.
      const mfws = await ctx.db.maturityFramework.findMany({
        where: { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] },
        select: { id: true },
      });
      if (mfws.length) {
        const frameworkIds = mfws.map((f) => f.id);
        const mq = await ctx.db.maturityQuestion.findMany({
          where: {
            frameworkId: { in: frameworkIds },
            ...(contains ? { OR: [{ practiceCode: contains }, { questionText: contains }] } : {}),
          },
          select: { id: true, practiceCode: true, questionText: true },
          take,
        });
        for (const c of mq) results.push({ kind: "MATURITY_CONTROL", controlId: c.id, identifier: c.practiceCode ?? "—", title: c.questionText });

        const md = await ctx.db.maturityDomain.findMany({
          where: {
            frameworkId: { in: frameworkIds },
            ...(contains ? { OR: [{ code: contains }, { name: contains }] } : {}),
          },
          select: { id: true, code: true, name: true },
          take,
        });
        for (const c of md) results.push({ kind: "MATURITY_DOMAIN", controlId: c.id, identifier: c.code, title: c.name });
      }

      return results;
    }),

  /** List the org's users for the Evidence Request recipient picker (FR20). */
  listOrgUsers: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { organizationId: ctx.organizationId! },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }),

  /** Raise an Evidence Request for an item, to an explicitly chosen user (FR20). */
  raiseEvidenceRequest: complianceWriteProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        recipientUserId: z.string().min(1),
        dueDate: z.date(),
        instructions: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.compliancePlanItem.findUnique({ where: { id: input.itemId }, select: { id: true } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });

      return ctx.db.evidenceRequest.create({
        data: {
          organizationId: ctx.organizationId!,
          recipientUserId: input.recipientUserId,
          requestedById: ctx.session!.user.id,
          dueDate: input.dueDate,
          instructions: input.instructions,
        },
      });
    }),

  /** Export a plan as a CSV audit deliverable (FR22). */
  exportPlan: organizationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({
        where: { id: input.id },
        select: {
          name: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              controlKind: true,
              controlId: true,
              status: true,
              targetDate: true,
              evidenceNeeded: true,
              notes: true,
              acceptanceCriteria: true,
              Owner: { select: { name: true } },
            },
          },
        },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const resolved = await resolveControls(ctx.db, plan.items);
      const header = [
        "Control ID",
        "Control",
        "Control Type",
        "Owner",
        "Status",
        "Target Date",
        "Evidence Needed",
        "Notes",
        "Acceptance Criteria",
      ];
      const rows = plan.items.map((it) => {
        const ctrl = resolved.get(`${it.controlKind}:${it.controlId}`);
        return [
          ctrl?.identifier ?? "(removed)",
          ctrl?.title ?? "",
          it.controlKind,
          it.Owner?.name ?? "",
          it.status,
          it.targetDate ? it.targetDate.toISOString().slice(0, 10) : "",
          it.evidenceNeeded ?? "",
          it.notes ?? "",
          it.acceptanceCriteria ?? "",
        ];
      });
      const content = [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
      // Strip filesystem-unsafe / control characters from the download filename.
      const safeName = plan.name.replace(/[/\\:*?"<>|\r\n]/g, "_").trim() || "plan";
      return { filename: `${safeName} POA&M.csv`, content };
    }),

  /** Add a control-anchored item to a plan (FR5, FR6, FR8). */
  addItem: complianceWriteProcedure
    .input(
      z.object({
        planId: z.string().min(1),
        controlKind: z.nativeEnum(CompliancePlanControlKind),
        controlId: z.string().min(1),
        ownerId: z.string().optional(),
        status: z.nativeEnum(CompliancePlanItemStatus).optional(),
        targetDate: z.date().nullable().optional(),
        evidenceNeeded: z.string().max(5000).optional(),
        notes: z.string().max(5000).optional(),
        acceptanceCriteria: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({
        where: { id: input.planId },
        select: { id: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      try {
        return await ctx.db.compliancePlanItem.create({
          data: {
            organizationId: ctx.organizationId!,
            planId: input.planId,
            controlKind: input.controlKind,
            controlId: input.controlId,
            ownerId: input.ownerId ?? null,
            status: input.status,
            targetDate: input.targetDate ?? null,
            evidenceNeeded: input.evidenceNeeded,
            notes: input.notes,
            acceptanceCriteria: input.acceptanceCriteria,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "That control is already in this plan" });
        }
        throw e;
      }
    }),

  /** Edit an item's owner, status, target date, evidence, notes, or acceptance criteria (FR7, FR11). */
  updateItem: complianceWriteProcedure
    .input(
      z.object({
        id: z.string().min(1),
        ownerId: z.string().nullable().optional(),
        status: z.nativeEnum(CompliancePlanItemStatus).optional(),
        targetDate: z.date().nullable().optional(),
        evidenceNeeded: z.string().max(5000).nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),
        acceptanceCriteria: z.string().max(5000).nullable().optional(),
        evidenceLinks: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.compliancePlanItem.update({ where: { id }, data });
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_COMPLIANCE_PLAN_ITEM,
        entityType: "CompliancePlanItem",
        entityId: id,
        changes: { after: data },
      });
      return updated;
    }),

  /** Remove an item from a plan (FR11). */
  removeItem: complianceWriteProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.compliancePlanItem.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  /**
   * Bridge a compliance assessment's gaps into a plan (FR12, FR14–FR17).
   * Every control scored NON_COMPLIANT or PARTIALLY_COMPLIANT becomes a
   * FRAMEWORK_CONTROL snapshot item with a back-link, pre-filled from the gap.
   * Idempotent: existing (plan, control) pairs are skipped.
   */
  bridgeComplianceAssessment: complianceWriteProcedure
    .input(z.object({ planId: z.string().min(1), assessmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({ where: { id: input.planId }, select: { id: true } });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Org-scoped: findUnique returns null if the assessment isn't in this org.
      const assessment = await ctx.db.complianceAssessment.findUnique({
        where: { id: input.assessmentId },
        select: { id: true },
      });
      if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });

      const scores = await ctx.db.controlAssessmentScore.findMany({
        where: { assessmentId: input.assessmentId, status: { in: COMPLIANCE_GAP_STATUSES } },
        select: { id: true, controlId: true, status: true, gapDescription: true, remediationDueDate: true },
      });

      const result = await ctx.db.compliancePlanItem.createMany({
        data: scores.map((sc) => ({
          organizationId: ctx.organizationId!,
          planId: input.planId,
          controlKind: CompliancePlanControlKind.FRAMEWORK_CONTROL,
          controlId: sc.controlId,
          notes: sc.gapDescription ?? undefined,
          targetDate: sc.remediationDueDate ?? undefined,
          sourceKind: CompliancePlanSourceKind.COMPLIANCE_ASSESSMENT,
          sourceId: sc.id,
          sourceSignature: sc.status,
        })),
        skipDuplicates: true,
      });

      auditBridge(ctx.organizationId!, ctx.session!.user.id, input.planId, "COMPLIANCE", result.count);
      return { total: scores.length, added: result.count, skipped: scores.length - result.count };
    }),

  /**
   * Bridge a maturity assessment's domain gaps into a plan (FR13–FR17).
   * Every domain scored below its target level becomes a MATURITY_DOMAIN snapshot
   * item with a back-link. Idempotent.
   */
  bridgeMaturityAssessment: complianceWriteProcedure
    .input(z.object({ planId: z.string().min(1), assessmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({ where: { id: input.planId }, select: { id: true } });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Org-scoped: findUnique returns null if the assessment isn't in this org.
      const assessment = await ctx.db.maturityAssessment.findUnique({
        where: { id: input.assessmentId },
        select: { id: true },
      });
      if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });

      const scores = await ctx.db.maturityDomainScore.findMany({
        where: { assessmentId: input.assessmentId, targetLevel: { not: null } },
        select: { id: true, domainId: true, currentLevel: true, targetLevel: true },
      });
      const gaps = scores.filter(
        (sc) => sc.targetLevel !== null && (sc.currentLevel === null || sc.currentLevel < sc.targetLevel),
      );

      const result = await ctx.db.compliancePlanItem.createMany({
        data: gaps.map((sc) => ({
          organizationId: ctx.organizationId!,
          planId: input.planId,
          controlKind: CompliancePlanControlKind.MATURITY_DOMAIN,
          controlId: sc.domainId,
          notes: `Maturity level ${sc.currentLevel ?? 0} of target ${sc.targetLevel}`,
          sourceKind: CompliancePlanSourceKind.MATURITY_ASSESSMENT,
          sourceId: sc.id,
          sourceSignature: maturitySignature(sc.currentLevel, sc.targetLevel),
        })),
        skipDuplicates: true,
      });

      auditBridge(ctx.organizationId!, ctx.session!.user.id, input.planId, "MATURITY", result.count);
      return { total: gaps.length, added: result.count, skipped: gaps.length - result.count };
    }),

  /**
   * Bridge a standard's open control exceptions into a plan (FR14–FR17).
   * Controls carrying a PENDING or APPROVED exception become STANDARD_CONTROL
   * snapshot items, with the exception's expiry as the target date. Idempotent.
   */
  bridgeStandardExceptions: complianceWriteProcedure
    .input(z.object({ planId: z.string().min(1), standardId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({ where: { id: input.planId }, select: { id: true } });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const standard = await ctx.db.standard.findUnique({ where: { id: input.standardId }, select: { id: true } });
      if (!standard) throw new TRPCError({ code: "NOT_FOUND", message: "Standard not found" });

      const controls = await ctx.db.standardControl.findMany({
        where: { standardId: input.standardId },
        select: { id: true },
      });
      const exceptions = controls.length
        ? await ctx.db.controlException.findMany({
            where: {
              standardControlId: { in: controls.map((c) => c.id) },
              status: { in: [ControlExceptionStatus.PENDING, ControlExceptionStatus.APPROVED] },
            },
            select: { id: true, standardControlId: true, status: true, justification: true, expiresAt: true },
          })
        : [];

      const result = await ctx.db.compliancePlanItem.createMany({
        data: exceptions.map((ex) => ({
          organizationId: ctx.organizationId!,
          planId: input.planId,
          controlKind: CompliancePlanControlKind.STANDARD_CONTROL,
          controlId: ex.standardControlId,
          notes: ex.justification ?? undefined,
          targetDate: ex.expiresAt ?? undefined,
          sourceKind: CompliancePlanSourceKind.STANDARD_EXCEPTION,
          sourceId: ex.id,
          sourceSignature: ex.status,
        })),
        skipDuplicates: true,
      });

      auditBridge(ctx.organizationId!, ctx.session!.user.id, input.planId, "STANDARD_EXCEPTION", result.count);
      return { total: exceptions.length, added: result.count, skipped: exceptions.length - result.count };
    }),

  /**
   * Bridge open organizational-control deficiencies into a plan (FR15–FR17).
   * Every `OrgControlDeficiency` with remediationStatus OPEN becomes an
   * ORGANIZATIONAL_CONTROL snapshot item, pre-filled with its description, due
   * date, and remediation owner. Idempotent.
   */
  bridgeOrgDeficiencies: complianceWriteProcedure
    .input(z.object({ planId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.compliancePlan.findUnique({ where: { id: input.planId }, select: { id: true } });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const deficiencies = await ctx.db.orgControlDeficiency.findMany({
        where: { remediationStatus: RemediationStatus.OPEN },
        select: { id: true, orgControlId: true, description: true, remediationDueDate: true, remediationOwnerId: true, remediationStatus: true },
      });

      const result = await ctx.db.compliancePlanItem.createMany({
        data: deficiencies.map((d) => ({
          organizationId: ctx.organizationId!,
          planId: input.planId,
          controlKind: CompliancePlanControlKind.ORGANIZATIONAL_CONTROL,
          controlId: d.orgControlId,
          ownerId: d.remediationOwnerId ?? undefined,
          notes: d.description ?? undefined,
          targetDate: d.remediationDueDate ?? undefined,
          sourceKind: CompliancePlanSourceKind.ORG_DEFICIENCY,
          sourceId: d.id,
          sourceSignature: d.remediationStatus,
        })),
        skipDuplicates: true,
      });

      auditBridge(ctx.organizationId!, ctx.session!.user.id, input.planId, "ORG_DEFICIENCY", result.count);
      return { total: deficiencies.length, added: result.count, skipped: deficiencies.length - result.count };
    }),
});
