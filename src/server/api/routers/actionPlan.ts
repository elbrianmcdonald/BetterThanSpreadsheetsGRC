/**
 * Action Plan tRPC Router (Remediation Roadmap).
 *
 * A per-assessment list of `ActionPlanItem` initiatives, each closing zero or
 * more findings and optionally breaking the exploitation pathway. The client
 * renders these through the shared `RoadmapBody` deliverable component, so this
 * router maps each `ActionPlanItem` to the presentational `RoadmapAction` shape
 * (Decimals → numbers at the boundary).
 *
 * Security:
 * - Multi-tenant isolation: every read/write filters by `ctx.organizationId`.
 * - Role-based: writes require an authoring role (mirrors risk.ts / pathway.ts);
 *   reads additionally allow AUDITOR.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AssessmentKind, EffortLevel } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";
import { generateIdentifier } from "@/server/services/identifierService";
import {
  effortFor,
  costBandFor,
  phaseFor,
  type RoadmapAction,
} from "@/server/services/deliverableRoadmapData";
import type { FindingLike } from "@/components/deliverable/types";

// Authoring roles per the established pattern (risk.ts / pathway.ts); reads add BUSINESS_USER.
const ACTION_PLAN_MANAGE_ROLES: UserRole[] = [...WRITE_ROLES];
const ACTION_PLAN_READ_ROLES: UserRole[] = [...READ_ROLES];

type Db = PrismaClient;

/** Decimal → number | null at the API boundary. */
function decToNum(v: { toNumber: () => number } | null | undefined): number | null {
  return v == null ? null : v.toNumber();
}

/** Phase rank for ordering: 0–30 days < 30–90 days < 1–2 quarters. */
const PHASE_RANK: Record<string, number> = {
  "0–30 days": 0,
  "30–90 days": 1,
  "1–2 quarters": 2,
};
const EFFORT_RANK: Record<"S" | "M" | "L", number> = { S: 0, M: 1, L: 2 };

/** Finding fields needed to build a `FindingLike` for a remediated finding. */
const findingSelect = {
  id: true,
  identifier: true,
  title: true,
  severity: true,
  description: true,
  source: true,
  inherentLikelihood: true,
  inherentImpact: true,
} as const;

const itemInclude = {
  Owner: { select: { id: true, name: true } },
  findingLinks: {
    orderBy: { createdAt: "asc" as const },
    include: { finding: { select: findingSelect } },
  },
} as const;

type RawFinding = {
  id: string;
  identifier: string | null;
  title: string;
  severity: string | null;
  description: string | null;
  source: string | null;
  inherentLikelihood: { toNumber: () => number } | null;
  inherentImpact: { toNumber: () => number } | null;
};

/** Map a remediated Finding row to the shared `FindingLike` drawer shape. */
function toFindingLike(f: RawFinding): FindingLike {
  return {
    id: f.id,
    identifier: f.identifier,
    title: f.title,
    // FindingLike requires numeric L/I (drives the severity dot); default 3×3.
    likelihood: f.inherentLikelihood != null ? Math.round(f.inherentLikelihood.toNumber()) : 3,
    impact: f.inherentImpact != null ? Math.round(f.inherentImpact.toNumber()) : 3,
    domain: f.source ?? null,
    rationale: f.description ?? null,
  };
}

type RawItem = {
  id: string;
  identifier: string;
  title: string;
  detail: string | null;
  ownerTeam: string | null;
  Owner: { id: string; name: string } | null;
  effort: EffortLevel;
  costEstimate: { toNumber: () => number } | null;
  costBand: number | null;
  timelineEstimate: string;
  riskReduction: number;
  breaksPathway: boolean;
  findingLinks: Array<{ finding: RawFinding }>;
};

/** Map an `ActionPlanItem` (with finding links) to a `RoadmapAction`. */
function toRoadmapAction(item: RawItem): RoadmapAction {
  return {
    id: item.identifier,
    title: item.title,
    detail: item.detail ?? "",
    owner: item.Owner?.name ?? item.ownerTeam ?? null,
    effort: effortFor(item.effort),
    // Qualitative band (0–3) wins when set; otherwise derive from the dollar estimate.
    costBand:
      item.costBand != null
        ? ((Math.max(0, Math.min(3, item.costBand)) as 0 | 1 | 2 | 3))
        : costBandFor(decToNum(item.costEstimate) ?? 0),
    impact: item.riskReduction,
    phase: phaseFor(item.timelineEstimate),
    breaksToxic: item.breaksPathway,
    remediates: item.findingLinks.map((fl) => toFindingLike(fl.finding)),
  };
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
      exists = !!(await db.riskAssessmentProject.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    case AssessmentKind.BIA:
      exists = !!(await db.businessProcess.findFirst({
        where: { id: assessmentId, organizationId },
        select: { id: true },
      }));
      break;
    default:
      exists = false;
  }
  if (!exists) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Assessment not found for this organization.",
    });
  }
}

/**
 * Validate that every finding id belongs to this org AND was raised in this
 * assessment (scoped via source*AssessmentId, mirroring finding.listForAssessment).
 */
