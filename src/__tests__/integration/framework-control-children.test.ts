/**
 * Integration test for framework.getControlChildren.
 *
 * The isolation case is the one that matters: an org-B caller must not be able
 * to read org-A's controls by passing org-A's parent control id.
 *
 * @see src/server/api/routers/framework.ts
 * @see src/lib/frameworks/framework-node.ts (the ControlInput shape this returns)
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { controlsToNodes, type ControlInput } from "@/lib/frameworks/framework-node";

type TestUser = { id: string; email: string; organizationId: string; role: UserRole };

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        name: "T",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkUser(orgId: string, role: UserRole, tag: string): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: { id: randomUUID(), email, name: tag, organizationId: orgId, platformRole: role, updatedAt: new Date() },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

const mkControl = (
  orgId: string,
  frameworkId: string,
  controlId: string,
  parentControlId: string | null,
) =>
  db.control.create({
    data: {
      id: randomUUID(),
      organizationId: orgId,
      frameworkId,
      controlId,
      title: `Control ${controlId}`,
      description: `Description for ${controlId}`,
      parentControlId,
      updatedAt: new Date(),
    },
  });

describe("framework.getControlChildren", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let adminA: TestUser;
  let adminB: TestUser;
  let parentId: string; // org A "03.01", two children
  let bigParentId: string; // org A "03.02", seven children

  beforeAll(async () => {
    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `ChildrenA ${Date.now()}`, slug: `children-a-${Date.now()}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `ChildrenB ${Date.now()}`, slug: `children-b-${Date.now()}`, updatedAt: new Date() },
    });
    adminA = await mkUser(orgA.id, UserRole.ADMINISTRATOR, "children-admin-a");
    adminB = await mkUser(orgB.id, UserRole.ADMINISTRATOR, "children-admin-b");

    await runWithOrganizationContext(orgA.id, async () => {
      const framework = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          name: "Children Test Framework",
          code: `CTF${orgA.id.slice(0, 6)}`,
          version: "1",
          isActive: true,
          updatedAt: new Date(),
        },
      });

      const parent = await mkControl(orgA.id, framework.id, "03.01", null);
      parentId = parent.id;
      // Created out of order so the orderBy in the procedure is what sorts them.
      await mkControl(orgA.id, framework.id, "03.01.02", parent.id);
      await mkControl(orgA.id, framework.id, "03.01.01", parent.id);

      const bigParent = await mkControl(orgA.id, framework.id, "03.02", null);
      bigParentId = bigParent.id;
      for (let i = 1; i <= 7; i++) {
        await mkControl(orgA.id, framework.id, `03.02.0${i}`, bigParent.id);
      }
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id} AND "parentControlId" IS NOT NULL`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("returns every child of a parent, ordered by controlId", async () => {
    const children = await createCaller(adminA).framework.getControlChildren({
      parentControlId: parentId,
    });

    expect(children.map((c) => c.controlId)).toEqual(["03.01.01", "03.01.02"]);
    expect(children[0]!._count.other_Control).toBe(0);

    // The payload must be exactly what Task 1's controlsToNodes consumes. The
    // annotation is the compile-time half of that contract; the call is the
    // runtime half.
    const nodeInput: ControlInput[] = children;
    const nodes = controlsToNodes(nodeInput, 1);
    expect(nodes.map((n) => n.code)).toEqual(["03.01.01", "03.01.02"]);
    // Leaves are "loaded" ([]), not "unfetched" (null) — this drives the chevron.
    expect(nodes[0]!.children).toEqual([]);
    expect(nodes[0]!.depth).toBe(1);
  });

  it("returns more than five children (it is not the getControls preview limit)", async () => {
    const children = await createCaller(adminA).framework.getControlChildren({
      parentControlId: bigParentId,
    });

    expect(children).toHaveLength(7);
  });

  it("returns an empty array for a leaf control", async () => {
    const children = await createCaller(adminA).framework.getControlChildren({
      parentControlId: parentId,
    });
    const leafId = children[0]!.id;

    await expect(
      createCaller(adminA).framework.getControlChildren({ parentControlId: leafId }),
    ).resolves.toEqual([]);
  });

  it("does not leak another org's controls - cross-tenant isolation", async () => {
    // Sanity: the same id is readable by its own org, so a NOT_FOUND below is
    // the org filter talking, not a missing/misrouted procedure.
    await expect(
      createCaller(adminA).framework.getControlChildren({ parentControlId: parentId }),
    ).resolves.toHaveLength(2);

    await expect(
      createCaller(adminB).framework.getControlChildren({ parentControlId: parentId }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      // Not tRPC's own "No procedure found on path ..." NOT_FOUND.
      message: expect.stringMatching(/control not found/i),
    });
  });
});
