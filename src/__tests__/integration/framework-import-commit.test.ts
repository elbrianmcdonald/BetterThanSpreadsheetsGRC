/**
 * Integration Tests for Framework Import Commit
 *
 * Story 24.3: Commit a Validated Import as a Versioned Framework
 *
 * Tests framework.commitImport:
 * - AC1: creates Framework + Control rows with parentControlId hierarchy; transactional
 * - AC2: dangling parent ref / duplicate control id → blocked, no rows written
 * - AC3: duplicate framework (org+code+version) → blocked
 * - AC4: FRAMEWORK_IMPORT audit log; control count matches
 * - AC5: FRAMEWORK_MANAGE permission required
 *
 * @see docs/sprint-artifacts/24-3-validated-import-commit.md
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";

function csvToBase64(csv: string): string {
  return Buffer.from(csv, "utf-8").toString("base64");
}

// Mapping matching the CSV column order below:
// controlId=0, title=1, description=2, family=3, parentControlId=4
const MAPPING = {
  controlId: 0,
  title: 1,
  description: 2,
  family: 3,
  parentControlId: 4,
};

const HEADER = "Control ID,Title,Description,Family,Parent";

describe("Framework Import Commit - Story 24.3", () => {
  let testOrg: { id: string };
  let adminUser: { id: string; email: string; organizationId: string; role: UserRole };
  let analystUser: { id: string; email: string; organizationId: string; role: UserRole };

  const createCaller = (user: typeof adminUser) =>
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

  beforeAll(async () => {
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Test Org FwCommit ${Date.now()}`,
        slug: `test-org-fw-commit-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const adminEmail = `admin-fwcommit-${Date.now()}@example.com`;
    const admin = await db.user.create({
      data: {
        id: randomUUID(),
        email: adminEmail,
        name: "Admin",
        organizationId: testOrg.id,
        platformRole: UserRole.ADMINISTRATOR,
        updatedAt: new Date(),
      },
    });
    adminUser = { id: admin.id, email: adminEmail, organizationId: testOrg.id, role: UserRole.ADMINISTRATOR };

    const analystEmail = `analyst-fwcommit-${Date.now()}@example.com`;
    const analyst = await db.user.create({
      data: {
        id: randomUUID(),
        email: analystEmail,
        name: "Analyst",
        organizationId: testOrg.id,
        platformRole: UserRole.ANALYST,
        updatedAt: new Date(),
      },
    });
    analystUser = {
      id: analyst.id,
      email: analystEmail,
      organizationId: testOrg.id,
      role: UserRole.ANALYST,
    };
  });

  afterAll(async () => {
    if (testOrg) {
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
  });

  describe("AC1 + AC4: happy path", () => {
    it("creates a Framework and Controls with parent hierarchy and audit log", async () => {
      const caller = createCaller(adminUser);
      // Explicit-parent hierarchy: AC is the family header (no parent, no family
      // value → stays top-level); AC-01/AC-02 point to it via the Parent column.
      const csv = [
        HEADER,
        "AC,Access Control,Family,,",
        "AC-01,Policy,Develops a policy,Access Control,AC",
        "AC-02,Accounts,Manages accounts,Access Control,AC",
      ].join("\n");

      const result = await caller.framework.commitImport({
        fileContent: csvToBase64(csv),
        fileName: "fw.csv",
        name: "Happy Framework",
        code: "HAPPY-FW",
        version: "1.0",
        mapping: MAPPING,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.controlsImported).toBe(3);

      const framework = await db.framework.findUnique({ where: { id: result.frameworkId } });
      expect(framework?.code).toBe("HAPPY-FW");
      expect(framework?.isActive).toBe(false);

      const controls = await db.control.findMany({
        where: { frameworkId: result.frameworkId },
      });
      expect(controls).toHaveLength(3);

      // AC-01's parentControlId should resolve to AC's db id
      const ac = controls.find((c) => c.controlId === "AC");
      const ac01 = controls.find((c) => c.controlId === "AC-01");
      expect(ac).toBeDefined();
      expect(ac01?.parentControlId).toBe(ac!.id);
      expect(ac01?.isOscalImported).toBe(false);

      // AC4: audit log (fire-and-forget — wait before querying)
      await new Promise((r) => setTimeout(r, 300));
      const log = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: result.frameworkId,
          action: "FRAMEWORK_IMPORT",
        },
      });
      expect(log).not.toBeNull();
    });

    it("synthesizes family parents when a family column is mapped but no explicit parent", async () => {
      const caller = createCaller(adminUser);
      // No Parent column values; family grouping only.
      const csv = [
        HEADER,
        "AC-01,Policy,Desc,Access Control,",
        "AU-01,Audit,Desc,Audit and Accountability,",
      ].join("\n");

      const result = await caller.framework.commitImport({
        fileContent: csvToBase64(csv),
        fileName: "fw.csv",
        name: "Family Framework",
        code: "FAM-FW",
        version: "1.0",
        mapping: MAPPING,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      // 2 controls + 2 synthesized family parents
      expect(result.controlsImported).toBe(4);

      const controls = await db.control.findMany({
        where: { frameworkId: result.frameworkId },
      });
      const acFamily = controls.find((c) => c.controlId === "Access Control");
      const ac01 = controls.find((c) => c.controlId === "AC-01");
      expect(acFamily).toBeDefined();
      expect(ac01?.parentControlId).toBe(acFamily!.id);
    });
  });

  describe("AC2: validation blocks with no partial write", () => {
    it("blocks a dangling parent reference and writes nothing (transactional)", async () => {
      const caller = createCaller(adminUser);
      const before = await db.framework.count({ where: { organizationId: testOrg.id } });
      const csv = [HEADER, "AC-01,Policy,Desc,Access Control,NOPE"].join("\n");

      const result = await caller.framework.commitImport({
        fileContent: csvToBase64(csv),
        fileName: "fw.csv",
        name: "Bad Parent FW",
        code: "BADPARENT-FW",
        version: "1.0",
        mapping: MAPPING,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.rowErrors?.some((e) => /parent/i.test(e.message))).toBe(true);

      const after = await db.framework.count({ where: { organizationId: testOrg.id } });
      expect(after).toBe(before); // no framework created
    });

    it("blocks duplicate control IDs within the file", async () => {
      const caller = createCaller(adminUser);
      const csv = [
        HEADER,
        "AC-01,First,Desc,Access Control,",
        "AC-01,Dup,Desc,Access Control,",
      ].join("\n");

      const result = await caller.framework.commitImport({
        fileContent: csvToBase64(csv),
        fileName: "fw.csv",
        name: "Dup Control FW",
        code: "DUPCTRL-FW",
        version: "1.0",
        mapping: MAPPING,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.rowErrors?.some((e) => /duplicate/i.test(e.message))).toBe(true);
    });
  });

  describe("AC3: duplicate framework", () => {
    it("blocks a second import with the same code + version", async () => {
      const caller = createCaller(adminUser);
      const csv = [HEADER, "X-01,Ctrl,Desc,Fam,"].join("\n");
      const args = {
        fileContent: csvToBase64(csv),
        fileName: "fw.csv",
        name: "Dup Framework",
        code: "DUPFW",
        version: "1.0",
        mapping: MAPPING,
      };

      const first = await caller.framework.commitImport(args);
      expect(first.success).toBe(true);

      const second = await caller.framework.commitImport(args);
      expect(second.success).toBe(false);
      if (second.success) return;
      expect(second.issues?.some((i) => /already exists/i.test(i.message))).toBe(true);
    });
  });

  describe("AC5: authorization", () => {
    it("denies users without FRAMEWORK_MANAGE permission", async () => {
      const caller = createCaller(analystUser);
      const csv = [HEADER, "AC-01,Policy,Desc,Fam,"].join("\n");

      await expect(
        caller.framework.commitImport({
          fileContent: csvToBase64(csv),
          fileName: "fw.csv",
          name: "Denied FW",
          code: "DENIED-FW",
          version: "1.0",
          mapping: MAPPING,
        }),
      ).rejects.toThrow(/FORBIDDEN|permission|access/i);
    });
  });
});
