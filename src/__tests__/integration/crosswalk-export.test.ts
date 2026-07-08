/**
 * Integration tests for crosswalk export (Story 26.4).
 *
 * @see docs/sprint-artifacts/26-4-crosswalk-export.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  UserRole,
  StandardMappingType,
  FrameworkMappingType,
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
        name: "Reviewer Rita",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

const parseCsv = (content: string) => content.split("\r\n").map((line) => line.split(","));

describe("crosswalk export - Story 26.4", () => {
  let org: { id: string };
  let admin: TestUser;
  let fw: string, srcFw: string;
  const C: Record<string, string> = {};
  let oc1: string, oc2: string;

  beforeAll(async () => {
    org = await db.organization.create({
      data: { id: randomUUID(), name: `Exp Org ${Date.now()}`, slug: `exp-org-${Date.now()}`, updatedAt: new Date() },
    });
    const email = `admin-exp-${Date.now()}@example.com`;
    const adminRow = await db.user.create({
      data: { id: randomUUID(), email, name: "Reviewer Rita", organizationId: org.id, role: UserRole.ORG_ADMIN, updatedAt: new Date() },
    });
    admin = { id: adminRow.id, email, organizationId: org.id, role: adminRow.role };

    await runWithOrganizationContext(org.id, async () => {
      const mkFw = (code: string) =>
        db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: `FW ${code}`, code: `${code}${Date.now()}`, version: "1.0", isActive: true, updatedAt: new Date() } });
      const mkCtl = async (fwId: string, controlId: string) => {
        const c = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fwId, controlId, title: `Title ${controlId}`, description: "d", updatedAt: new Date() } });
        C[controlId] = c.id;
      };
      const target = await mkFw("TGT");
      const source = await mkFw("SRC");
      fw = target.id;
      srcFw = source.id;
      await mkCtl(fw, "F-1");
      await mkCtl(fw, "F-2");
      await mkCtl(fw, "F-3");
      await mkCtl(srcFw, "S-1");
      await mkCtl(srcFw, "S-2");

      const oa = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-1", name: "Access policy" } });
      const ob = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-2", name: "Audit standard" } });
      oc1 = oa.id;
      oc2 = ob.id;

      await db.orgControlFrameworkMapping.create({
        data: { id: randomUUID(), organizationId: org.id, orgControlId: oc1, frameworkControlId: C["F-1"]!, mappingType: StandardMappingType.EQUIVALENT, status: MappingStatus.CONFIRMED, confidence: 100, notes: "vetted", reviewedById: admin.id, reviewedAt: new Date() },
      });
      await db.orgControlFrameworkMapping.create({
        data: { id: randomUUID(), organizationId: org.id, orgControlId: oc2, frameworkControlId: C["F-2"]!, mappingType: StandardMappingType.INTERSECTS, status: MappingStatus.SUGGESTED, confidence: 60, derivedVia: { orgMappingId: "x", crosswalkId: "y", chain: "OC-2 → A-9 → F-2" } },
      });
      // Framework-pair crosswalk S-1 → F-1.
      await db.frameworkControlMapping.create({
        data: { id: randomUUID(), organizationId: org.id, sourceControlId: C["S-1"]!, targetControlId: C["F-1"]!, mappingType: FrameworkMappingType.SUPERSET_OF, confidence: 90, notes: "broad" },
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

  it("org-control CSV export has the full audit columns incl. lineage + reviewer (AC1)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.exportOrgControlCrosswalk({ targetFrameworkId: fw, format: "csv", statuses: [MappingStatus.CONFIRMED], scope: "filtered" });
    expect(res.mimeType).toMatch(/csv/);
    expect(res.encoding).toBe("utf8");
    const rows = parseCsv(res.content);
    const header = rows[0]!.map((h) => h.replace(/"/g, ""));
    expect(header).toEqual([
      "Org Control ID", "Org Control", "Framework Control ID", "Framework Control", "Family",
      "Relationship", "Rationale", "Status", "Confidence", "Lineage", "Reviewed By", "Reviewed At",
    ]);
    // Only the confirmed row (F-1).
    const dataRows = rows.slice(1).map((r) => r.map((c) => c.replace(/"/g, "")));
    expect(dataRows).toHaveLength(1);
    const r = dataRows[0]!;
    expect(r[0]).toBe("OC-1");
    expect(r[2]).toBe("F-1");
    expect(r[5]).toBe("Equivalent");
    expect(r[7]).toBe("CONFIRMED");
    expect(r[9]).toBe("manual"); // human mapping → no derivedVia
    expect(r[10]).toBe("Reviewer Rita"); // reviewer name
  });

  it("complete scope emits explicit (no mapping) rows for unmapped controls (AC3)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.exportOrgControlCrosswalk({ targetFrameworkId: fw, format: "csv", scope: "complete" });
    const rows = parseCsv(res.content).slice(1).map((r) => r.map((c) => c.replace(/"/g, "")));
    // F-1 (confirmed) + F-2 (suggested) mapped; F-3 unmapped → (no mapping).
    const f3 = rows.find((r) => r[2] === "F-3");
    expect(f3).toBeDefined();
    expect(f3![5]).toBe("(no mapping)");
    // The suggested row carries its lineage chain.
    const f2 = rows.find((r) => r[2] === "F-2");
    expect(f2![7]).toBe("SUGGESTED");
    expect(f2![9]).toBe("OC-2 → A-9 → F-2");
  });

  it("XLSX export returns a base64 payload with the spreadsheet mimetype (AC1)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.exportOrgControlCrosswalk({ targetFrameworkId: fw, format: "xlsx", scope: "complete" });
    expect(res.encoding).toBe("base64");
    expect(res.mimeType).toMatch(/spreadsheetml/);
    expect(res.filename).toMatch(/\.xlsx$/);
    // base64 of a zip (xlsx) starts with "UEsD" (PK..).
    expect(res.content.startsWith("UEsD")).toBe(true);
  });

  it("framework-pair export lists mappings + unmapped source rows (AC1,3)", async () => {
    const caller = createCaller(admin);
    const res = await caller.crosswalk.exportFrameworkCrosswalk({ sourceFrameworkId: srcFw, targetFrameworkId: fw, format: "csv", scope: "complete" });
    const rows = parseCsv(res.content);
    const header = rows[0]!.map((h) => h.replace(/"/g, ""));
    expect(header).toEqual(["Source Control ID", "Source Control", "Target Control ID", "Target Control", "Relationship", "Rationale", "Confidence"]);
    const data = rows.slice(1).map((r) => r.map((c) => c.replace(/"/g, "")));
    const s1 = data.find((r) => r[0] === "S-1")!;
    expect(s1[2]).toBe("F-1");
    expect(s1[4]).toBe("Superset of");
    const s2 = data.find((r) => r[0] === "S-2")!;
    expect(s2[4]).toBe("(no mapping)");
  });
});
