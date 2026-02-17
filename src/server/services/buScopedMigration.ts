/**
 * BU-Scoped Compliance Data Migration
 *
 * Story 6: Migrate existing data to support BU-scoped compliance
 *
 * This migration script:
 * 1. Creates a default "Organization-Wide" BU for orgs without BUs
 * 2. Assigns all existing evidence to the default/first BU
 * 3. Assigns all active frameworks to all existing BUs
 * 4. Triggers coverage recalculation for all BU-Framework pairs
 */

import { PrismaClient } from "@prisma/client";
import { refreshBUFrameworkCoverage } from "./complianceCalculator";

export interface MigrationResult {
  organizationId: string;
  organizationName: string;
  createdDefaultBU: boolean;
  defaultBUId: string | null;
  evidenceMigrated: number;
  frameworkAssignmentsCreated: number;
  coverageRecalculated: number;
  errors: string[];
}

/**
 * Migrate a single organization to BU-scoped compliance
 */
export async function migrateOrganizationToBUScoped(
  organizationId: string,
  db: PrismaClient
): Promise<MigrationResult> {
  const result: MigrationResult = {
    organizationId,
    organizationName: "",
    createdDefaultBU: false,
    defaultBUId: null,
    evidenceMigrated: 0,
    frameworkAssignmentsCreated: 0,
    coverageRecalculated: 0,
    errors: [],
  };

  try {
    // Get organization details
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!org) {
      result.errors.push(`Organization ${organizationId} not found`);
      return result;
    }

    result.organizationName = org.name;

    // Step 1: Ensure organization has at least one business unit
    let defaultBU = await db.businessUnit.findFirst({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" }, // Get oldest/first BU
    });

    if (!defaultBU) {
      // Create a default BU for the organization
      defaultBU = await db.businessUnit.create({
        data: {
          name: "Organization-Wide",
          code: "ORG-WIDE",
          organizationId,
          isActive: true,
        },
      });
      result.createdDefaultBU = true;
    }

    result.defaultBUId = defaultBU.id;

    // Step 2: Migrate evidence without businessUnitId
    const evidenceToMigrate = await db.evidence.findMany({
      where: {
        organizationId,
        businessUnitId: null,
      },
      select: { id: true },
    });

    if (evidenceToMigrate.length > 0) {
      await db.evidence.updateMany({
        where: {
          organizationId,
          businessUnitId: null,
        },
        data: {
          businessUnitId: defaultBU.id,
        },
      });
      result.evidenceMigrated = evidenceToMigrate.length;
    }

    // Step 3: Get all active BUs and frameworks
    const businessUnits = await db.businessUnit.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    const frameworks = await db.framework.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    // Step 4: Create framework assignments for all BU-Framework pairs
    const existingAssignments = await db.businessUnitFramework.findMany({
      where: { organizationId },
      select: { businessUnitId: true, frameworkId: true },
    });

    const existingSet = new Set(
      existingAssignments.map((a) => `${a.businessUnitId}:${a.frameworkId}`)
    );

    const newAssignments: Array<{
      businessUnitId: string;
      frameworkId: string;
      organizationId: string;
    }> = [];

    for (const bu of businessUnits) {
      for (const fw of frameworks) {
        const key = `${bu.id}:${fw.id}`;
        if (!existingSet.has(key)) {
          newAssignments.push({
            businessUnitId: bu.id,
            frameworkId: fw.id,
            organizationId,
          });
        }
      }
    }

    if (newAssignments.length > 0) {
      await db.businessUnitFramework.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
      result.frameworkAssignmentsCreated = newAssignments.length;
    }

    // Step 5: Recalculate coverage for all BU-Framework pairs
    const allAssignments = await db.businessUnitFramework.findMany({
      where: { organizationId },
      select: { businessUnitId: true, frameworkId: true },
    });

    for (const assignment of allAssignments) {
      try {
        await refreshBUFrameworkCoverage(
          assignment.frameworkId,
          organizationId,
          assignment.businessUnitId,
          db
        );
        result.coverageRecalculated++;
      } catch (error) {
        result.errors.push(
          `Failed to recalculate coverage for BU ${assignment.businessUnitId}, Framework ${assignment.frameworkId}: ${error}`
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
    return result;
  }
}

/**
 * Migrate all organizations to BU-scoped compliance
 */
export async function migrateAllOrganizationsToBUScoped(
  db: PrismaClient
): Promise<MigrationResult[]> {
  const organizations = await db.organization.findMany({
    select: { id: true },
  });

  const results: MigrationResult[] = [];

  for (const org of organizations) {
    const result = await migrateOrganizationToBUScoped(org.id, db);
    results.push(result);
  }

  return results;
}

/**
 * Migration summary helper
 */
export function getMigrationSummary(results: MigrationResult[]): {
  totalOrgs: number;
  successfulOrgs: number;
  failedOrgs: number;
  totalDefaultBUsCreated: number;
  totalEvidenceMigrated: number;
  totalAssignmentsCreated: number;
  totalCoverageRecalculated: number;
  allErrors: string[];
} {
  const summary = {
    totalOrgs: results.length,
    successfulOrgs: 0,
    failedOrgs: 0,
    totalDefaultBUsCreated: 0,
    totalEvidenceMigrated: 0,
    totalAssignmentsCreated: 0,
    totalCoverageRecalculated: 0,
    allErrors: [] as string[],
  };

  for (const result of results) {
    if (result.errors.length === 0) {
      summary.successfulOrgs++;
    } else {
      summary.failedOrgs++;
      summary.allErrors.push(
        ...result.errors.map(
          (e) => `[${result.organizationName || result.organizationId}] ${e}`
        )
      );
    }

    if (result.createdDefaultBU) summary.totalDefaultBUsCreated++;
    summary.totalEvidenceMigrated += result.evidenceMigrated;
    summary.totalAssignmentsCreated += result.frameworkAssignmentsCreated;
    summary.totalCoverageRecalculated += result.coverageRecalculated;
  }

  return summary;
}
