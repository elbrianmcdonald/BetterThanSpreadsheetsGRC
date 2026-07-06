/**
 * Story 5.6: CSV Formatter utility for risk export
 * Handles formatting risk data into CSV format with proper escaping and formatting
 */

import { stringify } from "csv-stringify/sync";

/**
 * Risk data type for CSV export
 * Includes all fields from the Risk model and related data
 */
export interface RiskExportData {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  impactScore: number | null;
  assetCriticality: string | null;
  findingSource: string | null;
  cveId: string | null;
  discoveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  affectedSystems: string | null;
  closedAt: Date | null;
  itOwner: {
    name: string | null;
    email: string | null;
  } | null;
  businessOwner: {
    name: string | null;
    email: string | null;
  } | null;
  assignedAt: Date | null;
  assignedBy: {
    name: string | null;
  } | null;
  linkedEvidence: Array<{
    evidence: {
      controlDomains: Array<{
        controlDomain: {
          ControlDomainMappings: Array<{
            Control: {
              Framework: {
                name: string;
              };
            };
          }>;
        };
      }>;
    };
  }>;
  remediationOptions: Array<{ id: string }>;
  comments: Array<{ id: string }>;
}

/**
 * Story 5.6 AC7: Format date as ISO 8601 (YYYY-MM-DD HH:MM:SS)
 */
