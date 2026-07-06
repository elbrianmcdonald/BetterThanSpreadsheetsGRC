/**
 * ER-style risk creation (Story 22.3)
 *
 * A risk is an aggregation: identity + review cadence + a score from linked
 * findings and/or a manual override. Never born unscoreable.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let versionId: string;

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

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: `AggRisk Org ${stamp}`, slug: `aggrisk-org-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "AggRisk Analyst",
      email: `aggrisk-analyst-${stamp}@example.com`,
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

  const templateId = randomUUID();
  versionId = randomUUID();
  await runWithOrganizationContext(testOrg.id, async () => {
    await db.riskMatrixTemplate.create({
      data: {
        id: templateId,
        organizationId: testOrg.id,
        name: "AggRisk 5×5",
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
  await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

async function mkScoredFinding(caller: ReturnType<typeof createCaller>, l: number, i: number) {
  return caller.finding.create({
    title: `AggRisk finding L${l}×I${i} ${randomUUID().slice(0, 6)}`,
    description: "Open scored finding for ER-style risk creation tests.",
    source: FindingSource.AUDIT,
    severity: Severity.MEDIUM,
    likelihood: l,
    impact: i,
  });
}

describe("Story 22.3: risk.createAggregateRisk", () => {
  it("creates from linked findings — effective CALCULATED, severity derived", async () => {
    const caller = createCaller(analyst);
    const f = await mkScoredFinding(caller, 4, 4); // 16 High

    const risk = await caller.risk.createAggregateRisk({
      title: "Aggregate risk from findings",
      description: "Score derives from the linked finding's inherent 16/High.",
      matrixVersionId: versionId,
      linkedFindingIds: [f.id],
    });

    expect(Number(risk!.calculatedScore)).toBe(16);
    expect(Number(risk!.effectiveScore)).toBe(16);
    expect(risk!.effectiveScoreSource).toBe("CALCULATED");

    const row = await db.risk.findUnique({
      where: { id: risk!.id },
      select: { severity: true, matrixVersionId: true },
    });
    expect(row?.severity).toBe(Severity.HIGH); // derived from "High" label
    expect(row?.matrixVersionId).toBe(versionId);
  });

  it("creates with a manual score — born MANUAL", async () => {
    const caller = createCaller(analyst);

    const risk = await caller.risk.createAggregateRisk({
      title: "Aggregate risk with manual judgment",
      description: "No findings yet — questionnaire-style manual scoring.",
      matrixVersionId: versionId,
      manualLikelihood: 5,
      manualImpact: 5, // 25 Critical
      reviewIntervalDays: 90,
    });

    expect(risk!.useManualScore).toBe(true);
    expect(Number(risk!.manualScore)).toBe(25);
    expect(Number(risk!.effectiveScore)).toBe(25);
    expect(risk!.effectiveScoreSource).toBe("MANUAL");
    expect(risk!.severity).toBe(Severity.HIGH); // Critical → HIGH
    expect(risk!.nextReviewDue).not.toBeNull();
  });

  it("rejects a risk with neither findings nor manual score", async () => {
    const caller = createCaller(analyst);

    await expect(
      caller.risk.createAggregateRisk({
        title: "Unscoreable aggregate risk",
        description: "Must be rejected — no scoring path provided.",
        matrixVersionId: versionId,
      })
    ).rejects.toThrow(/at least one finding|manual score/i);
  });

  it("both paths together: manual wins the effective score", async () => {
    const caller = createCaller(analyst);
    const f = await mkScoredFinding(caller, 5, 5); // 25

    const risk = await caller.risk.createAggregateRisk({
      title: "Aggregate risk with both scoring paths",
      description: "Findings rollup tracked; manual judgment drives effective.",
      matrixVersionId: versionId,
      linkedFindingIds: [f.id],
      manualLikelihood: 2,
      manualImpact: 2, // 4 Low
    });

    expect(Number(risk!.calculatedScore)).toBe(25);
    expect(Number(risk!.effectiveScore)).toBe(4);
    expect(risk!.effectiveScoreSource).toBe("MANUAL");
  });
});
