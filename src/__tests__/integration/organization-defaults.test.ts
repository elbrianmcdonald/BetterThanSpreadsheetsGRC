/**
 * Organization Defaults Integration Tests
 *
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 *
 * Tests for default seeding during organization creation and migration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

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

      // Verify scales match the seeded defaults (now a 3×3 matrix —
      // Low/Medium/High — per DEFAULT_SCALES; asserting against the source of
      // truth keeps this resilient to future default-grid changes).
      const scales = version?.scales as unknown as MatrixScales;
      expect(scales.likelihood).toHaveLength(DEFAULT_SCALES.likelihood.length);
      expect(scales.impact).toHaveLength(DEFAULT_SCALES.impact.length);
      expect(scales.likelihood).toEqual(DEFAULT_SCALES.likelihood);
      expect(scales.impact).toEqual(DEFAULT_SCALES.impact);
    });

    it("should create version with correct thresholds (AC15-AC18)", async () => {
      const template = await db.riskMatrixTemplate.findFirst({
        where: { organizationId: testOrg.id, isDefault: true },
      });

      const version = await db.riskMatrixVersion.findFirst({
        where: { templateId: template!.id },
      });

      // Thresholds match the seeded defaults. The default matrix is now 3×3
      // (score range 0–9) with Low/Medium/High bands; assert against the source
      // of truth (DEFAULT_THRESHOLDS) so this doesn't drift with grid changes.
      const thresholds = version?.thresholds as unknown as Threshold[];

      expect(thresholds).toHaveLength(DEFAULT_THRESHOLDS.length);
      expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
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
