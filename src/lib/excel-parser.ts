/**
 * Excel Parser Utility for Standards Module
 *
 * Provides functions for parsing control data from Excel files
 * and generating downloadable Excel templates.
 *
 * @module excel-parser
 */

import * as XLSX from "xlsx";

/**
 * Maximum file size in bytes (5MB)
 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Maximum number of rows allowed in a single upload
 * Prevents memory exhaustion and database overload
 */
export const MAX_UPLOAD_ROWS = 1000;

/**
 * Represents a single control row parsed from Excel
 *
 * Story 12.4 AC34: Supports controlId, title, description, guidance, parentControlId, domains
 */
export interface ControlRow {
  code: string;
  title: string;
  description?: string;
  guidance?: string;
  parentControlId?: string;
  domains?: string[];
  criticality?: "HIGH" | "MEDIUM" | "LOW";
  sortOrder?: number;
}

/**
 * Validation error for a specific row
 */
export interface RowError {
  row: number; // 1-based row number (excluding header)
  field: string;
  message: string;
}

/**
 * Result of parsing an Excel file
 */
export interface ParseResult {
  success: boolean;
  data?: ControlRow[];
  errors?: RowError[];
  totalRows?: number;
}

/**
 * Expected column headers (case-insensitive matching)
 * Story 12.4 AC34: Added guidance, parentControlId, domains
 */
const COLUMN_MAPPINGS: Record<string, keyof ControlRow> = {
  code: "code",
  controlid: "code",
  "control id": "code",
  title: "title",
  description: "description",
  guidance: "guidance",
  parentcontrolid: "parentControlId",
  "parent control id": "parentControlId",
  "parent id": "parentControlId",
  parent: "parentControlId",
  domains: "domains",
  domain: "domains",
  criticality: "criticality",
  "sort order": "sortOrder",
  sortorder: "sortOrder",
  order: "sortOrder",
};

/**
 * Valid criticality values (case-insensitive)
 */
const VALID_CRITICALITIES = ["HIGH", "MEDIUM", "LOW"] as const;

/**
 * Parse an Excel file containing control data
 *
 * @param base64Content - Base64-encoded Excel file content
 * @returns ParseResult with either parsed data or validation errors
 */
export function parseControlsExcel(base64Content: string): ParseResult {
  try {
    // Decode base64 and read workbook
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const workbook = XLSX.read(bytes, { type: "array" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        errors: [{ row: 0, field: "file", message: "Excel file contains no sheets" }],
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return {
        success: false,
        errors: [{ row: 0, field: "file", message: "Could not read worksheet" }],
      };
    }

    // Convert to JSON with header row
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
      raw: false,
    });

    if (rawData.length === 0) {
      return {
        success: false,
        errors: [{ row: 0, field: "file", message: "The Excel file contains no data rows" }],
      };
    }

    // Check maximum row limit to prevent memory/database issues
    if (rawData.length > MAX_UPLOAD_ROWS) {
      return {
        success: false,
        errors: [
          {
            row: 0,
            field: "file",
            message: `File contains ${rawData.length} rows, but maximum allowed is ${MAX_UPLOAD_ROWS}. Please split into smaller files.`,
          },
        ],
      };
    }

    // Map headers to expected column names
    const firstRow = rawData[0];
    if (!firstRow) {
      return {
        success: false,
        errors: [{ row: 0, field: "file", message: "Could not read header row" }],
      };
    }

    const headerMap = new Map<string, string>();
    for (const key of Object.keys(firstRow)) {
      const normalizedKey = key.toLowerCase().trim();
      const mappedField = COLUMN_MAPPINGS[normalizedKey];
      if (mappedField) {
        headerMap.set(key, mappedField);
      }
    }

    // Check required columns exist
    const hasCode = [...headerMap.values()].includes("code");
    const hasTitle = [...headerMap.values()].includes("title");

    if (!hasCode || !hasTitle) {
      const missing: string[] = [];
      if (!hasCode) missing.push("Code");
      if (!hasTitle) missing.push("Title");
      return {
        success: false,
        errors: [
          {
            row: 0,
            field: "header",
            message: `Missing required columns: ${missing.join(", ")}`,
          },
        ],
      };
    }

    // Parse and validate each row
    const controls: ControlRow[] = [];
    const errors: RowError[] = [];
    const seenCodes = new Map<string, number>(); // code -> first row where seen

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]!;
      const rowNumber = i + 1; // 1-based for user display

      const control: Partial<ControlRow> = {};

      // Map each column to its field
      for (const [originalKey, fieldName] of headerMap) {
        const value = row[originalKey];
        const strValue = String(value ?? "").trim();

        switch (fieldName) {
          case "code":
            control.code = strValue;
            break;
          case "title":
            control.title = strValue;
            break;
          case "description":
            control.description = strValue || undefined;
            break;
          case "guidance":
            control.guidance = strValue || undefined;
            break;
          case "parentControlId":
            control.parentControlId = strValue || undefined;
            break;
          case "domains":
            // Parse comma-separated domains list
            if (strValue) {
              control.domains = strValue
                .split(",")
                .map((d) => d.trim())
                .filter((d) => d.length > 0);
            }
            break;
          case "criticality":
            if (strValue) {
              const normalized = strValue.toUpperCase();
              if (VALID_CRITICALITIES.includes(normalized as typeof VALID_CRITICALITIES[number])) {
                control.criticality = normalized as "HIGH" | "MEDIUM" | "LOW";
              } else {
                errors.push({
                  row: rowNumber,
                  field: "criticality",
                  message: `Criticality must be HIGH, MEDIUM, or LOW (got "${strValue}")`,
                });
              }
            }
            break;
          case "sortOrder":
            if (strValue) {
              const num = parseInt(strValue, 10);
              if (isNaN(num) || num < 0) {
                errors.push({
                  row: rowNumber,
                  field: "sortOrder",
                  message: `Sort order must be a positive number (got "${strValue}")`,
                });
              } else {
                control.sortOrder = num;
              }
            }
            break;
        }
      }

      // Validate required fields
      if (!control.code) {
        errors.push({
          row: rowNumber,
          field: "code",
          message: "Code is required",
        });
      } else {
        // Check code length
        if (control.code.length > 50) {
          errors.push({
            row: rowNumber,
            field: "code",
            message: `Code must be 50 characters or less (got ${control.code.length})`,
          });
        }

        // Check for duplicate codes in file
        const existingRow = seenCodes.get(control.code.toUpperCase());
        if (existingRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: "code",
            message: `Duplicate code "${control.code}" (first seen in row ${existingRow})`,
          });
        } else {
          seenCodes.set(control.code.toUpperCase(), rowNumber);
        }
      }

      if (!control.title) {
        errors.push({
          row: rowNumber,
          field: "title",
          message: "Title is required",
        });
      } else if (control.title.length > 200) {
        errors.push({
          row: rowNumber,
          field: "title",
          message: `Title must be 200 characters or less (got ${control.title.length})`,
        });
      }

      // Add to controls list if valid so far (we'll check all errors at once)
      if (control.code && control.title) {
        controls.push({
          code: control.code,
          title: control.title,
          description: control.description,
          guidance: control.guidance,
          parentControlId: control.parentControlId,
          domains: control.domains,
          criticality: control.criticality,
          sortOrder: control.sortOrder,
        });
      }
    }

    // Return errors if any validation failed
    if (errors.length > 0) {
      return {
        success: false,
        errors,
        totalRows: rawData.length,
      };
    }

    return {
      success: true,
      data: controls,
      totalRows: controls.length,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          row: 0,
          field: "file",
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }
}

