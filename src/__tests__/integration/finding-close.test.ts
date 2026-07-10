/**
 * Finding CLOSED lifecycle (Story 21.4: Close a Finding Without Forced Linking)
 *
 * AC1: Closing with zero risk links succeeds (nudge is client-side only).
 * AC2: TRIAGED→CLOSED sets closedAt; CLOSED is terminal.
 * AC3: CLOSED findings are read-only for rescoring and linking.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, FindingStatus } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let riskId: string;

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

async function mkFinding(status = "TRIAGED") {
  let id = "";
  await runWithOrganizationContext(testOrg.id, async () => {
    const f = await db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        identifier: `FND-CLS-${randomUUID().slice(0, 8)}`,
        title: "Closable finding",
        description: "Finding used to exercise the CLOSED lifecycle transition.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
        status: status as never,
        createdBy: analyst.id,
        updatedAt: new Date(),
      },
    });
    id = f.id;
  });
  return id;
}

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: `CLS Org ${stamp}`, slug: `cls-org-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "CLS Analyst",
      email: `cls-analyst-${stamp}@example.com`,
      platformRole: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  analyst = {
    id: u.id,
    email: u.email!,
    role: "ANALYST",
    organizationId: u.organizationId,
    name: u.name!,
    assignedFrameworks: u.assignedFrameworks,
  };
  await runWithOrganizationContext(testOrg.id, async () => {
    const r = await db.risk.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        title: "CLS register risk",
        description: "Risk for close-lifecycle link tests",
        severity: Severity.MEDIUM,
        updatedAt: new Date(),
      },
    });
    riskId = r.id;
  });
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" = ${riskId}`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

describe("Story 21.4: CLOSED lifecycle", () => {
  it("AC1+AC2: TRIAGED→CLOSED succeeds with zero links and sets closedAt", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding("TRIAGED");

    const result = await caller.finding.transition({
      findingId,
      targetStatus: FindingStatus.CLOSED,
    });

    expect(result.status).toBe(FindingStatus.CLOSED);
    expect(result.closedAt).not.toBeNull();
  });

  it("AC2: CLOSED is terminal — no further transitions", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding("TRIAGED");
    await caller.finding.transition({ findingId, targetStatus: FindingStatus.CLOSED });

    await expect(
      caller.finding.transition({ findingId, targetStatus: FindingStatus.TRIAGED })
    ).rejects.toThrow();
  });

  it("AC3: CLOSED findings reject rescore and linking", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding("TRIAGED");
    await caller.finding.transition({ findingId, targetStatus: FindingStatus.CLOSED });

    await expect(
      caller.finding.rescore({ findingId, likelihood: 2, impact: 2 })
    ).rejects.toThrow(/terminal/i);
    await expect(
      caller.finding.linkRisks({ findingId, riskIds: [riskId] })
    ).rejects.toThrow(/terminal/i);
  });

  it("AC2: NEW findings cannot jump straight to CLOSED", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding("NEW");

    await expect(
      caller.finding.transition({ findingId, targetStatus: FindingStatus.CLOSED })
    ).rejects.toThrow();
  });
});
