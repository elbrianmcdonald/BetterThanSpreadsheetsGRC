/**
 * assert-graph-migration-safe.ts
 *
 * Startup guard: aborts container start (exit 1) if there are
 * RiskOrganizationalControl rows not yet migrated to MITIGATES edges.
 *
 * Run by docker-entrypoint.sh BEFORE `prisma db push --accept-data-loss`
 * to prevent silent destruction of risk↔control links.
 *
 * Override: set ALLOW_RISKORGCONTROL_DROP=true to bypass and accept data loss.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ---------------------------------------------------------------------------
// Pure decision function — no DB I/O, fully unit-testable
// ---------------------------------------------------------------------------

export type GuardInputs = {
  rocTableExists: boolean;
  rocRowCount: number;
  graphTablesExist: boolean; // Node AND Edge both exist
  unmigratedRocCount: number; // ROC rows with no corresponding MITIGATES edge
};

export function evaluateGraphMigrationSafety(
  i: GuardInputs,
): { safe: true } | { safe: false; reason: string } {
  if (!i.rocTableExists) return { safe: true }; // already dropped / fresh DB
  if (i.rocRowCount === 0) return { safe: true }; // nothing to lose
  if (!i.graphTablesExist)
    return {
      safe: false,
      reason: `RiskOrganizationalControl has ${i.rocRowCount} rows but the graph (Node/Edge) tables do not exist — the MITIGATES backfill has not run.`,
    };
  if (i.unmigratedRocCount > 0)
    return {
      safe: false,
      reason: `${i.unmigratedRocCount} of ${i.rocRowCount} RiskOrganizationalControl rows have no corresponding MITIGATES edge — backfill incomplete.`,
    };
  return { safe: true };
}

// ---------------------------------------------------------------------------
// Async main — gathers inputs via raw SQL, calls decision function
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const bypass = process.env.ALLOW_RISKORGCONTROL_DROP === "true";

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  let inputs: GuardInputs;

  try {
    // 1. Does RiskOrganizationalControl exist?
    const rocExistsRows = await prisma.$queryRawUnsafe<{ e: boolean }[]>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'RiskOrganizationalControl'
       ) AS e`,
    );
    const rocTableExists = rocExistsRows[0]?.e ?? false;

    // 2. Do Node AND Edge both exist?
    const nodeExistsRows = await prisma.$queryRawUnsafe<{ e: boolean }[]>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'Node'
       ) AS e`,
    );
    const edgeExistsRows = await prisma.$queryRawUnsafe<{ e: boolean }[]>(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'Edge'
       ) AS e`,
    );
    const graphTablesExist =
      (nodeExistsRows[0]?.e ?? false) && (edgeExistsRows[0]?.e ?? false);

    // 3. Row count (only if table exists)
    let rocRowCount = 0;
    if (rocTableExists) {
      const countRows = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "RiskOrganizationalControl"`,
      );
      rocRowCount = countRows[0]?.c ?? 0;
    }

    // 4. Unmigrated count (only if ROC has rows AND graph tables exist)
    let unmigratedRocCount = 0;
    if (rocRowCount > 0 && graphTablesExist) {
      const unmigratedRows = await prisma.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*)::int AS c FROM "RiskOrganizationalControl" roc
         WHERE NOT EXISTS (
           SELECT 1 FROM "Node" cn
           JOIN "Edge" e ON e."fromNodeId" = cn.id AND e.type = 'MITIGATES'
           JOIN "Node" rn ON rn.id = e."toNodeId" AND rn.type = 'Risk' AND rn."entityId" = roc."riskId"
           WHERE cn.type = 'Control' AND cn."entityId" = roc."organizationalControlId"
         )`,
      );
      unmigratedRocCount = unmigratedRows[0]?.c ?? 0;
    }

    inputs = { rocTableExists, rocRowCount, graphTablesExist, unmigratedRocCount };
  } catch (err) {
    // Fail closed: if we cannot connect / query, we cannot prove safety.
    console.error(
      "═══════════════════════════════════════════════════════════════",
    );
    console.error("  GRAPH MIGRATION GUARD: DB CONNECTION ERROR");
    console.error("  Cannot verify RiskOrganizationalControl migration safety.");
    console.error("  Error:", err instanceof Error ? err.message : String(err));
    console.error(
      "═══════════════════════════════════════════════════════════════",
    );
    if (bypass) {
      console.log(
        "Bypass enabled (ALLOW_RISKORGCONTROL_DROP=true) — proceeding despite connection error.",
      );
      await prisma.$disconnect();
      process.exit(0);
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();

  const result = evaluateGraphMigrationSafety(inputs);

  if (result.safe) {
    console.log("Graph migration safety check passed.");
    process.exit(0);
  }

  // NOT safe — print loud message
  console.error("");
  console.error(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.error(
    "║         STARTUP ABORTED — DATA LOSS PREVENTION               ║",
  );
  console.error(
    "╚═══════════════════════════════════════════════════════════════╝",
  );
  console.error("");
  console.error("REASON:", result.reason);
  console.error("");
  console.error("The imminent `prisma db push --accept-data-loss` will DROP");
  console.error(
    "the RiskOrganizationalControl table and destroy these rows permanently.",
  );
  console.error("");
  console.error("Required two-phase procedure (spec §7b):");
  console.error(
    "  1. Deploy the pre-drop / Task-9 image (schema still has the table).",
  );
  console.error(
    "  2. Run the backfill:  tsx prisma/scripts/backfill-graph.ts",
  );
  console.error(
    "  3. Re-verify this guard passes, then deploy this (Task-10) image.",
  );
  console.error("");
  console.error(
    "To intentionally proceed and ACCEPT permanent data loss, set:",
  );
  console.error("  ALLOW_RISKORGCONTROL_DROP=true");
  console.error("");

  if (bypass) {
    console.log(
      "Bypass enabled (ALLOW_RISKORGCONTROL_DROP=true) — proceeding despite unmigrated rows.",
    );
    process.exit(0);
  }

  process.exit(1);
}

// Only run main() when executed directly (not when imported by tests).
// package.json has "type": "module" so tsx runs this as native ESM where
// `require` is undefined — use process.argv[1] for entry-point detection instead.
if (process.argv[1]?.endsWith("assert-graph-migration-safe.ts")) {
  void main().catch((err) => {
    console.error("Unexpected error in assert-graph-migration-safe:", err);
    process.exit(1);
  });
}
