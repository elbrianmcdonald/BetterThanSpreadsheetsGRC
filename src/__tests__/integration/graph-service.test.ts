import { db, rawPrisma } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { randomUUID } from "crypto";
import {
  EDGE_CATALOG,
  NODE_SYNC_MODELS,
  assertEdgeAllowed,
  GraphCatalogError,
} from "@/server/graph/graph-types";
import { graphService } from "@/server/graph/graph-service";

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

describe("graphService.createEdge", () => {
  const orgId = randomUUID();
  const controlId = randomUUID();
  const riskId = randomUUID();

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "Edge" WHERE "organizationId" = ${orgId}`;
    await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  });

  it("creates a valid MITIGATES edge and is idempotent", async () => {
    // Edge writes go through the filtered `db`, which requires org context
    // (mirrors how tRPC wraps every request in runWithOrganizationContext).
    const { first, second, edges } = await runWithOrganizationContext(orgId, async () => {
      const first = await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: controlId },
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
        properties: { role: "IN_PLACE", notes: "n" },
      });
      const second = await graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Control", id: controlId },
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
        properties: { role: "NEEDED", notes: "n2" },
      });
      const edges = await graphService.listInEdges({
        type: "MITIGATES",
        to: { type: "Risk", id: riskId },
        organizationId: orgId,
      });
      return { first, second, edges };
    });
    expect(second.id).toBe(first.id); // same row updated, not duplicated
    expect(edges).toHaveLength(1);
    expect(edges[0]!.fromEntityId).toBe(controlId);
    expect((edges[0]!.properties as { role: string }).role).toBe("NEEDED"); // updated
  });

  it("rejects a catalog-violating edge", async () => {
    // Catalog check throws before any DB write, so no org context is needed.
    await expect(
      graphService.createEdge({
        type: "MITIGATES",
        from: { type: "Risk", id: riskId },
        to: { type: "Control", id: controlId },
        organizationId: orgId,
      }),
    ).rejects.toThrow(/not allowed/);
  });

  it("isolates edges by organization", async () => {
    const otherOrg = randomUUID();
    const edges = await graphService.listInEdges({
      type: "MITIGATES",
      to: { type: "Risk", id: riskId },
      organizationId: otherOrg,
    });
    expect(edges).toHaveLength(0);
    await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${otherOrg}`;
  });
});
