/**
 * Threshold Validation Hook
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 11.6: Severity Threshold Configuration
 *
 * Provides real-time validation for risk thresholds.
 *
 * Validation Rules (AC11-AC14, 11.6 AC10-AC13):
 * - AC11: First threshold always starts at 0
 * - AC12: Last threshold always ends at outputScaleMax
 * - AC13: Boundaries cannot create gaps or overlaps
 * - AC14: Minimum 2 thresholds required
 * - 11.6 AC10: SLA days must be positive
 * - 11.6 AC11: Warning if higher severity has longer SLA
 * - 11.6 AC12: SLA days cannot exceed 365
 */

import { useMemo } from "react";
import type { Threshold } from "@/lib/matrix";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const MIN_THRESHOLDS = 2;

export function useThresholdValidation(
  thresholds: Threshold[],
  outputScaleMax: number
): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sort thresholds by sortOrder for validation
    const sorted = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);

    // Rule 1 (AC14): Minimum 2 thresholds
    if (sorted.length < MIN_THRESHOLDS) {
      errors.push(`At least ${MIN_THRESHOLDS} thresholds are required (currently ${sorted.length})`);
    }

    if (sorted.length === 0) {
      return { isValid: false, errors, warnings };
    }

    // Rule 2 (AC11): First threshold starts at 0
    if (sorted[0]!.minValue !== 0) {
      errors.push(`First threshold must start at 0 (currently starts at ${sorted[0]!.minValue})`);
    }

    // Rule 3 (AC12): Last threshold ends at outputScaleMax
    const lastThreshold = sorted[sorted.length - 1]!;
    if (lastThreshold.maxValue !== outputScaleMax) {
      errors.push(
        `Last threshold must end at ${outputScaleMax} (currently ends at ${lastThreshold.maxValue})`
      );
    }

    // Rule 4 (AC13): No significant gaps or overlaps
    // Note: Small gaps (≤0.01) are allowed between thresholds for decimal precision
    const ALLOWED_GAP = 0.02; // Allow up to 0.02 gap (accounts for rounding)
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]!;
      const next = sorted[i + 1]!;
      const gap = next.minValue - current.maxValue;

      if (gap > ALLOWED_GAP) {
        // Significant gap
        errors.push(
          `Gap between thresholds "${current.label}" and "${next.label}" (${current.maxValue} to ${next.minValue})`
        );
      } else if (gap < 0) {
        // Overlap
        errors.push(
          `Overlap between thresholds "${current.label}" and "${next.label}" (${current.maxValue} and ${next.minValue})`
        );
      }
    }

    // Rule 5: All ranges must be positive (minValue < maxValue)
    for (let i = 0; i < sorted.length; i++) {
      const threshold = sorted[i]!;
      if (threshold.maxValue <= threshold.minValue) {
        errors.push(
          `Threshold "${threshold.label}" has invalid range (${threshold.minValue} to ${threshold.maxValue})`
        );
      }
    }

    // Warning: Check for empty labels
    const emptyLabelCount = thresholds.filter((t) => !t.label.trim()).length;
    if (emptyLabelCount > 0) {
      warnings.push(`${emptyLabelCount} threshold(s) have empty labels`);
    }

    // Warning: Check for very narrow thresholds
    for (const threshold of sorted) {
      const range = threshold.maxValue - threshold.minValue;
      const percentOfTotal = (range / outputScaleMax) * 100;
      if (percentOfTotal < 5 && range < 0.5) {
        warnings.push(
          `Threshold "${threshold.label}" has a very narrow range (${range.toFixed(2)})`
        );
      }
    }

    // Story 11.6 AC10, AC12: Check SLA days validity
    for (const threshold of sorted) {
      const slaDays = threshold.slaDays ?? 30;
      if (slaDays < 1) {
        errors.push(`Threshold "${threshold.label}": SLA days must be at least 1`);
      }
      if (slaDays > 365) {
        errors.push(`Threshold "${threshold.label}": SLA days cannot exceed 365`);
      }
    }

    // Story 11.6 AC11: Check SLA ordering (higher severity should have shorter SLA)
    // Lower sortOrder = lower severity (e.g., "Very Low" = sortOrder 1)
    // Higher sortOrder = higher severity (e.g., "Critical" = sortOrder 5)
    for (let i = 1; i < sorted.length; i++) {
      const lowerSeverity = sorted[i - 1]!;  // Lower sortOrder = lower severity
      const higherSeverity = sorted[i]!;      // Higher sortOrder = higher severity
      const lowerSla = lowerSeverity.slaDays ?? 30;
      const higherSla = higherSeverity.slaDays ?? 30;
      // Warn only if higher severity has LONGER SLA than lower severity (unusual)
      if (higherSla > lowerSla) {
        warnings.push(
          `"${higherSeverity.label}" has longer SLA (${higherSla}d) than "${lowerSeverity.label}" (${lowerSla}d) - consider reversing`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [thresholds, outputScaleMax]);
}

/**
 * Validate thresholds for completeness before saving/publishing
 */
export function validateThresholdsComplete(
  thresholds: Threshold[],
  outputScaleMax: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sorted = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);

  if (sorted.length < MIN_THRESHOLDS) {
    errors.push(`At least ${MIN_THRESHOLDS} thresholds are required`);
  }

  if (sorted.length === 0) {
    return { isValid: false, errors };
  }

  // Check starts at 0
  if (sorted[0]!.minValue !== 0) {
    errors.push("First threshold must start at 0");
  }

  // Check ends at outputScaleMax
  const lastThreshold = sorted[sorted.length - 1]!;
  if (lastThreshold.maxValue !== outputScaleMax) {
    errors.push(`Last threshold must end at ${outputScaleMax}`);
  }

  // Check no significant gaps or overlaps (small gaps ≤0.02 allowed for decimal precision)
  const ALLOWED_GAP = 0.02;
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    const gap = next.minValue - current.maxValue;
    if (gap > ALLOWED_GAP || gap < 0) {
      errors.push("Thresholds have gaps or overlaps");
      break;
    }
  }

  // Check all labels are non-empty
  if (thresholds.some((t) => !t.label.trim())) {
    errors.push("All thresholds must have labels");
  }

  // Check all colors are valid hex
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (thresholds.some((t) => !hexRegex.test(t.color))) {
    errors.push("All thresholds must have valid hex colors");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
