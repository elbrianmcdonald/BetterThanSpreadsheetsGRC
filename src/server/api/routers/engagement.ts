/**
 * Engagement Router — Polymorphic Engagement Wrapper.
 *
 * An `Engagement` WRAPS exactly one already-existing assessment of some
 * `AssessmentKind` (COMPLIANCE | VENDOR | RISK | MATURITY | BIA) with consulting
 * metadata (client, sector, window, RACI, schedule, evidence) and a guided
 * phase wizard. The wrapper is purely additive — it NEVER creates the underlying
 * assessment and never duplicates scoring logic. Interviews/scoring stay native
 * to the linked assessment; the engagement only links to it via the app-enforced
 * polymorphic FK (`assessmentKind` + `assessmentId`, unique per org).
 *
 * NOTE on audit actions: the `AuditAction` enum lives in schema.prisma. We use
 * the cast pattern established by `deliverable.ts`
 * (`"X" as unknown as AuditAction`) for the engagement actions
 * ENGAGEMENT_CREATED / ENGAGEMENT_UPDATED / ENGAGEMENT_DELIVERED.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  AssessmentKind,
  EngagementStatus,
  EngagementPhase,
  EngagementEvidenceStatus,
  RaciRole,
  type AuditAction,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import { generateIdentifier } from "@/server/services/identifierService";
import { MEETING_PLAN, DOC_REQUESTS } from "@/lib/engagement/assessment-methodology";

// =============================================================================
// Roles
// =============================================================================

const ENGAGEMENT_VIEW_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.CISO,
  UserRole.AUDITOR,
];

const ENGAGEMENT_MANAGE_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.CISO,
];

// =============================================================================
// Polymorphic assessment resolution
// =============================================================================

type ResolvedAssessment = {
  kind: AssessmentKind;
  id: string;
  name: string;
  status: string | null;
  href: string;
};

/**
 * Verify the referenced assessment EXISTS for the given kind in the caller's
 * org. Returns a resolved descriptor (name/status/href) or null if absent. Each
 * branch maps a kind to its concrete Prisma model and that model's
 * name/title/identifier + status field, plus the detail-page route.
 */
async function resolveAssessment(
  db: any,
  organizationId: string,
  kind: AssessmentKind,
  assessmentId: string,
): Promise<ResolvedAssessment | null> {
  switch (kind) {
    case AssessmentKind.COMPLIANCE: {
      const a = await db.complianceAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true, name: true, identifier: true, status: true },
      });
      if (!a) return null;
      return {
        kind,
        id: a.id,
        name: a.name ?? a.identifier,
        status: a.status ?? null,
        href: `/compliance/assessments/${a.id}`,
      };
    }
    case AssessmentKind.MATURITY: {
      const a = await db.maturityAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true, name: true, identifier: true, status: true },
      });
      if (!a) return null;
      return {
        kind,
        id: a.id,
        name: a.name ?? a.identifier,
        status: a.status ?? null,
        href: `/maturity/${a.id}`,
      };
    }
    case AssessmentKind.RISK: {
      const a = await db.riskAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true, title: true, identifier: true, status: true },
      });
      if (!a) return null;
      return {
        kind,
        id: a.id,
        name: a.title ?? a.identifier,
        status: a.status ?? null,
        href: `/risk-assessments/${a.id}`,
      };
    }
    case AssessmentKind.VENDOR: {
      const a = await db.vendorAssessment.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true, title: true, identifier: true, status: true },
      });
      if (!a) return null;
      return {
        kind,
        id: a.id,
        name: a.title ?? a.identifier,
        status: a.status ?? null,
        href: `/tprm/assessments/${a.id}`,
      };
    }
    case AssessmentKind.BIA: {
      // BIA engagements are anchored to a BusinessProcess — the
      // /bia/processes/[id] page passes the process id as the assessment id.
      const a = await db.businessProcess.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true, name: true, assessmentStatus: true },
      });
      if (!a) return null;
      return {
        kind,
        id: a.id,
        name: a.name ?? a.id,
        status: (a.assessmentStatus as string | null) ?? null,
        href: `/bia/processes/${a.id}`,
      };
    }
    default:
      return null;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Fetch an engagement scoped to the caller's org, or throw NOT_FOUND. This is
 * the single point that enforces cross-org isolation for every nested op.
 */
async function getEngagementOrThrow(
  db: any,
  id: string,
  organizationId: string,
): Promise<{ id: string }> {
  const eng = (await db.engagement.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })) as { id: string } | null;
  if (!eng) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found" });
  }
  return eng;
}

// =============================================================================
// Router
// =============================================================================

