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
import { UserRole } from "@prisma/client";
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
} from "@/server/services/deliverablePdf";
import {
  getRiskDeliverableData,
  type RiskRow,
} from "@/server/services/deliverableRiskData";
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

const deliverableTypeSchema = z.enum(["risk", "compliance", "maturity", "roadmap", "stub"]);
type DeliverableType = z.infer<typeof deliverableTypeSchema>;

/** oklch status colors for PDF cells (mirrors globals.css tokens). */
const STATUS_PDF_COLOR: Record<string, string> = {
  COMPLIANT: "oklch(0.490 0.075 160)",
  PARTIALLY_COMPLIANT: "oklch(0.520 0.100 75)",
  NON_COMPLIANT: "oklch(0.495 0.155 25)",
  NOT_APPLICABLE: "oklch(0.534 0.015 252)",
  NOT_ASSESSED: "oklch(0.60 0.018 252)",
};

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
      return { cover, scorecard: data.scorecard, controls: data.controls, gaps: data.gaps };
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
      return {
        cover,
        scorecard: data.scorecard,
        domains: data.domains,
        overallLevel: data.overallLevel,
        targetLevel: data.targetLevel,
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
    const { scorecard, rows } = await getRiskDeliverableData(ctx.organizationId, ctx.db);
    return {
      ...base,
      type,
      eyebrow: "Cybersecurity Assessment",
      title: "Risk & Findings Assessment",
      scorecard: scorecard as DeliverableDocData["scorecard"],
      findings: rows.map((r: RiskRow) => ({
        identifier: r.identifier,
        title: r.title,
        likelihood: r.likelihood,
        impact: r.impact,
        domain: r.domain,
      })),
    };
  }

  if (type === "compliance") {
    const data = await getComplianceDeliverableData(ctx.organizationId, ctx.db, id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Compliance assessment not found" });
    const sections: DocSection[] = [
      {
        n: "01",
        title: "Control Status",
        columns: ["Control", "Title", "Status"],
        rows: data.controls.map((c) => [
          { text: c.controlId, mono: true },
          c.title,
          { text: c.status.replace(/_/g, " "), color: STATUS_PDF_COLOR[c.status] },
        ]),
        empty: "No controls scored.",
      },
      {
        n: "02",
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
    ];
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
    const sections: DocSection[] = [
      {
        n: "01",
        title: "Domain Maturity",
        columns: ["Domain", "Current", "Target"],
        rows: data.domains.map((d) => [
          d.name,
          { text: d.isNotApplicable ? "N/A" : d.currentLevel != null ? String(d.currentLevel) : "—", mono: true },
          { text: d.targetLevel != null ? String(d.targetLevel) : "—", mono: true },
        ]),
        empty: "No domains scored.",
      },
      {
        n: "02",
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
    ];
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
