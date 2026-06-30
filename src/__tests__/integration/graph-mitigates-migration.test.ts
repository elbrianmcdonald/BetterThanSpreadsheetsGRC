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

  it("delete is blocked while a MITIGATES edge exists and allowed after unlink", async () => {
    // Ensure a MITIGATES edge exists (from bulkLinkToRisk above)
    const edgeBefore = await db.edge.count({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(edgeBefore).toBeGreaterThanOrEqual(1);

    // Attempt to delete the control — must be blocked
    await expect(
      caller().organizationalControl.delete({ id: controlId }),
    ).rejects.toThrow(/Cannot delete.*active linkages/);

    // Unlink the control from the risk
    await caller().organizationalControl.unlinkFromRisk({ riskId, controlId });
    const edgeAfter = await db.edge.count({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(edgeAfter).toBe(0);

    // Now delete must succeed
    await expect(
      caller().organizationalControl.delete({ id: controlId }),
    ).resolves.not.toThrow();

    // Re-create the control for subsequent tests (if any)
    const now = new Date();
    await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-8001', 'Mit Control', ${now}, ${now})`;
  });

  it("bulkLinkToRisk drops bogus control ids — only creates edge for real org-owned control", async () => {
    // Clean any leftover edges from prior tests
    await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id} AND type = 'MITIGATES'`;

    const bogusId = randomUUID();
    await caller().organizationalControl.bulkLinkToRisk({
      riskId,
      controlIds: [controlId, bogusId],
      role: RiskOrgControlRole.IN_PLACE,
    });

    // Only the real (org-owned) controlId should produce an edge
    const edgeCount = await db.edge.count({ where: { organizationId: testOrg.id, type: "MITIGATES" } });
    expect(edgeCount).toBe(1);

    // Verify via getForRisk that exactly 1 inPlace entry exists
    const grouped = await caller().organizationalControl.getForRisk({ riskId });
    expect(grouped.inPlace).toHaveLength(1);
    expect(grouped.inPlace[0]!.OrganizationalControl.id).toBe(controlId);

    // Clean up for subsequent tests
    await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id} AND type = 'MITIGATES'`;
  });

  it("risk.create with controls-in-place creates MITIGATES edges with role IN_PLACE", async () => {
    // Use the same controlId; create a fresh risk through the router so the
    // control-link path runs. Uses risk.create's real input field: controlIdsInPlace.
    const created = await caller().risk.create({
      title: `Risk With Controls ${randomUUID()}`,
      description: "desc",
      severity: "HIGH",
      controlIdsInPlace: [controlId],
    });

    const edges = await db.edge.findMany({
      where: { organizationId: testOrg.id, type: "MITIGATES" },
      include: { toNode: { select: { entityId: true } } },
    });
    const forNewRisk = edges.filter((e) => e.toNode.entityId === created.id);
    expect(forNewRisk.length).toBeGreaterThanOrEqual(1);
    expect((forNewRisk[0]!.properties as { role: string }).role).toBe("IN_PLACE");

    await db.$executeRaw`DELETE FROM "Edge" WHERE "toNodeId" IN (SELECT id FROM "Node" WHERE "entityId" = ${created.id})`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${created.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${created.id}`;
  });
});
