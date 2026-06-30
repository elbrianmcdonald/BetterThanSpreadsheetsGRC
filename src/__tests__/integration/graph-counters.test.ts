import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let controlId: string;
let techniqueId: string;

beforeAll(async () => {
  testOrg = await db.organization.create({ data: { id: randomUUID(), name: "Ctr Org", slug: `ctr-${randomUUID()}`, updatedAt: new Date() } });
  const u = await db.user.create({ data: { id: randomUUID(), name: "Ctr User", email: `ctr-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() } });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
  const now = new Date();
  controlId = randomUUID();
  techniqueId = randomUUID();
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-7001', 'Ctr Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "MitreTechnique" (id, "externalId", name, description, url, "createdAt", "updatedAt") VALUES (${techniqueId}, ${"T" + Math.floor(1000 + (techniqueId.charCodeAt(0) % 9000))}, 'Test Technique', 'd', 'http://x', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${controlId} OR "entityId" = ${techniqueId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "MitreTechnique" WHERE id = ${techniqueId}`;
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

describe("COUNTERS edges (Control -> global Technique)", () => {
  it("counters, lists, and uncounters a technique", async () => {
    await caller().graph.counterTechnique({ controlId, techniqueId });

    const edge = await db.edge.findFirst({ where: { organizationId: testOrg.id, type: "COUNTERS" }, include: { toNode: true } });
    expect(edge).not.toBeNull();
    expect(edge!.toNode.organizationId).toBeNull(); // technique node is global

    const listed = await caller().graph.listCounteredTechniques({ controlId });
    expect(listed.map((t) => t.id)).toContain(techniqueId);

    const res = await caller().graph.uncounterTechnique({ controlId, techniqueId });
    expect(res.success).toBe(true);
    const after = await db.edge.count({ where: { organizationId: testOrg.id, type: "COUNTERS" } });
    expect(after).toBe(0);
  });
});
