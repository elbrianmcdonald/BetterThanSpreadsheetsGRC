/**
 * Integration Tests for Risk Matrix Template Management
 *
 * Story 7.8.2: RiskMatrixTemplate Schema
 *
 * Tests the risk matrix template CRUD operations:
 * - AC8: createTemplate mutation
 * - AC9: updateTemplate mutation
 * - AC10: listTemplates query
 * - AC11: getTemplate query
 * - AC12: Mutations require ORG_ADMIN role
 * - AC13: Soft delete via isActive flag
 * - AC14: Cannot deactivate template with published version
 * - AC21-AC25: Validation (name required, max lengths, dimensionCount, outputScaleMax)
 *
 * @see Story 7.8.2: RiskMatrixTemplate Schema
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

describe("Risk Matrix Template Management - Story 7.8.2", () => {
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
        name: `Test Org RiskMatrix ${Date.now()}`,
        slug: `test-org-risk-matrix-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    // Create admin user (ORG_ADMIN role)
    adminUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: `admin-matrix-test-${Date.now()}@example.com`,
        name: "Admin Test User",
        organizationId: testOrg.id,
        role: UserRole.ORG_ADMIN,
        updatedAt: new Date(),
      },
    });

    // Create analyst user (GRC_ANALYST role) - should NOT have permission
    analystUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: `analyst-matrix-test-${Date.now()}@example.com`,
        name: "Analyst Test User",
        organizationId: testOrg.id,
        role: UserRole.GRC_ANALYST,
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup: Delete all test data using raw SQL to avoid org context issues
    if (testOrg) {
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT "id" FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
  });

  describe("createTemplate mutation (AC8)", () => {
    it("should create a 2D matrix template (Likelihood × Impact)", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.createTemplate({
        name: "Standard 2D Risk Matrix",
        description: "Likelihood x Impact matrix for general risk assessment",
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("Standard 2D Risk Matrix");
      expect(result.description).toBe("Likelihood x Impact matrix for general risk assessment");
      expect(result.dimensionCount).toBe(2);
      expect(result.outputScaleMax).toBe(25);
      expect(result.isActive).toBe(true);
      expect(result.organizationId).toBe(testOrg.id);
    });

    it("should create a 3D matrix template (L×I×Exposure)", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.createTemplate({
        name: "3D Risk Matrix with Exposure",
        description: "Includes exposure dimension for comprehensive risk scoring",
        dimensionCount: 3,
        outputScaleMax: 125,
      });

      expect(result.dimensionCount).toBe(3);
      expect(result.outputScaleMax).toBe(125);
    });

    it("should default to 2D when dimensionCount not specified", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.createTemplate({
        name: `Default Dimension Test ${Date.now()}`,
        outputScaleMax: 100,
      });

      expect(result.dimensionCount).toBe(2);
    });

    it("AC22: should reject dimensionCount less than 2", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Invalid 1D Matrix",
          dimensionCount: 1,
          outputScaleMax: 10,
        })
      ).rejects.toThrow();
    });

    it("AC22: should reject dimensionCount greater than 3", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Invalid 4D Matrix",
          dimensionCount: 4,
          outputScaleMax: 10,
        })
      ).rejects.toThrow();
    });

    it("AC23: should reject outputScaleMax <= 0", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Invalid Zero Scale",
          dimensionCount: 2,
          outputScaleMax: 0,
        })
      ).rejects.toThrow();

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Invalid Negative Scale",
          dimensionCount: 2,
          outputScaleMax: -5,
        })
      ).rejects.toThrow();
    });

    it("AC23: should reject outputScaleMax > 1000", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Invalid Large Scale",
          dimensionCount: 2,
          outputScaleMax: 1001,
        })
      ).rejects.toThrow();
    });

    it("AC21: should reject empty name", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "",
          dimensionCount: 2,
          outputScaleMax: 25,
        })
      ).rejects.toThrow();
    });

    it("AC21: should reject name over 100 characters", async () => {
      const caller = createCaller(adminUser);
      const longName = "a".repeat(101);

      await expect(
        caller.riskMatrix.createTemplate({
          name: longName,
          dimensionCount: 2,
          outputScaleMax: 25,
        })
      ).rejects.toThrow();
    });

    it("should reject description over 500 characters", async () => {
      const caller = createCaller(adminUser);
      const longDesc = "a".repeat(501);

      await expect(
        caller.riskMatrix.createTemplate({
          name: "Valid Name",
          description: longDesc,
          dimensionCount: 2,
          outputScaleMax: 25,
        })
      ).rejects.toThrow();
    });

    it("AC24: should reject duplicate name with user-friendly error", async () => {
      const caller = createCaller(adminUser);
      const uniqueName = `Unique Matrix ${Date.now()}`;

      // Create first template
      await caller.riskMatrix.createTemplate({
        name: uniqueName,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // Try to create duplicate
      await expect(
        caller.riskMatrix.createTemplate({
          name: uniqueName,
          dimensionCount: 2,
          outputScaleMax: 25,
        })
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe("updateTemplate mutation (AC9)", () => {
    let templateToUpdate: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        templateToUpdate = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            name: `Template to Update ${Date.now()}`,
            description: "Original description",
            dimensionCount: 2,
            outputScaleMax: new Decimal(25),
            organizationId: testOrg.id,
            isActive: true,
          },
        });
      });
    });

    it("should update name and description", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.updateTemplate({
        id: templateToUpdate.id,
        name: "Updated Matrix Name",
        description: "Updated description",
      });

      expect(result.name).toBe("Updated Matrix Name");
      expect(result.description).toBe("Updated description");
    });

    it("AC12/AC25: should NOT allow updating dimensionCount after creation", async () => {
      // dimensionCount is not in the update schema, so we verify it stays unchanged
      const caller = createCaller(adminUser);

      // Get original template
      const original = await caller.riskMatrix.getTemplate({ id: templateToUpdate.id });
      const originalDimensionCount = original.dimensionCount;

      // Update with only name
      await caller.riskMatrix.updateTemplate({
        id: templateToUpdate.id,
        name: "Name Change Only",
      });

      // Verify dimensionCount is unchanged
      const updated = await caller.riskMatrix.getTemplate({ id: templateToUpdate.id });
      expect(updated.dimensionCount).toBe(originalDimensionCount);
    });

    it("AC12/AC25: should NOT allow updating outputScaleMax after creation", async () => {
      // outputScaleMax is not in the update schema, so we verify it stays unchanged
      const caller = createCaller(adminUser);

      // Get original template
      const original = await caller.riskMatrix.getTemplate({ id: templateToUpdate.id });
      const originalOutputScaleMax = original.outputScaleMax;

      // Update with only description
      await caller.riskMatrix.updateTemplate({
        id: templateToUpdate.id,
        description: "Description change only",
      });

      // Verify outputScaleMax is unchanged
      const updated = await caller.riskMatrix.getTemplate({ id: templateToUpdate.id });
      expect(updated.outputScaleMax).toBe(originalOutputScaleMax);
    });

    it("AC13: should soft delete via isActive flag", async () => {
      const caller = createCaller(adminUser);

      // Create a template to deactivate
      const templateToDeactivate = await caller.riskMatrix.createTemplate({
        name: `Template to Deactivate ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      const result = await caller.riskMatrix.updateTemplate({
        id: templateToDeactivate.id,
        isActive: false,
      });

      expect(result.isActive).toBe(false);

      // Verify it's not returned in active-only list
      const activeTemplates = await caller.riskMatrix.listTemplates({
        includeInactive: false,
      });
      expect(activeTemplates.find((t) => t.id === templateToDeactivate.id)).toBeUndefined();
    });

    it("should return NOT_FOUND for non-existent template", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.updateTemplate({
          id: randomUUID(),
          name: "New Name",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("listTemplates query (AC10)", () => {
    it("should return all active templates for organization", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.listTemplates({
        includeInactive: false,
      });

      expect(Array.isArray(result)).toBe(true);
      // All returned should be active
      result.forEach((template) => {
        expect(template.isActive).toBe(true);
        expect(template.organizationId).toBe(testOrg.id);
      });
    });

    it("should include version count (currently 0 until Story 7.8.3)", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.listTemplates({
        includeInactive: false,
      });

      result.forEach((template) => {
        expect(typeof template.versionCount).toBe("number");
      });
    });

    it("should include hasPublishedVersion flag", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.listTemplates({
        includeInactive: false,
      });

      result.forEach((template) => {
        expect(typeof template.hasPublishedVersion).toBe("boolean");
      });
    });

    it("should include inactive templates when requested", async () => {
      const caller = createCaller(adminUser);

      // Create and deactivate a template
      const inactiveTemplate = await caller.riskMatrix.createTemplate({
        name: `Inactive Template ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });
      await caller.riskMatrix.updateTemplate({
        id: inactiveTemplate.id,
        isActive: false,
      });

      // List with inactive
      const result = await caller.riskMatrix.listTemplates({
        includeInactive: true,
      });

      expect(result.some((t) => t.id === inactiveTemplate.id)).toBe(true);
    });
  });

  describe("getTemplate query (AC11)", () => {
    it("should return template with organization isolation", async () => {
      const caller = createCaller(adminUser);

      // Create a template
      const template = await caller.riskMatrix.createTemplate({
        name: `GetTemplate Test ${Date.now()}`,
        description: "Test description",
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      const result = await caller.riskMatrix.getTemplate({ id: template.id });

      expect(result.id).toBe(template.id);
      expect(result.name).toBe(template.name);
      expect(result.dimensionCount).toBe(2);
      expect(result.outputScaleMax).toBe(25);
      expect(result.versionCount).toBeDefined();
    });

    it("should return NOT_FOUND for non-existent template", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.getTemplate({ id: randomUUID() })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("AC14: deactivation with published version", () => {
    let templateWithVersion: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create template first without currentVersionId
        const templateId = randomUUID();
        const template = await db.riskMatrixTemplate.create({
          data: {
            id: templateId,
            name: `Template with Version ${Date.now()}`,
            organizationId: testOrg.id,
            dimensionCount: 2,
            outputScaleMax: new Decimal(25),
            isActive: true,
          },
        });

        // Create a published version for the template
        const version = await db.riskMatrixVersion.create({
          data: {
            id: randomUUID(),
            templateId: template.id,
            versionNumber: 1,
            scales: { likelihood: [], impact: [] },
            thresholds: [],
            isActive: true,
            publishedAt: new Date(),
          },
        });

        // Update template to set currentVersionId
        templateWithVersion = await db.riskMatrixTemplate.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
        });
      });
    });

    it("should block deactivation if template has published version", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.riskMatrix.updateTemplate({
          id: templateWithVersion.id,
          isActive: false,
        })
      ).rejects.toThrow(/cannot deactivate/i);
    });

    it("canDeactivate should return false with reason for template with published version", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.canDeactivate({
        id: templateWithVersion.id,
      });

      expect(result.canDeactivate).toBe(false);
      expect(result.hasPublishedVersion).toBe(true);
      expect(result.reason).toBeTruthy();
    });

    it("canDeactivate should return true for template without published version", async () => {
      const caller = createCaller(adminUser);

      // Create template without published version
      const templateWithoutVersion = await caller.riskMatrix.createTemplate({
        name: `Template without Version ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      const result = await caller.riskMatrix.canDeactivate({
        id: templateWithoutVersion.id,
      });

      expect(result.canDeactivate).toBe(true);
      expect(result.hasPublishedVersion).toBe(false);
    });
  });

  describe("permissions (AC12)", () => {
    it("should allow ORG_ADMIN to create templates", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.riskMatrix.createTemplate({
        name: `Admin Create Matrix Test ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      expect(result).toBeDefined();
    });

    it("should reject GRC_ANALYST from creating templates", async () => {
      const caller = createCaller(analystUser);

      await expect(
        caller.riskMatrix.createTemplate({
          name: `Analyst Create Matrix Test ${Date.now()}`,
          dimensionCount: 2,
          outputScaleMax: 25,
        })
      ).rejects.toThrow(/requires one of these roles|unauthorized|forbidden/i);
    });

    it("should reject GRC_ANALYST from updating templates", async () => {
      // First create a template as admin
      const adminCaller = createCaller(adminUser);
      const template = await adminCaller.riskMatrix.createTemplate({
        name: `Analyst Update Matrix Test ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // Try to update as analyst
      const analystCaller = createCaller(analystUser);
      await expect(
        analystCaller.riskMatrix.updateTemplate({
          id: template.id,
          name: "Modified by Analyst",
        })
      ).rejects.toThrow(/requires one of these roles|unauthorized|forbidden/i);
    });
  });

  describe("organization isolation", () => {
    let otherOrg: { id: string };
    let otherOrgUser: { id: string; email: string; organizationId: string; role: UserRole };

    beforeAll(async () => {
      // Create another organization
      otherOrg = await db.organization.create({
        data: {
          id: randomUUID(),
          name: `Other Org Matrix Test ${Date.now()}`,
          slug: `other-org-matrix-test-${Date.now()}`,
          updatedAt: new Date(),
        },
      });

      otherOrgUser = await db.user.create({
        data: {
          id: randomUUID(),
          email: `other-org-matrix-${Date.now()}@example.com`,
          name: "Other Org User",
          organizationId: otherOrg.id,
          role: UserRole.ORG_ADMIN,
          updatedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (otherOrg) {
        await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT "id" FROM "RiskMatrixTemplate" WHERE "organizationId" = ${otherOrg.id})`;
        await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${otherOrg.id}`;
        await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${otherOrg.id}`;
      }
    });

    it("should not return templates from other organizations", async () => {
      // Create template in main org
      const mainCaller = createCaller(adminUser);
      const mainTemplate = await mainCaller.riskMatrix.createTemplate({
        name: `Main Org Matrix ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // Create template in other org
      const otherCaller = createCaller(otherOrgUser);
      await otherCaller.riskMatrix.createTemplate({
        name: `Other Org Matrix ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // List from main org should not include other org's templates
      const mainList = await mainCaller.riskMatrix.listTemplates({ includeInactive: true });
      mainList.forEach((template) => {
        expect(template.organizationId).toBe(testOrg.id);
      });

      // getTemplate should fail for other org's template
      await expect(
        otherCaller.riskMatrix.getTemplate({ id: mainTemplate.id })
      ).rejects.toThrow(/not found/i);
    });

    it("should not allow updating templates from other organizations", async () => {
      // Create template in main org
      const mainCaller = createCaller(adminUser);
      const mainTemplate = await mainCaller.riskMatrix.createTemplate({
        name: `Main Org Matrix Update Test ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // Try to update from other org
      const otherCaller = createCaller(otherOrgUser);
      await expect(
        otherCaller.riskMatrix.updateTemplate({
          id: mainTemplate.id,
          name: "Hacked Name",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("getActiveTemplates query", () => {
    it("should only return active templates with published versions", async () => {
      const caller = createCaller(adminUser);

      // Create a template without published version
      const templateNoVersion = await caller.riskMatrix.createTemplate({
        name: `No Version Template ${Date.now()}`,
        dimensionCount: 2,
        outputScaleMax: 25,
      });

      // getActiveTemplates should not include it (no currentVersionId)
      const activeTemplates = await caller.riskMatrix.getActiveTemplates();
      expect(activeTemplates.find((t) => t.id === templateNoVersion.id)).toBeUndefined();
    });

    it("should be accessible by GRC_ANALYST (organizationProcedure)", async () => {
      const caller = createCaller(analystUser);

      // Should not throw permission error
      const result = await caller.riskMatrix.getActiveTemplates();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
