/**
 * Risk Matrix Validation
 *
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle (AC9-AC18)
 *
 * Validation functions for risk matrix scales and thresholds.
 * Ensures data integrity before publishing a matrix version.
 */

import type { MatrixScales, ScaleLevel, Threshold } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Scale Validation (AC9-AC13)
// ============================================================================

/**
 * Validate a single scale array
 * AC9: Values must be positive and unique
 * AC10-AC11: Must have 3-10 levels
 */
export function validateScaleArray(
  scale: ScaleLevel[],
  scaleName: string
): ValidationResult {
  const errors: string[] = [];

  // Check level count (AC10, AC11)
  if (scale.length < 3) {
    errors.push(`${scaleName} scale must have at least 3 levels`);
  }
  if (scale.length > 10) {
    errors.push(`${scaleName} scale cannot exceed 10 levels`);
  }

  // Check all values are positive (AC13)
  const nonPositive = scale.filter(level => level.value <= 0);
  if (nonPositive.length > 0) {
    errors.push(`${scaleName} scale has non-positive values`);
  }

  // Check value uniqueness (AC13)
  const values = scale.map(level => level.value);
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== values.length) {
    errors.push(`${scaleName} scale has duplicate values`);
  }

  // Check all labels are non-empty
  const emptyLabels = scale.filter(level => !level.label || level.label.trim() === "");
  if (emptyLabels.length > 0) {
    errors.push(`${scaleName} scale has empty labels`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate complete matrix scales
 * AC10: Likelihood required with 3-10 levels
 * AC11: Impact required with 3-10 levels
 * AC12: Exposure required only if dimensionCount = 3
 * AC13: All scale values must be positive and unique
 */
export function validateScales(
  scales: MatrixScales,
  dimensionCount: number
): ValidationResult {
  const errors: string[] = [];

  // Check required scales exist (AC10, AC11)
  if (!scales.likelihood || !Array.isArray(scales.likelihood)) {
    errors.push("Likelihood scale is required");
  }
  if (!scales.impact || !Array.isArray(scales.impact)) {
    errors.push("Impact scale is required");
  }

  // Check exposure for 3D matrices (AC12)
  if (dimensionCount === 3) {
    if (!scales.exposure || !Array.isArray(scales.exposure)) {
      errors.push("Exposure scale is required for 3D matrices");
    }
  }

  // Validate individual scales
  if (scales.likelihood && Array.isArray(scales.likelihood)) {
    const likelihoodResult = validateScaleArray(scales.likelihood, "Likelihood");
    errors.push(...likelihoodResult.errors);
  }

  if (scales.impact && Array.isArray(scales.impact)) {
    const impactResult = validateScaleArray(scales.impact, "Impact");
    errors.push(...impactResult.errors);
  }

  if (scales.exposure && Array.isArray(scales.exposure)) {
    const exposureResult = validateScaleArray(scales.exposure, "Exposure");
    errors.push(...exposureResult.errors);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Threshold Validation (AC14-AC18)
// ============================================================================

/**
 * Validate threshold array
 * AC14: Each threshold has minValue, maxValue, label, color, sortOrder
 * AC15: Thresholds must cover 0 to outputScaleMax without gaps
 * AC16: minValue of first threshold = 0
 * AC17: maxValue of last threshold = outputScaleMax
 * AC18: Threshold ranges must not overlap
 */
export function validateThresholds(
  thresholds: Threshold[],
  outputScaleMax: number
): ValidationResult {
  const errors: string[] = [];

  // Check at least one threshold
  if (!thresholds || thresholds.length === 0) {
    errors.push("At least one threshold is required");
    return { valid: false, errors };
  }

  // Sort by minValue for validation
  const sorted = [...thresholds].sort((a, b) => a.minValue - b.minValue);
  const firstThreshold = sorted[0];
  const lastThreshold = sorted[sorted.length - 1];

  // AC16: First threshold must start at 0
  if (firstThreshold && firstThreshold.minValue !== 0) {
    errors.push("First threshold must start at 0");
  }

  // AC17: Last threshold must end at outputScaleMax
  if (lastThreshold && lastThreshold.maxValue !== outputScaleMax) {
    errors.push(`Last threshold must end at ${outputScaleMax}`);
  }

  // AC15, AC18: Check for significant gaps and overlaps
  // Small gaps (≤0.02) are allowed for decimal precision between thresholds
  const ALLOWED_GAP = 0.02;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev && curr) {
      const gap = curr.minValue - prev.maxValue;
      if (gap < 0) {
        // Overlap
        errors.push(`Thresholds overlap at ${curr.minValue}`);
      } else if (gap > ALLOWED_GAP) {
        // Significant gap
        errors.push(`Gap between thresholds at ${prev.maxValue} to ${curr.minValue}`);
      }
    }
  }

  // Check all thresholds have valid ranges
  for (const threshold of thresholds) {
    if (threshold.minValue >= threshold.maxValue) {
      errors.push(`Threshold "${threshold.label}" has invalid range: ${threshold.minValue} >= ${threshold.maxValue}`);
    }
  }

  // Check all thresholds have labels
  const emptyLabels = thresholds.filter(t => !t.label || t.label.trim() === "");
  if (emptyLabels.length > 0) {
    errors.push("All thresholds must have labels");
  }

  // Check color format
  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
  const invalidColors = thresholds.filter(t => !colorRegex.test(t.color));
  if (invalidColors.length > 0) {
    errors.push("All threshold colors must be valid hex format (#RRGGBB)");
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// GridSize Validation (Story 11.1)
// ============================================================================

/**
 * Validate gridSize matches the number of scale levels
 * Story 11.1: gridSize must be 3, 4, or 5 and match scale level counts
 */
export function validateGridSize(
  scales: MatrixScales,
  gridSize: number
): ValidationResult {
  const errors: string[] = [];

  // Check gridSize is valid (3, 4, or 5)
  if (gridSize < 3 || gridSize > 5) {
    errors.push(`Grid size must be 3, 4, or 5 (got ${gridSize})`);
  }

  // Check likelihood scale matches gridSize
  if (scales.likelihood && scales.likelihood.length !== gridSize) {
    errors.push(
      `Likelihood scale has ${scales.likelihood.length} levels but gridSize is ${gridSize}`
    );
  }

  // Check impact scale matches gridSize
  if (scales.impact && scales.impact.length !== gridSize) {
    errors.push(
      `Impact scale has ${scales.impact.length} levels but gridSize is ${gridSize}`
    );
  }

  // Check exposure scale matches gridSize (if present)
  if (scales.exposure && scales.exposure.length !== gridSize) {
    errors.push(
      `Exposure scale has ${scales.exposure.length} levels but gridSize is ${gridSize}`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate slaDays in thresholds
 * Story 11.1: All thresholds must have positive slaDays
 */
export function validateThresholdSlaDays(
  thresholds: Threshold[]
): ValidationResult {
  const errors: string[] = [];

  for (const threshold of thresholds) {
    if (threshold.slaDays === undefined || threshold.slaDays === null) {
      errors.push(`Threshold "${threshold.label}" is missing slaDays`);
    } else if (threshold.slaDays <= 0) {
      errors.push(`Threshold "${threshold.label}" has invalid slaDays: ${threshold.slaDays} (must be positive)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Validate entire matrix version before publishing
 * Combines scale, threshold, gridSize, and slaDays validation
 * Story 11.1: Added gridSize and slaDays validation
 */
export function validateMatrixVersion(
  scales: MatrixScales,
  thresholds: Threshold[],
  dimensionCount: number,
  outputScaleMax: number,
  gridSize?: number
): ValidationResult {
  const errors: string[] = [];

  const scaleResult = validateScales(scales, dimensionCount);
  errors.push(...scaleResult.errors);

  const thresholdResult = validateThresholds(thresholds, outputScaleMax);
  errors.push(...thresholdResult.errors);

  // Story 11.1: Validate slaDays in thresholds
  const slaDaysResult = validateThresholdSlaDays(thresholds);
  errors.push(...slaDaysResult.errors);

  // Story 11.1: Validate gridSize if provided
  if (gridSize !== undefined) {
    const gridSizeResult = validateGridSize(scales, gridSize);
    errors.push(...gridSizeResult.errors);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Score Calculation Helpers
// ============================================================================

/**
 * Calculate the maximum possible score for a matrix
 * 2D: max(likelihood) × max(impact)
 * 3D: max(likelihood) × max(impact) × max(exposure)
 */
export function calculateMaxScore(scales: MatrixScales): number {
  const maxLikelihood = Math.max(...scales.likelihood.map(l => l.value));
  const maxImpact = Math.max(...scales.impact.map(l => l.value));

  if (scales.exposure && scales.exposure.length > 0) {
    const maxExposure = Math.max(...scales.exposure.map(l => l.value));
    return maxLikelihood * maxImpact * maxExposure;
  }

  return maxLikelihood * maxImpact;
}

/**
 * Check if outputScaleMax is appropriate for the given scales
 * The outputScaleMax should equal or exceed the max possible score
 */
export function validateOutputScaleMax(
  scales: MatrixScales,
  outputScaleMax: number
): ValidationResult {
  const errors: string[] = [];
  const maxScore = calculateMaxScore(scales);

  if (outputScaleMax < maxScore) {
    errors.push(
      `Output scale max (${outputScaleMax}) is less than maximum possible score (${maxScore})`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get threshold for a given score
 * With gaps between thresholds, we use inclusive bounds on both ends
 */
export function getThresholdForScore(
  score: number,
  thresholds: Threshold[]
): Threshold | null {
  const sorted = [...thresholds].sort((a, b) => a.minValue - b.minValue);

  for (const threshold of sorted) {
    if (score >= threshold.minValue && score <= threshold.maxValue) {
      return threshold;
    }
  }

  return null;
}
