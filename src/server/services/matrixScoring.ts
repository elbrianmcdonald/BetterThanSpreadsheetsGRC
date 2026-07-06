/**
 * Matrix-based L×I(×E) scoring shared by finding creation/rescore and risk
 * manual-override scoring (Story 22.2 extraction of the Story 20.1 helper —
 * no behavior change).
 *
 * When likelihood + impact are supplied, loads the referenced matrix version
 * (or the org default) and computes the authoritative inherent score +
 * threshold label, deriving the coarse severity from that label — so a
 * client can't spoof a score. Returns all-null scoring fields (passing the
 * client-sent matrixVersionId through) when no scores were supplied or no
 * matrix is configured.
 */

import { Severity } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { calculateInherentScore, isScoreResult } from "@/lib/matrix/scoring";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import { db } from "@/server/db";

/** The extended Prisma client as exposed on tRPC context (ctx.db). */
type DbClient = typeof db;

/**
 * Coarse Severity enum from a matrix threshold label. Critical/High → HIGH,
 * Low → LOW, else MEDIUM.
 */
export function severityFromLabel(label: string | null): Severity {
  if (!label) return Severity.MEDIUM;
  const upper = label.toUpperCase();
  if (upper === "CRITICAL" || upper === "HIGH") return Severity.HIGH;
  if (upper === "LOW") return Severity.LOW;
  return Severity.MEDIUM;
}

export interface MatrixScoringResult {
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentExposure: number | null;
  inherentScore: number | null;
  severity: Severity | null;
  severityLabel: string | null;
  matrixVersionId: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualExposure: number | null;
  residualScore: number | null;
  residualScoreLabel: string | null;
}

export async function computeMatrixScoring(
  dbClient: DbClient,
  organizationId: string,
  input: {
    likelihood?: number;
    impact?: number;
    exposure?: number;
    matrixVersionId?: string;
    residualLikelihood?: number | null;
    residualImpact?: number | null;
    residualExposure?: number | null;
    residualEliminated?: boolean;
  }
): Promise<MatrixScoringResult> {
  const scoring: MatrixScoringResult = {
    inherentLikelihood: null,
    inherentImpact: null,
    inherentExposure: null,
    inherentScore: null,
    severity: null,
    severityLabel: null,
    matrixVersionId: input.matrixVersionId ?? null,
    residualLikelihood: null,
    residualImpact: null,
    residualExposure: null,
    residualScore: null,
    // "Eliminated" short-circuits the numeric path (mirrors risk.createAssessment).
    residualScoreLabel: input.residualEliminated ? "ELIMINATED" : null,
  };

  const { likelihood, impact, exposure } = input;
  const wantsInherent = likelihood !== undefined && impact !== undefined;
  const wantsResidual =
    !input.residualEliminated &&
    input.residualLikelihood != null &&
    input.residualImpact != null;
  if (!wantsInherent && !wantsResidual) return scoring;

  // Load the matrix version: explicit one from the client, else the org
  // default template's current published version.
  let matrixVersion = input.matrixVersionId
    ? await dbClient.riskMatrixVersion.findUnique({
        where: { id: input.matrixVersionId },
        include: { template: true },
      })
    : null;

  if (!matrixVersion) {
    const defaultTemplate = await dbClient.riskMatrixTemplate.findFirst({
      where: {
        organizationId,
        isDefault: true,
        isActive: true,
        currentVersionId: { not: null },
      },
      select: { currentVersionId: true },
    });
    if (defaultTemplate?.currentVersionId) {
      matrixVersion = await dbClient.riskMatrixVersion.findUnique({
        where: { id: defaultTemplate.currentVersionId },
        include: { template: true },
      });
    }
  }

  if (!matrixVersion) return scoring;

  // Guard org ownership of an explicitly-supplied version.
  if (matrixVersion.template.organizationId !== organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid matrix version — must be in same organization",
    });
  }

  const scales = matrixVersion.scales as unknown as MatrixScales;
  const thresholds = matrixVersion.thresholds as unknown as Threshold[];
  const outputScaleMax = Number(matrixVersion.template.outputScaleMax);
  const is3D = scales.exposure && scales.exposure.length > 0;

  // Story 23.5 (review MJ-3): reject values outside the matrix scales — an
  // unbounded input (e.g. likelihood 999999) would otherwise store a
  // normalized score far beyond outputScaleMax, corrupting register sorting,
  // heatmap placement, and the risk rollup.
  const assertOnScale = (
    dimension: "likelihood" | "impact" | "exposure",
    value: number | null | undefined,
  ) => {
    if (value == null) return;
    const scale = scales[dimension];
    if (!scale || scale.length === 0) return;
    const values = scale.map((s) => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (value < min || value > max) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${dimension} must be between ${min} and ${max} on the selected matrix`,
      });
    }
  };
  assertOnScale("likelihood", likelihood);
  assertOnScale("impact", impact);
  assertOnScale("exposure", exposure);
  assertOnScale("likelihood", input.residualLikelihood);
  assertOnScale("impact", input.residualImpact);
  assertOnScale("exposure", input.residualExposure);

  if (wantsInherent) {
    const scoreResult = calculateInherentScore(
      scales,
      thresholds,
      outputScaleMax,
      likelihood!,
      impact!,
      exposure
    );

    if (isScoreResult(scoreResult)) {
      scoring.inherentLikelihood = likelihood!;
      scoring.inherentImpact = impact!;
      // Only store exposure when the matrix is 3D (has exposure scale).
      scoring.inherentExposure = is3D && exposure !== undefined ? exposure : null;
      scoring.inherentScore = scoreResult.normalizedScore;
      scoring.severityLabel = scoreResult.label;
      scoring.severity = severityFromLabel(scoreResult.label);
      scoring.matrixVersionId = matrixVersion.id;
    }
  }

  if (wantsResidual) {
    const residualResult = calculateInherentScore(
      scales,
      thresholds,
      outputScaleMax,
      input.residualLikelihood!,
      input.residualImpact!,
      input.residualExposure ?? undefined
    );
    if (isScoreResult(residualResult)) {
      scoring.residualLikelihood = input.residualLikelihood!;
      scoring.residualImpact = input.residualImpact!;
      scoring.residualExposure =
        is3D && input.residualExposure != null ? input.residualExposure : null;
      scoring.residualScore = residualResult.normalizedScore;
      scoring.residualScoreLabel = residualResult.label;
      scoring.matrixVersionId = matrixVersion.id;
    }
  }

  return scoring;
}
