import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, RiskOrgControlRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let controlId: string;
let riskId: string;

beforeAll(async () => {
  testOrg = await db.organization.create({ data: { id: randomUUID(), name: "Mit Org", slug: `mit-${randomUUID()}`, updatedAt: new Date() } });
  const u = await db.user.create({ data: { id: randomUUID(), name: "Mit User", email: `mit-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() } });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
  const now = new Date();
  controlId = randomUUID();
  riskId = randomUUID();
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-8001', 'Mit Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${testOrg.id}, 'Mit Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

function caller() {
  return appRouter.createCaller({
    db,
    session: { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, name: user.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("MITIGATES migration — organizationalControl router contract", () => {
  it("linkToRisk creates an edge and getForRisk returns it under inPlace", async () => {
    await caller().organizationalControl.linkToRisk({ riskId, controlId, role: RiskOrgControlRole.IN_PLACE, notes: "n" });

    const edge = await db.edge.findFirst({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(edge).not.toBeNull();

    const grouped = await caller().organizationalControl.getForRisk({ riskId });
    expect(grouped.inPlace).toHaveLength(1);
    expect(grouped.inPlace[0]!.OrganizationalControl.id).toBe(controlId);
    expect(grouped.needed).toHaveLength(0);
  });

  it("getLinkedRisks returns the risk for the control", async () => {
    const links = await caller().organizationalControl.getLinkedRisks({ controlId });
    expect(links.some((l: { riskId: string }) => l.riskId === riskId)).toBe(true);
  });

  it("unlinkFromRisk removes the edge", async () => {
    await caller().organizationalControl.unlinkFromRisk({ riskId, controlId });
    const count = await db.edge.count({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(count).toBe(0);
  });

  it("bulkLinkToRisk links multiple controls", async () => {
    await caller().organizationalControl.bulkLinkToRisk({ riskId, controlIds: [controlId], role: RiskOrgControlRole.NEEDED });
    const grouped = await caller().organizationalControl.getForRisk({ riskId });
    expect(grouped.needed).toHaveLength(1);
  });
});
