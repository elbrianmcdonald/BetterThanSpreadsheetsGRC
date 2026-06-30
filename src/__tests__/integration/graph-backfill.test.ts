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
  // Seed entity rows via raw SQL (bypass extensions to simulate pre-graph data)
  await db.$executeRaw`INSERT INTO "Organization" (id, name, slug, "updatedAt") VALUES (${orgId}, 'BF Org', ${"bf-" + orgId}, ${now})`;
  await db.$executeRaw`INSERT INTO "OrganizationalControl" (id, "organizationId", "localControlId", name, "createdAt", "updatedAt") VALUES (${controlId}, ${orgId}, 'OC-9001', 'BF Control', ${now}, ${now})`;
  await db.$executeRaw`INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt") VALUES (${riskId}, ${orgId}, 'BF Risk', 'd', 'HIGH', 'OPEN', ${now}, ${now})`;
  // Note: RiskOrganizationalControl table has been dropped (Task 10 clean cut).
  // MITIGATES edges are now written directly by graphService; the backfill only
  // creates Node rows (sections 1-3). No legacy migration needed here.
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${orgId}`;
});

describe("backfillGraph", () => {
  it("creates Control and Risk nodes and is idempotent", async () => {
    const result = await backfillGraph();

    const controlNode = await db.node.findUnique({ where: { type_entityId: { type: "Control", entityId: controlId } } });
    const riskNode = await db.node.findUnique({ where: { type_entityId: { type: "Risk", entityId: riskId } } });
    expect(controlNode).not.toBeNull();
    expect(riskNode).not.toBeNull();

    // mitigatesEdges is always 0 after the clean cut (no table to migrate from)
    expect(result.mitigatesEdges).toBe(0);

    // Run again — no duplicates
    const result2 = await backfillGraph();
    expect(result2.nodes).toBe(0); // skipDuplicates means 0 new rows on second run
  });
});
