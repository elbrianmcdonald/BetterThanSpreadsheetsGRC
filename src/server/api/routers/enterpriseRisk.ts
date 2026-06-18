/**
 * Enterprise Risk router.
 *
 * Top-level rollup risks. Each child Risk can be aligned to one EnterpriseRisk.
 * Score defaults to a calculated rollup of children; can be manually overridden.
 * Each enterprise risk has a user-defined review cadence and an audit log of reviews.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, UserRole, type PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { calculateInherentScore, isScoreResult } from "@/lib/matrix/scoring";
import { score2D, thresholdForScore } from "@/lib/matrix/heatmap";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import { recomputeEnterpriseRiskScore } from "@/server/services/enterpriseRiskScore";
import { createAuditLog } from "@/server/services/audit-log.service";

const ENTERPRISE_RISK_WRITE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * If the enterprise risk has a matrix version selected and manual L/I values, compute a
 * score from the matrix. Returns updates to apply (or undefined values if no matrix).
 */
async function computeManualScoreFromMatrix(
  db: PrismaClient,
  matrixVersionId: string | null | undefined,
  likelihood: number | null | undefined,
  impact: number | null | undefined,
): Promise<{ score: Prisma.Decimal | null; label: string | null }> {
  if (!matrixVersionId || likelihood === null || likelihood === undefined || impact === null || impact === undefined) {
    return { score: null, label: null };
  }
  const matrixVersion = await db.riskMatrixVersion.findUnique({
    where: { id: matrixVersionId },
    include: { template: true },
  });
  if (!matrixVersion) {
    return { score: null, label: null };
  }
  const scales = matrixVersion.scales as unknown as MatrixScales;
  const thresholds = matrixVersion.thresholds as unknown as Threshold[];
  const outputScaleMax = Number(matrixVersion.template.outputScaleMax);
  const result = calculateInherentScore(scales, thresholds, outputScaleMax, likelihood, impact);
  if (!isScoreResult(result)) {
    return { score: null, label: null };
  }
  return { score: new Prisma.Decimal(result.normalizedScore), label: result.label };
}

/** A matrix version reduced to the bits needed to size/score a heatmap grid. */
interface ReferenceMatrix {
  versionId: string;
  templateName: string;
  scales: MatrixScales;
  thresholds: Threshold[];
  outputScaleMax: number;
}

/**
 * Resolve a specific published matrix version (by id) into a ReferenceMatrix,
 * falling back to the org's default published matrix. Returns null when neither
 * is available. Mirrors riskMatrix.getOrgPublishedMatrix's default selection.
 */
async function resolveReferenceMatrix(
  db: PrismaClient,
  organizationId: string,
  preferredVersionId?: string | null,
): Promise<ReferenceMatrix | null> {
  if (preferredVersionId) {
    const v = await db.riskMatrixVersion.findFirst({
      where: { id: preferredVersionId, template: { organizationId } },
      include: { template: true },
    });
    if (v) {
      return {
        versionId: v.id,
        templateName: v.template.name,
        scales: v.scales as unknown as MatrixScales,
        thresholds: v.thresholds as unknown as Threshold[],
        outputScaleMax: Number(v.template.outputScaleMax),
      };
    }
  }
  const defaultTemplate = await db.riskMatrixTemplate.findFirst({
    where: { organizationId, isDefault: true, isActive: true, currentVersionId: { not: null } },
    include: { currentVersion: true },
  });
  const tpl =
    defaultTemplate ??
    (await db.riskMatrixTemplate.findFirst({
      where: { organizationId, isActive: true, currentVersionId: { not: null } },
      orderBy: { updatedAt: "desc" },
      include: { currentVersion: true },
    }));
  if (!tpl?.currentVersion) return null;
  return {
    versionId: tpl.currentVersion.id,
    templateName: tpl.name,
    scales: tpl.currentVersion.scales as unknown as MatrixScales,
    thresholds: tpl.currentVersion.thresholds as unknown as Threshold[],
    outputScaleMax: Number(tpl.outputScaleMax),
  };
}

