/**
 * PDF export for a Risk Assessment Project.
 *
 * Note: /risk-assessments/[id] corresponds to a `RiskAssessmentProject`
 * (container of discovered risks), not a single `RiskAssessment` record.
 * This PDF summarizes the project (subject, assignee, workflow state) and
 * lists every Risk discovered inside it with scoring/status.
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
  renderPdf,
} from "@/server/services/pdfHelpers";

export const dynamic = "force-dynamic";

function severityBadge(severity: string | null | undefined): string {
  if (!severity) return "—";
  const up = severity.toUpperCase();
  const cls = up.includes("CRIT") || up.includes("HIGH")
    ? "high"
    : up.includes("MED")
      ? "medium"
      : "low";
  return `<span class="badge ${cls}">${esc(severity)}</span>`;
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

  const project = await runWithOrganizationContext(orgId, () =>
    db.riskAssessmentProject.findFirst({
      where: { id, organizationId: orgId },
      include: {
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        reviewer: { select: { name: true, email: true } },
        riskOwner: { select: { name: true, jobTitle: true } },
        discoveredRisks: {
          select: {
            id: true,
            identifier: true,
            title: true,
            status: true,
            severity: true,
            inherentLikelihood: true,
            inherentImpact: true,
            inherentScore: true,
            inherentScoreLabel: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        matrixVersion: {
          select: {
            versionNumber: true,
            template: { select: { name: true } },
          },
        },
      },
    })
  );

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const counts = {
    total: project.discoveredRisks.length,
    high: project.discoveredRisks.filter(
      (r) => r.severity?.toString().toUpperCase().includes("HIGH") || r.severity?.toString().toUpperCase().includes("CRIT")
    ).length,
    medium: project.discoveredRisks.filter(
      (r) => r.severity?.toString().toUpperCase().includes("MED")
    ).length,
    low: project.discoveredRisks.filter(
      (r) => r.severity?.toString().toUpperCase().includes("LOW")
    ).length,
  };

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Risk Assessment — ${esc(project.subject)}</title>
<style>${BASE_PDF_CSS}</style>
</head><body>

<h1>Risk Assessment
  <span class="badge ${esc(project.status.toLowerCase())}">${esc(project.status)}</span>
</h1>
<div class="meta">
  ${esc(org?.name ?? "")}<br/>
  Subject: <strong>${esc(project.subject)}</strong>
  ${project.matrixVersion ? ` · Matrix: ${esc(project.matrixVersion.template?.name ?? "")} v${project.matrixVersion.versionNumber}` : ""}
</div>

<h2>Summary</h2>
<div class="summary-tiles">
  <div class="tile"><div class="v">${counts.total}</div><div class="l">Total Risks</div></div>
  <div class="tile"><div class="v">${counts.high}</div><div class="l">High / Critical</div></div>
  <div class="tile"><div class="v">${counts.medium}</div><div class="l">Medium</div></div>
  <div class="tile"><div class="v">${counts.low}</div><div class="l">Low</div></div>
</div>

<h2>Ownership & Dates</h2>
<dl class="kv grid2">
  <div><dt>Assignee</dt><dd>${esc(project.assignee?.name ?? project.assignee?.email ?? "—")}</dd></div>
  <div><dt>Risk Owner</dt><dd>${esc(project.riskOwner?.name ?? "—")}${project.riskOwner?.jobTitle ? ` (${esc(project.riskOwner.jobTitle)})` : ""}</dd></div>
  <div><dt>Created By</dt><dd>${esc(project.createdBy?.name ?? project.createdBy?.email ?? "—")}</dd></div>
  <div><dt>Reviewer</dt><dd>${esc(project.reviewer?.name ?? project.reviewer?.email ?? "—")}</dd></div>
  <div><dt>Due Date</dt><dd>${esc(formatDate(project.dueDate))}</dd></div>
  <div><dt>Submitted</dt><dd>${esc(formatDate(project.submittedAt))}</dd></div>
  <div><dt>Reviewed</dt><dd>${esc(formatDate(project.reviewedAt))}</dd></div>
  <div><dt>Created</dt><dd>${esc(formatDate(project.createdAt))}</dd></div>
</dl>

${project.description ? `<h2>Description / Scope</h2><div class="narrative">${esc(project.description)}</div>` : ""}

${project.rejectionNotes ? `<h2>Rejection Notes</h2><div class="narrative">${esc(project.rejectionNotes)}</div>` : ""}

<h2>Discovered Risks (${project.discoveredRisks.length})</h2>
${
  project.discoveredRisks.length === 0
    ? `<p class="empty">No risks discovered in this assessment yet.</p>`
    : `
<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Title</th>
      <th>Severity</th>
      <th>Likelihood</th>
      <th>Impact</th>
      <th>Score</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${project.discoveredRisks
      .map(
        (r) => `
      <tr>
        <td class="small"><strong>${esc(r.identifier ?? r.id.slice(0, 8))}</strong></td>
        <td>${esc(r.title)}</td>
        <td>${severityBadge(r.severity)}</td>
        <td class="small">${r.inherentLikelihood ? Number(r.inherentLikelihood).toFixed(2) : "—"}</td>
        <td class="small">${r.inherentImpact ? Number(r.inherentImpact).toFixed(2) : "—"}</td>
        <td class="small">${r.inherentScore ? Number(r.inherentScore).toFixed(2) : "—"}${r.inherentScoreLabel ? ` (${esc(r.inherentScoreLabel)})` : ""}</td>
        <td class="small">${esc(r.status)}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
`
}

<div class="footer">
  Generated ${esc(new Date().toLocaleString())} by BetterThanSpreadsheetsGRC
</div>

</body></html>`;

  const buf = await renderPdf({ html });
  const slug = project.subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  return pdfResponse(buf, `risk-${slug}-${project.id.slice(0, 8)}.pdf`);
}
