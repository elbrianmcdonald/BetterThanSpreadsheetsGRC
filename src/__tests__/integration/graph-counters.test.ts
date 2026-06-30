import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let controlId: string;
let techniqueId: string;

// Org B — used only in cross-tenant isolation test
let testOrgB: { id: string };
let userB: { id: string; email: string; role: UserRole; organizationId: string; name: string };

beforeAll(async () => {
  testOrg = await db.organization.create({ data: { id: randomUUID(), name: "Ctr Org", slug: `ctr-${randomUUID()}`, updatedAt: new Date() } });
  const u = await db.user.create({ data: { id: randomUUID(), name: "Ctr User", email: `ctr-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() } });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
  const now = new Date();
  controlId = randomUUID();
  techniqueId = randomUUID();
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${testOrg.id}, 'OC-7001', 'Ctr Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "MitreTechnique" (id, "externalId", name, description, url, "createdAt", "updatedAt") VALUES (${techniqueId}, ${"T" + Math.floor(1000 + (techniqueId.charCodeAt(0) % 9000))}, 'Test Technique', 'd', 'http://x', ${now}, ${now})`;

  // Org B — a separate tenant with no ownership of org A's resources
  testOrgB = await db.organization.create({ data: { id: randomUUID(), name: "Ctr Org B", slug: `ctr-b-${randomUUID()}`, updatedAt: new Date() } });
  const uB = await db.user.create({ data: { id: randomUUID(), name: "Ctr User B", email: `ctr-b-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrgB.id, updatedAt: new Date() } });
  userB = { id: uB.id, email: uB.email!, role: uB.role, organizationId: uB.organizationId, name: uB.name! };
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${controlId} OR "entityId" = ${techniqueId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "MitreTechnique" WHERE id = ${techniqueId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;

  // Org B cleanup — defensive edge sweep in case isolation ever fails
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${testOrgB.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgB.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrgB.id}`;
});

function caller() {
  return appRouter.createCaller({
    db,
    session: { user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, name: user.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

function callerB() {
  return appRouter.createCaller({
    db,
    session: { user: { id: userB.id, email: userB.email, role: userB.role, organizationId: userB.organizationId, name: userB.name, image: null, assignedFrameworks: [] }, expires: new Date(Date.now() + 86400000).toISOString() },
    organizationId: userB.organizationId,
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

describe("techniqueExposure traversal", () => {
  it("returns techniques reachable from a risk via mitigating controls", async () => {
    const riskId = randomUUID();
    const now = new Date();
    await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${testOrg.id}, 'Exp Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;

    // Control MITIGATES Risk, Control COUNTERS Technique
    await caller().organizationalControl.linkToRisk({ riskId, controlId, role: "IN_PLACE" as never });
    await caller().graph.counterTechnique({ controlId, techniqueId });

    const exposure = await caller().graph.techniqueExposure({ riskId });
    expect(exposure.map((t) => t.id)).toContain(techniqueId);

    await db.$executeRaw`DELETE FROM "Edge" WHERE "toNodeId" IN (SELECT id FROM "Node" WHERE "entityId" = ${riskId})`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${riskId}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${riskId}`;
  });
});

describe("graph router cross-tenant isolation", () => {
  it("denies org B from creating a COUNTERS edge against org A's control (IDOR regression)", async () => {
    // Org B attempts to counter a technique using org A's controlId.
    // The org-filter extension scopes OrganizationalControl lookups to the caller's org,
    // so the control resolves to null for org B → the router must throw NOT_FOUND.
    let caughtError: unknown;
    try {
      await callerB().graph.counterTechnique({ controlId, techniqueId });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError).toBeInstanceOf(TRPCError);
    expect((caughtError as TRPCError).code).toBe("NOT_FOUND");

    // No COUNTERS edge must have been written for org B
    const orgBEdgeCount = await db.edge.count({ where: { organizationId: testOrgB.id, type: "COUNTERS" } });
    expect(orgBEdgeCount).toBe(0);
  });
});
