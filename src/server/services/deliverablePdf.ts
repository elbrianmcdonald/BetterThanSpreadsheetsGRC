/**
 * Story 17.1: Consulting deliverable PDF generator.
 *
 * Reuses the existing Puppeteer/Chromium pipeline pattern from pdfGenerator.ts
 * (Story 5.7) — same launch args and the Docker headless Chromium binary. No new
 * browser dependency. `printBackground: true` is set so the gradient cover band
 * renders (AC22).
 *
 * The print HTML is fully self-contained: the design tokens are inlined as oklch
 * values (the same source-of-truth values as globals.css) and fonts fall back to
 * system sans/mono, so Chromium needs no access to the app's served CSS.
 */

import puppeteer from "puppeteer";

export type DeliverableTone = "ok" | "high" | "crit" | "med" | "low" | "brand";

export interface DeliverableScorecardCell {
  label: string;
  value: string | number;
  suffix?: string;
  deltaNote?: string;
  tone?: DeliverableTone;
}

export interface DeliverableFinding {
  identifier: string;
  title: string;
  likelihood: number;
  impact: number;
  domain?: string | null;
}

/** A generic table cell for body sections rendered in the PDF. */
export type DocCell = string | { text: string; mono?: boolean; color?: string };

/** A generic body section (a titled table) for non-risk deliverables. */
export interface DocSection {
  n: string;
  title: string;
  columns: string[];
  rows: DocCell[][];
  /** Optional empty-state text when rows is empty. */
  empty?: string;
}

export interface DeliverableDocData {
  type: string; // "risk" | "compliance" | "maturity" | "stub" ...
  id: string;
  confidentialLabel?: string;
  eyebrow: string;
  title: string;
  engagement: string;
  period: string;
  preparedBy: string;
  scorecard: DeliverableScorecardCell[];
  /** Risk/stub: the findings register (rendered as section 01). */
  findings: DeliverableFinding[];
  /** Compliance/maturity: generic titled tables rendered in place of findings. */
  sections?: DocSection[];
}

/** oklch source-of-truth values mirrored from globals.css (light theme). */
const TOKENS = {
  primary: "oklch(0.345 0.058 252)",
  primaryLight: "oklch(0.46 0.07 252)",
  primaryFg: "oklch(0.985 0 0)",
  foreground: "oklch(0.218 0.013 252)",
  muted: "oklch(0.534 0.015 252)",
  border: "oklch(0.918 0.004 250)",
  surface2: "oklch(0.957 0.004 250)",
  ok: "oklch(0.490 0.075 160)",
  high: "oklch(0.565 0.135 47)",
  crit: "oklch(0.495 0.155 25)",
  med: "oklch(0.520 0.100 75)",
} as const;

function toneColor(tone?: DeliverableTone): string {
  switch (tone) {
    case "ok":
      return TOKENS.ok;
    case "high":
      return TOKENS.high;
    case "crit":
      return TOKENS.crit;
    case "med":
      return TOKENS.med;
    case "low":
    case "brand":
      return TOKENS.primary;
    default:
      return TOKENS.foreground;
  }
}

