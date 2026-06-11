/**
 * Pathway (Exploitation Pathway) tRPC Router.
 *
 * Epic 19: a first-class `Pathway` of ordered MITRE ATT&CK `PathwayStep`s that
 * captures how individual findings AND risks compound into a single kill chain.
 * Pathways are scoped to ONE assessment via a polymorphic (`assessmentKind`,
 * `assessmentId`) link — multiple pathways per assessment are allowed, and a
 * finding/risk may appear in many pathways (many-to-many via steps across
 * pathway records).
 *
 * Security:
 * - Multi-tenant isolation: every read/write filters by `ctx.organizationId`.
 * - Role-based access: writes require a manage role; reads add AUDITOR.
 *
 * Linkage note: each step references a finding OR a risk via
 * `PathwayStep.findingId` / `PathwayStep.riskId`. The `Finding.isToxic` /
 * `Risk.isToxic` flags are toggled here when a member is linked/unlinked, and
 * reset only when the member is referenced by NO remaining step in ANY pathway.
 *
 * Audit actions: the `AuditAction` enum lives in schema.prisma (not edited
 * here). We REUSE the existing `TOXIC_CHAIN_CREATED` / `TOXIC_CHAIN_DELETED`
 * values via the established cast pattern (`as unknown as AuditAction`) — no new
 * enum values are required for this story.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AssessmentKind } from "@prisma/client";
import type { AuditAction, PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";

// Write roles per the Epic 19 spec; reads additionally allow AUDITOR.
const PATHWAY_MANAGE_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.CISO,
];
const PATHWAY_READ_ROLES: UserRole[] = [...PATHWAY_MANAGE_ROLES, UserRole.AUDITOR];

const mitreTidSchema = z
  .string()
  .regex(/^T\d{4}(\.\d{3})?$/, "Expected a MITRE technique id like T1566 or T1566.001");

/** Scoring/summary fields selected for a step's denormalized primary finding. */
const findingMemberSelect = {
  id: true,
  identifier: true,
  title: true,
  severity: true,
  severityLabel: true,
  inherentLikelihood: true,
  inherentImpact: true,
  inherentExposure: true,
  inherentScore: true,
} as const;

/**
 * Risk has no `severityLabel`; its matrix threshold label lives on
 * `inherentScoreLabel`. We select it and alias to `severityLabel` during
 * serialization so the client-facing member shape is uniform.
 */
const riskMemberSelect = {
  id: true,
  identifier: true,
  title: true,
  severity: true,
  inherentScoreLabel: true,
  inherentLikelihood: true,
  inherentImpact: true,
  inherentExposure: true,
  inherentScore: true,
} as const;

const stepMemberInclude = {
  finding: { select: findingMemberSelect },
  risk: { select: riskMemberSelect },
} as const;

/** Each step also carries its full `members` join (source of truth). */
const stepInclude = {
  ...stepMemberInclude,
  members: {
    orderBy: { createdAt: "asc" as const },
    include: {
      finding: { select: findingMemberSelect },
      risk: { select: riskMemberSelect },
    },
  },
} as const;

const pathwayInclude = {
  steps: {
    orderBy: { order: "asc" as const },
    include: stepInclude,
  },
} as const;

/**
 * Decimal → number at the API boundary. Prisma returns inherent L/I/E as
 * `Decimal` objects; the client-facing PathwayMemberSummary expects plain
 * numbers (or undefined when unset on older findings/risks).
 */
function decToNum(v: { toNumber: () => number } | null | undefined): number | undefined {
  return v == null ? undefined : v.toNumber();
}

/** Normalize a step's finding/risk member Decimals to numbers for the client. */
function serializeMember<
  T extends {
    inherentLikelihood?: { toNumber: () => number } | null;
    inherentImpact?: { toNumber: () => number } | null;
    inherentExposure?: { toNumber: () => number } | null;
    inherentScore?: { toNumber: () => number } | null;
  },
