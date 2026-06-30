import { db, rawPrisma } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

let testOrg: { id: string };
let user: { id: string; email: string; role: UserRole; organizationId: string; name: string };

beforeAll(async () => {
  testOrg = await db.organization.create({
    data: { id: randomUUID(), name: "Graph Sync Org", slug: `graph-sync-${randomUUID()}`, updatedAt: new Date() },
  });
  const u = await db.user.create({
    data: { id: randomUUID(), name: "GS User", email: `gs-${randomUUID()}@t.com`, role: "GRC_ANALYST", organizationId: testOrg.id, updatedAt: new Date() },
  });
  user = { id: u.id, email: u.email!, role: u.role, organizationId: u.organizationId, name: u.name! };
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "Node" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id}`;
  // Delete AuditLog before User to avoid FK constraint violations
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
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

describe("Node-sync extension", () => {
  it("creates a Node when an OrganizationalControl is created and removes it on delete", async () => {
    // organizationalControl.create requires `name` (all other fields have defaults).
    // Router contract: controlFieldsInput — only name is required (min 1, max 200).
    const control = await caller().organizationalControl.create({
      name: `OC Sync ${randomUUID()}`,
    });

    const node = await rawPrisma.node.findUnique({
      where: { type_entityId: { type: "Control", entityId: control.id } },
    });
    expect(node).not.toBeNull();
    expect(node!.organizationId).toBe(testOrg.id);

    // organizationalControl.delete takes { id: string } and returns { success: true }.
    await caller().organizationalControl.delete({ id: control.id });

    const after = await rawPrisma.node.findUnique({
      where: { type_entityId: { type: "Control", entityId: control.id } },
    });
    expect(after).toBeNull();
  });
});
