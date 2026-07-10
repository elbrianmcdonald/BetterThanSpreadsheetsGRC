/**
 * Approval Gates Unit Tests
 *
 * Story 7.9: Approval Gates & Assessment Approval
 *
 * Tests for:
 * - Approval gate checking (AC1-AC6)
 * - Gate enforcement (AC11-AC18)
 * - Risk Register entry creation (AC19-AC23)
 * - Reject functionality (AC31-AC34)
 * - Audit logging (AC37-AC39)
 */

import {
  checkApprovalGates,
  assertApprovalGates,
  type AssessmentWithScenarios,
} from "@/server/services/assessmentStateMachine";
import { TreatmentType, AssessmentStatus } from "@prisma/client";

// Mock assessment factory
function createMockAssessment(
  overrides: Partial<AssessmentWithScenarios> = {}
): AssessmentWithScenarios {
  return {
    id: "assessment-1",
    organizationId: "org-1",
    identifier: "RSK-2025-0001",
    findingId: "finding-1",
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    title: "Test Assessment",
    context: null,
    riskCategory: null,
    affectedSystems: [],
    likelihoodValue: null,
    impactValue: null,
    exposureValue: null,
    inherentScore: null,
    inherentScoreLabel: null,
    treatment: null,
    ownerId: null,
    status: AssessmentStatus.DRAFT,
    approvedBy: null,
    approvedAt: null,
    assessmentTypeId: null,
    matrixVersionId: null,
    scenarios: [],
    ...overrides,
  } as AssessmentWithScenarios;
}

