/**
 * Crosswalk export file builder (Epic 26, Story 26.4).
 *
 * Turns a header row + data rows into a downloadable CSV or XLSX payload.
 * Reuses the xlsx@0.18.5 dependency (writing is straightforward; the guarded
 * parse path from Epic 24 is only needed for untrusted input).
 */

import * as XLSX from "xlsx";

export type ExportFormat = "csv" | "xlsx";

/** Human-readable OLIR relationship labels for export cells. */
export const OLIR_EXPORT_LABEL: Record<string, string> = {
  EQUIVALENT: "Equivalent",
  SUBSET_OF: "Subset of",
  SUPERSET_OF: "Superset of",
  INTERSECTS: "Intersects",
};

export interface ExportFile {
  content: string;
  mimeType: string;
  /** utf8 → plain string; base64 → binary payload the client must decode */
  encoding: "utf8" | "base64";
}

/**
 * Neutralize CSV formula injection: a cell whose first character is one of
 * = + - @ (or a leading tab/CR) can execute as a formula when a CSV is opened
 * in Excel/Sheets. Prefix such cells with a single quote so they render as
 * literal text.
 *
 * NOTE: this is a CSV-only concern. SheetJS writes strings as text (type "s")
 * cells, which Excel never evaluates as formulas — prepending an apostrophe
 * there would corrupt legitimate values like "@Firewall" or "-DR", so the XLSX
 * path is intentionally left unsanitized.
 */
function sanitizeCsvCell(v: string): string {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function csvCell(v: string): string {
  return `"${sanitizeCsvCell(v).replace(/"/g, '""')}"`;
}

export function buildExportFile(
  format: ExportFormat,
  headers: string[],
  rows: string[][],
): ExportFile {
  if (format === "xlsx") {
    // XLSX string cells are not formula-evaluated by Excel, so no per-cell
    // sanitization is needed (and it would corrupt values like "@Firewall").
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Crosswalk");
    const content = XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string;
    return {
      content,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      encoding: "base64",
    };
  }

  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return { content, mimeType: "text/csv;charset=utf-8", encoding: "utf8" };
}
