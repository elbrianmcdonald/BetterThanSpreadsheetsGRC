/**
 * Risk Executive Summary deliverable — server data service.
 *
 * Scoped to ONE `RiskAssessmentProject`. Severity + the heatmap are driven by the
 * assessment's configured matrix (or the org default as a fallback). Cross-cutting
 * shaping (matrix, finding rows, scorecard) is shared via deliverableExecShared.
 */

import type { PrismaClient, AssessmentProjectStatus } from "@prisma/client";
import type { ScorecardCellConfig } from "@/components/deliverable/types";
import { score2D, thresholdForScore, type MatrixScales, type Threshold } from "@/lib/matrix";
import {
  NEUTRAL,
  titleCaseEnum,
  shapeFindingRows,
  buildExecScorecard,
  resolveOrgDefaultMatrix,
  type ExecMatrix,
  type ExecFinding,
  type RawFinding,
} from "@/server/services/deliverableExecShared";
import {
  normalizeLayout,
  type ExecSectionConfig,
} from "@/components/deliverable/execSummaryLayout";

// Re-exported so existing consumers (RiskExecutiveBody) keep their import paths.
export type { ExecMatrix, ExecFinding } from "@/server/services/deliverableExecShared";

/** A compact risk row, severity resolved against the assessment's matrix. */
export interface ExecRiskRow {
  id: string;
  identifier: string | null;
  title: string;
  likelihood: number | null;
  impact: number | null;
  score: number | null;
  severityLabel: string;
  severityColor: string;
  status: string;
  treatment: string | null;
}

export interface RiskExecutiveData {
  title: string;
  executiveStatement: string | null;
  status: AssessmentProjectStatus;
  assigneeId: string | null;
  matrix: ExecMatrix | null;
  layout: ExecSectionConfig[];
  scorecard: ScorecardCellConfig[];
  rows: ExecFinding[];
  risks: ExecRiskRow[];
}

export async function getRiskExecutiveData(
  organizationId: string,
  db: PrismaClient,
  projectId: string,
): Promise<RiskExecutiveData | null> {
  const project = await db.riskAssessmentProject.findFirst({
    where: { id: projectId, organizationId },
    include: {
      matrixVersion: { include: { template: true } },
      discoveredFindings: {
        include: { affectedBusinessUnits: { select: { name: true } } },
      },
      discoveredRisks: {
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          inherentScoreLabel: true,
          inherentLikelihood: true,
          inherentImpact: true,
          inherentScore: true,
          status: true,
          Treatments: {
            select: { treatmentType: true },
            take: 1,
            orderBy: { decidedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  // The project's locked matrix version, else the org default.
  let matrix: ExecMatrix | null = null;
  const pv = project.matrixVersion;
  if (pv) {
    matrix = {
      name: pv.template.name,
      dimensionCount: pv.template.dimensionCount,
      outputScaleMax: Number(pv.template.outputScaleMax),
      scales: pv.scales as unknown as MatrixScales,
      thresholds: pv.thresholds as unknown as Threshold[],
    };
  } else {
    matrix = await resolveOrgDefaultMatrix(organizationId, db);
  }

  const rows = shapeFindingRows(project.discoveredFindings as unknown as RawFinding[], matrix);

  const risks: ExecRiskRow[] = project.discoveredRisks.map((r) => {
    const likelihood = r.inherentLikelihood != null ? Number(r.inherentLikelihood) : null;
    const impact = r.inherentImpact != null ? Number(r.inherentImpact) : null;
    let score: number | null = r.inherentScore != null ? Number(r.inherentScore) : null;
    if (score == null && matrix && likelihood && impact) {
      score = score2D(likelihood, impact, matrix.scales, matrix.outputScaleMax);
    }
    const band = score != null && matrix ? thresholdForScore(score, matrix.thresholds) : undefined;
    return {
      id: r.id,
      identifier: r.identifier,
      title: r.title,
      likelihood,
      impact,
      score,
      severityLabel: r.inherentScoreLabel ?? band?.label ?? titleCaseEnum(r.severity),
      severityColor: band?.color ?? NEUTRAL,
      status: r.status,
      treatment: r.Treatments[0]?.treatmentType ?? null,
    };
  });

  return {
    title: project.subject,
    executiveStatement: project.executiveStatement,
    status: project.status,
    assigneeId: project.assigneeId,
    matrix,
    layout: normalizeLayout("RISK", project.execSummaryLayout),
    scorecard: buildExecScorecard(rows, matrix),
    rows,
    risks,
  };
}
