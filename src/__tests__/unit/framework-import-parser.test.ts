/**
 * Unit Tests for Framework Import Parser Utility
 *
 * Tests the generic CSV/XLSX framework-import parsing and validation logic.
 * Story 24.1: parser returns RAW headers/rows (no canonical mapping — that is Story 24.2).
 *
 * **Critical Test Coverage:**
 * - parseFrameworkImportFile function (xlsx + csv)
 * - validateImportFile / validateImportFileBase64 functions
 * - Edge cases: empty file, header-only, oversized row count, duplicate headers,
 *   empty header cells, UTF-8 BOM, corrupt content, trailing empty rows
 *
 * @see Story 24.1: Upload a Framework File and Preview Its Contents
 */

import * as XLSX from "xlsx";
import {
  parseFrameworkImportFile,
  validateImportFile,
  validateImportFileBase64,
  MAX_FILE_SIZE_BYTES,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_COLUMNS,
} from "@/lib/framework-import-parser";

// Helper to create a mock XLSX file as base64 from array-of-arrays
function createMockXlsx(rows: unknown[][]): string {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Framework");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

// Helper to encode a CSV string as base64
function csvToBase64(csv: string): string {
  return Buffer.from(csv, "utf-8").toString("base64");
}

// Helper to build an xlsx whose declared range is overridden to a large area
// while containing only a couple of real cells (models a crafted/corrupt file).
function createXlsxWithDeclaredRange(ref: string): string {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["Control ID", "Title"], ["AC-01", "Policy"]]);
  worksheet["!ref"] = ref;
  XLSX.utils.book_append_sheet(workbook, worksheet, "Framework");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

