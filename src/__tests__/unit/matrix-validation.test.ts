/**
 * Matrix Validation Unit Tests
 *
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle (AC9-AC18)
 * Story 11.1: Risk Matrix Data Model & tRPC Router (gridSize, slaDays)
 *
 * Tests for scale and threshold validation logic.
 */

import {
  validateScales,
  validateScaleArray,
  validateThresholds,
  validateMatrixVersion,
  calculateMaxScore,
  getThresholdForScore,
  validateGridSize,
  validateThresholdSlaDays,
} from "@/lib/matrix/validation";
import type { MatrixScales, ScaleLevel, Threshold } from "@/lib/matrix/types";

describe("Scale Validation", () => {
  // AC9: Each scale level has value, label, description
  describe("validateScaleArray", () => {
    it("should accept valid scale with 3-10 levels", () => {
      const validScale: ScaleLevel[] = [
        { value: 1, label: "Low", description: "Low risk" },
        { value: 2, label: "Medium" },
        { value: 3, label: "High" },
      ];

      const result = validateScaleArray(validScale, "Test");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject scale with less than 3 levels", () => {
      const invalidScale: ScaleLevel[] = [
        { value: 1, label: "Low" },
        { value: 2, label: "High" },
      ];

      const result = validateScaleArray(invalidScale, "Test");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Test scale must have at least 3 levels");
    });

    it("should reject scale with more than 10 levels", () => {
      const invalidScale: ScaleLevel[] = Array.from({ length: 11 }, (_, i) => ({
        value: i + 1,
        label: `Level ${i + 1}`,
      }));

      const result = validateScaleArray(invalidScale, "Test");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Test scale cannot exceed 10 levels");
    });

    // AC13: Scale values must be positive and unique
    it("should reject scale with non-positive values", () => {
      const invalidScale: ScaleLevel[] = [
        { value: 0, label: "Zero" },
        { value: 1, label: "One" },
        { value: 2, label: "Two" },
      ];

      const result = validateScaleArray(invalidScale, "Test");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Test scale has non-positive values");
    });

    it("should reject scale with duplicate values", () => {
      const invalidScale: ScaleLevel[] = [
        { value: 1, label: "Low" },
        { value: 1, label: "Also Low" },
        { value: 2, label: "High" },
      ];

      const result = validateScaleArray(invalidScale, "Test");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Test scale has duplicate values");
    });

    it("should reject scale with empty labels", () => {
      const invalidScale: ScaleLevel[] = [
        { value: 1, label: "" },
        { value: 2, label: "Medium" },
        { value: 3, label: "High" },
      ];

      const result = validateScaleArray(invalidScale, "Test");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Test scale has empty labels");
    });
  });

  describe("validateScales", () => {
    // AC10: Likelihood scale required with 3-10 levels
    it("should require likelihood scale", () => {
      const scales = {
        likelihood: [],
        impact: [
          { value: 1, label: "Low" },
          { value: 2, label: "Medium" },
          { value: 3, label: "High" },
        ],
      } as unknown as MatrixScales;

      const result = validateScales(scales, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Likelihood"))).toBe(true);
    });

    // AC11: Impact scale required with 3-10 levels
    it("should require impact scale", () => {
      const scales = {
        likelihood: [
          { value: 1, label: "Rare" },
          { value: 2, label: "Possible" },
          { value: 3, label: "Likely" },
        ],
        impact: [],
      } as unknown as MatrixScales;

      const result = validateScales(scales, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Impact"))).toBe(true);
    });

    // AC12: Exposure scale required only for 3D matrices
    it("should require exposure scale for 3D matrix", () => {
      const scales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Rare" },
          { value: 2, label: "Possible" },
          { value: 3, label: "Likely" },
        ],
        impact: [
          { value: 1, label: "Low" },
          { value: 2, label: "Medium" },
          { value: 3, label: "High" },
        ],
        // Missing exposure
      };

      const result = validateScales(scales, 3);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Exposure scale is required for 3D matrices");
    });

    it("should not require exposure scale for 2D matrix", () => {
      const scales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Rare" },
          { value: 2, label: "Possible" },
          { value: 3, label: "Likely" },
        ],
        impact: [
          { value: 1, label: "Low" },
          { value: 2, label: "Medium" },
          { value: 3, label: "High" },
        ],
      };

      const result = validateScales(scales, 2);
      expect(result.valid).toBe(true);
    });

    it("should accept valid 3D matrix with exposure scale", () => {
      const scales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Rare" },
          { value: 2, label: "Possible" },
          { value: 3, label: "Likely" },
        ],
        impact: [
          { value: 1, label: "Low" },
          { value: 2, label: "Medium" },
          { value: 3, label: "High" },
        ],
        exposure: [
          { value: 1, label: "Limited" },
          { value: 2, label: "Moderate" },
          { value: 3, label: "Extensive" },
        ],
      };

      const result = validateScales(scales, 3);
      expect(result.valid).toBe(true);
    });
  });
});