>(member: T) {
  return {
    ...member,
    inherentLikelihood: decToNum(member.inherentLikelihood),
    inherentImpact: decToNum(member.inherentImpact),
    inherentExposure: decToNum(member.inherentExposure),
    inherentScore: decToNum(member.inherentScore),
  };
}

/** Decimal scoring fields shared by finding/risk member selects. */
type RawScored = {
  inherentLikelihood?: { toNumber: () => number } | null;
  inherentImpact?: { toNumber: () => number } | null;
  inherentExposure?: { toNumber: () => number } | null;
  inherentScore?: { toNumber: () => number } | null;
};

/** Raw finding member shape (from `findingMemberSelect`). */
type RawFindingMember = RawScored & {
  id: string;
  identifier: string | null;
  title: string;
  severity: string;
  severityLabel?: string | null;
};

/** Raw risk member shape (from `riskMemberSelect`). */
type RawRiskMember = RawScored & {
  id: string;
  identifier: string | null;
  title: string;
  severity: string;
  inherentScoreLabel?: string | null;
};

/** One serialized member of a step's `members` join — uniform shape. */
type NormalizedMember = {
  /** Stable PathwayStepMember row id (for inline remove). */
  memberId: string;
  kind: "finding" | "risk";
  id: string;
  identifier: string | null;
  title: string;
  severity?: string;
  severityLabel?: string;
  inherentLikelihood?: number;
  inherentImpact?: number;
  inherentExposure?: number;
  inherentScore?: number;
};

/** Serialize a raw PathwayStepMember join row to the normalized member shape. */
function serializeJoinMember(row: {
  id: string;
  finding?: RawFindingMember | null;
  risk?: RawRiskMember | null;
}): NormalizedMember | null {
  if (row.finding) {
    const f = row.finding;
    return {
      memberId: row.id,
      kind: "finding",
      id: f.id,
      identifier: f.identifier,
      title: f.title,
      severity: f.severity ?? undefined,
      severityLabel: f.severityLabel ?? undefined,
      inherentLikelihood: decToNum(f.inherentLikelihood),
      inherentImpact: decToNum(f.inherentImpact),
      inherentExposure: decToNum(f.inherentExposure),
      inherentScore: decToNum(f.inherentScore),
    };
  }
  if (row.risk) {
    const r = row.risk;
    return {
      memberId: row.id,
      kind: "risk",
      id: r.id,
      identifier: r.identifier,
      title: r.title,
      severity: r.severity ?? undefined,
      // Risk's matrix label lives on inherentScoreLabel; expose as severityLabel.
      severityLabel: r.inherentScoreLabel ?? undefined,
      inherentLikelihood: decToNum(r.inherentLikelihood),
      inherentImpact: decToNum(r.inherentImpact),
      inherentExposure: decToNum(r.inherentExposure),
      inherentScore: decToNum(r.inherentScore),
    };
  }
  return null;
}

/** Map a raw pathway (with Decimal members) to a client-safe shape. */
function serializePathway<
  P extends {
    steps: Array<{
      finding?: RawFindingMember | null;
      risk?: RawRiskMember | null;
      members?: Array<{
        id: string;
        finding?: RawFindingMember | null;
        risk?: RawRiskMember | null;
      }>;
    }>;
  },
>(pathway: P) {
  return {
    ...pathway,
    steps: pathway.steps.map((step) => ({
      ...step,
      finding: step.finding ? serializeMember(step.finding) : step.finding,
      risk: step.risk ? serializeMember(step.risk) : step.risk,
      members: (step.members ?? [])
        .map(serializeJoinMember)
        .filter((m): m is NormalizedMember => m != null),
    })),
  };
}

