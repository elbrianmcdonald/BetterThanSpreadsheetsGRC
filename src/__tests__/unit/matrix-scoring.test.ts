/**
 * Unit Tests for Matrix Scoring Algorithm
 *
 * Story 7.8.8: Multiplicative Scoring Algorithm (AC21-AC24)
 *
 * Tests the scoring function for 2D and 3D matrices with edge cases.
 */

import {
  calculateInherentScore,
  calculateRawScore,
  getMinValue,
  isScoreResult,
  isIncompleteScore,
  getThresholdBoundaries,
  type ScoreResult,
  type IncompleteScore,
} from "@/lib/matrix/scoring";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";

describe("Matrix Scoring Algorithm - Story 7.8.8", () => {
  // ============================================================================
  // Test Data - Standard 5x5 Matrix
  // ============================================================================

  const standard5x5Scales: MatrixScales = {
    likelihood: [
      { value: 1, label: "Rare" },
      { value: 2, label: "Unlikely" },
      { value: 3, label: "Possible" },
      { value: 4, label: "Likely" },
      { value: 5, label: "Almost Certain" },
    ],
    impact: [
      { value: 1, label: "Negligible" },
      { value: 2, label: "Minor" },
      { value: 3, label: "Moderate" },
      { value: 4, label: "Major" },
      { value: 5, label: "Catastrophic" },
    ],
  };

  const standard5x5Thresholds: Threshold[] = [
    { sortOrder: 1, label: "Low", minValue: 0, maxValue: 5, color: "#22c55e" },
    { sortOrder: 2, label: "Medium", minValue: 5, maxValue: 12, color: "#eab308" },
    { sortOrder: 3, label: "High", minValue: 12, maxValue: 19, color: "#f97316" },
    { sortOrder: 4, label: "Critical", minValue: 19, maxValue: 25, color: "#ef4444" },
  ];

  const outputScaleMax25 = 25;

  // ============================================================================
  // Test Data - 3D Matrix with Exposure
  // ============================================================================

  const scales3D: MatrixScales = {
    likelihood: [
      { value: 1, label: "Rare" },
      { value: 2, label: "Unlikely" },
      { value: 3, label: "Possible" },
      { value: 4, label: "Likely" },
      { value: 5, label: "Almost Certain" },
    ],
    impact: [
      { value: 1, label: "Negligible" },
      { value: 2, label: "Minor" },
      { value: 3, label: "Moderate" },
      { value: 4, label: "Major" },
      { value: 5, label: "Catastrophic" },
    ],
    exposure: [
      { value: 1, label: "Isolated" },
      { value: 2, label: "Limited" },
      { value: 3, label: "Moderate" },
      { value: 4, label: "Significant" },
      { value: 5, label: "Widespread" },
    ],
  };

  const thresholds3D: Threshold[] = [
    { sortOrder: 1, label: "Low", minValue: 0, maxValue: 25, color: "#22c55e" },
    { sortOrder: 2, label: "Medium", minValue: 25, maxValue: 50, color: "#eab308" },
    { sortOrder: 3, label: "High", minValue: 50, maxValue: 75, color: "#f97316" },
    { sortOrder: 4, label: "Critical", minValue: 75, maxValue: 100, color: "#ef4444" },
  ];

  const outputScaleMax100 = 100;

  // ============================================================================
  // AC21: Test 2D Scoring with Various Inputs
  // ============================================================================

  describe("2D Scoring (AC21)", () => {
    it("should calculate correct score for L=1, I=1 (minimum)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        1, // L=1
        1  // I=1
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 1 * 1 = 1, maxPossible = 5 * 5 = 25
      // normalizedScore = (1/25) * 25 = 1
      expect(score.normalizedScore).toBe(1);
      expect(score.label).toBe("Low");
      expect(score.color).toBe("#22c55e");
    });

    it("should calculate correct score for L=5, I=5 (maximum)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        5, // L=5
        5  // I=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 5 * 5 = 25, maxPossible = 25
      // normalizedScore = (25/25) * 25 = 25
      expect(score.normalizedScore).toBe(25);
      expect(score.label).toBe("Critical");
      expect(score.color).toBe("#ef4444");
    });

    it("should calculate correct score for L=3, I=4 (middle range)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3, // L=3
        4  // I=4
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 3 * 4 = 12, maxPossible = 25
      // normalizedScore = (12/25) * 25 = 12
      expect(score.normalizedScore).toBe(12);
      // Threshold Medium is [5, 12), so 12 falls into High [12, 19)
      expect(score.label).toBe("High");
      expect(score.color).toBe("#f97316");
    });

    it("should calculate correct score for L=4, I=5 (high range)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        4, // L=4
        5  // I=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 4 * 5 = 20, maxPossible = 25
      // normalizedScore = (20/25) * 25 = 20
      expect(score.normalizedScore).toBe(20);
      expect(score.label).toBe("Critical"); // 19 <= 20 < 25
      expect(score.color).toBe("#ef4444");
    });
  });

  // ============================================================================
  // AC22: Test 3D Scoring with Exposure
  // ============================================================================

  describe("3D Scoring with Exposure (AC22)", () => {
    it("should calculate correct score for 3D matrix L=5, I=4, E=3", () => {
      const result = calculateInherentScore(
        scales3D,
        thresholds3D,
        outputScaleMax100,
        5, // L=5
        4, // I=4
        3  // E=3
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 5 * 4 * 3 = 60, maxPossible = 5 * 5 * 5 = 125
      // normalizedScore = (60/125) * 100 = 48
      expect(score.normalizedScore).toBe(48);
      expect(score.label).toBe("Medium"); // 25 <= 48 < 50
      expect(score.color).toBe("#eab308");
    });

    it("should calculate correct score for 3D maximum values", () => {
      const result = calculateInherentScore(
        scales3D,
        thresholds3D,
        outputScaleMax100,
        5, // L=5
        5, // I=5
        5  // E=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 5 * 5 * 5 = 125, maxPossible = 125
      // normalizedScore = (125/125) * 100 = 100
      expect(score.normalizedScore).toBe(100);
      expect(score.label).toBe("Critical"); // At max, uses last threshold
    });

    it("should return incomplete when exposure is required but not provided", () => {
      const result = calculateInherentScore(
        scales3D,
        thresholds3D,
        outputScaleMax100,
        5, // L=5
        5, // I=5
        null // E=null (required for 3D)
      );

      expect(isIncompleteScore(result)).toBe(true);
      const incomplete = result as IncompleteScore;
      expect(incomplete.reason).toBe("Exposure not selected");
    });
  });

  // ============================================================================
  // AC23: Test Edge Cases (Min Values, Max Values, Boundaries)
  // ============================================================================

  describe("Edge Cases (AC23)", () => {
    it("should return incomplete when likelihood is null", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        null, // L=null
        3     // I=3
      );

      expect(isIncompleteScore(result)).toBe(true);
      const incomplete = result as IncompleteScore;
      expect(incomplete.reason).toBe("Likelihood not selected");
    });

    it("should return incomplete when impact is null", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3,    // L=3
        null  // I=null
      );

      expect(isIncompleteScore(result)).toBe(true);
      const incomplete = result as IncompleteScore;
      expect(incomplete.reason).toBe("Impact not selected");
    });

    it("should return incomplete when likelihood is undefined", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        undefined, // L=undefined
        3          // I=3
      );

      expect(isIncompleteScore(result)).toBe(true);
    });

    it("should handle score exactly at threshold boundary (minValue)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        1, // L=1
        5  // I=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 1 * 5 = 5, normalizedScore = 5
      expect(score.normalizedScore).toBe(5);
      // 5 is >= 5 minValue of Medium threshold, so it's Medium
      expect(score.label).toBe("Medium");
    });

    it("should handle score at exact maxValue (uses last threshold)", () => {
      // Create thresholds where max score could fall exactly at boundary
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        5, // L=5
        5  // I=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(25); // At max
      expect(score.label).toBe("Critical"); // Last threshold
    });

    it("should handle 2D matrix without exposure parameter", () => {
      // 2D matrix - exposure parameter is omitted entirely
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3,
        3
        // No exposure parameter
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(9);
    });

    it("should handle 2D matrix with explicit undefined exposure", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3,
        3,
        undefined // Explicit undefined for 2D matrix
      );

      expect(isScoreResult(result)).toBe(true);
    });
  });

  // ============================================================================
  // AC24: Test Threshold Label Matching
  // ============================================================================

  describe("Threshold Label Matching (AC24)", () => {
    it("should match Low threshold for score in range [0, 5)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        1, // L=1
        2  // I=2
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(2);
      expect(score.label).toBe("Low");
      expect(score.color).toBe("#22c55e");
    });

    it("should match Medium threshold for score in range [5, 12)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        2, // L=2
        3  // I=3
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(6);
      expect(score.label).toBe("Medium");
      expect(score.color).toBe("#eab308");
    });

    it("should match High threshold for score in range [12, 19)", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3, // L=3
        5  // I=5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(15);
      expect(score.label).toBe("High");
      expect(score.color).toBe("#f97316");
    });

    it("should match Critical threshold for score in range [19, 25]", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        5, // L=5
        4  // I=4
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(20);
      expect(score.label).toBe("Critical");
      expect(score.color).toBe("#ef4444");
    });

    it("should handle unsorted thresholds correctly", () => {
      // Thresholds in wrong order - should still work
      const unsortedThresholds: Threshold[] = [
        { sortOrder: 4, label: "Critical", minValue: 19, maxValue: 25, color: "#ef4444" },
        { sortOrder: 1, label: "Low", minValue: 0, maxValue: 5, color: "#22c55e" },
        { sortOrder: 3, label: "High", minValue: 12, maxValue: 19, color: "#f97316" },
        { sortOrder: 2, label: "Medium", minValue: 5, maxValue: 12, color: "#eab308" },
      ];

      const result = calculateInherentScore(
        standard5x5Scales,
        unsortedThresholds,
        outputScaleMax25,
        2, // L=2
        4  // I=4
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      expect(score.normalizedScore).toBe(8);
      expect(score.label).toBe("Medium"); // Should still correctly match
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe("Helper Functions", () => {
    it("calculateRawScore should compute 2D raw score", () => {
      const raw = calculateRawScore(3, 4);
      expect(raw).toBe(12);
    });

    it("calculateRawScore should compute 3D raw score", () => {
      const raw = calculateRawScore(3, 4, 2);
      expect(raw).toBe(24);
    });

    it("getMinValue should return minimum value from levels", () => {
      const min = getMinValue(standard5x5Scales.likelihood);
      expect(min).toBe(1);
    });

    it("getMinValue should handle empty array", () => {
      const min = getMinValue([]);
      expect(min).toBe(1); // Fallback
    });

    it("getThresholdBoundaries should return sorted boundaries", () => {
      const boundaries = getThresholdBoundaries(standard5x5Thresholds);
      expect(boundaries).toHaveLength(4);
      expect(boundaries[0]).toEqual({
        min: 0,
        max: 5,
        label: "Low",
        color: "#22c55e",
      });
      expect(boundaries[3]).toEqual({
        min: 19,
        max: 25,
        label: "Critical",
        color: "#ef4444",
      });
    });
  });

  // ============================================================================
  // Type Guard Tests
  // ============================================================================

  describe("Type Guards", () => {
    it("isScoreResult should return true for valid score", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3,
        3
      );
      expect(isScoreResult(result)).toBe(true);
      expect(isIncompleteScore(result)).toBe(false);
    });

    it("isIncompleteScore should return true for incomplete score", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        null,
        3
      );
      expect(isIncompleteScore(result)).toBe(true);
      expect(isScoreResult(result)).toBe(false);
    });
  });

  // ============================================================================
  // Decimal Precision Tests
  // ============================================================================

  describe("Decimal Precision (AC4)", () => {
    it("should return score string with 4 decimal places", () => {
      const result = calculateInherentScore(
        standard5x5Scales,
        standard5x5Thresholds,
        outputScaleMax25,
        3, // L=3
        4  // I=4
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // scoreString should have 4 decimal places
      expect(score.scoreString).toBe("12.0000");
      expect(score.normalizedScore).toBe(12);
    });

    it("should handle fractional scale values correctly", () => {
      // Custom scales with non-integer values
      const fractionalScales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Low" },
          { value: 2.5, label: "Medium" },
          { value: 4, label: "High" },
        ],
        impact: [
          { value: 1, label: "Minor" },
          { value: 2.5, label: "Moderate" },
          { value: 4, label: "Major" },
        ],
      };

      const result = calculateInherentScore(
        fractionalScales,
        standard5x5Thresholds,
        outputScaleMax25,
        2.5, // L=2.5
        2.5  // I=2.5
      );

      expect(isScoreResult(result)).toBe(true);
      const score = result as ScoreResult;
      // rawScore = 2.5 * 2.5 = 6.25, maxPossible = 4 * 4 = 16
      // normalizedScore = (6.25/16) * 25 = 9.765625
      expect(score.normalizedScore).toBeCloseTo(9.7656, 3);
    });
  });
});
