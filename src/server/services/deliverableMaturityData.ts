/**
 * Story 17.4: Maturity Deliverable — server-side data service.
 *
 * Pure roll-up helpers + an org-scoped fetch that maps a `MaturityAssessment`
 * and its `MaturityDomainScore` rows into the presentational shape the
 * `MaturityBody` consumes. The orchestrator (17.1) wires the tRPC procedure and
 * passes the returned props into the shell; this module owns NO React.
 *
 * Determinism: `computeMaturityScorecard` is pure and snapshot-locked (AC18) so
 * the headline maturity figure a client sees can never silently drift from the
 * underlying scores.
 */

import type { PrismaClient } from "@prisma/client";

import type { ScorecardCellConfig } from "@/components/deliverable/types";

/** One domain row, flattened from a `MaturityDomainScore` + its `MaturityDomain`. */
export interface MaturityDomainRow {
  name: string;
  currentLevel: number | null;
  targetLevel: number | null;
  isNotApplicable: boolean;
}

/**
 * Map a maturity level (1–5) to a design-system CSS variable. Shared by the
 * bars + heatmap so the two never disagree (AC8/AC9). null / NA → muted.
 *
 *   1 = destructive · 2 = severity-high · 3 = warning · 4 = primary · 5 = success
 */
export function levelColor(level: number | null): string {
  if (level === null) return "var(--muted-foreground)";
  if (level >= 5) return "var(--success)";
  if (level >= 4) return "var(--primary)";
  if (level >= 3) return "var(--warning)";
  if (level >= 2) return "var(--severity-high)";
  if (level >= 1) return "var(--destructive)";
  return "var(--muted-foreground)";
}

/**
 * Build the 3-cell shell scorecard for a maturity assessment. PURE +
 * deterministic — prefers the stored overall values (AC17) and never
 * recomputes them. NA domains and rows missing both levels never count toward
 * "below target".
 *
 * Cells:
 *   1. Overall level — value = overallLevel ?? "—", suffix "/ 5",
 *      tone band: >= 4 ok · >= 3 med · else crit.
 *   2. Overall score — value = overallScore ?? "—", suffix "/ 100", tone "brand".
 *   3. Domains below target — count, tone "high".
 */
export function computeMaturityScorecard(a: {
  overallLevel: number | null;
  overallScore: number | null;
  targetLevel: number | null;
  domains: MaturityDomainRow[];
}): ScorecardCellConfig[] {
  const belowTarget = a.domains.filter(isBelowTarget).length;

  const levelTone: ScorecardCellConfig["tone"] =
    a.overallLevel === null
      ? "crit"
      : a.overallLevel >= 4
        ? "ok"
        : a.overallLevel >= 3
          ? "med"
          : "crit";

  return [
    {
      label: "Overall level",
      value: a.overallLevel ?? "—",
      suffix: "/ 5",
      tone: levelTone,
    },
    {
      label: "Overall score",
      value: a.overallScore ?? "—",
      suffix: "/ 100",
      tone: "brand",
    },
    {
      label: "Domains below target",
      value: belowTarget,
      tone: "high",
    },
  ];
}

/**
 * A domain is "below target" when both levels are known and current < target.
 * NA domains and rows missing either level are excluded.
 */
export function isBelowTarget(d: MaturityDomainRow): boolean {
  if (d.isNotApplicable) return false;
  if (d.currentLevel === null || d.targetLevel === null) return false;
  return d.currentLevel < d.targetLevel;
}

/**
 * Fetch the maturity deliverable data scoped to `organizationId`. Returns
 * `null` when the assessment does not exist or belongs to another org (AC20).
 */
export async function getMaturityDeliverableData(
  organizationId: string,
  db: PrismaClient,
  assessmentId: string,
): Promise<{
  scorecard: ScorecardCellConfig[];
  domains: MaturityDomainRow[];
  overallLevel: number | null;
  targetLevel: number | null;
  title: string;
  framework: string;
} | null> {
  const assessment = await db.maturityAssessment.findFirst({
    where: { id: assessmentId, organizationId },
    include: {
      framework: true,
      domainScores: { include: { domain: true } },
    },
  });

  if (!assessment) return null;

  // Deterministic order (AC4): domain sortOrder then name.
  const domains: MaturityDomainRow[] = [...assessment.domainScores]
    .sort((a, b) => {
      const so = (a.domain.sortOrder ?? 0) - (b.domain.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.domain.name.localeCompare(b.domain.name);
    })
    .map((s) => ({
      name: s.domain.name,
      currentLevel: s.currentLevel,
      targetLevel: s.targetLevel,
      isNotApplicable: s.isNotApplicable,
    }));

  const overallLevel = assessment.overallLevel;
  const overallScore =
    assessment.overallScore === null ? null : Number(assessment.overallScore);
  const targetLevel = assessment.targetLevel;

  const scorecard = computeMaturityScorecard({
    overallLevel,
    overallScore,
    targetLevel,
    domains,
  });

  return {
    scorecard,
    domains,
    overallLevel,
    targetLevel,
    title: assessment.name,
    framework: assessment.framework.name,
  };
}
