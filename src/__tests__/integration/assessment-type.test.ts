/**
 * Integration Tests for Assessment Type Management
 *
 * Story 7.8.1: AssessmentType Schema & CRUD
 *
 * Tests the assessment type CRUD operations:
 * - AC6: create mutation
 * - AC7: update mutation
 * - AC8: list query
 * - AC9: getById query
 * - AC10: Soft delete via isActive flag
 * - AC11: Cannot deactivate type with active assessments
 * - AC12: Mutations require ORG_ADMIN role
 * - AC19-AC21: Validation (name required, max lengths, duplicate rejection)
 *
 * @see Story 7.8.1: AssessmentType Schema & CRUD
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, FindingStatus, FindingSource, Severity, AssessmentStatus } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

describe("Assessment Type Management - Story 7.8.1", () => {
  // Test data
  let testOrg: { id: string; name: string };
  let adminUser: { id: string; email: string; organizationId: string; role: UserRole };
  let analystUser: { id: string; email: string; organizationId: string; role: UserRole };

  // Helper to create caller with session
  const createCaller = (user: typeof adminUser) => {
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
        name: `Test Org AssessmentType ${Date.now()}`,
        slug: `test-org-assessment-type-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    // Create admin user (ORG_ADMIN role)
    const adminRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: `admin-type-test-${Date.now()}@example.com`,
        name: "Admin Test User",
        organizationId: testOrg.id,
        platformRole: UserRole.ADMINISTRATOR,
        updatedAt: new Date(),
      },
    });
    adminUser = {
      id: adminRow.id,
      email: adminRow.email!,
      organizationId: adminRow.organizationId,
      role: UserRole.ADMINISTRATOR,
    };

    // Create analyst user (GRC_ANALYST role) - should NOT have permission
    const analystRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: `analyst-type-test-${Date.now()}@example.com`,
        name: "Analyst Test User",
        organizationId: testOrg.id,
        platformRole: UserRole.ANALYST,
        updatedAt: new Date(),
      },
    });
    analystUser = {
      id: analystRow.id,
      email: analystRow.email!,
      organizationId: analystRow.organizationId,
      role: UserRole.ANALYST,
    };
  });

  afterAll(async () => {
    // Cleanup: Delete all test data using raw SQL to avoid org context issues
    if (testOrg) {
      await db.$executeRaw`DELETE FROM "AssessmentType" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "RiskScenario" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
  });

  describe("create mutation (AC6)", () => {
    it("should create an assessment type with name and description", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.create({
        name: "IT Risk Assessment",
        description: "Assessments for information technology risks",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("IT Risk Assessment");
      expect(result.description).toBe("Assessments for information technology risks");
      expect(result.isActive).toBe(true);
      expect(result.organizationId).toBe(testOrg.id);
    });

    it("should create an assessment type with name only (description optional)", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.create({
        name: "Vendor Risk Assessment",
      });

      expect(result.name).toBe("Vendor Risk Assessment");
      expect(result.description).toBeNull();
    });

    it("AC19: should reject empty name", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.assessmentType.create({
          name: "",
        })
      ).rejects.toThrow();
    });

    it("AC19: should reject name over 100 characters", async () => {
      const caller = createCaller(adminUser);
      const longName = "a".repeat(101);

      await expect(
        caller.assessmentType.create({
          name: longName,
        })
      ).rejects.toThrow();
    });

    it("AC20: should reject description over 500 characters", async () => {
      const caller = createCaller(adminUser);
      const longDesc = "a".repeat(501);

      await expect(
        caller.assessmentType.create({
          name: "Valid Name",
          description: longDesc,
        })
      ).rejects.toThrow();
    });

    it("AC21: should reject duplicate name with user-friendly error", async () => {
      const caller = createCaller(adminUser);
      const uniqueName = `Unique Type ${Date.now()}`;

      // Create first type
      await caller.assessmentType.create({
        name: uniqueName,
      });

      // Try to create duplicate
      await expect(
        caller.assessmentType.create({
          name: uniqueName,
        })
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe("update mutation (AC7)", () => {
    let typeToUpdate: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        typeToUpdate = await db.assessmentType.create({
          data: {
            id: randomUUID(),
            name: `Type to Update ${Date.now()}`,
            description: "Original description",
            organizationId: testOrg.id,
            isActive: true,
          },
        });
      });
    });

    it("should update name and description", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.update({
        id: typeToUpdate.id,
        name: "Updated Name",
        description: "Updated description",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("Updated description");
    });

    it("AC10: should soft delete via isActive flag", async () => {
      const caller = createCaller(adminUser);

      // Create a type to deactivate
      const typeToDeactivate = await caller.assessmentType.create({
        name: `Type to Deactivate ${Date.now()}`,
      });

      const result = await caller.assessmentType.update({
        id: typeToDeactivate.id,
        isActive: false,
      });

      expect(result.isActive).toBe(false);

      // Verify it's not returned in active-only list
      const activeTypes = await caller.assessmentType.list({
        includeInactive: false,
      });
      expect(activeTypes.find((t) => t.id === typeToDeactivate.id)).toBeUndefined();
    });

    it("should return NOT_FOUND for non-existent type", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.assessmentType.update({
          id: randomUUID(),
          name: "New Name",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("list query (AC8)", () => {
    it("should return all active types for organization", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.list({
        includeInactive: false,
      });

      expect(Array.isArray(result)).toBe(true);
      // All returned should be active
      result.forEach((type) => {
        expect(type.isActive).toBe(true);
        expect(type.organizationId).toBe(testOrg.id);
      });
    });

    it("should include assessment count", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.list({
        includeInactive: false,
      });

      result.forEach((type) => {
        expect(typeof type.assessmentCount).toBe("number");
      });
    });

    it("should include inactive types when requested", async () => {
      const caller = createCaller(adminUser);

      // Create and deactivate a type
      const inactiveType = await caller.assessmentType.create({
        name: `Inactive Type ${Date.now()}`,
      });
      await caller.assessmentType.update({
        id: inactiveType.id,
        isActive: false,
      });

      // List with inactive
      const result = await caller.assessmentType.list({
        includeInactive: true,
      });

      expect(result.some((t) => t.id === inactiveType.id)).toBe(true);
    });
  });

  describe("getById query (AC9)", () => {
    it("should return type with organization isolation", async () => {
      const caller = createCaller(adminUser);

      // Create a type
      const type = await caller.assessmentType.create({
        name: `GetById Test ${Date.now()}`,
        description: "Test description",
      });

      const result = await caller.assessmentType.getById({ id: type.id });

      expect(result.id).toBe(type.id);
      expect(result.name).toBe(type.name);
      expect(result.assessmentCount).toBeDefined();
    });

    it("should return NOT_FOUND for non-existent type", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.assessmentType.getById({ id: randomUUID() })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("deactivation with active assessments (AC11)", () => {
    let typeWithAssessment: { id: string };
    let testFinding: { id: string };
    let testAssessment: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create assessment type
        typeWithAssessment = await db.assessmentType.create({
          data: {
            id: randomUUID(),
            name: `Type with Assessment ${Date.now()}`,
            organizationId: testOrg.id,
            isActive: true,
          },
        });

        // Create finding
        testFinding = await db.finding.create({
          data: {
            id: randomUUID(),
            identifier: `FND-TYPE-${Date.now()}`,
            title: "Test Finding for Type",
            description: "Test description",
            status: FindingStatus.CLOSED,
            source: FindingSource.MANUAL,
            severity: Severity.HIGH,
            organizationId: testOrg.id,
            createdBy: adminUser.id,
          },
        });

        // Create assessment linked to the type
        testAssessment = await db.riskAssessment.create({
          data: {
            id: randomUUID(),
            identifier: `RSK-TYPE-${Date.now()}`,
            title: "Test Assessment with Type",
            status: AssessmentStatus.DRAFT,
            organizationId: testOrg.id,
            findingId: testFinding.id,
            createdBy: adminUser.id,
            assessmentTypeId: typeWithAssessment.id,
          },
        });
      });
    });

    it("should block deactivation if type has active assessments", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.assessmentType.update({
          id: typeWithAssessment.id,
          isActive: false,
        })
      ).rejects.toThrow(/cannot deactivate/i);
    });

    it("canDeactivate should return false with reason", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.canDeactivate({
        id: typeWithAssessment.id,
      });

      expect(result.canDeactivate).toBe(false);
      expect(result.assessmentCount).toBeGreaterThan(0);
      expect(result.reason).toContain("assessment");
    });
  });

  describe("permissions (AC12)", () => {
    it("should allow ORG_ADMIN to create types", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.assessmentType.create({
        name: `Admin Create Test ${Date.now()}`,
      });

      expect(result).toBeDefined();
    });

    it("should reject GRC_ANALYST from creating types", async () => {
      const caller = createCaller(analystUser);

      await expect(
        caller.assessmentType.create({
          name: `Analyst Create Test ${Date.now()}`,
        })
      ).rejects.toThrow(/requires one of these roles|unauthorized|forbidden/i);
    });

    it("should reject GRC_ANALYST from updating types", async () => {
      // First create a type as admin
      const adminCaller = createCaller(adminUser);
      const type = await adminCaller.assessmentType.create({
        name: `Analyst Update Test ${Date.now()}`,
      });

      // Try to update as analyst
      const analystCaller = createCaller(analystUser);
      await expect(
        analystCaller.assessmentType.update({
          id: type.id,
          name: "Modified by Analyst",
        })
      ).rejects.toThrow(/requires one of these roles|unauthorized|forbidden/i);
    });
  });

  describe("organization isolation (AC33 equivalent)", () => {
    let otherOrg: { id: string };
    let otherOrgUser: { id: string; email: string; organizationId: string; role: UserRole };

    beforeAll(async () => {
      // Create another organization
      otherOrg = await db.organization.create({
        data: {
          id: randomUUID(),
          name: `Other Org Type Test ${Date.now()}`,
          slug: `other-org-type-test-${Date.now()}`,
          updatedAt: new Date(),
        },
      });

      const otherOrgRow = await db.user.create({
        data: {
          id: randomUUID(),
          email: `other-org-type-${Date.now()}@example.com`,
          name: "Other Org User",
          organizationId: otherOrg.id,
          platformRole: UserRole.ADMINISTRATOR,
          updatedAt: new Date(),
        },
      });
      otherOrgUser = {
        id: otherOrgRow.id,
        email: otherOrgRow.email!,
        organizationId: otherOrgRow.organizationId,
        role: UserRole.ADMINISTRATOR,
      };
    });

    afterAll(async () => {
      if (otherOrg) {
        await db.$executeRaw`DELETE FROM "AssessmentType" WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${otherOrg.id}`;
      }
    });

    it("should not return types from other organizations", async () => {
      // Create type in main org
      const mainCaller = createCaller(adminUser);
      const mainType = await mainCaller.assessmentType.create({
        name: `Main Org Type ${Date.now()}`,
      });

      // Create type in other org
      const otherCaller = createCaller(otherOrgUser);
      await otherCaller.assessmentType.create({
        name: `Other Org Type ${Date.now()}`,
      });

      // List from main org should not include other org's types
      const mainList = await mainCaller.assessmentType.list({ includeInactive: true });
      mainList.forEach((type) => {
        expect(type.organizationId).toBe(testOrg.id);
      });

      // getById should fail for other org's type
      await expect(
        otherCaller.assessmentType.getById({ id: mainType.id })
      ).rejects.toThrow(/not found/i);
    });
  });
});
