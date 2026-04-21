/**
 * PDF export for a System Contingency BIA.
 *
 * Renders the NIST SP 800-34 template structure from the saved DB record
 * and produces a print-ready PDF via Puppeteer. Chromium is baked into the
 * runner image (see Dockerfile) and pointed at via PUPPETEER_EXECUTABLE_PATH.
 */

import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import type { ContingencyImpactLevel, ContingencyBIAStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function esc(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";
}

function hours(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${n} hour${n === 1 ? "" : "s"}`;
}

function levelLabel(l: ContingencyImpactLevel): string {
  return (
    { SEVERE: "Severe", MODERATE: "Moderate", MINIMAL: "Minimal" } as const
  )[l];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const orgId = session.user.organizationId;

  const bia = await runWithOrganizationContext(orgId, () =>
    db.systemContingencyBIA.findFirst({
      where: { id, organizationId: orgId },
      include: {
        asset: { select: { identifier: true, name: true } },
        businessProcess: { select: { identifier: true, name: true } },
        processes: {
          orderBy: { sortOrder: "asc" },
          include: {
            impacts: {
              include: { category: { select: { id: true, name: true } } },
            },
          },
        },
        resources: { orderBy: { sortOrder: "asc" } },
        recoveryPriorities: { orderBy: { priority: "asc" } },
      },
    })
  );

  if (!bia) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Build category column set from what's actually referenced
  const categoryMap = new Map<string, string>();
  for (const p of bia.processes) {
    for (const imp of p.impacts) {
      categoryMap.set(imp.biaImpactCategoryId, imp.category.name);
    }
  }
  const categoryColumns = [...categoryMap.entries()].map(([id, name]) => ({
    id,
    name,
  }));

  const anchorTitle = bia.asset
    ? `${bia.asset.identifier} — ${bia.asset.name}`
    : bia.businessProcess
      ? `${bia.businessProcess.identifier} — ${bia.businessProcess.name}`
      : "Unnamed";

  const status: ContingencyBIAStatus = bia.status;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>System Contingency BIA — ${esc(anchorTitle)}</title>
<style>
  @page { size: Letter; margin: 0.75in; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 14pt; margin-top: 24pt; border-bottom: 1pt solid #333; padding-bottom: 4pt; }
  h3 { font-size: 12pt; margin-top: 18pt; }
  .meta { color: #555; font-size: 10pt; margin-bottom: 12pt; }
  .status { display: inline-block; padding: 1pt 8pt; border: 1pt solid #333; border-radius: 3pt; font-size: 9pt; font-weight: bold; margin-left: 6pt; }
  .status.FINAL { background: #d1fae5; border-color: #047857; color: #065f46; }
  .status.DRAFT { background: #fef3c7; border-color: #b45309; color: #92400e; }
  .narrative { white-space: pre-wrap; background: #f9fafb; padding: 8pt 10pt; border-left: 3pt solid #d1d5db; margin: 6pt 0; }
  .empty { color: #9ca3af; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-top: 8pt; font-size: 10pt; }
  th, td { border: 1pt solid #d1d5db; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
  .small { font-size: 9pt; color: #6b7280; }
  .footer { margin-top: 24pt; color: #6b7280; font-size: 9pt; text-align: center; }
</style>
</head>
<body>

<h1>System Contingency BIA
  <span class="status ${esc(status)}">${esc(status)}</span>
</h1>
<div class="meta">
  ${esc(org?.name ?? "Organization")} · ${bia.asset ? "Asset" : "Process"} · <strong>${esc(anchorTitle)}</strong><br/>
  Completion date: ${esc(formatDate(bia.completionDate))} ·
  Prepared: ${esc(formatDate(bia.createdAt))}
</div>

<h2>1. Overview</h2>
${
  bia.overview
    ? `<div class="narrative">${esc(bia.overview)}</div>`
    : `<p class="empty">No overview narrative.</p>`
}

<h2>2. System Description</h2>
${
  bia.systemDescription
    ? `<div class="narrative">${esc(bia.systemDescription)}</div>`
    : `<p class="empty">No system description.</p>`
}

<h2>3. BIA Data Collection</h2>

<h3>3.1 Processes and Criticality</h3>
${
  bia.processes.length === 0
    ? `<p class="empty">No processes defined.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>Process</th>
      <th>Description</th>
      <th>MTD</th>
      <th>RTO</th>
      <th>RPO</th>
    </tr>
  </thead>
  <tbody>
    ${bia.processes
      .map(
        (p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.description ?? "")}</td>
        <td>${esc(hours(p.mtdHours))}</td>
        <td>${esc(hours(p.rtoHours))}</td>
        <td>${esc(hours(p.rpoHours))}${
          p.rpoNote ? `<div class="small">(${esc(p.rpoNote)})</div>` : ""
        }</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
}

${
  categoryColumns.length > 0
    ? `
<h3>3.1.1 Outage Impacts by Category</h3>
<table>
  <thead>
    <tr>
      <th>Process</th>
      ${categoryColumns.map((c) => `<th>${esc(c.name)}</th>`).join("")}
    </tr>
  </thead>
  <tbody>
    ${bia.processes
      .map((p) => {
        const byCat = new Map(
          p.impacts.map((imp) => [imp.biaImpactCategoryId, imp.level])
        );
        return `
      <tr>
        <td>${esc(p.name)}</td>
        ${categoryColumns
          .map((c) => {
            const v = byCat.get(c.id);
            return `<td>${v ? esc(levelLabel(v)) : "—"}</td>`;
          })
          .join("")}
      </tr>`;
      })
      .join("")}
  </tbody>
</table>
`
    : ""
}

${
  bia.downtimeDrivers
    ? `
<h3>Downtime drivers</h3>
<div class="narrative">${esc(bia.downtimeDrivers)}</div>
`
    : ""
}

${
  bia.alternateMeans
    ? `
<h3>Alternate means of recovery</h3>
<div class="narrative">${esc(bia.alternateMeans)}</div>
`
    : ""
}

<h3>3.2 Resource Requirements</h3>
${
  bia.resources.length === 0
    ? `<p class="empty">No resources defined.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>System Resource / Component</th>
      <th>Platform / OS / Version</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    ${bia.resources
      .map(
        (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.platformOsVersion ?? "")}</td>
        <td>${esc(r.description ?? "")}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
}

<h3>3.3 Recovery Priorities</h3>
${
  bia.recoveryPriorities.length === 0
    ? `<p class="empty">No recovery priorities defined.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>Priority</th>
      <th>System Resource</th>
      <th>Component</th>
      <th>Recovery Time Objective</th>
      <th>Alternate Strategy</th>
    </tr>
  </thead>
  <tbody>
    ${bia.recoveryPriorities
      .map(
        (p) => `
      <tr>
        <td>${p.priority}</td>
        <td>${esc(p.resourceName)}</td>
        <td>${esc(p.component ?? "")}</td>
        <td>${esc(p.rtoDescription ?? "")}</td>
        <td>${esc(p.alternateStrategy ?? "")}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
}

${
  bia.alternateStrategies
    ? `
<h3>Alternate recovery strategies</h3>
<div class="narrative">${esc(bia.alternateStrategies)}</div>
`
    : ""
}

<div class="footer">
  Generated ${esc(new Date().toLocaleString())} by BetterThanSpreadsheetsGRC
</div>

</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" },
    });

    const filename = `contingency-bia-${bia.asset?.identifier ?? bia.businessProcess?.identifier ?? bia.id}.pdf`;

    // Copy to a standalone ArrayBuffer to satisfy strict BodyInit typing
    const body = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(body).set(new Uint8Array(pdfBytes));

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