export const engagementRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // create — wraps an EXISTING assessment of the given kind.
  // ---------------------------------------------------------------------------
  create: organizationProcedure
    .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1, "assessmentId is required"),
        clientName: z.string().min(1, "Client name is required").max(200),
        sector: z.string().max(200).optional().nullable(),
        size: z.string().max(200).optional().nullable(),
        engagementWindow: z.string().max(200).optional().nullable(),
        consultancy: z.string().max(200).optional().nullable(),
        inScopeDomains: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      if (!organizationId || !session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Validate the referenced assessment exists for this kind in the org.
      const resolved = await resolveAssessment(
        db,
        organizationId,
        input.assessmentKind,
        input.assessmentId,
      );
      if (!resolved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Referenced assessment not found for this organization.",
        });
      }

      // Enforce one engagement per assessment (mirrors the unique index so we
      // surface a clean error rather than a Prisma constraint violation).
      const existing = await db.engagement.findFirst({
        where: {
          organizationId,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An engagement already wraps this assessment.",
        });
      }

      const identifier = await generateIdentifier(organizationId, "ENG");

      const engagement = await db.engagement.create({
        data: {
          organizationId,
          identifier,
          clientName: input.clientName,
          sector: input.sector ?? null,
          size: input.size ?? null,
          engagementWindow: input.engagementWindow ?? null,
          consultancy: input.consultancy ?? null,
          analystId: session.user.id,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
          status: EngagementStatus.SCOPING,
          phase: EngagementPhase.setup,
          inScopeDomains: input.inScopeDomains ?? [],
          createdById: session.user.id,
        },
      });

      void createAuditLog({
        organizationId,
        userId: session.user.id,
        action: "ENGAGEMENT_CREATED" as unknown as AuditAction,
        entityType: "Engagement",
        entityId: engagement.id,
        actorName: session.user.name ?? session.user.email ?? undefined,
        actorRole: session.user.role,
      });

      return engagement;
    }),

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  list: organizationProcedure
    .use(requireRole(ENGAGEMENT_VIEW_ROLES))
    .input(
      z
        .object({
          assessmentKind: z.nativeEnum(AssessmentKind).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });

      return db.engagement.findMany({
        where: {
          organizationId,
          ...(input?.assessmentKind ? { assessmentKind: input.assessmentKind } : {}),
        },
        select: {
          id: true,
          identifier: true,
          clientName: true,
          assessmentKind: true,
          assessmentId: true,
          status: true,
          phase: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ---------------------------------------------------------------------------
  // getById — engagement + children + resolved linkedAssessment.
  // ---------------------------------------------------------------------------
  getById: organizationProcedure
    .use(requireRole(ENGAGEMENT_VIEW_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });

      const engagement = await db.engagement.findFirst({
        where: { id: input.id, organizationId },
        include: {
          sessions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          stakeholders: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          evidenceRequests: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      });

      if (!engagement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Engagement not found" });
      }

      const linkedAssessment = await resolveAssessment(
        db,
        organizationId,
        engagement.assessmentKind,
        engagement.assessmentId,
      );

      return { ...engagement, linkedAssessment };
    }),

  // ---------------------------------------------------------------------------
  // getByAssessment — find the engagement wrapping a given assessment (or null).
  // ---------------------------------------------------------------------------
  getByAssessment: organizationProcedure
    .use(requireRole(ENGAGEMENT_VIEW_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });

      const engagement = await db.engagement.findFirst({
        where: {
          organizationId,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
        },
      });

      return engagement ?? null;
    }),

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  update: organizationProcedure
    .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        clientName: z.string().min(1).max(200).optional(),
        sector: z.string().max(200).optional().nullable(),
        size: z.string().max(200).optional().nullable(),
        engagementWindow: z.string().max(200).optional().nullable(),
        consultancy: z.string().max(200).optional().nullable(),
        inScopeDomains: z.array(z.string()).optional(),
        phase: z.nativeEnum(EngagementPhase).optional(),
        status: z.nativeEnum(EngagementStatus).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      if (!organizationId || !session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await getEngagementOrThrow(db, input.id, organizationId);

      const { id, ...data } = input;
      const updated = await db.engagement.update({
        where: { id },
        data: {
          ...(data.clientName !== undefined && { clientName: data.clientName }),
          ...(data.sector !== undefined && { sector: data.sector }),
          ...(data.size !== undefined && { size: data.size }),
          ...(data.engagementWindow !== undefined && { engagementWindow: data.engagementWindow }),
          ...(data.consultancy !== undefined && { consultancy: data.consultancy }),
          ...(data.inScopeDomains !== undefined && { inScopeDomains: data.inScopeDomains }),
          ...(data.phase !== undefined && { phase: data.phase }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      void createAuditLog({
        organizationId,
        userId: session.user.id,
        action: "ENGAGEMENT_UPDATED" as unknown as AuditAction,
        entityType: "Engagement",
        entityId: id,
        actorName: session.user.name ?? session.user.email ?? undefined,
        actorRole: session.user.role,
      });

      return updated;
    }),

  // ---------------------------------------------------------------------------
  // session.*
  // ---------------------------------------------------------------------------
  session: createTRPCRouter({
    list: organizationProcedure
      .use(requireRole(ENGAGEMENT_VIEW_ROLES))
      .input(z.object({ engagementId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementSession.findMany({
          where: { engagementId: input.engagementId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
      }),

    create: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          engagementId: z.string().min(1),
          name: z.string().min(1).max(200),
          purpose: z.string().max(2000).optional().nullable(),
          week: z.string().max(100).optional().nullable(),
          duration: z.string().max(100).optional().nullable(),
          attendees: z.array(z.string()).optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementSession.create({
          data: {
            engagementId: input.engagementId,
            name: input.name,
            purpose: input.purpose ?? null,
            week: input.week ?? null,
            duration: input.duration ?? null,
            attendees: input.attendees ?? [],
            sortOrder: input.sortOrder ?? 0,
          },
        });
      }),

    update: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1).max(200).optional(),
          purpose: z.string().max(2000).optional().nullable(),
          week: z.string().max(100).optional().nullable(),
          duration: z.string().max(100).optional().nullable(),
          attendees: z.array(z.string()).optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertSessionInOrg(db, input.id, organizationId);
        const { id, ...data } = input;
        return db.engagementSession.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.purpose !== undefined && { purpose: data.purpose }),
            ...(data.week !== undefined && { week: data.week }),
            ...(data.duration !== undefined && { duration: data.duration }),
            ...(data.attendees !== undefined && { attendees: data.attendees }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          },
        });
      }),

    remove: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertSessionInOrg(db, input.id, organizationId);
        await db.engagementSession.delete({ where: { id: input.id } });
        return { success: true };
      }),

    seedRecommended: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ engagementId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);

        // Idempotent: only insert recommended sessions whose name isn't present.
        const existing = await db.engagementSession.findMany({
          where: { engagementId: input.engagementId },
          select: { name: true },
        });
        const have = new Set(existing.map((s) => s.name));
        const toCreate = MEETING_PLAN.filter((m) => !have.has(m.name)).map(
          (m, i) => ({
            engagementId: input.engagementId,
            name: m.name,
            purpose: m.purpose,
            week: m.week,
            duration: m.duration,
            attendees: [...m.attendees],
            sortOrder: existing.length + i,
          }),
        );
        if (toCreate.length > 0) {
          await db.engagementSession.createMany({ data: toCreate });
        }
        return { inserted: toCreate.length };
      }),
  }),

  // ---------------------------------------------------------------------------
  // stakeholder.*
  // ---------------------------------------------------------------------------
  stakeholder: createTRPCRouter({
    list: organizationProcedure
      .use(requireRole(ENGAGEMENT_VIEW_ROLES))
      .input(z.object({ engagementId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementStakeholder.findMany({
          where: { engagementId: input.engagementId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
      }),

    create: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          engagementId: z.string().min(1),
          name: z.string().min(1).max(200),
          role: z.string().max(200).optional().nullable(),
          domain: z.string().max(100).optional().nullable(),
          raci: z.nativeEnum(RaciRole).optional().nullable(),
          isReviewer: z.boolean().optional(),
          isApprover: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementStakeholder.create({
          data: {
            engagementId: input.engagementId,
            name: input.name,
            role: input.role ?? null,
            domain: input.domain ?? null,
            raci: input.raci ?? null,
            isReviewer: input.isReviewer ?? false,
            isApprover: input.isApprover ?? false,
            sortOrder: input.sortOrder ?? 0,
          },
        });
      }),

    update: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1).max(200).optional(),
          role: z.string().max(200).optional().nullable(),
          domain: z.string().max(100).optional().nullable(),
          raci: z.nativeEnum(RaciRole).optional().nullable(),
          isReviewer: z.boolean().optional(),
          isApprover: z.boolean().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertStakeholderInOrg(db, input.id, organizationId);
        const { id, ...data } = input;
        return db.engagementStakeholder.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.role !== undefined && { role: data.role }),
            ...(data.domain !== undefined && { domain: data.domain }),
            ...(data.raci !== undefined && { raci: data.raci }),
            ...(data.isReviewer !== undefined && { isReviewer: data.isReviewer }),
            ...(data.isApprover !== undefined && { isApprover: data.isApprover }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          },
        });
      }),

    remove: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertStakeholderInOrg(db, input.id, organizationId);
        await db.engagementStakeholder.delete({ where: { id: input.id } });
        return { success: true };
      }),
  }),

  // ---------------------------------------------------------------------------
  // evidence.*
  // ---------------------------------------------------------------------------
  evidence: createTRPCRouter({
    list: organizationProcedure
      .use(requireRole(ENGAGEMENT_VIEW_ROLES))
      .input(z.object({ engagementId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementEvidenceRequest.findMany({
          where: { engagementId: input.engagementId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
      }),

    create: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          engagementId: z.string().min(1),
          item: z.string().min(1).max(500),
          domain: z.string().max(100).optional().nullable(),
          status: z.nativeEnum(EngagementEvidenceStatus).optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);
        return db.engagementEvidenceRequest.create({
          data: {
            engagementId: input.engagementId,
            item: input.item,
            domain: input.domain ?? null,
            status: input.status ?? EngagementEvidenceStatus.REQUESTED,
            sortOrder: input.sortOrder ?? 0,
          },
        });
      }),

    update: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(
        z.object({
          id: z.string().min(1),
          item: z.string().min(1).max(500).optional(),
          domain: z.string().max(100).optional().nullable(),
          status: z.nativeEnum(EngagementEvidenceStatus).optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertEvidenceInOrg(db, input.id, organizationId);
        const { id, ...data } = input;
        return db.engagementEvidenceRequest.update({
          where: { id },
          data: {
            ...(data.item !== undefined && { item: data.item }),
            ...(data.domain !== undefined && { domain: data.domain }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          },
        });
      }),

    remove: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await assertEvidenceInOrg(db, input.id, organizationId);
        await db.engagementEvidenceRequest.delete({ where: { id: input.id } });
        return { success: true };
      }),

    cycleStatus: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        const ev = await assertEvidenceInOrg(db, input.id, organizationId);
        const next: Record<EngagementEvidenceStatus, EngagementEvidenceStatus> = {
          REQUESTED: EngagementEvidenceStatus.PARTIAL,
          PARTIAL: EngagementEvidenceStatus.RECEIVED,
          RECEIVED: EngagementEvidenceStatus.REQUESTED,
        };
        return db.engagementEvidenceRequest.update({
          where: { id: input.id },
          data: { status: next[ev.status] },
        });
      }),

    seedRecommended: organizationProcedure
      .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
      .input(z.object({ engagementId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { db, organizationId } = ctx;
        if (!organizationId) throw new TRPCError({ code: "BAD_REQUEST" });
        await getEngagementOrThrow(db, input.engagementId, organizationId);

        const existing = await db.engagementEvidenceRequest.findMany({
          where: { engagementId: input.engagementId },
          select: { item: true },
        });
        const have = new Set(existing.map((e) => e.item));
        const toCreate = DOC_REQUESTS.filter((d) => !have.has(d.item)).map(
          (d, i) => ({
            engagementId: input.engagementId,
            item: d.item,
            domain: d.domain,
            status: d.status as EngagementEvidenceStatus,
            sortOrder: existing.length + i,
          }),
        );
        if (toCreate.length > 0) {
          await db.engagementEvidenceRequest.createMany({ data: toCreate });
        }
        return { inserted: toCreate.length };
      }),
  }),

  // ---------------------------------------------------------------------------
  // markDelivered
  // ---------------------------------------------------------------------------
  markDelivered: organizationProcedure
    .use(requireRole(ENGAGEMENT_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      if (!organizationId || !session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await getEngagementOrThrow(db, input.id, organizationId);

      const updated = await db.engagement.update({
        where: { id: input.id },
        data: {
          status: EngagementStatus.DELIVERED,
          phase: EngagementPhase.review,
          deliveredAt: new Date(),
        },
      });

      void createAuditLog({
        organizationId,
        userId: session.user.id,
        action: "ENGAGEMENT_DELIVERED" as unknown as AuditAction,
        entityType: "Engagement",
        entityId: input.id,
        actorName: session.user.name ?? session.user.email ?? undefined,
        actorRole: session.user.role,
      });

      return updated;
    }),
});

// =============================================================================
// Child-entity org-scope assertions (children are scoped via their engagement)
// =============================================================================

async function assertSessionInOrg(db: any, id: string, organizationId: string) {
  const row = await db.engagementSession.findFirst({
    where: { id, engagement: { organizationId } },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
  return row;
}

async function assertStakeholderInOrg(db: any, id: string, organizationId: string) {
  const row = await db.engagementStakeholder.findFirst({
    where: { id, engagement: { organizationId } },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Stakeholder not found" });
  return row;
}

async function assertEvidenceInOrg(
  db: any,
  id: string,
  organizationId: string,
): Promise<{ id: string; status: EngagementEvidenceStatus }> {
  const row = await db.engagementEvidenceRequest.findFirst({
    where: { id, engagement: { organizationId } },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence request not found" });
  return row;
}
