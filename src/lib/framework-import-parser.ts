/**
 * Framework Import Parser Utility
 *
 * Generic CSV/XLSX parser for the two-stage framework import (Story 24.1).
 * Unlike excel-parser.ts (standards module), this parser is intentionally
 * GENERIC: it returns the raw headers and rows exactly as found in the file.
 * Canonical column mapping (control ID, title, family, parent...) is a
 * separate user-driven step (Story 24.2) — do not canonicalize here.
 *
 * @see Story 24.1: Upload a Framework File and Preview Its Contents
 * @module framework-import-parser
 */

import * as XLSX from "xlsx";
import { estimateFileSizeFromBase64 } from "./excel-parser";

/**
 * Maximum file size in bytes (5MB) — matches the import convention
 * established by excel-parser.ts (NOT the 50MB evidence upload limit)
 */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Maximum number of data rows allowed in a framework import.
 *
 * Deliberately higher than excel-parser.ts's 1,000-row cap: full frameworks
 * are large (NIST 800-53 rev 5 has 1,196 controls including enhancements).
 */
export const MAX_IMPORT_ROWS = 5000;

/**
 * File extensions accepted for framework import
 */
export const ALLOWED_EXTENSIONS = ["csv", "xlsx"] as const;

/**
 * Maximum number of columns allowed.
 *
 * Guards against a crafted/corrupt file that declares an enormous sheet range:
 * `sheet_to_json` materializes the DECLARED range, so a few-KB file claiming
 * thousands of columns would otherwise force a massive allocation (DoS).
 */
export const MAX_IMPORT_COLUMNS = 200;

/**
 * A parse/validation issue surfaced to the user
 */
export interface ImportIssue {
  severity: "error" | "warning";
  message: string;
}

/**
 * Result of parsing a framework import file.
 *
 * `headers`/`rows` are raw file content (trimmed strings); `rows` excludes
 * fully-empty rows and is padded to header width. On error, `valid` is false
 * and `rows` is empty.
 */
export interface FrameworkImportParseResult {
  valid: boolean;
  headers: string[];
  rows: string[][];
  totalRows: number;
  issues: ImportIssue[];
}

/**
 * Validate a framework import file before parsing
 *
 * @param fileName - Original file name (extension check)
 * @param fileSizeBytes - Actual file size in bytes (not base64 length)
 * @returns Validation error message or null if valid
 */
export function validateImportFile(fileName: string, fileSizeBytes: number): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return "Please upload a .csv or .xlsx file";
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    const maxSizeMB = MAX_FILE_SIZE_BYTES / 1024 / 1024;
    return `File size must be less than ${maxSizeMB}MB (got ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB)`;
  }

  return null;
}

/**
 * Validate a base64-encoded framework import file before parsing
 *
 * @param fileName - Original file name
 * @param base64Content - Base64 encoded file content
 * @returns Validation error message or null if valid
 */
export function validateImportFileBase64(fileName: string, base64Content: string): string | null {
  return validateImportFile(fileName, estimateFileSizeFromBase64(base64Content.length));
}

/**
 * Build a failed parse result with a single error issue
 */
function parseError(message: string): FrameworkImportParseResult {
  return {
    valid: false,
    headers: [],
    rows: [],
    totalRows: 0,
    issues: [{ severity: "error", message }],
  };
}

/**
 * Parse a CSV or XLSX framework file into raw headers + rows.
 *
 * Never throws — all failures are reported as `valid: false` with error issues.
 *
 * @param base64Content - Base64-encoded file content (CSV or XLSX; format auto-detected)
 * @returns FrameworkImportParseResult with raw headers, data rows, and any issues
 */
