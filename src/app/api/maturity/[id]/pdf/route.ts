/**
 * PDF export for a maturity assessment. Shows framework, overall score,
 * domain scoring table, targets, and findings from the assessment.
 */

import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { getScaleDefinition } from "@/lib/maturity-scales";
import {
  BASE_PDF_CSS,
  esc,
  formatDate,
  pdfResponse,
  renderFindingsBlock,
  renderPdf,
} from "@/server/services/pdfHelpers";

export const dynamic = "force-dynamic";

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

  const assessment = await runWithOrganizationContext(orgId, () =>
    db.maturityAssessment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        framework: { include: { domains: true } },
        businessUnit: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true, email: true } },
        domainScores: {
          include: { domain: true },
          orderBy: { domain: { sortOrder: "asc" } },
        },
      },
    })
  );

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const findings = await runWithOrganizationContext(orgId, () =>
    db.finding.findMany({
      where: { organizationId: orgId, sourceMaturityAssessmentId: id },
      select: {
        id: true,
        identifier: true,
        title: true,
        severity: true,
        status: true,
        source: true,
        createdAt: true,
        creator: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  );

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Labels from the chosen scale (CSF 2.0) or fall back to framework levels
  const scale = getScaleDefinition(assessment.scoringScale ?? null);
  const levelLabel = (level: number | null): string => {
    if (level === null || level === undefined) return "—";
    if (scale) {
      const found = scale.levels.find((l) => l.value === level);
      return found ? `${level} — ${found.label}` : String(level);
    }
    return String(level);
  };

  // Only domains at the assessment's depth are "scored". Other domains (e.g.
  // Functions when depth=FUNCTION) may also have targetLevel set for
  // children to inherit — render them separately.
  const depthDomains = assessment.domainScores.filter(
    (s) => s.domain.level === assessment.assessmentDepth
  );
  const otherDomains = assessment.domainScores.filter(
    (s) => s.domain.level !== assessment.assessmentDepth
  );

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Maturity Assessment — ${esc(assessment.name)}</title>
<style>${BASE_PDF_CSS}</style>
</head><body>

<h1>Maturity Assessment
  <span class="badge ${esc(assessment.status.toLowerCase())}">${esc(assessment.status)}</span>
</h1>
<div class="meta">
  ${esc(org?.name ?? "")} · <strong>${esc(assessment.identifier)}</strong> · ${esc(assessment.framework.name)} ${esc(assessment.framework.version ?? "")}<br/>
  Name: ${esc(assessment.name)} · Depth: ${esc(assessment.assessmentDepth)} · Mode: ${esc(assessment.assessmentMode)}<br/>
  Owner: ${esc(assessment.owner?.name ?? assessment.owner?.email ?? "—")}
  ${assessment.businessUnit ? ` · BU: ${esc(assessment.businessUnit.name)}` : ""}
  ${scale ? ` · Scale: ${esc(scale.displayName)}` : ""}
</div>

<h2>Overall</h2>
<div class="summary-tiles">
  <div class="tile"><div class="v">${assessment.overallLevel ?? "—"}</div><div class="l">Current Level</div></div>
  <div class="tile"><div class="v">${assessment.overallScore ? Number(assessment.overallScore).toFixed(2) : "—"}</div><div class="l">Score</div></div>
  <div class="tile"><div class="v">${assessment.targetLevel ?? "—"}</div><div class="l">Target Level</div></div>
  <div class="tile"><div class="v">${depthDomains.filter((s) => s.currentLevel !== null).length} / ${depthDomains.length}</div><div class="l">Scored</div></div>
</div>
<dl class="kv grid2">
  <div><dt>Created</dt><dd>${esc(formatDate(assessment.createdAt))}</dd></div>
  <div><dt>Target Date</dt><dd>${esc(formatDate(assessment.targetDate))}</dd></div>
</dl>

${assessment.description ? `<h2>Description</h2><div class="narrative">${esc(assessment.description)}</div>` : ""}

<h2>Domain Scoring (${depthDomains.length})</h2>
${
  depthDomains.length === 0
    ? `<p class="empty">No domain scores at depth ${esc(assessment.assessmentDepth)}.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>Code</th>
      <th>Domain</th>
      <th>Current</th>
      <th>Target</th>
      <th>Gap</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${depthDomains
      .map((s) => {
        const gap =
          s.currentLevel !== null && s.targetLevel !== null
            ? s.targetLevel - s.currentLevel
            : null;
        const na = s.isNotApplicable ? " (N/A)" : "";
        return `
      <tr>
        <td class="small"><strong>${esc(s.domain.code)}</strong></td>
        <td>${esc(s.domain.name)}</td>
        <td>${esc(levelLabel(s.currentLevel))}${na}</td>
        <td>${esc(levelLabel(s.targetLevel))}</td>
        <td>${gap === null ? "—" : gap > 0 ? `+${gap}` : "0"}</td>
        <td class="small">${esc(s.notes ?? "")}</td>
      </tr>`;
      })
      .join("")}
  </tbody>
</table>
`
}

${
  otherDomains.length > 0
    ? `
<h3>Parent-level Targets (inherited)</h3>
<table>
  <thead>
    <tr>
      <th>Code</th>
      <th>Domain</th>
      <th>Level</th>
      <th>Target</th>
    </tr>
  </thead>
  <tbody>
    ${otherDomains
      .map(
        (s) => `
      <tr>
        <td class="small"><strong>${esc(s.domain.code)}</strong></td>
        <td>${esc(s.domain.name)}</td>
        <td class="small">${esc(s.domain.level)}</td>
        <td>${esc(levelLabel(s.targetLevel))}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
    : ""
}

<h2>Findings from this Assessment (${findings.length})</h2>
${renderFindingsBlock(findings)}

<div class="footer">
  Generated ${esc(new Date().toLocaleString())} by BetterThanSpreadsheetsGRC
</div>

</body></html>`;

  const buf = await renderPdf({ html });
  return pdfResponse(buf, `maturity-${assessment.identifier}.pdf`);
}
