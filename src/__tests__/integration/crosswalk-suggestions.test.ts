/**
 * Integration tests for one-hop transitive suggestion generation (Story 26.1).
 *
 * OC --confirmed--> FC_a --one crosswalk--> FC_b  ⇒  SUGGESTED OC → FC_b.
 *
 * @see docs/sprint-artifacts/26-1-transitive-suggestions.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  UserRole,
  FrameworkMappingType,
  StandardMappingType,
  MappingStatus,
} from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

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
        name: "Test User",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

describe("crosswalk suggestion generation - Story 26.1", () => {
  let org: { id: string };
  let admin: TestUser;
  let fwA: string, fwB: string, fwC: string;
  const C: Record<string, string> = {}; // controlId → db id
  let oc1: string, oc2: string;

  const mkFramework = async (code: string) =>
    db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        name: `FW ${code}`,
        code: `${code}-${Date.now()}`,
        version: "1.0",
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const mkControl = async (fwId: string, controlId: string) => {
    const c = await db.control.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        frameworkId: fwId,
        controlId,
        title: `Control ${controlId}`,
        description: "d",
        updatedAt: new Date(),
      },
    });
    C[controlId] = c.id;
    return c.id;
  };

  const mkOrgControl = async (localControlId: string) => {
    const c = await db.organizationalControl.create({
      data: { id: randomUUID(), organizationId: org.id, localControlId, name: `Org ${localControlId}` },
    });
    return c.id;
  };

  const confirmOrgMapping = (orgControlId: string, frameworkControlId: string, t: StandardMappingType) =>
    db.orgControlFrameworkMapping.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        orgControlId,
        frameworkControlId,
        mappingType: t,
        status: MappingStatus.CONFIRMED,
      },
    });

  const crosswalk = (sourceControlId: string, targetControlId: string, t: FrameworkMappingType) =>
    db.frameworkControlMapping.create({
      data: {
        id: randomUUID(),
        organizationId: org.id,
        sourceControlId,
        targetControlId,
        mappingType: t,
      },
    });

  beforeAll(async () => {
    org = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Sugg Org ${Date.now()}`,
        slug: `sugg-org-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    const email = `admin-sugg-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: {
        id: randomUUID(),
        email,
        name: "Admin",
        organizationId: org.id,
        role: UserRole.ADMINISTRATOR,
        updatedAt: new Date(),
      },
    });
    admin = { id: adminRow.id, email, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const A = await mkFramework("A");
      const B = await mkFramework("B");
      const Cf = await mkFramework("C");
      fwA = A.id;
      fwB = B.id;
      fwC = Cf.id;

      await mkControl(fwA, "A-1");
      await mkControl(fwA, "A-2");
      await mkControl(fwB, "B-1");
      await mkControl(fwB, "B-2");
      await mkControl(fwB, "B-3");
      await mkControl(fwC, "C-1");

      oc1 = await mkOrgControl("OC-0001");
      oc2 = await mkOrgControl("OC-0002");

      // Confirmed legs.
      await confirmOrgMapping(oc1, C["A-1"]!, StandardMappingType.EQUIVALENT);
      await confirmOrgMapping(oc2, C["A-2"]!, StandardMappingType.EQUIVALENT);

      // Crosswalks touching B.
      await crosswalk(C["A-1"]!, C["B-1"]!, FrameworkMappingType.EQUIVALENT); // → OC1→B-1 EQUIVALENT (100)
      await crosswalk(C["A-1"]!, C["B-2"]!, FrameworkMappingType.INTERSECTS); // → OC1→B-2 INTERSECTS (≤60)
      await crosswalk(C["B-3"]!, C["A-1"]!, FrameworkMappingType.SUBSET_OF); // reverse: A-1→B-3 = SUPERSET_OF
      await crosswalk(C["A-2"]!, C["B-1"]!, FrameworkMappingType.EQUIVALENT); // → OC2→B-1 (but pre-rejected below)

      // Multi-hop bait: a crosswalk from B into C. Must NOT yield OC1→C-1.
      await crosswalk(C["B-1"]!, C["C-1"]!, FrameworkMappingType.EQUIVALENT);

      // Pre-existing REJECTED OC2→B-1 must block re-suggestion (FR16).
      await db.orgControlFrameworkMapping.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          orgControlId: oc2,
          frameworkControlId: C["B-1"]!,
          mappingType: StandardMappingType.EQUIVALENT,
          status: MappingStatus.REJECTED,
        },
      });
    });
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("generates one-hop suggestions with composed type + confidence + lineage (AC1,2,3)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwB });
    // OC1→B-1, OC1→B-2, OC1→B-3 (OC2→B-1 is blocked by the REJECTED row).
    expect(res.generated).toBe(3);

    const suggestions = await caller.crosswalk.listSuggestions({ targetFrameworkId: fwB });
    const byTarget = new Map(suggestions.map((s) => [s.FrameworkControl.controlId, s]));

    const b1 = byTarget.get("B-1")!;
    expect(b1.status).toBe(MappingStatus.SUGGESTED);
    expect(b1.mappingType).toBe(StandardMappingType.EQUIVALENT);
    expect(b1.confidence).toBe(100);
    expect((b1.derivedVia as { chain: string }).chain).toBe("OC-0001 → A-1 → B-1");

    const b2 = byTarget.get("B-2")!;
    expect(b2.mappingType).toBe(StandardMappingType.INTERSECTS); // weakest edge
    expect(b2.confidence).toBeLessThanOrEqual(60);

    const b3 = byTarget.get("B-3")!;
    expect(b3.mappingType).toBe(StandardMappingType.SUPERSET_OF); // reverse-edge inversion
  });

  it("does not re-propose on a second run, and never re-suggests REJECTED (AC4)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwB });
    expect(res.generated).toBe(0);

    // OC2→B-1 stays a single REJECTED row (never re-suggested).
    const oc2b1 = await db.orgControlFrameworkMapping.findMany({
      where: { organizationId: org.id, orgControlId: oc2, frameworkControlId: C["B-1"] },
      select: { status: true },
    });
    expect(oc2b1).toHaveLength(1);
    expect(oc2b1[0]!.status).toBe(MappingStatus.REJECTED);
  });

  it("never chains through multiple crosswalks (AC1)", async () => {
    const caller = createCaller(admin);
    // Generating for C finds no confirmed OC leg one hop away → nothing (the
    // B→C crosswalk starts from B-1, which is only SUGGESTED, not a confirmed leg).
    const res = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwC });
    expect(res.generated).toBe(0);

    const cSuggestions = await caller.crosswalk.listSuggestions({ targetFrameworkId: fwC });
    expect(cSuggestions.find((s) => s.FrameworkControl.controlId === "C-1")).toBeUndefined();
  });
});

describe("crosswalk suggestion conflict merge - Epic 26 review", () => {
  let org: { id: string };
  let admin: TestUser;
  let fwB2: string;

  beforeAll(async () => {
    org = await db.organization.create({ data: { id: randomUUID(), name: `Conflict Org ${Date.now()}`, slug: `conflict-${Date.now()}`, updatedAt: new Date() } });
    const email = `admin-conflict-${Date.now()}@example.com`;
    const adminRow = await db.user.create({ data: { id: randomUUID(), email, name: "Admin", organizationId: org.id, role: UserRole.ADMINISTRATOR, updatedAt: new Date() } });
    admin = { id: adminRow.id, email, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const A = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "CA", code: `CA${Date.now()}`, version: "1", isActive: true, updatedAt: new Date() } });
      const B = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "CB", code: `CB${Date.now()}`, version: "1", isActive: true, updatedAt: new Date() } });
      fwB2 = B.id;
      const a1 = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: A.id, controlId: "A-1", title: "a1", description: "d", updatedAt: new Date() } });
      const a2 = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: A.id, controlId: "A-2", title: "a2", description: "d", updatedAt: new Date() } });
      const b1 = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: B.id, controlId: "B-1", title: "b1", description: "d", updatedAt: new Date() } });
      const oc = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-1", name: "oc" } });
      // OC is EQUIVALENT to both A-1 and A-2.
      await db.orgControlFrameworkMapping.create({ data: { id: randomUUID(), organizationId: org.id, orgControlId: oc.id, frameworkControlId: a1.id, mappingType: StandardMappingType.EQUIVALENT, status: MappingStatus.CONFIRMED } });
      await db.orgControlFrameworkMapping.create({ data: { id: randomUUID(), organizationId: org.id, orgControlId: oc.id, frameworkControlId: a2.id, mappingType: StandardMappingType.EQUIVALENT, status: MappingStatus.CONFIRMED } });
      // Conflicting directional crosswalks into the SAME B-1: A-1 ⊆ B-1, A-2 ⊇ B-1.
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: org.id, sourceControlId: a1.id, targetControlId: b1.id, mappingType: FrameworkMappingType.SUBSET_OF } });
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: org.id, sourceControlId: a2.id, targetControlId: b1.id, mappingType: FrameworkMappingType.SUPERSET_OF } });
    });
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("merges two equally-strong contradictory chains to INTERSECTS (deterministic)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwB2 });
    expect(res.generated).toBe(1); // one pair OC→B-1, not two
    const list = await caller.crosswalk.listSuggestions({ targetFrameworkId: fwB2 });
    const b1 = list.find((s) => s.FrameworkControl.controlId === "B-1")!;
    expect(b1.mappingType).toBe(StandardMappingType.INTERSECTS); // SUBSET vs SUPERSET → overlap
    expect(b1.confidence).toBeLessThanOrEqual(60);
  });
});
