/**
 * PDF export for a compliance assessment. Renders the framework, overall
 * compliance stats, per-control scoring table (grouped by parent), and any
 * findings entered from this assessment.
 */

import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  BASE_PDF_CSS,
  esc,
  formatDate,
  pdfResponse,
  renderFindingsBlock,
  renderPdf,
} from "@/server/services/pdfHelpers";

export const dynamic = "force-dynamic";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "COMPLIANT":
      return "completed";
    case "PARTIALLY_COMPLIANT":
      return "medium";
    case "NON_COMPLIANT":
      return "high";
    case "NOT_APPLICABLE":
      return "archived";
    default:
      return "draft";
  }
}

function statusLabel(status: string): string {
  return (
    {
      COMPLIANT: "Compliant",
      PARTIALLY_COMPLIANT: "Partial",
      NON_COMPLIANT: "Non-Compliant",
      NOT_APPLICABLE: "N/A",
      NOT_ASSESSED: "Not Assessed",
    } as Record<string, string>
  )[status] ?? status;
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

  const assessment = await runWithOrganizationContext(orgId, () =>
    db.complianceAssessment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        framework: true,
        businessUnit: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true, email: true } },
        assessor: { select: { id: true, name: true, email: true } },
        controlScores: {
          include: {
            control: {
              select: {
                id: true,
                controlId: true,
                title: true,
                description: true,
                parentControlId: true,
              },
            },
          },
          orderBy: { control: { controlId: "asc" } },
        },
      },
    })
  );

  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const findings = await runWithOrganizationContext(orgId, () =>
    db.finding.findMany({
      where: { organizationId: orgId, sourceComplianceAssessmentId: id },
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

  const score = assessment.complianceScore
    ? Number(assessment.complianceScore).toFixed(0)
    : "—";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Compliance Assessment — ${esc(assessment.name)}</title>
<style>${BASE_PDF_CSS}</style>
</head><body>

<h1>Compliance Assessment
  <span class="badge ${esc(assessment.status.toLowerCase())}">${esc(assessment.status)}</span>
</h1>
<div class="meta">
  ${esc(org?.name ?? "")} · <strong>${esc(assessment.identifier)}</strong> · ${esc(assessment.framework.name)} ${esc(assessment.framework.version ?? "")}<br/>
  Name: ${esc(assessment.name)} · Owner: ${esc(assessment.owner?.name ?? assessment.owner?.email ?? "—")}
  ${assessment.businessUnit ? ` · BU: ${esc(assessment.businessUnit.name)}` : ""}
</div>

<h2>Overall</h2>
<div class="summary-tiles">
  <div class="tile"><div class="v">${esc(score)}%</div><div class="l">Score</div></div>
  <div class="tile"><div class="v">${assessment.compliantCount}</div><div class="l">Compliant</div></div>
  <div class="tile"><div class="v">${assessment.partialCount}</div><div class="l">Partial</div></div>
  <div class="tile"><div class="v">${assessment.nonCompliantCount}</div><div class="l">Non-Compl.</div></div>
  <div class="tile"><div class="v">${assessment.notApplicableCount}</div><div class="l">N/A</div></div>
  <div class="tile"><div class="v">${assessment.notAssessedCount}</div><div class="l">Unscored</div></div>
</div>
<dl class="kv grid2">
  <div><dt>Created</dt><dd>${esc(formatDate(assessment.createdAt))}</dd></div>
  <div><dt>Target Completion</dt><dd>${esc(formatDate(assessment.targetCompletionDate))}</dd></div>
  <div><dt>Due Date</dt><dd>${esc(formatDate(assessment.dueDate))}</dd></div>
  <div><dt>Assessor</dt><dd>${esc(assessment.assessor?.name ?? assessment.assessor?.email ?? "—")}</dd></div>
</dl>

${assessment.description ? `<h2>Description</h2><div class="narrative">${esc(assessment.description)}</div>` : ""}

<h2>Control Assessments (${assessment.controlScores.length})</h2>
${
  assessment.controlScores.length === 0
    ? `<p class="empty">No control scores captured.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>Control</th>
      <th>Title</th>
      <th>Status</th>
      <th>Notes</th>
      <th>Gap</th>
    </tr>
  </thead>
  <tbody>
    ${assessment.controlScores
      .map(
        (s) => `
      <tr>
        <td class="small"><strong>${esc(s.control.controlId)}</strong></td>
        <td>${esc(s.control.title)}</td>
        <td><span class="badge ${statusBadgeClass(s.status)}">${esc(statusLabel(s.status))}</span></td>
        <td class="small">${esc(s.notes ?? "")}</td>
        <td class="small">${esc(s.gapDescription ?? "")}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
}

<h2>Findings from this Assessment (${findings.length})</h2>
${renderFindingsBlock(findings)}

<div class="footer">
  Generated ${esc(new Date().toLocaleString())} by BetterThanSpreadsheetsGRC
</div>

</body></html>`;

  const buf = await renderPdf({ html });
  return pdfResponse(
    buf,
    `compliance-${assessment.identifier}.pdf`
  );
}
