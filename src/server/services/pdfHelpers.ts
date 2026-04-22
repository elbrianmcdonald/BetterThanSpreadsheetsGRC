/**
 * Shared helpers for assessment PDF export routes.
 *
 * Each assessment type (compliance / maturity / risk / BIA) renders its own
 * HTML string and calls renderPdf() to turn it into a PDF via the Chromium
 * baked into the runner image. The CSS block and esc/format helpers are
 * shared so the documents look consistent.
 */

import puppeteer, { type PaperFormat } from "puppeteer";

export function esc(text: string | null | undefined): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Base CSS for assessment PDFs. Letter size, Segoe UI, compact tables.
 */
export const BASE_PDF_CSS = `
@page { size: Letter; margin: 0.75in; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }
h1 { font-size: 20pt; margin: 0 0 4pt; }
h2 { font-size: 14pt; margin-top: 22pt; border-bottom: 1pt solid #333; padding-bottom: 4pt; }
h3 { font-size: 12pt; margin-top: 16pt; }
.meta { color: #555; font-size: 10pt; margin-bottom: 12pt; }
.badge { display: inline-block; padding: 1pt 8pt; border: 1pt solid #333; border-radius: 3pt; font-size: 9pt; font-weight: bold; }
.badge.draft     { background: #fef3c7; border-color: #b45309; color: #92400e; }
.badge.final     { background: #d1fae5; border-color: #047857; color: #065f46; }
.badge.in_progress { background: #dbeafe; border-color: #1d4ed8; color: #1e3a8a; }
.badge.completed { background: #d1fae5; border-color: #047857; color: #065f46; }
.badge.archived  { background: #f3f4f6; border-color: #6b7280; color: #374151; }
.badge.high      { background: #fee2e2; border-color: #b91c1c; color: #7f1d1d; }
.badge.medium    { background: #fef3c7; border-color: #b45309; color: #92400e; }
.badge.low       { background: #dbeafe; border-color: #1d4ed8; color: #1e3a8a; }
.badge.new       { background: #dbeafe; border-color: #1d4ed8; color: #1e3a8a; }
.badge.triaged   { background: #d1fae5; border-color: #047857; color: #065f46; }
.badge.accepted  { background: #ede9fe; border-color: #6d28d9; color: #4c1d95; }
.narrative { white-space: pre-wrap; background: #f9fafb; padding: 8pt 10pt; border-left: 3pt solid #d1d5db; margin: 6pt 0; }
.empty { color: #9ca3af; font-style: italic; }
table { width: 100%; border-collapse: collapse; margin-top: 6pt; font-size: 9.5pt; }
th, td { border: 1pt solid #d1d5db; padding: 5pt 7pt; text-align: left; vertical-align: top; }
th { background: #f3f4f6; font-weight: 600; }
.small { font-size: 9pt; color: #6b7280; }
.kv { font-size: 10pt; }
.kv dt { color: #6b7280; margin-top: 6pt; }
.kv dd { margin-left: 0; font-weight: 500; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 24pt; }
.footer { margin-top: 24pt; color: #6b7280; font-size: 9pt; text-align: center; }
.summary-tiles { display: flex; gap: 8pt; margin: 8pt 0; }
.tile { flex: 1; border: 1pt solid #d1d5db; border-radius: 3pt; padding: 8pt; text-align: center; }
.tile .v { font-size: 20pt; font-weight: bold; }
.tile .l { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5pt; }
`;

export async function renderPdf(args: {
  html: string;
  format?: PaperFormat;
}): Promise<ArrayBuffer> {
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
    await page.setContent(args.html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: args.format ?? "Letter",
      printBackground: true,
      margin: {
        top: "0.75in",
        bottom: "0.75in",
        left: "0.75in",
        right: "0.75in",
      },
    });
    // Copy into a fresh ArrayBuffer so the body type satisfies BodyInit
    const buf = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(buf).set(new Uint8Array(pdfBytes));
    return buf;
  } finally {
    await browser.close();
  }
}

export function pdfResponse(body: ArrayBuffer, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Render the "Findings from this assessment" section used by every PDF.
 */
export function renderFindingsBlock(
  findings: Array<{
    identifier: string;
    title: string;
    severity: string;
    status: string;
    source: string;
    createdAt: Date;
    creator?: { name?: string | null; email?: string | null } | null;
  }>
): string {
  if (findings.length === 0) {
    return `<p class="empty">No findings entered from this assessment.</p>`;
  }
  return `
<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Title</th>
      <th>Severity</th>
      <th>Status</th>
      <th>Source</th>
      <th>Created By</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    ${findings
      .map(
        (f) => `
      <tr>
        <td class="small">${esc(f.identifier)}</td>
        <td>${esc(f.title)}</td>
        <td><span class="badge ${esc(f.severity.toLowerCase())}">${esc(f.severity)}</span></td>
        <td><span class="badge ${esc(f.status.toLowerCase())}">${esc(f.status)}</span></td>
        <td>${esc(f.source)}</td>
        <td class="small">${esc(f.creator?.name ?? f.creator?.email ?? "—")}</td>
        <td class="small">${esc(formatDate(f.createdAt))}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>`;
}