function sevColor(score: number): string {
  if (score >= 20) return TOKENS.crit;
  if (score >= 12) return TOKENS.high;
  if (score >= 6) return TOKENS.med;
  return TOKENS.ok;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderDeliverableHtml(data: DeliverableDocData): string {
  const cells = data.scorecard
    .map(
      (c, i) => `
      <div class="cell" style="${i > 0 ? "border-left:1px solid var(--border);" : ""}">
        <div class="eyebrow">${esc(c.label)}</div>
        <div class="cell-value" style="color:${toneColor(c.tone)}">
          ${esc(String(c.value))}${c.suffix ? `<span class="suffix">${esc(c.suffix)}</span>` : ""}
        </div>
        ${c.deltaNote ? `<div class="delta">${esc(c.deltaNote)}</div>` : ""}
      </div>`,
    )
    .join("");

  const rows = data.findings
    .map((f) => {
      const score = f.likelihood * f.impact;
      return `
      <tr>
        <td class="mono">${esc(f.identifier)}</td>
        <td>${esc(f.title)}</td>
        <td>${esc(f.domain ?? "—")}</td>
        <td class="mono">${f.likelihood}×${f.impact}</td>
        <td><span class="sev" style="color:${sevColor(score)};border-color:${sevColor(score)}">${score}</span></td>
      </tr>`;
    })
    .join("");

  // Body: generic sections (compliance/maturity) take precedence; otherwise the
  // legacy findings register (risk/stub) renders as section 01.
  const renderCell = (c: DocCell): string => {
    if (typeof c === "string") return esc(c);
    const cls = c.mono ? ' class="mono"' : "";
    const style = c.color ? ` style="color:${c.color}"` : "";
    return `<span${cls}${style}>${esc(c.text)}</span>`;
  };
  const bodyHtml =
    data.sections && data.sections.length > 0
      ? data.sections
          .map(
            (s) => `
      <div class="section">
        <div class="section-head">
          <span class="section-n">${esc(s.n)}</span>
          <span class="section-title">${esc(s.title)}</span>
        </div>
        <table>
          <thead><tr>${s.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${
            s.rows.length
              ? s.rows
                  .map((r) => `<tr>${r.map((c) => `<td>${renderCell(c)}</td>`).join("")}</tr>`)
                  .join("")
              : `<tr><td colspan="${s.columns.length}" style="color:var(--muted)">${esc(s.empty ?? "Nothing to show.")}</td></tr>`
          }</tbody>
        </table>
      </div>`,
          )
          .join("")
      : `
      <div class="section">
        <div class="section-head">
          <span class="section-n">01</span>
          <span class="section-title">Findings</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Finding</th><th>Domain</th><th>L×I</th><th>Score</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" style="color:var(--muted)">No findings.</td></tr>`}</tbody>
        </table>
      </div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {
    --primary: ${TOKENS.primary};
    --primary-light: ${TOKENS.primaryLight};
    --primary-fg: ${TOKENS.primaryFg};
    --foreground: ${TOKENS.foreground};
    --muted: ${TOKENS.muted};
    --border: ${TOKENS.border};
    --surface-2: ${TOKENS.surface2};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
    color: var(--foreground);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { max-width: 940px; margin: 0 auto; }
  .cover {
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    color: var(--primary-fg);
    padding: 40px 44px;
  }
  .confidential { font-family: ui-monospace, "Courier New", monospace; font-size: 11px; letter-spacing: .14em; opacity: .85; }
  .cover-eyebrow { margin-top: 12px; font-size: 12px; opacity: .85; }
  h1 { margin: 4px 0 0; font-size: 38px; font-weight: 600; line-height: 1.1; letter-spacing: -0.01em; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 16px 48px; margin-top: 24px; }
  .meta-label { font-family: ui-monospace, "Courier New", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .75; }
  .meta-value { margin-top: 4px; font-size: 14px; font-weight: 500; }
  .content { padding: 36px 44px; }
  .scorecard { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .cell { padding: 20px; }
  .eyebrow { font-family: ui-monospace, "Courier New", monospace; font-size: 10.5px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .cell-value { margin-top: 8px; font-size: 44px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
  .suffix { font-size: 14px; color: var(--muted); margin-left: 4px; }
  .delta { margin-top: 6px; font-size: 12px; color: var(--muted); }
  .section { margin-top: 36px; }
  .section-head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .section-n { font-family: ui-monospace, "Courier New", monospace; font-size: 13px; color: var(--primary); }
  .section-title { font-size: 18px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; font-family: ui-monospace, "Courier New", monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; background: var(--surface-2); }
  td { padding: 10px; border-bottom: 1px solid var(--border); }
  .mono { font-family: ui-monospace, "Courier New", monospace; font-size: 12px; }
  .sev { display: inline-block; min-width: 26px; text-align: center; border: 1px solid; border-radius: 999px; padding: 1px 8px; font-family: ui-monospace, "Courier New", monospace; font-size: 12px; }
</style>
</head>
<body>
  <div class="doc">
    <div class="cover">
      <div class="confidential">${esc(data.confidentialLabel ?? "CONFIDENTIAL")}</div>
      <div class="cover-eyebrow">${esc(data.eyebrow)}</div>
      <h1>${esc(data.title)}</h1>
      <div class="meta-row">
        <div><div class="meta-label">Engagement</div><div class="meta-value">${esc(data.engagement)}</div></div>
        <div><div class="meta-label">Period</div><div class="meta-value">${esc(data.period)}</div></div>
        <div><div class="meta-label">Prepared by</div><div class="meta-value">${esc(data.preparedBy)}</div></div>
      </div>
    </div>
    <div class="content">
      <div class="scorecard">${cells}</div>
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a deliverable PDF. Reuses the Story 5.7 Puppeteer launch pattern.
 */
export async function generateDeliverablePdf(
  data: DeliverableDocData,
): Promise<{ buffer: Buffer; filename: string }> {
  const html = renderDeliverableHtml(data);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // AC22: render the gradient cover band
      margin: { top: "0mm", bottom: "16mm", left: "0mm", right: "0mm" },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const safeType = data.type.replace(/[^a-zA-Z0-9-_]/g, "-");
    const safeId = data.id.replace(/[^a-zA-Z0-9-_]/g, "-");
    const filename = `deliverable-${safeType}-${safeId}-${dateStr}.pdf`;

    return { buffer: Buffer.from(pdfBuffer), filename };
  } finally {
    await browser.close();
  }
}
