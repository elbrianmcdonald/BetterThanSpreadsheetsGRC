/**
 * Deliverable router.
 *
 * Story 17.1: `getStub` + the shared shell/PDF pipeline.
 * Stories 17.2–17.4: per-type body data procedures (`getRiskBody`,
 * `getComplianceBody`, `getMaturityBody`) and a type-aware `exportPdf`. Each
 * body procedure returns `{ cover, scorecard, ...bodyData }`; the screen renders
 * the rich React body, while `exportPdf` renders a print-friendly section table.
 *
 * Data shaping lives in `src/server/services/deliverable<Type>Data.ts`; this
 * router only wires org-scoped access + cover assembly + audit logging.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AssessmentKind, Prisma } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import {
  generateDeliverablePdf,
  type DeliverableDocData,
  type DocSection,
  type DocCell,
  type HeatmapGridData,
} from "@/server/services/deliverablePdf";
import { getRiskDeliverableData } from "@/server/services/deliverableRiskData";
import { getRiskExecutiveData } from "@/server/services/deliverableRiskExecData";
import { buildHeatmapGrid } from "@/lib/matrix";
import { normalizeLayout } from "@/components/deliverable/execSummaryLayout";
import {
  getExecCrossCutting,
  type ExecMatrix,
  type ExecFinding,
} from "@/server/services/deliverableExecShared";
import { getComplianceDeliverableData } from "@/server/services/deliverableComplianceData";
import { getMaturityDeliverableData } from "@/server/services/deliverableMaturityData";
import { getVendorDeliverableData } from "@/server/services/deliverableVendorData";
import { getBiaDeliverableData } from "@/server/services/deliverableBiaData";
import {
  getRoadmapDeliverableData,
  groupActionsByPhase,
  PHASES,
} from "@/server/services/deliverableRoadmapData";
import type { DeliverableCover } from "@/components/deliverable/types";
import type { AuditAction } from "@prisma/client";

const DELIVERABLE_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.CISO,
  UserRole.AUDITOR,
];

/** Who may edit a deliverable's statement / section layout (reads add AUDITOR). */
const EXEC_EDIT_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.CISO,
];

/**
 * Update a scalar exec field (statement / layout) on whichever assessment model
 * the kind maps to, org-scoped via updateMany. Returns the affected row count
 * (0 ⇒ not found / cross-org).
 */
async function updateAssessmentExecField(
  db: any,
  organizationId: string,
  kind: AssessmentKind,
  id: string,
  data: Record<string, unknown>,
): Promise<number> {
  const where = { id, organizationId };
  switch (kind) {
    case AssessmentKind.RISK:
      return (await db.riskAssessmentProject.updateMany({ where, data })).count;
    case AssessmentKind.COMPLIANCE:
      return (await db.complianceAssessment.updateMany({ where, data })).count;
    case AssessmentKind.MATURITY:
      return (await db.maturityAssessment.updateMany({ where, data })).count;
    case AssessmentKind.VENDOR:
      return (await db.vendorAssessment.updateMany({ where, data })).count;
    case AssessmentKind.BIA:
      return (await db.businessProcess.updateMany({ where, data })).count;
    default:
      return 0;
  }
}

const deliverableTypeSchema = z.enum([
  "risk",
  "risk-exec",
  "compliance",
  "maturity",
  "vendor",
  "bia",
  "roadmap",
  "stub",
]);
type DeliverableType = z.infer<typeof deliverableTypeSchema>;

/** oklch status colors for PDF cells (mirrors globals.css tokens). */
const STATUS_PDF_COLOR: Record<string, string> = {
  COMPLIANT: "oklch(0.490 0.075 160)",
  PARTIALLY_COMPLIANT: "oklch(0.520 0.100 75)",
  NON_COMPLIANT: "oklch(0.495 0.155 25)",
  NOT_APPLICABLE: "oklch(0.534 0.015 252)",
  NOT_ASSESSED: "oklch(0.60 0.018 252)",
};

/** RaciRole enum (R/A/C/I) → display label. */
const RACI_LABEL: Record<string, string> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

/** ENUM_VALUE → "Enum value". */
function titleCaseEnum(v: string): string {
  const s = v.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Drop a trailing .0000/.0 so integers read cleanly in the PDF. */
function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
}

async function orgName(
  db: { organization: { findUnique: (a: any) => Promise<{ name: string } | null> } },
  organizationId: string,
): Promise<string> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  return org?.name ?? "Engagement";
}

function buildCover(opts: {
  title: string;
  eyebrow: string;
  engagement: string;
  preparedBy: string;
}): DeliverableCover {
  return {
    eyebrow: opts.eyebrow,
    title: opts.title,
    engagement: opts.engagement,
    period: "Q2 2026",
    preparedBy: opts.preparedBy,
  };
}

