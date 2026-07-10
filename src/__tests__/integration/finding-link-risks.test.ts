/**
 * Finding → Risk linking (Story 21.2: Link a Finding to a Risk)
 *
 * AC3: finding.linkRisks creates RiskFindingLink rows (idempotent), audits
 *      FINDING_RISK_LINKED, rejects terminal findings and cross-org risks.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, AuditAction } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

let testOrg: { id: string };
let otherOrg: { id: string };
let analyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let riskA: string;
let riskB: string;
let foreignRisk: string;

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
        identifier: `FND-LNK-${randomUUID().slice(0, 8)}`,
        title: "Linkable finding",
        description: "Finding used to exercise the finding.linkRisks mutation.",
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
    data: { id: randomUUID(), name: `LNK Org ${stamp}`, slug: `lnk-org-${stamp}`, updatedAt: new Date() },
  });
  otherOrg = await db.organization.create({
    data: { id: randomUUID(), name: `LNK Org B ${stamp}`, slug: `lnk-org-b-${stamp}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: "LNK Analyst",
      email: `lnk-analyst-${stamp}@example.com`,
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

  const mkRisk = async (orgId: string, title: string) => {
    let id = "";
    await runWithOrganizationContext(orgId, async () => {
      const r = await db.risk.create({
        data: {
          id: randomUUID(),
          organizationId: orgId,
          title,
          description: "Register risk for link tests",
          severity: Severity.MEDIUM,
          updatedAt: new Date(),
        },
      });
      id = r.id;
    });
    return id;
  };
  riskA = await mkRisk(testOrg.id, "LNK register risk A");
  riskB = await mkRisk(testOrg.id, "LNK register risk B");
  foreignRisk = await mkRisk(otherOrg.id, "LNK foreign risk");
});

afterAll(async () => {
  for (const org of [testOrg, otherOrg]) {
    await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${org.id}`;
  }
});

describe("Story 21.2: finding.linkRisks", () => {
  it("AC3: links a finding to multiple risks and audits FINDING_RISK_LINKED", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding();

    await caller.finding.linkRisks({ findingId, riskIds: [riskA, riskB] });

    const links = await db.$queryRaw<Array<{ riskId: string }>>`
      SELECT "riskId" FROM "RiskFindingLink" WHERE "findingId" = ${findingId}
    `;
    expect(links.map((l) => l.riskId).sort()).toEqual([riskA, riskB].sort());

    await new Promise((r) => setTimeout(r, 300));
    const audit = await db.auditLog.findFirst({
      where: {
        entityType: "Finding",
        entityId: findingId,
        action: AuditAction.FINDING_RISK_LINKED,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("AC3: linking is idempotent (duplicate call adds nothing)", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding();

    await caller.finding.linkRisks({ findingId, riskIds: [riskA] });
    await caller.finding.linkRisks({ findingId, riskIds: [riskA] });

    const links = await db.$queryRaw<Array<{ riskId: string }>>`
      SELECT "riskId" FROM "RiskFindingLink" WHERE "findingId" = ${findingId}
    `;
    expect(links).toHaveLength(1);
  });

  it("AC3: terminal findings reject linking", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding("REJECTED");

    await expect(
      caller.finding.linkRisks({ findingId, riskIds: [riskA] })
    ).rejects.toThrow(/terminal/i);
  });

  it("AC3: cross-org risks reject linking", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding();

    await expect(
      caller.finding.linkRisks({ findingId, riskIds: [foreignRisk] })
    ).rejects.toThrow(/same organization/i);
  });
});

describe("Story 21.3: bidirectional link management", () => {
  it("finding.unlinkRisk removes the link and audits FINDING_RISK_UNLINKED", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding();

    await caller.finding.linkRisks({ findingId, riskIds: [riskA] });
    await caller.finding.unlinkRisk({ findingId, riskId: riskA });

    const links = await db.$queryRaw<Array<{ riskId: string }>>`
      SELECT "riskId" FROM "RiskFindingLink" WHERE "findingId" = ${findingId}
    `;
    expect(links).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 300));
    const audit = await db.auditLog.findFirst({
      where: {
        entityType: "Finding",
        entityId: findingId,
        action: AuditAction.FINDING_RISK_UNLINKED,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("risk.linkFindings (general) links findings and rejects terminal ones", async () => {
    const caller = createCaller(analyst);
    const open = await mkFinding("NEW");
    const terminal = await mkFinding("REJECTED");

    const result = await caller.risk.linkFindings({ riskId: riskB, findingIds: [open] });
    expect(result.some((l) => l.finding.id === open)).toBe(true);

    await expect(
      caller.risk.linkFindings({ riskId: riskB, findingIds: [terminal] })
    ).rejects.toThrow(/terminal|invalid finding/i);
  });

  it("risk.unlinkFinding removes the link; risk.getLinkedFindings reflects state", async () => {
    const caller = createCaller(analyst);
    const findingId = await mkFinding();

    await caller.risk.linkFindings({ riskId: riskA, findingIds: [findingId] });
    let linked = await caller.risk.getLinkedFindings({ riskId: riskA });
    expect(linked.some((l) => l.finding.id === findingId)).toBe(true);

    await caller.risk.unlinkFinding({ riskId: riskA, findingId });
    linked = await caller.risk.getLinkedFindings({ riskId: riskA });
    expect(linked.some((l) => l.finding.id === findingId)).toBe(false);
  });

  it("finding.listForPicker returns non-terminal findings only", async () => {
    const caller = createCaller(analyst);
    const open = await mkFinding("NEW");
    const terminal = await mkFinding("DUPLICATE");

    const options = await caller.finding.listForPicker();
    const ids = options.map((o) => o.id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(terminal);
  });
});
