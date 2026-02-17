#!/usr/bin/env npx tsx
/**
 * Seed Organization Defaults Migration Script
 *
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 *
 * AC19: Seeding script can be run for existing organizations
 * AC20: Script skips orgs that already have assessment types/matrices
 * AC21: CLI command: `pnpm seed:defaults`
 *
 * Usage:
 *   pnpm seed:defaults           # Seed all organizations without defaults
 *   pnpm seed:defaults --org-id=xxx  # Seed specific organization
 *   pnpm seed:defaults --dry-run     # Preview without making changes
 */

import { PrismaClient } from "@prisma/client";
import { seedDefaultsForOrganizations, seedOrganizationDefaults } from "../../src/lib/matrix/seedDefaults";

const db = new PrismaClient();

interface Args {
  orgId?: string;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, help: false };

  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg.startsWith("--org-id=")) {
      args.orgId = arg.split("=")[1];
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Seed Organization Defaults Migration Script

Usage:
  pnpm seed:defaults              Seed all organizations without defaults
  pnpm seed:defaults --org-id=ID  Seed specific organization by ID
  pnpm seed:defaults --dry-run    Preview what would be seeded (no changes)
  pnpm seed:defaults --help       Show this help message

Description:
  This script seeds default assessment types and risk matrices for organizations.
  It is idempotent - organizations that already have defaults will be skipped.

  Defaults seeded:
  - Assessment Type: "General Risk Assessment"
  - Risk Matrix: "Standard Risk Matrix" (5×5, Likelihood × Impact)
  - Matrix Version: Version 1 (auto-published)
  - Thresholds: Low, Medium, High, Critical

Examples:
  pnpm seed:defaults
  pnpm seed:defaults --org-id=clx1234567890
  pnpm seed:defaults --dry-run
`);
}

async function dryRun(): Promise<void> {
  console.log("\n🔍 DRY RUN - No changes will be made\n");

  // Find all organizations
  const allOrgs = await db.organization.findMany({
    select: { id: true, name: true, slug: true },
  });

  // Find organizations that have default assessment types
  const orgsWithDefaults = await db.assessmentType.findMany({
    where: { isDefault: true },
    select: { organizationId: true },
  });

  const orgIdsWithDefaults = new Set(orgsWithDefaults.map((a) => a.organizationId));

  // Filter to orgs without defaults
  const orgsWithoutDefaults = allOrgs.filter((org) => !orgIdsWithDefaults.has(org.id));

  if (orgsWithoutDefaults.length === 0) {
    console.log("✅ All organizations already have defaults seeded.");
    return;
  }

  console.log(`Found ${orgsWithoutDefaults.length} organization(s) without defaults:\n`);

  for (const org of orgsWithoutDefaults) {
    console.log(`  📁 ${org.name} (${org.slug})`);
    console.log(`     ID: ${org.id}`);
    console.log(`     Would seed:`);
    console.log(`       - Assessment Type: "General Risk Assessment" (isDefault: true)`);
    console.log(`       - Risk Matrix Template: "Standard Risk Matrix" (5×5)`);
    console.log(`       - Matrix Version: v1 (auto-published)`);
    console.log("");
  }

  console.log("\nRun without --dry-run to apply changes.");
}

async function seedSingleOrg(orgId: string): Promise<void> {
  console.log(`\n🌱 Seeding defaults for organization: ${orgId}\n`);

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    console.error(`❌ Organization not found: ${orgId}`);
    process.exit(1);
  }

  console.log(`  Organization: ${org.name} (${org.slug})`);

  const result = await seedOrganizationDefaults(db, orgId);

  if (result.success) {
    if (result.skipped) {
      console.log(`  ⏭️  Skipped - already has defaults`);
    } else {
      console.log(`  ✅ Successfully seeded:`);
      console.log(`     Assessment Type ID: ${result.assessmentTypeId}`);
      console.log(`     Matrix Template ID: ${result.templateId}`);
      console.log(`     Matrix Version ID: ${result.versionId}`);
    }
  } else {
    console.error(`  ❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

async function seedAllOrgs(): Promise<void> {
  console.log("\n🌱 Seeding defaults for all organizations without defaults\n");

  const results = await seedDefaultsForOrganizations(db);

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [, result] of results) {
    if (result.success) {
      if (result.skipped) {
        skipped++;
      } else {
        seeded++;
      }
    } else {
      failed++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  ✅ Seeded: ${seeded}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  console.log("================================================");
  console.log("  Seed Organization Defaults");
  console.log("  Story 7.8.4: Default Matrix & Assessment Type");
  console.log("================================================");

  if (args.dryRun) {
    await dryRun();
  } else if (args.orgId) {
    await seedSingleOrg(args.orgId);
  } else {
    await seedAllOrgs();
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