// ---------------------------------------------------------------------------
// Stub doc (Story 17.1) — kept for the stub route + a fallback for exportPdf.
// ---------------------------------------------------------------------------
async function buildStubDoc(
  id: string,
  organizationId: string,
  preparedBy: string,
  db: any,
): Promise<DeliverableDocData> {
  const name = await orgName(db, organizationId);
  return {
    type: "stub",
    id,
    eyebrow: "Cybersecurity Assessment",
    title: "Security Posture Assessment",
    engagement: name,
    period: "Q2 2026",
    preparedBy,
    scorecard: [
      { label: "Security posture", value: 62, suffix: "/ 100", tone: "ok", deltaNote: "+8 vs. prior" },
      { label: "Risk exposure", value: 41, suffix: "/ 100", tone: "high", deltaNote: "−5 vs. prior" },
      { label: "Critical findings", value: 3, tone: "crit", deltaNote: "of 12 total" },
    ],
    findings: [
      { identifier: "F-01", title: "Internet-exposed management interface", likelihood: 5, impact: 5, domain: "External Attack Surface" },
      { identifier: "F-02", title: "Flat IT/OT network — no segmentation", likelihood: 4, impact: 5, domain: "Network & Architecture" },
      { identifier: "F-03", title: "No phishing-resistant MFA on admin accounts", likelihood: 4, impact: 4, domain: "Identity & Access" },
    ],
  };
}

