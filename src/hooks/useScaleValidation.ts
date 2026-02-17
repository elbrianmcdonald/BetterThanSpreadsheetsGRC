/**
 * Scale Validation Hook
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 *
 * Provides real-time validation for scale levels.
 *
 * Validation Rules (AC13-AC17):
 * - AC14: Error if fewer than 3 levels
 * - AC15: Error if duplicate values within scale
 * - AC16: Error if value is non-positive
 * - AC17: Warning if levels not in ascending order
 */

import { useMemo } from "react";
import type { ScaleLevel } from "@/lib/matrix";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  levelErrors: Map<number, string>;
}

const MIN_LEVELS = 3;
const MAX_LEVELS = 10;

export function useScaleValidation(levels: ScaleLevel[]): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const levelErrors = new Map<number, string>();

    // Sort levels by value for validation
    const sortedLevels = [...levels].sort((a, b) => a.value - b.value);

    // AC14: Error if fewer than 3 levels
    if (levels.length < MIN_LEVELS) {
      errors.push(`At least ${MIN_LEVELS} levels are required (currently ${levels.length})`);
    }

    // Check if we exceed max levels
    if (levels.length > MAX_LEVELS) {
      errors.push(`Maximum ${MAX_LEVELS} levels allowed (currently ${levels.length})`);
    }

    // Track values for duplicate detection
    const seenValues = new Map<number, number[]>();

    sortedLevels.forEach((level, index) => {
      // AC16: Error if value is non-positive
      if (level.value <= 0) {
        levelErrors.set(index, "Value must be positive");
        errors.push(`Level "${level.label || `at position ${index + 1}`}" has non-positive value (${level.value})`);
      }

      // Track values for duplicate detection
      const existing = seenValues.get(level.value);
      if (existing) {
        existing.push(index);
      } else {
        seenValues.set(level.value, [index]);
      }
    });

    // AC15: Error if duplicate values within scale
    for (const [value, indices] of seenValues.entries()) {
      if (indices.length > 1) {
        indices.forEach((idx) => {
          levelErrors.set(idx, "Duplicate value");
        });
        errors.push(`Duplicate value ${value} found in ${indices.length} levels`);
      }
    }

    // AC17: Warning if levels not in ascending order (by original array order)
    // Check if the original array order matches the sorted order
    let isAscending = true;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i]!.value < levels[i - 1]!.value) {
        isAscending = false;
        break;
      }
    }

    if (!isAscending && levels.length > 1) {
      warnings.push("Levels are not in ascending order by value. Consider reordering for clarity.");
    }

    // Warning for empty labels
    const emptyLabelCount = levels.filter((l) => !l.label.trim()).length;
    if (emptyLabelCount > 0) {
      warnings.push(`${emptyLabelCount} level(s) have empty labels`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      levelErrors,
    };
  }, [levels]);
}

/**
 * Validate a complete set of scales for a matrix version
 */
export function validateScalesComplete(
  scales: { likelihood: ScaleLevel[]; impact: ScaleLevel[]; exposure?: ScaleLevel[] },
  dimensionCount: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate likelihood
  const likelihoodValidation = validateSingleScale(scales.likelihood, "Likelihood");
  errors.push(...likelihoodValidation.errors);

  // Validate impact
  const impactValidation = validateSingleScale(scales.impact, "Impact");
  errors.push(...impactValidation.errors);

  // Validate exposure if 3D
  if (dimensionCount === 3) {
    if (!scales.exposure || scales.exposure.length === 0) {
      errors.push("Exposure scale is required for 3D matrices");
    } else {
      const exposureValidation = validateSingleScale(scales.exposure, "Exposure");
      errors.push(...exposureValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateSingleScale(
  levels: ScaleLevel[],
  name: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (levels.length < MIN_LEVELS) {
    errors.push(`${name} scale must have at least ${MIN_LEVELS} levels`);
  }

  if (levels.length > MAX_LEVELS) {
    errors.push(`${name} scale must have at most ${MAX_LEVELS} levels`);
  }

  // Check for non-positive values
  const nonPositive = levels.filter((l) => l.value <= 0);
  if (nonPositive.length > 0) {
    errors.push(`${name} scale has ${nonPositive.length} level(s) with non-positive values`);
  }

  // Check for duplicates
  const values = levels.map((l) => l.value);
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== values.length) {
    errors.push(`${name} scale has duplicate values`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
