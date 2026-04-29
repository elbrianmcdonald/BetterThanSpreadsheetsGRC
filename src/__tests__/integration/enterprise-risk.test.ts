/**
 * Enterprise Risk integration tests.
 *
 * Covers:
 * - Seed creates the 10 baselines (idempotent)
 * - Calculated score rolls up from child residual scores (max)
 * - Manual override takes precedence when enabled
 * - Snapshot is appended only when effective score changes
 * - recordReview updates lastReviewedAt + nextReviewDue
 * - assignChildRisk recomputes both old and new parents
 * - Cross-org isolation enforced
 */

import { db, rawPrisma } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { randomUUID } from "crypto";
import { Prisma, Severity, type UserRole } from "@prisma/client";
import { seedEnterpriseRisks, ENTERPRISE_RISK_BASELINES } from "../../../prisma/seeds/enterprise-risks";

let testOrg: { id: string };
let testOrg2: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let auditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let analystOrg2: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };

async function purgeOrg(slug: string) {
  const existing = await rawPrisma.organization.findUnique({ where: { slug } });
  if (!existing) return;
  await rawPrisma.$executeRaw`DELETE FROM "EnterpriseRiskReview" WHERE "enterpriseRiskId" IN (SELECT id FROM "EnterpriseRisk" WHERE "organizationId" = ${existing.id})`;
  await rawPrisma.$executeRaw`DELETE FROM "EnterpriseRiskSeveritySnapshot" WHERE "enterpriseRiskId" IN (SELECT id FROM "EnterpriseRisk" WHERE "organizationId" = ${existing.id})`;
  await rawPrisma.$executeRaw`DELETE FROM "EnterpriseRisk" WHERE "organizationId" = ${existing.id}`;
  await rawPrisma.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existing.id}`;
  await rawPrisma.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existing.id}`;
  await rawPrisma.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existing.id}`;
  await rawPrisma.$executeRaw`DELETE FROM "Organization" WHERE id = ${existing.id}`;
}

beforeAll(async () => {
  await purgeOrg("test-org-er-1");
  await purgeOrg("test-org-er-2");

  testOrg = await rawPrisma.organization.create({
    data: { id: randomUUID(), name: "ER Test Org 1", slug: "test-org-er-1", updatedAt: new Date() },
  });
  testOrg2 = await rawPrisma.organization.create({
    data: { id: randomUUID(), name: "ER Test Org 2", slug: "test-org-er-2", updatedAt: new Date() },
  });

  const mkUser = async (role: UserRole, orgId: string, email: string, name: string) => {
    const u = await rawPrisma.user.create({
      data: { id: randomUUID(), name, email, role, organizationId: orgId, updatedAt: new Date() },
    });
    return {
      id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId,
      name: u.name!, assignedFrameworks: u.assignedFrameworks,
    };
  };
  analyst = await mkUser("GRC_ANALYST", testOrg.id, "analyst@er.test", "ER Analyst");
  auditor = await mkUser("AUDITOR", testOrg.id, "auditor@er.test", "ER Auditor");
  analystOrg2 = await mkUser("GRC_ANALYST", testOrg2.id, "analyst@er2.test", "ER Analyst Org2");
});

afterAll(async () => {
  await purgeOrg("test-org-er-1");
  await purgeOrg("test-org-er-2");
});

const createCaller = (user: typeof analyst) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id, email: user.email, role: user.role,
        organizationId: user.organizationId, name: user.name, image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

describe("Enterprise Risk", () => {
  describe("Seed", () => {
    it("creates all baselines and is idempotent", async () => {
      const first = await seedEnterpriseRisks(rawPrisma, testOrg.id);
      expect(first.count).toBe(ENTERPRISE_RISK_BASELINES.length);

      const count1 = await rawPrisma.enterpriseRisk.count({ where: { organizationId: testOrg.id } });
      expect(count1).toBe(ENTERPRISE_RISK_BASELINES.length);

      // Run again — must not duplicate.
      await seedEnterpriseRisks(rawPrisma, testOrg.id);
      const count2 = await rawPrisma.enterpriseRisk.count({ where: { organizationId: testOrg.id } });
      expect(count2).toBe(ENTERPRISE_RISK_BASELINES.length);
    });
  });

  describe("Score rollup", () => {
    let er: { id: string };

    beforeAll(async () => {
      const caller = createCaller(analyst);
      er = await caller.enterpriseRisk.create({
        name: "Rollup Test ER",
        description: "Used for rollup tests",
      });
    });

    it("calculated score = max of child residual scores", async () => {
      // Two child risks with residual scores 5 and 12 — expect rollup to 12.
      await runWithOrganizationContext(testOrg.id, async () => {
        await db.risk.create({
          data: {
            organizationId: testOrg.id, title: "Child A", description: "Child risk A for rollup test",
            severity: Severity.MEDIUM, residualScore: new Prisma.Decimal(5), residualScoreLabel: "Medium",
            enterpriseRiskId: er.id,
          },
        });
        await db.risk.create({
          data: {
            organizationId: testOrg.id, title: "Child B", description: "Child risk B for rollup test",
            severity: Severity.HIGH, residualScore: new Prisma.Decimal(12), residualScoreLabel: "High",
            enterpriseRiskId: er.id,
          },
        });
      });

      // Trigger recompute via update no-op (any update works).
      const caller = createCaller(analyst);
      await caller.enterpriseRisk.update({ id: er.id, description: "trigger recompute" });

      const reloaded = await rawPrisma.enterpriseRisk.findUnique({ where: { id: er.id } });
      expect(reloaded?.effectiveScore?.toString()).toBe("12");
      expect(reloaded?.effectiveScoreLabel).toBe("High");
      expect(reloaded?.effectiveScoreSource).toBe("CALCULATED");
    });

    it("manual override takes precedence when enabled", async () => {
      const caller = createCaller(analyst);
      await caller.enterpriseRisk.update({
        id: er.id,
        useManualScore: true,
        manualLikelihood: 1,
        manualImpact: 1,
      });
      // Without a matrix, manual score itself is null. The flag still flips source; we set a matrix-less manual via direct update path.
      await rawPrisma.enterpriseRisk.update({
        where: { id: er.id },
        data: { manualScore: new Prisma.Decimal(99), manualScoreLabel: "Critical" },
      });
      // Trigger recompute.
      await caller.enterpriseRisk.update({ id: er.id, description: "manual override" });
      const reloaded = await rawPrisma.enterpriseRisk.findUnique({ where: { id: er.id } });
      expect(reloaded?.effectiveScore?.toString()).toBe("99");
      expect(reloaded?.effectiveScoreSource).toBe("MANUAL");
    });

    it("snapshots accumulate only when effective score changes", async () => {
      const before = await rawPrisma.enterpriseRiskSeveritySnapshot.count({ where: { enterpriseRiskId: er.id } });
      // No score change — same description-only update should not append a snapshot.
      const caller = createCaller(analyst);
      await caller.enterpriseRisk.update({ id: er.id, description: "no score change" });
      const after = await rawPrisma.enterpriseRiskSeveritySnapshot.count({ where: { enterpriseRiskId: er.id } });
      expect(after).toBe(before);
    });
  });

  describe("Reviews", () => {
    it("recordReview appends a row and updates lastReviewedAt + nextReviewDue", async () => {
      const caller = createCaller(analyst);
      const er = await caller.enterpriseRisk.create({
        name: "Review Test ER",
        reviewIntervalDays: 30,
      });
      await caller.enterpriseRisk.recordReview({ id: er.id, notes: "Looks good" });
      const row = await rawPrisma.enterpriseRisk.findUnique({ where: { id: er.id } });
      const reviews = await rawPrisma.enterpriseRiskReview.findMany({ where: { enterpriseRiskId: er.id } });
      expect(reviews).toHaveLength(1);
      expect(reviews[0]!.notes).toBe("Looks good");
      expect(row?.lastReviewedAt).toBeTruthy();
      expect(row?.nextReviewDue).toBeTruthy();
      // nextReviewDue ≈ lastReviewedAt + 30 days
      const diff = (row!.nextReviewDue!.getTime() - row!.lastReviewedAt!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBeCloseTo(30, 0);
    });
  });

  describe("Child risk alignment", () => {
    it("assignChildRisk recomputes old and new parents", async () => {
      const caller = createCaller(analyst);
      const erA = await caller.enterpriseRisk.create({ name: "Alignment Parent A" });
      const erB = await caller.enterpriseRisk.create({ name: "Alignment Parent B" });

      const childRisk = await runWithOrganizationContext(testOrg.id, async () => {
        return await db.risk.create({
          data: {
            organizationId: testOrg.id, title: "Alignment Child", description: "Child risk for alignment test",
            severity: Severity.HIGH, residualScore: new Prisma.Decimal(20), residualScoreLabel: "High",
            enterpriseRiskId: erA.id,
          },
        });
      });

      // Initial recompute on A
      await caller.enterpriseRisk.update({ id: erA.id, description: "init" });
      let a = await rawPrisma.enterpriseRisk.findUnique({ where: { id: erA.id } });
      expect(a?.effectiveScore?.toString()).toBe("20");

      // Reassign to B
      await caller.enterpriseRisk.assignChildRisk({ riskId: childRisk.id, enterpriseRiskId: erB.id });

      a = await rawPrisma.enterpriseRisk.findUnique({ where: { id: erA.id } });
      const b = await rawPrisma.enterpriseRisk.findUnique({ where: { id: erB.id } });
      expect(a?.effectiveScore).toBeNull();
      expect(b?.effectiveScore?.toString()).toBe("20");
    });
  });

  describe("Authorization & isolation", () => {
    it("AUDITOR cannot create enterprise risks", async () => {
      const caller = createCaller(auditor);
      await expect(caller.enterpriseRisk.create({ name: "Should fail" })).rejects.toThrow();
    });

    it("cross-org list does not leak enterprise risks", async () => {
      // org2 list should return zero (we only seeded org1)
      const caller = createCaller(analystOrg2);
      const items = await caller.enterpriseRisk.list();
      expect(items).toHaveLength(0);
    });

    it("cross-org byId returns NOT_FOUND", async () => {
      const callerOrg1 = createCaller(analyst);
      const er = await callerOrg1.enterpriseRisk.create({ name: "Org1 Private ER" });

      const callerOrg2 = createCaller(analystOrg2);
      await expect(callerOrg2.enterpriseRisk.byId({ id: er.id })).rejects.toThrow();
    });
  });
});