/**
 * Generate a template Excel file for control imports
 *
 * @returns Base64-encoded Excel file content
 */
export function generateControlTemplate(): string {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();

  // Template data with example rows (Story 12.4 AC34: includes all required fields)
  const templateData = [
    {
      Code: "SEC-001",
      Title: "Access Control Policy",
      Description: "Defines requirements for managing access to organizational systems and data",
      Guidance: "Implement role-based access control with least privilege principle",
      "Parent Control ID": "",
      Domains: "Access Control, Identity Management",
      Criticality: "HIGH",
      "Sort Order": 1,
    },
    {
      Code: "SEC-001.1",
      Title: "User Account Management",
      Description: "Requirements for creating, modifying, and terminating user accounts",
      Guidance: "Use automated provisioning and deprovisioning workflows",
      "Parent Control ID": "SEC-001",
      Domains: "Identity Management",
      Criticality: "HIGH",
      "Sort Order": 2,
    },
    {
      Code: "SEC-002",
      Title: "Password Requirements",
      Description: "Establishes minimum password complexity and rotation requirements",
      Guidance: "Minimum 12 characters, require complexity, 90-day rotation",
      "Parent Control ID": "",
      Domains: "Authentication",
      Criticality: "MEDIUM",
      "Sort Order": 3,
    },
    {
      Code: "SEC-003",
      Title: "Audit Logging",
      Description: "Requirements for logging and monitoring system activities",
      Guidance: "Log all authentication events, privilege changes, and data access",
      "Parent Control ID": "",
      Domains: "Monitoring, Compliance",
      Criticality: "LOW",
      "Sort Order": 4,
    },
  ];

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths for better readability (Story 12.4 AC34: all fields)
  worksheet["!cols"] = [
    { wch: 15 },  // Code
    { wch: 35 },  // Title
    { wch: 50 },  // Description
    { wch: 50 },  // Guidance
    { wch: 18 },  // Parent Control ID
    { wch: 30 },  // Domains
    { wch: 12 },  // Criticality
    { wch: 12 },  // Sort Order
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Controls");

  // Write to buffer and convert to base64
  const buffer = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

  return buffer;
}

/**
 * Calculate actual file size from base64 string length
 * Base64 encoding increases size by ~33% (4 chars per 3 bytes)
 *
 * @param base64Length - Length of base64 encoded string
 * @returns Estimated original file size in bytes
 */
export function estimateFileSizeFromBase64(base64Length: number): number {
  // Base64 uses 4 characters to represent 3 bytes
  // Account for potential padding (= characters)
  return Math.floor((base64Length * 3) / 4);
}

/**
 * Validate a file before parsing
 *
 * @param fileName - Original file name
 * @param fileSize - File size in bytes (actual file size, not base64 length)
 * @returns Validation error message or null if valid
 */
export function validateExcelFile(fileName: string, fileSize: number): string | null {
  // Check file extension
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension !== "xlsx") {
    return "Please upload an Excel file (.xlsx)";
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const maxSizeMB = MAX_FILE_SIZE_BYTES / 1024 / 1024;
    return `File size must be less than ${maxSizeMB}MB (got ${(fileSize / 1024 / 1024).toFixed(2)}MB)`;
  }

  return null;
}

/**
 * Validate a base64-encoded file before parsing
 *
 * @param fileName - Original file name
 * @param base64Content - Base64 encoded file content
 * @returns Validation error message or null if valid
 */
export function validateExcelFileBase64(fileName: string, base64Content: string): string | null {
  const estimatedSize = estimateFileSizeFromBase64(base64Content.length);
  return validateExcelFile(fileName, estimatedSize);
}
