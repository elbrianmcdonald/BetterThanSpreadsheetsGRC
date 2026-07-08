/**
 * Integration tests for the crosswalk router (Epic 25, Story 25.2).
 *
 * Verifies crosswalking between ANY two frameworks (not the org's base):
 * - createMapping across two frameworks persists with OLIR type (AC1)
 * - many-to-many: one source → many targets, one target ← many sources (AC3)
 * - duplicate source→target pair rejected, not duplicated (AC3)
 * - same-framework pair rejected (AC1 semantics)
 * - listCrosswalks returns the pair with count + names, org-scoped (AC2, NFR2)
 * - view-role user can read; non-manage role denied createMapping (AC4)
 *
 * @see docs/sprint-artifacts/25-2-any-framework-crosswalk.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, FrameworkMappingType, StandardMappingType } from "@prisma/client";
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

async function makeFramework(orgId: string, code: string, controlIds: string[]) {
  return runWithOrganizationContext(orgId, async () => {
    const fw = await db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        name: `Framework ${code}`,
        code: `${code}-${Date.now()}`,
        version: "1.0",
        isActive: true,
        updatedAt: new Date(),
      },
    });
    const controls = [];
    for (const cid of controlIds) {
      controls.push(
        await db.control.create({
          data: {
            id: randomUUID(),
            organizationId: orgId,
            frameworkId: fw.id,
            controlId: cid,
            title: `Control ${cid}`,
            description: `Desc ${cid}`,
            updatedAt: new Date(),
          },
        }),
      );
    }
    return { fw, controls };
  });
}

describe("crosswalk router - Story 25.2", () => {
  let testOrg: { id: string };
  let otherOrg: { id: string };
  let admin: TestUser;
  let auditor: TestUser;
  let fwA: { id: string };
  let fwB: { id: string };
  let a1: string, a2: string, b1: string, b2: string;

  beforeAll(async () => {
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Crosswalk Org ${Date.now()}`,
        slug: `crosswalk-org-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    otherOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Other Org ${Date.now()}`,
        slug: `other-org-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const adminEmail = `admin-xw-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: adminEmail,
        name: "Admin",
        organizationId: testOrg.id,
        role: UserRole.ORG_ADMIN,
        updatedAt: new Date(),
      },
    });
    admin = { id: adminRow.id, email: adminEmail, organizationId: testOrg.id, role: adminRow.role };

    const auditorEmail = `auditor-xw-${Date.now()}@example.com`;
    const auditorRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: auditorEmail,
        name: "Auditor",
        organizationId: testOrg.id,
        role: UserRole.AUDITOR,
        updatedAt: new Date(),
      },
    });
    auditor = {
      id: auditorRow.id,
      email: auditorEmail,
      organizationId: testOrg.id,
      role: auditorRow.role,
    };

    const A = await makeFramework(testOrg.id, "AAA", ["A-1", "A-2"]);
    const B = await makeFramework(testOrg.id, "BBB", ["B-1", "B-2"]);
    fwA = A.fw;
    fwB = B.fw;
    a1 = A.controls[0]!.id;
    a2 = A.controls[1]!.id;
    b1 = B.controls[0]!.id;
    b2 = B.controls[1]!.id;
  });

  afterAll(async () => {
    for (const org of [testOrg, otherOrg]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("creates a crosswalk mapping across two frameworks with an OLIR type (AC1)", async () => {
    const caller = createCaller(admin);
    const created = await caller.crosswalk.createMapping({
      sourceControlId: a1,
      targetControlId: b1,
      mappingType: FrameworkMappingType.SUBSET_OF,
      notes: "a1 is narrower than b1",
    });
    expect(created.mappingType).toBe(FrameworkMappingType.SUBSET_OF);
    expect(created.SourceControl.controlId).toBe("A-1");
    expect(created.TargetControl.controlId).toBe("B-1");

    const list = await caller.crosswalk.listMappingsForPair({
      sourceFrameworkId: fwA.id,
      targetFrameworkId: fwB.id,
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.notes).toBe("a1 is narrower than b1");
  });

  it("supports many-to-many mappings (AC3)", async () => {
    const caller = createCaller(admin);
    // one source (a2) → two targets (b1, b2)
    await caller.crosswalk.createMapping({ sourceControlId: a2, targetControlId: b1 });
    await caller.crosswalk.createMapping({ sourceControlId: a2, targetControlId: b2 });
    // one target (b2) ← two sources (a1, a2) — a2→b2 already exists, add a1→b2
    await caller.crosswalk.createMapping({ sourceControlId: a1, targetControlId: b2 });

    const pair = await caller.crosswalk.getPair({
      sourceFrameworkId: fwA.id,
      targetFrameworkId: fwB.id,
    });
    // a1→b1, a2→b1, a2→b2, a1→b2 = 4
    expect(pair.mappingCount).toBe(4);
  });

  it("rejects a duplicate source→target pair (AC3)", async () => {
    const caller = createCaller(admin);
    await expect(
      caller.crosswalk.createMapping({ sourceControlId: a1, targetControlId: b1 }),
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects a same-framework mapping (AC1 semantics)", async () => {
    const caller = createCaller(admin);
    await expect(
      caller.crosswalk.createMapping({ sourceControlId: a1, targetControlId: a2 }),
    ).rejects.toThrow(/same framework/i);
  });

  it("rejects a self-mapping", async () => {
    const caller = createCaller(admin);
    await expect(
      caller.crosswalk.createMapping({ sourceControlId: a1, targetControlId: a1 }),
    ).rejects.toThrow(/itself/i);
  });

  it("listCrosswalks returns the pair with count + names, org-scoped (AC2, NFR2)", async () => {
    const caller = createCaller(admin);
    const crosswalks = await caller.crosswalk.listCrosswalks();
    const pair = crosswalks.find(
      (c) => c.sourceFrameworkId === fwA.id && c.targetFrameworkId === fwB.id,
    );
    expect(pair).toBeDefined();
    expect(pair!.mappingCount).toBe(4);
    expect(pair!.source.code).toMatch(/^AAA-/);
    expect(pair!.target.code).toMatch(/^BBB-/);

    // Org isolation: a different org sees no crosswalks.
    const otherAdmin: TestUser = { ...admin, organizationId: otherOrg.id };
    const otherCrosswalks = await createCaller(otherAdmin).crosswalk.listCrosswalks();
    expect(otherCrosswalks).toHaveLength(0);
  });

  it("allows a view-role user to read but denies createMapping (AC4)", async () => {
    const caller = createCaller(auditor);
    // AUDITOR is in the view-roles set → can read
    const crosswalks = await caller.crosswalk.listCrosswalks();
    expect(Array.isArray(crosswalks)).toBe(true);

    // AUDITOR is NOT in the manage-roles set → write denied
    await expect(
      caller.crosswalk.createMapping({ sourceControlId: a1, targetControlId: b1 }),
    ).rejects.toThrow(/FORBIDDEN|permission|access|role/i);
  });

  it("deleteMapping removes a mapping (manage role)", async () => {
    const caller = createCaller(admin);
    const list = await caller.crosswalk.listMappingsForPair({
      sourceFrameworkId: fwA.id,
      targetFrameworkId: fwB.id,
    });
    const target = list[0]!;
    await caller.crosswalk.deleteMapping({ id: target.id });
    const after = await caller.crosswalk.listMappingsForPair({
      sourceFrameworkId: fwA.id,
      targetFrameworkId: fwB.id,
    });
    expect(after.find((m) => m.id === target.id)).toBeUndefined();
  });
});

describe("crosswalk workbench procedures - Story 25.3", () => {
  let org: { id: string };
  let admin: TestUser;
  let famId: string; // family "AC" root
  let ac1Id: string, ac1eId: string; // AC-1 base + AC-1(1) enhancement
  let srcFwId: string;
  let tgtFwId: string;
  let t1: string, t2: string, t3: string;

  beforeAll(async () => {
    org = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `XW WB Org ${Date.now()}`,
        slug: `xw-wb-org-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    const adminEmail = `admin-wb-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: adminEmail,
        name: "Admin",
        organizationId: org.id,
        role: UserRole.ORG_ADMIN,
        updatedAt: new Date(),
      },
    });
    admin = { id: adminRow.id, email: adminEmail, organizationId: org.id, role: adminRow.role };

    // Source framework with a 3-level hierarchy: family AC → AC-1 → AC-1(1).
    await runWithOrganizationContext(org.id, async () => {
      const src = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          name: "Hier Framework",
          code: `HIER-${Date.now()}`,
          version: "1.0",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      srcFwId = src.id;
      const fam = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          frameworkId: src.id,
          controlId: "AC",
          title: "Access Control",
          description: "family",
          updatedAt: new Date(),
        },
      });
      famId = fam.id;
      const ac1 = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          frameworkId: src.id,
          controlId: "AC-1",
          title: "Policy",
          description: "base",
          parentControlId: fam.id,
          updatedAt: new Date(),
        },
      });
      ac1Id = ac1.id;
      const ac1e = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          frameworkId: src.id,
          controlId: "AC-1(1)",
          title: "Policy enhancement",
          description: "enhancement",
          parentControlId: ac1.id,
          updatedAt: new Date(),
        },
      });
      ac1eId = ac1e.id;
      // A second family so the family filter is meaningful.
      await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          frameworkId: src.id,
          controlId: "AU",
          title: "Audit",
          description: "family2",
          updatedAt: new Date(),
        },
      });

      const tgt = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          name: "Target Framework",
          code: `TGT-${Date.now()}`,
          version: "1.0",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      tgtFwId = tgt.id;
      for (const cid of ["T-1", "T-2", "T-3"]) {
        await db.control.create({
          data: {
            id: randomUUID(),
            organizationId: org.id,
            frameworkId: tgt.id,
            controlId: cid,
            title: `Target ${cid}`,
            description: "d",
            updatedAt: new Date(),
          },
        });
      }
    });

    const tgtControls = await db.control.findMany({
      where: { frameworkId: tgtFwId },
      select: { id: true, controlId: true },
      orderBy: { controlId: "asc" },
    });
    t1 = tgtControls.find((c) => c.controlId === "T-1")!.id;
    t2 = tgtControls.find((c) => c.controlId === "T-2")!.id;
    t3 = tgtControls.find((c) => c.controlId === "T-3")!.id;
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("listFrameworkControls paginates, lists families, and filters by search + family (AC1)", async () => {
    const caller = createCaller(admin);

    const all = await caller.crosswalk.listFrameworkControls({ frameworkId: srcFwId, pageSize: 100 });
    expect(all.total).toBe(4); // AC, AC-1, AC-1(1), AU
    // Families = the two roots (AC, AU); AC-1 and AC-1(1) roll up under AC.
    expect(all.families.map((f) => f.controlId).sort()).toEqual(["AC", "AU"]);

    // Family filter: AC family contains AC, AC-1, AC-1(1) = 3.
    const acFamily = await caller.crosswalk.listFrameworkControls({
      frameworkId: srcFwId,
      familyId: famId,
      pageSize: 100,
    });
    expect(acFamily.total).toBe(3);
    expect(acFamily.controls.every((c) => c.familyId === famId)).toBe(true);

    // Search.
    const searched = await caller.crosswalk.listFrameworkControls({
      frameworkId: srcFwId,
      search: "AC-1(1)",
    });
    expect(searched.total).toBe(1);
    expect(searched.controls[0]!.controlId).toBe("AC-1(1)");

    // Pagination.
    const p1 = await caller.crosswalk.listFrameworkControls({ frameworkId: srcFwId, pageSize: 2, page: 1 });
    expect(p1.controls).toHaveLength(2);
    const p2 = await caller.crosswalk.listFrameworkControls({ frameworkId: srcFwId, pageSize: 2, page: 2 });
    expect(p2.controls).toHaveLength(2);
    expect(p1.controls[0]!.id).not.toBe(p2.controls[0]!.id);
  });

  it("createMappings batches a source to many targets with skipDuplicates (AC2)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.createMappings({
      sourceControlId: ac1Id,
      targetControlIds: [t1, t2, t3],
      mappingType: FrameworkMappingType.SUPERSET_OF,
      notes: "batch",
    });
    expect(res.created).toBe(3);

    const forSource = await caller.crosswalk.listMappingsForSource({
      sourceControlId: ac1Id,
      targetFrameworkId: tgtFwId,
    });
    expect(forSource).toHaveLength(3);
    expect(forSource.every((m) => m.mappingType === FrameworkMappingType.SUPERSET_OF)).toBe(true);

    // Re-running with an overlap only creates the new one (skipDuplicates).
    const res2 = await caller.crosswalk.createMappings({
      sourceControlId: ac1eId,
      targetControlIds: [t1],
      mappingType: FrameworkMappingType.EQUIVALENT,
    });
    expect(res2.created).toBe(1);
    const res3 = await caller.crosswalk.createMappings({
      sourceControlId: ac1eId,
      targetControlIds: [t1, t2],
      mappingType: FrameworkMappingType.EQUIVALENT,
    });
    expect(res3.created).toBe(1); // t1 already mapped from res2
  });

  it("updateMapping edits type + notes in place (AC3)", async () => {
    const caller = createCaller(admin);
    const forSource = await caller.crosswalk.listMappingsForSource({
      sourceControlId: ac1Id,
      targetFrameworkId: tgtFwId,
    });
    const m = forSource[0]!;
    const updated = await caller.crosswalk.updateMapping({
      id: m.id,
      mappingType: FrameworkMappingType.INTERSECTS,
      notes: "revised",
    });
    expect(updated.mappingType).toBe(FrameworkMappingType.INTERSECTS);
    expect(updated.notes).toBe("revised");
  });

  it("records audit entries for create/update/delete (NFR4)", async () => {
    const caller = createCaller(admin);
    const before = await caller.crosswalk.listMappingsForSource({
      sourceControlId: ac1Id,
      targetFrameworkId: tgtFwId,
    });
    await caller.crosswalk.deleteMapping({ id: before[0]!.id });

    // Fire-and-forget audit — wait before querying.
    await new Promise((r) => setTimeout(r, 400));
    const actions = await db.auditLog.findMany({
      where: { organizationId: org.id, entityType: "FrameworkControlMapping" },
      select: { action: true },
    });
    const set = new Set(actions.map((a) => a.action));
    expect(set.has("CREATE_MAPPING")).toBe(true);
    expect(set.has("UPDATE_MAPPING")).toBe(true);
    expect(set.has("DELETE_MAPPING")).toBe(true);
  });

  it("rejects same-framework batch targets", async () => {
    const caller = createCaller(admin);
    await expect(
      caller.crosswalk.createMappings({ sourceControlId: ac1Id, targetControlIds: [famId] }),
    ).rejects.toThrow(/different framework/i);
  });
});

describe("crosswalk org-control procedures - Story 25.4", () => {
  let org: { id: string };
  let admin: TestUser;
  let oc1: string, oc2: string;
  let fwId: string;
  let fc1: string, fc2: string, fc3: string;

  beforeAll(async () => {
    org = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `XW OC Org ${Date.now()}`,
        slug: `xw-oc-org-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    const adminEmail = `admin-oc-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: {
        id: randomUUID(),
        email: adminEmail,
        name: "Admin",
        organizationId: org.id,
        role: UserRole.ORG_ADMIN,
        updatedAt: new Date(),
      },
    });
    admin = { id: adminRow.id, email: adminEmail, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const c1 = await db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          localControlId: "OC-0001",
          name: "Access policy",
          family: "Access",
        },
      });
      oc1 = c1.id;
      const c2 = await db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          localControlId: "OC-0002",
          name: "Logging standard",
          family: "Audit",
        },
      });
      oc2 = c2.id;

      const fw = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          name: "OC Target FW",
          code: `OCFW-${Date.now()}`,
          version: "1.0",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      fwId = fw.id;
      const made: string[] = [];
      for (const cid of ["F-1", "F-2", "F-3"]) {
        const fc = await db.control.create({
          data: {
            id: randomUUID(),
            organizationId: org.id,
            frameworkId: fw.id,
            controlId: cid,
            title: `Framework ${cid}`,
            description: "d",
            updatedAt: new Date(),
          },
        });
        made.push(fc.id);
      }
      [fc1, fc2, fc3] = made as [string, string, string];
    });
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("listOrgControls lists org controls with families + search (AC1)", async () => {
    const caller = createCaller(admin);
    const all = await caller.crosswalk.listOrgControls({ pageSize: 100 });
    expect(all.total).toBe(2);
    expect(all.families.map((f) => f.controlId).sort()).toEqual(["Access", "Audit"]);
    // shape parity with framework pane
    expect(all.controls[0]).toHaveProperty("controlId");
    expect(all.controls[0]).toHaveProperty("title");

    const searched = await caller.crosswalk.listOrgControls({ search: "logging" });
    expect(searched.total).toBe(1);
    expect(searched.controls[0]!.controlId).toBe("OC-0002");

    const byFamily = await caller.crosswalk.listOrgControls({ familyId: "Access" });
    expect(byFamily.total).toBe(1);
    expect(byFamily.controls[0]!.controlId).toBe("OC-0001");
  });

  it("createOrgControlMappings batches into OrgControlFrameworkMapping with OLIR type (AC2)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.createOrgControlMappings({
      orgControlId: oc1,
      frameworkControlIds: [fc1, fc2],
      mappingType: StandardMappingType.SUBSET_OF,
      notes: "policy narrower",
    });
    expect(res.created).toBe(2);

    const forSource = await caller.crosswalk.listOrgControlMappingsForSource({
      orgControlId: oc1,
      targetFrameworkId: fwId,
    });
    expect(forSource).toHaveLength(2);
    expect(forSource.every((m) => m.mappingType === StandardMappingType.SUBSET_OF)).toBe(true);

    // skipDuplicates: overlap only creates the new one.
    const res2 = await caller.crosswalk.createOrgControlMappings({
      orgControlId: oc1,
      frameworkControlIds: [fc2, fc3],
      mappingType: StandardMappingType.EQUIVALENT,
    });
    expect(res2.created).toBe(1);
  });

  it("surfaces mappings created directly (existing editor) — AC3", async () => {
    // Simulate the existing FrameworkMappingsEditor writing a row directly.
    await runWithOrganizationContext(org.id, async () => {
      await db.orgControlFrameworkMapping.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          orgControlId: oc2,
          frameworkControlId: fc1,
          mappingType: StandardMappingType.INTERSECTS,
          notes: "from editor",
        },
      });
    });
    const caller = createCaller(admin);
    const forSource = await caller.crosswalk.listOrgControlMappingsForSource({
      orgControlId: oc2,
      targetFrameworkId: fwId,
    });
    expect(forSource).toHaveLength(1);
    expect(forSource[0]!.mappingType).toBe(StandardMappingType.INTERSECTS);
    expect(forSource[0]!.FrameworkControl.controlId).toBe("F-1");
  });

  it("updateOrgControlMapping + deleteOrgControlMapping + audit (AC2, NFR4)", async () => {
    const caller = createCaller(admin);
    const list = await caller.crosswalk.listOrgControlMappingsForSource({
      orgControlId: oc1,
      targetFrameworkId: fwId,
    });
    const m = list[0]!;
    const updated = await caller.crosswalk.updateOrgControlMapping({
      id: m.id,
      mappingType: StandardMappingType.SUPERSET_OF,
      notes: "revised",
    });
    expect(updated.mappingType).toBe(StandardMappingType.SUPERSET_OF);
    expect(updated.notes).toBe("revised");

    await caller.crosswalk.deleteOrgControlMapping({ id: m.id });
    const after = await caller.crosswalk.listOrgControlMappingsForSource({
      orgControlId: oc1,
      targetFrameworkId: fwId,
    });
    expect(after.find((x) => x.id === m.id)).toBeUndefined();

    await new Promise((r) => setTimeout(r, 400));
    const actions = await db.auditLog.findMany({
      where: { organizationId: org.id, entityType: "OrgControlFrameworkMapping" },
      select: { action: true },
    });
    const set = new Set(actions.map((a) => a.action));
    expect(set.has("CREATE_MAPPING")).toBe(true);
    expect(set.has("UPDATE_MAPPING")).toBe(true);
    expect(set.has("DELETE_MAPPING")).toBe(true);
  });

  it("getOrgControlTarget returns header counts", async () => {
    const caller = createCaller(admin);
    const header = await caller.crosswalk.getOrgControlTarget({ targetFrameworkId: fwId });
    expect(header.target.code).toMatch(/^OCFW-/);
    expect(header.orgControlCount).toBe(2);
    expect(header.target.controlCount).toBe(3);
  });
});
