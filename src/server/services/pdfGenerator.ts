/**
 * Story 5.7: PDF Evidence Package Generator
 * Generates PDF evidence packages for compliance audits using Puppeteer
 */

import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";

/**
 * Data structure for evidence package PDF generation
 */
export interface EvidencePackageData {
  frameworkName: string;
  frameworkCode: string;
  organizationName: string;
  exportDate: string;
  totalControls: number;
  controlsWithEvidence: number;
  coveragePercentage: string;
  controls: ControlSection[];
  auditEntries: AuditEntry[];
}

export interface ControlSection {
  controlId: string;
  controlName: string;
  controlDescription: string | null;
  hasEvidence: boolean;
  evidenceCount: number;
  evidence: EvidenceEntry[];
}

export interface EvidenceEntry {
  filename: string;
  uploadedBy: string;
  uploadDate: string;
  evidenceType: string;
  description: string | null;
  tags: string[];
}

export interface AuditEntry {
  date: string;
  user: string;
  action: string;
  details: string;
}

/**
 * Story 5.7 AC7: Format date for PDF display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Story 5.7 AC7: Format datetime for audit trail
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Story 5.7: Render HTML template with data
 * Uses simple string replacement for Handlebars-like syntax
 */
function renderTemplate(
  template: string,
  data: EvidencePackageData
): string {
  let html = template;

  // Replace simple variables
  html = html.replace(/\{\{frameworkName\}\}/g, escapeHtml(data.frameworkName));
  html = html.replace(/\{\{organizationName\}\}/g, escapeHtml(data.organizationName));
  html = html.replace(/\{\{exportDate\}\}/g, escapeHtml(data.exportDate));
  html = html.replace(/\{\{totalControls\}\}/g, String(data.totalControls));
  html = html.replace(/\{\{controlsWithEvidence\}\}/g, String(data.controlsWithEvidence));
  html = html.replace(/\{\{coveragePercentage\}\}/g, data.coveragePercentage);

  // Render controls section
  const controlsHtml = renderControlsSections(data.controls);
  html = html.replace(
    /\{\{#each controls\}\}[\s\S]*?\{\{\/each\}\}/g,
    controlsHtml
  );

  // Render table of contents
  const tocHtml = renderTableOfContents(data.controls);
  // Find and replace the TOC section
  const tocPattern = /\{\{#each controls\}\}[\s\S]*?class="toc-item[\s\S]*?\{\{\/each\}\}/;
  html = html.replace(tocPattern, tocHtml);

  // Render audit entries
  const auditHtml = renderAuditEntries(data.auditEntries);
  html = html.replace(
    /\{\{#each auditEntries\}\}[\s\S]*?\{\{\/each\}\}/g,
    auditHtml
  );

  // Handle conditional audit entries
  if (data.auditEntries.length === 0) {
    html = html.replace(
      /\{\{#if auditEntries\.length\}\}[\s\S]*?\{\{else\}\}/g,
      ""
    );
    html = html.replace(
      /\{\{\/if\}\}/g,
      ""
    );
  } else {
    html = html.replace(/\{\{#if auditEntries\.length\}\}/g, "");
    html = html.replace(/\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, "");
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTableOfContents(controls: ControlSection[]): string {
  return controls
    .map(
      (control) => `
    <div class="toc-item ${control.hasEvidence ? "has-evidence" : "no-evidence"}">
      <span class="control-id">${escapeHtml(control.controlId)}</span>
      <span class="control-name">${escapeHtml(control.controlName)}</span>
      <span class="evidence-count">${control.evidenceCount} evidence</span>
    </div>
  `
    )
    .join("\n");
}

function renderControlsSections(controls: ControlSection[]): string {
  return controls
    .map(
      (control, index) => `
    <div class="control-section ${index > 0 && index % 3 === 0 ? "page-break" : ""}">
      <h2><span class="control-id">${escapeHtml(control.controlId)}</span> - ${escapeHtml(control.controlName)}</h2>

      ${
        control.controlDescription
          ? `<div class="control-description">${escapeHtml(control.controlDescription)}</div>`
          : ""
      }

      <div class="evidence-list">
        ${
          control.hasEvidence
            ? `
          <h4>Evidence Files (${control.evidenceCount})</h4>
          <div class="evidence-grid">
            ${control.evidence
              .map(
                (ev) => `
              <div class="evidence-item">
                <div class="filename">${escapeHtml(ev.filename)}</div>
                <div class="meta">
                  <div class="meta-row">
                    <span class="meta-label">Uploaded by:</span>
                    <span>${escapeHtml(ev.uploadedBy)}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-label">Upload date:</span>
                    <span>${escapeHtml(ev.uploadDate)}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-label">Type:</span>
                    <span>${escapeHtml(ev.evidenceType)}</span>
                  </div>
                  ${
                    ev.description
                      ? `
                  <div class="meta-row">
                    <span class="meta-label">Description:</span>
                    <span>${escapeHtml(ev.description)}</span>
                  </div>
                  `
                      : ""
                  }
                </div>
                ${
                  ev.tags.length > 0
                    ? `
                <div class="tags">
                  ${ev.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
                `
                    : ""
                }
              </div>
            `
              )
              .join("")}
          </div>
        `
            : `
          <div class="no-evidence-message">
            No evidence provided for this control
          </div>
        `
        }
      </div>
    </div>
  `
    )
    .join("\n");
}

function renderAuditEntries(entries: AuditEntry[]): string {
  return entries
    .map(
      (entry) => `
    <tr>
      <td class="date-col">${escapeHtml(entry.date)}</td>
      <td class="user-col">${escapeHtml(entry.user)}</td>
      <td class="action-col">${escapeHtml(entry.action)}</td>
      <td>${escapeHtml(entry.details)}</td>
    </tr>
  `
    )
    .join("\n");
}

/**
 * Story 5.7 AC2-AC9: Fetch framework data with evidence for PDF generation
 */
export async function fetchEvidencePackageData(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<EvidencePackageData> {
  // Get framework with controls
  const framework = await db.framework.findFirst({
    where: {
      id: frameworkId,
      organizationId,
    },
    include: {
      Organization: true,
      Control: {
        where: { isActive: true },
        orderBy: { controlId: "asc" },
      },
    },
  });

  if (!framework) {
    throw new Error(`Framework not found: ${frameworkId}`);
  }

  // Get all control domain mappings for this framework
  const controlMappings = await db.controlDomainMapping.findMany({
    where: {
      frameworkCode: framework.code,
    },
    select: {
      controlId: true,
      controlDomainId: true,
    },
  });

  // Create a map of framework controlId -> controlDomainIds
  const controlToDomains = new Map<string, string[]>();
  for (const mapping of controlMappings) {
    const existing = controlToDomains.get(mapping.controlId) || [];
    existing.push(mapping.controlDomainId);
    controlToDomains.set(mapping.controlId, existing);
  }

  // Get all evidence with control domain tags for this organization
  const evidence = await db.evidence.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      User: {
        select: { name: true, email: true },
      },
      EvidenceControlDomain: {
        include: {
          ControlDomain: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // Create a map of controlDomainId -> evidence
  const domainToEvidence = new Map<string, typeof evidence>();
  for (const ev of evidence) {
    for (const ecd of ev.EvidenceControlDomain) {
      const existing = domainToEvidence.get(ecd.controlDomainId) || [];
      existing.push(ev);
      domainToEvidence.set(ecd.controlDomainId, existing);
    }
  }

  // Build control sections with evidence
  const controls: ControlSection[] = [];
  let controlsWithEvidence = 0;

  for (const control of framework.Control) {
    // Get all evidence for this control via control domain mappings
    const controlDomainIds = controlToDomains.get(control.controlId) || [];
    const evidenceSet = new Set<string>();
    const controlEvidence: typeof evidence = [];

    for (const domainId of controlDomainIds) {
      const domainEvidence = domainToEvidence.get(domainId) || [];
      for (const ev of domainEvidence) {
        if (!evidenceSet.has(ev.id)) {
          evidenceSet.add(ev.id);
          controlEvidence.push(ev);
        }
      }
    }

    const hasEvidence = controlEvidence.length > 0;
    if (hasEvidence) {
      controlsWithEvidence++;
    }

    controls.push({
      controlId: control.controlId,
      controlName: control.title,
      controlDescription: control.description,
      hasEvidence,
      evidenceCount: controlEvidence.length,
      evidence: controlEvidence.map((ev) => ({
        filename: ev.originalFileName,
        uploadedBy: ev.User.name || ev.User.email || "Unknown",
        uploadDate: formatDate(ev.createdAt),
        evidenceType: ev.fileType,
        description: ev.description,
        tags: ev.EvidenceControlDomain.map((ecd) => ecd.ControlDomain.name),
      })),
    });
  }

  // Story 5.7 AC13-AC16: Get audit trail for evidence uploads related to this framework
  // Find evidence IDs that are linked to this framework's control domains
  const frameworkControlDomainIds = Array.from(
    new Set(controlMappings.map((m) => m.controlDomainId))
  );

  const auditLogs = await db.auditLog.findMany({
    where: {
      organizationId,
      action: {
        in: ["UPLOAD_EVIDENCE", "TAG_EVIDENCE", "REPLACE_EVIDENCE_FILE"],
      },
    },
    orderBy: { timestamp: "asc" }, // AC16: oldest first
    take: 100, // Limit audit entries for PDF size
    include: {
      User: {
        select: { name: true, email: true },
      },
    },
  });

  const auditEntries: AuditEntry[] = auditLogs.map((log) => {
    const userName = log.actorName || log.User?.name || log.User?.email || "Unknown";
    const changes = log.changes as Record<string, unknown> | null;

    let action = "Updated evidence";
    let details = "";

    switch (log.action) {
      case "UPLOAD_EVIDENCE":
        action = "Uploaded evidence";
        details = changes?.after
          ? `File: ${(changes.after as Record<string, unknown>)?.filename || "unknown"}`
          : "";
        break;
      case "TAG_EVIDENCE":
        action = "Tagged evidence";
        details = "Updated control domain tags";
        break;
      case "REPLACE_EVIDENCE_FILE":
        action = "Replaced file";
        details = changes?.after
          ? `New version: ${(changes.after as Record<string, unknown>)?.filename || "unknown"}`
          : "";
        break;
    }

    return {
      date: formatDateTime(log.timestamp),
      user: userName,
      action,
      details,
    };
  });

  const totalControls = framework.Control.length;
  const coveragePercentage =
    totalControls > 0
      ? ((controlsWithEvidence / totalControls) * 100).toFixed(1)
      : "0.0";

  return {
    frameworkName: framework.name,
    frameworkCode: framework.code,
    organizationName: framework.Organization.name,
    exportDate: formatDate(new Date()),
    totalControls,
    controlsWithEvidence,
    coveragePercentage,
    controls,
    auditEntries,
  };
}

/**
 * Story 5.7 AC22-AC26: Generate PDF using Puppeteer
 */
export async function generateEvidencePackagePDF(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<{ buffer: Buffer; filename: string }> {
  // Fetch data
  const data = await fetchEvidencePackageData(frameworkId, organizationId, db);

  // Read HTML template
  const templatePath = path.join(
    process.cwd(),
    "src",
    "server",
    "pdf",
    "templates",
    "evidencePackage.html"
  );
  const template = await fs.readFile(templatePath, "utf-8");

  // Render HTML with data
  const html = renderTemplate(template, data);

  // Generate PDF with Puppeteer
  // Use environment variable for Chromium path (set in Docker container)
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // AC17-AC21: PDF styling and format
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "25mm",
        left: "15mm",
        right: "15mm",
      },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width: 100%; font-size: 9pt; padding: 0 15mm; display: flex; justify-content: space-between; color: #666;">
          <span>Evidence Package - ${escapeHtml(data.frameworkName)}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span>Generated: ${escapeHtml(data.exportDate)}</span>
        </div>
      `,
    });

    // AC4: Generate filename
    const dateStr = new Date().toISOString().split("T")[0];
    const sanitizedCode = data.frameworkCode.replace(/[^a-zA-Z0-9-_]/g, "-");
    const filename = `evidence-package-${sanitizedCode}-${dateStr}.pdf`;

    return {
      buffer: Buffer.from(pdfBuffer),
      filename,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Story 5.7 AC4: Generate export filename
 */
export function generatePDFFilename(frameworkCode: string): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const sanitizedCode = frameworkCode.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `evidence-package-${sanitizedCode}-${dateStr}.pdf`;
}
