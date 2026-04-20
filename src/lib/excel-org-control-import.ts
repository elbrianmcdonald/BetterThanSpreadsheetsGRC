/**
 * Excel parser + template generator for bulk OrganizationalControl import.
 *
 * Mirrors the required fields in OrgControlForm (name, controlType, status);
 * every other field is optional. Errors are atomic: any row error causes the
 * whole import to be rejected at commit time.
 */

import * as XLSX from "xlsx";
import {
  ControlType,
  ControlNature,
  OrgControlStatus,
  ControlFrequency,
} from "@prisma/client";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 1000;

export interface OrgControlImportRow {
  localControlId?: string;
  name: string;
  description?: string;
  objective?: string;
  family?: string;
  controlType: ControlType;
  nature?: ControlNature;
  status: OrgControlStatus;
  implementationNarrative?: string;
  scope?: string;
  frequency?: ControlFrequency;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ParseResult {
  success: boolean;
  rows: OrgControlImportRow[];
  errors: RowError[];
  totalRows: number;
}

const HEADER_MAP: Record<string, keyof OrgControlImportRow> = {
  localcontrolid: "localControlId",
  "local control id": "localControlId",
  "control id": "localControlId",
  id: "localControlId",
  name: "name",
  title: "name",
  description: "description",
  objective: "objective",
  family: "family",
  controltype: "controlType",
  "control type": "controlType",
  type: "controlType",
  nature: "nature",
  status: "status",
  implementationnarrative: "implementationNarrative",
  "implementation narrative": "implementationNarrative",
  narrative: "implementationNarrative",
  scope: "scope",
  frequency: "frequency",
  cadence: "frequency",
};

function normalizeEnum<T extends string>(
  raw: string,
  allowed: readonly T[]
): T | null {
  const candidate = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : null;
}

const CONTROL_TYPES = Object.values(ControlType);
const CONTROL_NATURES = Object.values(ControlNature);
const ORG_CONTROL_STATUSES = Object.values(OrgControlStatus);
const CONTROL_FREQUENCIES = Object.values(ControlFrequency);

export function parseOrgControlsExcel(base64Content: string): ParseResult {
  const empty: ParseResult = { success: false, rows: [], errors: [], totalRows: 0 };

  let workbook: XLSX.WorkBook;
  try {
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    workbook = XLSX.read(bytes, { type: "array" });
  } catch (err) {
    return {
      ...empty,
      errors: [
        {
          row: 0,
          field: "file",
          message: `Could not read file: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      ],
    };
  }

  const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() !== "enum values")
    ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { ...empty, errors: [{ row: 0, field: "file", message: "No sheets in file" }] };
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { ...empty, errors: [{ row: 0, field: "file", message: "Could not read worksheet" }] };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    return { ...empty, errors: [{ row: 0, field: "file", message: "No data rows found" }] };
  }
  if (rawRows.length > MAX_UPLOAD_ROWS) {
    return {
      ...empty,
      totalRows: rawRows.length,
      errors: [
        {
          row: 0,
          field: "file",
          message: `File has ${rawRows.length} rows, max is ${MAX_UPLOAD_ROWS}`,
        },
      ],
    };
  }

  const firstRow = rawRows[0]!;
  const headerMap = new Map<string, keyof OrgControlImportRow>();
  for (const key of Object.keys(firstRow)) {
    const normKey = key.toLowerCase().trim();
    const field = HEADER_MAP[normKey];
    if (field) headerMap.set(key, field);
  }

  const seenFields = new Set(headerMap.values());
  const missing: string[] = [];
  if (!seenFields.has("name")) missing.push("name");
  if (!seenFields.has("controlType")) missing.push("controlType");
  if (!seenFields.has("status")) missing.push("status");
  if (missing.length) {
    return {
      ...empty,
      totalRows: rawRows.length,
      errors: [
        {
          row: 0,
          field: "header",
          message: `Missing required columns: ${missing.join(", ")}`,
        },
      ],
    };
  }

  const rows: OrgControlImportRow[] = [];
  const errors: RowError[] = [];
  const seenNames = new Map<string, number>();
  const seenLocalIds = new Map<string, number>();

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]!;
    const rowNum = i + 2; // +1 for 1-based, +1 to account for header

    const draft: Partial<OrgControlImportRow> = {};

    for (const [originalKey, field] of headerMap) {
      const value = String(raw[originalKey] ?? "").trim();
      if (!value) continue;

      switch (field) {
        case "localControlId":
          if (value.length > 50) {
            errors.push({ row: rowNum, field, message: `Must be ≤50 chars (got ${value.length})` });
          } else {
            draft.localControlId = value;
          }
          break;
        case "name":
          if (value.length > 200) {
            errors.push({ row: rowNum, field, message: `Must be ≤200 chars (got ${value.length})` });
          } else {
            draft.name = value;
          }
          break;
        case "description":
          if (value.length > 5000) {
            errors.push({ row: rowNum, field, message: `Must be ≤5000 chars` });
          } else {
            draft.description = value;
          }
          break;
        case "objective":
          if (value.length > 5000) {
            errors.push({ row: rowNum, field, message: `Must be ≤5000 chars` });
          } else {
            draft.objective = value;
          }
          break;
        case "family":
          if (value.length > 100) {
            errors.push({ row: rowNum, field, message: `Must be ≤100 chars` });
          } else {
            draft.family = value;
          }
          break;
        case "controlType": {
          const v = normalizeEnum(value, CONTROL_TYPES);
          if (!v) {
            errors.push({
              row: rowNum,
              field,
              message: `Must be one of: ${CONTROL_TYPES.join(", ")} (got "${value}")`,
            });
          } else {
            draft.controlType = v;
          }
          break;
        }
        case "nature": {
          const v = normalizeEnum(value, CONTROL_NATURES);
          if (!v) {
            errors.push({
              row: rowNum,
              field,
              message: `Must be one of: ${CONTROL_NATURES.join(", ")} (got "${value}")`,
            });
          } else {
            draft.nature = v;
          }
          break;
        }
        case "status": {
          const v = normalizeEnum(value, ORG_CONTROL_STATUSES);
          if (!v) {
            errors.push({
              row: rowNum,
              field,
              message: `Must be one of: ${ORG_CONTROL_STATUSES.join(", ")} (got "${value}")`,
            });
          } else {
            draft.status = v;
          }
          break;
        }
        case "implementationNarrative":
          if (value.length > 10000) {
            errors.push({ row: rowNum, field, message: `Must be ≤10000 chars` });
          } else {
            draft.implementationNarrative = value;
          }
          break;
        case "scope":
          if (value.length > 5000) {
            errors.push({ row: rowNum, field, message: `Must be ≤5000 chars` });
          } else {
            draft.scope = value;
          }
          break;
        case "frequency": {
          const v = normalizeEnum(value, CONTROL_FREQUENCIES);
          if (!v) {
            errors.push({
              row: rowNum,
              field,
              message: `Must be one of: ${CONTROL_FREQUENCIES.join(", ")} (got "${value}")`,
            });
          } else {
            draft.frequency = v;
          }
          break;
        }
      }
    }

    if (!draft.name) {
      errors.push({ row: rowNum, field: "name", message: "Name is required" });
    } else {
      const key = draft.name.toLowerCase();
      const prev = seenNames.get(key);
      if (prev !== undefined) {
        errors.push({
          row: rowNum,
          field: "name",
          message: `Duplicate name (first seen on row ${prev})`,
        });
      } else {
        seenNames.set(key, rowNum);
      }
    }

    if (!draft.controlType) {
      errors.push({ row: rowNum, field: "controlType", message: "Control type is required" });
    }

    if (!draft.status) {
      errors.push({ row: rowNum, field: "status", message: "Status is required" });
    }

    if (draft.localControlId) {
      const key = draft.localControlId.toLowerCase();
      const prev = seenLocalIds.get(key);
      if (prev !== undefined) {
        errors.push({
          row: rowNum,
          field: "localControlId",
          message: `Duplicate local ID (first seen on row ${prev})`,
        });
      } else {
        seenLocalIds.set(key, rowNum);
      }
    }

    if (draft.name && draft.controlType && draft.status) {
      rows.push(draft as OrgControlImportRow);
    }
  }

  return {
    success: errors.length === 0,
    rows: errors.length === 0 ? rows : [],
    errors,
    totalRows: rawRows.length,
  };
}

export function generateOrgControlTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const sample = [
    {
      "Local Control ID": "AC-001",
      Name: "MFA on Admin Accounts",
      Description: "Require multi-factor authentication for all administrative accounts.",
      Objective: "Prevent unauthorized access to privileged systems.",
      Family: "Access Control",
      "Control Type": "PREVENTIVE",
      Nature: "TECHNICAL",
      Status: "IMPLEMENTED",
      "Implementation Narrative": "Okta enforces MFA for all users in the Admins group.",
      Scope: "All production AWS accounts; GitHub Enterprise org.",
      Frequency: "CONTINUOUS",
    },
    {
      "Local Control ID": "AU-002",
      Name: "Centralized Audit Logging",
      Description: "Collect and retain audit logs from all production systems.",
      Objective: "Detect unauthorized activity; support forensic investigation.",
      Family: "Audit",
      "Control Type": "DETECTIVE",
      Nature: "TECHNICAL",
      Status: "PARTIALLY_IMPLEMENTED",
      "Implementation Narrative": "CloudTrail + Datadog; endpoint logs still in rollout.",
      Scope: "Production AWS; half of EC2 fleet.",
      Frequency: "CONTINUOUS",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 40 },
    { wch: 32 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 40 },
    { wch: 30 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Controls");

  const enumRows: Record<string, string>[] = [];
  const maxLen = Math.max(
    CONTROL_TYPES.length,
    CONTROL_NATURES.length,
    ORG_CONTROL_STATUSES.length,
    CONTROL_FREQUENCIES.length
  );
  for (let i = 0; i < maxLen; i++) {
    enumRows.push({
      "Control Type": CONTROL_TYPES[i] ?? "",
      Nature: CONTROL_NATURES[i] ?? "",
      Status: ORG_CONTROL_STATUSES[i] ?? "",
      Frequency: CONTROL_FREQUENCIES[i] ?? "",
    });
  }
  const enumSheet = XLSX.utils.json_to_sheet(enumRows);
  enumSheet["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, enumSheet, "Enum Values");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  // Copy into a fresh ArrayBuffer to drop any SharedArrayBuffer typing
  const fresh = new ArrayBuffer(out.byteLength);
  new Uint8Array(fresh).set(new Uint8Array(out));
  return fresh;
}

export function validateExcelFile(fileName: string, fileSize: number): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext !== "xlsx") return "Please upload an .xlsx file";
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const mb = (MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return `File must be under ${mb} MB`;
  }
  return null;
}
