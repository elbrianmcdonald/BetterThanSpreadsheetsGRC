/**
 * Organization Defaults Seeding
 *
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 *
 * Seeds default assessment type and risk matrix for new organizations.
 * Enables immediate use without complex setup.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import {
  DEFAULT_ASSESSMENT_TYPE,
  DEFAULT_MATRIX_TEMPLATE,
  DEFAULT_SCALES,
  DEFAULT_THRESHOLDS,
} from "./defaults";

/**
 * Result of seeding operation
 */
export interface SeedingResult {
  success: boolean;
  assessmentTypeId?: string;
  templateId?: string;
  versionId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Check if organization already has defaults seeded
 * AC20: Script skips orgs that already have assessment types/matrices
 */
export async function hasOrganizationDefaults(
  db: PrismaClient,
  organizationId: string
): Promise<{ hasAssessmentType: boolean; hasTemplate: boolean }> {
  const [assessmentType, template] = await Promise.all([
    db.assessmentType.findFirst({
      where: { organizationId, isDefault: true },
    }),
    db.riskMatrixTemplate.findFirst({
      where: { organizationId, isDefault: true },
    }),
  ]);

  return {
    hasAssessmentType: !!assessmentType,
    hasTemplate: !!template,
  };
}

/**
 * Seed default assessment type for an organization
 * AC1: "General Risk Assessment" type seeded
 * AC2: With standard description
 * AC4: Marked as isDefault for protection
 */
export async function seedDefaultAssessmentType(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> {
  const assessmentType = await tx.assessmentType.create({
    data: {
      organizationId,
      name: DEFAULT_ASSESSMENT_TYPE.name,
      description: DEFAULT_ASSESSMENT_TYPE.description,
      isDefault: true,
      isActive: true,
    },
  });

  return assessmentType.id;
}

/**
 * Seed default risk matrix template with published version
 * AC5: "Standard Risk Matrix" template seeded
 * AC6: 2D matrix (Likelihood × Impact)
 * AC7: Output scale max = 25 (5×5 grid)
 * AC8: Pre-configured scales
 * AC9: Pre-configured thresholds
 * AC10: Version 1 auto-published
 */
export async function seedDefaultMatrixTemplate(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<{ templateId: string; versionId: string }> {
  // Create template
  const template = await tx.riskMatrixTemplate.create({
    data: {
      organizationId,
      name: DEFAULT_MATRIX_TEMPLATE.name,
      description: DEFAULT_MATRIX_TEMPLATE.description,
      dimensionCount: DEFAULT_MATRIX_TEMPLATE.dimensionCount,
      gridSize: DEFAULT_MATRIX_TEMPLATE.gridSize,
      outputScaleMax: DEFAULT_MATRIX_TEMPLATE.outputScaleMax,
      isDefault: true,
      isActive: true,
    },
  });

  // Create and publish version 1
  const version = await tx.riskMatrixVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      scales: DEFAULT_SCALES as object,
      thresholds: DEFAULT_THRESHOLDS as object[],
      isActive: true,
      publishedAt: new Date(),
      // Note: publishedBy is null for system-seeded versions
    },
  });

  // Link version as current
  await tx.riskMatrixTemplate.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
  });

  return { templateId: template.id, versionId: version.id };
}

/**
 * Seed all defaults for an organization
 * AC3: Seeding happens during organization creation
 * AC19: Can also be run for existing organizations
 * AC20: Skips if defaults already exist
 *
 * Wraps all operations in a transaction for atomicity.
 */
export async function seedOrganizationDefaults(
  db: PrismaClient,
  organizationId: string,
  options: { force?: boolean } = {}
): Promise<SeedingResult> {
  try {
    // Check if already seeded (unless force is true)
    if (!options.force) {
      const existing = await hasOrganizationDefaults(db, organizationId);
      if (existing.hasAssessmentType && existing.hasTemplate) {
        return {
          success: true,
          skipped: true,
        };
      }
    }

    // Seed in transaction
    const result = await db.$transaction(async (tx) => {
      // Check again inside transaction for race condition safety
      const existing = await Promise.all([
        tx.assessmentType.findFirst({
          where: { organizationId, isDefault: true },
        }),
        tx.riskMatrixTemplate.findFirst({
          where: { organizationId, isDefault: true },
        }),
      ]);

      let assessmentTypeId: string | undefined;
      let templateId: string | undefined;
      let versionId: string | undefined;

      // Seed assessment type if not exists
      if (!existing[0]) {
        assessmentTypeId = await seedDefaultAssessmentType(tx, organizationId);
      } else {
        assessmentTypeId = existing[0].id;
      }

      // Seed matrix template if not exists
      if (!existing[1]) {
        const matrixResult = await seedDefaultMatrixTemplate(tx, organizationId);
        templateId = matrixResult.templateId;
        versionId = matrixResult.versionId;
      } else {
        templateId = existing[1].id;
      }

      return { assessmentTypeId, templateId, versionId };
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error(`[SEED] Failed to seed defaults for org ${organizationId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Seed defaults for multiple organizations
 * AC19: Seeding script can be run for existing organizations
 * AC20: Script skips orgs that already have assessment types/matrices
 *
 * @param db - Prisma client
 * @param organizationIds - Array of org IDs (if empty, seeds all orgs without defaults)
 */
export async function seedDefaultsForOrganizations(
  db: PrismaClient,
  organizationIds?: string[]
): Promise<Map<string, SeedingResult>> {
  const results = new Map<string, SeedingResult>();

  // If no IDs provided, find all orgs without defaults
  let orgsToSeed: { id: string; name: string }[];

  if (!organizationIds || organizationIds.length === 0) {
    // Find all organizations
    const allOrgs = await db.organization.findMany({
      select: { id: true, name: true },
    });

    // Find organizations that have default assessment types
    const orgsWithDefaults = await db.assessmentType.findMany({
      where: { isDefault: true },
      select: { organizationId: true },
    });

    const orgIdsWithDefaults = new Set(orgsWithDefaults.map((a) => a.organizationId));

    // Filter to orgs without defaults
    orgsToSeed = allOrgs.filter((org) => !orgIdsWithDefaults.has(org.id));
  } else {
    orgsToSeed = await db.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
    });
  }

  console.log(`[SEED] Found ${orgsToSeed.length} organizations to seed`);

  for (const org of orgsToSeed) {
    console.log(`[SEED] Seeding defaults for: ${org.name} (${org.id})`);
    const result = await seedOrganizationDefaults(db, org.id);
    results.set(org.id, result);

    if (result.success) {
      if (result.skipped) {
        console.log(`[SEED] Skipped (already has defaults): ${org.name}`);
      } else {
        console.log(`[SEED] Successfully seeded: ${org.name}`);
      }
    } else {
      console.error(`[SEED] Failed for ${org.name}: ${result.error}`);
    }
  }

  return results;
}
