/**
 * Framework Import Column Mapping (Story 24.2)
 *
 * Canonical control fields and a pure helper that suggests a column-index
 * mapping from a file's raw headers (as produced by framework-import-parser).
 *
 * PURE + Prisma-free so it unit-tests without a DB. Mapping is by column INDEX,
 * not header string, because the parser renames/dedupes headers (Story 24.1),
 * making header strings unstable identifiers.
 *
 * @module framework-import-mapping
 */

/**
 * The canonical control fields a user maps their columns onto.
 * controlId + title are required; the rest are optional.
 */
export const CANONICAL_FIELDS = [
  { key: "controlId", label: "Control ID", required: true },
  { key: "title", label: "Title", required: true },
  { key: "description", label: "Description", required: false },
  { key: "family", label: "Family / Domain", required: false },
  { key: "parentControlId", label: "Parent Control ID", required: false },
] as const;

export type CanonicalFieldKey = (typeof CANONICAL_FIELDS)[number]["key"];

/**
 * Mapping from each canonical field to a source column index (or null if unmapped)
 */
export type ColumnMapping = Record<CanonicalFieldKey, number | null>;

/**
 * Case-insensitive header aliases per canonical field. First matching header
 * (by column order) wins; a column already claimed by an earlier field is not
 * reused. Modeled on excel-parser.ts COLUMN_MAPPINGS / excel-org-control-import
 * HEADER_MAP.
 */
const FIELD_ALIASES: Record<CanonicalFieldKey, string[]> = {
  controlId: ["control id", "controlid", "code", "id", "ref", "ref#", "identifier", "control"],
  title: ["title", "name", "control name", "control title"],
  description: ["description", "desc", "details", "detail", "text", "statement"],
  family: ["family", "domain", "group", "category", "control family"],
  parentControlId: [
    "parent control id",
    "parentcontrolid",
    "parent id",
    "parentid",
    "parent",
  ],
};

/**
 * A control extracted from a file row via the column mapping.
 * Optional fields are undefined when their column is unmapped or blank.
 */
export interface ImportedControl {
  controlId: string;
  title: string;
  description?: string;
  family?: string;
  parentControlId?: string;
}

/** A row-level validation error (1-based row number, excluding the header) */
export interface ImportRowError {
  row: number;
  message: string;
}

/**
 * Extract controls from parsed rows using a column mapping, validating as it goes.
 *
 * PURE + Prisma-free (no DB ids resolved here). The caller blocks the commit if
 * `errors` is non-empty. Row numbers are 1-based, excluding the header row.
 *
 * Validations:
 * - required controlId / title blank → row error
 * - duplicate controlId within the file → row error citing the first-seen row
 * - parentControlId referencing a controlId not present in the file → row error
 *
 * @param rows - Parsed data rows (from framework-import-parser)
 * @param mapping - Canonical field → column index (or null)
 */
export function buildControlsFromMapping(
  rows: string[][],
  mapping: ColumnMapping,
): { controls: ImportedControl[]; errors: ImportRowError[] } {
  const controls: ImportedControl[] = [];
  const errors: ImportRowError[] = [];
  const seenIds = new Map<string, number>(); // controlId → first-seen 1-based row

  const cell = (row: string[], columnIndex: number | null): string =>
    columnIndex === null ? "" : String(row[columnIndex] ?? "").trim();

  // First collect the set of all control IDs so parent refs can be validated.
  const allControlIds = new Set<string>();
  for (const row of rows) {
    const id = cell(row, mapping.controlId);
    if (id) allControlIds.add(id);
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 1; // 1-based, header excluded
    const controlId = cell(row, mapping.controlId);
    const title = cell(row, mapping.title);
    const description = cell(row, mapping.description);
    const family = cell(row, mapping.family);
    const parentControlId = cell(row, mapping.parentControlId);

    if (!controlId) {
      errors.push({ row: rowNumber, message: "Control ID is required but is blank" });
    } else {
      const firstSeen = seenIds.get(controlId);
      if (firstSeen !== undefined) {
        errors.push({
          row: rowNumber,
          message: `Duplicate Control ID "${controlId}" (first seen in row ${firstSeen})`,
        });
      } else {
        seenIds.set(controlId, rowNumber);
      }
    }

    if (!title) {
      errors.push({ row: rowNumber, message: "Title is required but is blank" });
    }

    if (parentControlId) {
      if (parentControlId === controlId) {
        errors.push({
          row: rowNumber,
          message: `Control "${controlId}" cannot be its own parent`,
        });
      } else if (!allControlIds.has(parentControlId)) {
        errors.push({
          row: rowNumber,
          message: `Parent Control ID "${parentControlId}" does not match any Control ID in the file`,
        });
      }
    }

    // Extract even rows with errors — the caller blocks on errors.length, and
    // this keeps downstream shape stable for tests/inspection.
    if (controlId && title) {
      controls.push({
        controlId,
        title,
        description: description || undefined,
        family: family || undefined,
        parentControlId: parentControlId || undefined,
      });
    }
  });

  return { controls, errors };
}

/** Build an empty mapping with every canonical field set to null */
function emptyMapping(): ColumnMapping {
  return CANONICAL_FIELDS.reduce((acc, field) => {
    acc[field.key] = null;
    return acc;
  }, {} as ColumnMapping);
}

/**
 * Suggest a canonical-field → column-index mapping from raw headers.
 *
 * - Case-insensitive, trims surrounding whitespace.
 * - First header that aliases to a field wins that field.
 * - A column index is never assigned to more than one field (first field to
 *   claim it, in CANONICAL_FIELDS order, keeps it).
 * - Unmatched fields remain null.
 *
 * @param headers - Raw header strings from the parsed file
 * @returns ColumnMapping keyed by every canonical field
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const claimedColumns = new Set<number>();

  for (const field of CANONICAL_FIELDS) {
    const aliases = FIELD_ALIASES[field.key];
    const columnIndex = normalized.findIndex(
      (header, index) => !claimedColumns.has(index) && aliases.includes(header),
    );
    if (columnIndex !== -1) {
      mapping[field.key] = columnIndex;
      claimedColumns.add(columnIndex);
    }
  }

  return mapping;
}