export const deliverableRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Stub (Story 17.1)
  // -------------------------------------------------------------------------
  getStub: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const preparedBy = ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor";
      return buildStubDoc(input.id, ctx.organizationId!, preparedBy, ctx.db);
    }),

  // -------------------------------------------------------------------------
  // Risk / Findings (Story 17.2) — aggregates the org's risk-scored findings.
  // -------------------------------------------------------------------------
  getRiskBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx }) => {
      const { scorecard, rows } = await getRiskDeliverableData(ctx.organizationId!, ctx.db);
      const cover = buildCover({
        title: "Risk & Findings Assessment",
        eyebrow: "Cybersecurity Assessment",
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      return { cover, scorecard, rows };
    }),

  // -------------------------------------------------------------------------
  // Risk Executive Summary — a SPECIFIC RiskAssessmentProject (not org-wide).
  // Drives the ordered executive-summary body: scores + statement + findings +
  // risks. Action plans, pathways, and interviewees are fetched by the body via
  // their own per-assessment procedures.
  // -------------------------------------------------------------------------
  getRiskExecBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await getRiskExecutiveData(ctx.organizationId!, ctx.db, input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment project not found" });
      const cover = buildCover({
        title: data.title,
        eyebrow: "Cybersecurity Assessment",
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      // Statement edit rights mirror riskAssessmentProject.updateExecutiveStatement:
      // ORG_ADMIN or the assigned analyst.
      const canEdit =
        ctx.session!.user.role === UserRole.ORG_ADMIN ||
        data.assigneeId === ctx.session!.user.id;
      return {
        cover,
        scorecard: data.scorecard,
        executiveStatement: data.executiveStatement,
        matrix: data.matrix,
        layout: data.layout,
        rows: data.rows,
        risks: data.risks,
        canEdit,
      };
    }),

  // -------------------------------------------------------------------------
  // Polymorphic exec-summary edits (statement + section layout) for any kind.
  // -------------------------------------------------------------------------
  updateExecutiveStatement: organizationProcedure
    .use(requireRole(EXEC_EDIT_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        id: z.string().min(1),
        executiveStatement: z.string().max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const count = await updateAssessmentExecField(
        ctx.db,
        ctx.organizationId!,
        input.assessmentKind,
        input.id,
        { executiveStatement: input.executiveStatement },
      );
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      return { id: input.id, executiveStatement: input.executiveStatement };
    }),

  updateExecSummaryLayout: organizationProcedure
    .use(requireRole(EXEC_EDIT_ROLES))
    .input(
      z.object({
        assessmentKind: z.nativeEnum(AssessmentKind),
        id: z.string().min(1),
        layout: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalized = normalizeLayout(input.assessmentKind, input.layout);
      const count = await updateAssessmentExecField(
        ctx.db,
        ctx.organizationId!,
        input.assessmentKind,
        input.id,
        { execSummaryLayout: normalized as unknown as Prisma.InputJsonValue },
      );
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      return { id: input.id, layout: normalized };
    }),

  // -------------------------------------------------------------------------
  // Compliance (Story 17.3) — a specific ComplianceAssessment.
  // -------------------------------------------------------------------------
  getComplianceBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await getComplianceDeliverableData(ctx.organizationId!, ctx.db, input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Compliance assessment not found" });
      const cover = buildCover({
        title: data.title,
        eyebrow: `Compliance · ${data.framework}`,
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      const cross = await getExecCrossCutting(ctx.organizationId!, ctx.db, AssessmentKind.COMPLIANCE, input.id);
      return {
        cover,
        scorecard: data.scorecard,
        controls: data.controls,
        gaps: data.gaps,
        executiveStatement: cross.executiveStatement,
        layout: normalizeLayout("COMPLIANCE", cross.execSummaryLayoutRaw),
        matrix: cross.matrix,
        rows: cross.rows,
        canEdit: EXEC_EDIT_ROLES.includes(ctx.session!.user.role),
      };
    }),

  // -------------------------------------------------------------------------
  // Maturity (Story 17.4) — a specific MaturityAssessment.
  // -------------------------------------------------------------------------
  getMaturityBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await getMaturityDeliverableData(ctx.organizationId!, ctx.db, input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Maturity assessment not found" });
      const cover = buildCover({
        title: data.title,
        eyebrow: `Maturity · ${data.framework}`,
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      const cross = await getExecCrossCutting(ctx.organizationId!, ctx.db, AssessmentKind.MATURITY, input.id);
      return {
        cover,
        scorecard: data.scorecard,
        domains: data.domains,
        overallLevel: data.overallLevel,
        targetLevel: data.targetLevel,
        executiveStatement: cross.executiveStatement,
        layout: normalizeLayout("MATURITY", cross.execSummaryLayoutRaw),
        matrix: cross.matrix,
        rows: cross.rows,
        canEdit: EXEC_EDIT_ROLES.includes(ctx.session!.user.role),
      };
    }),

  // -------------------------------------------------------------------------
  // Vendor (Executive Summary) — a specific VendorAssessment.
  // -------------------------------------------------------------------------
  getVendorBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await getVendorDeliverableData(ctx.organizationId!, ctx.db, input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor assessment not found" });
      const cover = buildCover({
        title: data.title,
        eyebrow: `Vendor Assessment · ${data.vendorName}`,
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      const cross = await getExecCrossCutting(ctx.organizationId!, ctx.db, AssessmentKind.VENDOR, input.id);
      return {
        cover,
        scorecard: data.scorecard,
        findings: data.findings,
        questionnaires: data.questionnaires,
        statusLabel: data.statusLabel,
        recommendation: data.recommendation,
        riskScore: data.riskScore,
        riskTier: data.riskTier,
        summary: data.summary,
        executiveStatement: cross.executiveStatement,
        layout: normalizeLayout("VENDOR", cross.execSummaryLayoutRaw),
        matrix: cross.matrix,
        rows: cross.rows,
        canEdit: EXEC_EDIT_ROLES.includes(ctx.session!.user.role),
      };
    }),

  // -------------------------------------------------------------------------
  // BIA (Executive Summary) — a specific BusinessProcess.
  // -------------------------------------------------------------------------
  getBiaBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const data = await getBiaDeliverableData(ctx.organizationId!, ctx.db, input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Business process not found" });
      const cover = buildCover({
        title: data.title,
        eyebrow: data.businessFunction
          ? `Business Impact Analysis · ${data.businessFunction}`
          : "Business Impact Analysis",
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      const cross = await getExecCrossCutting(ctx.organizationId!, ctx.db, AssessmentKind.BIA, input.id);
      return {
        cover,
        scorecard: data.scorecard,
        impacts: data.impacts,
        dependencies: data.dependencies,
        risks: data.risks,
        tierName: data.tierName,
        rto: data.rto,
        rpo: data.rpo,
        assessmentStatusLabel: data.assessmentStatusLabel,
        workaroundProcedure: data.workaroundProcedure,
        executiveStatement: cross.executiveStatement,
        layout: normalizeLayout("BIA", cross.execSummaryLayoutRaw),
        matrix: cross.matrix,
        rows: cross.rows,
        canEdit: EXEC_EDIT_ROLES.includes(ctx.session!.user.role),
      };
    }),

  // -------------------------------------------------------------------------
  // Roadmap (Story 17.5) — remediation options across the org.
  // -------------------------------------------------------------------------
  getRoadmapBody: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx }) => {
      const { scorecard, actions } = await getRoadmapDeliverableData(ctx.organizationId!, ctx.db);
      const cover = buildCover({
        title: "Remediation Roadmap",
        eyebrow: "Action Plan",
        engagement: await orgName(ctx.db, ctx.organizationId!),
        preparedBy: ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor",
      });
      return { cover, scorecard, actions };
    }),

  // -------------------------------------------------------------------------
  // PDF export (Story 17.1 pipeline; type-aware build).
  // -------------------------------------------------------------------------
  exportPdf: organizationProcedure
    .use(requireRole(DELIVERABLE_ROLES))
    .input(z.object({ type: deliverableTypeSchema.default("stub"), id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const preparedBy = ctx.session!.user.name ?? ctx.session!.user.email ?? "Lead Assessor";
      const engagement = await orgName(ctx.db, ctx.organizationId!);

      let doc: DeliverableDocData;
      try {
        doc = await buildExportDoc(input.type, input.id, {
          organizationId: ctx.organizationId!,
          db: ctx.db,
          engagement,
          preparedBy,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to assemble deliverable", cause: err });
      }

      let buffer: Buffer;
      let filename: string;
      try {
        ({ buffer, filename } = await generateDeliverablePdf(doc));
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate deliverable PDF", cause: err });
      }

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "EXPORT_DELIVERABLE" as unknown as AuditAction,
        entityType: "Deliverable",
        entityId: input.id,
        actorName: ctx.session!.user.name ?? ctx.session!.user.email ?? undefined,
        actorRole: ctx.session!.user.role,
        changes: { before: null, after: { exportType: "PDF", deliverableType: input.type, filename, fileSizeBytes: buffer.length } },
      });

      return {
        filename,
        data: buffer.toString("base64"),
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
      };
    }),
});

// ---------------------------------------------------------------------------
// Shared cross-cutting exec-summary PDF sections (statement, heatmap, findings,
// action plans, pathway, interviewees) — keyed for layout ordering.
// ---------------------------------------------------------------------------
async function execCrossCuttingSections(
  db: any,
  organizationId: string,
  kind: AssessmentKind,
  id: string,
  matrix: ExecMatrix | null,
  rows: ExecFinding[],
  executiveStatement: string | null,
): Promise<Record<string, Array<Omit<DocSection, "n">>>> {
  const [actionItems, pathways, engagement] = await Promise.all([
    db.actionPlanItem.findMany({
      where: { organizationId, assessmentKind: kind, assessmentId: id },
      include: { Owner: { select: { name: true } } },
      orderBy: [{ riskReduction: "desc" }, { createdAt: "asc" }],
    }),
    db.pathway.findMany({
      where: { organizationId, assessmentKind: kind, assessmentId: id },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    db.engagement.findFirst({
      where: { organizationId, assessmentKind: kind, assessmentId: id },
      include: {
        stakeholders: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        sessions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
  ]);

  const statement: Omit<DocSection, "n"> = {
    title: "Executive Statement",
    columns: [],
    rows: [],
    body: executiveStatement?.trim()
      ? executiveStatement
      : "No executive statement was provided for this assessment.",
  };

  let heatmap: Omit<DocSection, "n">;
  if (matrix) {
    const g = buildHeatmapGrid(matrix.scales, matrix.thresholds, matrix.outputScaleMax);
    const dots = rows
      .filter((r) => r.scored)
      .map((r) => {
        const colIndex = g.cols.findIndex((c) => c.value === r.likelihood);
        const rowIndex = g.rows.findIndex((rr) => rr.value === r.impact);
        return colIndex >= 0 && rowIndex >= 0
          ? { colIndex, rowIndex, color: r.severityColor, label: String(r.displayNumber) }
          : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    const bandCount = new Map<string, number>();
    for (const r of rows) if (r.scored) bandCount.set(r.severityLabel, (bandCount.get(r.severityLabel) ?? 0) + 1);
    const legend = [...matrix.thresholds]
      .sort((a, b) => a.minValue - b.minValue)
      .map((t) => ({ label: t.label, color: t.color, count: bandCount.get(t.label) ?? 0 }));
    const heatmapData: HeatmapGridData = {
      cols: g.cols,
      rows: g.rows,
      cells: g.cells.map((row) => row.map((c) => ({ color: c.color, score: c.score }))),
      dots,
      legend,
    };
    heatmap = { title: "Risk Heatmap", columns: [], rows: [], heatmap: heatmapData };
  } else {
    heatmap = { title: "Risk Heatmap", columns: [], rows: [], body: "No risk matrix is configured for this assessment." };
  }

  const findings: Omit<DocSection, "n"> = {
    title: "Findings",
    columns: ["ID", "Finding", "Domain", "L×I", "Severity"],
    rows: rows.map((r) => [
      { text: r.identifier, mono: true },
      r.title,
      r.domain ?? "—",
      { text: r.scored ? `${r.likelihood}×${r.impact}` : "—", mono: true },
      { text: r.severityLabel, color: r.severityColor },
    ]),
    empty: "No findings have been recorded in this assessment.",
  };

  const actionPlans: Omit<DocSection, "n"> = {
    title: "Action Plans",
    columns: ["ID", "Action", "Owner", "Effort", "Timeline", "Risk↓"],
    rows: actionItems.map(
      (a: {
        identifier: string;
        title: string;
        Owner: { name: string } | null;
        ownerTeam: string | null;
        effort: string;
        timelineEstimate: string;
        riskReduction: number;
      }) => [
        { text: a.identifier, mono: true },
        a.title,
        a.Owner?.name ?? a.ownerTeam ?? "—",
        titleCaseEnum(a.effort),
        a.timelineEstimate,
        { text: String(a.riskReduction), mono: true },
      ],
    ),
    empty: "No remediation initiatives have been planned yet.",
  };

  let pathwaySections: Array<Omit<DocSection, "n">>;
  if (pathways.length === 0) {
    pathwaySections = [
      { title: "Exploitation Pathway", columns: [], rows: [], body: "No exploitation pathway has been modeled for this assessment." },
    ];
  } else {
    pathwaySections = (pathways as Array<{
      name: string;
      verdict: string | null;
      narrative: string | null;
      blastRadius: string | null;
      steps: Array<{ order: number; tactic: string; technique: string; mitreTid: string | null }>;
    }>).map((p) => {
      const parts: string[] = [];
      if (p.verdict?.trim()) parts.push(`Verdict: ${p.verdict.trim()}`);
      if (p.narrative?.trim()) parts.push(p.narrative.trim());
      if (p.blastRadius?.trim()) parts.push(`Blast radius: ${p.blastRadius.trim()}`);
      return {
        title: pathways.length > 1 ? `Exploitation Pathway — ${p.name}` : "Exploitation Pathway",
        columns: ["#", "Tactic", "Technique", "MITRE"],
        rows: p.steps.map((s) => [
          { text: String(s.order), mono: true },
          s.tactic,
          s.technique,
          { text: s.mitreTid ?? "—", mono: true },
        ]),
        body: parts.length ? parts.join("\n\n") : undefined,
        empty: "No ATT&CK steps recorded for this pathway.",
      } satisfies Omit<DocSection, "n">;
    });
  }

  const known = new Set(
    (engagement?.stakeholders ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()),
  );
  const extraAttendees: string[] = [];
  for (const sess of engagement?.sessions ?? []) {
    for (const a of sess.attendees as string[]) {
      const name = a.trim();
      if (name && !known.has(name.toLowerCase()) && !extraAttendees.some((e) => e.toLowerCase() === name.toLowerCase())) {
        extraAttendees.push(name);
      }
    }
  }
  const intervieweeRows: DocCell[][] = [
    ...(engagement?.stakeholders ?? []).map(
      (s: { name: string; role: string | null; domain: string | null; raci: string | null }): DocCell[] => [
        s.name,
        s.role ?? "—",
        s.domain ?? "—",
        s.raci ? (RACI_LABEL[s.raci] ?? s.raci) : "—",
      ],
    ),
    ...extraAttendees.map((name): DocCell[] => [name, "—", "—", "—"]),
  ];
  const interviewees: Omit<DocSection, "n"> = {
    title: "People Interviewed",
    columns: ["Name", "Role", "Domain", "RACI"],
    rows: intervieweeRows,
    empty: "No interviewees or stakeholders were recorded for this assessment.",
  };

  return {
    statement: [statement],
    heatmap: [heatmap],
    findings: [findings],
    actionPlans: [actionPlans],
    pathway: pathwaySections,
    interviewees: [interviewees],
  };
}

/** Order section bodies by the assessment's layout, assigning sequential numbers. */
function orderSectionsByLayout(
  layout: { key: string; enabled: boolean }[],
  byKey: Record<string, Array<Omit<DocSection, "n">>>,
): DocSection[] {
  const sections: DocSection[] = [];
  for (const cfg of layout) {
    if (!cfg.enabled) continue;
    for (const s of byKey[cfg.key] ?? []) {
      sections.push({ ...s, n: String(sections.length + 1).padStart(2, "0") });
    }
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Export-doc assembly per type (PDF-friendly section tables).
// ---------------------------------------------------------------------------
async function buildExportDoc(
  type: DeliverableType,
  id: string,
  ctx: { organizationId: string; db: any; engagement: string; preparedBy: string },
): Promise<DeliverableDocData> {
  const base = {
    id,
    engagement: ctx.engagement,
    period: "Q2 2026",
    preparedBy: ctx.preparedBy,
  };

  if (type === "risk") {
    // Org-wide risk/findings register (the standalone /deliverables/risk page).
    const { scorecard, rows } = await getRiskDeliverableData(ctx.organizationId, ctx.db);
    return {
      ...base,
      type,
      eyebrow: "Cybersecurity Assessment",
      title: "Risk & Findings Assessment",
      scorecard: scorecard as DeliverableDocData["scorecard"],
      findings: rows.map((r) => ({
        identifier: r.identifier,
        title: r.title,
        likelihood: r.likelihood,
        impact: r.impact,
        domain: r.domain,
      })),
    };
  }

  if (type === "risk-exec") {
    // Per-assessment executive summary (mirrors the on-screen RiskExecutiveBody
    // section order): Statement → Risk Heatmap → Action Plans → Risks →
    // Exploitation Pathway → Findings → People Interviewed.
    const data = await getRiskExecutiveData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment project not found" });

    const [actionItems, pathways, engagement] = await Promise.all([
      ctx.db.actionPlanItem.findMany({
        where: { organizationId: ctx.organizationId, assessmentKind: AssessmentKind.RISK, assessmentId: id },
        include: { Owner: { select: { name: true } } },
        orderBy: [{ riskReduction: "desc" }, { createdAt: "asc" }],
      }),
      ctx.db.pathway.findMany({
        where: { organizationId: ctx.organizationId, assessmentKind: AssessmentKind.RISK, assessmentId: id },
        include: { steps: { orderBy: { order: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      ctx.db.engagement.findFirst({
        where: { organizationId: ctx.organizationId, assessmentKind: AssessmentKind.RISK, assessmentId: id },
        include: {
          stakeholders: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          sessions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      }),
    ]);

    // Interviewees: stakeholders + session attendees not already named as one.
    const known = new Set(
      (engagement?.stakeholders ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()),
    );
    const extraAttendees: string[] = [];
    for (const sess of engagement?.sessions ?? []) {
      for (const a of sess.attendees as string[]) {
        const name = a.trim();
        if (
          name &&
          !known.has(name.toLowerCase()) &&
          !extraAttendees.some((e) => e.toLowerCase() === name.toLowerCase())
        ) {
          extraAttendees.push(name);
        }
      }
    }

    const statementSection: Omit<DocSection, "n"> = {
      title: "Executive Statement",
      columns: [],
      rows: [],
      body: data.executiveStatement?.trim()
        ? data.executiveStatement
        : "No executive statement was provided for this assessment.",
    };

    // Risk Heatmap — sized + colored by the assessment's matrix. Only scored
    // findings (L,I against the matrix) plot as dots; the rest list in Findings.
    let heatmapSection: Omit<DocSection, "n">;
    if (data.matrix) {
      const g = buildHeatmapGrid(
        data.matrix.scales,
        data.matrix.thresholds,
        data.matrix.outputScaleMax,
      );
      const dots = data.rows
        .filter((r) => r.scored)
        .map((r) => {
          const colIndex = g.cols.findIndex((c) => c.value === r.likelihood);
          const rowIndex = g.rows.findIndex((rr) => rr.value === r.impact);
          return colIndex >= 0 && rowIndex >= 0
            ? { colIndex, rowIndex, color: r.severityColor, label: String(r.displayNumber) }
            : null;
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
      const bandCount = new Map<string, number>();
      for (const r of data.rows) if (r.scored) bandCount.set(r.severityLabel, (bandCount.get(r.severityLabel) ?? 0) + 1);
      const legend = [...data.matrix.thresholds]
        .sort((a, b) => a.minValue - b.minValue)
        .map((t) => ({ label: t.label, color: t.color, count: bandCount.get(t.label) ?? 0 }));
      const heatmap: HeatmapGridData = {
        cols: g.cols,
        rows: g.rows,
        cells: g.cells.map((row) => row.map((c) => ({ color: c.color, score: c.score }))),
        dots,
        legend,
      };
      heatmapSection = { title: "Risk Heatmap", columns: [], rows: [], heatmap };
    } else {
      heatmapSection = {
        title: "Risk Heatmap",
        columns: [],
        rows: [],
        body: "No risk matrix is configured for this assessment.",
      };
    }

    const actionPlansSection: Omit<DocSection, "n"> = {
      title: "Action Plans",
      columns: ["ID", "Action", "Owner", "Effort", "Timeline", "Risk↓"],
      rows: actionItems.map(
        (a: {
          identifier: string;
          title: string;
          Owner: { name: string } | null;
          ownerTeam: string | null;
          effort: string;
          timelineEstimate: string;
          riskReduction: number;
        }) => [
          { text: a.identifier, mono: true },
          a.title,
          a.Owner?.name ?? a.ownerTeam ?? "—",
          titleCaseEnum(a.effort),
          a.timelineEstimate,
          { text: String(a.riskReduction), mono: true },
        ],
      ),
      empty: "No remediation initiatives have been planned yet.",
    };

    const risksSection: Omit<DocSection, "n"> = {
      title: "Risks",
      columns: ["ID", "Risk", "L×I", "Score", "Treatment", "Severity"],
      rows: data.risks.map((r) => [
        { text: r.identifier ?? "—", mono: true },
        r.title,
        {
          text:
            r.likelihood != null && r.impact != null
              ? `${fmtNum(r.likelihood)}×${fmtNum(r.impact)}`
              : "—",
          mono: true,
        },
        { text: r.score != null ? fmtNum(r.score) : "—", mono: true },
        r.treatment ? titleCaseEnum(r.treatment) : "—",
        { text: r.severityLabel, color: r.severityColor },
      ]),
      empty: "No risks have been raised in this assessment.",
    };

    let pathwaySections: Array<Omit<DocSection, "n">>;
    if (pathways.length === 0) {
      pathwaySections = [
        {
          title: "Exploitation Pathway",
          columns: [],
          rows: [],
          body: "No exploitation pathway has been modeled for this assessment.",
        },
      ];
    } else {
      pathwaySections = (pathways as Array<{
        name: string;
        verdict: string | null;
        narrative: string | null;
        blastRadius: string | null;
        steps: Array<{ order: number; tactic: string; technique: string; mitreTid: string | null }>;
      }>).map((p) => {
        const parts: string[] = [];
        if (p.verdict?.trim()) parts.push(`Verdict: ${p.verdict.trim()}`);
        if (p.narrative?.trim()) parts.push(p.narrative.trim());
        if (p.blastRadius?.trim()) parts.push(`Blast radius: ${p.blastRadius.trim()}`);
        return {
          title: pathways.length > 1 ? `Exploitation Pathway — ${p.name}` : "Exploitation Pathway",
          columns: ["#", "Tactic", "Technique", "MITRE"],
          rows: p.steps.map((s) => [
            { text: String(s.order), mono: true },
            s.tactic,
            s.technique,
            { text: s.mitreTid ?? "—", mono: true },
          ]),
          body: parts.length ? parts.join("\n\n") : undefined,
          empty: "No ATT&CK steps recorded for this pathway.",
        } satisfies Omit<DocSection, "n">;
      });
    }

    const findingsSection: Omit<DocSection, "n"> = {
      title: "Findings",
      columns: ["ID", "Finding", "Domain", "L×I", "Severity"],
      rows: data.rows.map((r) => [
        { text: r.identifier, mono: true },
        r.title,
        r.domain ?? "—",
        { text: r.likelihood && r.impact ? `${r.likelihood}×${r.impact}` : "—", mono: true },
        { text: r.severityLabel, color: r.severityColor },
      ]),
      empty: "No findings have been recorded in this assessment.",
    };

    const intervieweeRows: DocCell[][] = [
      ...(engagement?.stakeholders ?? []).map(
        (s: { name: string; role: string | null; domain: string | null; raci: string | null }): DocCell[] => [
          s.name,
          s.role ?? "—",
          s.domain ?? "—",
          s.raci ? (RACI_LABEL[s.raci] ?? s.raci) : "—",
        ],
      ),
      ...extraAttendees.map((name): DocCell[] => [name, "—", "—", "—"]),
    ];
    const intervieweesSection: Omit<DocSection, "n"> = {
      title: "People Interviewed",
      columns: ["Name", "Role", "Domain", "RACI"],
      rows: intervieweeRows,
      empty: "No interviewees or stakeholders were recorded for this assessment.",
    };

    // Assemble in the assessment's configured order, skipping hidden sections.
    const byKey: Record<string, Array<Omit<DocSection, "n">>> = {
      statement: [statementSection],
      graphs: [heatmapSection],
      actionPlans: [actionPlansSection],
      risks: [risksSection],
      pathway: pathwaySections,
      findings: [findingsSection],
      interviewees: [intervieweesSection],
    };
    const sections: DocSection[] = [];
    for (const cfg of data.layout) {
      if (!cfg.enabled) continue;
      for (const s of byKey[cfg.key] ?? []) {
        sections.push({ ...s, n: String(sections.length + 1).padStart(2, "0") });
      }
    }

    return {
      ...base,
      type,
      eyebrow: "Cybersecurity Assessment",
      title: data.title,
      scorecard: data.scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  if (type === "compliance") {
    const data = await getComplianceDeliverableData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Compliance assessment not found" });
    const cross = await getExecCrossCutting(ctx.organizationId, ctx.db, AssessmentKind.COMPLIANCE, id);
    const ccs = await execCrossCuttingSections(ctx.db, ctx.organizationId, AssessmentKind.COMPLIANCE, id, cross.matrix, cross.rows, cross.executiveStatement);
    const native: Record<string, Array<Omit<DocSection, "n">>> = {
      controls: [
        {
          title: "Control Status",
          columns: ["Control", "Title", "Status"],
          rows: data.controls.map((c) => [
            { text: c.controlId, mono: true },
            c.title,
            { text: c.status.replace(/_/g, " "), color: STATUS_PDF_COLOR[c.status] },
          ]),
          empty: "No controls scored.",
        },
      ],
      gaps: [
        {
          title: "Gap Register",
          columns: ["Control", "Title", "Gap", "Remediation"],
          rows: data.gaps.map((g) => [
            { text: g.controlId, mono: true },
            g.title,
            g.gapDescription ?? "—",
            g.remediationPlan ?? "—",
          ]),
          empty: "No gaps — all controls compliant or N/A.",
        },
      ],
    };
    const sections = orderSectionsByLayout(
      normalizeLayout("COMPLIANCE", cross.execSummaryLayoutRaw),
      { ...ccs, ...native },
    );
    return {
      ...base,
      type,
      eyebrow: `Compliance · ${data.framework}`,
      title: data.title,
      scorecard: data.scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  if (type === "maturity") {
    const data = await getMaturityDeliverableData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Maturity assessment not found" });
    const below = data.domains.filter(
      (d) => !d.isNotApplicable && d.currentLevel != null && d.targetLevel != null && d.currentLevel < d.targetLevel,
    );
    const cross = await getExecCrossCutting(ctx.organizationId, ctx.db, AssessmentKind.MATURITY, id);
    const ccs = await execCrossCuttingSections(ctx.db, ctx.organizationId, AssessmentKind.MATURITY, id, cross.matrix, cross.rows, cross.executiveStatement);
    const native: Record<string, Array<Omit<DocSection, "n">>> = {
      domains: [
        {
          title: "Domain Maturity",
          columns: ["Domain", "Current", "Target"],
          rows: data.domains.map((d) => [
            d.name,
            { text: d.isNotApplicable ? "N/A" : d.currentLevel != null ? String(d.currentLevel) : "—", mono: true },
            { text: d.targetLevel != null ? String(d.targetLevel) : "—", mono: true },
          ]),
          empty: "No domains scored.",
        },
      ],
      belowTarget: [
        {
          title: "Below Target",
          columns: ["Domain", "Current", "Target", "Gap"],
          rows: below.map((d) => [
            d.name,
            { text: String(d.currentLevel), mono: true },
            { text: String(d.targetLevel), mono: true },
            { text: String((d.targetLevel ?? 0) - (d.currentLevel ?? 0)), mono: true, color: STATUS_PDF_COLOR.NON_COMPLIANT },
          ]),
          empty: "All scored domains meet or exceed their target.",
        },
      ],
    };
    const sections = orderSectionsByLayout(
      normalizeLayout("MATURITY", cross.execSummaryLayoutRaw),
      { ...ccs, ...native },
    );
    return {
      ...base,
      type,
      eyebrow: `Maturity · ${data.framework}`,
      title: data.title,
      scorecard: data.scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  if (type === "vendor") {
    const data = await getVendorDeliverableData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor assessment not found" });
    const cross = await getExecCrossCutting(ctx.organizationId, ctx.db, AssessmentKind.VENDOR, id);
    const ccs = await execCrossCuttingSections(ctx.db, ctx.organizationId, AssessmentKind.VENDOR, id, cross.matrix, cross.rows, cross.executiveStatement);
    const native: Record<string, Array<Omit<DocSection, "n">>> = {
      vendorSummary: [
        {
          title: "Assessment Summary",
          columns: ["Field", "Value"],
          rows: [
            ["Status", data.statusLabel],
            ["Recommendation", data.recommendation],
            ["Risk tier", data.riskTier],
            ["Risk score", data.riskScore == null ? "—" : `${data.riskScore} / 100`],
          ],
          body: data.summary ?? undefined,
        },
      ],
      questionnaires: [
        {
          title: "Questionnaire Completion",
          columns: ["Questionnaire", "Status", "Score"],
          rows: data.questionnaires.map((q) => [
            q.name,
            q.status.replace(/_/g, " "),
            { text: q.overallScore == null ? "—" : `${Math.round(q.overallScore)}%`, mono: true },
          ]),
          empty: "No questionnaires are attached to this assessment.",
        },
      ],
    };
    const sections = orderSectionsByLayout(
      normalizeLayout("VENDOR", cross.execSummaryLayoutRaw),
      { ...ccs, ...native },
    );
    return {
      ...base,
      type,
      eyebrow: `Vendor Assessment · ${data.vendorName}`,
      title: data.title,
      scorecard: data.scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  if (type === "bia") {
    const data = await getBiaDeliverableData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Business process not found" });
    const cross = await getExecCrossCutting(ctx.organizationId, ctx.db, AssessmentKind.BIA, id);
    const ccs = await execCrossCuttingSections(ctx.db, ctx.organizationId, AssessmentKind.BIA, id, cross.matrix, cross.rows, cross.executiveStatement);
    const native: Record<string, Array<Omit<DocSection, "n">>> = {
      criticality: [
        {
          title: "Criticality & Recovery",
          columns: ["Field", "Value"],
          rows: [
            ["Criticality tier", data.tierName ?? "—"],
            ["RTO", data.rto ?? "—"],
            ["RPO", data.rpo ?? "—"],
          ],
          body: data.workaroundProcedure ?? undefined,
        },
      ],
      impacts: [
        {
          title: "Impact by Category",
          columns: ["Category", "Score"],
          rows: data.impacts.map((i) => [i.category, { text: `${i.score} / 5`, mono: true }]),
          empty: "No impact scores have been recorded for this process yet.",
        },
      ],
      dependencies: [
        {
          title: "Dependencies",
          columns: ["ID", "Process", "Tier"],
          rows: data.dependencies.map((d) => [
            { text: d.identifier, mono: true },
            d.name,
            d.tier ?? "—",
          ]),
          empty: "This process has no recorded upstream dependencies.",
        },
      ],
      biaRisks: [
        {
          title: "Linked Risks",
          columns: ["ID", "Risk", "Severity", "Status"],
          rows: data.risks.map((r) => [
            { text: r.identifier, mono: true },
            r.title,
            r.severityLabel ?? "—",
            r.status.replace(/_/g, " "),
          ]),
          empty: "No risks are linked to this process.",
        },
      ],
    };
    const sections = orderSectionsByLayout(
      normalizeLayout("BIA", cross.execSummaryLayoutRaw),
      { ...ccs, ...native },
    );
    return {
      ...base,
      type,
      eyebrow: data.businessFunction
        ? `Business Impact Analysis · ${data.businessFunction}`
        : "Business Impact Analysis",
      title: data.title,
      scorecard: data.scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  if (type === "roadmap") {
    const { scorecard, actions } = await getRoadmapDeliverableData(ctx.organizationId, ctx.db);
    const grouped = groupActionsByPhase(actions);
    const sections: DocSection[] = PHASES.map((phase, i) => ({
      n: String(i + 1).padStart(2, "0"),
      title: phase,
      columns: ["Action", "Owner", "Effort", "Cost", "Risk↓"],
      rows: grouped[phase].map((a) => [
        a.title,
        a.owner ?? "—",
        { text: a.effort, mono: true },
        { text: "$".repeat(a.costBand), mono: true },
        { text: String(a.impact), mono: true },
      ]),
      empty: "No actions in this window.",
    }));
    return {
      ...base,
      type,
      eyebrow: "Action Plan",
      title: "Remediation Roadmap",
      scorecard: scorecard as DeliverableDocData["scorecard"],
      findings: [],
      sections,
    };
  }

  // stub
  return buildStubDoc(id, ctx.organizationId, ctx.preparedBy, ctx.db);
}
