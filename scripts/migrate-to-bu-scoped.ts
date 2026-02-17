/**
 * BU-Scoped Compliance Migration Script
 *
 * Story 6: Data Migration
 *
 * Run this script to migrate all organizations to BU-scoped compliance.
 * This can be run as a one-time migration during deployment.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-bu-scoped.ts
 *
 * Or via Docker:
 *   docker exec betterthanspreadsheetsGRC-app npx tsx scripts/migrate-to-bu-scoped.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  migrateAllOrganizationsToBUScoped,
  getMigrationSummary,
} from "../src/server/services/buScopedMigration";

async function main() {
  console.log("=== BU-Scoped Compliance Migration ===\n");
  console.log("Starting migration...\n");

  const db = new PrismaClient();

  try {
    const results = await migrateAllOrganizationsToBUScoped(db);
    const summary = getMigrationSummary(results);

    console.log("\n=== Migration Complete ===\n");
    console.log(`Organizations processed: ${summary.totalOrgs}`);
    console.log(`  - Successful: ${summary.successfulOrgs}`);
    console.log(`  - Failed: ${summary.failedOrgs}`);
    console.log("");
    console.log(`Default BUs created: ${summary.totalDefaultBUsCreated}`);
    console.log(`Evidence migrated: ${summary.totalEvidenceMigrated}`);
    console.log(`Framework assignments created: ${summary.totalAssignmentsCreated}`);
    console.log(`Coverage calculations: ${summary.totalCoverageRecalculated}`);

    if (summary.allErrors.length > 0) {
      console.log("\n=== Errors ===\n");
      for (const error of summary.allErrors) {
        console.error(`  - ${error}`);
      }
    }

    // Print individual org results
    console.log("\n=== Organization Details ===\n");
    for (const result of results) {
      const status = result.errors.length === 0 ? "✓" : "✗";
      console.log(`${status} ${result.organizationName || result.organizationId}`);
      if (result.createdDefaultBU) {
        console.log(`    Created default BU: ${result.defaultBUId}`);
      }
      if (result.evidenceMigrated > 0) {
        console.log(`    Evidence migrated: ${result.evidenceMigrated}`);
      }
      if (result.frameworkAssignmentsCreated > 0) {
        console.log(`    Assignments created: ${result.frameworkAssignmentsCreated}`);
      }
      if (result.coverageRecalculated > 0) {
        console.log(`    Coverage recalculated: ${result.coverageRecalculated}`);
      }
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          console.log(`    Error: ${error}`);
        }
      }
    }

    console.log("\n=== Done ===\n");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