async function assertFindingsInAssessment(
  db: Db,
  findingIds: string[],
  kind: AssessmentKind,
  assessmentId: string,
  organizationId: string,
) {
  if (findingIds.length === 0) return;
  // Map each assessment kind to the Finding source field (mirrors
  // finding.listForAssessment). RISK uses the discovery-project link; BIA has
  // no Finding link, so any findingIds passed for BIA simply won't match.
  const scope =
    kind === AssessmentKind.MATURITY
      ? { sourceMaturityAssessmentId: assessmentId }
      : kind === AssessmentKind.VENDOR
        ? { vendorAssessmentId: assessmentId }
        : kind === AssessmentKind.RISK
          ? { discoveryProjectId: assessmentId }
          : { sourceComplianceAssessmentId: assessmentId };
  const found = await db.finding.findMany({
    where: { id: { in: findingIds }, organizationId, ...scope },
    select: { id: true },
  });
  if (found.length !== new Set(findingIds).size) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more findings do not belong to this assessment.",
    });
  }
}

const editableFields = {
  title: z.string().min(1).max(200),
  detail: z.string().max(10000).nullish(),
  ownerTeam: z.string().max(200).nullish(),
  ownerId: z.string().nullish(),
  effort: z.nativeEnum(EffortLevel),
  // Cost: quantitative dollar estimate OR qualitative band (0=none,1=low,2=med,3=high).
  costEstimate: z.number().nonnegative().nullish(),
  costBand: z.number().int().min(0).max(3).nullish(),
  timelineEstimate: z.string().min(1).max(100),
  riskReduction: z.number().int().min(1).max(5),
  breaksPathway: z.boolean(),
};

export const actionPlanRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // listForAssessment — RoadmapAction[] for one assessment, ordered by phase
  // then effort (S < M < L), then identifier for a stable tie-break.
  // -------------------------------------------------------------------------
  listForAssessment: organizationProcedure
    .use(requireRole(ACTION_PLAN_READ_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }): Promise<RoadmapAction[]> => {
      const items = await ctx.db.actionPlanItem.findMany({
        where: {
          organizationId: ctx.organizationId!,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
        },
        include: itemInclude,
      });

      const actions = items.map((i) => toRoadmapAction(i as unknown as RawItem));
      return actions.sort((a, b) => {
        const pa = PHASE_RANK[a.phase] ?? 99;
        const pb = PHASE_RANK[b.phase] ?? 99;
        if (pa !== pb) return pa - pb;
        if (EFFORT_RANK[a.effort] !== EFFORT_RANK[b.effort]) {
          return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
        }
        return a.id.localeCompare(b.id);
      });
    }),

  // -------------------------------------------------------------------------
  // create — a new initiative + one ActionPlanItemFinding per linked finding.
  // -------------------------------------------------------------------------
  create: organizationProcedure
    .use(requireRole(ACTION_PLAN_MANAGE_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        assessmentId: z.string().min(1),
        ...editableFields,
        findingIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      await assertAssessmentInOrg(ctx.db, input.assessmentKind, input.assessmentId, orgId);

      const findingIds = [...new Set(input.findingIds)];
      await assertFindingsInAssessment(
        ctx.db,
        findingIds,
        input.assessmentKind,
        input.assessmentId,
        orgId,
      );

      const identifier = await generateIdentifier(orgId, "AP");

      return ctx.db.actionPlanItem.create({
        data: {
          organizationId: orgId,
          identifier,
          assessmentKind: input.assessmentKind,
          assessmentId: input.assessmentId,
          title: input.title,
          detail: input.detail?.trim() ? input.detail.trim() : null,
          ownerTeam: input.ownerTeam?.trim() ? input.ownerTeam.trim() : null,
          ownerId: input.ownerId ?? null,
          effort: input.effort,
          costEstimate: input.costEstimate ?? null,
          costBand: input.costBand ?? null,
          timelineEstimate: input.timelineEstimate,
          riskReduction: input.riskReduction,
          breaksPathway: input.breaksPathway,
          createdById: ctx.session!.user.id,
          findingLinks: {
            create: findingIds.map((findingId) => ({ findingId })),
          },
        },
        select: { id: true, identifier: true },
      });
    }),

  // -------------------------------------------------------------------------
  // update — edit fields; if findingIds given, replace the link set.
  // -------------------------------------------------------------------------
  update: organizationProcedure
    .use(requireRole(ACTION_PLAN_MANAGE_ROLES))
    .input(
      z.object({
        id: z.string().min(1),
        ...editableFields,
        findingIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const existing = await ctx.db.actionPlanItem.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true, assessmentKind: true, assessmentId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action plan item not found" });
      }

      if (input.findingIds) {
        const findingIds = [...new Set(input.findingIds)];
        await assertFindingsInAssessment(
          ctx.db,
          findingIds,
          existing.assessmentKind,
          existing.assessmentId,
          orgId,
        );
      }

      return ctx.db.actionPlanItem.update({
        where: { id: input.id },
        data: {
          title: input.title,
          detail: input.detail?.trim() ? input.detail.trim() : null,
          ownerTeam: input.ownerTeam?.trim() ? input.ownerTeam.trim() : null,
          ownerId: input.ownerId ?? null,
          effort: input.effort,
          costEstimate: input.costEstimate ?? null,
          costBand: input.costBand ?? null,
          timelineEstimate: input.timelineEstimate,
          riskReduction: input.riskReduction,
          breaksPathway: input.breaksPathway,
          ...(input.findingIds
            ? {
                findingLinks: {
                  deleteMany: {},
                  create: [...new Set(input.findingIds)].map((findingId) => ({ findingId })),
                },
              }
            : {}),
        },
        select: { id: true, identifier: true },
      });
    }),

  // -------------------------------------------------------------------------
  // remove — delete an initiative (cascade removes its finding links).
  // -------------------------------------------------------------------------
  remove: organizationProcedure
    .use(requireRole(ACTION_PLAN_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.actionPlanItem.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Action plan item not found" });
      }
      await ctx.db.actionPlanItem.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
