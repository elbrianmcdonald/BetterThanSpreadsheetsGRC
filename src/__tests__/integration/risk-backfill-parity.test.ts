/**
 * Legacy backfill + parity proof (Story 23.2; spawn-link pass retired in 23.3)
 *
 * - Story 22.1 manual-init repair for missed risks; new-model risks untouched
 * - parity report: legacy score vs. effective, classified exceptions, gate
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { Severity, Prisma } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  repairManualScoreInit,
  generateParityReport,
} from "@/server/services/legacyRiskBackfill";

let testOrg: { id: string };
let testUser: { id: string };

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: `Backfill Org ${stamp}`,
      slug: `backfill-org-${stamp}`,
      updatedAt: new Date(),
    },
  });
  testUser = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Backfill Analyst",
      email: `backfill-analyst-${stamp}@example.com`,
      role: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

async function mkRisk(data: Record<string, unknown> = {}) {
  let id = "";
  await runWithOrganizationContext(testOrg.id, async () => {
    const r = await db.risk.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        title: `Backfill risk ${randomUUID().slice(0, 8)}`,
        description: "Risk under backfill test",
        severity: Severity.MEDIUM,
        updatedAt: new Date(),
        ...data,
      } as never,
    });
    id = r.id;
  });
  return id;
}

describe("Story 23.2: manual-init repair", () => {
  it("repairs a legacy-scored risk missed by the 22.1 initialization", async () => {
    const riskId = await mkRisk({
      inherentScore: new Prisma.Decimal(12),
      inherentScoreLabel: "High",
      inherentLikelihood: new Prisma.Decimal(3),
      inherentImpact: new Prisma.Decimal(4),
      residualScore: new Prisma.Decimal(8),
      residualScoreLabel: "Medium",
      residualLikelihood: new Prisma.Decimal(2),
      residualImpact: new Prisma.Decimal(4),
    });

    const result = await repairManualScoreInit(db, { organizationId: testOrg.id });
    expect(result.repairedRiskIds).toContain(riskId);

    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: {
        useManualScore: true,
        manualScore: true,
        manualScoreLabel: true,
        effectiveScore: true,
        effectiveScoreSource: true,
      },
    });
    expect(risk?.useManualScore).toBe(true);
    expect(Number(risk?.manualScore)).toBe(8); // residual preferred
    expect(risk?.manualScoreLabel).toBe("Medium");
    expect(Number(risk?.effectiveScore)).toBe(8);
    expect(risk?.effectiveScoreSource).toBe("MANUAL");

    // Idempotent: second run does not pick it up again
    const second = await repairManualScoreInit(db, { organizationId: testOrg.id });
    expect(second.repairedRiskIds).not.toContain(riskId);
  });

  it("falls back to inherent when no residual exists", async () => {
    const riskId = await mkRisk({
      inherentScore: new Prisma.Decimal(15),
      inherentScoreLabel: "High",
    });

    await repairManualScoreInit(db, { organizationId: testOrg.id });

    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: { manualScore: true, manualScoreLabel: true, effectiveScore: true },
    });
    expect(Number(risk?.manualScore)).toBe(15);
    expect(risk?.manualScoreLabel).toBe("High");
    expect(Number(risk?.effectiveScore)).toBe(15);
  });

  it("never clobbers a risk already on the new model (calculated mode)", async () => {
    // Legacy columns present, but the risk lives in calculated mode with a
    // rollup — e.g. the user explicitly disabled an override.
    const riskId = await mkRisk({
      inherentScore: new Prisma.Decimal(10),
      useManualScore: false,
      calculatedScore: new Prisma.Decimal(4),
      calculatedScoreLabel: "Low",
      effectiveScore: new Prisma.Decimal(4),
      effectiveScoreLabel: "Low",
      effectiveScoreSource: "CALCULATED",
    });

    const result = await repairManualScoreInit(db, { organizationId: testOrg.id });
    expect(result.repairedRiskIds).not.toContain(riskId);

    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: { useManualScore: true, effectiveScore: true, effectiveScoreSource: true },
    });
    expect(risk?.useManualScore).toBe(false);
    expect(Number(risk?.effectiveScore)).toBe(4);
    expect(risk?.effectiveScoreSource).toBe("CALCULATED");
  });

  it("never clobbers an already-initialized manual-mode risk", async () => {
    const riskId = await mkRisk({
      residualScore: new Prisma.Decimal(9),
      useManualScore: true,
      manualScore: new Prisma.Decimal(9),
      manualScoreLabel: "Medium",
      effectiveScore: new Prisma.Decimal(9),
      effectiveScoreLabel: "Medium",
      effectiveScoreSource: "MANUAL",
    });

    const result = await repairManualScoreInit(db, { organizationId: testOrg.id });
    expect(result.repairedRiskIds).not.toContain(riskId);
  });

  it("Story 23.5 (MJ-8): a linked risk with a legitimately-empty rollup is NOT repaired", async () => {
    // Legacy columns present, all-new-model state null — but the risk HAS a
    // RiskFindingLink (its findings all closed), so a re-run of the repair
    // must not resurrect the stale legacy score as a manual override.
    const riskId = await mkRisk({
      residualScore: new Prisma.Decimal(9),
      residualScoreLabel: "Medium",
      useManualScore: false,
    });
    let findingId = "";
    await runWithOrganizationContext(testOrg.id, async () => {
      const f = await db.finding.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          identifier: `BF-FND-${randomUUID().slice(0, 8)}`,
          title: "Closed finding behind an empty rollup",
          description: "All exposure remediated — the rollup is legitimately empty.",
          source: "AUDIT",
          severity: "MEDIUM",
          status: "CLOSED",
          createdBy: testUser.id,
          closedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      findingId = f.id;
      await db.riskFindingLink.create({ data: { riskId, findingId } });
    });

    const result = await repairManualScoreInit(db, { organizationId: testOrg.id });
    expect(result.repairedRiskIds).not.toContain(riskId);

    const row = await db.risk.findUnique({
      where: { id: riskId },
      select: { useManualScore: true, manualScore: true, effectiveScore: true },
    });
    expect(row?.useManualScore).toBe(false);
    expect(row?.manualScore).toBeNull();
    expect(row?.effectiveScore).toBeNull();
  });
});

describe("Story 23.2: parity report", () => {
  it("initialized and repaired risks report as exact matches", async () => {
    const riskId = await mkRisk({
      residualScore: new Prisma.Decimal(7),
      residualScoreLabel: "Medium",
    });
    await repairManualScoreInit(db, { organizationId: testOrg.id });

    const report = await generateParityReport(db, { organizationId: testOrg.id });
    const row = report.rows.find((r) => r.riskId === riskId);
    expect(row).toBeDefined();
    expect(row?.oldScore).toBe(7);
    expect(row?.newEffectiveScore).toBe(7);
    expect(row?.match).toBe(true);
    expect(row?.mismatchReason).toBeNull();
  });

  it("a post-init override change is a reviewed exception (MANUAL_OVERRIDE_CHANGED)", async () => {
    const riskId = await mkRisk({
      residualScore: new Prisma.Decimal(5),
      useManualScore: true,
      manualScore: new Prisma.Decimal(12), // user moved the override after init
      manualScoreLabel: "High",
      effectiveScore: new Prisma.Decimal(12),
      effectiveScoreLabel: "High",
      effectiveScoreSource: "MANUAL",
    });

    const report = await generateParityReport(db, { organizationId: testOrg.id });
    const row = report.rows.find((r) => r.riskId === riskId);
    expect(row?.match).toBe(false);
    expect(row?.mismatchReason).toBe("MANUAL_OVERRIDE_CHANGED");
  });

  it("a rollup-driven effective score is a reviewed exception (ROLLUP_DRIVEN)", async () => {
    const riskId = await mkRisk({
      inherentScore: new Prisma.Decimal(10),
      useManualScore: false,
      manualScore: null,
      calculatedScore: new Prisma.Decimal(16),
      calculatedScoreLabel: "High",
      effectiveScore: new Prisma.Decimal(16),
      effectiveScoreLabel: "High",
      effectiveScoreSource: "CALCULATED",
    });

    const report = await generateParityReport(db, { organizationId: testOrg.id });
    const row = report.rows.find((r) => r.riskId === riskId);
    expect(row?.match).toBe(false);
    expect(row?.mismatchReason).toBe("ROLLUP_DRIVEN");
    expect(report.pass).toBe(true); // classified exceptions don't fail the gate
  });

  it("an unexplained mismatch fails the gate", async () => {
    const riskId = await mkRisk({
      residualScore: new Prisma.Decimal(11),
      useManualScore: true,
      manualScore: new Prisma.Decimal(11), // manual matches legacy...
      effectiveScore: new Prisma.Decimal(2), // ...but effective is torn
      effectiveScoreSource: "MANUAL",
    });

    const report = await generateParityReport(db, { organizationId: testOrg.id });
    const row = report.rows.find((r) => r.riskId === riskId);
    expect(row?.match).toBe(false);
    expect(row?.mismatchReason).toBe("UNEXPLAINED");
    expect(report.pass).toBe(false);

    // clean up the torn row so later full-suite parity checks aren't poisoned
    await db.$executeRaw`UPDATE "Risk" SET "effectiveScore" = "manualScore" WHERE id = ${riskId}`;
  });
});