describe("Framework Import Parser", () => {
  describe("Constants", () => {
    it("should export MAX_FILE_SIZE_BYTES as 5MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it("should export MAX_IMPORT_ROWS as 5000 (800-53 has 1,196 controls; 1000-row cap is insufficient)", () => {
      expect(MAX_IMPORT_ROWS).toBe(5000);
    });
  });

  describe("validateImportFile", () => {
    it("should accept .xlsx files under the size limit", () => {
      expect(validateImportFile("framework.xlsx", 1024 * 1024)).toBeNull();
    });

    it("should accept .csv files under the size limit", () => {
      expect(validateImportFile("framework.csv", 1024)).toBeNull();
    });

    it("should accept extensions case-insensitively", () => {
      expect(validateImportFile("FRAMEWORK.XLSX", 1024)).toBeNull();
      expect(validateImportFile("framework.CSV", 1024)).toBeNull();
    });

    it("should reject unsupported extensions with a clear message", () => {
      expect(validateImportFile("framework.xls", 1024)).toContain(".csv or .xlsx");
      expect(validateImportFile("framework.pdf", 1024)).toContain(".csv or .xlsx");
      expect(validateImportFile("framework", 1024)).toContain(".csv or .xlsx");
    });

    it("should reject files over the size limit", () => {
      const result = validateImportFile("framework.xlsx", MAX_FILE_SIZE_BYTES + 1);
      expect(result).toContain("File size must be less than");
    });

    it("should accept files exactly at the size limit", () => {
      expect(validateImportFile("framework.csv", MAX_FILE_SIZE_BYTES)).toBeNull();
    });
  });

  describe("validateImportFileBase64", () => {
    it("should pass small base64 content", () => {
      expect(validateImportFileBase64("test.csv", csvToBase64("a,b\n1,2"))).toBeNull();
    });

    it("should reject oversized base64 content", () => {
      const largeContent = "A".repeat(MAX_FILE_SIZE_BYTES * 2);
      expect(validateImportFileBase64("test.xlsx", largeContent)).toContain(
        "File size must be less than",
      );
    });
  });

  describe("parseFrameworkImportFile — XLSX", () => {
    it("should return raw headers, data rows, and total row count", () => {
      const base64 = createMockXlsx([
        ["Control ID", "Title", "Description", "Family"],
        ["AC-01", "Policy and Procedures", "The organization develops...", "Access Control"],
        ["AC-02", "Account Management", "The organization manages...", "Access Control"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Title", "Description", "Family"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([
        "AC-01",
        "Policy and Procedures",
        "The organization develops...",
        "Access Control",
      ]);
      expect(result.totalRows).toBe(2);
      expect(result.issues).toHaveLength(0);
    });

    it("should NOT canonicalize headers — arbitrary header names pass through untouched", () => {
      const base64 = createMockXlsx([
        ["Ref#", "Nombre", "Detalle"],
        ["1.1", "Política", "Texto"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Ref#", "Nombre", "Detalle"]);
    });

    it("should exclude fully-empty trailing rows from data and count", () => {
      const base64 = createMockXlsx([
        ["Control ID", "Title"],
        ["AC-01", "Policy"],
        ["", ""],
        ["", ""],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.totalRows).toBe(1);
    });

    it("should pad ragged rows to header width", () => {
      const base64 = createMockXlsx([
        ["Control ID", "Title", "Description"],
        ["AC-01", "Policy"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.rows[0]).toEqual(["AC-01", "Policy", ""]);
    });

    it("should dedupe duplicate headers with a suffix and report a warning", () => {
      const base64 = createMockXlsx([
        ["Title", "Title", "Description"],
        ["A", "B", "C"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Title", "Title (2)", "Description"]);
      expect(result.issues.some((i) => i.severity === "warning" && /duplicate/i.test(i.message))).toBe(
        true,
      );
    });

    it("should keep all headers unique even when a generated suffix collides with an existing header", () => {
      // The second "Title" suffixes to "Title (2)", which then collides with the
      // third original header "Title (2)" — the resolver must keep incrementing
      // so no two final headers are equal.
      const base64 = createMockXlsx([
        ["Title", "Title", "Title (2)"],
        ["A", "B", "C"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.headers[0]).toBe("Title");
      expect(result.headers).toHaveLength(3);
      // The real contract: every final header name is distinct (case-insensitively)
      const lowered = result.headers.map((h) => h.toLowerCase());
      expect(new Set(lowered).size).toBe(lowered.length);
    });

    it("should substitute a positional name for empty header cells and report a warning", () => {
      const base64 = createMockXlsx([
        ["Control ID", "", "Description"],
        ["AC-01", "Policy", "Text"],
      ]);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Column 2", "Description"]);
      expect(
        result.issues.some((i) => i.severity === "warning" && /header/i.test(i.message)),
      ).toBe(true);
    });
  });

  describe("parseFrameworkImportFile — CSV", () => {
    it("should parse a plain CSV with quoted values and CRLF line endings", () => {
      const csv = 'Control ID,Title,Description\r\nAC-01,"Policy, and Procedures","Line one"\r\nAC-02,Accounts,Text';
      const result = parseFrameworkImportFile(csvToBase64(csv));

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Title", "Description"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]![1]).toBe("Policy, and Procedures");
      expect(result.totalRows).toBe(2);
    });

    it("should strip a UTF-8 BOM so the first header is clean", () => {
      const csv = String.fromCharCode(0xfeff) + "Control ID,Title\nAC-01,Policy";
      const result = parseFrameworkImportFile(csvToBase64(csv));

      expect(result.valid).toBe(true);
      expect(result.headers[0]).toBe("Control ID");
    });

    it("should preserve non-ASCII UTF-8 text in a BOM-less CSV (no mojibake)", () => {
      // BOM-less CSV with accented + CJK content — the common ISO/localized export case.
      const csv = "Control ID,Título,Descripción\nAC-01,Política,Gestión de acceso 日本語";
      const result = parseFrameworkImportFile(csvToBase64(csv));

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual(["Control ID", "Título", "Descripción"]);
      expect(result.rows[0]).toEqual(["AC-01", "Política", "Gestión de acceso 日本語"]);
    });
  });

  describe("parseFrameworkImportFile — error handling", () => {
    it("should fail with a clear error when the file has no data rows (header only)", () => {
      const result = parseFrameworkImportFile(csvToBase64("Control ID,Title\n"));

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.severity === "error" && /no data rows/i.test(i.message))).toBe(
        true,
      );
    });

    it("should fail with a clear error for an empty file", () => {
      const result = parseFrameworkImportFile(csvToBase64(""));

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("should fail with a clear error for corrupt/unreadable content", () => {
      const result = parseFrameworkImportFile("!!!not-valid-base64-content@@@");

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("should reject files exceeding MAX_IMPORT_ROWS without truncating silently", () => {
      const lines = ["Control ID,Title"];
      for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) {
        lines.push(`C-${i},Title ${i}`);
      }
      const result = parseFrameworkImportFile(csvToBase64(lines.join("\n")));

      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (i) => i.severity === "error" && i.message.includes(String(MAX_IMPORT_ROWS)),
        ),
      ).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    it("should never throw on any input", () => {
      expect(() => parseFrameworkImportFile("")).not.toThrow();
      expect(() => parseFrameworkImportFile("AAAA")).not.toThrow();
    });

    it("should reject an oversized DECLARED row range from !ref without materializing cells (DoS guard)", () => {
      // A tiny file (2 real cells) that CLAIMS 5,100 data rows. The parser must
      // reject it by inspecting !ref, NOT by allocating the full declared grid.
      const base64 = createXlsxWithDeclaredRange(`A1:B${MAX_IMPORT_ROWS + 100}`);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (i) => i.severity === "error" && /data rows/.test(i.message),
        ),
      ).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    it("should reject a file declaring more than MAX_IMPORT_COLUMNS columns from !ref", () => {
      const lastCol = XLSX.utils.encode_col(MAX_IMPORT_COLUMNS); // 0-based → one past the max
      const base64 = createXlsxWithDeclaredRange(`A1:${lastCol}2`);

      const result = parseFrameworkImportFile(base64);

      expect(result.valid).toBe(false);
      expect(
        result.issues.some(
          (i) => i.severity === "error" && i.message.includes(String(MAX_IMPORT_COLUMNS)),
        ),
      ).toBe(true);
    });
  });
});
