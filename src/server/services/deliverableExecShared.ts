/**
 * Shared executive-summary deliverable helpers (server-side).
 *
 * Cross-cutting shaping reused by every assessment kind's exec summary: the
 * matrix descriptor, finding-row shaping (severity resolved against a matrix),
 * the matrix-aware scorecard, and per-kind fetching of the assessment's findings
 * + statement/layout meta. Risk uses the project's own matrix; the other kinds
 * fall back to the org's default published matrix.
 */

import type { PrismaClient } from "@prisma/client";
import type { FindingLike, ScorecardCellConfig } from "@/components/deliverable/types";
import {
  score2D,
  thresholdForScore,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";
import type { AssessmentKind } from "@/components/engagement/types";

/** Muted grey for unscored / no-matrix severity. */
export const NEUTRAL = "#9CA3AF";

export interface ExecMatrix {
  name: string;
  dimensionCount: number;
  outputScaleMax: number;
  scales: MatrixScales;
  thresholds: Threshold[];
}

/** A finding row with severity resolved against a matrix's threshold bands. */
export interface ExecFinding extends FindingLike {
  identifier: string;
  likelihood: number; // matrix level value (0 when unscored)
  impact: number;
  scored: boolean;
  score: number | null;
  severityLabel: string;
  severityColor: string;
  domain: string | null;
  asset: string | null;
  organizations: string[];
  displayNumber: number;
}

/** ENUM_VALUE → "Enum value". */
export function titleCaseEnum(v: string | null | undefined): string {
  if (!v) return "Unscored";
  const s = v.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Resolve an L×I pair to its matrix band (2D projection); neutral if unscored. */
export function resolveSeverity(
  matrix: ExecMatrix | null,
  likelihood: number,
  impact: number,
  fallbackLabel: string,
): { scored: boolean; score: number | null; label: string; color: string } {
  if (matrix && likelihood > 0 && impact > 0) {
    const score = score2D(likelihood, impact, matrix.scales, matrix.outputScaleMax);
    const t = thresholdForScore(score, matrix.thresholds);
    return { scored: true, score, label: t?.label ?? fallbackLabel, color: t?.color ?? NEUTRAL };
  }
  return { scored: false, score: null, label: fallbackLabel, color: NEUTRAL };
}

/** The finding fields {@link shapeFindingRows} consumes. */
export interface RawFinding {
  id: string;
  identifier: string;
  title: string;
  inherentLikelihood: unknown;
  inherentImpact: unknown;
  severity: string;
  severityLabel: string | null;
  source: string | null;
  description: string | null;
  affectedAssets: string[];
  affectedBusinessUnits?: { name: string }[];
}

/** Map finding records → ExecFinding[], ranked by score desc (unscored last). */
export function shapeFindingRows(findings: RawFinding[], matrix: ExecMatrix | null): ExecFinding[] {
  const rows: ExecFinding[] = findings.map((f) => {
    const likelihood = f.inherentLikelihood != null ? Math.round(Number(f.inherentLikelihood)) : 0;
    const impact = f.inherentImpact != null ? Math.round(Number(f.inherentImpact)) : 0;
    const sev = resolveSeverity(matrix, likelihood, impact, f.severityLabel ?? titleCaseEnum(f.severity));
    return {
      id: f.id,
      identifier: f.identifier,
      title: f.title,
      likelihood,
      impact,
      scored: sev.scored,
      score: sev.score,
      severityLabel: sev.label,
      severityColor: sev.color,
      domain: f.source ?? null,
      organizations: (f.affectedBusinessUnits ?? []).map((bu) => bu.name),
      asset: f.affectedAssets[0] ?? null,
      displayNumber: 0,
      remediationEffort: null,
      rationale: f.description ?? null,
      recommendedAction: null,
      evidence: null,
    } satisfies ExecFinding;
  });
  rows.sort((a, b) => {
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sb !== sa) return sb - sa;
    return a.identifier.localeCompare(b.identifier);
  });
  rows.forEach((row, i) => {
    row.displayNumber = i + 1;
  });
  return rows;
}

/**
 * Matrix-aware 3-cell scorecard: exposure = avg normalized score / outputScaleMax;
 * third cell counts findings in the matrix's top (worst) band. Without a matrix,
 * a neutral findings count so the shell still renders three cells.
 */
export function buildExecScorecard(rows: ExecFinding[], matrix: ExecMatrix | null): ScorecardCellConfig[] {
  if (!matrix) {
    return [
      { label: "Findings", value: rows.length, tone: "brand" },
      { label: "Scored findings", value: rows.filter((r) => r.scored).length, tone: "ok" },
      { label: "Unscored", value: rows.filter((r) => !r.scored).length, tone: "high" },
    ];
  }
  const scored = rows.filter((r) => r.score != null);
  const avg = scored.length ? scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length : 0;
  const exposure = Math.round((avg / matrix.outputScaleMax) * 100);
  const topBand = [...matrix.thresholds].sort((a, b) => b.minValue - a.minValue)[0];
  const topCount = topBand
    ? scored.filter((r) => thresholdForScore(r.score ?? 0, matrix.thresholds)?.label === topBand.label).length
    : 0;
  return [
    { label: "Security posture", value: 100 - exposure, suffix: "/ 100", tone: "ok" },
    { label: "Risk exposure", value: exposure, suffix: "/ 100", tone: "high" },
    { label: `${topBand?.label ?? "Critical"} findings`, value: topCount, tone: "crit" },
  ];
}

/** The org's default published matrix (used by the non-Risk kinds). */
export async function resolveOrgDefaultMatrix(
  organizationId: string,
  db: PrismaClient,
): Promise<ExecMatrix | null> {
  const tmpl = await db.riskMatrixTemplate.findFirst({
    where: { organizationId, isDefault: true, currentVersionId: { not: null } },
    include: { currentVersion: true },
  });
  if (!tmpl?.currentVersion) return null;
  return {
    name: tmpl.name,
    dimensionCount: tmpl.dimensionCount,
    outputScaleMax: Number(tmpl.outputScaleMax),
    scales: tmpl.currentVersion.scales as unknown as MatrixScales,
    thresholds: tmpl.currentVersion.thresholds as unknown as Threshold[],
  };
}

const FINDING_SELECT = {
  id: true,
  identifier: true,
  title: true,
  severity: true,
  severityLabel: true,
  source: true,
  description: true,
  inherentLikelihood: true,
  inherentImpact: true,
  affectedAssets: true,
  affectedBusinessUnits: { select: { name: true } },
} as const;

/** Findings discovered in an assessment, by the kind's source linkage. */
export async function fetchKindFindings(
  organizationId: string,
  db: PrismaClient,
  kind: AssessmentKind,
  assessmentId: string,
): Promise<RawFinding[]> {
  let where: Record<string, unknown> | null = null;
  switch (kind) {
    case "COMPLIANCE":
      where = { organizationId, sourceComplianceAssessmentId: assessmentId };
      break;
    case "MATURITY":
      where = { organizationId, sourceMaturityAssessmentId: assessmentId };
      break;
    case "VENDOR":
      where = { organizationId, vendorAssessmentId: assessmentId };
      break;
    case "RISK":
      where = { organizationId, discoveryProjectId: assessmentId };
      break;
    case "BIA":
    default:
      return []; // no Finding↔BIA linkage
  }
  return (await db.finding.findMany({ where, select: FINDING_SELECT })) as unknown as RawFinding[];
}

/** The exec statement + raw layout JSON stored on the kind's assessment model. */
export async function fetchExecMeta(
  organizationId: string,
  db: PrismaClient,
  kind: AssessmentKind,
  id: string,
): Promise<{ executiveStatement: string | null; execSummaryLayout: unknown }> {
  const where = { id, organizationId };
  const select = { executiveStatement: true, execSummaryLayout: true };
  let row: { executiveStatement: string | null; execSummaryLayout: unknown } | null = null;
  switch (kind) {
    case "COMPLIANCE":
      row = await db.complianceAssessment.findFirst({ where, select });
      break;
    case "MATURITY":
      row = await db.maturityAssessment.findFirst({ where, select });
      break;
    case "VENDOR":
      row = await db.vendorAssessment.findFirst({ where, select });
      break;
    case "BIA":
      row = await db.businessProcess.findFirst({ where, select });
      break;
    case "RISK":
      row = await db.riskAssessmentProject.findFirst({ where, select });
      break;
  }
  return {
    executiveStatement: row?.executiveStatement ?? null,
    execSummaryLayout: row?.execSummaryLayout ?? null,
  };
}

/**
 * Cross-cutting exec data for the NON-Risk kinds: the org default matrix, the
 * assessment's findings shaped against it, and the statement/layout meta.
 * (Risk uses its project matrix via deliverableRiskExecData.)
 */
export async function getExecCrossCutting(
  organizationId: string,
  db: PrismaClient,
  kind: AssessmentKind,
  assessmentId: string,
): Promise<{
  matrix: ExecMatrix | null;
  rows: ExecFinding[];
  executiveStatement: string | null;
  execSummaryLayoutRaw: unknown;
}> {
  const [matrix, findings, meta] = await Promise.all([
    resolveOrgDefaultMatrix(organizationId, db),
    fetchKindFindings(organizationId, db, kind, assessmentId),
    fetchExecMeta(organizationId, db, kind, assessmentId),
  ]);
  return {
    matrix,
    rows: shapeFindingRows(findings, matrix),
    executiveStatement: meta.executiveStatement,
    execSummaryLayoutRaw: meta.execSummaryLayout,
  };
}