/** Round a value to the nearest available scale level (by `value`). */
function nearestScaleValue(value: number, levels: { value: number }[]): number {
  let best = levels[0]?.value ?? value;
  let bestDist = Infinity;
  for (const l of levels) {
    const d = Math.abs(l.value - value);
    if (d < bestDist) {
      bestDist = d;
      best = l.value;
    }
  }
  return best;
}

export const enterpriseRiskRouter = createTRPCRouter({
  /**
   * List all enterprise risks for the org with: child counts grouped by score band,
   * latest snapshot, and review status.
   */
  list: organizationProcedure.query(async ({ ctx }) => {
    const orgId = ctx.organizationId!;
    const items = await ctx.db.enterpriseRisk.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      include: {
        Owner: { select: { id: true, name: true, email: true } },
        _count: { select: { ChildRisks: true } },
      },
    });

    // Per-row child counts grouped by effective score label (residual ?? inherent ?? "Unscored").
    // One query that pulls just the columns we need; bucket in JS.
    const childRows = await ctx.db.risk.findMany({
      where: { organizationId: orgId, enterpriseRiskId: { not: null } },
      select: {
        enterpriseRiskId: true,
        severity: true,
        residualScoreLabel: true,
        inherentScoreLabel: true,
      },
    });
    const buckets: Record<string, Record<string, number>> = {};
    for (const r of childRows) {
      if (!r.enterpriseRiskId) continue;
      const label = r.residualScoreLabel ?? r.inherentScoreLabel ?? r.severity ?? "Unscored";
      const bucket = (buckets[r.enterpriseRiskId] ??= {});
      bucket[label] = (bucket[label] ?? 0) + 1;
    }

    // Latest snapshot per enterprise risk for sparkline preview (last 10 points).
    const recentSnapshots = await ctx.db.enterpriseRiskSeveritySnapshot.findMany({
      where: { EnterpriseRisk: { organizationId: orgId } },
      orderBy: { capturedAt: "desc" },
      take: Math.max(items.length, 1) * 10,
      select: { enterpriseRiskId: true, score: true, capturedAt: true },
    });
    const sparkData: Record<string, Array<{ score: number | null; capturedAt: Date }>> = {};
    for (const s of recentSnapshots) {
      const arr = (sparkData[s.enterpriseRiskId] ??= []);
      if (arr.length < 10) {
        arr.push({
          score: s.score ? Number(s.score) : null,
          capturedAt: s.capturedAt,
        });
      }
    }
    for (const k of Object.keys(sparkData)) {
      const arr = sparkData[k];
      if (arr) sparkData[k] = arr.reverse();
    }

    return items.map((er) => ({
      ...er,
      childCountsByLabel: buckets[er.id] ?? {},
      sparkline: sparkData[er.id] ?? [],
    }));
  }),

  /** Full detail for one enterprise risk. */
  byId: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const er = await ctx.db.enterpriseRisk.findFirst({
        where: { id: input.id, organizationId: orgId },
        include: {
          Owner: { select: { id: true, name: true, email: true, jobTitle: true } },
          MatrixVersion: { include: { template: true } },
        },
      });
      if (!er) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enterprise risk not found" });
      }
      const [snapshots, reviews, childRisks, childFindings, viewMatrix] = await Promise.all([
        ctx.db.enterpriseRiskSeveritySnapshot.findMany({
          where: { enterpriseRiskId: er.id },
          orderBy: { capturedAt: "asc" },
        }),
        ctx.db.enterpriseRiskReview.findMany({
          where: { enterpriseRiskId: er.id },
          orderBy: { reviewedAt: "desc" },
          include: { Reviewer: { select: { id: true, name: true, email: true } } },
        }),
        ctx.db.risk.findMany({
          where: { enterpriseRiskId: er.id, organizationId: orgId },
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            identifier: true,
            title: true,
            severity: true,
            status: true,
            residualScore: true,
            residualScoreLabel: true,
            residualLikelihood: true,
            residualImpact: true,
            inherentScore: true,
            inherentScoreLabel: true,
            inherentLikelihood: true,
            inherentImpact: true,
            createdAt: true,
          },
        }),
        ctx.db.finding.findMany({
          where: { enterpriseRiskId: er.id, organizationId: orgId },
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            identifier: true,
            title: true,
            severity: true,
            severityLabel: true,
            status: true,
            createdAt: true,
          },
        }),
        resolveReferenceMatrix(ctx.db, orgId, er.matrixVersionId),
      ]);
      return { enterpriseRisk: er, snapshots, reviews, childRisks, childFindings, viewMatrix };
    }),

  create: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .input(
      z.object({
        name: z.string().min(2).max(200),
        description: z.string().max(5000).optional(),
        ownerId: z.string().optional().nullable(),
        matrixVersionId: z.string().optional().nullable(),
        useManualScore: z.boolean().optional(),
        manualLikelihood: z.number().optional().nullable(),
        manualImpact: z.number().optional().nullable(),
        reviewIntervalDays: z.number().int().positive().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const matrixCalc = await computeManualScoreFromMatrix(
        ctx.db,
        input.matrixVersionId ?? null,
        input.manualLikelihood ?? null,
        input.manualImpact ?? null,
      );
      const created = await ctx.db.enterpriseRisk.create({
        data: {
          organizationId: orgId,
          name: input.name,
          description: input.description ?? null,
          ownerId: input.ownerId ?? null,
          matrixVersionId: input.matrixVersionId ?? null,
          useManualScore: input.useManualScore ?? false,
          manualLikelihood: input.manualLikelihood !== null && input.manualLikelihood !== undefined
            ? new Prisma.Decimal(input.manualLikelihood) : null,
          manualImpact: input.manualImpact !== null && input.manualImpact !== undefined
            ? new Prisma.Decimal(input.manualImpact) : null,
          manualScore: matrixCalc.score,
          manualScoreLabel: matrixCalc.label,
          reviewIntervalDays: input.reviewIntervalDays ?? null,
          nextReviewDue: input.reviewIntervalDays
            ? addDays(new Date(), input.reviewIntervalDays)
            : null,
        },
      });
      await recomputeEnterpriseRiskScore(ctx.db, created.id);
      void createAuditLog({
        organizationId: orgId,
        userId: ctx.session!.user.id,
        action: "CREATE_ENTERPRISE_RISK",
        entityType: "EnterpriseRisk",
        entityId: created.id,
        changes: { before: null, after: { name: created.name } },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });
      return created;
    }),

  update: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(200).optional(),
        description: z.string().max(5000).optional().nullable(),
        ownerId: z.string().optional().nullable(),
        matrixVersionId: z.string().optional().nullable(),
        useManualScore: z.boolean().optional(),
        manualLikelihood: z.number().optional().nullable(),
        manualImpact: z.number().optional().nullable(),
        reviewIntervalDays: z.number().int().positive().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const existing = await ctx.db.enterpriseRisk.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enterprise risk not found" });
      }

      // Resolve matrix-driven manual score whenever either matrix or L/I is touched.
      const matrixVersionId = input.matrixVersionId === undefined
        ? existing.matrixVersionId : input.matrixVersionId;
      const likelihood = input.manualLikelihood !== undefined
        ? input.manualLikelihood
        : existing.manualLikelihood ? Number(existing.manualLikelihood) : null;
      const impact = input.manualImpact !== undefined
        ? input.manualImpact
        : existing.manualImpact ? Number(existing.manualImpact) : null;
      const matrixCalc = await computeManualScoreFromMatrix(ctx.db, matrixVersionId, likelihood, impact);

      const data: Prisma.EnterpriseRiskUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.ownerId !== undefined) {
        data.Owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
      }
      if (input.matrixVersionId !== undefined) {
        data.MatrixVersion = input.matrixVersionId
          ? { connect: { id: input.matrixVersionId } }
          : { disconnect: true };
      }
      if (input.useManualScore !== undefined) data.useManualScore = input.useManualScore;
      if (input.manualLikelihood !== undefined) {
        data.manualLikelihood = input.manualLikelihood !== null
          ? new Prisma.Decimal(input.manualLikelihood) : null;
      }
      if (input.manualImpact !== undefined) {
        data.manualImpact = input.manualImpact !== null
          ? new Prisma.Decimal(input.manualImpact) : null;
      }
      if (
        input.matrixVersionId !== undefined ||
        input.manualLikelihood !== undefined ||
        input.manualImpact !== undefined
      ) {
        data.manualScore = matrixCalc.score;
        data.manualScoreLabel = matrixCalc.label;
      }
      if (input.reviewIntervalDays !== undefined) {
        data.reviewIntervalDays = input.reviewIntervalDays;
        // Recompute next review due relative to lastReviewedAt (or now if never reviewed).
        const anchor = existing.lastReviewedAt ?? new Date();
        data.nextReviewDue = input.reviewIntervalDays
          ? addDays(anchor, input.reviewIntervalDays) : null;
      }

      const updated = await ctx.db.enterpriseRisk.update({
        where: { id: input.id },
        data,
      });
      await recomputeEnterpriseRiskScore(ctx.db, updated.id);
      void createAuditLog({
        organizationId: orgId,
        userId: ctx.session!.user.id,
        action: "UPDATE_ENTERPRISE_RISK",
        entityType: "EnterpriseRisk",
        entityId: updated.id,
        changes: { before: existing, after: updated },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });
      return updated;
    }),

  recordReview: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .input(
      z.object({
        id: z.string(),
        notes: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const existing = await ctx.db.enterpriseRisk.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Enterprise risk not found" });
      }
      const now = new Date();
      const review = await ctx.db.enterpriseRiskReview.create({
        data: {
          enterpriseRiskId: input.id,
          reviewerId: ctx.session!.user.id,
          reviewedAt: now,
          notes: input.notes ?? null,
        },
      });
      await ctx.db.enterpriseRisk.update({
        where: { id: input.id },
        data: {
          lastReviewedAt: now,
          nextReviewDue: existing.reviewIntervalDays
            ? addDays(now, existing.reviewIntervalDays) : null,
        },
      });
      void createAuditLog({
        organizationId: orgId,
        userId: ctx.session!.user.id,
        action: "REVIEW_ENTERPRISE_RISK",
        entityType: "EnterpriseRisk",
        entityId: input.id,
        changes: { after: { reviewedAt: now, notes: input.notes ?? null } },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });
      return review;
    }),

  /** Set or clear the enterprise risk a child Risk is aligned to. */
  assignChildRisk: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        enterpriseRiskId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId: orgId },
        select: { id: true, enterpriseRiskId: true },
      });
      if (!risk) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }
      if (input.enterpriseRiskId) {
        const er = await ctx.db.enterpriseRisk.findFirst({
          where: { id: input.enterpriseRiskId, organizationId: orgId },
          select: { id: true },
        });
        if (!er) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Enterprise risk not found" });
        }
      }
      await ctx.db.risk.update({
        where: { id: input.riskId },
        data: { enterpriseRiskId: input.enterpriseRiskId },
      });
      // Recompute both old and new parent scores.
      const toRecompute = new Set<string>();
      if (risk.enterpriseRiskId) toRecompute.add(risk.enterpriseRiskId);
      if (input.enterpriseRiskId) toRecompute.add(input.enterpriseRiskId);
      for (const id of toRecompute) {
        await recomputeEnterpriseRiskScore(ctx.db, id);
      }
      return { success: true };
    }),

  /** Lightweight list for picker dropdowns (id + name only). */
  listForPicker: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.enterpriseRisk.findMany({
      where: { organizationId: ctx.organizationId! },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }),

  /** Set or clear the enterprise risk a Finding is tagged to. */
  assignChildFinding: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        enterpriseRiskId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId!;
      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId: orgId },
        select: { id: true },
      });
      if (!finding) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
      }
      if (input.enterpriseRiskId) {
        const er = await ctx.db.enterpriseRisk.findFirst({
          where: { id: input.enterpriseRiskId, organizationId: orgId },
          select: { id: true },
        });
        if (!er) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Enterprise risk not found" });
        }
      }
      await ctx.db.finding.update({
        where: { id: input.findingId },
        data: { enterpriseRiskId: input.enterpriseRiskId },
      });
      return { success: true };
    }),

  /** Risks for the tagging picker — id/title/severity + current ER alignment. */
  listRisksForPicker: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .query(async ({ ctx }) => {
      return ctx.db.risk.findMany({
        where: { organizationId: ctx.organizationId! },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          enterpriseRiskId: true,
        },
      });
    }),

  /** Findings for the tagging picker — id/title/severity + current ER alignment. */
  listFindingsForPicker: organizationProcedure
    .use(requireRole(ENTERPRISE_RISK_WRITE_ROLES))
    .query(async ({ ctx }) => {
      return ctx.db.finding.findMany({
        where: { organizationId: ctx.organizationId! },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          enterpriseRiskId: true,
        },
      });
    }),

  /**
   * Org-wide enterprise-risk heatmap: every ER positioned on the org's default
   * matrix grid. Manual ERs use their manual L/I; calculated ERs use the rounded
   * average of their child risks' residual (or inherent) L/I. ERs with neither
   * are returned unscored (likelihood/impact null) for a "not yet scored" list.
   */
  heatmap: organizationProcedure.query(async ({ ctx }) => {
    const orgId = ctx.organizationId!;
    const matrix = await resolveReferenceMatrix(ctx.db, orgId, null);

    const ers = await ctx.db.enterpriseRisk.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        useManualScore: true,
        manualLikelihood: true,
        manualImpact: true,
        _count: { select: { ChildRisks: true } },
      },
    });

    if (!matrix) {
      return {
        matrix: null,
        rows: ers.map((er) => ({
          id: er.id,
          name: er.name,
          likelihood: null as number | null,
          impact: null as number | null,
          score: null as number | null,
          scoreLabel: null as string | null,
          color: "#CCCCCC",
          childCount: er._count.ChildRisks,
        })),
      };
    }

    // Pull child-risk L/I for calculated ERs in one query, bucketed per parent.
    const childRows = await ctx.db.risk.findMany({
      where: { organizationId: orgId, enterpriseRiskId: { not: null } },
      select: {
        enterpriseRiskId: true,
        residualLikelihood: true,
        residualImpact: true,
        inherentLikelihood: true,
        inherentImpact: true,
      },
    });
    const childLI = new Map<string, Array<{ l: number; i: number }>>();
    for (const r of childRows) {
      if (!r.enterpriseRiskId) continue;
      const l = r.residualLikelihood ?? r.inherentLikelihood;
      const i = r.residualImpact ?? r.inherentImpact;
      if (l === null || i === null) continue;
      const arr = childLI.get(r.enterpriseRiskId) ?? [];
      arr.push({ l: Number(l), i: Number(i) });
      childLI.set(r.enterpriseRiskId, arr);
    }

    const rows = ers.map((er) => {
      let likelihood: number | null = null;
      let impact: number | null = null;
      if (er.useManualScore && er.manualLikelihood !== null && er.manualImpact !== null) {
        likelihood = nearestScaleValue(Number(er.manualLikelihood), matrix.scales.likelihood);
        impact = nearestScaleValue(Number(er.manualImpact), matrix.scales.impact);
      } else {
        const kids = childLI.get(er.id);
        if (kids && kids.length > 0) {
          const avgL = kids.reduce((s, k) => s + k.l, 0) / kids.length;
          const avgI = kids.reduce((s, k) => s + k.i, 0) / kids.length;
          likelihood = nearestScaleValue(avgL, matrix.scales.likelihood);
          impact = nearestScaleValue(avgI, matrix.scales.impact);
        }
      }
      let score: number | null = null;
      let scoreLabel: string | null = null;
      let color = "#CCCCCC";
      if (likelihood !== null && impact !== null) {
        score = score2D(likelihood, impact, matrix.scales, matrix.outputScaleMax);
        const band = thresholdForScore(score, matrix.thresholds);
        scoreLabel = band?.label ?? null;
        color = band?.color ?? "#CCCCCC";
      }
      return {
        id: er.id,
        name: er.name,
        likelihood,
        impact,
        score,
        scoreLabel,
        color,
        childCount: er._count.ChildRisks,
      };
    });

    return {
      matrix: {
        templateName: matrix.templateName,
        scales: matrix.scales,
        thresholds: matrix.thresholds,
        outputScaleMax: matrix.outputScaleMax,
      },
      rows,
    };
  }),
});
