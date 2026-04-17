/**
 * Unit Tests for Assessment State Machine
 *
 * Tests the risk assessment state machine and approval gates functionality.
 *
 * **Critical Test Coverage:**
 * - State machine transition validation (AC20-AC23)
 * - Terminal state enforcement
 * - Approval gate checks (AC24-AC29)
 * - Error handling for invalid transitions
 *
 * @see Story 7.5: Risk Assessment Schema & State Machine
 */

import { AssessmentStatus, TreatmentType, Prisma } from "@prisma/client";
import {
  canTransitionAssessment,
  assertAssessmentTransition,
  isTerminalAssessmentStatus,
  getAvailableAssessmentTransitions,
  checkApprovalGates,
  assertApprovalGates,
  validateApprovalTransition,
  ASSESSMENT_TRANSITIONS,
  TERMINAL_ASSESSMENT_STATUSES,
  type AssessmentWithScenarios,
} from "@/server/services/assessmentStateMachine";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a mock assessment with scenarios for testing approval gates.
 */
function createMockAssessment(
  overrides: Partial<AssessmentWithScenarios> = {}
): AssessmentWithScenarios {
  return {
    id: "assessment-1",
    organizationId: "org-1",
    identifier: "RSK-2025-0001",
    title: "Test Assessment",
    context: "Test context",
    riskCategory: null,
    affectedSystems: [],
    likelihoodValue: new Prisma.Decimal(3),
    impactValue: new Prisma.Decimal(4),
    exposureValue: null,
    inherentScore: null,
    inherentScoreLabel: null,
    treatment: TreatmentType.MITIGATE,
    ownerId: "user-owner-1",
    status: AssessmentStatus.DRAFT,
    findingId: "finding-1",
    assessmentTypeId: null,
    matrixVersionId: null,
    createdBy: "user-creator-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedBy: null,
    approvedAt: null,
    scenarios: [{ id: "scenario-1" }],
    ...overrides,
  } as AssessmentWithScenarios;
}

// =============================================================================
// State Machine Tests (AC20-AC23)
// =============================================================================

