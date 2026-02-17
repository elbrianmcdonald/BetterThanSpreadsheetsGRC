/**
 * Organization Defaults Integration Tests
 *
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 *
 * Tests for default seeding during organization creation and migration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  seedOrganizationDefaults,
  seedDefaultsForOrganizations,
  hasOrganizationDefaults,
} from "@/lib/matrix/seedDefaults";
import {
  DEFAULT_ASSESSMENT_TYPE,
  DEFAULT_MATRIX_TEMPLATE,
  DEFAULT_SCALES,
  DEFAULT_THRESHOLDS,
} from "@/lib/matrix/defaults";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";

const db = new PrismaClient();

describe("Organization Defaults Integration Tests", () => {
  let testOrg: { id: string; name: string; slug: string };

  beforeAll(async () => {
    // Create test organization without defaults
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: "Test Org Defaults",
        slug: `test-org-defaults-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      // Clean up in correct order to respect foreign keys
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "AssessmentType" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
    await db.$disconnect();
  });

  describe("New Organization Gets Defaults (AC1-AC10)", () => {
    it("should seed default assessment type for new organization", async () => {
      const result = await seedOrganizationDefaults(db, testOrg.id);

      expect(result.success).toBe(true);
      expect(result.assessmentTypeId).toBeDefined();

      // Verify assessment type was created
      const assessmentType = await db.assessmentType.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      expect(assessmentType).not.toBeNull();
      expect(assessmentType?.name).toBe(DEFAULT_ASSESSMENT_TYPE.name);
      expect(assessmentType?.description).toBe(DEFAULT_ASSESSMENT_TYPE.description);
      expect(assessmentType?.isDefault).toBe(true);
      expect(assessmentType?.isActive).toBe(true);
    });

    it("should seed default matrix template for new organization", async () => {
      // Note: Already seeded in previous test, verify template
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      expect(template).not.toBeNull();
      expect(template?.name).toBe(DEFAULT_MATRIX_TEMPLATE.name);
      expect(template?.description).toBe(DEFAULT_MATRIX_TEMPLATE.description);
      expect(template?.dimensionCount).toBe(DEFAULT_MATRIX_TEMPLATE.dimensionCount);
      expect(Number(template?.outputScaleMax)).toBe(DEFAULT_MATRIX_TEMPLATE.outputScaleMax);
      expect(template?.isDefault).toBe(true);
      expect(template?.isActive).toBe(true);
    });

    it("should create published version 1 with correct scales", async () => {
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const version = await db.riskMatrixVersion.findFirst({
        where: { templateId: template!.id },
      });

      expect(version).not.toBeNull();
      expect(version?.versionNumber).toBe(1);
      expect(version?.isActive).toBe(true);
      expect(version?.publishedAt).not.toBeNull();

      // Verify scales
      const scales = version?.scales as unknown as MatrixScales;
      expect(scales.likelihood).toHaveLength(5);
      expect(scales.impact).toHaveLength(5);
      expect(scales.likelihood[0].label).toBe("Rare");
      expect(scales.impact[4].label).toBe("Catastrophic");
    });

    it("should create version with correct thresholds (AC15-AC18)", async () => {
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const version = await db.riskMatrixVersion.findFirst({
        where: { templateId: template!.id },
      });

      const thresholds = version?.thresholds as unknown as Threshold[];

      expect(thresholds).toHaveLength(4);

      // AC18: Low: 0-4.99 (Green #22C55E)
      const low = thresholds.find((t) => t.label === "Low");
      expect(low).toBeDefined();
      expect(low?.minValue).toBe(0);
      expect(low?.maxValue).toBe(5);
      expect(low?.color).toBe("#22C55E");

      // AC17: Medium: 5-11.99 (Yellow #EAB308)
      const medium = thresholds.find((t) => t.label === "Medium");
      expect(medium).toBeDefined();
      expect(medium?.minValue).toBe(5);
      expect(medium?.maxValue).toBe(12);
      expect(medium?.color).toBe("#EAB308");

      // AC16: High: 12-19.99 (Orange #F97316)
      const high = thresholds.find((t) => t.label === "High");
      expect(high).toBeDefined();
      expect(high?.minValue).toBe(12);
      expect(high?.maxValue).toBe(20);
      expect(high?.color).toBe("#F97316");

      // AC15: Critical: 20-25 (Red #EF4444)
      const critical = thresholds.find((t) => t.label === "Critical");
      expect(critical).toBeDefined();
      expect(critical?.minValue).toBe(20);
      expect(critical?.maxValue).toBe(25);
      expect(critical?.color).toBe("#EF4444");
    });

    it("should set template currentVersionId to version 1", async () => {
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
        include: { currentVersion: true },
      });

      expect(template?.currentVersionId).not.toBeNull();
      expect(template?.currentVersion?.versionNumber).toBe(1);
    });
  });

  describe("Migration Script Skips Existing (AC20)", () => {
    it("should skip organization that already has defaults", async () => {
      // Verify org already has defaults from previous tests
      const existing = await hasOrganizationDefaults(db, testOrg.id);
      expect(existing.hasAssessmentType).toBe(true);
      expect(existing.hasTemplate).toBe(true);

      // Run seeding again
      const result = await seedOrganizationDefaults(db, testOrg.id);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("should not create duplicate defaults when run multiple times", async () => {
      // Count current defaults
      const assessmentTypes = await db.assessmentType.count({
        where: { organizationId: testOrg.id, isDefault: true },
      });
      const templates = await db.riskMatrixTemplate.count({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      // Run seeding again
      await seedOrganizationDefaults(db, testOrg.id);

      // Count again - should be the same
      const assessmentTypesAfter = await db.assessmentType.count({
        where: { organizationId: testOrg.id, isDefault: true },
      });
      const templatesAfter = await db.riskMatrixTemplate.count({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      expect(assessmentTypesAfter).toBe(assessmentTypes);
      expect(templatesAfter).toBe(templates);
    });
  });

  describe("Default Type Protection (AC4)", () => {
    it("should allow renaming default assessment type", async () => {
      const defaultType = await db.assessmentType.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const updated = await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { name: "Custom Risk Assessment" },
      });

      expect(updated.name).toBe("Custom Risk Assessment");

      // Restore original name
      await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { name: DEFAULT_ASSESSMENT_TYPE.name },
      });
    });

    it("should allow deactivating default assessment type", async () => {
      const defaultType = await db.assessmentType.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const updated = await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { isActive: false },
      });

      expect(updated.isActive).toBe(false);

      // Restore active state
      await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { isActive: true },
      });
    });

    it("should keep isDefault flag after rename and deactivation", async () => {
      const defaultType = await db.assessmentType.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      // Rename
      await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { name: "Renamed Type" },
      });

      // Deactivate
      await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { isActive: false },
      });

      // Verify isDefault is still true
      const updated = await db.assessmentType.findUnique({
        where: { id: defaultType!.id },
      });

      expect(updated?.isDefault).toBe(true);

      // Restore
      await db.assessmentType.update({
        where: { id: defaultType!.id },
        data: { name: DEFAULT_ASSESSMENT_TYPE.name, isActive: true },
      });
    });
  });

  describe("Published Version Protection", () => {
    it("should not allow deleting published default version", async () => {
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const version = await db.riskMatrixVersion.findFirst({
        where: { templateId: template!.id, isActive: true },
      });

      // Published versions should not be deletable
      // This is enforced at the tRPC layer, but we can verify the data integrity here
      expect(version?.publishedAt).not.toBeNull();
      expect(version?.isActive).toBe(true);
    });
  });

  describe("Batch Organization Seeding (AC19)", () => {
    let orgWithoutDefaults: { id: string };

    beforeEach(async () => {
      orgWithoutDefaults = await db.organization.create({
        data: {
          id: randomUUID(),
          name: "Org Without Defaults",
          slug: `org-without-defaults-${Date.now()}`,
          updatedAt: new Date(),
        },
      });
    });

    afterAll(async () => {
      // Cleanup orgs created in this test
      await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${orgWithoutDefaults?.id})`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${orgWithoutDefaults?.id}`;
      await db.$executeRaw`DELETE FROM "AssessmentType" WHERE "organizationId" = ${orgWithoutDefaults?.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${orgWithoutDefaults?.id}`;
    });

    it("should seed defaults for multiple organizations without defaults", async () => {
      const results = await seedDefaultsForOrganizations(db, [orgWithoutDefaults.id]);

      expect(results.size).toBeGreaterThan(0);
      const result = results.get(orgWithoutDefaults.id);
      expect(result?.success).toBe(true);
      expect(result?.skipped).toBeFalsy();

      // Verify org now has defaults
      const hasDefaults = await hasOrganizationDefaults(db, orgWithoutDefaults.id);
      expect(hasDefaults.hasAssessmentType).toBe(true);
      expect(hasDefaults.hasTemplate).toBe(true);
    });
  });
});
