/**
 * BIA (Business Impact Analysis) Deliverable — server-side data service.
 *
 * Mirrors `deliverableComplianceData` / `deliverableMaturityData`: a strictly
 * org-scoped Prisma fetch that maps a `BusinessProcess` (+ its effective tier,
 * impact scores, dependencies and linked risks) into the presentational shape
 * the `BIABody` consumes. The router wires the cover + tRPC procedure; this
 * module owns NO React.
 *
 * The effective criticality tier is the manual `overrideTier` when present,
 * else the `calculatedTier` (STORED — never recomputed here) so RTO/RPO match
 * the rest of the BIA module exactly.
 *
 * `import type { PrismaClient }` (NOT a value import) keeps Prisma out of the
 * browser bundle.
 */

import type { PrismaClient, BIAAssessmentStatus } from "@prisma/client";
import type { FindingLike, ScorecardCellConfig } from "@/components/deliverable/types";

/** One impact-category score row, flattened from a `BIAImpactScore` + category. */
export interface BiaImpactRow {
  category: string;
  score: number;
  description: string | null;
}

/** One dependency row (upstream process this process depends on). */
export interface BiaDependencyRow {
  id: string;
  identifier: string;
  name: string;
  tier: string | null;
  notes: string | null;
}

/** One linked-risk row. Widens {@link FindingLike} so it opens the shared drawer. */
export interface BiaRiskRow extends FindingLike {
  identifier: string;
  severityLabel: string | null;
  status: string;
}

const ASSESSMENT_STATUS_LABEL: Record<BIAAssessmentStatus, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  COMPLETED: "Completed",
};

export function biaStatusLabel(s: BIAAssessmentStatus): string {
  return ASSESSMENT_STATUS_LABEL[s];
}

/**
 * PURE scorecard roll-up. Returns EXACTLY four cells in a fixed order so a
 * seeded fixture can be snapshotted deterministically:
 *   1. Criticality — tier name (or "—"), tone banded by tierLevel
 *      (0 crit · 1 high · 2 med · else ok; null → "—" med).
 *   2. RTO         — recovery time objective text, tone "brand".
 *   3. RPO         — recovery point objective text, tone "brand".
 *   4. Dependencies— count of upstream dependencies, tone "high".
 */
export function computeBiaScorecard(a: {
  tierName: string | null;
  tierLevel: number | null;
  rto: string | null;
  rpo: string | null;
  dependencyCount: number;
}): ScorecardCellConfig[] {
  const tierTone: ScorecardCellConfig["tone"] =
    a.tierLevel === null
      ? "med"
      : a.tierLevel <= 0
        ? "crit"
        : a.tierLevel === 1
          ? "high"
          : a.tierLevel === 2
            ? "med"
            : "ok";

  return [
    { label: "Criticality", value: a.tierName ?? "—", tone: tierTone },
    { label: "RTO", value: a.rto ?? "—", tone: "brand" },
    { label: "RPO", value: a.rpo ?? "—", tone: "brand" },
    { label: "Dependencies", value: a.dependencyCount, tone: "high" },
  ];
}

/**
 * Fetch the BIA deliverable data scoped to `organizationId`. Returns `null`
 * when the process does not exist or belongs to another org.
 */
export async function getBiaDeliverableData(
  organizationId: string,
  db: PrismaClient,
  processId: string,
): Promise<{
  scorecard: ScorecardCellConfig[];
  impacts: BiaImpactRow[];
  dependencies: BiaDependencyRow[];
  risks: BiaRiskRow[];
  title: string;
  identifier: string;
  businessFunction: string | null;
  assessmentStatus: BIAAssessmentStatus;
  assessmentStatusLabel: string;
  tierName: string | null;
  rto: string | null;
  rpo: string | null;
  workaroundProcedure: string | null;
} | null> {
  const process = await db.businessProcess.findFirst({
    // Org isolation: id AND organizationId — another org's process never matches.
    where: { id: processId, organizationId },
    include: {
      businessFunction: true,
      calculatedTier: true,
      overrideTier: true,
      impactScores: { include: { category: true } },
      upstreamDependencies: {
        include: {
          upstreamProcess: {
            include: { calculatedTier: true, overrideTier: true },
          },
        },
      },
      riskLinks: { include: { risk: true } },
    },
  });

  if (!process) return null;

  // Effective tier: manual override wins over the calculated tier.
  const tier = process.overrideTier ?? process.calculatedTier;

  const impacts: BiaImpactRow[] = [...process.impactScores]
    .sort((a, b) => {
      const so = (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.category.name.localeCompare(b.category.name);
    })
    .map((s) => ({
      category: s.category.name,
      score: s.score,
      description: s.description ?? null,
    }));

  const dependencies: BiaDependencyRow[] = [...process.upstreamDependencies]
    .map((d) => {
      const up = d.upstreamProcess;
      const upTier = up.overrideTier ?? up.calculatedTier;
      return {
        id: up.id,
        identifier: up.identifier,
        name: up.name,
        tier: upTier?.name ?? null,
        notes: d.notes ?? null,
      };
    })
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));

  const risks: BiaRiskRow[] = [...process.riskLinks]
    .map((link) => {
      const r = link.risk;
      const likelihood = r.inherentLikelihood == null ? 0 : Math.round(Number(r.inherentLikelihood));
      const impact = r.inherentImpact == null ? 0 : Math.round(Number(r.inherentImpact));
      return {
        id: r.id,
        identifier: r.identifier ?? r.id,
        title: r.title,
        likelihood,
        impact,
        severityLabel: r.inherentScoreLabel ?? null,
        status: r.status,
        // FindingLike extras the shared drawer reads:
        domain: null,
        remediationEffort: null,
        rationale: r.description ?? null,
        recommendedAction: null,
        evidence: null,
      };
    })
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));

  const scorecard = computeBiaScorecard({
    tierName: tier?.name ?? null,
    tierLevel: tier?.tierLevel ?? null,
    rto: tier?.rtoText ?? null,
    rpo: tier?.rpoText ?? null,
    dependencyCount: dependencies.length,
  });

  return {
    scorecard,
    impacts,
    dependencies,
    risks,
    title: process.name,
    identifier: process.identifier,
    businessFunction: process.businessFunction?.name ?? null,
    assessmentStatus: process.assessmentStatus,
    assessmentStatusLabel: biaStatusLabel(process.assessmentStatus),
    tierName: tier?.name ?? null,
    rto: tier?.rtoText ?? null,
    rpo: tier?.rpoText ?? null,
    workaroundProcedure: process.workaroundProcedure ?? null,
  };
}