describe("Assessment State Machine", () => {
  describe("ASSESSMENT_TRANSITIONS configuration", () => {
    it("should define transitions for all AssessmentStatus values", () => {
      const allStatuses = Object.values(AssessmentStatus);

      allStatuses.forEach((status) => {
        expect(ASSESSMENT_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(ASSESSMENT_TRANSITIONS[status])).toBe(true);
      });
    });

    it("should allow DRAFT to transition to APPROVED and REJECTED (AC21)", () => {
      const draftTransitions = ASSESSMENT_TRANSITIONS[AssessmentStatus.DRAFT];

      expect(draftTransitions).toContain(AssessmentStatus.APPROVED);
      expect(draftTransitions).toContain(AssessmentStatus.REJECTED);
      expect(draftTransitions).toHaveLength(2);
    });

    it("should define APPROVED as terminal state (AC22)", () => {
      expect(ASSESSMENT_TRANSITIONS[AssessmentStatus.APPROVED]).toHaveLength(0);
    });

    it("should define REJECTED as terminal state (AC22)", () => {
      expect(ASSESSMENT_TRANSITIONS[AssessmentStatus.REJECTED]).toHaveLength(0);
    });
  });

  describe("canTransitionAssessment (AC23)", () => {
    it("should return true for DRAFT → APPROVED", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.DRAFT, AssessmentStatus.APPROVED)
      ).toBe(true);
    });

    it("should return true for DRAFT → REJECTED", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.DRAFT, AssessmentStatus.REJECTED)
      ).toBe(true);
    });

    it("should return false for APPROVED → DRAFT (terminal)", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.APPROVED, AssessmentStatus.DRAFT)
      ).toBe(false);
    });

    it("should return false for APPROVED → REJECTED (terminal)", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.APPROVED, AssessmentStatus.REJECTED)
      ).toBe(false);
    });

    it("should return false for REJECTED → DRAFT (terminal)", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.REJECTED, AssessmentStatus.DRAFT)
      ).toBe(false);
    });

    it("should return false for REJECTED → APPROVED (terminal)", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.REJECTED, AssessmentStatus.APPROVED)
      ).toBe(false);
    });

    it("should return false for same-status transition", () => {
      expect(
        canTransitionAssessment(AssessmentStatus.DRAFT, AssessmentStatus.DRAFT)
      ).toBe(false);
    });
  });

  describe("assertAssessmentTransition", () => {
    it("should not throw for valid DRAFT → APPROVED transition", () => {
      expect(() =>
        assertAssessmentTransition(AssessmentStatus.DRAFT, AssessmentStatus.APPROVED)
      ).not.toThrow();
    });

    it("should not throw for valid DRAFT → REJECTED transition", () => {
      expect(() =>
        assertAssessmentTransition(AssessmentStatus.DRAFT, AssessmentStatus.REJECTED)
      ).not.toThrow();
    });

    it("should throw TRPCError for same-status transition", () => {
      expect(() =>
        assertAssessmentTransition(AssessmentStatus.DRAFT, AssessmentStatus.DRAFT)
      ).toThrow("Assessment is already in this status");
    });

    it("should throw TRPCError for invalid terminal → any transition", () => {
      expect(() =>
        assertAssessmentTransition(AssessmentStatus.APPROVED, AssessmentStatus.DRAFT)
      ).toThrow(/Cannot transition from APPROVED to DRAFT/);
    });

    it("should include allowed transitions in error message", () => {
      expect(() =>
        assertAssessmentTransition(AssessmentStatus.APPROVED, AssessmentStatus.DRAFT)
      ).toThrow(/Allowed: none/);
    });
  });

  describe("isTerminalAssessmentStatus", () => {
    it("should return true for APPROVED", () => {
      expect(isTerminalAssessmentStatus(AssessmentStatus.APPROVED)).toBe(true);
    });

    it("should return true for REJECTED", () => {
      expect(isTerminalAssessmentStatus(AssessmentStatus.REJECTED)).toBe(true);
    });

    it("should return false for DRAFT", () => {
      expect(isTerminalAssessmentStatus(AssessmentStatus.DRAFT)).toBe(false);
    });
  });

  describe("getAvailableAssessmentTransitions", () => {
    it("should return [APPROVED, REJECTED] for DRAFT status", () => {
      const transitions = getAvailableAssessmentTransitions(AssessmentStatus.DRAFT);

      expect(transitions).toContain(AssessmentStatus.APPROVED);
      expect(transitions).toContain(AssessmentStatus.REJECTED);
      expect(transitions).toHaveLength(2);
    });

    it("should return empty array for APPROVED status", () => {
      expect(getAvailableAssessmentTransitions(AssessmentStatus.APPROVED)).toEqual([]);
    });

    it("should return empty array for REJECTED status", () => {
      expect(getAvailableAssessmentTransitions(AssessmentStatus.REJECTED)).toEqual([]);
    });
  });
});

// =============================================================================
// Approval Gates Tests (AC24-AC29)
// =============================================================================

