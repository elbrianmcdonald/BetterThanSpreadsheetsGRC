/**
 * Matrix Version Comparison Utilities
 *
 * Story 7.8.7: Matrix Version Publishing
 *
 * Provides functions to compare scale and threshold configurations
 * between matrix versions for the publish confirmation dialog and
 * version comparison features.
 */

import type { MatrixScales, ScaleLevel, Threshold } from "./types";

/**
 * Represents a difference in a scale level between versions.
 */
export interface ScaleDiff {
  scale: "likelihood" | "impact" | "exposure";
  type: "added" | "removed" | "changed";
  level: ScaleLevel;
  previousLevel?: ScaleLevel;
}

/**
 * Represents a difference in a threshold between versions.
 */
export interface ThresholdDiff {
  type: "added" | "removed" | "changed";
  threshold: Threshold;
  previousThreshold?: Threshold;
}

/**
 * Compare two MatrixScales configurations and return the differences.
 *
 * @param previous - The previous/current version's scales
 * @param current - The new version's scales being compared
 * @returns Array of scale differences (added, removed, changed levels)
 */
export function compareScales(
  previous: MatrixScales,
  current: MatrixScales
): ScaleDiff[] {
  const diffs: ScaleDiff[] = [];

  const scaleKeys = ["likelihood", "impact", "exposure"] as const;

  for (const scaleKey of scaleKeys) {
    const prevLevels = previous[scaleKey] ?? [];
    const currLevels = current[scaleKey] ?? [];

    // Create maps for efficient lookup by value
    const prevByValue = new Map(prevLevels.map((l) => [l.value, l]));
    const currByValue = new Map(currLevels.map((l) => [l.value, l]));

    // Find added and changed levels in current
    for (const level of currLevels) {
      const prevLevel = prevByValue.get(level.value);
      if (!prevLevel) {
        // Level value doesn't exist in previous - it's new
        diffs.push({ scale: scaleKey, type: "added", level });
      } else {
        // Level exists - check if label or description changed
        if (
          prevLevel.label !== level.label ||
          prevLevel.description !== level.description
        ) {
          diffs.push({
            scale: scaleKey,
            type: "changed",
            level,
            previousLevel: prevLevel,
          });
        }
      }
    }

    // Find removed levels (in previous but not in current)
    for (const level of prevLevels) {
      if (!currByValue.has(level.value)) {
        diffs.push({ scale: scaleKey, type: "removed", level });
      }
    }
  }

  return diffs;
}

/**
 * Compare two threshold arrays and return the differences.
 *
 * @param previous - The previous/current version's thresholds
 * @param current - The new version's thresholds being compared
 * @returns Array of threshold differences (added, removed, changed)
 */
export function compareThresholds(
  previous: Threshold[],
  current: Threshold[]
): ThresholdDiff[] {
  const diffs: ThresholdDiff[] = [];

  // Use sortOrder as the primary key for comparison
  const prevByOrder = new Map(previous.map((t) => [t.sortOrder, t]));
  const currByOrder = new Map(current.map((t) => [t.sortOrder, t]));

  // Find added and changed thresholds in current
  for (const threshold of current) {
    const prevThreshold = prevByOrder.get(threshold.sortOrder);
    if (!prevThreshold) {
      // New threshold (sortOrder not in previous)
      diffs.push({ type: "added", threshold });
    } else {
      // Check for changes in properties
      if (
        prevThreshold.minValue !== threshold.minValue ||
        prevThreshold.maxValue !== threshold.maxValue ||
        prevThreshold.label !== threshold.label ||
        prevThreshold.color !== threshold.color
      ) {
        diffs.push({
          type: "changed",
          threshold,
          previousThreshold: prevThreshold,
        });
      }
    }
  }

  // Find removed thresholds (in previous but not in current)
  for (const threshold of previous) {
    if (!currByOrder.has(threshold.sortOrder)) {
      diffs.push({ type: "removed", threshold });
    }
  }

  return diffs;
}

/**
 * Get a summary of differences for display purposes.
 *
 * @param scaleDiffs - Scale differences
 * @param thresholdDiffs - Threshold differences
 * @returns Summary object with counts
 */
export function getDiffSummary(
  scaleDiffs: ScaleDiff[],
  thresholdDiffs: ThresholdDiff[]
): {
  scaleChanges: { added: number; removed: number; changed: number };
  thresholdChanges: { added: number; removed: number; changed: number };
  totalChanges: number;
  hasChanges: boolean;
} {
  const scaleChanges = {
    added: scaleDiffs.filter((d) => d.type === "added").length,
    removed: scaleDiffs.filter((d) => d.type === "removed").length,
    changed: scaleDiffs.filter((d) => d.type === "changed").length,
  };

  const thresholdChanges = {
    added: thresholdDiffs.filter((d) => d.type === "added").length,
    removed: thresholdDiffs.filter((d) => d.type === "removed").length,
    changed: thresholdDiffs.filter((d) => d.type === "changed").length,
  };

  const totalChanges = scaleDiffs.length + thresholdDiffs.length;

  return {
    scaleChanges,
    thresholdChanges,
    totalChanges,
    hasChanges: totalChanges > 0,
  };
}
