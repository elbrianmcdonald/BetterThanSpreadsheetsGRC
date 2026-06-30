import { db, rawPrisma } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { randomUUID } from "crypto";
import {
  EDGE_CATALOG,
  NODE_SYNC_MODELS,
  assertEdgeAllowed,
  GraphCatalogError,
} from "@/server/graph/graph-types";

describe("Graph substrate (default-deny tenancy)", () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const fromEntityId = randomUUID();
  const toEntityId = randomUUID();
  const globalTechniqueEntityId = randomUUID();
  let edgeId: string;

  beforeAll(async () => {
    // rawPrisma bypasses the org filter — the sanctioned escape hatch.
    const fromNode = await rawPrisma.node.create({
      data: { organizationId: orgA, type: "Control", entityId: fromEntityId },
    });
    const toNode = await rawPrisma.node.create({
      data: { organizationId: orgA, type: "Risk", entityId: toEntityId },
    });
    const edge = await rawPrisma.edge.create({
      data: { organizationId: orgA, type: "MITIGATES", fromNodeId: fromNode.id, toNodeId: toNode.id },
    });
    edgeId = edge.id;
    // A global (null-org) Technique node must be creatable via rawPrisma.
    await rawPrisma.node.create({
      data: { organizationId: null, type: "Technique", entityId: globalTechniqueEntityId },
    });
  });

  afterAll(async () => {
    await rawPrisma.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgA}`;
    await rawPrisma.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgA}`;
    await rawPrisma.$executeRaw`DELETE FROM "Node" WHERE "entityId" = ${globalTechniqueEntityId}`;
  });

  it("creates a global (null-org) Technique node via rawPrisma", async () => {
    const node = await rawPrisma.node.findFirst({ where: { entityId: globalTechniqueEntityId } });
    expect(node).not.toBeNull();
    expect(node!.organizationId).toBeNull();
  });

  it("default-denies Edge: org A sees its edge, org B does not", async () => {
    const seenByA = await runWithOrganizationContext(orgA, async () =>
      db.edge.findMany({ where: { type: "MITIGATES" } }),
    );
    expect(seenByA.some((e) => e.id === edgeId)).toBe(true);

    const seenByB = await runWithOrganizationContext(orgB, async () =>
      db.edge.findMany({ where: { type: "MITIGATES" } }),
    );
    expect(seenByB.some((e) => e.id === edgeId)).toBe(false);
  });
});

describe("Graph types", () => {
  it("maps entity models to node types", () => {
    expect(NODE_SYNC_MODELS.OrganizationalControl).toBe("Control");
    expect(NODE_SYNC_MODELS.Risk).toBe("Risk");
    expect(NODE_SYNC_MODELS.MitreTechnique).toBe("Technique");
  });

  it("defines MITIGATES and COUNTERS in the catalog", () => {
    expect(EDGE_CATALOG.MITIGATES).toEqual({ from: "Control", to: "Risk" });
    expect(EDGE_CATALOG.COUNTERS).toEqual({ from: "Control", to: "Technique" });
  });

  it("accepts a valid edge triple", () => {
    expect(() => assertEdgeAllowed("MITIGATES", "Control", "Risk")).not.toThrow();
  });

  it("rejects an invalid edge triple with GraphCatalogError", () => {
    expect(() => assertEdgeAllowed("MITIGATES", "Risk", "Control")).toThrow(
      GraphCatalogError,
    );
  });
});
