/**
 * Risk CSV import parsing + validation (pure, client-safe).
 *
 * Round-trips the export produced by `formatRisksForCSV` (see csvFormatter.ts):
 * a user can export risks, edit the CSV, and re-import. Only the meaningful,
 * user-editable columns are consumed on import — derived/read-only columns
 * (counts, "Days to Close", "Created At", identifiers, framework rollups) are
 * ignored. The export's trailing "Total: N risks" footer row is skipped.
 */

export type ImportSeverity = "HIGH" | "MEDIUM" | "LOW";

const SEVERITIES: readonly ImportSeverity[] = ["HIGH", "MEDIUM", "LOW"];
const FINDING_SOURCES = [
  "VULNERABILITY_SCAN",
  "PENETRATION_TEST",
  "AUDIT_FINDING",
  "SECURITY_REVIEW",
  "COMPLIANCE_ASSESSMENT",
  "OTHER",
] as const;
const ASSET_CRITICALITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;

export interface RiskImportRow {
  title: string;
  description: string;
  severity: ImportSeverity;
  affectedSystems?: string;
  cveId?: string;
  findingSource?: (typeof FINDING_SOURCES)[number];
  assetCriticality?: (typeof ASSET_CRITICALITIES)[number];
  /** ISO date string (YYYY-MM-DD) when the CSV supplied a parseable date. */
  discoveryDate?: string;
}

export interface RiskImportRowError {
  /** 1-based line in the source CSV (header is line 1). */
  line: number;
  message: string;
}

export interface RiskImportParseResult {
  rows: RiskImportRow[];
  errors: RiskImportRowError[];
}

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields, embedded commas and
 * newlines, and doubled ("") quote escapes. Returns an array of rows, each an
 * array of cell strings. No dependency (the repo ships csv-stringify but not a
 * parser).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawAny = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    sawAny = true;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore; the \n handles the row break
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the final field/row when the text doesn't end in a newline.
  if (field.length > 0 || row.length > 0 || (sawAny && rows.length === 0)) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Normalize a header cell for matching (case-insensitive, trimmed). */
function normHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** True for the export footer row, e.g. ["Total: 12 risks", "", ...]. */
function isFooterRow(cells: string[]): boolean {
  return /^total:/i.test((cells[0] ?? "").trim());
}

/**
 * Parse a risk-export CSV into typed, validated import rows plus per-row errors.
 * Required columns: Title, Description, Severity. Everything else is optional;
 * a supplied-but-invalid optional value yields a row error rather than being
 * silently dropped.
 */
export function parseRiskImportCsv(text: string): RiskImportParseResult {
  const grid = parseCsv(text);
  const rows: RiskImportRow[] = [];
  const errors: RiskImportRowError[] = [];

  if (grid.length === 0) {
    return { rows, errors: [{ line: 1, message: "The file is empty." }] };
  }

  const header = grid[0]!.map(normHeader);
  const col = (name: string) => header.indexOf(normHeader(name));
  const titleIdx = col("Title");
  const descIdx = col("Description");
  const sevIdx = col("Severity");

  const missing: string[] = [];
  if (titleIdx < 0) missing.push("Title");
  if (descIdx < 0) missing.push("Description");
  if (sevIdx < 0) missing.push("Severity");
  if (missing.length > 0) {
    return {
      rows,
      errors: [
        {
          line: 1,
          message: `Missing required column(s): ${missing.join(", ")}. Expected the risk export format.`,
        },
      ],
    };
  }

  const affIdx = col("Affected Systems");
  const cveIdx = col("CVE ID");
  const srcIdx = col("Finding Source");
  const acIdx = col("Asset Criticality");
  const discIdx = col("Discovery Date");

  const at = (cells: string[], idx: number) =>
    idx >= 0 ? (cells[idx] ?? "").trim() : "";

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    const line = r + 1;
    // Skip the export's total footer and any fully blank line.
    if (isFooterRow(cells)) continue;
    if (cells.every((c) => c.trim() === "")) continue;

    const title = at(cells, titleIdx);
    const description = at(cells, descIdx);
    const severityRaw = at(cells, sevIdx).toUpperCase();

    const rowErrors: string[] = [];
    if (!title) rowErrors.push("Title is required");
    if (!description) rowErrors.push("Description is required");
    if (!severityRaw) {
      rowErrors.push("Severity is required");
    } else if (!SEVERITIES.includes(severityRaw as ImportSeverity)) {
      rowErrors.push(`Severity must be one of ${SEVERITIES.join(", ")} (got "${at(cells, sevIdx)}")`);
    }

    const row: RiskImportRow = {
      title,
      description,
      severity: severityRaw as ImportSeverity,
    };

    const affected = at(cells, affIdx);
    if (affected) row.affectedSystems = affected;

    const cve = at(cells, cveIdx);
    if (cve) row.cveId = cve.slice(0, 50);

    const src = at(cells, srcIdx).toUpperCase().replace(/\s+/g, "_");
    if (src) {
      if ((FINDING_SOURCES as readonly string[]).includes(src)) {
        row.findingSource = src as RiskImportRow["findingSource"];
      } else {
        rowErrors.push(`Finding Source "${at(cells, srcIdx)}" is not recognized`);
      }
    }

    const ac = at(cells, acIdx).toUpperCase();
    if (ac) {
      if ((ASSET_CRITICALITIES as readonly string[]).includes(ac)) {
        row.assetCriticality = ac as RiskImportRow["assetCriticality"];
      } else {
        rowErrors.push(`Asset Criticality "${at(cells, acIdx)}" is not recognized`);
      }
    }

    const disc = at(cells, discIdx);
    if (disc) {
      const d = new Date(disc);
      if (isNaN(d.getTime())) {
        rowErrors.push(`Discovery Date "${disc}" is not a valid date`);
      } else {
        row.discoveryDate = d.toISOString();
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ line, message: `${title || "(untitled)"} — ${rowErrors.join("; ")}` });
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}
