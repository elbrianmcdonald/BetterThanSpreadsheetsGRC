import { db } from "@/server/db";
import { backfillGraph } from "../../../prisma/scripts/backfill-graph";
import { randomUUID } from "crypto";

let orgId: string;
let controlId: string;
let riskId: string;

beforeAll(async () => {
  orgId = randomUUID();
  controlId = randomUUID();
  riskId = randomUUID();
  const now = new Date();
  // Seed legacy rows via raw SQL (bypass extensions to simulate pre-graph data)
  await db.$executeRaw`INSERT INTO "Organization" (id, name, slug, "updatedAt") VALUES (${orgId}, 'BF Org', ${"bf-" + orgId}, ${now})`;
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${orgId}, 'OC-9001', 'BF Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${orgId}, 'BF Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "RiskOrganizationalControl" (id, "organizationId", "riskId", "organizationalControlId", role, notes, "createdAt", "updatedAt") VALUES (${randomUUID()}, ${orgId}, ${riskId}, ${controlId}, 'IN_PLACE', 'legacy', ${now}, ${now})`;
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "RiskOrganizationalControl" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${orgId}`;
});

describe("backfillGraph", () => {
  it("creates nodes + MITIGATES edges and is idempotent", async () => {
    await backfillGraph();

    const controlNode = await db.node.findUnique({ where: { type_entityId: { type: "Control", entityId: controlId } } });
    const riskNode = await db.node.findUnique({ where: { type_entityId: { type: "Risk", entityId: riskId } } });
    expect(controlNode).not.toBeNull();
    expect(riskNode).not.toBeNull();

    const edgesAfterFirst = await db.edge.count({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect(edgesAfterFirst).toBe(1);

    // Run again — no duplicates
    await backfillGraph();
    const edgesAfterSecond = await db.edge.count({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect(edgesAfterSecond).toBe(1);

    const edge = await db.edge.findFirst({ where: { organizationId: orgId, type: "MITIGATES" } });
    expect((edge!.properties as { role: string }).role).toBe("IN_PLACE");
  });
});
