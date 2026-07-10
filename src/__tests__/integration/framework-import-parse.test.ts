/**
 * Integration Tests for Framework Import File Parsing
 *
 * Story 24.1: Upload a Framework File and Preview Its Contents
 *
 * Tests the framework.parseImportFile mutation:
 * - AC1: returns detected headers, first 10 preview rows, and total row count
 * - AC2: malformed/empty/oversized/wrong-extension files produce clear errors
 *        and create no partial import state (read-only mutation)
 * - AC3: requires FRAMEWORK_MANAGE permission (denied for non-admin roles)
 *
 * @see docs/sprint-artifacts/24-1-upload-framework-file-preview.md
 */

import * as XLSX from "xlsx";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";

// Helper to create a mock XLSX file as base64 from array-of-arrays
function createMockXlsx(rows: unknown[][]): string {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Framework");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

function csvToBase64(csv: string): string {
  return Buffer.from(csv, "utf-8").toString("base64");
}

describe("Framework Import Parse - Story 24.1", () => {
  let testOrg: { id: string; name: string };
  let adminUser: { id: string; email: string; organizationId: string; role: UserRole };
  let analystUser: { id: string; email: string; organizationId: string; role: UserRole };

  const createCaller = (user: typeof adminUser) => {
    return appRouter.createCaller({
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
  };

  beforeAll(async () => {
    testOrg = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Test Org FrameworkImport ${Date.now()}`,
        slug: `test-org-framework-import-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const adminEmail = `admin-fwimport-${Date.now()}@example.com`;
    const createdAdmin = await db.user.create({
      data: {
        id: randomUUID(),
        email: adminEmail,
        name: "Admin Test User",
        organizationId: testOrg.id,
        role: UserRole.ADMINISTRATOR,
        updatedAt: new Date(),
      },
    });
    adminUser = {
      id: createdAdmin.id,
      email: adminEmail,
      organizationId: createdAdmin.organizationId,
      role: createdAdmin.role,
    };

    const analystEmail = `analyst-fwimport-${Date.now()}@example.com`;
    const createdAnalyst = await db.user.create({
      data: {
        id: randomUUID(),
        email: analystEmail,
        name: "Analyst Test User",
        organizationId: testOrg.id,
        role: UserRole.ANALYST,
        updatedAt: new Date(),
      },
    });
    analystUser = {
      id: createdAnalyst.id,
      email: analystEmail,
      organizationId: createdAnalyst.organizationId,
      role: createdAnalyst.role,
    };
  });

  afterAll(async () => {
    if (testOrg) {
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrg.id}`;
    }
  });

  describe("AC1: parse and preview", () => {
    it("should return headers, preview rows, and total count for a valid xlsx", async () => {
      const caller = createCaller(adminUser);
      const rows: unknown[][] = [["Control ID", "Title", "Family"]];
      for (let i = 1; i <= 12; i++) {
        rows.push([`AC-${String(i).padStart(2, "0")}`, `Control ${i}`, "Access Control"]);
      }

      const result = await caller.framework.parseImportFile({
        fileContent: createMockXlsx(rows),
        fileName: "nist-controls.xlsx",
      });

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Title", "Family"]);
      expect(result.previewRows).toHaveLength(10); // capped at 10 for preview
      expect(result.previewRows[0]).toEqual(["AC-01", "Control 1", "Access Control"]);
      expect(result.totalRows).toBe(12); // full count still reported
      expect(result.issues).toHaveLength(0);
    });

    it("should parse a CSV file the same way", async () => {
      const caller = createCaller(adminUser);
      const csv = "Control ID,Title\nAC-01,Policy\nAC-02,Accounts";

      const result = await caller.framework.parseImportFile({
        fileContent: csvToBase64(csv),
        fileName: "framework.csv",
      });

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Title"]);
      expect(result.previewRows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
    });
  });

  describe("AC2: error handling with no partial state", () => {
    it("should reject an unsupported extension with a clear error", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.framework.parseImportFile({
          fileContent: csvToBase64("a,b\n1,2"),
          fileName: "framework.pdf",
        }),
      ).rejects.toThrow(/\.csv or \.xlsx/);
    });

    it("should return a parse error (not throw) for corrupt content, with no issues masked", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.framework.parseImportFile({
        fileContent: "!!!not-valid-base64@@@",
        fileName: "framework.csv",
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.severity === "error")).toBe(true);
      expect(result.previewRows).toHaveLength(0);
    });

    it("should return a clear error for a header-only file", async () => {
      const caller = createCaller(adminUser);

      const result = await caller.framework.parseImportFile({
        fileContent: csvToBase64("Control ID,Title\n"),
        fileName: "framework.csv",
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => /no data rows/i.test(i.message))).toBe(true);
    });

    it("should reject oversized payloads at input validation", async () => {
      const caller = createCaller(adminUser);

      await expect(
        caller.framework.parseImportFile({
          fileContent: "A".repeat(8_000_001),
          fileName: "framework.csv",
        }),
      ).rejects.toThrow();
    });

    it("should create no Framework rows regardless of input (read-only mutation)", async () => {
      const caller = createCaller(adminUser);
      const before = await db.framework.count({ where: { organizationId: testOrg.id } });

      await caller.framework.parseImportFile({
        fileContent: csvToBase64("Control ID,Title\nAC-01,Policy"),
        fileName: "framework.csv",
      });

      const after = await db.framework.count({ where: { organizationId: testOrg.id } });
      expect(after).toBe(before);
    });
  });

  describe("AC3: authorization", () => {
    it("should deny users without FRAMEWORK_MANAGE permission", async () => {
      const caller = createCaller(analystUser);

      await expect(
        caller.framework.parseImportFile({
          fileContent: csvToBase64("Control ID,Title\nAC-01,Policy"),
          fileName: "framework.csv",
        }),
      ).rejects.toThrow(/FORBIDDEN|permission|access/i);
    });
  });
});