export const pathwayRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // create — a named pathway scoped to one assessment (kind + id).
  // -------------------------------------------------------------------------
  create: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1),
        name: z.string().min(1, "Name is required").max(200),
        verdict: z.string().max(2000).optional(),
        narrative: z.string().max(10000).optional(),
        blastRadius: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate the referenced assessment exists for this kind + org (mirrors
      // the polymorphic-link validation pattern used by the engagement router).
      await assertAssessmentInOrg(
        ctx.db,
        input.assessmentKind,
        input.assessmentId,
        ctx.organizationId!,
      );

      const pathway = await ctx.db.pathway.create({
        data: {
          organizationId: ctx.organizationId!,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
          name: input.name,
          verdict: input.verdict ?? null,
          narrative: input.narrative ?? null,
          blastRadius: input.blastRadius ?? null,
          createdById: ctx.session!.user.id,
        },
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "TOXIC_CHAIN_CREATED" as unknown as AuditAction,
        entityType: "Pathway",
        entityId: pathway.id,
        actorName: ctx.session!.user.name ?? ctx.session!.user.email ?? undefined,
        actorRole: ctx.session!.user.role,
        changes: {
          before: null,
          after: {
            name: pathway.name,
            assessmentKind: pathway.assessmentKind,
            assessmentId: pathway.assessmentId,
          },
        },
      });

      return pathway;
    }),

  // -------------------------------------------------------------------------
  // update — edit a pathway's name + the verdict-banner content (overall
  // description = verdict + narrative) and blast radius.
  // -------------------------------------------------------------------------
  update: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(200).optional(),
        verdict: z.string().max(2000).nullish(),
        narrative: z.string().max(10000).nullish(),
        blastRadius: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.pathway.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pathway not found" });
      }

      // Trim text fields; empty string clears the field to null.
      const clean = (v: string | null | undefined) =>
        v === undefined ? undefined : v?.trim() ? v.trim() : null;

      const pathway = await ctx.db.pathway.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          verdict: clean(input.verdict),
          narrative: clean(input.narrative),
          blastRadius: clean(input.blastRadius),
        },
      });

      return pathway;
    }),

  // -------------------------------------------------------------------------
  // listByAssessment — every pathway for one assessment, with ordered steps +
  // per-step finding/risk summaries.
  // -------------------------------------------------------------------------
  listByAssessment: organizationProcedure
    .use(requireRole(PATHWAY_READ_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pathways = await ctx.db.pathway.findMany({
        where: {
          organizationId: ctx.organizationId!,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
        },
        include: pathwayInclude,
        orderBy: { createdAt: "asc" },
      });
      return pathways.map(serializePathway);
    }),

  // -------------------------------------------------------------------------
  // getById — pathway + ordered steps + finding/risk per step.
  // -------------------------------------------------------------------------
  getById: organizationProcedure
    .use(requireRole(PATHWAY_READ_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const pathway = await ctx.db.pathway.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: pathwayInclude,
      });
      if (!pathway) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exploitation pathway not found" });
      }
      return serializePathway(pathway);
    }),

  // -------------------------------------------------------------------------
  // addStep — append a step (auto order = max + 1). A step may reference MANY
  // findings AND/OR risks via PathwayStepMember rows (the source of truth). The
  // legacy single findingId/riskId are kept as the denormalized "primary"
  // member (first finding / first risk). At least one member is required.
  // -------------------------------------------------------------------------
  addStep: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        pathwayId: z.string(),
        order: z.number().int().optional(),
        tactic: z.string().min(1),
        technique: z.string().min(1),
        mitreTid: mitreTidSchema.optional(),
        // Preferred: multi-member arrays.
        findingIds: z.array(z.string()).default([]),
        riskIds: z.array(z.string()).default([]),
        // Legacy single-member fields (back-compat) — folded into the arrays.
        findingId: z.string().optional(),
        riskId: z.string().optional(),
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Merge legacy single fields into the arrays, de-duplicating.
      const findingIds = [
        ...new Set([...input.findingIds, ...(input.findingId ? [input.findingId] : [])]),
      ];
      const riskIds = [
        ...new Set([...input.riskIds, ...(input.riskId ? [input.riskId] : [])]),
      ];

      if (findingIds.length + riskIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A pathway step must reference at least one finding or risk.",
        });
      }

      const pathway = await ctx.db.pathway.findFirst({
        where: { id: input.pathwayId, organizationId: ctx.organizationId! },
        include: { steps: { orderBy: { order: "desc" }, take: 1 } },
      });
      if (!pathway) throw new TRPCError({ code: "NOT_FOUND", message: "Pathway not found" });

      // Validate every referenced member belongs to the caller's org.
      for (const fid of findingIds) await assertFindingInOrg(ctx.db, fid, ctx.organizationId!);
      for (const rid of riskIds) await assertRiskInOrg(ctx.db, rid, ctx.organizationId!);

      const nextOrder = input.order ?? (pathway.steps[0]?.order ?? 0) + 1;

      // Denormalized primary = first finding / first risk.
      const primaryFindingId = findingIds[0] ?? null;
      const primaryRiskId = riskIds[0] ?? null;

      const step = await ctx.db.pathwayStep.create({
        data: {
          pathwayId: input.pathwayId,
          order: nextOrder,
          tactic: input.tactic,
          technique: input.technique,
          mitreTid: input.mitreTid ?? null,
          findingId: primaryFindingId,
          riskId: primaryRiskId,
          note: input.note ?? null,
          members: {
            create: [
              ...findingIds.map((findingId) => ({ findingId })),
              ...riskIds.map((riskId) => ({ riskId })),
            ],
          },
        },
      });

      // Mark every referenced member toxic.
      for (const findingId of findingIds) {
        await ctx.db.finding.update({ where: { id: findingId }, data: { isToxic: true } });
      }
      for (const riskId of riskIds) {
        await ctx.db.risk.update({ where: { id: riskId }, data: { isToxic: true } });
      }

      return step;
    }),

  // -------------------------------------------------------------------------
  // addMember — attach one finding OR risk to an existing step (inline edit).
  // Re-derives the denormalized primary finding/risk afterwards.
  // -------------------------------------------------------------------------
  addMember: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        stepId: z.string(),
        findingId: z.string().optional(),
        riskId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertExactlyOneMember(input.findingId, input.riskId, { allowNone: false });

      const step = await assertStepInOrg(ctx.db, input.stepId, ctx.organizationId!);
      await assertMemberInPathwayAssessment(
        ctx.db,
        step.pathwayId,
        ctx.organizationId!,
        input.findingId,
        input.riskId,
      );

      // No-op if this exact member is already attached.
      const existing = await ctx.db.pathwayStepMember.findFirst({
        where: {
          stepId: step.id,
          findingId: input.findingId ?? null,
          riskId: input.riskId ?? null,
        },
        select: { id: true },
      });
      if (!existing) {
        await ctx.db.pathwayStepMember.create({
          data: {
            stepId: step.id,
            findingId: input.findingId ?? null,
            riskId: input.riskId ?? null,
          },
        });
      }

      if (input.findingId) {
        await ctx.db.finding.update({ where: { id: input.findingId }, data: { isToxic: true } });
      }
      if (input.riskId) {
        await ctx.db.risk.update({ where: { id: input.riskId }, data: { isToxic: true } });
      }

      await syncStepPrimaryMember(ctx.db, step.id);
      return { stepId: step.id };
    }),

  // -------------------------------------------------------------------------
  // removeMember — detach one PathwayStepMember row from its step. Re-derives
  // the denormalized primary, and resets isToxic on a fully-orphaned member.
  // -------------------------------------------------------------------------
  removeMember: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.pathwayStepMember.findFirst({
        where: { id: input.memberId, step: { pathway: { organizationId: ctx.organizationId! } } },
        select: { id: true, stepId: true, findingId: true, riskId: true },
      });
      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pathway step member not found" });
      }

      await ctx.db.pathwayStepMember.delete({ where: { id: member.id } });
      await syncStepPrimaryMember(ctx.db, member.stepId);

      if (member.findingId) await resetFindingToxicIfOrphan(ctx.db, member.findingId);
      if (member.riskId) await resetRiskToxicIfOrphan(ctx.db, member.riskId);

      return { memberId: member.id, stepId: member.stepId };
    }),

  // -------------------------------------------------------------------------
  // updateStep — edit step fields (tactic/technique/mitreTid/note/order).
  // -------------------------------------------------------------------------
  updateStep: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string(),
        order: z.number().int().optional(),
        tactic: z.string().min(1).optional(),
        technique: z.string().min(1).optional(),
        mitreTid: mitreTidSchema.nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const step = await assertStepInOrg(ctx.db, input.id, ctx.organizationId!);

      return ctx.db.pathwayStep.update({
        where: { id: step.id },
        data: {
          ...(input.order !== undefined && { order: input.order }),
          ...(input.tactic !== undefined && { tactic: input.tactic }),
          ...(input.technique !== undefined && { technique: input.technique }),
          ...(input.mitreTid !== undefined && { mitreTid: input.mitreTid }),
          ...(input.note !== undefined && { note: input.note }),
        },
      });
    }),

  // -------------------------------------------------------------------------
  // removeStep — delete a step + re-sequence remaining order values so they
  // stay contiguous. Resets isToxic on the released finding/risk if it is in
  // no other step (across any pathway).
  // -------------------------------------------------------------------------
  removeStep: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const step = await assertStepInOrg(ctx.db, input.id, ctx.organizationId!);
      const releasedFindingId = step.findingId;
      const releasedRiskId = step.riskId;

      await ctx.db.$transaction(async (tx) => {
        await tx.pathwayStep.delete({ where: { id: step.id } });

        // Re-sequence remaining steps to keep order contiguous (1..n).
        const remaining = await tx.pathwayStep.findMany({
          where: { pathwayId: step.pathwayId },
          orderBy: { order: "asc" },
        });
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i]!.order !== i + 1) {
            await tx.pathwayStep.update({ where: { id: remaining[i]!.id }, data: { order: i + 1 } });
          }
        }
      });

      if (releasedFindingId) await resetFindingToxicIfOrphan(ctx.db, releasedFindingId);
      if (releasedRiskId) await resetRiskToxicIfOrphan(ctx.db, releasedRiskId);

      return { id: step.id };
    }),

  // -------------------------------------------------------------------------
  // linkMember — set a step's finding OR risk (exactly one) + isToxic = true.
  // Releases the previous member (if different) and resets its isToxic flag if
  // it is now orphaned.
  // -------------------------------------------------------------------------
  linkMember: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(
      z.object({
        stepId: z.string(),
        findingId: z.string().optional(),
        riskId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertExactlyOneMember(input.findingId, input.riskId, { allowNone: false });

      const step = await assertStepInOrg(ctx.db, input.stepId, ctx.organizationId!);

      if (input.findingId) {
        await assertFindingInOrg(ctx.db, input.findingId, ctx.organizationId!);
      }
      if (input.riskId) {
        await assertRiskInOrg(ctx.db, input.riskId, ctx.organizationId!);
      }

      const prevFindingId = step.findingId;
      const prevRiskId = step.riskId;

      await ctx.db.pathwayStep.update({
        where: { id: step.id },
        data: {
          findingId: input.findingId ?? null,
          riskId: input.riskId ?? null,
        },
      });

      if (input.findingId) {
        await ctx.db.finding.update({ where: { id: input.findingId }, data: { isToxic: true } });
      }
      if (input.riskId) {
        await ctx.db.risk.update({ where: { id: input.riskId }, data: { isToxic: true } });
      }

      // Release any previous member that is no longer this step's member.
      if (prevFindingId && prevFindingId !== input.findingId) {
        await resetFindingToxicIfOrphan(ctx.db, prevFindingId);
      }
      if (prevRiskId && prevRiskId !== input.riskId) {
        await resetRiskToxicIfOrphan(ctx.db, prevRiskId);
      }

      return { stepId: step.id, findingId: input.findingId ?? null, riskId: input.riskId ?? null };
    }),

  // -------------------------------------------------------------------------
  // unlinkMember — clear the step's finding/risk; reset isToxic if orphaned.
  // -------------------------------------------------------------------------
  unlinkMember: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(z.object({ stepId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const step = await assertStepInOrg(ctx.db, input.stepId, ctx.organizationId!);
      const releasedFindingId = step.findingId;
      const releasedRiskId = step.riskId;

      if (!releasedFindingId && !releasedRiskId) {
        return { stepId: step.id, findingId: null, riskId: null };
      }

      await ctx.db.pathwayStep.update({
        where: { id: step.id },
        data: { findingId: null, riskId: null },
      });

      if (releasedFindingId) await resetFindingToxicIfOrphan(ctx.db, releasedFindingId);
      if (releasedRiskId) await resetRiskToxicIfOrphan(ctx.db, releasedRiskId);

      return { stepId: step.id, findingId: null, riskId: null };
    }),

  // -------------------------------------------------------------------------
  // remove — delete the pathway (cascade steps); reset isToxic on findings /
  // risks no longer referenced by any pathway step.
  // -------------------------------------------------------------------------
  remove: organizationProcedure
    .use(requireRole(PATHWAY_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pathway = await ctx.db.pathway.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: { steps: { select: { findingId: true, riskId: true } } },
      });
      if (!pathway) throw new TRPCError({ code: "NOT_FOUND", message: "Pathway not found" });

      const findingIds = pathway.steps
        .map((s) => s.findingId)
        .filter((v): v is string => !!v);
      const riskIds = pathway.steps
        .map((s) => s.riskId)
        .filter((v): v is string => !!v);

      // Cascade deletes the steps (onDelete: Cascade on PathwayStep.pathway).
      await ctx.db.pathway.delete({ where: { id: pathway.id } });

      for (const fid of [...new Set(findingIds)]) await resetFindingToxicIfOrphan(ctx.db, fid);
      for (const rid of [...new Set(riskIds)]) await resetRiskToxicIfOrphan(ctx.db, rid);

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "TOXIC_CHAIN_DELETED" as unknown as AuditAction,
        entityType: "Pathway",
        entityId: pathway.id,
        actorName: ctx.session!.user.name ?? ctx.session!.user.email ?? undefined,
        actorRole: ctx.session!.user.role,
        changes: { before: { name: pathway.name }, after: null },
      });

      return { id: pathway.id };
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The Prisma client surface these helpers touch (mirrors `ctx.db`). */
type Db = PrismaClient;

