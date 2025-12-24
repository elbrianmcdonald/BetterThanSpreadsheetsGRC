/**
 * Unit Tests for Matrix Version Comparison Utilities
 *
 * Story 7.8.7: Matrix Version Publishing (AC14-AC17)
 *
 * Tests the comparison utility functions used to show differences
 * between matrix versions during publishing and in the comparison dialog.
 */

import {
  compareScales,
  compareThresholds,
  getDiffSummary,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";

describe("Matrix Version Comparison Utilities - Story 7.8.7", () => {
  // Sample test data
  const baseScales: MatrixScales = {
    likelihood: [
      { value: 1, label: "Rare", description: "Once in 10 years" },
      { value: 2, label: "Unlikely", description: "Once in 5 years" },
      { value: 3, label: "Possible", description: "Once per year" },
      { value: 4, label: "Likely", description: "Once per quarter" },
      { value: 5, label: "Almost Certain", description: "Monthly" },
    ],
    impact: [
      { value: 1, label: "Negligible", description: "Minor impact" },
      { value: 2, label: "Minor", description: "Some impact" },
      { value: 3, label: "Moderate", description: "Noticeable impact" },
      { value: 4, label: "Major", description: "Significant impact" },
      { value: 5, label: "Catastrophic", description: "Severe impact" },
    ],
  };

  const baseThresholds: Threshold[] = [
    { sortOrder: 1, label: "Low", minValue: 1, maxValue: 5, color: "#22c55e" },
    { sortOrder: 2, label: "Medium", minValue: 6, maxValue: 12, color: "#eab308" },
    { sortOrder: 3, label: "High", minValue: 13, maxValue: 19, color: "#f97316" },
    { sortOrder: 4, label: "Critical", minValue: 20, maxValue: 25, color: "#ef4444" },
  ];

  describe("compareScales", () => {
    it("should return empty array when scales are identical", () => {
      const diffs = compareScales(baseScales, baseScales);
      expect(diffs).toEqual([]);
    });

    it("should detect added scale levels", () => {
      const newScales: MatrixScales = {
        ...baseScales,
        likelihood: [
          ...baseScales.likelihood,
          { value: 6, label: "Certain", description: "Weekly" },
        ],
      };

      const diffs = compareScales(baseScales, newScales);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        scale: "likelihood",
        type: "added",
        level: { value: 6, label: "Certain" },
      });
    });

    it("should detect removed scale levels", () => {
      const newScales: MatrixScales = {
        ...baseScales,
        impact: baseScales.impact.slice(0, 4), // Remove last level
      };

      const diffs = compareScales(baseScales, newScales);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        scale: "impact",
        type: "removed",
        level: { value: 5, label: "Catastrophic" },
      });
    });

    it("should detect changed scale levels (label change)", () => {
      const newScales: MatrixScales = {
        ...baseScales,
        likelihood: baseScales.likelihood.map((l) =>
          l.value === 3 ? { ...l, label: "Occasional" } : l
        ),
      };

      const diffs = compareScales(baseScales, newScales);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        scale: "likelihood",
        type: "changed",
        level: { value: 3, label: "Occasional" },
        previousLevel: { value: 3, label: "Possible" },
      });
    });

    it("should detect changed scale levels (description change)", () => {
      const newScales: MatrixScales = {
        ...baseScales,
        impact: baseScales.impact.map((l) =>
          l.value === 1 ? { ...l, description: "Updated description" } : l
        ),
      };

      const diffs = compareScales(baseScales, newScales);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        scale: "impact",
        type: "changed",
        level: { value: 1, description: "Updated description" },
      });
    });

    it("should detect multiple changes across scales", () => {
      const newScales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Very Rare", description: "Once in 20 years" }, // Changed
          { value: 2, label: "Unlikely", description: "Once in 5 years" }, // Same
          // Value 3 removed
          { value: 4, label: "Likely", description: "Once per quarter" }, // Same
          { value: 5, label: "Almost Certain", description: "Monthly" }, // Same
          { value: 6, label: "Certain", description: "Weekly" }, // Added
        ],
        impact: baseScales.impact,
      };

      const diffs = compareScales(baseScales, newScales);

      expect(diffs).toHaveLength(3);
      expect(diffs).toContainEqual(
        expect.objectContaining({ type: "changed", level: expect.objectContaining({ value: 1 }) })
      );
      expect(diffs).toContainEqual(
        expect.objectContaining({ type: "removed", level: expect.objectContaining({ value: 3 }) })
      );
      expect(diffs).toContainEqual(
        expect.objectContaining({ type: "added", level: expect.objectContaining({ value: 6 }) })
      );
    });

    it("should handle empty scales (all levels removed)", () => {
      const emptyScales: MatrixScales = {
        likelihood: [],
        impact: [],
      };

      const diffs = compareScales(baseScales, emptyScales);

      // All 10 levels from baseScales should be marked as removed
      expect(diffs).toHaveLength(10);
      expect(diffs.every((d) => d.type === "removed")).toBe(true);
    });

    it("should handle empty previous scales (all levels added)", () => {
      const emptyScales: MatrixScales = {
        likelihood: [],
        impact: [],
      };

      const diffs = compareScales(emptyScales, baseScales);

      // All 10 levels from baseScales should be marked as added
      expect(diffs).toHaveLength(10);
      expect(diffs.every((d) => d.type === "added")).toBe(true);
    });

    it("should return empty array when both scales are empty", () => {
      const emptyScales: MatrixScales = {
        likelihood: [],
        impact: [],
      };

      const diffs = compareScales(emptyScales, emptyScales);
      expect(diffs).toEqual([]);
    });

    it("should handle exposure scale in 3D matrices", () => {
      const scales3D: MatrixScales = {
        ...baseScales,
        exposure: [
          { value: 1, label: "Isolated", description: "Single system" },
          { value: 2, label: "Limited", description: "Few systems" },
          { value: 3, label: "Widespread", description: "Many systems" },
        ],
      };

      const newScales3D: MatrixScales = {
        ...scales3D,
        exposure: [
          { value: 1, label: "Isolated", description: "Single system" },
          { value: 2, label: "Moderate", description: "Several systems" }, // Changed
          { value: 3, label: "Widespread", description: "Many systems" },
          { value: 4, label: "Enterprise-wide", description: "All systems" }, // Added
        ],
      };

      const diffs = compareScales(scales3D, newScales3D);

      expect(diffs).toHaveLength(2);
      expect(diffs).toContainEqual(
        expect.objectContaining({ scale: "exposure", type: "changed", level: expect.objectContaining({ value: 2 }) })
      );
      expect(diffs).toContainEqual(
        expect.objectContaining({ scale: "exposure", type: "added", level: expect.objectContaining({ value: 4 }) })
      );
    });
  });

  describe("compareThresholds", () => {
    it("should return empty array when thresholds are identical", () => {
      const diffs = compareThresholds(baseThresholds, baseThresholds);
      expect(diffs).toEqual([]);
    });

    it("should detect added thresholds", () => {
      const newThresholds: Threshold[] = [
        ...baseThresholds,
        { sortOrder: 5, label: "Extreme", minValue: 26, maxValue: 30, color: "#7c3aed" },
      ];

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        type: "added",
        threshold: { sortOrder: 5, label: "Extreme" },
      });
    });

    it("should detect removed thresholds", () => {
      const newThresholds = baseThresholds.slice(0, 3);

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        type: "removed",
        threshold: { sortOrder: 4, label: "Critical" },
      });
    });

    it("should detect changed thresholds (label change)", () => {
      const newThresholds = baseThresholds.map((t) =>
        t.sortOrder === 2 ? { ...t, label: "Moderate" } : t
      );

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        type: "changed",
        threshold: { sortOrder: 2, label: "Moderate" },
        previousThreshold: { sortOrder: 2, label: "Medium" },
      });
    });

    it("should detect changed thresholds (range change)", () => {
      const newThresholds = baseThresholds.map((t) =>
        t.sortOrder === 1 ? { ...t, maxValue: 6 } : t
      );

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        type: "changed",
        threshold: { sortOrder: 1, minValue: 1, maxValue: 6 },
        previousThreshold: { sortOrder: 1, minValue: 1, maxValue: 5 },
      });
    });

    it("should detect changed thresholds (color change)", () => {
      const newThresholds = baseThresholds.map((t) =>
        t.sortOrder === 4 ? { ...t, color: "#dc2626" } : t
      );

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(1);
      expect(diffs[0]).toMatchObject({
        type: "changed",
        threshold: { sortOrder: 4, color: "#dc2626" },
      });
    });

    it("should handle empty thresholds (all removed)", () => {
      const diffs = compareThresholds(baseThresholds, []);

      expect(diffs).toHaveLength(4);
      expect(diffs.every((d) => d.type === "removed")).toBe(true);
    });

    it("should handle empty previous thresholds (all added)", () => {
      const diffs = compareThresholds([], baseThresholds);

      expect(diffs).toHaveLength(4);
      expect(diffs.every((d) => d.type === "added")).toBe(true);
    });

    it("should return empty array when both thresholds are empty", () => {
      const diffs = compareThresholds([], []);
      expect(diffs).toEqual([]);
    });

    it("should detect multiple threshold changes", () => {
      const newThresholds: Threshold[] = [
        { sortOrder: 1, label: "Minimal", minValue: 1, maxValue: 4, color: "#22c55e" }, // Changed label and max
        { sortOrder: 2, label: "Medium", minValue: 5, maxValue: 10, color: "#facc15" }, // Changed range and color
        // sortOrder 3 removed
        { sortOrder: 4, label: "Critical", minValue: 11, maxValue: 25, color: "#ef4444" }, // Changed range
      ];

      const diffs = compareThresholds(baseThresholds, newThresholds);

      expect(diffs).toHaveLength(4);
      expect(diffs.filter((d) => d.type === "changed")).toHaveLength(3);
      expect(diffs.filter((d) => d.type === "removed")).toHaveLength(1);
    });
  });

  describe("getDiffSummary", () => {
    it("should return hasChanges: false when no differences", () => {
      const summary = getDiffSummary([], []);

      expect(summary.hasChanges).toBe(false);
      expect(summary.scaleChanges.added).toBe(0);
      expect(summary.scaleChanges.removed).toBe(0);
      expect(summary.scaleChanges.changed).toBe(0);
      expect(summary.thresholdChanges.added).toBe(0);
      expect(summary.thresholdChanges.removed).toBe(0);
      expect(summary.thresholdChanges.changed).toBe(0);
    });

    it("should correctly summarize scale changes", () => {
      const scaleDiffs = [
        { scale: "likelihood" as const, type: "added" as const, level: { value: 6, label: "Certain" } },
        { scale: "likelihood" as const, type: "removed" as const, level: { value: 1, label: "Rare" } },
        { scale: "impact" as const, type: "changed" as const, level: { value: 3, label: "Moderate" }, previousLevel: { value: 3, label: "Medium" } },
        { scale: "impact" as const, type: "changed" as const, level: { value: 4, label: "Significant" }, previousLevel: { value: 4, label: "Major" } },
      ];

      const summary = getDiffSummary(scaleDiffs, []);

      expect(summary.hasChanges).toBe(true);
      expect(summary.scaleChanges.added).toBe(1);
      expect(summary.scaleChanges.removed).toBe(1);
      expect(summary.scaleChanges.changed).toBe(2);
    });

    it("should correctly summarize threshold changes", () => {
      const thresholdDiffs = [
        { type: "added" as const, threshold: { sortOrder: 5, label: "Extreme", minValue: 21, maxValue: 25, color: "#7c3aed" } },
        { type: "added" as const, threshold: { sortOrder: 6, label: "Catastrophic", minValue: 26, maxValue: 30, color: "#581c87" } },
        { type: "removed" as const, threshold: { sortOrder: 1, label: "Low", minValue: 1, maxValue: 5, color: "#22c55e" } },
      ];

      const summary = getDiffSummary([], thresholdDiffs);

      expect(summary.hasChanges).toBe(true);
      expect(summary.thresholdChanges.added).toBe(2);
      expect(summary.thresholdChanges.removed).toBe(1);
      expect(summary.thresholdChanges.changed).toBe(0);
    });

    it("should correctly summarize combined changes", () => {
      const scaleDiffs = [
        { scale: "likelihood" as const, type: "added" as const, level: { value: 6, label: "Certain" } },
      ];
      const thresholdDiffs = [
        { type: "changed" as const, threshold: { sortOrder: 2, label: "Medium", minValue: 6, maxValue: 15, color: "#eab308" }, previousThreshold: { sortOrder: 2, label: "Medium", minValue: 6, maxValue: 12, color: "#eab308" } },
      ];

      const summary = getDiffSummary(scaleDiffs, thresholdDiffs);

      expect(summary.hasChanges).toBe(true);
      expect(summary.scaleChanges.added).toBe(1);
      expect(summary.thresholdChanges.changed).toBe(1);
    });
  });
});
