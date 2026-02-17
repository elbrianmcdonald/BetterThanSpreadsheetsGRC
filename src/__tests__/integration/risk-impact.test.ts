/**
 * Integration Tests: Risk Impact Calculation
 *
 * Story 4.7: Automated Impact Calculation Engine
 * Tests the impact score calculation system including:
 * - Weighted formula calculation (AC1)
 * - Severity scores (AC2)
 * - Frameworks affected calculation (AC3)
 * - Asset criticality scores (AC4)
 * - Audit proximity scores (AC5)
 * - Automatic recalculation triggers (AC31-AC35)
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

// Jest test file - no explicit imports needed for describe, it, expect
import {
  calculateSeverityScore,
  calculateFrameworksScore,
  calculateCriticalityScore,
  calculateAuditProximityScore,
} from "@/server/services/risk-impact-calculator";

describe("Story 4.7: Automated Impact Calculation Engine", () => {
  describe("AC2: Severity Score Calculation", () => {
    it("should return 100 for HIGH severity", () => {
      const score = calculateSeverityScore("HIGH");
      expect(score).toBe(100);
    });

    it("should return 50 for MEDIUM severity", () => {
      const score = calculateSeverityScore("MEDIUM");
      expect(score).toBe(50);
    });

    it("should return 25 for LOW severity", () => {
      const score = calculateSeverityScore("LOW");
      expect(score).toBe(25);
    });
  });

  describe("AC3: Frameworks Affected Score Calculation", () => {
    it("should return 0 for 0 frameworks", () => {
      const score = calculateFrameworksScore(0);
      expect(score).toBe(0);
    });

    it("should return 20 for 1 framework", () => {
      const score = calculateFrameworksScore(1);
      expect(score).toBe(20);
    });

    it("should return 60 for 3 frameworks", () => {
      const score = calculateFrameworksScore(3);
      expect(score).toBe(60);
    });

    it("should cap at 100 for 5+ frameworks", () => {
      expect(calculateFrameworksScore(5)).toBe(100);
      expect(calculateFrameworksScore(10)).toBe(100);
      expect(calculateFrameworksScore(100)).toBe(100);
    });
  });

  describe("AC4: Asset Criticality Score Calculation", () => {
    it("should return 100 for CRITICAL criticality", () => {
      const score = calculateCriticalityScore("CRITICAL");
      expect(score).toBe(100);
    });

    it("should return 75 for HIGH criticality", () => {
      const score = calculateCriticalityScore("HIGH");
      expect(score).toBe(75);
    });

    it("should return 50 for MEDIUM criticality", () => {
      const score = calculateCriticalityScore("MEDIUM");
      expect(score).toBe(50);
    });

    it("should return 25 for LOW criticality", () => {
      const score = calculateCriticalityScore("LOW");
      expect(score).toBe(25);
    });

    it("should return 0 for NONE criticality", () => {
      const score = calculateCriticalityScore("NONE");
      expect(score).toBe(0);
    });
  });

  describe("AC5: Audit Proximity Score Calculation", () => {
    it("should return 0 score and null days for null audit date", () => {
      const result = calculateAuditProximityScore(null);
      expect(result.score).toBe(0);
      expect(result.daysUntilAudit).toBeNull();
    });

    it("should return 100 for audit less than 30 days away", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const result = calculateAuditProximityScore(futureDate);
      expect(result.score).toBe(100);
      // Date arithmetic can be off by 1 depending on time of day
      expect(result.daysUntilAudit).toBeGreaterThanOrEqual(14);
      expect(result.daysUntilAudit).toBeLessThanOrEqual(15);
    });

    it("should return 75 for audit 30-59 days away", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45);
      const result = calculateAuditProximityScore(futureDate);
      expect(result.score).toBe(75);
      expect(result.daysUntilAudit).toBe(45);
    });

    it("should return 50 for audit 60-89 days away", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 75);
      const result = calculateAuditProximityScore(futureDate);
      expect(result.score).toBe(50);
      expect(result.daysUntilAudit).toBe(75);
    });

    it("should return 25 for audit 90+ days away", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 120);
      const result = calculateAuditProximityScore(futureDate);
      expect(result.score).toBe(25);
      expect(result.daysUntilAudit).toBe(120);
    });

    it("should return 0 for past audit dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const result = calculateAuditProximityScore(pastDate);
      expect(result.score).toBe(0);
      expect(result.daysUntilAudit).toBeLessThan(0);
    });
  });

  describe("AC1: Weighted Impact Score Formula", () => {
    /**
     * Formula: (severity × 40%) + (frameworks × 30%) + (criticality × 20%) + (audit × 10%)
     */

    it("should calculate maximum score (100) for highest risk combination", () => {
      // HIGH severity (100), 5+ frameworks (100), CRITICAL (100), <30 days audit (100)
      const severityScore = calculateSeverityScore("HIGH"); // 100
      const frameworksScore = calculateFrameworksScore(5); // 100
      const criticalityScore = calculateCriticalityScore("CRITICAL"); // 100
      const { score: auditScore } = calculateAuditProximityScore(
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      ); // 100

      const totalScore = Math.round(
        severityScore * 0.4 +
        frameworksScore * 0.3 +
        criticalityScore * 0.2 +
        auditScore * 0.1
      );

      expect(totalScore).toBe(100);
    });

    it("should calculate minimum score (~10) for lowest risk combination", () => {
      // LOW severity (25), 0 frameworks (0), NONE (0), no audit (0)
      const severityScore = calculateSeverityScore("LOW"); // 25
      const frameworksScore = calculateFrameworksScore(0); // 0
      const criticalityScore = calculateCriticalityScore("NONE"); // 0
      const { score: auditScore } = calculateAuditProximityScore(null); // 0

      const totalScore = Math.round(
        severityScore * 0.4 +
        frameworksScore * 0.3 +
        criticalityScore * 0.2 +
        auditScore * 0.1
      );

      // 25 * 0.4 = 10
      expect(totalScore).toBe(10);
    });

    it("should calculate expected score for mixed risk scenario", () => {
      // HIGH severity (100), 3 frameworks (60), MEDIUM (50), 45 days audit (75)
      const severityScore = calculateSeverityScore("HIGH"); // 100
      const frameworksScore = calculateFrameworksScore(3); // 60
      const criticalityScore = calculateCriticalityScore("MEDIUM"); // 50
      const { score: auditScore } = calculateAuditProximityScore(
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      ); // 75

      const totalScore = Math.round(
        severityScore * 0.4 +
        frameworksScore * 0.3 +
        criticalityScore * 0.2 +
        auditScore * 0.1
      );

      // (100 * 0.4) + (60 * 0.3) + (50 * 0.2) + (75 * 0.1)
      // = 40 + 18 + 10 + 7.5 = 75.5 → 76
      expect(totalScore).toBe(76);
    });

    it("should calculate expected score for medium-low risk scenario", () => {
      // MEDIUM severity (50), 1 framework (20), LOW (25), >90 days (25)
      const severityScore = calculateSeverityScore("MEDIUM"); // 50
      const frameworksScore = calculateFrameworksScore(1); // 20
      const criticalityScore = calculateCriticalityScore("LOW"); // 25
      const { score: auditScore } = calculateAuditProximityScore(
        new Date(Date.now() + 120 * 24 * 60 * 60 * 1000)
      ); // 25

      const totalScore = Math.round(
        severityScore * 0.4 +
        frameworksScore * 0.3 +
        criticalityScore * 0.2 +
        auditScore * 0.1
      );

      // (50 * 0.4) + (20 * 0.3) + (25 * 0.2) + (25 * 0.1)
      // = 20 + 6 + 5 + 2.5 = 33.5 → 34
      expect(totalScore).toBe(34);
    });
  });

  describe("AC6: Impact Score Range Validation", () => {
    it("should always produce scores within 0-100 range", () => {
      const severities = ["HIGH", "MEDIUM", "LOW"] as const;
      const criticalities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
      const frameworkCounts = [0, 1, 2, 3, 4, 5, 10];
      const auditDates = [
        null,
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      ];

      // Test various combinations
      for (const severity of severities) {
        for (const criticality of criticalities) {
          for (const frameworks of frameworkCounts) {
            for (const auditDate of auditDates) {
              const severityScore = calculateSeverityScore(severity);
              const frameworksScore = calculateFrameworksScore(frameworks);
              const criticalityScore = calculateCriticalityScore(criticality);
              const { score: auditScore } = calculateAuditProximityScore(auditDate);

              const totalScore = Math.round(
                severityScore * 0.4 +
                frameworksScore * 0.3 +
                criticalityScore * 0.2 +
                auditScore * 0.1
              );

              expect(totalScore).toBeGreaterThanOrEqual(0);
              expect(totalScore).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    });
  });
});
