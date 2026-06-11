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
import { RiskExecutiveBody } from "@/components/deliverable/bodies/RiskExecutiveBody";
import { AssessmentExecBody } from "@/components/deliverable/bodies/AssessmentExecBody";
import { ControlStatusGrid, GapRegister } from "@/components/deliverable/bodies/ComplianceBody";
import {
  MaturityDomainsContent,
  MaturityBelowTargetContent,
} from "@/components/deliverable/bodies/MaturityBody";
import {
  VendorSummaryContent,
  VendorQuestionnairesContent,
} from "@/components/deliverable/bodies/VendorBody";
import {
  BiaCriticalityContent,
  BiaImpactsContent,
  BiaDependenciesContent,
  BiaRisksContent,
} from "@/components/deliverable/bodies/BIABody";

/** Maps each kind to the `exportPdf` `type` value. */
const PDF_TYPE: Record<AssessmentKind, "compliance" | "risk-exec" | "maturity" | "vendor" | "bia"> = {
  COMPLIANCE: "compliance",
  RISK: "risk-exec",
  MATURITY: "maturity",
  VENDOR: "vendor",
  BIA: "bia",
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
  const risk = api.deliverable.getRiskExecBody.useQuery(
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
          <AssessmentExecBody
            assessmentKind="COMPLIANCE"
            assessmentId={assessmentId}
            canEdit={compliance.data.canEdit}
            executiveStatement={compliance.data.executiveStatement}
            layout={compliance.data.layout}
            matrix={compliance.data.matrix}
            rows={compliance.data.rows}
            nativeContent={{
              controls: <ControlStatusGrid controls={compliance.data.controls} />,
              gaps: <GapRegister gaps={compliance.data.gaps} />,
            }}
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
          <RiskExecutiveBody
            assessmentId={assessmentId}
            executiveStatement={risk.data.executiveStatement}
            canEdit={risk.data.canEdit}
            matrix={risk.data.matrix}
            layout={risk.data.layout}
            rows={risk.data.rows}
            risks={risk.data.risks}
          />
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
          <AssessmentExecBody
            assessmentKind="MATURITY"
            assessmentId={assessmentId}
            canEdit={maturity.data.canEdit}
            executiveStatement={maturity.data.executiveStatement}
            layout={maturity.data.layout}
            matrix={maturity.data.matrix}
            rows={maturity.data.rows}
            nativeContent={{
              domains: <MaturityDomainsContent domains={maturity.data.domains} />,
              belowTarget: <MaturityBelowTargetContent domains={maturity.data.domains} />,
            }}
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
          <AssessmentExecBody
            assessmentKind="VENDOR"
            assessmentId={assessmentId}
            canEdit={vendor.data.canEdit}
            executiveStatement={vendor.data.executiveStatement}
            layout={vendor.data.layout}
            matrix={vendor.data.matrix}
            rows={vendor.data.rows}
            nativeContent={{
              vendorSummary: (
                <VendorSummaryContent
                  statusLabel={vendor.data.statusLabel}
                  recommendation={vendor.data.recommendation}
                  riskTier={vendor.data.riskTier}
                  riskScore={vendor.data.riskScore}
                  summary={vendor.data.summary}
                />
              ),
              questionnaires: <VendorQuestionnairesContent questionnaires={vendor.data.questionnaires} />,
            }}
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
          <AssessmentExecBody
            assessmentKind="BIA"
            assessmentId={assessmentId}
            canEdit={bia.data.canEdit}
            executiveStatement={bia.data.executiveStatement}
            layout={bia.data.layout}
            matrix={bia.data.matrix}
            rows={bia.data.rows}
            nativeContent={{
              criticality: (
                <BiaCriticalityContent
                  tierName={bia.data.tierName}
                  rto={bia.data.rto}
                  rpo={bia.data.rpo}
                  workaroundProcedure={bia.data.workaroundProcedure}
                />
              ),
              impacts: <BiaImpactsContent impacts={bia.data.impacts} />,
              dependencies: <BiaDependenciesContent dependencies={bia.data.dependencies} />,
              biaRisks: <BiaRisksContent risks={bia.data.risks} />,
            }}
          />
        </DeliverableShell>
      ) : null}
    </FindingDrawerProvider>
  );
}
