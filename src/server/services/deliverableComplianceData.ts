/**
 * Story 17.3: Compliance Deliverable — server-side data service.
 *
 * Pure roll-up + a Prisma fetch/map that is strictly org-scoped. The headline
 * compliance figure uses the STORED `complianceScore` (AC16) — never recomputed
 * — falling back to compliant/total only when the stored value is null. The gap
 * register is limited to PARTIALLY_COMPLIANT + NON_COMPLIANT controls (AC8) with
 * NON_COMPLIANT listed first (AC11).
 *
 * NOTE (AC21): NOT_APPLICABLE controls are intentionally NOT given any special
 * denominator treatment here — we surface the already-stored `complianceScore`
 * exactly as the compliance module computed it, so the deliverable can never
 * diverge from the rest of the app.
 */

import type { PrismaClient, ComplianceStatus } from "@prisma/client";
import type { ScorecardCellConfig } from "@/components/deliverable/types";

export interface ComplianceControlRow {
  controlId: string;
  title: string;
  status: ComplianceStatus;
  family: string;
}

export interface ComplianceGapRow {
  controlId: string;
  title: string;
  status: ComplianceStatus;
  gapDescription: string | null;
  remediationPlan: string | null;
}

/**
 * Group key for a control. The real `Control` model has no `family` field, so
 * we group by the controlId prefix before the first "-" (e.g. "AC-01" → "AC").
 * Controls with no dash fall back to the whole id.
 */
function familyOf(controlId: string): string {
  const dash = controlId.indexOf("-");
  return dash === -1 ? controlId : controlId.slice(0, dash);
}

/**
 * PURE: derive the 3-cell scorecard config. Deterministic for snapshot tests.
 *
 * - Compliance score: stored value, suffix "/ 100", tone banded
 *   (>= 80 ok · >= 50 med · else crit).
 * - Compliant: count, tone ok.
 * - Non-compliant: count, tone crit.
 */
export function computeComplianceScorecard(a: {
  complianceScore: number;
  compliantCount: number;
  partialCount: number;
  nonCompliantCount: number;
  totalControls: number;
}): ScorecardCellConfig[] {
  const score = a.complianceScore;
  const scoreTone: ScorecardCellConfig["tone"] =
    score >= 80 ? "ok" : score >= 50 ? "med" : "crit";

  return [
    { label: "Compliance score", value: score, suffix: "/ 100", tone: scoreTone },
    { label: "Compliant", value: a.compliantCount, tone: "ok" },
    { label: "Non-compliant", value: a.nonCompliantCount, tone: "crit" },
  ];
}

/** Sort weight so NON_COMPLIANT sorts before PARTIALLY_COMPLIANT in the gap register. */
function gapWeight(status: ComplianceStatus): number {
  return status === "NON_COMPLIANT" ? 0 : 1;
}

export async function getComplianceDeliverableData(
  organizationId: string,
  db: PrismaClient,
  assessmentId: string,
): Promise<{
  scorecard: ScorecardCellConfig[];
  controls: ComplianceControlRow[];
  gaps: ComplianceGapRow[];
  title: string;
  framework: string;
} | null> {
  const assessment = await db.complianceAssessment.findFirst({
    // Org isolation: id AND organizationId — another org's assessment never matches.
    where: { id: assessmentId, organizationId },
    include: {
      framework: true,
      controlScores: { include: { control: true } },
    },
  });

  if (!assessment) return null;

  // Headline uses the STORED complianceScore (AC16); fall back to compliant/total
  // only when null, else 0 — never NaN.
  const storedScore =
    assessment.complianceScore != null ? Number(assessment.complianceScore) : null;
  const complianceScore =
    storedScore != null
      ? storedScore
      : assessment.totalControls > 0
        ? (assessment.compliantCount / assessment.totalControls) * 100
        : 0;

  const controls: ComplianceControlRow[] = assessment.controlScores.map((s) => ({
    controlId: s.control.controlId,
    title: s.control.title,
    status: s.status,
    family: familyOf(s.control.controlId),
  }));

  const gaps: ComplianceGapRow[] = assessment.controlScores
    .filter((s) => s.status === "PARTIALLY_COMPLIANT" || s.status === "NON_COMPLIANT")
    .map((s) => ({
      controlId: s.control.controlId,
      title: s.control.title,
      status: s.status,
      gapDescription: s.gapDescription ?? null,
      remediationPlan: s.remediationPlan ?? null,
    }))
    .sort(
      (a, b) =>
        gapWeight(a.status) - gapWeight(b.status) ||
        a.controlId.localeCompare(b.controlId, undefined, { numeric: true }),
    );

  const scorecard = computeComplianceScorecard({
    complianceScore,
    compliantCount: assessment.compliantCount,
    partialCount: assessment.partialCount,
    nonCompliantCount: assessment.nonCompliantCount,
    totalControls: assessment.totalControls,
  });

  return {
    scorecard,
    controls,
    gaps,
    title: assessment.name,
    framework: assessment.framework.name,
  };
}