/** Enforce exactly-one (or, when allowNone, at-most-one) member reference. */
function assertExactlyOneMember(
  findingId: string | undefined,
  riskId: string | undefined,
  { allowNone }: { allowNone: boolean },
) {
  const count = (findingId ? 1 : 0) + (riskId ? 1 : 0);
  if (count > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A pathway step references a finding OR a risk, not both.",
    });
  }
  if (count === 0 && !allowNone) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Provide exactly one of findingId or riskId.",
    });
  }
}

/** Verify the polymorphic assessment exists for the given kind + org. */
async function assertAssessmentInOrg(
  db: Db,
  kind: AssessmentKind,
  assessmentId: string,
  organizationId: string,
) {
  let exists = false;
  switch (kind) {
    case AssessmentKind.COMPLIANCE:
      exists = !!(await db.complianceAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    case AssessmentKind.MATURITY:
      exists = !!(await db.maturityAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    case AssessmentKind.VENDOR:
      exists = !!(await db.vendorAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    case AssessmentKind.RISK:
      exists = !!(await db.riskAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    case AssessmentKind.BIA:
      // BIA requests are org-scoped via their BusinessProcess.
      exists = !!(await db.bIAAssessmentRequest.findFirst({
        where: { id: assessmentId, process: { organizationId } },
        select: { id: true },
      }));
      break;
    default:
      exists = false;
  }
  if (!exists) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found for this organization." });
  }
}

/** Load a step and verify its parent pathway belongs to the caller's org. */
async function assertStepInOrg(db: Db, stepId: string, organizationId: string) {
  const step = await db.pathwayStep.findFirst({
    where: { id: stepId, pathway: { organizationId } },
    select: { id: true, pathwayId: true, findingId: true, riskId: true },
  });
  if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "Pathway step not found" });
  return step;
}

async function assertFindingInOrg(db: Db, findingId: string, organizationId: string) {
  const finding = await db.finding.findFirst({
    where: { id: findingId, organizationId },
    select: { id: true },
  });
  if (!finding) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
}

async function assertRiskInOrg(db: Db, riskId: string, organizationId: string) {
  const risk = await db.risk.findFirst({
    where: { id: riskId, organizationId },
    select: { id: true },
  });
  if (!risk) throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
}

/**
 * If a finding is no longer referenced by any pathway step member OR any step's
 * denormalized primary (across any pathway), clear its isToxic flag. Members are
 * the source of truth, but we also count the legacy primary column so toxicity
 * stays correct during the transition.
 */
async function resetFindingToxicIfOrphan(db: Db, findingId: string) {
  const [asMember, asPrimary] = await Promise.all([
    db.pathwayStepMember.count({ where: { findingId } }),
    db.pathwayStep.count({ where: { findingId } }),
  ]);
  if (asMember === 0 && asPrimary === 0) {
    await db.finding.update({ where: { id: findingId }, data: { isToxic: false } });
  }
}

/** As {@link resetFindingToxicIfOrphan}, for a risk. */
async function resetRiskToxicIfOrphan(db: Db, riskId: string) {
  const [asMember, asPrimary] = await Promise.all([
    db.pathwayStepMember.count({ where: { riskId } }),
    db.pathwayStep.count({ where: { riskId } }),
  ]);
  if (asMember === 0 && asPrimary === 0) {
    await db.risk.update({ where: { id: riskId }, data: { isToxic: false } });
  }
}

/**
 * Re-derive a step's denormalized primary finding/risk from its current member
 * set: primary finding = the oldest finding member, primary risk = the oldest
 * risk member (or null when none remain).
 */
async function syncStepPrimaryMember(db: Db, stepId: string) {
  const members = await db.pathwayStepMember.findMany({
    where: { stepId },
    orderBy: { createdAt: "asc" },
    select: { findingId: true, riskId: true },
  });
  const findingId = members.find((m) => m.findingId)?.findingId ?? null;
  const riskId = members.find((m) => m.riskId)?.riskId ?? null;
  await db.pathwayStep.update({ where: { id: stepId }, data: { findingId, riskId } });
}

/**
 * Validate that a finding/risk to be attached belongs to the SAME assessment as
 * the step's pathway (members are assessment-scoped, mirroring the AddStep
 * picker). Reuses the polymorphic (assessmentKind, assessmentId) link.
 */
async function assertMemberInPathwayAssessment(
  db: Db,
  pathwayId: string,
  organizationId: string,
  findingId: string | undefined,
  riskId: string | undefined,
) {
  const pathway = await db.pathway.findFirst({
    where: { id: pathwayId, organizationId },
    select: { assessmentKind: true, assessmentId: true },
  });
  if (!pathway) throw new TRPCError({ code: "NOT_FOUND", message: "Pathway not found" });

  // Findings/risks are scoped to an assessment via their source*AssessmentId
  // columns (mirrors finding.listForAssessment / risk.listForAssessment).
  if (findingId) {
    const ok = await db.finding.findFirst({
      where: {
        id: findingId,
        organizationId,
        ...(pathway.assessmentKind === AssessmentKind.MATURITY
          ? { sourceMaturityAssessmentId: pathway.assessmentId }
          : { sourceComplianceAssessmentId: pathway.assessmentId }),
      },
      select: { id: true },
    });
    if (!ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Finding does not belong to this pathway's assessment.",
      });
    }
  }

  if (riskId) {
    const ok = await db.risk.findFirst({
      where: {
        id: riskId,
        organizationId,
        sourceComplianceAssessmentId: pathway.assessmentId,
      },
      select: { id: true },
    });
    if (!ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Risk does not belong to this pathway's assessment.",
      });
    }
  }
}
