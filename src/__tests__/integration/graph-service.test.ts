import { db, rawPrisma } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { randomUUID } from "crypto";

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
