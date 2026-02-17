/**
 * Unit Tests for Excel Parser Utility
 *
 * Tests the bulk upload Excel parsing and validation logic.
 *
 * **Critical Test Coverage:**
 * - parseControlsExcel function
 * - generateControlTemplate function
 * - validateExcelFile function
 * - validateExcelFileBase64 function
 * - estimateFileSizeFromBase64 function
 * - Edge cases and error handling
 *
 * @see Bulk Upload Controls Feature
 */

import * as XLSX from "xlsx";
import {
  parseControlsExcel,
  generateControlTemplate,
  validateExcelFile,
  validateExcelFileBase64,
  estimateFileSizeFromBase64,
  MAX_FILE_SIZE_BYTES,
  MAX_UPLOAD_ROWS,
  type ControlRow,
  type ParseResult,
} from "@/lib/excel-parser";

// Helper to create a mock Excel file as base64
function createMockExcel(data: Record<string, unknown>[]): string {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Controls");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

describe("Excel Parser", () => {
  describe("Constants", () => {
    it("should export MAX_FILE_SIZE_BYTES as 5MB", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it("should export MAX_UPLOAD_ROWS as 1000", () => {
      expect(MAX_UPLOAD_ROWS).toBe(1000);
    });
  });

  describe("estimateFileSizeFromBase64", () => {
    it("should correctly estimate file size from base64 length", () => {
      // Base64 uses 4 characters for every 3 bytes
      expect(estimateFileSizeFromBase64(4)).toBe(3);
      expect(estimateFileSizeFromBase64(100)).toBe(75);
      expect(estimateFileSizeFromBase64(1000)).toBe(750);
    });

    it("should handle zero length", () => {
      expect(estimateFileSizeFromBase64(0)).toBe(0);
    });
  });

  describe("validateExcelFile", () => {
    it("should accept valid .xlsx file under size limit", () => {
      const result = validateExcelFile("controls.xlsx", 1024 * 1024); // 1MB
      expect(result).toBeNull();
    });

    it("should reject non-.xlsx files", () => {
      expect(validateExcelFile("controls.xls", 1024)).toBe(
        "Please upload an Excel file (.xlsx)"
      );
      expect(validateExcelFile("controls.csv", 1024)).toBe(
        "Please upload an Excel file (.xlsx)"
      );
      expect(validateExcelFile("controls.pdf", 1024)).toBe(
        "Please upload an Excel file (.xlsx)"
      );
    });

    it("should reject files over size limit", () => {
      const result = validateExcelFile("controls.xlsx", MAX_FILE_SIZE_BYTES + 1);
      expect(result).toContain("File size must be less than");
    });

    it("should accept files exactly at size limit", () => {
      const result = validateExcelFile("controls.xlsx", MAX_FILE_SIZE_BYTES);
      expect(result).toBeNull();
    });
  });

  describe("validateExcelFileBase64", () => {
    it("should validate using estimated size from base64 content", () => {
      // Create a small base64 string (should pass)
      const smallContent = "SGVsbG8gV29ybGQh"; // "Hello World!" in base64
      const result = validateExcelFileBase64("test.xlsx", smallContent);
      expect(result).toBeNull();
    });

    it("should reject large base64 content", () => {
      // Create a very large base64 string
      const largeContent = "A".repeat(MAX_FILE_SIZE_BYTES * 2);
      const result = validateExcelFileBase64("test.xlsx", largeContent);
      expect(result).toContain("File size must be less than");
    });
  });

  describe("parseControlsExcel", () => {
    describe("Valid input handling", () => {
      it("should parse valid Excel with all required columns", () => {
        const data = [
          { Code: "SEC-001", Title: "Access Control" },
          { Code: "SEC-002", Title: "Encryption" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].code).toBe("SEC-001");
        expect(result.data![0].title).toBe("Access Control");
        expect(result.data![1].code).toBe("SEC-002");
      });

      it("should parse optional description field", () => {
        const data = [
          { Code: "SEC-001", Title: "Access Control", Description: "Test description" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].description).toBe("Test description");
      });

      it("should parse optional criticality field (case-insensitive)", () => {
        const data = [
          { Code: "SEC-001", Title: "Test", Criticality: "HIGH" },
          { Code: "SEC-002", Title: "Test2", Criticality: "medium" },
          { Code: "SEC-003", Title: "Test3", Criticality: "Low" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].criticality).toBe("HIGH");
        expect(result.data![1].criticality).toBe("MEDIUM");
        expect(result.data![2].criticality).toBe("LOW");
      });

      it("should parse optional sortOrder field", () => {
        const data = [
          { Code: "SEC-001", Title: "Test", "Sort Order": 5 },
          { Code: "SEC-002", Title: "Test2", Order: 10 },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].sortOrder).toBe(5);
        expect(result.data![1].sortOrder).toBe(10);
      });

      it("should handle case-insensitive column headers", () => {
        const data = [
          { CODE: "SEC-001", TITLE: "Test", CRITICALITY: "HIGH" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].code).toBe("SEC-001");
      });
    });

    describe("Validation errors", () => {
      it("should reject file with missing Code column", () => {
        const data = [{ Title: "Access Control" }];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors![0].message).toContain("Missing required columns");
        expect(result.errors![0].message).toContain("Code");
      });

      it("should reject file with missing Title column", () => {
        const data = [{ Code: "SEC-001" }];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors![0].message).toContain("Missing required columns");
        expect(result.errors![0].message).toContain("Title");
      });

      it("should reject rows with empty Code", () => {
        const data = [
          { Code: "SEC-001", Title: "Valid" },
          { Code: "", Title: "Missing Code" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message === "Code is required")).toBe(true);
      });

      it("should reject rows with empty Title", () => {
        const data = [
          { Code: "SEC-001", Title: "" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message === "Title is required")).toBe(true);
      });

      it("should reject Code longer than 50 characters", () => {
        const data = [
          { Code: "A".repeat(51), Title: "Test" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message.includes("50 characters or less"))).toBe(true);
      });

      it("should reject Title longer than 200 characters", () => {
        const data = [
          { Code: "SEC-001", Title: "A".repeat(201) },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message.includes("200 characters or less"))).toBe(true);
      });

      it("should reject invalid criticality values", () => {
        const data = [
          { Code: "SEC-001", Title: "Test", Criticality: "CRITICAL" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e =>
          e.message.includes("Criticality must be HIGH, MEDIUM, or LOW")
        )).toBe(true);
      });

      it("should reject invalid sortOrder values", () => {
        const data = [
          { Code: "SEC-001", Title: "Test", "Sort Order": "abc" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e =>
          e.message.includes("Sort order must be a positive number")
        )).toBe(true);
      });

      it("should reject negative sortOrder values", () => {
        const data = [
          { Code: "SEC-001", Title: "Test", "Sort Order": -1 },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e =>
          e.message.includes("Sort order must be a positive number")
        )).toBe(true);
      });

      it("should detect duplicate codes within file", () => {
        const data = [
          { Code: "SEC-001", Title: "First" },
          { Code: "SEC-002", Title: "Second" },
          { Code: "SEC-001", Title: "Duplicate" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message.includes("Duplicate code"))).toBe(true);
      });

      it("should detect duplicate codes case-insensitively", () => {
        const data = [
          { Code: "SEC-001", Title: "First" },
          { Code: "sec-001", Title: "Duplicate (lowercase)" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors!.some(e => e.message.includes("Duplicate code"))).toBe(true);
      });
    });

    describe("Row limit enforcement", () => {
      it("should reject files exceeding MAX_UPLOAD_ROWS", () => {
        // Create a large dataset
        const data = Array.from({ length: MAX_UPLOAD_ROWS + 1 }, (_, i) => ({
          Code: `SEC-${String(i).padStart(4, "0")}`,
          Title: `Control ${i}`,
        }));
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors![0].message).toContain(
          `File contains ${MAX_UPLOAD_ROWS + 1} rows`
        );
        expect(result.errors![0].message).toContain(
          `maximum allowed is ${MAX_UPLOAD_ROWS}`
        );
      });

      it("should accept files at exactly MAX_UPLOAD_ROWS", () => {
        // Create dataset at exactly the limit
        const data = Array.from({ length: MAX_UPLOAD_ROWS }, (_, i) => ({
          Code: `SEC-${String(i).padStart(4, "0")}`,
          Title: `Control ${i}`,
        }));
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(MAX_UPLOAD_ROWS);
      });
    });

    describe("Edge cases", () => {
      it("should handle empty file gracefully", () => {
        const data: Record<string, unknown>[] = [];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        expect(result.errors![0].message).toContain("no data rows");
      });

      it("should handle whitespace in values", () => {
        const data = [
          { Code: "  SEC-001  ", Title: "  Access Control  " },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].code).toBe("SEC-001");
        expect(result.data![0].title).toBe("Access Control");
      });

      it("should handle null/undefined values gracefully", () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([
          ["Code", "Title", "Description"],
          ["SEC-001", "Test", null],
        ]);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Controls");
        const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(true);
        expect(result.data![0].description).toBeUndefined();
      });

      it("should provide correct row numbers in errors", () => {
        const data = [
          { Code: "SEC-001", Title: "Valid" },
          { Code: "", Title: "Invalid" },
          { Code: "SEC-003", Title: "Valid" },
          { Code: "", Title: "Also Invalid" },
        ];
        const base64 = createMockExcel(data);
        const result = parseControlsExcel(base64);

        expect(result.success).toBe(false);
        const errorRows = result.errors!.map(e => e.row);
        expect(errorRows).toContain(2); // Second row (1-based)
        expect(errorRows).toContain(4); // Fourth row
      });
    });

    describe("Invalid base64 handling", () => {
      it("should handle invalid base64 gracefully", () => {
        const result = parseControlsExcel("not-valid-base64!!!");

        expect(result.success).toBe(false);
        expect(result.errors![0].message).toContain("Failed to parse Excel file");
      });

      it("should handle corrupted Excel content", () => {
        const result = parseControlsExcel(btoa("not an excel file"));

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
      });
    });
  });

  describe("generateControlTemplate", () => {
    it("should generate a valid base64 Excel file", () => {
      const base64 = generateControlTemplate();

      expect(typeof base64).toBe("string");
      expect(base64.length).toBeGreaterThan(0);

      // Verify it can be parsed back
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const workbook = XLSX.read(bytes, { type: "array" });
      expect(workbook.SheetNames).toContain("Controls");
    });

    it("should include all expected columns in template", () => {
      const base64 = generateControlTemplate();
      const result = parseControlsExcel(base64);

      // Template includes sample data that should parse successfully
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);

      // Check that sample data has expected structure
      const firstRow = result.data![0];
      expect(firstRow.code).toBeDefined();
      expect(firstRow.title).toBeDefined();
      expect(firstRow.description).toBeDefined();
      expect(firstRow.criticality).toBeDefined();
      expect(firstRow.sortOrder).toBeDefined();
    });

    it("should include example rows in template", () => {
      const base64 = generateControlTemplate();
      const result = parseControlsExcel(base64);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(4); // SEC-001, SEC-001.1, SEC-002, SEC-003

      // Verify example data
      expect(result.data![0].code).toBe("SEC-001");
      expect(result.data![0].criticality).toBe("HIGH");
      // Verify child control example
      expect(result.data![1].code).toBe("SEC-001.1");
      expect(result.data![1].parentControlId).toBe("SEC-001");
    });
  });
});
