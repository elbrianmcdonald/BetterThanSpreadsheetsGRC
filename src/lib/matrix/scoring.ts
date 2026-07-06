/**
 * Risk Matrix Scoring Algorithm
 *
 * Story 7.8.8: Multiplicative Scoring Algorithm (AC1-AC12)
 *
 * Implements the multiplicative formula for calculating inherent risk scores:
 * - 2D: (L × I) / maxPossible × outputScaleMax
 * - 3D: (L × I × E) / maxPossible × outputScaleMax
 *
 * Scores are normalized to the outputScaleMax and matched to thresholds.
 */

import type { MatrixScales, Threshold } from "./types";

// ============================================================================
// Types (AC4-AC5)
// ============================================================================

/**
 * Successful score calculation result
 * AC4: Score stored with 4 decimal places precision
 * AC5: Includes matching threshold label and color
 *
 * Note: We use a string representation for the score to avoid importing
 * Prisma's Decimal in browser-bundled code. The server-side code can
 * convert to Decimal when storing to the database.
 */
export interface ScoreResult {
  /** Score as string with 4 decimal places (e.g., "12.3456") */
  scoreString: string;
  /** Score as number for calculations and display */
  normalizedScore: number;
  label: string;
  color: string;
}

/**
 * Incomplete score when inputs are missing
 * AC12: Null inputs return null score (represented as incomplete)
 */
export interface IncompleteScore {
  incomplete: true;
  reason: string;
}

/**
 * Union type for score calculation result
 */
export type ScoreCalculation = ScoreResult | IncompleteScore;

// ============================================================================
// Core Scoring Function (AC1-AC6)
// ============================================================================

/**
 * Calculate the inherent risk score using multiplicative formula
 *
 * AC1: calculateInherentScore function implemented
 * AC2: Accepts likelihood, impact, and optional exposure values
 * AC3: Uses multiplicative formula: (L × I × E?) / maxPossible × outputScaleMax
 * AC4: Returns score as Decimal with 4 decimal places
 * AC5: Returns matching threshold label and color
 * AC6: Handles 2D (no exposure) and 3D (with exposure) matrices
 *
 * @param scales - Matrix scales configuration (likelihood, impact, exposure?)
 * @param thresholds - Risk thresholds for categorization
 * @param outputScaleMax - Maximum output scale value (e.g., 25 for 5×5 or 100 for 10×10)
 * @param likelihoodValue - Selected likelihood value
 * @param impactValue - Selected impact value
 * @param exposureValue - Selected exposure value (optional, for 3D matrices)
 * @returns ScoreResult with score, label, color OR IncompleteScore with reason
 */
export function calculateInherentScore(
  scales: MatrixScales,
  thresholds: Threshold[],
  outputScaleMax: number,
  likelihoodValue: number | null | undefined,
  impactValue: number | null | undefined,
  exposureValue?: number | null | undefined
): ScoreCalculation {
  // AC12: Handle null/undefined inputs
  if (likelihoodValue === null || likelihoodValue === undefined) {
    return { incomplete: true, reason: "Likelihood not selected" };
  }
  if (impactValue === null || impactValue === undefined) {
    return { incomplete: true, reason: "Impact not selected" };
  }
  // AC6: Check exposure for 3D matrices
  const is3D = scales.exposure && scales.exposure.length > 0;
  if (is3D && (exposureValue === null || exposureValue === undefined)) {
    return { incomplete: true, reason: "Exposure not selected" };
  }

  // AC7-AC8: Calculate max possible values from scale level values
  const maxLikelihood = getMaxValue(scales.likelihood);
  const maxImpact = getMaxValue(scales.impact);
  const maxExposure = is3D && scales.exposure ? getMaxValue(scales.exposure) : 1;

  // Story 23.5 (review MJ-3): values outside the matrix scales produce an
  // "incomplete" result instead of a normalized score beyond outputScaleMax
  // (which would corrupt register sorting, heatmaps, and rollups).
  if (likelihoodValue < getMinValue(scales.likelihood) || likelihoodValue > maxLikelihood) {
    return { incomplete: true, reason: "Likelihood is outside the matrix scale" };
  }
  if (impactValue < getMinValue(scales.impact) || impactValue > maxImpact) {
    return { incomplete: true, reason: "Impact is outside the matrix scale" };
  }
  if (
    is3D &&
    scales.exposure &&
    exposureValue !== undefined &&
    exposureValue !== null &&
    (exposureValue < getMinValue(scales.exposure) || exposureValue > maxExposure)
  ) {
    return { incomplete: true, reason: "Exposure is outside the matrix scale" };
  }

  // AC3 & AC7: Calculate raw and max possible scores
  let rawScore: number;
  let maxPossible: number;

  if (is3D && exposureValue !== undefined && exposureValue !== null) {
    // 3D matrix: L × I × E
    rawScore = likelihoodValue * impactValue * exposureValue;
    maxPossible = maxLikelihood * maxImpact * maxExposure;
  } else {
    // 2D matrix: L × I
    rawScore = likelihoodValue * impactValue;
    maxPossible = maxLikelihood * maxImpact;
  }

  // AC9: Normalize to 0-outputScaleMax range
  const normalizedScore = (rawScore / maxPossible) * outputScaleMax;

  // AC10-AC11: Find matching threshold
  const matchedThreshold = findMatchingThreshold(
    normalizedScore,
    thresholds,
    outputScaleMax
  );

  // AC4: Return with 4 decimal places precision
  const roundedScore = Number(normalizedScore.toFixed(4));
  return {
    scoreString: normalizedScore.toFixed(4),
    normalizedScore: roundedScore,
    label: matchedThreshold.label,
    color: matchedThreshold.color,
  };
}