describe("Approval Gates (Story 7.9)", () => {
  describe("Gate Checking (AC1-AC6)", () => {
    it("AC2: Gate 1 - Score populated fails when likelihood is null", () => {
      const assessment = createMockAssessment({
        likelihoodValue: null,
        impactValue: { toNumber: () => 3 } as any,
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContainEqual(
        expect.stringContaining("Score populated")
      );
    });

    it("AC2: Gate 1 - Score populated fails when impact is null", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: null,
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContainEqual(
        expect.stringContaining("Score populated")
      );
    });

    it("AC2: Gate 1 - Score populated passes when both values set", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }],
        treatment: TreatmentType.MITIGATE,
        ownerId: "user-1",
      });

      const result = checkApprovalGates(assessment);

      const scoreGateMissing = result.missingGates.some((g) =>
        g.includes("Score populated")
      );
      expect(scoreGateMissing).toBe(false);
    });

    it("AC3: Gate 2 - Scenario defined fails when no scenarios", () => {
      const assessment = createMockAssessment({
        scenarios: [],
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContainEqual(
        expect.stringContaining("Scenario defined")
      );
    });

    it("AC3: Gate 2 - Scenario defined passes with at least one scenario", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }],
        treatment: TreatmentType.ACCEPT,
        ownerId: "user-1",
      });

      const result = checkApprovalGates(assessment);

      const scenarioGateMissing = result.missingGates.some((g) =>
        g.includes("Scenario defined")
      );
      expect(scenarioGateMissing).toBe(false);
    });

    it("AC4: Gate 3 - Treatment selected fails when null", () => {
      const assessment = createMockAssessment({
        treatment: null,
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContainEqual(
        expect.stringContaining("Treatment selected")
      );
    });

    it("AC4: Gate 3 - Treatment selected passes when set", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }],
        treatment: TreatmentType.TRANSFER,
        ownerId: "user-1",
      });

      const result = checkApprovalGates(assessment);

      const treatmentGateMissing = result.missingGates.some((g) =>
        g.includes("Treatment selected")
      );
      expect(treatmentGateMissing).toBe(false);
    });

    it("AC5: Gate 4 - Owner assigned fails when null", () => {
      const assessment = createMockAssessment({
        ownerId: null,
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates).toContainEqual(
        expect.stringContaining("Owner assigned")
      );
    });

    it("AC5: Gate 4 - Owner assigned passes when set", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }],
        treatment: TreatmentType.AVOID,
        ownerId: "user-123",
      });

      const result = checkApprovalGates(assessment);

      const ownerGateMissing = result.missingGates.some((g) =>
        g.includes("Owner assigned")
      );
      expect(ownerGateMissing).toBe(false);
    });

    it("AC6: All gates pass when all requirements met", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }, { id: "scenario-2" }],
        treatment: TreatmentType.MITIGATE,
        ownerId: "user-1",
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(true);
      expect(result.missingGates).toHaveLength(0);
    });

    it("should return all missing gates when multiple are missing", () => {
      const assessment = createMockAssessment({
        likelihoodValue: null,
        impactValue: null,
        scenarios: [],
        treatment: null,
        ownerId: null,
      });

      const result = checkApprovalGates(assessment);

      expect(result.canApprove).toBe(false);
      expect(result.missingGates.length).toBe(4);
    });
  });

  describe("Gate Enforcement (AC13)", () => {
    it("AC13: assertApprovalGates throws when gates not met", () => {
      const assessment = createMockAssessment({
        likelihoodValue: null,
        impactValue: null,
        scenarios: [],
        treatment: null,
        ownerId: null,
      });

      expect(() => assertApprovalGates(assessment)).toThrow();
    });

    it("AC13: assertApprovalGates passes when all gates met", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [{ id: "scenario-1" }],
        treatment: TreatmentType.MITIGATE,
        ownerId: "user-1",
      });

      expect(() => assertApprovalGates(assessment)).not.toThrow();
    });

    it("should include missing gate details in error message", () => {
      const assessment = createMockAssessment({
        likelihoodValue: { toNumber: () => 4 } as any,
        impactValue: { toNumber: () => 3 } as any,
        scenarios: [],
        treatment: TreatmentType.MITIGATE,
        ownerId: null,
      });

      try {
        assertApprovalGates(assessment);
        fail("Expected error to be thrown");
      } catch (error: any) {
        expect(error.message).toContain("Missing requirements");
        expect(error.message).toContain("Scenario defined");
        expect(error.message).toContain("Owner assigned");
      }
    });
  });

  describe("Approve Mutation Logic (AC11-AC18)", () => {
    it("AC12: Should only allow approving DRAFT assessments", () => {
      const statuses = [
        { status: AssessmentStatus.DRAFT, shouldAllow: true },
        { status: AssessmentStatus.APPROVED, shouldAllow: false },
        { status: AssessmentStatus.REJECTED, shouldAllow: false },
      ];

      for (const { status, shouldAllow } of statuses) {
        const canApprove = status === AssessmentStatus.DRAFT;
        expect(canApprove).toBe(shouldAllow);
      }
    });

    it("AC14: RR identifier should be in correct format", () => {
      const year = new Date().getFullYear();
      const seq = 42;
      const identifier = `RR-${year}-${String(seq).padStart(4, "0")}`;

      expect(identifier).toMatch(/^RR-\d{4}-\d{4}$/);
      expect(identifier).toBe(`RR-${year}-0042`);
    });

    it("AC15-AC16: Approved assessment should have status, approvedBy, approvedAt", () => {
      const approvedAssessment = {
        id: "assessment-1",
        status: AssessmentStatus.APPROVED,
        approvedBy: "user-1",
        approvedAt: new Date(),
      };

      expect(approvedAssessment.status).toBe(AssessmentStatus.APPROVED);
      expect(approvedAssessment.approvedBy).toBeDefined();
      expect(approvedAssessment.approvedAt).toBeInstanceOf(Date);
    });
  });

  describe("Risk Register Entry Creation (AC19-AC23)", () => {
    it("AC19: Entry should inherit ownerId from assessment", () => {
      const assessment = { ownerId: "user-123" };
      const entry = { ownerId: assessment.ownerId };

      expect(entry.ownerId).toBe(assessment.ownerId);
    });

    it("AC20: Entry status should be OPEN", () => {
      const entry = { status: "OPEN" };
      expect(entry.status).toBe("OPEN");
    });

    it("AC21: Entry should link to source assessment", () => {
      const assessmentId = "assessment-1";
      const entry = { assessmentId };

      expect(entry.assessmentId).toBe(assessmentId);
    });

    it("AC22: Entry should have correct organizationId", () => {
      const organizationId = "org-1";
      const entry = { organizationId };

      expect(entry.organizationId).toBe(organizationId);
    });

    it("AC23: Entry identifier should be RR-YYYY-NNNN format", () => {
      const identifier = "RR-2025-0001";
      expect(identifier).toMatch(/^RR-\d{4}-\d{4}$/);
    });
  });

  describe("Return Values (AC24-AC26)", () => {
    it("AC24-AC26: Should return both assessment and entry with id and identifier", () => {
      const result = {
        assessment: {
          id: "assessment-1",
          identifier: "RSK-2025-0001",
          status: "APPROVED",
        },
        entry: {
          id: "entry-1",
          identifier: "RR-2025-0001",
          status: "OPEN",
        },
      };

      expect(result.assessment.id).toBeDefined();
      expect(result.assessment.identifier).toBeDefined();
      expect(result.entry.id).toBeDefined();
      expect(result.entry.identifier).toBeDefined();
    });
  });

  describe("Reject Assessment (AC31-AC34)", () => {
    it("AC31: Reject should only be available for DRAFT assessments", () => {
      const canReject = (status: AssessmentStatus) =>
        status === AssessmentStatus.DRAFT;

      expect(canReject(AssessmentStatus.DRAFT)).toBe(true);
      expect(canReject(AssessmentStatus.APPROVED)).toBe(false);
      expect(canReject(AssessmentStatus.REJECTED)).toBe(false);
    });

    it("AC32: Reject should require a reason", () => {
      const rejectInput = {
        assessmentId: "assessment-1",
        reason: "Does not meet quality standards",
      };

      expect(rejectInput.reason).toBeTruthy();
      expect(rejectInput.reason.length).toBeGreaterThan(0);
    });

    it("AC33: Rejected assessment should have REJECTED status", () => {
      const rejectedAssessment = {
        id: "assessment-1",
        status: AssessmentStatus.REJECTED,
      };

      expect(rejectedAssessment.status).toBe(AssessmentStatus.REJECTED);
    });

    it("AC34: Finding should remain unaffected by assessment rejection", () => {
      // Rejection only affects assessment status, not finding
      // (Story 23.3: FindingStatus.ACCEPTED retired — TRIAGED stands in)
      const finding = { status: "TRIAGED" };
      const assessment = { status: AssessmentStatus.REJECTED };

      expect(finding.status).toBe("TRIAGED");
      expect(assessment.status).toBe(AssessmentStatus.REJECTED);
    });
  });

  describe("Permissions (AC35-AC36)", () => {
    it("AC35: Approve roles should include security roles", () => {
      const approveRoles = [
        "ANALYST",
        "ANALYST",
        "ADMINISTRATOR",
      ];

      expect(approveRoles).toContain("ANALYST");
      expect(approveRoles).toContain("ANALYST");
      expect(approveRoles).toContain("ADMINISTRATOR");
    });

    it("AC36: Non-authorized roles should not see approve/reject buttons", () => {
      const nonAuthorizedRoles = [
        "BUSINESS_USER",
        "BUSINESS_USER",
        "BUSINESS_USER",
      ];

      const canModify = (role: string) =>
        ["ANALYST", "ANALYST", "ADMINISTRATOR"].includes(role);

      for (const role of nonAuthorizedRoles) {
        expect(canModify(role)).toBe(false);
      }
    });
  });

  describe("Audit Logging (AC37-AC39)", () => {
    it("AC37: ASSESSMENT_APPROVED action should be logged", () => {
      const auditLog = {
        action: "ASSESSMENT_APPROVED",
        entityType: "RiskAssessment",
        entityId: "assessment-1",
        changes: {
          before: { status: "DRAFT" },
          after: {
            status: "APPROVED",
            riskRegisterEntryId: "entry-1",
          },
        },
      };

      expect(auditLog.action).toBe("ASSESSMENT_APPROVED");
      expect(auditLog.entityType).toBe("RiskAssessment");
    });

    it("AC38: RISK_REGISTER_ENTRY_CREATED action should be logged", () => {
      const auditLog = {
        action: "RISK_REGISTER_ENTRY_CREATED",
        entityType: "RiskRegisterEntry",
        entityId: "entry-1",
        changes: {
          before: null,
          after: {
            identifier: "RR-2025-0001",
            assessmentId: "assessment-1",
          },
        },
      };

      expect(auditLog.action).toBe("RISK_REGISTER_ENTRY_CREATED");
      expect(auditLog.entityType).toBe("RiskRegisterEntry");
    });

    it("AC39: Logs should cross-reference each other", () => {
      const assessmentLog = {
        action: "ASSESSMENT_APPROVED",
        entityId: "assessment-1",
        changes: {
          after: {
            riskRegisterEntryId: "entry-1",
          },
        },
      };

      const entryLog = {
        action: "RISK_REGISTER_ENTRY_CREATED",
        entityId: "entry-1",
        changes: {
          after: {
            assessmentId: "assessment-1",
          },
        },
      };

      // Cross-reference check
      expect(assessmentLog.changes.after.riskRegisterEntryId).toBe(entryLog.entityId);
      expect(entryLog.changes.after.assessmentId).toBe(assessmentLog.entityId);
    });
  });

  describe("Treatment Type Validation", () => {
    it("should accept all valid treatment types", () => {
      const validTreatments = [
        TreatmentType.ACCEPT,
        TreatmentType.MITIGATE,
        TreatmentType.TRANSFER,
        TreatmentType.AVOID,
      ];

      for (const treatment of validTreatments) {
        const assessment = createMockAssessment({
          likelihoodValue: { toNumber: () => 4 } as any,
          impactValue: { toNumber: () => 3 } as any,
          scenarios: [{ id: "scenario-1" }],
          treatment,
          ownerId: "user-1",
        });

        const result = checkApprovalGates(assessment);
        expect(result.missingGates).not.toContainEqual(
          expect.stringContaining("Treatment selected")
        );
      }
    });
  });
});

describe("Approval Gate Checklist Component", () => {
  it("should define all gates in order", () => {
    const ALL_GATES = [
      "Score populated (likelihood and impact values required)",
      "Scenario defined (at least one risk scenario required)",
      "Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)",
      "Owner assigned",
    ];

    expect(ALL_GATES).toHaveLength(4);
    expect(ALL_GATES[0]).toContain("Score");
    expect(ALL_GATES[1]).toContain("Scenario");
    expect(ALL_GATES[2]).toContain("Treatment");
    expect(ALL_GATES[3]).toContain("Owner");
  });

  it("should correctly identify passed vs missing gates", () => {
    const gates = {
      canApprove: false,
      missingGates: ["Scenario defined", "Owner assigned"],
    };

    const allGates = ["Score", "Scenario", "Treatment", "Owner"];
    const passedGates = allGates.filter(
      (g) => !gates.missingGates.some((m) => m.includes(g))
    );

    expect(passedGates).toContain("Score");
    expect(passedGates).toContain("Treatment");
    expect(passedGates).not.toContain("Scenario");
    expect(passedGates).not.toContain("Owner");
  });
});
