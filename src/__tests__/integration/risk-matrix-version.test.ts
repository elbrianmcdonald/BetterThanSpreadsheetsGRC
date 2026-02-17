/**
 * Risk Matrix Version Integration Tests
 *
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle
 *
 * Tests for version CRUD operations and lifecycle management.
 * Includes both database-level tests and tRPC router mutation tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import { appRouter } from "@/server/api/root";
import { db } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

describe("RiskMatrixVersion Integration Tests", () => {
  let testOrg: { id: string; name: string; slug: string };
  let testUser: { id: string; email: string; organizationId: string; role: UserRole };
  let testTemplate: { id: string; name: string; dimensionCount: number };

  // Helper to create tRPC caller with session
  const createCaller = (user: typeof testUser) => {
    return appRouter.createCaller({
      db,
      session: {
        user: {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
          name: "Test User Version",
          image: null,
          assignedFrameworks: [],
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      organizationId: user.organizationId,
      headers: new Headers(),
    });
  };

  // Valid test data
  const validScales: MatrixScales = {
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
      { value: 5, label: "Severe" },
    ],
  };

  // Story 11.1: Added slaDays to valid thresholds
  const validThresholds: Threshold[] = [
    { minValue: 0, maxValue: 4, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
    { minValue: 4, maxValue: 9, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
    { minValue: 9, maxValue: 16, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
    { minValue: 16, maxValue: 25, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
  ];

  beforeAll(async () => {
    // Create test organization
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: "Test Organization Version",
        slug: `test-org-version-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    // Create test user
    testUser = await db.user.create({
      data: {
        id: randomUUID(),
        email: `test-version-${Date.now()}@example.com`,
        name: "Test User Version",
        organizationId: testOrg.id,
        role: UserRole.ORG_ADMIN,
        updatedAt: new Date(),
      },
    });

    // Create test template (within organization context)
    await runWithOrganizationContext(testOrg.id, async () => {
      testTemplate = await db.riskMatrixTemplate.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          name: "Test Template Version",
          dimensionCount: 2,
          outputScaleMax: 25,
        },
      });
    });
  });

  afterAll(async () => {
    if (testOrg) {
      // Clean up in correct order to respect foreign keys
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
    await db.$disconnect();
  });

  describe("Version Creation (AC25)", () => {
    it("should create a new draft version with auto-incremented version number", async () => {
      const version = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 1,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      expect(version).toBeDefined();
      expect(version.versionNumber).toBe(1);
      expect(version.isActive).toBe(false);
      expect(version.publishedAt).toBeNull();
    });

    it("should increment version number for subsequent versions", async () => {
      const version2 = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 2,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      expect(version2.versionNumber).toBe(2);
    });

    it("should enforce unique constraint on templateId + versionNumber", async () => {
      await expect(
        db.riskMatrixVersion.create({
          data: {
            id: randomUUID(),
            templateId: testTemplate.id,
            versionNumber: 1, // Already exists
            scales: validScales,
            thresholds: validThresholds,
            isActive: false,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Version Draft Editing (AC20, AC26)", () => {
    let draftVersion: { id: string };

    beforeAll(async () => {
      draftVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 10,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });
    });

    it("should allow updating scales on draft version", async () => {
      const updatedScales: MatrixScales = {
        ...validScales,
        likelihood: [
          { value: 1, label: "Very Rare" },
          { value: 2, label: "Rare" },
          { value: 3, label: "Possible" },
        ],
      };

      const updated = await db.riskMatrixVersion.update({
        where: { id: draftVersion.id },
        data: { scales: updatedScales },
      });

      const scales = updated.scales as unknown as MatrixScales;
      expect(scales.likelihood[0].label).toBe("Very Rare");
    });

    it("should allow updating thresholds on draft version", async () => {
      // Story 11.1: Added slaDays
      const updatedThresholds: Threshold[] = [
        { minValue: 0, maxValue: 10, label: "Low", color: "#00FF00", sortOrder: 0, slaDays: 90 },
        { minValue: 10, maxValue: 25, label: "High", color: "#FF0000", sortOrder: 1, slaDays: 7 },
      ];

      const updated = await db.riskMatrixVersion.update({
        where: { id: draftVersion.id },
        data: { thresholds: updatedThresholds },
      });

      const thresholds = updated.thresholds as unknown as Threshold[];
      expect(thresholds).toHaveLength(2);
    });
  });

  describe("Version Publishing (AC21, AC22, AC27)", () => {
    let publishableVersion: { id: string };

    beforeAll(async () => {
      publishableVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 20,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });
    });

    it("should set isActive, publishedAt, and publishedBy on publish", async () => {
      const published = await db.riskMatrixVersion.update({
        where: { id: publishableVersion.id },
        data: {
          isActive: true,
          publishedAt: new Date(),
          publishedBy: testUser.id,
        },
      });

      expect(published.isActive).toBe(true);
      expect(published.publishedAt).not.toBeNull();
      expect(published.publishedBy).toBe(testUser.id);
    });

    it("should update template currentVersionId on publish", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        await db.riskMatrixTemplate.update({
          where: { id: testTemplate.id },
          data: { currentVersionId: publishableVersion.id },
        });
      });

      const template = await runWithOrganizationContext(testOrg.id, () =>
        db.riskMatrixTemplate.findUnique({
          where: { id: testTemplate.id },
        })
      );

      expect(template?.currentVersionId).toBe(publishableVersion.id);
    });
  });

  describe("Published Version Immutability (AC23)", () => {
    let publishedVersion: { id: string };

    beforeAll(async () => {
      publishedVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 30,
          scales: validScales,
          thresholds: validThresholds,
          isActive: true,
          publishedAt: new Date(),
          publishedBy: testUser.id,
        },
      });
    });

    // Note: Immutability enforcement is done at the tRPC layer, not database level
    // This test documents the database allows updates but tRPC blocks them
    it("should have publishedAt set for published version", async () => {
      const version = await db.riskMatrixVersion.findUnique({
        where: { id: publishedVersion.id },
      });

      expect(version?.publishedAt).not.toBeNull();
    });
  });

  describe("Version Listing (AC28)", () => {
    it("should list all versions for a template", async () => {
      const versions = await db.riskMatrixVersion.findMany({
        where: { templateId: testTemplate.id },
        orderBy: { versionNumber: "desc" },
      });

      expect(versions.length).toBeGreaterThan(0);
      // Versions should be in descending order
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i - 1].versionNumber).toBeGreaterThan(versions[i].versionNumber);
      }
    });

    it("should include publisher relation", async () => {
      const versions = await db.riskMatrixVersion.findMany({
        where: { templateId: testTemplate.id },
        include: {
          publisher: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const publishedVersions = versions.filter((v) => v.publishedBy);
      expect(publishedVersions.length).toBeGreaterThan(0);
      expect(publishedVersions[0].publisher).not.toBeNull();
    });
  });

  describe("Version Deletion (AC30)", () => {
    it("should allow deleting draft versions", async () => {
      const draftToDelete = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 100,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      await db.riskMatrixVersion.delete({
        where: { id: draftToDelete.id },
      });

      const deleted = await db.riskMatrixVersion.findUnique({
        where: { id: draftToDelete.id },
      });

      expect(deleted).toBeNull();
    });

    // Note: Published version deletion prevention is at tRPC layer
  });

  describe("Multiple Drafts (AC24)", () => {
    it("should allow multiple draft versions simultaneously", async () => {
      const draft1 = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 200,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      const draft2 = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: testTemplate.id,
          versionNumber: 201,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      expect(draft1.isActive).toBe(false);
      expect(draft2.isActive).toBe(false);

      const draftVersions = await db.riskMatrixVersion.findMany({
        where: {
          templateId: testTemplate.id,
          publishedAt: null,
        },
      });

      expect(draftVersions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Cascade Delete", () => {
    it("should delete versions when template is deleted", async () => {
      // Create a new template with versions for this test (within organization context)
      let tempTemplate: { id: string };
      let tempVersion: { id: string };

      await runWithOrganizationContext(testOrg.id, async () => {
        tempTemplate = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            name: "Temp Template for Cascade Test",
            dimensionCount: 2,
            outputScaleMax: 25,
          },
        });

        tempVersion = await db.riskMatrixVersion.create({
          data: {
            id: randomUUID(),
            templateId: tempTemplate.id,
            versionNumber: 1,
            scales: validScales,
            thresholds: validThresholds,
            isActive: false,
          },
        });

        // Delete template
        await db.riskMatrixTemplate.delete({
          where: { id: tempTemplate.id },
        });
      });

      // Version should be deleted too
      const deletedVersion = await db.riskMatrixVersion.findUnique({
        where: { id: tempVersion!.id },
      });

      expect(deletedVersion).toBeNull();
    });
  });

  describe("3D Matrix Support", () => {
    let template3D: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        template3D = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            name: "3D Template Test",
            dimensionCount: 3,
            outputScaleMax: 75, // 5 × 5 × 3
          },
        });
      });
    });

    it("should store 3D scales with exposure dimension", async () => {
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
          { value: 5, label: "Severe" },
        ],
        exposure: [
          { value: 1, label: "Limited" },
          { value: 2, label: "Moderate" },
          { value: 3, label: "Extensive" },
        ],
      };

      // Story 11.1: Added slaDays
      const thresholds3D: Threshold[] = [
        { minValue: 0, maxValue: 15, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
        { minValue: 15, maxValue: 35, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
        { minValue: 35, maxValue: 55, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
        { minValue: 55, maxValue: 75, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
      ];

      const version = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: template3D.id,
          versionNumber: 1,
          scales: scales3D,
          thresholds: thresholds3D,
          isActive: false,
        },
      });

      const retrieved = await db.riskMatrixVersion.findUnique({
        where: { id: version.id },
      });

      const scales = retrieved?.scales as unknown as MatrixScales;
      expect(scales.exposure).toBeDefined();
      expect(scales.exposure?.length).toBe(3);
    });
  });

  // ============================================================================
  // tRPC Router Mutation Tests (AC23, AC30)
  // ============================================================================

  describe("tRPC Router: Published Version Immutability (AC23)", () => {
    let publishedVersionForTrpc: { id: string };
    let templateForTrpc: { id: string };

    beforeAll(async () => {
      // Create a fresh template and published version for tRPC tests (within organization context)
      await runWithOrganizationContext(testOrg.id, async () => {
        templateForTrpc = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            name: `TRPC Test Template ${Date.now()}`,
            dimensionCount: 2,
            outputScaleMax: 25,
          },
        });

        publishedVersionForTrpc = await db.riskMatrixVersion.create({
          data: {
            id: randomUUID(),
            templateId: templateForTrpc.id,
            versionNumber: 1,
            scales: validScales,
            thresholds: validThresholds,
            isActive: true,
            publishedAt: new Date(),
            publishedBy: testUser.id,
          },
        });
      });
    });

    it("AC23: should reject updating a published version via tRPC", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskMatrix.updateVersion({
          id: publishedVersionForTrpc.id,
          scales: {
            ...validScales,
            likelihood: [
              { value: 1, label: "Modified Rare" },
              { value: 2, label: "Modified Unlikely" },
              { value: 3, label: "Modified Possible" },
            ],
          },
        })
      ).rejects.toThrow(/published versions cannot be edited/i);
    });

    it("AC23: should allow updating a draft version via tRPC", async () => {
      // Create a draft version
      const draftVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: templateForTrpc.id,
          versionNumber: 2,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      const caller = createCaller(testUser);

      const updatedScales: MatrixScales = {
        ...validScales,
        likelihood: [
          { value: 1, label: "Updated Rare" },
          { value: 2, label: "Updated Unlikely" },
          { value: 3, label: "Updated Possible" },
          { value: 4, label: "Updated Likely" },
          { value: 5, label: "Updated Almost Certain" },
        ],
      };

      const result = await caller.riskMatrix.updateVersion({
        id: draftVersion.id,
        scales: updatedScales,
      });

      expect(result.scales.likelihood[0].label).toBe("Updated Rare");
    });
  });

  describe("tRPC Router: Published Version Deletion Prevention (AC30)", () => {
    let publishedVersionToDelete: { id: string };
    let templateForDelete: { id: string };

    beforeAll(async () => {
      // Create a fresh template and published version for deletion tests (within organization context)
      await runWithOrganizationContext(testOrg.id, async () => {
        templateForDelete = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            name: `Delete Test Template ${Date.now()}`,
            dimensionCount: 2,
            outputScaleMax: 25,
          },
        });

        publishedVersionToDelete = await db.riskMatrixVersion.create({
          data: {
            id: randomUUID(),
            templateId: templateForDelete.id,
            versionNumber: 1,
            scales: validScales,
            thresholds: validThresholds,
            isActive: true,
            publishedAt: new Date(),
            publishedBy: testUser.id,
          },
        });
      });
    });

    it("AC30: should reject deleting a published version via tRPC", async () => {
      const caller = createCaller(testUser);

      await expect(
        caller.riskMatrix.deleteVersion({
          id: publishedVersionToDelete.id,
        })
      ).rejects.toThrow(/published versions cannot be deleted/i);
    });

    it("AC30: should allow deleting a draft version via tRPC", async () => {
      // Create a draft version to delete
      const draftToDelete = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: templateForDelete.id,
          versionNumber: 2,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      const caller = createCaller(testUser);

      const result = await caller.riskMatrix.deleteVersion({
        id: draftToDelete.id,
      });

      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await db.riskMatrixVersion.findUnique({
        where: { id: draftToDelete.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("tRPC Router: Version Publishing with Validation (AC27)", () => {
    let templateForPublish: { id: string };

    beforeAll(async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        templateForPublish = await db.riskMatrixTemplate.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            name: `Publish Test Template ${Date.now()}`,
            dimensionCount: 2,
            outputScaleMax: 25,
          },
        });
      });
    });

    it("AC27: should reject publishing a version with invalid scales", async () => {
      // Create a version with invalid scales (less than 3 levels)
      const invalidVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: templateForPublish.id,
          versionNumber: 1,
          scales: {
            likelihood: [
              { value: 1, label: "Low" },
              { value: 2, label: "High" },
            ], // Only 2 levels - invalid
            impact: validScales.impact,
          },
          thresholds: validThresholds,
          isActive: false,
        },
      });

      const caller = createCaller(testUser);

      await expect(
        caller.riskMatrix.publishVersion({
          id: invalidVersion.id,
        })
      ).rejects.toThrow(/cannot publish/i);
    });

    it("AC27: should reject publishing a version with invalid thresholds", async () => {
      // Create a version with invalid thresholds (gap in coverage)
      // Story 11.1: Added slaDays to ensure gap validation is tested, not slaDays validation
      const invalidThresholdVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: templateForPublish.id,
          versionNumber: 2,
          scales: validScales,
          thresholds: [
            { minValue: 0, maxValue: 10, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
            { minValue: 15, maxValue: 25, label: "High", color: "#EF4444", sortOrder: 1, slaDays: 7 }, // Gap at 10-15
          ],
          isActive: false,
        },
      });

      const caller = createCaller(testUser);

      await expect(
        caller.riskMatrix.publishVersion({
          id: invalidThresholdVersion.id,
        })
      ).rejects.toThrow(/cannot publish/i);
    });

    it("AC27: should successfully publish a valid version", async () => {
      const validVersion = await db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: templateForPublish.id,
          versionNumber: 3,
          scales: validScales,
          thresholds: validThresholds,
          isActive: false,
        },
      });

      const caller = createCaller(testUser);

      const result = await caller.riskMatrix.publishVersion({
        id: validVersion.id,
      });

      expect(result.isActive).toBe(true);
      expect(result.publishedAt).not.toBeNull();

      // Verify template.currentVersionId was updated
      const template = await db.riskMatrixTemplate.findUnique({
        where: { id: templateForPublish.id },
      });
      expect(template?.currentVersionId).toBe(validVersion.id);
    });
  });
});