describe("Approval Gates", () => {
  describe("checkApprovalGates (AC24)", () => {
    it("should pass all gates when assessment is complete", () => {
      const assessment = createMockAssessment();
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(true);
      expect(result.missingGates).toEqual([]);
    });

    it("should fail when likelihoodValue is null (AC25)", () => {
      const assessment = createMockAssessment({ likelihoodValue: null });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContain("Score populated (likelihood and impact values required)");
    });

    it("should fail when impactValue is null (AC25)", () => {
      const assessment = createMockAssessment({ impactValue: null });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContain("Score populated (likelihood and impact values required)");
    });

    it("should fail when both likelihood and impact are null (AC25)", () => {
      const assessment = createMockAssessment({
        likelihoodValue: null,
        impactValue: null,
      });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates.filter((g) => g.includes("Score"))).toHaveLength(1);
    });

    it("should fail when no scenarios exist (AC26)", () => {
      const assessment = createMockAssessment({ scenarios: [] });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContain("Scenario defined (at least one risk scenario required)");
    });

    it("should fail when treatment is null (AC27)", () => {
      const assessment = createMockAssessment({ treatment: null });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContain("Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)");
    });

    it("should fail when ownerId is null (AC28)", () => {
      const assessment = createMockAssessment({ ownerId: null });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContain("Owner assigned");
    });

    it("should report all missing gates when multiple are missing", () => {
      const assessment = createMockAssessment({
        likelihoodValue: null,
        impactValue: null,
        scenarios: [],
        treatment: null,
        ownerId: null,
      });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toHaveLength(4);
    });

    it("should pass with different treatment types", () => {
      const treatmentTypes = [
        TreatmentType.ACCEPT,
        TreatmentType.MITIGATE,
        TreatmentType.TRANSFER,
        TreatmentType.AVOID,
      ];

      treatmentTypes.forEach((treatment) => {
        const assessment = createMockAssessment({ treatment });
        const result = checkApprovalGates(assessment);
        expect(result.canApprove).toBe(true);
      });
    });

    it("should pass with multiple scenarios", () => {
      const assessment = createMockAssessment({
        scenarios: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      });
      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(true);
    });
  });

  describe("assertApprovalGates (AC29)", () => {
    it("should not throw when all gates pass", () => {
      const assessment = createMockAssessment();

      expect(() => assertApprovalGates(assessment)).not.toThrow();
    });

    it("should throw TRPCError when gates fail", () => {
      const assessment = createMockAssessment({ ownerId: null });

      expect(() => assertApprovalGates(assessment)).toThrow(/Cannot approve assessment/);
    });

    it("should include missing gates in error message", () => {
      const assessment = createMockAssessment({
        treatment: null,
        ownerId: null,
      });

      expect(() => assertApprovalGates(assessment)).toThrow(/Treatment selected/);
      expect(() => assertApprovalGates(assessment)).toThrow(/Owner assigned/);
    });
  });

  describe("validateApprovalTransition", () => {
    it("should not throw for valid DRAFT → APPROVED with all gates", () => {
      const assessment = createMockAssessment();

      expect(() =>
        validateApprovalTransition(assessment, AssessmentStatus.APPROVED)
      ).not.toThrow();
    });

    it("should not throw for DRAFT → REJECTED (no gate check needed)", () => {
      const incompleteAssessment = createMockAssessment({ ownerId: null });

      expect(() =>
        validateApprovalTransition(incompleteAssessment, AssessmentStatus.REJECTED)
      ).not.toThrow();
    });

    it("should throw for DRAFT → APPROVED with missing gates", () => {
      const assessment = createMockAssessment({ ownerId: null });

      expect(() =>
        validateApprovalTransition(assessment, AssessmentStatus.APPROVED)
      ).toThrow(/Cannot approve assessment/);
    });

    it("should throw for invalid state transition before checking gates", () => {
      const assessment = createMockAssessment({
        status: AssessmentStatus.APPROVED,
      });

      expect(() =>
        validateApprovalTransition(assessment, AssessmentStatus.DRAFT)
      ).toThrow(/Cannot transition/);
    });
  });
});

// =============================================================================
// Terminal States Tests
// =============================================================================

describe("Terminal Assessment Statuses", () => {
  it("should include APPROVED and REJECTED", () => {
    expect(TERMINAL_ASSESSMENT_STATUSES).toContain(AssessmentStatus.APPROVED);
    expect(TERMINAL_ASSESSMENT_STATUSES).toContain(AssessmentStatus.REJECTED);
  });

  it("should not include DRAFT", () => {
    expect(TERMINAL_ASSESSMENT_STATUSES).not.toContain(AssessmentStatus.DRAFT);
  });

  it("should have exactly 2 terminal states", () => {
    expect(TERMINAL_ASSESSMENT_STATUSES).toHaveLength(2);
  });
});
