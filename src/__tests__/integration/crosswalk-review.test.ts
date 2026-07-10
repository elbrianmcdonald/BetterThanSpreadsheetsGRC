/**
 * Integration tests for suggestion review — confirm / reject / bulk (Story 26.2).
 *
 * @see docs/sprint-artifacts/26-2-suggestion-review-promotion.md
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

describe("crosswalk suggestion review - Story 26.2", () => {
  let org: { id: string };
  let admin: TestUser;
  let fwB: string, fwC: string;
  const C: Record<string, string> = {};
  let oc: string;

  beforeAll(async () => {
    org = await db.organization.create({
      data: { id: randomUUID(), name: `Rev Org ${Date.now()}`, slug: `rev-org-${Date.now()}`, updatedAt: new Date() },
    });
    const email = `admin-rev-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: { id: randomUUID(), email, name: "Admin", organizationId: org.id, role: UserRole.ADMINISTRATOR, updatedAt: new Date() },
    });
    admin = { id: adminRow.id, email, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const mkFw = (code: string) =>
        db.framework.create({
          data: { id: randomUUID(), organizationId: org.id, name: `FW ${code}`, code: `${code}-${Date.now()}`, version: "1.0", isActive: true, updatedAt: new Date() },
        });
      const mkCtl = async (fwId: string, controlId: string) => {
        const c = await db.control.create({
          data: { id: randomUUID(), organizationId: org.id, frameworkId: fwId, controlId, title: `C ${controlId}`, description: "d", updatedAt: new Date() },
        });
        C[controlId] = c.id;
      };
      const A = await mkFw("A");
      const B = await mkFw("B");
      const Cf = await mkFw("C");
      fwB = B.id;
      fwC = Cf.id;
      await mkCtl(A.id, "A-1");
      await mkCtl(B.id, "B-1");
      await mkCtl(B.id, "B-2");
      await mkCtl(Cf.id, "C-1");

      const orgCtl = await db.organizationalControl.create({
        data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-1", name: "Policy" },
      });
      oc = orgCtl.id;

      await db.orgControlFrameworkMapping.create({
        data: { id: randomUUID(), organizationId: org.id, orgControlId: oc, frameworkControlId: C["A-1"]!, mappingType: StandardMappingType.EQUIVALENT, status: MappingStatus.CONFIRMED },
      });
      // Crosswalks A-1 → B-1, A-1 → B-2, and B-1 → C-1 (for the compounding test).
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: org.id, sourceControlId: C["A-1"]!, targetControlId: C["B-1"]!, mappingType: FrameworkMappingType.EQUIVALENT } });
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: org.id, sourceControlId: C["A-1"]!, targetControlId: C["B-2"]!, mappingType: FrameworkMappingType.EQUIVALENT } });
      await db.frameworkControlMapping.create({ data: { id: randomUUID(), organizationId: org.id, sourceControlId: C["B-1"]!, targetControlId: C["C-1"]!, mappingType: FrameworkMappingType.EQUIVALENT } });
    });
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "FrameworkControlMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  const suggFor = async (caller: ReturnType<typeof createCaller>, fw: string, ctlId: string) => {
    const list = await caller.crosswalk.listSuggestions({ targetFrameworkId: fw });
    return list.find((s) => s.FrameworkControl.controlId === ctlId);
  };

  it("confirm promotes SUGGESTED→CONFIRMED with reviewer + type override (AC2,3)", async () => {
    const caller = createCaller(admin);
    const gen = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwB });
    expect(gen.generated).toBe(2); // OC→B-1, OC→B-2

    const b1 = await suggFor(caller, fwB, "B-1");
    expect(b1).toBeDefined();
    const confirmed = await caller.crosswalk.confirmSuggestion({
      id: b1!.id,
      mappingType: StandardMappingType.SUBSET_OF,
    });
    expect(confirmed.status).toBe(MappingStatus.CONFIRMED);
    expect(confirmed.mappingType).toBe(StandardMappingType.SUBSET_OF);

    const row = await db.orgControlFrameworkMapping.findUnique({ where: { id: b1!.id }, select: { reviewedById: true } });
    expect(row?.reviewedById).toBe(admin.id);
  });

  it("reject sets REJECTED, retains the row, drops from active suggestions (AC2)", async () => {
    const caller = createCaller(admin);
    const b2 = await suggFor(caller, fwB, "B-2");
    await caller.crosswalk.rejectSuggestion({ id: b2!.id });

    const stillThere = await db.orgControlFrameworkMapping.findUnique({ where: { id: b2!.id }, select: { status: true } });
    expect(stillThere?.status).toBe(MappingStatus.REJECTED);

    const active = await caller.crosswalk.listSuggestions({ targetFrameworkId: fwB });
    expect(active.find((s) => s.id === b2!.id)).toBeUndefined();
  });

  it("cannot confirm/reject a non-SUGGESTED row (NFR5 guard)", async () => {
    const caller = createCaller(admin);
    // B-1 is now CONFIRMED.
    const b1Confirmed = await db.orgControlFrameworkMapping.findFirst({
      where: { organizationId: org.id, orgControlId: oc, frameworkControlId: C["B-1"], status: MappingStatus.CONFIRMED },
      select: { id: true },
    });
    await expect(caller.crosswalk.confirmSuggestion({ id: b1Confirmed!.id })).rejects.toThrow(/suggested/i);
    await expect(caller.crosswalk.rejectSuggestion({ id: b1Confirmed!.id })).rejects.toThrow(/suggested/i);
  });

  it("a confirmed suggestion compounds — it becomes a leg for the next generation (AC-flywheel)", async () => {
    const caller = createCaller(admin);
    // OC→B-1 is now CONFIRMED, and B-1→C-1 is a crosswalk ⇒ generating for C yields OC→C-1.
    const gen = await caller.crosswalk.generateSuggestions({ targetFrameworkId: fwC });
    expect(gen.generated).toBe(1);
    const c1 = await suggFor(caller, fwC, "C-1");
    expect(c1).toBeDefined();
    expect(c1!.status).toBe(MappingStatus.SUGGESTED);
  });

  it("bulk reject transitions only SUGGESTED rows and records the count (AC4)", async () => {
    const caller = createCaller(admin);
    const c1 = await suggFor(caller, fwC, "C-1");
    const res = await caller.crosswalk.bulkReviewSuggestions({ ids: [c1!.id], action: "REJECT" });
    expect(res.updated).toBe(1);
    const after = await db.orgControlFrameworkMapping.findUnique({ where: { id: c1!.id }, select: { status: true } });
    expect(after?.status).toBe(MappingStatus.REJECTED);

    // Re-running bulk on an already-reviewed row updates nothing.
    const res2 = await caller.crosswalk.bulkReviewSuggestions({ ids: [c1!.id], action: "CONFIRM" });
    expect(res2.updated).toBe(0);
  });

  it("records audit entries for review actions (NFR4)", async () => {
    await new Promise((r) => setTimeout(r, 400));
    const logs = await db.auditLog.findMany({
      where: { organizationId: org.id, entityType: "OrgControlFrameworkMapping", action: "UPDATE_MAPPING" },
      select: { id: true },
    });
    expect(logs.length).toBeGreaterThan(0);
  });
});
