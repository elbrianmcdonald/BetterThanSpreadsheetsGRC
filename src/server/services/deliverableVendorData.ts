/**
 * Vendor Assessment Deliverable — server-side data service.
 *
 * Mirrors `deliverableComplianceData` / `deliverableMaturityData`: a strictly
 * org-scoped Prisma fetch that maps a `VendorAssessment` (+ its vendor,
 * questionnaires, and spawned findings) into the presentational shape the
 * `VendorBody` consumes. The router wires the cover + tRPC procedure; this
 * module owns NO React.
 *
 * Headline figures use STORED values — `riskScore` (0–100) and each
 * questionnaire's `overallScore` — never recomputed, so the deliverable can
 * never diverge from the rest of the app.
 *
 * `import type { PrismaClient }` (NOT a value import) keeps Prisma out of the
 * browser bundle.
 */

import type {
  PrismaClient,
  VendorAssessmentStatus,
  VendorAssessmentRecommendation,
  VendorRiskTier,
} from "@prisma/client";
import type { FindingLike, ScorecardCellConfig } from "@/components/deliverable/types";

/** One spawned-finding row. Widens {@link FindingLike} so it opens the shared drawer. */
export interface VendorFindingRow extends FindingLike {
  identifier: string;
  severityLabel: string | null;
  status: string;
}

/** One questionnaire-completion row. */
export interface VendorQuestionnaireRow {
  id: string;
  name: string;
  status: string;
  /** Stored `overallScore` (% acceptable) — null until scored. */
  overallScore: number | null;
  completedAt: string | null;
}

const RECOMMENDATION_LABEL: Record<VendorAssessmentRecommendation, string> = {
  APPROVE: "Approve",
  CONDITIONAL_APPROVE: "Conditional approve",
  REJECT: "Reject",
};

const STATUS_LABEL: Record<VendorAssessmentStatus, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
};

const RISK_TIER_LABEL: Record<VendorRiskTier, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function recommendationLabel(
  r: VendorAssessmentRecommendation | null,
): string {
  return r === null ? "Pending" : RECOMMENDATION_LABEL[r];
}

export function vendorStatusLabel(s: VendorAssessmentStatus): string {
  return STATUS_LABEL[s];
}

export function riskTierLabel(t: VendorRiskTier | null): string {
  return t === null ? "Untiered" : RISK_TIER_LABEL[t];
}

/**
 * PURE scorecard roll-up. Returns EXACTLY three cells in a fixed order so a
 * seeded fixture can be snapshotted deterministically:
 *   1. Risk score      — stored 0–100, suffix "/ 100", tone banded
 *      (<= 33 ok · <= 66 med · else crit; null → "—" crit).
 *   2. Findings        — count of spawned findings, tone "high".
 *   3. Questionnaires  — completed / total, tone "brand".
 */
export function computeVendorScorecard(a: {
  riskScore: number | null;
  findingCount: number;
  questionnairesTotal: number;
  questionnairesComplete: number;
}): ScorecardCellConfig[] {
  const scoreTone: ScorecardCellConfig["tone"] =
    a.riskScore === null
      ? "crit"
      : a.riskScore <= 33
        ? "ok"
        : a.riskScore <= 66
          ? "med"
          : "crit";

  return [
    {
      label: "Risk score",
      value: a.riskScore ?? "—",
      suffix: "/ 100",
      tone: scoreTone,
    },
    { label: "Findings", value: a.findingCount, tone: "high" },
    {
      label: "Questionnaires",
      value: a.questionnairesComplete,
      suffix: `/ ${a.questionnairesTotal}`,
      tone: "brand",
    },
  ];
}

/**
 * Fetch the vendor deliverable data scoped to `organizationId`. Returns `null`
 * when the assessment does not exist or belongs to another org.
 */
export async function getVendorDeliverableData(
  organizationId: string,
  db: PrismaClient,
  assessmentId: string,
): Promise<{
  scorecard: ScorecardCellConfig[];
  findings: VendorFindingRow[];
  questionnaires: VendorQuestionnaireRow[];
  title: string;
  vendorName: string;
  identifier: string;
  status: VendorAssessmentStatus;
  statusLabel: string;
  recommendation: string;
  riskScore: number | null;
  riskTier: string;
  summary: string | null;
} | null> {
  const assessment = await db.vendorAssessment.findFirst({
    // Org isolation: id AND organizationId — another org's assessment never matches.
    where: { id: assessmentId, organizationId },
    include: {
      vendor: true,
      questionnaires: { include: { template: true } },
      findings: true,
    },
  });

  if (!assessment) return null;

  const findings: VendorFindingRow[] = [...assessment.findings]
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
    .map((f) => {
      const likelihood = f.inherentLikelihood == null ? 0 : Math.round(Number(f.inherentLikelihood));
      const impact = f.inherentImpact == null ? 0 : Math.round(Number(f.inherentImpact));
      return {
        id: f.id,
        identifier: f.identifier,
        title: f.title,
        likelihood,
        impact,
        severityLabel: f.severityLabel ?? null,
        status: f.status,
        // FindingLike extras the shared drawer reads:
        domain: f.source ?? null,
        remediationEffort: null,
        rationale: f.description ?? null,
        recommendedAction: null,
        evidence: null,
      };
    });

  const questionnaires: VendorQuestionnaireRow[] = [...assessment.questionnaires]
    .sort((a, b) => a.template.name.localeCompare(b.template.name))
    .map((q) => ({
      id: q.id,
      name: q.template.name,
      status: q.status,
      overallScore: q.overallScore == null ? null : Number(q.overallScore),
      completedAt: q.completedAt ? q.completedAt.toISOString() : null,
    }));

  const questionnairesComplete = questionnaires.filter(
    (q) => q.status === "COMPLETED",
  ).length;

  const riskScore = assessment.riskScore ?? null;

  const scorecard = computeVendorScorecard({
    riskScore,
    findingCount: findings.length,
    questionnairesTotal: questionnaires.length,
    questionnairesComplete,
  });

  return {
    scorecard,
    findings,
    questionnaires,
    title: assessment.title,
    vendorName: assessment.vendor.name,
    identifier: assessment.identifier,
    status: assessment.status,
    statusLabel: vendorStatusLabel(assessment.status),
    recommendation: recommendationLabel(assessment.recommendation),
    riskScore,
    riskTier: riskTierLabel(assessment.vendor.riskTier),
    summary: assessment.summary ?? null,
  };
}
