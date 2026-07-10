/**
 * Integration tests for per-family crosswalk coverage (Story 26.3).
 *
 * @see docs/sprint-artifacts/26-3-coverage-dashboard.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, StandardMappingType, MappingStatus } from "@prisma/client";
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

describe("crosswalk coverage - Story 26.3", () => {
  let org: { id: string };
  let admin: TestUser;
  let fw: string;
  const C: Record<string, string> = {};

  beforeAll(async () => {
    org = await db.organization.create({
      data: { id: randomUUID(), name: `Cov Org ${Date.now()}`, slug: `cov-org-${Date.now()}`, updatedAt: new Date() },
    });
    const email = `admin-cov-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: { id: randomUUID(), email, name: "Admin", organizationId: org.id, role: UserRole.ADMINISTRATOR, updatedAt: new Date() },
    });
    admin = { id: adminRow.id, email, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const framework = await db.framework.create({
        data: { id: randomUUID(), organizationId: org.id, name: "Cov FW", code: `COV-${Date.now()}`, version: "1.0", isActive: true, updatedAt: new Date() },
      });
      fw = framework.id;
      const mk = async (controlId: string, parentControlId?: string) => {
        const c = await db.control.create({
          data: { id: randomUUID(), organizationId: org.id, frameworkId: fw, controlId, title: `C ${controlId}`, description: "d", parentControlId: parentControlId ?? null, updatedAt: new Date() },
        });
        C[controlId] = c.id;
      };
      // Family AC (header) with children AC-1/AC-2/AC-3; family AU with AU-1.
      await mk("AC");
      await mk("AC-1", C["AC"]);
      await mk("AC-2", C["AC"]);
      await mk("AC-3", C["AC"]);
      await mk("AU");
      await mk("AU-1", C["AU"]);

      const mkOrgCtl = async (n: string) => {
        const oc = await db.organizationalControl.create({
          data: { id: randomUUID(), organizationId: org.id, localControlId: n, name: `Org ${n}` },
        });
        return oc.id;
      };
      const map = (orgControlId: string, frameworkControlId: string, status: MappingStatus) =>
        db.orgControlFrameworkMapping.create({
          data: { id: randomUUID(), organizationId: org.id, orgControlId, frameworkControlId, mappingType: StandardMappingType.EQUIVALENT, status },
        });

      const oc1 = await mkOrgCtl("OC-1");
      const oc2 = await mkOrgCtl("OC-2");
      const oc3 = await mkOrgCtl("OC-3");
      const oc4 = await mkOrgCtl("OC-4");
      const oc5 = await mkOrgCtl("OC-5");

      await map(oc1, C["AC-1"]!, MappingStatus.CONFIRMED); // AC-1 confirmed
      await map(oc2, C["AC-2"]!, MappingStatus.SUGGESTED); // AC-2 suggested
      await map(oc3, C["AC-3"]!, MappingStatus.CONFIRMED); // AC-3 confirmed...
      await map(oc4, C["AC-3"]!, MappingStatus.SUGGESTED); // ...and also suggested → strongest = confirmed
      await map(oc5, C["AU-1"]!, MappingStatus.REJECTED); // AU-1 rejected → unmapped
    });
  });

  afterAll(async () => {
    if (org) {
      await db.$executeRaw`DELETE FROM "OrgControlFrameworkMapping" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("aggregates overall + per-family coverage with strongest-status-per-control (AC1,3,4)", async () => {
    const caller = createCaller(admin);
    const cov = await caller.crosswalk.getFrameworkCoverage({ targetFrameworkId: fw });

    // 6 controls: AC(header,unmapped), AC-1(conf), AC-2(sugg), AC-3(conf), AU(header,unmapped), AU-1(unmapped)
    expect(cov.overall.total).toBe(6);
    expect(cov.overall.confirmed).toBe(2); // AC-1, AC-3
    expect(cov.overall.suggested).toBe(1); // AC-2
    expect(cov.overall.unmapped).toBe(3); // AC, AU, AU-1
    expect(cov.overall.confirmedPct).toBe(33);

    const ac = cov.families.find((f) => f.controlId === "AC")!;
    expect(ac.total).toBe(4);
    expect(ac.confirmed).toBe(2);
    expect(ac.suggested).toBe(1);
    expect(ac.unmapped).toBe(1); // the AC header

    const au = cov.families.find((f) => f.controlId === "AU")!;
    expect(au.total).toBe(2);
    expect(au.confirmed).toBe(0);
    expect(au.suggested).toBe(0);
    expect(au.unmapped).toBe(2);
  });

  it("drill-down lists the controls for a family + status (AC2)", async () => {
    const caller = createCaller(admin);
    const acFamilyId = C["AC"]!;

    const confirmed = await caller.crosswalk.listFamilyControlsByStatus({ targetFrameworkId: fw, familyId: acFamilyId, status: "CONFIRMED" });
    expect(confirmed.map((c) => c.controlId).sort()).toEqual(["AC-1", "AC-3"]);

    const suggested = await caller.crosswalk.listFamilyControlsByStatus({ targetFrameworkId: fw, familyId: acFamilyId, status: "SUGGESTED" });
    expect(suggested.map((c) => c.controlId)).toEqual(["AC-2"]);

    const unmapped = await caller.crosswalk.listFamilyControlsByStatus({ targetFrameworkId: fw, familyId: acFamilyId, status: "UNMAPPED" });
    expect(unmapped.map((c) => c.controlId)).toEqual(["AC"]); // the header
  });
});
