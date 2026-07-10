/**
 * Risk creation from compliance assessments (Story 21.1, re-scoped)
 *
 * AC1: Linked findings become RiskFindingLink rows; spawnedFromFindingId
 *      stays NULL (the finding-becomes-risk spawn path stops growing).
 * AC2: Zero linked findings is allowed (linking recommended, not required).
 * AC3: Cross-assessment findings are still rejected.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let assessmentId: string;
let otherAssessmentId: string;
let findingA: string;
let findingB: string;
let findingOther: string;

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
    data: { id: randomUUID(), name: `CFA Org ${stamp}`, slug: `cfa-org-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "CFA Analyst",
      email: `cfa-analyst-${stamp}@example.com`,
      role: "ANALYST",
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

  await runWithOrganizationContext(testOrg.id, async () => {
    const framework = await db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        code: `CFA-${stamp}`,
        name: "CFA Test Framework",
        version: "1.0",
        updatedAt: new Date(),
      },
    });
    const assessment = await db.complianceAssessment.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        frameworkId: framework.id,
        identifier: `CA-CFA-${stamp}-1`,
        name: `CFA Assessment ${stamp}`,
        ownerId: analyst.id,
        updatedAt: new Date(),
      },
    });
    assessmentId = assessment.id;
    const other = await db.complianceAssessment.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        frameworkId: framework.id,
        identifier: `CA-CFA-${stamp}-2`,
        name: `CFA Other Assessment ${stamp}`,
        ownerId: analyst.id,
        updatedAt: new Date(),
      },
    });
    otherAssessmentId = other.id;

    const mkFinding = async (title: string, srcAssessment: string) => {
      const f = await db.finding.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          identifier: `FND-CFA-${randomUUID().slice(0, 8)}`,
          title,
          description: "Assessment-sourced finding for createForAssessment tests.",
          source: FindingSource.AUDIT,
          severity: Severity.MEDIUM,
          status: "NEW",
          sourceComplianceAssessmentId: srcAssessment,
          createdBy: analyst.id,
          updatedAt: new Date(),
        },
      });
      return f.id;
    };
    findingA = await mkFinding("CFA finding A", assessmentId);
    findingB = await mkFinding("CFA finding B", assessmentId);
    findingOther = await mkFinding("CFA finding other-assessment", otherAssessmentId);
  });
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "ComplianceAssessment" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

describe("Story 21.1: risk.createForAssessment (re-scoped)", () => {
  it("AC1: linked findings become RiskFindingLink rows (the join is the sole source of truth)", async () => {
    const caller = createCaller(analyst);

    const risk = await caller.risk.createForAssessment({
      title: "Assessment risk with two findings",
      description: "Risk aggregating two assessment findings via links only.",
      severity: Severity.HIGH,
      complianceAssessmentId: assessmentId,
      linkedFindingIds: [findingA, findingB],
    });

    const links = await db.$queryRaw<Array<{ findingId: string }>>`
      SELECT "findingId" FROM "RiskFindingLink" WHERE "riskId" = ${risk.id}
    `;
    expect(links.map((l) => l.findingId).sort()).toEqual([findingA, findingB].sort());
  });

  it("AC2: creating with zero linked findings succeeds", async () => {
    const caller = createCaller(analyst);

    const risk = await caller.risk.createForAssessment({
      title: "Assessment risk without findings",
      description: "Linking is recommended but not required (FR5).",
      severity: Severity.MEDIUM,
      complianceAssessmentId: assessmentId,
      linkedFindingIds: [],
    });

    expect(risk.id).toBeTruthy();
    const links = await db.$queryRaw<Array<{ findingId: string }>>`
      SELECT "findingId" FROM "RiskFindingLink" WHERE "riskId" = ${risk.id}
    `;
    expect(links).toHaveLength(0);
  });

  it("AC3: findings from a different assessment are still rejected", async () => {
    const caller = createCaller(analyst);

    await expect(
      caller.risk.createForAssessment({
        title: "Assessment risk with foreign finding",
        description: "Must reject findings raised in another assessment.",
        severity: Severity.LOW,
        complianceAssessmentId: assessmentId,
        linkedFindingIds: [findingOther],
      })
    ).rejects.toThrow(/from this assessment/i);
  });
});
