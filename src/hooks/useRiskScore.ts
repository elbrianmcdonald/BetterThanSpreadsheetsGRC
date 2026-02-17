/**
 * useRiskScore Hook
 *
 * Story 7.8.8: Multiplicative Scoring Algorithm (AC13-AC16)
 *
 * Real-time risk score calculation hook for assessment forms.
 * Computes score on value change and returns score state.
 */

import { useMemo } from "react";
import {
  calculateInherentScore,
  type ScoreCalculation,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for the useRiskScore hook
 * AC13: Accept selected values and matrix version data
 */
export interface UseRiskScoreParams {
  /** Parsed scales from the matrix version */
  scales: MatrixScales | null | undefined;
  /** Parsed thresholds from the matrix version */
  thresholds: Threshold[] | null | undefined;
  /** Maximum output scale value (e.g., 25 for 5×5 matrix) */
  outputScaleMax: number | null | undefined;
  /** Selected likelihood value from the form */
  likelihoodValue: number | null | undefined;
  /** Selected impact value from the form */
  impactValue: number | null | undefined;
  /** Selected exposure value (optional, for 3D matrices) */
  exposureValue?: number | null | undefined;
}

/**
 * Return type for the useRiskScore hook
 */
export interface UseRiskScoreResult {
  /** The calculated score result or incomplete status */
  score: ScoreCalculation | null;
  /** Whether the matrix data is available */
  hasMatrix: boolean;
  /** Whether the score is complete (all required values selected) */
  isComplete: boolean;
  /** The raw score display string (e.g., "12.5") */
  displayScore: string | null;
  /** The threshold label (e.g., "Medium") */
  label: string | null;
  /** The threshold color (e.g., "#eab308") */
  color: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Calculate risk score in real-time based on selected values
 *
 * AC13: Assessment form shows score as user selects values
 * AC14: Score updates immediately on selection change (via useMemo)
 * AC15: Threshold color and label displayed with score
 * AC16: "Incomplete" shown until all required values selected
 *
 * @example
 * ```tsx
 * const { score, isComplete, displayScore, label, color } = useRiskScore({
 *   scales: matrixVersion?.scales as MatrixScales,
 *   thresholds: matrixVersion?.thresholds as Threshold[],
 *   outputScaleMax: Number(matrixVersion?.template?.outputScaleMax),
 *   likelihoodValue: formData.likelihood,
 *   impactValue: formData.impact,
 *   exposureValue: formData.exposure,
 * });
 * ```
 */
export function useRiskScore({
  scales,
  thresholds,
  outputScaleMax,
  likelihoodValue,
  impactValue,
  exposureValue,
}: UseRiskScoreParams): UseRiskScoreResult {
  return useMemo(() => {
    // Check if we have the required matrix data
    const hasMatrix = Boolean(
      scales &&
        thresholds &&
        thresholds.length > 0 &&
        outputScaleMax !== null &&
        outputScaleMax !== undefined
    );

    if (!hasMatrix || !scales || !thresholds || !outputScaleMax) {
      return {
        score: null,
        hasMatrix: false,
        isComplete: false,
        displayScore: null,
        label: null,
        color: null,
      };
    }

    // Calculate the score
    const result = calculateInherentScore(
      scales,
      thresholds,
      outputScaleMax,
      likelihoodValue ?? null,
      impactValue ?? null,
      exposureValue ?? null
    );

    // Check if the result is complete (not incomplete)
    const isComplete = !("incomplete" in result);

    if (isComplete) {
      // Score is complete - extract values
      const scoreResult = result as Exclude<ScoreCalculation, { incomplete: true }>;
      return {
        score: result,
        hasMatrix: true,
        isComplete: true,
        displayScore: Number(scoreResult.normalizedScore).toFixed(1),
        label: scoreResult.label,
        color: scoreResult.color,
      };
    }

    // Score is incomplete - return with reason
    return {
      score: result,
      hasMatrix: true,
      isComplete: false,
      displayScore: null,
      label: null,
      color: null,
    };
  }, [
    scales,
    thresholds,
    outputScaleMax,
    likelihoodValue,
    impactValue,
    exposureValue,
  ]);
}

// ============================================================================
// Score Display Helper
// ============================================================================

/**
 * Get a human-readable status message for the score
 */
export function getScoreStatusMessage(result: UseRiskScoreResult): string {
  if (!result.hasMatrix) {
    return "Select a matrix to see score";
  }

  if (!result.isComplete && result.score && "incomplete" in result.score) {
    return result.score.reason;
  }

  if (result.isComplete && result.displayScore) {
    return `${result.label} (${result.displayScore})`;
  }

  return "Calculating...";
}