// ============================================================================
// Helper Functions (AC7-AC11)
// ============================================================================

/**
 * Get the maximum value from a scale's levels
 * AC8: Max values derived from scale level values
 */
function getMaxValue(
  levels: Array<{ value: number }>
): number {
  if (!levels || levels.length === 0) {
    return 1; // Fallback to 1 to avoid division by zero
  }
  return Math.max(...levels.map((l) => l.value));
}

/**
 * Get the minimum value from a scale's levels (for validation)
 */
export function getMinValue(
  levels: Array<{ value: number }>
): number {
  if (!levels || levels.length === 0) {
    return 1;
  }
  return Math.min(...levels.map((l) => l.value));
}

/**
 * Find the matching threshold for a given score
 * AC10: Threshold lookup uses score >= minValue && score < maxValue
 * AC11: Edge case: score exactly at max uses last threshold
 */
function findMatchingThreshold(
  score: number,
  thresholds: Threshold[],
  outputScaleMax: number
): Threshold {
  // Sort thresholds by sortOrder (ascending)
  const sortedThresholds = [...thresholds].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  // Default to last threshold
  let matchedThreshold = sortedThresholds[sortedThresholds.length - 1];

  // AC11: Handle edge case where score is at or above max
  if (score >= outputScaleMax) {
    return matchedThreshold!;
  }

  // AC10: Find threshold where score >= minValue && score < maxValue
  for (const threshold of sortedThresholds) {
    if (score >= threshold.minValue && score < threshold.maxValue) {
      matchedThreshold = threshold;
      break;
    }
  }

  return matchedThreshold!;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a ScoreCalculation is a successful ScoreResult
 */
export function isScoreResult(
  result: ScoreCalculation
): result is ScoreResult {
  return !("incomplete" in result);
}

/**
 * Type guard to check if a ScoreCalculation is IncompleteScore
 */
export function isIncompleteScore(
  result: ScoreCalculation
): result is IncompleteScore {
  return "incomplete" in result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate just the raw (non-normalized) score
 * Useful for debugging or displaying the raw multiplication
 */
export function calculateRawScore(
  likelihoodValue: number,
  impactValue: number,
  exposureValue?: number
): number {
  if (exposureValue !== undefined && exposureValue !== null) {
    return likelihoodValue * impactValue * exposureValue;
  }
  return likelihoodValue * impactValue;
}

/**
 * Get all threshold boundaries for a given threshold configuration
 * Returns array of [minValue, maxValue, label] tuples
 */
export function getThresholdBoundaries(
  thresholds: Threshold[]
): Array<{ min: number; max: number; label: string; color: string }> {
  return thresholds
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      min: t.minValue,
      max: t.maxValue,
      label: t.label,
      color: t.color,
    }));
}