describe("Threshold Validation", () => {
  // AC14-AC18: Threshold structure and coverage
  describe("validateThresholds", () => {
    it("should accept valid threshold coverage", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 5, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 5, maxValue: 15, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
        { minValue: 15, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 2, slaDays: 7 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should require at least one threshold", () => {
      const result = validateThresholds([], 25);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one threshold is required");
    });

    // AC16: First threshold must start at 0
    it("should require first threshold to start at 0", () => {
      const thresholds: Threshold[] = [
        { minValue: 1, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 10, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("First threshold must start at 0");
    });

    // AC17: Last threshold must end at outputScaleMax
    it("should require last threshold to end at outputScaleMax", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 10, maxValue: 20, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Last threshold must end at 25");
    });

    // AC18: Threshold ranges must not overlap
    it("should detect overlapping thresholds", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 8, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("overlap"))).toBe(true);
    });

    // AC15: No gaps in threshold coverage
    it("should detect gaps in threshold coverage", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 15, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Gap"))).toBe(true);
    });

    it("should reject invalid hex color format", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 25, label: "All", color: "red", sortOrder: 0, slaDays: 30 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("All threshold colors must be valid hex format (#RRGGBB)");
    });

    it("should reject threshold with invalid range", () => {
      const thresholds: Threshold[] = [
        { minValue: 10, maxValue: 5, label: "Invalid", color: "#FF0000", sortOrder: 0, slaDays: 30 },
        { minValue: 5, maxValue: 25, label: "Valid", color: "#00FF00", sortOrder: 1, slaDays: 30 },
      ];

      const result = validateThresholds(thresholds, 25);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("invalid range"))).toBe(true);
    });
  });
});

