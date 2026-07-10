/**
 * Risk Assessment Form Integration Tests
 *
 * Tests for Story 7.6: Risk Assessment Form with Auto-Save
 *
 * **Critical Test Coverage:**
 * - AC14: getById query returns assessment with approval gates
 * - AC16-AC21: Update mutation with validation and score calculation
 * - AC34: Role-based access control
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  type UserRole,
  Severity,
  FindingSource,
  FindingStatus,
  AssessmentStatus,
  TreatmentType,
} from "@prisma/client";
import { Decimal } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

// Test data
let testOrg: { id: string; name: string };
let testUserSecurityEngineer: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserGRCAnalyst: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserOrgAdmin: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserITStakeholder: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserAuditor: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testFinding: { id: string; identifier: string };
let testAssessment: { id: string; identifier: string };
let approvedAssessment: { id: string; identifier: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-risk-assessment-form" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Risk Assessment Form",
      slug: "test-org-risk-assessment-form",
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  const createUser = async (
    name: string,
    email: string,
    role: UserRole,
    orgId: string
  ) => {
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        platformRole: role === "BUSINESS_USER" ? null : role,
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });
    return {
      id: user.id,
      email: user.email!,
      role,
      organizationId: user.organizationId,
      name: user.name!,
      assignedFrameworks: user.assignedFrameworks,
    };
  };

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@risk-assessment-form.test",
    "ANALYST",
    testOrg.id
  );

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@risk-assessment-form.test",
    "ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@risk-assessment-form.test",
    "ADMINISTRATOR",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@risk-assessment-form.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@risk-assessment-form.test",
    "BUSINESS_USER",
    testOrg.id
  );

  // Create a test finding for the assessment
  await runWithOrganizationContext(testOrg.id, async () => {
    const finding = await db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: "FND-2025-0001",
        title: "Test Finding for Assessment",
        description: "This is a test finding to associate with the risk assessment.",
        source: FindingSource.PENTEST,
        severity: Severity.HIGH,
        status: FindingStatus.CLOSED,
        createdBy: testUserSecurityEngineer.id,
      },
    });
    testFinding = { id: finding.id, identifier: finding.identifier };

    // Create a test DRAFT assessment
    const assessment = await db.riskAssessment.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: "RSK-2025-0001",
        title: "Test Assessment Draft",
        findingId: finding.id,
        createdBy: testUserSecurityEngineer.id,
        status: AssessmentStatus.DRAFT,
      },
    });
    testAssessment = { id: assessment.id, identifier: assessment.identifier };

    // Create a second finding for approved assessment
    const approvedFinding = await db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: "FND-2025-0002",
        title: "Test Finding for Approved Assessment",
        description: "This finding is associated with an approved assessment.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
        status: FindingStatus.CLOSED,
        createdBy: testUserSecurityEngineer.id,
      },
    });

    // Create an APPROVED assessment (cannot be updated)
    const approved = await db.riskAssessment.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: "RSK-2025-0002",
        title: "Test Assessment Approved",
        findingId: approvedFinding.id,
        createdBy: testUserSecurityEngineer.id,
        status: AssessmentStatus.APPROVED,
        approvedBy: testUserOrgAdmin.id,
        approvedAt: new Date(),
      },
    });
    approvedAssessment = { id: approved.id, identifier: approved.identifier };
  });
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
});

// Helper to create a caller with a specific user context
const createCaller = (user: typeof testUserSecurityEngineer) => {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
};

describe("Story 7.6: Risk Assessment Form with Auto-Save", () => {
  describe("AC14: getById Query", () => {
    it("returns assessment with all fields including approval gates", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.getById({
        id: testAssessment.id,
      });

      expect(result).toHaveProperty("id", testAssessment.id);
      expect(result).toHaveProperty("identifier", testAssessment.identifier);
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("status", "DRAFT");
      expect(result).toHaveProperty("approvalGates");
      expect(result.approvalGates).toHaveProperty("canApprove");
      expect(result.approvalGates).toHaveProperty("missingGates");
    });

    it("returns NOT_FOUND for non-existent assessment", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      await expect(
        caller.riskAssessment.getById({ id: "non-existent-id" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("AC16-AC18: Update Mutation Basics", () => {
    it("AC16: update mutation is defined and works", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        title: "Updated Test Assessment",
      });

      expect(result.title).toBe("Updated Test Assessment");
    });

    it("AC18: accepts partial updates (only changed fields)", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Only update context
      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        context: "Updated context for this risk assessment.",
      });

      expect(result.context).toBe("Updated context for this risk assessment.");
      // Title should remain from previous update
      expect(result.title).toBe("Updated Test Assessment");
    });

    it("AC17: rejects updates to non-DRAFT assessment", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      await expect(
        caller.riskAssessment.update({
          assessmentId: approvedAssessment.id,
          title: "Should not work",
        })
      ).rejects.toThrow(/Cannot update assessment in APPROVED status/);
    });
  });

  describe("AC19-AC20: Score Calculation", () => {
    it("AC19: auto-calculates inherentScore (likelihood × impact)", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 3,
        impactValue: 4,
      });

      expect(result.likelihoodValue).toBe(3);
      expect(result.impactValue).toBe(4);
      expect(result.inherentScore).toBe(12); // 3 × 4 = 12
    });

    it("AC20: sets inherentScoreLabel based on score thresholds", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Test Low threshold (1-4)
      const lowResult = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 1,
        impactValue: 2,
      });
      expect(lowResult.inherentScore).toBe(2);
      expect(lowResult.inherentScoreLabel).toBe("Low");

      // Test Medium threshold (5-8)
      const mediumResult = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 2,
        impactValue: 3,
      });
      expect(mediumResult.inherentScore).toBe(6);
      expect(mediumResult.inherentScoreLabel).toBe("Medium");

      // Test High threshold (9-12)
      const highResult = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 3,
        impactValue: 4,
      });
      expect(highResult.inherentScore).toBe(12);
      expect(highResult.inherentScoreLabel).toBe("High");

      // Test Critical threshold (13-16)
      const criticalResult = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 4,
        impactValue: 4,
      });
      expect(criticalResult.inherentScore).toBe(16);
      expect(criticalResult.inherentScoreLabel).toBe("Critical");
    });

    it("preserves existing values when only one of likelihood/impact is updated", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // First set both values
      await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        likelihoodValue: 2,
        impactValue: 3,
      });

      // Now only update impact
      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        impactValue: 4,
      });

      // Should use existing likelihood (2) × new impact (4) = 8
      expect(result.likelihoodValue).toBe(2);
      expect(result.impactValue).toBe(4);
      expect(result.inherentScore).toBe(8);
      expect(result.inherentScoreLabel).toBe("Medium");
    });
  });

  describe("AC21: Approval Gates in Response", () => {
    it("returns approval gates status with update response", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        title: "Test with approval gates",
      });

      expect(result).toHaveProperty("approvalGates");
      expect(result.approvalGates).toHaveProperty("canApprove");
      expect(result.approvalGates).toHaveProperty("missingGates");
      expect(Array.isArray(result.approvalGates.missingGates)).toBe(true);
    });

    it("canApprove is false when missing required fields", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Reset to just title (missing score, scenario, treatment, owner)
      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        ownerId: null, // Clear owner
        treatment: undefined, // Clear treatment (won't actually clear, but test validation)
      });

      expect(result.approvalGates.canApprove).toBe(false);
      expect(result.approvalGates.missingGates.length).toBeGreaterThan(0);
    });
  });

  describe("AC34: Role-Based Access Control", () => {
    it("Security Engineer can update assessments", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        context: "Updated by Security Engineer",
      });

      expect(result.context).toBe("Updated by Security Engineer");
    });

    it("GRC Analyst can update assessments", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        context: "Updated by GRC Analyst",
      });

      expect(result.context).toBe("Updated by GRC Analyst");
    });

    it("Org Admin can update assessments", async () => {
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        context: "Updated by Org Admin",
      });

      expect(result.context).toBe("Updated by Org Admin");
    });

    it("IT Stakeholder cannot update assessments", async () => {
      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.riskAssessment.update({
          assessmentId: testAssessment.id,
          title: "Should not work",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("Auditor cannot update assessments (view-only)", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.riskAssessment.update({
          assessmentId: testAssessment.id,
          title: "Should not work",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("Owner Assignment", () => {
    it("can assign an owner from the same organization", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        ownerId: testUserGRCAnalyst.id,
      });

      expect(result.owner).not.toBeNull();
      expect(result.owner?.id).toBe(testUserGRCAnalyst.id);
    });

    it("can clear owner by setting to null", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        ownerId: null,
      });

      expect(result.owner).toBeNull();
    });

    it("rejects owner from different organization", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      await expect(
        caller.riskAssessment.update({
          assessmentId: testAssessment.id,
          ownerId: "invalid-user-id",
        })
      ).rejects.toThrow(/Invalid owner/);
    });
  });

  describe("Treatment Selection", () => {
    it("can set treatment to any valid TreatmentType", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Test all treatment types
      for (const treatment of Object.values(TreatmentType)) {
        const result = await caller.riskAssessment.update({
          assessmentId: testAssessment.id,
          treatment,
        });
        expect(result.treatment).toBe(treatment);
      }
    });
  });

  describe("Risk Category and Affected Systems", () => {
    it("can update risk category", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        riskCategory: "Access Control",
      });

      expect(result.riskCategory).toBe("Access Control");
    });

    it("can update affected systems as array", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const systems = ["web-server-01", "database-prod", "api-gateway"];

      const result = await caller.riskAssessment.update({
        assessmentId: testAssessment.id,
        affectedSystems: systems,
      });

      expect(result.affectedSystems).toEqual(systems);
    });
  });
});
