/**
 * Finding Rescore Integration Tests
 *
 * Story 20.2: Rescore an Existing Finding (Risk Model Cleanup Epic 20)
 *
 * AC1: Rescoring uses the finding's LOCKED matrixVersionId — never the org
 *      default — for both inherent and residual scores (incl. ELIMINATED).
 * AC2: Every score change writes an immutable audit entry with before/after.
 * AC3: Terminal-status findings (DUPLICATE/REJECTED/CLOSED) reject rescore.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, AuditAction } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let outsider: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let otherOrg: { id: string };

// Org DEFAULT matrix: standard 4-tier thresholds.
const SCALES = {
  likelihood: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
  impact: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
};
const DEFAULT_THRESHOLDS = [
  { minValue: 0, maxValue: 6, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
  { minValue: 6, maxValue: 12, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
  { minValue: 12, maxValue: 20, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
  { minValue: 20, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
];
// LOCKED (secondary) matrix: shifted thresholds so the same numeric score maps
// to a DIFFERENT label than the default — proves which version scored it.
const LOCKED_THRESHOLDS = [
  { minValue: 0, maxValue: 2, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
  { minValue: 2, maxValue: 12, label: "High", color: "#F97316", sortOrder: 1, slaDays: 14 },
  { minValue: 12, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 2, slaDays: 7 },
];

let defaultVersionId: string;
let lockedVersionId: string;

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

async function createMatrix(orgId: string, name: string, isDefault: boolean, thresholds: unknown) {
  const templateId = randomUUID();
  const versionId = randomUUID();
  await runWithOrganizationContext(orgId, async () => {
    await db.riskMatrixTemplate.create({
      data: {
        id: templateId,
        organizationId: orgId,
        name,
        dimensionCount: 2,
        gridSize: 5,
        outputScaleMax: 25,
        isActive: true,
        isDefault,
        updatedAt: new Date(),
      },
    });
    await db.riskMatrixVersion.create({
      data: {
        id: versionId,
        templateId,
        versionNumber: 1,
        scales: SCALES as never,
        thresholds: thresholds as never,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    await db.riskMatrixTemplate.update({
      where: { id: templateId },
      data: { currentVersionId: versionId },
    });
  });
  return versionId;
}

async function createScoredFinding(status = "TRIAGED") {
  let id = "";
  await runWithOrganizationContext(testOrg.id, async () => {
    const finding = await db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: `FND-RSC-${randomUUID().slice(0, 8)}`,
        title: "Rescorable finding",
        description: "Finding created against the LOCKED (non-default) matrix version.",
        source: FindingSource.AUDIT,
        severity: Severity.LOW,
        severityLabel: "Low",
        status: status as never,
        matrixVersionId: lockedVersionId,
        inherentLikelihood: 1,
        inherentImpact: 1,
        inherentScore: 1,
        createdBy: analyst.id,
        updatedAt: new Date(),
      },
    });
    id = finding.id;
  });
  return id;
}

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: `Rescore Org ${stamp}`, slug: `rescore-org-${stamp}`, updatedAt: new Date() },
  });
  otherOrg = await db.organization.create({
    data: { id: randomUUID(), name: `Rescore Org B ${stamp}`, slug: `rescore-org-b-${stamp}`, updatedAt: new Date() },
  });

  const mkUser = async (orgId: string, email: string) => {
    const u = await db.user.create({
      data: {
        id: randomUUID(),
        name: "Rescore Analyst",
        email,
        role: "ANALYST",
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });
    return {
      id: u.id,
      email: u.email!,
      role: u.role,
      organizationId: u.organizationId,
      name: u.name!,
      assignedFrameworks: u.assignedFrameworks,
    };
  };
  analyst = await mkUser(testOrg.id, `rescore-analyst-${stamp}@example.com`);
  outsider = await mkUser(otherOrg.id, `rescore-outsider-${stamp}@example.com`);

  defaultVersionId = await createMatrix(testOrg.id, "Rescore Default 5×5", true, DEFAULT_THRESHOLDS);
  lockedVersionId = await createMatrix(testOrg.id, "Rescore Locked 5×5", false, LOCKED_THRESHOLDS);
});

afterAll(async () => {
  for (const org of [testOrg, otherOrg]) {
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${org.id}`;
  }
});

describe("Story 20.2: Rescore an Existing Finding", () => {
  it("AC1: rescore uses the finding's LOCKED matrix version, not the org default", async () => {
    const caller = createCaller(analyst);
    const findingId = await createScoredFinding();

    const result = await caller.finding.rescore({
      findingId,
      likelihood: 2,
      impact: 3, // score 6 → default matrix says "Medium"; locked matrix says "High"
    });

    expect(result.matrixVersionId).toBe(lockedVersionId); // never re-anchored
    expect(Number(result.inherentScore)).toBe(6);
    expect(result.severityLabel).toBe("High"); // proves LOCKED_THRESHOLDS scored it
    expect(result.severity).toBe(Severity.HIGH);
  });

  it("AC1: rescore persists residual scoring and the ELIMINATED short-circuit", async () => {
    const caller = createCaller(analyst);
    const findingId = await createScoredFinding();

    const scored = await caller.finding.rescore({
      findingId,
      likelihood: 3,
      impact: 4,
      residualLikelihood: 1,
      residualImpact: 1,
    });
    expect(Number(scored.residualScore)).toBe(1);
    expect(scored.residualScoreLabel).toBe("Low");

    const eliminated = await caller.finding.rescore({
      findingId,
      likelihood: 3,
      impact: 4,
      residualEliminated: true,
    });
    expect(eliminated.residualScoreLabel).toBe("ELIMINATED");
    expect(eliminated.residualScore).toBeNull();
    expect(eliminated.residualEliminated).toBe(true);
  });

  it("AC2: rescore writes a FINDING_RESCORED audit entry with before/after", async () => {
    const caller = createCaller(analyst);
    const findingId = await createScoredFinding();

    await caller.finding.rescore({ findingId, likelihood: 4, impact: 5 });
    await new Promise((r) => setTimeout(r, 300)); // fire-and-forget audit settle

    const audit = await db.auditLog.findFirst({
      where: {
        entityType: "Finding",
        entityId: findingId,
        action: AuditAction.FINDING_RESCORED,
      },
    });
    expect(audit).not.toBeNull();
    const changes = audit?.changes as {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };
    expect(Number(changes.before.inherentScore)).toBe(1);
    expect(Number(changes.after.inherentScore)).toBe(20);
    expect(changes.after.severityLabel).toBe("Critical");
  });

  it("AC3: terminal-status findings reject rescore", async () => {
    const caller = createCaller(analyst);
    const findingId = await createScoredFinding("REJECTED");

    await expect(
      caller.finding.rescore({ findingId, likelihood: 2, impact: 2 })
    ).rejects.toThrow(/terminal|read-only|cannot/i);
  });

  it("Org isolation: a caller from another org cannot rescore", async () => {
    const caller = createCaller(outsider);
    const findingId = await createScoredFinding();

    await expect(
      caller.finding.rescore({ findingId, likelihood: 2, impact: 2 })
    ).rejects.toThrow();
  });

  it("Story 23.5 (MJ-3): values outside the matrix scales are rejected", async () => {
    const caller = createCaller(analyst);
    const findingId = await createScoredFinding();

    // 5×5 matrix — likelihood 999 would store a garbage normalized score.
    await expect(
      caller.finding.rescore({ findingId, likelihood: 999, impact: 3 })
    ).rejects.toThrow(/between/i);

    await expect(
      caller.finding.rescore({
        findingId,
        likelihood: 2,
        impact: 2,
        residualLikelihood: 2,
        residualImpact: 500,
      })
    ).rejects.toThrow(/between/i);

    // The finding's stored score is untouched by the rejected attempts.
    const row = await db.finding.findUnique({
      where: { id: findingId },
      select: { inherentScore: true },
    });
    expect(Number(row?.inherentScore)).toBe(1);
  });
});