export function formatDateForCSV(date: Date | null): string {
  if (!date) return "";
  // AC7: Format as ISO 8601
  return date.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * Story 5.6 AC11: Calculate days to close for CLOSED risks
 * Returns empty string for non-closed risks
 */
export function calculateDaysToClose(
  status: string,
  createdAt: Date,
  closedAt: Date | null
): string {
  if (status !== "CLOSED" || !closedAt) return "";
  const diffTime = closedAt.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays.toString();
}

/**
 * Story 5.6 AC9: Get unique frameworks from linked evidence
 * Returns comma-separated list of framework names
 */
export function getFrameworksAffected(
  linkedEvidence: RiskExportData["linkedEvidence"]
): string {
  const frameworks = new Set<string>();

  for (const riskEvidence of linkedEvidence) {
    for (const controlDomain of riskEvidence.evidence.controlDomains) {
      for (const mapping of controlDomain.controlDomain.ControlDomainMappings) {
        frameworks.add(mapping.Control.Framework.name);
      }
    }
  }

  return Array.from(frameworks).join(", ");
}

/**
 * Story 5.6 AC10: Format owner information
 * Returns "Not assigned" if owner is null
 */
export function formatOwner(
  owner: { name: string | null; email: string | null } | null
): string {
  if (!owner) return "Not assigned";
  if (owner.name && owner.email) return `${owner.name} (${owner.email})`;
  if (owner.name) return owner.name;
  return owner.email ?? "Unknown";
}

/**
 * Story 5.6 AC6: CSV column headers
 */
export const CSV_HEADERS = [
  "Risk ID",
  "Title",
  "Description",
  "Severity",
  "Status",
  "Impact Score",
  "Asset Criticality",
  "Finding Source",
  "CVE ID",
  "Discovery Date",
  "Created At",
  "Affected Systems",
  "IT Owner",
  "Business Owner",
  "Assigned At",
  "Assigned By",
  "Closed At",
  "Days to Close",
  "Frameworks Affected",
  "Evidence Count",
  "Remediation Options Count",
  "Comments Count",
];

/**
 * Story 5.6 AC6-AC16: Format a single risk for CSV export
 */
export function formatRiskForCSV(risk: RiskExportData): Record<string, string | number> {
  return {
    "Risk ID": risk.id,
    "Title": risk.title,
    // AC8: Multi-line fields properly escaped (csv-stringify handles this)
    "Description": risk.description ?? "",
    "Severity": risk.severity,
    "Status": risk.status,
    // AC16: Empty cells shown as blank (not "null")
    "Impact Score": risk.impactScore ?? "",
    "Asset Criticality": risk.assetCriticality ?? "",
    "Finding Source": risk.findingSource ?? "",
    "CVE ID": risk.cveId ?? "",
    // AC7: Dates formatted as ISO 8601
    "Discovery Date": formatDateForCSV(risk.discoveryDate),
    "Created At": formatDateForCSV(risk.createdAt),
    // AC8: Multi-line affected systems properly escaped
    "Affected Systems": risk.affectedSystems ?? "",
    // AC10: Owner fields show "Not assigned" if null
    "IT Owner": formatOwner(risk.itOwner),
    "Business Owner": formatOwner(risk.businessOwner),
    "Assigned At": formatDateForCSV(risk.assignedAt),
    "Assigned By": risk.assignedBy?.name ?? "",
    "Closed At": formatDateForCSV(risk.closedAt),
    // AC11: Days to close calculated for CLOSED risks only
    "Days to Close": calculateDaysToClose(risk.status, risk.createdAt, risk.closedAt),
    // AC9: Frameworks affected as comma-separated list
    "Frameworks Affected": getFrameworksAffected(risk.linkedEvidence),
    "Evidence Count": risk.linkedEvidence.length,
    "Remediation Options Count": risk.remediationOptions.length,
    "Comments Count": risk.comments.length,
  };
}

/**
 * Story 5.6 AC15: Create footer row with total count
 */
export function createFooterRow(totalCount: number): Record<string, string | number> {
  const footer: Record<string, string | number> = {};
  CSV_HEADERS.forEach((header, index) => {
    if (index === 0) {
      footer[header] = `Total: ${totalCount} risks`;
    } else {
      footer[header] = "";
    }
  });
  return footer;
}

/**
 * Story 5.6 AC6-AC16: Format all risks for CSV export
 * AC12: Includes header row
 * AC13: Uses UTF-8 encoding (handled by stringify)
 * AC14: Uses comma delimiter, quotes fields containing commas
 * AC15: Includes total count footer row
 */
export function formatRisksForCSV(risks: RiskExportData[]): string {
  const rows = risks.map(formatRiskForCSV);

  // AC15: Add footer row with total count
  rows.push(createFooterRow(risks.length));

  // AC12: header: true includes header row with column names
  // AC14: csv-stringify automatically quotes fields containing commas
  const csv = stringify(rows, {
    header: true,
    columns: CSV_HEADERS,
  });

  return csv;
}

/**
 * Story 5.6 AC4: Generate filename with current date
 */
export function generateExportFilename(): string {
  const date = new Date().toISOString().split("T")[0];
  return `risks-export-${date}.csv`;
}

// ============================================================================
// Findings CSV Export
// ============================================================================

/**
 * Finding data type for CSV export
 */
export interface FindingExportData {
  id: string;
  identifier: string;
  title: string;
  description: string;
  source: string;
  severity: string;
  status: string;
  affectedAssets: string[];
  createdAt: Date;
  updatedAt: Date;
  creator: { name: string | null; email: string | null } | null;
  assignee: { name: string | null; email: string | null } | null;
  triager: { name: string | null } | null;
  affectedBusinessUnits: Array<{ name: string }>;
  triagedAt: Date | null;
  closedAt: Date | null;
}

/**
 * CSV column headers for findings
 */
export const FINDING_CSV_HEADERS = [
  "Finding ID",
  "Identifier",
  "Title",
  "Description",
  "Source",
  "Severity",
  "Status",
  "Affected Assets",
  "Affected Business Units",
  "Creator",
  "Assignee",
  "Created At",
  "Triaged By",
  "Triaged At",
  "Closed At",
];

/**
 * Format a single finding for CSV export
 */
export function formatFindingForCSV(finding: FindingExportData): Record<string, string | number> {
  return {
    "Finding ID": finding.id,
    "Identifier": finding.identifier,
    "Title": finding.title,
    "Description": finding.description ?? "",
    "Source": finding.source,
    "Severity": finding.severity,
    "Status": finding.status,
    "Affected Assets": finding.affectedAssets.join(", "),
    "Affected Business Units": finding.affectedBusinessUnits.map(bu => bu.name).join(", "),
    "Creator": finding.creator?.name ?? finding.creator?.email ?? "Unknown",
    "Assignee": finding.assignee?.name ?? finding.assignee?.email ?? "Unassigned",
    "Created At": formatDateForCSV(finding.createdAt),
    "Triaged By": finding.triager?.name ?? "",
    "Triaged At": formatDateForCSV(finding.triagedAt),
    "Closed At": formatDateForCSV(finding.closedAt),
  };
}

/**
 * Create footer row for findings
 */
export function createFindingFooterRow(totalCount: number): Record<string, string | number> {
  const footer: Record<string, string | number> = {};
  FINDING_CSV_HEADERS.forEach((header, index) => {
    if (index === 0) {
      footer[header] = `Total: ${totalCount} findings`;
    } else {
      footer[header] = "";
    }
  });
  return footer;
}

/**
 * Format all findings for CSV export
 */
export function formatFindingsForCSV(findings: FindingExportData[]): string {
  const rows = findings.map(formatFindingForCSV);
  rows.push(createFindingFooterRow(findings.length));

  const csv = stringify(rows, {
    header: true,
    columns: FINDING_CSV_HEADERS,
  });

  return csv;
}

/**
 * Generate filename for findings export
 */
export function generateFindingsExportFilename(): string {
  const date = new Date().toISOString().split("T")[0];
  return `findings-export-${date}.csv`;
}