export function parseFrameworkImportFile(base64Content: string): FrameworkImportParseResult {
  try {
    if (!base64Content) {
      return parseError("The file is empty");
    }

    // Decode base64 and read workbook (XLSX.read auto-detects xlsx vs csv)
    const binaryString = atob(base64Content);
    if (binaryString.length === 0) {
      return parseError("The file is empty");
    }
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Detect xlsx (zip: "PK\x03\x04") vs CSV/text by magic bytes. For CSV we
    // decode as UTF-8 ourselves and read as a string — XLSX.read on raw CSV
    // bytes guesses a legacy codepage and mangles non-ASCII text (e.g. accented
    // ISO control titles), and its codepage option needs an optional table that
    // is not reliably present in all runtimes.
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const workbook = isZip
      ? XLSX.read(bytes, { type: "array" })
      : XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return parseError("The file contains no sheets");
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return parseError("Could not read the first worksheet");
    }

    // Guard against an oversized DECLARED range BEFORE materializing cells:
    // sheet_to_json allocates the full declared range, so a tiny crafted file
    // claiming a huge range would otherwise pin CPU/memory (DoS).
    const ref = worksheet["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      const declaredRows = range.e.r - range.s.r + 1; // includes header row
      const declaredCols = range.e.c - range.s.c + 1;
      if (declaredCols > MAX_IMPORT_COLUMNS) {
        return parseError(
          `File declares ${declaredCols} columns, but the maximum allowed is ${MAX_IMPORT_COLUMNS}. Please check the file is a valid framework export.`,
        );
      }
      if (declaredRows - 1 > MAX_IMPORT_ROWS) {
        return parseError(
          `File declares ${declaredRows - 1} data rows, but the maximum allowed is ${MAX_IMPORT_ROWS}. Please split into smaller files.`,
        );
      }
    }

    // Array-of-arrays: row 0 = header row, remainder = data rows.
    // defval:"" keeps blank cells (and blank rows) so we can filter explicitly.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (aoa.length === 0) {
      return parseError("The file is empty");
    }

    const issues: ImportIssue[] = [];

    // --- Headers: raw, but made safe (non-empty + unique) for display/mapping ---
    const rawHeaderRow = aoa[0]!.map((cell) => String(cell ?? "").trim());
    // Strip UTF-8 BOM that Excel-exported CSVs prepend to the first header
    if (rawHeaderRow.length > 0 && rawHeaderRow[0]) {
      while (rawHeaderRow[0].charCodeAt(0) === 0xfeff) {
        rawHeaderRow[0] = rawHeaderRow[0].slice(1);
      }
    }

    // Extend header row to the widest data row so no column is dropped
    const dataRowsRaw = aoa.slice(1);
    const maxWidth = Math.max(rawHeaderRow.length, ...dataRowsRaw.map((r) => r.length), 0);

    const headers: string[] = [];
    const seenHeaders = new Set<string>(); // lowercased final header names
    let hadEmptyHeader = false;
    let hadDuplicateHeader = false;

    for (let i = 0; i < maxWidth; i++) {
      let name = rawHeaderRow[i] ?? "";
      if (!name) {
        name = `Column ${i + 1}`;
        hadEmptyHeader = true;
      }
      if (seenHeaders.has(name.toLowerCase())) {
        hadDuplicateHeader = true;
        // Increment the suffix until we find a name not already taken, so
        // e.g. ["Title", "Title", "Title (2)"] never yields two "Title (2)".
        const base = name;
        let suffix = 2;
        do {
          name = `${base} (${suffix})`;
          suffix++;
        } while (seenHeaders.has(name.toLowerCase()));
      }
      seenHeaders.add(name.toLowerCase());
      headers.push(name);
    }

    if (hadEmptyHeader) {
      issues.push({
        severity: "warning",
        message: "Some header cells were empty and were given positional names (e.g., \"Column 2\")",
      });
    }
    if (hadDuplicateHeader) {
      issues.push({
        severity: "warning",
        message: "Duplicate column headers were found and suffixed to keep them distinct",
      });
    }

    // --- Data rows: stringify, trim, pad to header width, drop fully-empty rows ---
    const rows: string[][] = [];
    for (const rawRow of dataRowsRaw) {
      const row: string[] = [];
      let isEmpty = true;
      for (let i = 0; i < maxWidth; i++) {
        const value = String(rawRow[i] ?? "").trim();
        if (value) isEmpty = false;
        row.push(value);
      }
      if (!isEmpty) {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      return parseError("The file contains no data rows (only a header row was found)");
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return parseError(
        `File contains ${rows.length} data rows, but the maximum allowed is ${MAX_IMPORT_ROWS}. Please split into smaller files.`,
      );
    }

    return {
      valid: true,
      headers,
      rows,
      totalRows: rows.length,
      issues,
    };
  } catch (error) {
    return parseError(
      `Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
