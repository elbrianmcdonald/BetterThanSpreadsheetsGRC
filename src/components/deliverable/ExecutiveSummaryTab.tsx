"use client";

/**
 * Shared "Executive Summary" tab.
 *
 * Renders the per-type consulting deliverable inline (DeliverableShell + the
 * matching body) for any assessment workspace, keyed by the assessment id and
 * its {@link AssessmentKind}. One source of truth so every workspace (compliance,
 * risk, maturity, vendor, BIA) shows an identical deliverable surface.
 *
 * tRPC hooks can't be selected dynamically, so all five body queries are called
 * unconditionally and gated via `enabled` on the active kind; only the matching
 * one fires. The active query's `{ data, isLoading, error }` drives rendering.
 *
 * Export PDF is offered only for kinds the `deliverableTypeSchema` enum supports
 * (compliance / risk / maturity). VENDOR and BIA have no PDF export — the in-app
 * body is the deliverable.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import type { AssessmentKind } from "@/components/engagement/types";
import { DeliverableShell } from "@/components/deliverable/DeliverableShell";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import { ComplianceBody } from "@/components/deliverable/bodies/ComplianceBody";
import { RiskFindingsBody } from "@/components/deliverable/bodies/RiskFindingsBody";
import { MaturityBody } from "@/components/deliverable/bodies/MaturityBody";
import { VendorBody } from "@/components/deliverable/bodies/VendorBody";
import { BIABody } from "@/components/deliverable/bodies/BIABody";

/** Maps each kind to the `exportPdf` `type` value, or null when unsupported. */
const PDF_TYPE: Record<AssessmentKind, "compliance" | "risk" | "maturity" | null> = {
  COMPLIANCE: "compliance",
  RISK: "risk",
  MATURITY: "maturity",
  VENDOR: null,
  BIA: null,
};

/** Lowercase eyebrow label per kind for the deliverable toolbar. */
const EYEBROW: Record<AssessmentKind, string> = {
  COMPLIANCE: "Deliverable · compliance",
  RISK: "Deliverable · risk",
  MATURITY: "Deliverable · maturity",
  VENDOR: "Deliverable · vendor",
  BIA: "Deliverable · BIA",
};

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExecutiveSummaryTab({
  assessmentKind,
  assessmentId,
}: {
  assessmentKind: AssessmentKind;
  assessmentId: string;
}) {
  // All five queries are declared unconditionally (Rules of Hooks); only the
  // one matching `assessmentKind` is enabled, so only it fetches.
  const compliance = api.deliverable.getComplianceBody.useQuery(
    { id: assessmentId },
    { enabled: assessmentKind === "COMPLIANCE" },
  );
  const risk = api.deliverable.getRiskBody.useQuery(
    { id: assessmentId },
    { enabled: assessmentKind === "RISK" },
  );
  const maturity = api.deliverable.getMaturityBody.useQuery(
    { id: assessmentId },
    { enabled: assessmentKind === "MATURITY" },
  );
  const vendor = api.deliverable.getVendorBody.useQuery(
    { id: assessmentId },
    { enabled: assessmentKind === "VENDOR" },
  );
  const bia = api.deliverable.getBiaBody.useQuery(
    { id: assessmentId },
    { enabled: assessmentKind === "BIA" },
  );

  const active =
    assessmentKind === "COMPLIANCE"
      ? compliance
      : assessmentKind === "RISK"
        ? risk
        : assessmentKind === "MATURITY"
          ? maturity
          : assessmentKind === "VENDOR"
            ? vendor
            : bia;

  const { isLoading, error } = active;

  const pdfType = PDF_TYPE[assessmentKind];
  const exportPdf = api.deliverable.exportPdf.useMutation();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!pdfType) return;
    setExporting(true);
    try {
      const res = await exportPdf.mutateAsync({ type: pdfType, id: assessmentId });
      downloadBase64Pdf(res.data, res.filename);
      toast.success(`Exported ${res.filename}`);
    } catch (err) {
      toast.error("PDF export failed");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !active.data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Unable to load executive summary
        {error ? `: ${error.message}` : ""}.
      </div>
    );
  }

  // PDF button is omitted for kinds the export pipeline doesn't support
  // (passing undefined hides the button in DeliverableShell).
  const onExportPdf = pdfType ? handleExport : undefined;

  return (
    <FindingDrawerProvider>
      {assessmentKind === "COMPLIANCE" && compliance.data ? (
        <DeliverableShell
          cover={compliance.data.cover}
          scorecard={compliance.data.scorecard}
          onExportPdf={onExportPdf}
          exporting={exporting}
          toolbarEyebrow={EYEBROW.COMPLIANCE}
        >
          <ComplianceBody
            controls={compliance.data.controls}
            gaps={compliance.data.gaps}
          />
        </DeliverableShell>
      ) : null}

      {assessmentKind === "RISK" && risk.data ? (
        <DeliverableShell
          cover={risk.data.cover}
          scorecard={risk.data.scorecard}
          onExportPdf={onExportPdf}
          exporting={exporting}
          toolbarEyebrow={EYEBROW.RISK}
        >
          <RiskFindingsBody rows={risk.data.rows} />
        </DeliverableShell>
      ) : null}

      {assessmentKind === "MATURITY" && maturity.data ? (
        <DeliverableShell
          cover={maturity.data.cover}
          scorecard={maturity.data.scorecard}
          onExportPdf={onExportPdf}
          exporting={exporting}
          toolbarEyebrow={EYEBROW.MATURITY}
        >
          <MaturityBody
            domains={maturity.data.domains}
            overallLevel={maturity.data.overallLevel}
            targetLevel={maturity.data.targetLevel}
          />
        </DeliverableShell>
      ) : null}

      {assessmentKind === "VENDOR" && vendor.data ? (
        <DeliverableShell
          cover={vendor.data.cover}
          scorecard={vendor.data.scorecard}
          onExportPdf={onExportPdf}
          exporting={exporting}
          toolbarEyebrow={EYEBROW.VENDOR}
        >
          <VendorBody
            findings={vendor.data.findings}
            questionnaires={vendor.data.questionnaires}
            statusLabel={vendor.data.statusLabel}
            recommendation={vendor.data.recommendation}
            riskScore={vendor.data.riskScore}
            riskTier={vendor.data.riskTier}
            summary={vendor.data.summary}
          />
        </DeliverableShell>
      ) : null}

      {assessmentKind === "BIA" && bia.data ? (
        <DeliverableShell
          cover={bia.data.cover}
          scorecard={bia.data.scorecard}
          onExportPdf={onExportPdf}
          exporting={exporting}
          toolbarEyebrow={EYEBROW.BIA}
        >
          <BIABody
            impacts={bia.data.impacts}
            dependencies={bia.data.dependencies}
            risks={bia.data.risks}
            tierName={bia.data.tierName}
            rto={bia.data.rto}
            rpo={bia.data.rpo}
            assessmentStatusLabel={bia.data.assessmentStatusLabel}
            workaroundProcedure={bia.data.workaroundProcedure}
          />
        </DeliverableShell>
      ) : null}
    </FindingDrawerProvider>
  );
}
