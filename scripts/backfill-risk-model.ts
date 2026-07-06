/**
 * Risk Model Cleanup — Legacy Backfill + Parity Report (Story 23.2)
 *
 * Idempotent, re-runnable:
 *   1. Repair Story 22.1 manual-score initialization for any missed risk
 *   2. Parity report: legacy score vs. new effective score, gated on 100%
 *      match or classified exceptions — UNEXPLAINED mismatches exit 1.
 *   (The spawn-link pass ran to completion in 23.2 and was removed in 23.3
 *    together with Risk.spawnedFromFindingId.)
 *
 * Usage:
 *   npx tsx scripts/backfill-risk-model.ts
 *
 * Or via Docker:
 *   docker exec betterthanspreadsheetsGRC-app npx tsx scripts/backfill-risk-model.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runLegacyRiskBackfill } from "../src/server/services/legacyRiskBackfill";

async function main() {
  console.log("=== Risk Model Cleanup: Legacy Backfill + Parity (Story 23.2) ===\n");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  try {
    const { manualInit, parity } = await runLegacyRiskBackfill(db);

    console.log("--- Pass 1: manual-score initialization repair ---");
    console.log(`Risks repaired into manual mode: ${manualInit.repaired}`);
    for (const id of manualInit.repairedRiskIds) {
      console.log(`  - ${id}`);
    }
    console.log("");

    console.log("--- Pass 2: parity report ---");
    console.log(`Legacy-scored risks:   ${parity.totalLegacyScored}`);
    console.log(`  - Exact matches:     ${parity.matches}`);
    console.log(`  - Reviewed exceptions: ${parity.reviewedExceptions}`);
    console.log(`  - UNEXPLAINED:       ${parity.unexplained}\n`);

    const mismatches = parity.rows.filter((r) => !r.match);
    if (mismatches.length > 0) {
      console.log("Mismatch detail (old → effective [source] reason):");
      for (const row of mismatches) {
        console.log(
          `  ${row.identifier ?? row.riskId}  ${row.oldScore} → ${row.newEffectiveScore ?? "—"} [${row.effectiveScoreSource ?? "—"}] ${row.mismatchReason}  "${row.title}"`,
        );
      }
      console.log("");
    }

    if (parity.pass) {
      console.log("PARITY GATE: PASS — cutover (Story 23.3) may proceed.");
    } else {
      console.log("PARITY GATE: FAIL — resolve UNEXPLAINED rows before Story 23.3.");
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
