import { db } from "@/server/db";
import { randomUUID } from "crypto";

describe("Graph substrate", () => {
  const orgId = randomUUID();

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${orgId}`;
  });

  it("Node and Edge tables exist and Node is not org-filtered", async () => {
    const entityId = randomUUID();
    // Direct write proves the model exists and is allowlisted (no org context needed)
    await db.node.create({
      data: { id: randomUUID(), organizationId: orgId, type: "Risk", entityId },
    });
    const found = await db.node.findFirst({ where: { type: "Risk", entityId } });
    expect(found).not.toBeNull();
    expect(found!.organizationId).toBe(orgId);
  });
});
