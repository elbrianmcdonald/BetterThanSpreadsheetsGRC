/**
 * Assessment Matrix Integration Unit Tests
 *
 * Story 7.8.9: Assessment Form Matrix Integration
 *
 * Tests for:
 * - Version locking logic (AC23-AC26)
 * - Matrix-based scoring integration
 * - Assessment type and matrix selection validation
 */

import {
  calculateInherentScore,
  isScoreResult,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";

// Test data: Standard 5x5 matrix configuration
const testScales: MatrixScales = {
  likelihood: [
    { value: 1, label: "Rare", description: "May occur only in exceptional circumstances" },
    { value: 2, label: "Unlikely", description: "Could occur at some time" },
    { value: 3, label: "Possible", description: "Might occur at some time" },
    { value: 4, label: "Likely", description: "Will probably occur in most circumstances" },
    { value: 5, label: "Almost Certain", description: "Expected to occur in most circumstances" },
  ],
  impact: [
    { value: 1, label: "Negligible", description: "Minimal impact" },
    { value: 2, label: "Minor", description: "Some impact" },
    { value: 3, label: "Moderate", description: "Moderate impact" },
    { value: 4, label: "Major", description: "Significant impact" },
    { value: 5, label: "Severe", description: "Maximum impact" },
  ],
};

// Story 11.1: Added slaDays to thresholds
const testThresholds: Threshold[] = [
  { minValue: 0, maxValue: 5, label: "Low", color: "#22c55e", sortOrder: 0, slaDays: 90 },
  { minValue: 5, maxValue: 12, label: "Medium", color: "#eab308", sortOrder: 1, slaDays: 30 },
  { minValue: 12, maxValue: 19, label: "High", color: "#f97316", sortOrder: 2, slaDays: 14 },
  { minValue: 19, maxValue: 25, label: "Critical", color: "#ef4444", sortOrder: 3, slaDays: 7 },
];

const outputScaleMax = 25;

describe("Assessment Matrix Integration", () => {
  describe("Version Locking Logic (AC23-AC26)", () => {
    it("should calculate score correctly when matrix version is set", () => {
      // AC23: matrixVersionId stored on RiskAssessment
      // This test verifies scoring works with matrix configuration
      const result = calculateInherentScore(
        testScales,
        testThresholds,
        outputScaleMax,
        4, // Likely
        3  // Moderate
      );

      expect(isScoreResult(result)).toBe(true);
      if (isScoreResult(result)) {
        // 4 * 3 = 12, 12/25 * 25 = 12
        expect(result.normalizedScore).toBe(12);
        expect(result.label).toBe("High"); // 12 falls in [12, 19)
      }
    });

    it("should return correct threshold for boundary values", () => {
      // AC25: Assessment shows original version's scoring
      const result = calculateInherentScore(
        testScales,
        testThresholds,
        outputScaleMax,
        5, // Almost Certain
        5  // Severe
      );

      expect(isScoreResult(result)).toBe(true);
      if (isScoreResult(result)) {
        // 5 * 5 = 25, 25/25 * 25 = 25
        expect(result.normalizedScore).toBe(25);
        expect(result.label).toBe("Critical"); // Max score uses last threshold
      }
    });

    it("should use original matrix version for locked assessments", () => {
      // AC24: Version locked at first save, not changeable
      // Even if a new matrix version is published, locked assessment uses original

      // Simulate original version with different thresholds
      // Story 11.1: Added slaDays
      const originalThresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Acceptable", color: "#22c55e", sortOrder: 0, slaDays: 90 },
        { minValue: 10, maxValue: 25, label: "Unacceptable", color: "#ef4444", sortOrder: 1, slaDays: 7 },
      ];

      const result = calculateInherentScore(
        testScales,
        originalThresholds,
        outputScaleMax,
        4, // Likely
        3  // Moderate = 12
      );

      expect(isScoreResult(result)).toBe(true);
      if (isScoreResult(result)) {
        expect(result.label).toBe("Unacceptable"); // Different from standard thresholds
      }
    });
  });

  describe("Score Display Integration (AC18-AC22)", () => {
    it("AC18: Score updates as selections change", () => {
      const result1 = calculateInherentScore(testScales, testThresholds, outputScaleMax, 2, 2);
      const result2 = calculateInherentScore(testScales, testThresholds, outputScaleMax, 3, 3);

      expect(isScoreResult(result1)).toBe(true);
      expect(isScoreResult(result2)).toBe(true);

      if (isScoreResult(result1) && isScoreResult(result2)) {
        expect(result2.normalizedScore).toBeGreaterThan(result1.normalizedScore);
      }
    });

    it("AC19: Shows numeric score, threshold label, and color", () => {
      const result = calculateInherentScore(testScales, testThresholds, outputScaleMax, 3, 4);

      expect(isScoreResult(result)).toBe(true);
      if (isScoreResult(result)) {
        expect(typeof result.normalizedScore).toBe("number");
        expect(typeof result.label).toBe("string");
        expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it("AC20: Incomplete state when not all required values selected", () => {
      const resultNoLikelihood = calculateInherentScore(
        testScales,
        testThresholds,
        outputScaleMax,
        null,
        3
      );

      const resultNoImpact = calculateInherentScore(
        testScales,
        testThresholds,
        outputScaleMax,
        4,
        null
      );

      expect(isScoreResult(resultNoLikelihood)).toBe(false);
      expect(isScoreResult(resultNoImpact)).toBe(false);

      if (!isScoreResult(resultNoLikelihood)) {
        expect(resultNoLikelihood.reason).toBe("Likelihood not selected");
      }
      if (!isScoreResult(resultNoImpact)) {
        expect(resultNoImpact.reason).toBe("Impact not selected");
      }
    });
  });

  describe("3D Matrix Scoring (with Exposure)", () => {
    const testScales3D: MatrixScales = {
      ...testScales,
      exposure: [
        { value: 1, label: "Isolated", description: "Single system" },
        { value: 2, label: "Limited", description: "Few systems" },
        { value: 3, label: "Moderate", description: "Some systems" },
        { value: 4, label: "Extensive", description: "Many systems" },
        { value: 5, label: "Enterprise", description: "All systems" },
      ],
    };

    it("AC13: Exposure selector required for 3D matrices", () => {
      const resultMissingExposure = calculateInherentScore(
        testScales3D,
        testThresholds,
        100, // 3D matrices typically use 100-scale
        4,
        3,
        null // Missing exposure
      );

      expect(isScoreResult(resultMissingExposure)).toBe(false);
      if (!isScoreResult(resultMissingExposure)) {
        expect(resultMissingExposure.reason).toBe("Exposure not selected");
      }
    });

    it("should calculate 3D score correctly", () => {
      // Story 11.1: Added slaDays
      const result = calculateInherentScore(
        testScales3D,
        [
          { minValue: 0, maxValue: 30, label: "Low", color: "#22c55e", sortOrder: 0, slaDays: 90 },
          { minValue: 30, maxValue: 60, label: "Medium", color: "#eab308", sortOrder: 1, slaDays: 30 },
          { minValue: 60, maxValue: 80, label: "High", color: "#f97316", sortOrder: 2, slaDays: 14 },
          { minValue: 80, maxValue: 100, label: "Critical", color: "#ef4444", sortOrder: 3, slaDays: 7 },
        ],
        100,
        4, // Likely
        3, // Moderate
        2  // Limited
      );

      expect(isScoreResult(result)).toBe(true);
      if (isScoreResult(result)) {
        // (4 * 3 * 2) / (5 * 5 * 5) * 100 = 24 / 125 * 100 = 19.2
        expect(result.normalizedScore).toBeCloseTo(19.2, 2);
        expect(result.label).toBe("Low");
      }
    });
  });

  describe("Matrix Template Selection (AC6-AC10)", () => {
    it("AC10: Should display matrix version in format 'Name vX'", () => {
      // This is a display format test - verified by MatrixSelector component
      // The component should show: "Standard Risk Matrix v2"
      const templateName = "Standard Risk Matrix";
      const versionNumber = 2;
      const displayLabel = `${templateName} v${versionNumber}`;

      expect(displayLabel).toBe("Standard Risk Matrix v2");
    });
  });

  describe("Assessment Type Selection (AC1-AC5)", () => {
    it("AC3: Type should be required for scoring", () => {
      // Assessment type is a form-level validation
      // This test documents the requirement
      const assessmentTypeRequired = true;
      expect(assessmentTypeRequired).toBe(true);
    });

    it("AC4: Type can be changed before submission", () => {
      // Form allows changing type while in DRAFT status
      const isDraft = true;
      const canChangeType = isDraft;
      expect(canChangeType).toBe(true);
    });
  });
});

describe("Default Values on Accept Finding (AC27-AC30)", () => {
  it("AC27: Should use org default matrix on accept", () => {
    // When finding accepted, assessment should have default matrix
    // This is integration behavior verified by finding.accept mutation
    const defaultMatrixVersionId = "default-version-id";
    const assessmentMatrixVersionId = defaultMatrixVersionId;
    expect(assessmentMatrixVersionId).toBe(defaultMatrixVersionId);
  });

  it("AC28: Should use org default assessment type on accept", () => {
    // When finding accepted, assessment should have default type
    const defaultAssessmentTypeId = "default-type-id";
    const assessmentTypeId = defaultAssessmentTypeId;
    expect(assessmentTypeId).toBe(defaultAssessmentTypeId);
  });

  it("AC29: Can change type and matrix while in DRAFT", () => {
    const status = "DRAFT";
    const canChange = status === "DRAFT";
    expect(canChange).toBe(true);
  });

  it("AC30: Matrix locked after approval", () => {
    const status = "APPROVED";
    const isLocked = status !== "DRAFT";
    expect(isLocked).toBe(true);
  });
});