describe("Combined Validation", () => {
  describe("validateMatrixVersion", () => {
    const validScales: MatrixScales = {
      likelihood: [
        { value: 1, label: "Rare" },
        { value: 2, label: "Possible" },
        { value: 3, label: "Likely" },
        { value: 4, label: "Almost Certain" },
        { value: 5, label: "Certain" },
      ],
      impact: [
        { value: 1, label: "Negligible" },
        { value: 2, label: "Minor" },
        { value: 3, label: "Moderate" },
        { value: 4, label: "Major" },
        { value: 5, label: "Severe" },
      ],
    };

    const validThresholds: Threshold[] = [
      { minValue: 0, maxValue: 4, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
      { minValue: 4, maxValue: 9, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
      { minValue: 9, maxValue: 16, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
      { minValue: 16, maxValue: 25, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
    ];

    it("should accept valid 2D matrix", () => {
      const result = validateMatrixVersion(validScales, validThresholds, 2, 25);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should combine scale and threshold errors", () => {
      const invalidScales: MatrixScales = {
        likelihood: [{ value: 1, label: "Only one" }],
        impact: [],
      } as unknown as MatrixScales;

      const invalidThresholds: Threshold[] = [
        { minValue: 5, maxValue: 10, label: "Invalid", color: "#FF0000", sortOrder: 0, slaDays: 30 },
      ];

      const result = validateMatrixVersion(invalidScales, invalidThresholds, 2, 25);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    // Story 11.1: Test gridSize validation in combined validation
    it("should validate gridSize when provided", () => {
      const result = validateMatrixVersion(validScales, validThresholds, 2, 25, 5);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when gridSize doesn't match scale levels", () => {
      // 5 levels in scales, but gridSize is 3
      const result = validateMatrixVersion(validScales, validThresholds, 2, 25, 3);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("gridSize"))).toBe(true);
    });
  });
});

// Story 11.1: GridSize Validation Tests
describe("GridSize Validation", () => {
  describe("validateGridSize", () => {
    const scales3x3: MatrixScales = {
      likelihood: [
        { value: 1, label: "Low" },
        { value: 2, label: "Medium" },
        { value: 3, label: "High" },
      ],
      impact: [
        { value: 1, label: "Low" },
        { value: 2, label: "Medium" },
        { value: 3, label: "High" },
      ],
    };

    const scales5x5: MatrixScales = {
      likelihood: [
        { value: 1, label: "Rare" },
        { value: 2, label: "Unlikely" },
        { value: 3, label: "Possible" },
        { value: 4, label: "Likely" },
        { value: 5, label: "Certain" },
      ],
      impact: [
        { value: 1, label: "Negligible" },
        { value: 2, label: "Minor" },
        { value: 3, label: "Moderate" },
        { value: 4, label: "Major" },
        { value: 5, label: "Severe" },
      ],
    };

    it("should accept gridSize 3 with 3x3 scales", () => {
      const result = validateGridSize(scales3x3, 3);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept gridSize 5 with 5x5 scales", () => {
      const result = validateGridSize(scales5x5, 5);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject gridSize less than 3", () => {
      const result = validateGridSize(scales3x3, 2);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Grid size must be 3, 4, or 5 (got 2)");
    });

    it("should reject gridSize greater than 5", () => {
      const result = validateGridSize(scales5x5, 6);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Grid size must be 3, 4, or 5 (got 6)");
    });

    it("should reject mismatched likelihood scale levels", () => {
      const result = validateGridSize(scales5x5, 3);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Likelihood scale has 5 levels but gridSize is 3");
    });

    it("should reject mismatched impact scale levels", () => {
      const result = validateGridSize(scales5x5, 3);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Impact scale has 5 levels but gridSize is 3");
    });

    it("should validate exposure scale for 3D matrices", () => {
      const scales3D: MatrixScales = {
        ...scales3x3,
        exposure: [
          { value: 1, label: "Low" },
          { value: 2, label: "Medium" },
          { value: 3, label: "High" },
          { value: 4, label: "Very High" }, // 4 levels, doesn't match gridSize 3
        ],
      };

      const result = validateGridSize(scales3D, 3);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Exposure scale has 4 levels but gridSize is 3");
    });
  });
});

// Story 11.1: SLA Days Validation Tests
describe("SLA Days Validation", () => {
  describe("validateThresholdSlaDays", () => {
    it("should accept thresholds with valid slaDays", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 10, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholdSlaDays(thresholds);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject threshold with missing slaDays", () => {
      const thresholds = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0 },
        { minValue: 10, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ] as Threshold[];

      const result = validateThresholdSlaDays(thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold "Low" is missing slaDays');
    });

    it("should reject threshold with zero slaDays", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 0 },
        { minValue: 10, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholdSlaDays(thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold "Low" has invalid slaDays: 0 (must be positive)');
    });

    it("should reject threshold with negative slaDays", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: -5 },
        { minValue: 10, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = validateThresholdSlaDays(thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold "Low" has invalid slaDays: -5 (must be positive)');
    });

    it("should report all invalid slaDays in thresholds", () => {
      const thresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 0 },
        { minValue: 10, maxValue: 20, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: -1 },
        { minValue: 20, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 2, slaDays: 7 },
      ];

      const result = validateThresholdSlaDays(thresholds);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
});

describe("Score Utilities", () => {
  describe("calculateMaxScore", () => {
    it("should calculate max score for 2D matrix", () => {
      const scales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Low" },
          { value: 3, label: "Medium" },
          { value: 5, label: "High" },
        ],
        impact: [
          { value: 1, label: "Low" },
          { value: 3, label: "Medium" },
          { value: 5, label: "High" },
        ],
      };

      expect(calculateMaxScore(scales)).toBe(25); // 5 * 5
    });

    it("should calculate max score for 3D matrix", () => {
      const scales: MatrixScales = {
        likelihood: [
          { value: 1, label: "Low" },
          { value: 5, label: "High" },
        ],
        impact: [
          { value: 1, label: "Low" },
          { value: 5, label: "High" },
        ],
        exposure: [
          { value: 1, label: "Limited" },
          { value: 3, label: "Extensive" },
        ],
      };

      expect(calculateMaxScore(scales)).toBe(75); // 5 * 5 * 3
    });
  });

  describe("getThresholdForScore", () => {
    const thresholds: Threshold[] = [
      { minValue: 0, maxValue: 4.99, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
      { minValue: 5, maxValue: 14.99, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
      { minValue: 15, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 2, slaDays: 7 },
    ];

    it("should return correct threshold for score", () => {
      expect(getThresholdForScore(0, thresholds)?.label).toBe("Low");
      expect(getThresholdForScore(4.9, thresholds)?.label).toBe("Low");
      expect(getThresholdForScore(5, thresholds)?.label).toBe("Medium");
      expect(getThresholdForScore(14.9, thresholds)?.label).toBe("Medium");
      expect(getThresholdForScore(15, thresholds)?.label).toBe("High");
      expect(getThresholdForScore(24.9, thresholds)?.label).toBe("High");
    });

    it("should return last threshold for max score", () => {
      expect(getThresholdForScore(25, thresholds)?.label).toBe("High");
    });

    it("should return null for out-of-range scores", () => {
      expect(getThresholdForScore(-1, thresholds)).toBeNull();
      expect(getThresholdForScore(26, thresholds)).toBeNull();
    });

    // Story 11.1: Test that slaDays is returned with threshold
    it("should return slaDays with threshold", () => {
      const lowThreshold = getThresholdForScore(2, thresholds);
      expect(lowThreshold?.slaDays).toBe(90);

      const mediumThreshold = getThresholdForScore(10, thresholds);
      expect(mediumThreshold?.slaDays).toBe(30);

      const highThreshold = getThresholdForScore(20, thresholds);
      expect(highThreshold?.slaDays).toBe(7);
    });
  });
});
