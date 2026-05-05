/**
 * Minimal RFC 4180–ish CSV parser. Handles quoted fields, embedded commas,
 * embedded newlines, and "" → ". No external dependency for a 5-column file.
 */

export type CsvRow = Record<string, string>;

export interface ParsedCsv {
  rows: CsvRow[];
  headers: string[];
  errors: string[];
}

export function parseCsv(text: string): ParsedCsv {
  const errors: string[] = [];
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Treat CRLF as one terminator
      i++;
      if (text[i] === "\n") i++;
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  if (records.length === 0) {
    return { rows: [], headers: [], errors: ["CSV is empty"] };
  }

  const headers = records[0]!.map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r]!;
    if (rec.length === 1 && rec[0]!.trim() === "") continue; // skip blank lines
    const obj: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = (rec[c] ?? "").trim();
    }
    rows.push(obj);
  }

  return { rows, headers, errors };
}

export const REQUIRED_HEADERS = ["section", "number", "question", "framework_ref"] as const;
