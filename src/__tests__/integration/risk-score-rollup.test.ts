/**
 * Risk derived-score rollup (Story 22.1)
 *
 * calculated = max inherentScore across OPEN linked findings
 * effective  = manual when useManualScore, else calculated
 * Triggers: link/unlink, finding rescore, finding status transition.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, FindingStatus, AuditAction, Prisma } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let defaultVersionId: string;

const SCALES = {
  likelihood: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
  impact: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
};
const THRESHOLDS = [
  { minValue: 0, maxValue: 6, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
  { minValue: 6, maxValue: 12, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
  { minValue: 12, maxValue: 20, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
  { minValue: 20, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
];

const settle = () => new Promise((r) => setTimeout(r, 500));

const createCaller = (user: typeof analyst) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkRisk() {
  let id = "";
  await runWithOrganizationContext(testOrg.id, async () => {
    const r = await db.risk.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        title: `Rollup risk ${randomUUID().slice(0, 8)}`,
        description: "Risk whose score derives from linked findings",
        severity: Severity.MEDIUM,
        updatedAt: new Date(),
      },
    });
    id = r.id;
  });
  return id;
}

async function riskScore(riskId: string) {
  const r = await db.risk.findUnique({
    where: { id: riskId },
    select: {
      calculatedScore: true,
      calculatedScoreLabel: true,
      effectiveScore: true,
      effectiveScoreLabel: true,
      effectiveScoreSource: true,
    },
  });
  return {
    calculated: r?.calculatedScore ? Number(r.calculatedScore) : null,
    calculatedLabel: r?.calculatedScoreLabel ?? null,
    effective: r?.effectiveScore ? Number(r.effectiveScore) : null,
    effectiveLabel: r?.effectiveScoreLabel ?? null,
    source: r?.effectiveScoreSource ?? null,
  };
}

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: `Rollup Org ${stamp}`, slug: `rollup-org-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Rollup Analyst",
      email: `rollup-analyst-${stamp}@example.com`,
      role: "GRC_ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  analyst = {
    id: u.id,
    email: u.email!,
    role: u.role,
    organizationId: u.organizationId,
    name: u.name!,
    assignedFrameworks: u.assignedFrameworks,
  };

  // Default 5×5 matrix so finding.create computes inherent scores
  const templateId = randomUUID();
  const versionId = randomUUID();
  defaultVersionId = versionId;
  await runWithOrganizationContext(testOrg.id, async () => {
    await db.riskMatrixTemplate.create({
      data: {
        id: templateId,
        organizationId: testOrg.id,
        name: "Rollup 5×5",
        dimensionCount: 2,
        gridSize: 5,
        outputScaleMax: 25,
        isActive: true,
        isDefault: true,
        updatedAt: new Date(),
      },
    });
    await db.riskMatrixVersion.create({
      data: {
        id: versionId,
        templateId,
        versionNumber: 1,
        scales: SCALES as never,
        thresholds: THRESHOLDS as never,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    await db.riskMatrixTemplate.update({
      where: { id: templateId },
      data: { currentVersionId: versionId },
    });
  });
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "EnterpriseRiskSeveritySnapshot" WHERE "enterpriseRiskId" IN (SELECT id FROM "EnterpriseRisk" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "EnterpriseRisk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskAssessmentProject" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

async function mkScoredFinding(caller: ReturnType<typeof createCaller>, l: number, i: number, riskIds: string[] = []) {
  return caller.finding.create({
    title: `Rollup finding L${l}×I${i} ${randomUUID().slice(0, 6)}`,
    description: "Scored finding feeding the risk rollup engine tests.",
    source: FindingSource.AUDIT,
    severity: Severity.MEDIUM,
    likelihood: l,
    impact: i,
    linkedRiskIds: riskIds,
  });
}

describe("Story 22.1: derived risk scoring", () => {
  it("linking a scored finding sets calculated = effective (CALCULATED)", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await mkScoredFinding(caller, 5, 5, [riskId]); // 25 Critical
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBe(25);
    expect(score.calculatedLabel).toBe("Critical");
    expect(score.effective).toBe(25);
    expect(score.source).toBe("CALCULATED");
  });

  it("rollup takes the MAX across open linked findings", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await mkScoredFinding(caller, 2, 3, [riskId]); // 6 Medium
    const big = await mkScoredFinding(caller, 4, 5, []); // 20 Critical
    await caller.finding.linkRisks({ findingId: big.id, riskIds: [riskId] });
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBe(20);
    expect(score.calculatedLabel).toBe("Critical");
  });

  it("closing a linked finding burns down the rollup", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    const small = await mkScoredFinding(caller, 2, 3, [riskId]); // 6
    const big = await mkScoredFinding(caller, 5, 5, [riskId]); // 25
    await settle();
    expect((await riskScore(riskId)).calculated).toBe(25);

    await caller.finding.transition({ findingId: big.id, targetStatus: FindingStatus.TRIAGED });
    await caller.finding.transition({ findingId: big.id, targetStatus: FindingStatus.CLOSED });
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBe(6);
    expect(score.calculatedLabel).toBe("Medium");
    expect(small.id).toBeTruthy();
  });

  it("rescoring a linked finding moves the rollup", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    const f = await mkScoredFinding(caller, 2, 2, [riskId]); // 4 Low
    await settle();
    expect((await riskScore(riskId)).calculated).toBe(4);

    await caller.finding.rescore({ findingId: f.id, likelihood: 4, impact: 4 }); // 16 High
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBe(16);
    expect(score.calculatedLabel).toBe("High");
  });

  it("unlinking the last finding clears the rollup", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    const f = await mkScoredFinding(caller, 3, 3, [riskId]);
    await settle();
    expect((await riskScore(riskId)).calculated).toBe(9);

    await caller.finding.unlinkRisk({ findingId: f.id, riskId });
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBeNull();
    expect(score.effective).toBeNull();
    expect(score.source).toBeNull();
  });

  it("useManualScore overrides the calculated value (effective = MANUAL)", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await runWithOrganizationContext(testOrg.id, async () => {
      await db.risk.update({
        where: { id: riskId },
        data: {
          useManualScore: true,
          manualScore: new Prisma.Decimal(15),
          manualScoreLabel: "High",
        },
      });
    });

    await mkScoredFinding(caller, 5, 5, [riskId]); // calculated 25
    await settle();

    const score = await riskScore(riskId);
    expect(score.calculated).toBe(25); // still tracked
    expect(score.effective).toBe(15); // manual wins
    expect(score.source).toBe("MANUAL");
  });

  it("22.2: setManualScore enables the override and effective switches immediately", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await mkScoredFinding(caller, 2, 2, [riskId]); // calculated 4 Low
    await settle();

    const result = await caller.risk.setManualScore({
      riskId,
      enabled: true,
      likelihood: 4,
      impact: 4, // 16 High on the org default matrix
    });

    expect(Number(result!.manualScore)).toBe(16);
    expect(result!.manualScoreLabel).toBe("High");
    expect(Number(result!.effectiveScore)).toBe(16);
    expect(result!.effectiveScoreSource).toBe("MANUAL");
    expect(Number(result!.calculatedScore)).toBe(4); // rollup still tracked
  });

  it("22.2: disabling the override reverts effective to calculated", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await mkScoredFinding(caller, 3, 3, [riskId]); // calculated 9 Medium
    await settle();
    await caller.risk.setManualScore({ riskId, enabled: true, likelihood: 5, impact: 5 });

    const result = await caller.risk.setManualScore({ riskId, enabled: false });

    expect(result!.useManualScore).toBe(false);
    expect(Number(result!.effectiveScore)).toBe(9);
    expect(result!.effectiveScoreSource).toBe("CALCULATED");
  });

  it("22.2: createAssessment risks are born in manual-score mode", async () => {
    const caller = createCaller(analyst);

    const assessment = await caller.risk.createAssessment({
      title: "Rollup assessment with a card-scored risk",
      matrixVersionId: defaultVersionId,
      risks: [
        {
          title: "Assessment-born manual risk",
          riskStatement: "Scored on the card — must land in manual mode.",
          inherentLikelihood: 4,
          inherentImpact: 5, // 20 Critical
          residualLikelihood: 2,
          residualImpact: 2, // 4 Low → residual preferred for manual
          threatStepIds: [],
          threatObjectiveIds: [],
          mitigatingControlIds: [],
          controlGapIds: [],
          controlLinkIds: [],
          remediationOptions: [],
          evidenceIds: [],
          residualEliminated: false,
        },
      ],
    });

    expect(assessment).toBeTruthy();
    const bornManual = await db.risk.findFirst({
      where: { title: "Assessment-born manual risk", organizationId: testOrg.id },
      select: {
        useManualScore: true,
        manualScore: true,
        effectiveScore: true,
        effectiveScoreSource: true,
      },
    });

    expect(bornManual?.useManualScore).toBe(true);
    expect(Number(bornManual?.manualScore)).toBe(4); // residual preferred
    expect(Number(bornManual?.effectiveScore)).toBe(4);
    expect(bornManual?.effectiveScoreSource).toBe("MANUAL");
  });

  it("22.4: two-hop cascade — finding score flows through the risk to the enterprise risk", async () => {
    const caller = createCaller(analyst);

    let erId = "";
    await runWithOrganizationContext(testOrg.id, async () => {
      const er = await db.enterpriseRisk.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          name: `Rollup ER ${randomUUID().slice(0, 8)}`,
          updatedAt: new Date(),
        },
      });
      erId = er.id;
    });

    const riskId = await mkRisk();
    await runWithOrganizationContext(testOrg.id, async () => {
      await db.risk.update({ where: { id: riskId }, data: { enterpriseRiskId: erId } });
    });

    await mkScoredFinding(caller, 4, 5, [riskId]); // 20 Critical
    await settle();

    const er = await db.enterpriseRisk.findUnique({
      where: { id: erId },
      select: { effectiveScore: true, effectiveScoreLabel: true, effectiveScoreSource: true },
    });
    expect(Number(er?.effectiveScore)).toBe(20); // finding → risk → ER
    expect(er?.effectiveScoreLabel).toBe("Critical");
    expect(er?.effectiveScoreSource).toBe("CALCULATED");
  });

  it("Story 23.5 (MJ-9): a CLOSED finding's link is read-only from the risk side too", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    const f = await mkScoredFinding(caller, 3, 3, [riskId]);
    await caller.finding.transition({ findingId: f.id, targetStatus: FindingStatus.TRIAGED });
    await caller.finding.transition({ findingId: f.id, targetStatus: FindingStatus.CLOSED });
    await settle();

    await expect(
      caller.risk.unlinkFinding({ riskId, findingId: f.id }),
    ).rejects.toThrow(/terminal|read-only/i);

    // The evidence link survives.
    const linkCount = await db.riskFindingLink.count({ where: { riskId, findingId: f.id } });
    expect(linkCount).toBe(1);
  });

  it("2026-07-06: PENDING assessment findings don't feed the rollup until published", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    // A finding discovered inside an unapproved assessment (PENDING).
    const f = await mkScoredFinding(caller, 5, 5, [riskId]); // 25 Critical
    await runWithOrganizationContext(testOrg.id, async () => {
      await db.finding.update({
        where: { id: f.id },
        data: { discoveryStatus: "PENDING" },
      });
    });
    const { recomputeRiskScore } = await import("@/server/services/riskScore");
    await runWithOrganizationContext(testOrg.id, async () => {
      await recomputeRiskScore(db, riskId, "test-pending-gate");
    });

    let score = await riskScore(riskId);
    expect(score.calculated).toBeNull(); // pending finding excluded

    // Approval publishes the finding — the rollup picks it up.
    await runWithOrganizationContext(testOrg.id, async () => {
      await db.finding.update({
        where: { id: f.id },
        data: { discoveryStatus: "PUBLISHED" },
      });
      await recomputeRiskScore(db, riskId, "test-published");
    });

    score = await riskScore(riskId);
    expect(score.calculated).toBe(25);
    expect(score.source).toBe("CALCULATED");
  });

  it("recompute writes a RISK_SCORE_RECALCULATED audit entry", async () => {
    const caller = createCaller(analyst);
    const riskId = await mkRisk();

    await mkScoredFinding(caller, 3, 4, [riskId]);
    await settle();

    const audit = await db.auditLog.findFirst({
      where: {
        entityType: "Risk",
        entityId: riskId,
        action: AuditAction.RISK_SCORE_RECALCULATED,
      },
    });
    expect(audit).not.toBeNull();
    const changes = audit?.changes as { after: Record<string, unknown> };
    expect(Number(changes.after.effectiveScore)).toBe(12);
    expect(changes.after.trigger).toBe("finding-created-linked");
  });
});
