"use client";

/**
 * Deliverable client — type-routes to the right body inside the shared shell.
 *
 * The shell + single FindingDrawerProvider are mounted once; each body plugs in.
 * Cover + scorecard come from the per-type tRPC procedure; export sends {type,id}.
 */

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { DeliverableShell } from "@/components/deliverable/DeliverableShell";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";
import { RiskFindingsBody } from "@/components/deliverable/bodies/RiskFindingsBody";
import { ComplianceBody } from "@/components/deliverable/bodies/ComplianceBody";
import { MaturityBody } from "@/components/deliverable/bodies/MaturityBody";
import { RoadmapBody } from "@/components/deliverable/bodies/RoadmapBody";
import { DeliverableSection } from "@/components/deliverable/DeliverableSection";
import { Skeleton } from "@/components/ui/skeleton";
import type { DeliverableCover, ScorecardCellConfig } from "@/components/deliverable/types";

export type DeliverableType = "risk" | "compliance" | "maturity" | "roadmap" | "stub";

export function DeliverableClient({ type, id }: { type: DeliverableType; id: string }) {
  const exportPdf = api.deliverable.exportPdf.useMutation();
  const [exporting, setExporting] = useState(false);

  const risk = api.deliverable.getRiskBody.useQuery({ id }, { enabled: type === "risk" });
  const compliance = api.deliverable.getComplianceBody.useQuery({ id }, { enabled: type === "compliance" });
  const maturity = api.deliverable.getMaturityBody.useQuery({ id }, { enabled: type === "maturity" });
  const roadmap = api.deliverable.getRoadmapBody.useQuery({ id }, { enabled: type === "roadmap" });
  const stub = api.deliverable.getStub.useQuery({ id }, { enabled: type === "stub" });

  const active =
    type === "risk"
      ? risk
      : type === "compliance"
        ? compliance
        : type === "maturity"
          ? maturity
          : type === "roadmap"
            ? roadmap
            : stub;

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportPdf.mutateAsync({ type, id });
      downloadBase64Pdf(res.data, res.filename);
      toast.success(`Exported ${res.filename}`);
    } catch (err) {
      toast.error("PDF export failed");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  if (active.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[940px] p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-4 h-[520px] w-full" />
      </div>
    );
  }
  if (active.error || !active.data) {
    return (
      <div className="mx-auto w-full max-w-[940px] p-6 text-sm text-muted-foreground">
        Unable to load deliverable{active.error ? `: ${active.error.message}` : ""}.
      </div>
    );
  }

  // Normalize cover + scorecard across the (flat) stub and (nested) body shapes.
  let cover: DeliverableCover;
  let scorecard: ScorecardCellConfig[];
  let body: React.ReactNode;

  if (type === "stub") {
    const d = stub.data!;
    cover = { eyebrow: d.eyebrow, title: d.title, engagement: d.engagement, period: d.period, preparedBy: d.preparedBy };
    scorecard = d.scorecard;
    body = (
      <DeliverableSection n="01" title="Findings">
        <div className="overflow-hidden rounded-lg border">
          {d.findings.map((f) => (
            <div key={f.identifier} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="font-mono text-xs text-muted-foreground">{f.identifier}</span>
              <span className="flex-1 text-sm font-medium text-foreground">{f.title}</span>
              <span className="font-mono text-xs text-muted-foreground">{f.likelihood}×{f.impact}</span>
            </div>
          ))}
        </div>
      </DeliverableSection>
    );
  } else if (type === "risk") {
    const d = risk.data!;
    cover = d.cover;
    scorecard = d.scorecard;
    body = <RiskFindingsBody rows={d.rows} />;
  } else if (type === "compliance") {
    const d = compliance.data!;
    cover = d.cover;
    scorecard = d.scorecard;
    body = <ComplianceBody controls={d.controls} gaps={d.gaps} />;
  } else if (type === "maturity") {
    const d = maturity.data!;
    cover = d.cover;
    scorecard = d.scorecard;
    body = <MaturityBody domains={d.domains} overallLevel={d.overallLevel} targetLevel={d.targetLevel} />;
  } else {
    const d = roadmap.data!;
    cover = d.cover;
    scorecard = d.scorecard;
    body = <RoadmapBody actions={d.actions} />;
  }

  return (
    <FindingDrawerProvider>
      <DeliverableShell
        cover={cover}
        scorecard={scorecard}
        onExportPdf={handleExport}
        exporting={exporting}
        toolbarEyebrow={`Deliverable · ${type}`}
      >
        {body}
      </DeliverableShell>
    </FindingDrawerProvider>
  );
}

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
