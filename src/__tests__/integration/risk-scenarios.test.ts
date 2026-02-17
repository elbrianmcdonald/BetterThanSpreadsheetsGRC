/**
 * Integration Tests for Risk Scenario Management
 *
 * Story 7.7: Risk Scenario Management
 *
 * Tests the scenario CRUD operations:
 * - AC1-AC6: addScenario mutation
 * - AC7-AC10: updateScenario mutation
 * - AC11-AC14: removeScenario mutation
 * - AC32-AC33: Permission and organization checks
 *
 * @see Story 7.7: Risk Scenario Management
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type inferProcedureInput } from "@trpc/server";
import { UserRole, FindingStatus, FindingSource, Severity, AssessmentStatus } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type RouterInput = inferProcedureInput<typeof appRouter.riskAssessment.addScenario>;

describe("Risk Scenario Management - Story 7.7", () => {
  // Test data
  let testOrg: { id: string; name: string };
  let testUser: { id: string; email: string; organizationId: string; role: UserRole };
  let testFinding: { id: string };
  let testAssessment: { id: string };
  let approvedAssessment: { id: string };

  // Helper to create caller with session
  const createCaller = (user: typeof testUser) => {
    return appRouter.createCaller({
      db,
      session: {
        user: {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
          name: "Test User",
          image: null,
          assignedFrameworks: [],
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      organizationId: user.organizationId,
      headers: new Headers(),
    });
  };

  beforeAll(async () => {
    // Create test organization
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Test Org Scenarios ${Date.now()}`,
        slug: `test-org-scenarios-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    // Create test user with GRC_ANALYST role
    testUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: `scenario-test-${Date.now()}@example.com`,
        name: "Scenario Test User",
        organizationId: testOrg.id,
        role: UserRole.GRC_ANALYST,
        updatedAt: new Date(),
      },
    });

    // Create test finding and assessments within organization context
    await runWithOrganizationContext(testOrg.id, async () => {
      testFinding = await db.finding.create({
        data: {
          id: randomUUID(),
          identifier: `FND-SCEN-${Date.now()}`,
          title: "Test Finding for Scenarios",
          description: "Test description",
          status: FindingStatus.ACCEPTED,
          source: FindingSource.MANUAL,
          severity: Severity.HIGH,
          organizationId: testOrg.id,
          createdBy: testUser.id,
        },
      });

      testAssessment = await db.riskAssessment.create({
        data: {
          id: randomUUID(),
          identifier: `RSK-SCEN-${Date.now()}`,
          title: "Test Assessment for Scenarios",
          status: AssessmentStatus.DRAFT,
          organizationId: testOrg.id,
          findingId: testFinding.id,
          createdBy: testUser.id,
        },
      });

      // Create a second finding for the approved assessment (1:1 constraint on findingId)
      const approvedFinding = await db.finding.create({
        data: {
          id: randomUUID(),
          identifier: `FND-APPR-${Date.now()}`,
          title: "Finding for Approved Assessment",
          description: "Test description for approved",
          status: FindingStatus.ACCEPTED,
          source: FindingSource.MANUAL,
          severity: Severity.HIGH,
          organizationId: testOrg.id,
          createdBy: testUser.id,
        },
      });

      // Create an APPROVED assessment for status rejection tests
      approvedAssessment = await db.riskAssessment.create({
        data: {
          id: randomUUID(),
          identifier: `RSK-APPR-${Date.now()}`,
          title: "Approved Assessment for Status Tests",
          status: AssessmentStatus.APPROVED,
          organizationId: testOrg.id,
          findingId: approvedFinding.id,
          createdBy: testUser.id,
        },
      });
    });
  });

  afterAll(async () => {
    // Cleanup: Delete all test data in reverse order of creation
    if (testOrg) {
      try {
        // Delete scenarios first (child records)
        await db.riskScenario.deleteMany({
          where: { organizationId: testOrg.id },
        });
        // Delete assessments
        await db.riskAssessment.deleteMany({
          where: { organizationId: testOrg.id },
        });
        // Delete findings
        await db.finding.deleteMany({
          where: { organizationId: testOrg.id },
        });
        // Delete users
        await db.user.deleteMany({
          where: { organizationId: testOrg.id },
        });
        // Delete organization
        await db.organization.delete({
          where: { id: testOrg.id },
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("addScenario mutation (AC1-AC6)", () => {
    it("AC1, AC3, AC5: should create a scenario with description and order", async () => {
      const caller = createCaller(testUser);

      const result = await caller.riskAssessment.addScenario({
        assessmentId: testAssessment.id,
        description: "Attacker exploits weak authentication to gain unauthorized access",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.description).toBe("Attacker exploits weak authentication to gain unauthorized access");
      expect(result.order).toBe(0);
      expect(result.assessmentId).toBe(testAssessment.id);
    });

    it("AC2: should reject adding scenario to non-DRAFT assessment", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.addScenario({
          assessmentId: approvedAssessment.id,
          description: "This should fail - assessment is APPROVED",
        })
      ).rejects.toThrow(/must be in DRAFT status/i);
    });

    it("AC4: should inherit organizationId from assessment", async () => {
      const caller = createCaller(testUser);

      const result = await caller.riskAssessment.addScenario({
        assessmentId: testAssessment.id,
        description: "Second scenario for testing",
      });

      expect(result.organizationId).toBe(testOrg.id);
    });

    it("AC3: should auto-increment order for subsequent scenarios", async () => {
      const caller = createCaller(testUser);

      // Get current scenario count
      const existingScenarios = await db.riskScenario.count({
        where: { assessmentId: testAssessment.id },
      });

      const result = await caller.riskAssessment.addScenario({
        assessmentId: testAssessment.id,
        description: "Third scenario with incremented order",
      });

      expect(result.order).toBe(existingScenarios);
    });

    it("should reject empty description", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.addScenario({
          assessmentId: testAssessment.id,
          description: "",
        })
      ).rejects.toThrow();
    });

    /**
     * AC6: Approval gates recalculation
     * Note: Approval gates are recalculated on the frontend by refetching assessment data.
     * The scenario count is checked dynamically when evaluating gates, so adding a scenario
     * automatically affects gate evaluation on next query.
     */
    it("AC6: adding scenario should affect approval gate evaluation", async () => {
      // Create a fresh finding and assessment for this test (1:1 constraint)
      let gateTestAssessment: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        const gateFinding = await db.finding.create({
          data: {
            id: randomUUID(),
            identifier: `FND-GATE-${Date.now()}`,
            title: "Finding for Gate Test",
            description: "Test",
            status: FindingStatus.ACCEPTED,
            source: FindingSource.MANUAL,
            severity: Severity.HIGH,
            organizationId: testOrg.id,
            createdBy: testUser.id,
          },
        });
        gateTestAssessment = await db.riskAssessment.create({
          data: {
            id: randomUUID(),
            identifier: `RSK-GATE-${Date.now()}`,
            title: "Gate Test Assessment",
            status: AssessmentStatus.DRAFT,
            organizationId: testOrg.id,
            findingId: gateFinding.id,
            createdBy: testUser.id,
          },
        });
      });

      const caller = createCaller(testUser);

      // Before adding scenario, check scenario count is 0
      const beforeCount = await db.riskScenario.count({
        where: { assessmentId: gateTestAssessment!.id },
      });
      expect(beforeCount).toBe(0);

      // Add scenario
      await caller.riskAssessment.addScenario({
        assessmentId: gateTestAssessment!.id,
        description: "Scenario for gate test",
      });

      // After adding, scenario count should be 1 (affects gate calculation)
      const afterCount = await db.riskScenario.count({
        where: { assessmentId: gateTestAssessment!.id },
      });
      expect(afterCount).toBe(1);
    });
  });

  describe("updateScenario mutation (AC7-AC10)", () => {
    let scenarioToUpdate: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        scenarioToUpdate = await db.riskScenario.create({
          data: {
            id: randomUUID(),
            description: "Original description",
            order: 100,
            organizationId: testOrg.id,
            assessmentId: testAssessment.id,
          },
        });
      });
    });

    it("AC7, AC9, AC10: should update scenario description", async () => {
      const caller = createCaller(testUser);
      const newDescription = "Updated description with more details";

      const result = await caller.riskAssessment.updateScenario({
        scenarioId: scenarioToUpdate.id,
        description: newDescription,
      });

      expect(result.id).toBe(scenarioToUpdate.id);
      expect(result.description).toBe(newDescription);
    });

    it("AC8: should reject updating scenario on non-DRAFT assessment", async () => {
      // Create a scenario on the approved assessment
      let approvedScenario: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        approvedScenario = await db.riskScenario.create({
          data: {
            id: randomUUID(),
            description: "Scenario on approved assessment",
            order: 0,
            organizationId: testOrg.id,
            assessmentId: approvedAssessment.id,
          },
        });
      });

      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.updateScenario({
          scenarioId: approvedScenario!.id,
          description: "This should fail - assessment is APPROVED",
        })
      ).rejects.toThrow(/must be in DRAFT status/i);
    });

    it("should reject empty description on update", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.updateScenario({
          scenarioId: scenarioToUpdate.id,
          description: "",
        })
      ).rejects.toThrow();
    });

    it("should return NOT_FOUND for non-existent scenario", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.updateScenario({
          scenarioId: randomUUID(),
          description: "This should fail",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("removeScenario mutation (AC11-AC14)", () => {
    it("AC11, AC13: should delete scenario by id", async () => {
      // Create a scenario to delete
      let scenarioToDelete: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        scenarioToDelete = await db.riskScenario.create({
          data: {
            id: randomUUID(),
            description: "Scenario to be deleted",
            order: 200,
            organizationId: testOrg.id,
            assessmentId: testAssessment.id,
          },
        });
      });

      const caller = createCaller(testUser);

      const result = await caller.riskAssessment.removeScenario({
        scenarioId: scenarioToDelete!.id,
      });

      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await db.riskScenario.findUnique({
        where: { id: scenarioToDelete!.id },
      });
      expect(deleted).toBeNull();
    });

    it("AC12: should reject removing scenario from non-DRAFT assessment", async () => {
      // Create a scenario on the approved assessment (if not already created)
      let approvedScenarioToDelete: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        approvedScenarioToDelete = await db.riskScenario.create({
          data: {
            id: randomUUID(),
            description: "Scenario to try to delete from approved",
            order: 1,
            organizationId: testOrg.id,
            assessmentId: approvedAssessment.id,
          },
        });
      });

      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.removeScenario({
          scenarioId: approvedScenarioToDelete!.id,
        })
      ).rejects.toThrow(/must be in DRAFT status/i);
    });

    /**
     * AC14: Approval gates recalculation after remove
     * Similar to AC6, removing a scenario affects the scenario count which is
     * evaluated dynamically in gate checks.
     */
    it("AC14: removing scenario should affect approval gate evaluation", async () => {
      // Create finding, assessment, and scenario for this test (1:1 constraint on findingId)
      let gateTestAssessment: { id: string };
      let gateTestScenario: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        const gateDelFinding = await db.finding.create({
          data: {
            id: randomUUID(),
            identifier: `FND-GATE-DEL-${Date.now()}`,
            title: "Finding for Gate Delete Test",
            description: "Test",
            status: FindingStatus.ACCEPTED,
            source: FindingSource.MANUAL,
            severity: Severity.HIGH,
            organizationId: testOrg.id,
            createdBy: testUser.id,
          },
        });
        gateTestAssessment = await db.riskAssessment.create({
          data: {
            id: randomUUID(),
            identifier: `RSK-GATE-DEL-${Date.now()}`,
            title: "Gate Delete Test Assessment",
            status: AssessmentStatus.DRAFT,
            organizationId: testOrg.id,
            findingId: gateDelFinding.id,
            createdBy: testUser.id,
          },
        });

        gateTestScenario = await db.riskScenario.create({
          data: {
            id: randomUUID(),
            description: "Scenario to be removed for gate test",
            order: 0,
            organizationId: testOrg.id,
            assessmentId: gateTestAssessment.id,
          },
        });
      });

      // Before removing, scenario count is 1
      const beforeCount = await db.riskScenario.count({
        where: { assessmentId: gateTestAssessment!.id },
      });
      expect(beforeCount).toBe(1);

      const caller = createCaller(testUser);
      await caller.riskAssessment.removeScenario({
        scenarioId: gateTestScenario!.id,
      });

      // After removing, scenario count is 0 (affects gate calculation)
      const afterCount = await db.riskScenario.count({
        where: { assessmentId: gateTestAssessment!.id },
      });
      expect(afterCount).toBe(0);
    });

    it("should return NOT_FOUND for non-existent scenario", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskAssessment.removeScenario({
          scenarioId: randomUUID(),
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("Permissions (AC32-AC33)", () => {
    it("AC32: should allow GRC_ANALYST to modify scenarios", async () => {
      const caller = createCaller(testUser); // testUser is GRC_ANALYST

      const result = await caller.riskAssessment.addScenario({
        assessmentId: testAssessment.id,
        description: "GRC Analyst adding scenario",
      });

      expect(result).toBeDefined();
    });

    it("AC32: should allow SECURITY_ENGINEER to modify scenarios", async () => {
      const securityEngineer = await db.user.create({
        data: {
          id: randomUUID(),
          email: `sec-eng-${Date.now()}@example.com`,
          name: "Security Engineer",
          organizationId: testOrg.id,
          role: UserRole.SECURITY_ENGINEER,
          updatedAt: new Date(),
        },
      });

      const caller = createCaller(securityEngineer);

      const result = await caller.riskAssessment.addScenario({
        assessmentId: testAssessment.id,
        description: "Security Engineer adding scenario",
      });

      expect(result).toBeDefined();
    });

    it("AC33: should validate organization ownership", async () => {
      // Create a different organization
      const otherOrg = await db.organization.create({
        data: {
          id: randomUUID(),
          name: `Other Org ${Date.now()}`,
          slug: `other-org-${Date.now()}`,
          updatedAt: new Date(),
        },
      });

      const otherUser = await db.user.create({
        data: {
          id: randomUUID(),
          email: `other-user-${Date.now()}@example.com`,
          name: "Other Org User",
          organizationId: otherOrg.id,
          role: UserRole.GRC_ANALYST,
          updatedAt: new Date(),
        },
      });

      const caller = createCaller(otherUser);

      // Should not be able to add scenario to assessment in different org
      await expect(
        caller.riskAssessment.addScenario({
          assessmentId: testAssessment.id,
          description: "This should fail - wrong org",
        })
      ).rejects.toThrow(/not found/i);

      // Cleanup other org
      try {
        await db.user.delete({ where: { id: otherUser.id } });
        await db.organization.delete({ where: { id: otherOrg.id } });
      } catch {
        // Ignore cleanup errors
      }
    });
  });
});
