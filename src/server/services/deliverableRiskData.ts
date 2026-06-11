/**
 * Story 17.2: Risk / Findings Deliverable — server data service.
 *
 * Reads `RiskAssessment` + `Finding` ONLY (AC22). Maps each scored risk
 * assessment to a `RiskRow` widening the shared `FindingLike` contract, and
 * computes the 3-cell scorecard roll-up via the PURE, testable
 * {@link computeRiskScorecard} (AC17, AC18, AC24).
 *
 * L×I scoring is taken from the persisted matrix-anchored values on
 * `RiskAssessment` (likelihoodValue / impactValue), NOT re-derived (AC6).
 */

import type { PrismaClient } from "@prisma/client";
import type {
  DeliverableSeverity,
  FindingLike,
  ScorecardCellConfig,
} from "@/components/deliverable/types";
import { sevOf } from "@/components/deliverable/tone";

/**
 * A findings-register row. Widens {@link FindingLike} (so it can open the shared
 * Finding Drawer directly) with the register/heatmap presentation fields.
 */
export interface RiskRow extends FindingLike {
  identifier: string;
  title: string;
  likelihood: number;
  impact: number;
  severityTier: DeliverableSeverity;
  domain: string | null;
  organizations: string[];
  effort: string | null;
  asset: string | null;
  /** 1-based rank used as the heatmap dot label; assigned by descending score. */
  displayNumber: number;
}

const MAX_SCORE = 25; // 5 × 5

/**
 * PURE scorecard roll-up (AC17, AC18, AC24). Returns EXACTLY three cells in a
 * fixed order so a seeded fixture can be snapshotted deterministically:
 *   1. Security posture (tone "ok")   = 100 − exposure
 *   2. Risk exposure    (tone "high") = round(avg(score) / 25 × 100)
 *   3. Critical findings(tone "crit") = count(score ≥ 20)
 */
export function computeRiskScorecard(rows: RiskRow[]): ScorecardCellConfig[] {
  const scores = rows.map((r) => r.likelihood * r.impact);
  const total = scores.reduce((s, v) => s + v, 0);
  // Guard the empty set so an org with no scored risks reads as zero exposure.
  const exposure =
    rows.length === 0 ? 0 : Math.round((total / (rows.length * MAX_SCORE)) * 100);
  const posture = 100 - exposure;
  const critical = scores.filter((s) => s >= 20).length;

  return [
    { label: "Security posture", value: posture, suffix: "/ 100", tone: "ok" },
    { label: "Risk exposure", value: exposure, suffix: "/ 100", tone: "high" },
    { label: "Critical findings", value: critical, tone: "crit" },
  ];
}

/**
 * Stable descending-by-exposure comparator with deterministic identifier
 * tie-break (AC9). Higher score first; on ties the lexically-smaller identifier
 * sorts first.
 */
function byExposureDesc(a: RiskRow, b: RiskRow): number {
  const sa = a.likelihood * a.impact;
  const sb = b.likelihood * b.impact;
  if (sb !== sa) return sb - sa;
  return a.identifier.localeCompare(b.identifier);
}

/**
 * Org-scoped data fetch + map for the risk body. Only risk assessments whose
 * finding carries BOTH a likelihood and impact value are included (the rest
 * cannot be placed on the heatmap). `displayNumber` is assigned in descending
 * score order so the dot labels match the register rank.
 */
export async function getRiskDeliverableData(
  organizationId: string,
  db: PrismaClient,
): Promise<{ scorecard: ScorecardCellConfig[]; rows: RiskRow[] }> {
  const assessments = await db.riskAssessment.findMany({
    where: { organizationId },
    include: { finding: { include: { affectedBusinessUnits: true } } },
  });

  const rows: RiskRow[] = [];
  for (const ra of assessments) {
    if (ra.likelihoodValue == null || ra.impactValue == null) continue;
    const finding = ra.finding;
    if (!finding) continue;

    const likelihood = Math.round(Number(ra.likelihoodValue));
    const impact = Math.round(Number(ra.impactValue));
    const score = likelihood * impact;
    const organizations = finding.affectedBusinessUnits.map((bu) => bu.name);
    const asset = finding.affectedAssets[0] ?? null;
    // No effort/domain columns exist on Finding (see story handoff note). Domain
    // falls back to the finding source as a stand-in label; effort is unknown.
    const domain = finding.source ?? null;

    rows.push({
      id: finding.id,
      identifier: finding.identifier,
      title: finding.title,
      likelihood,
      impact,
      severityTier: sevOf(score),
      domain,
      organizations,
      effort: null,
      asset,
      displayNumber: 0, // assigned below by rank
      // FindingLike extras the shared drawer reads:
      remediationEffort: null,
      rationale: finding.description ?? null,
      recommendedAction: null,
      evidence: null,
    });
  }

  rows.sort(byExposureDesc);
  rows.forEach((row, i) => {
    row.displayNumber = i + 1;
  });

  return { scorecard: computeRiskScorecard(rows), rows };
}
