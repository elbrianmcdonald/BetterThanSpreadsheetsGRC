"use client";

/**
 * Bridge from Assessment (Bridge to Compliance Plan — Epic 2 UI).
 *
 * Picks a compliance or maturity assessment and bridges its gaps into the plan
 * as snapshot items, then refreshes the plan. Standards/org-control bridges will
 * appear here too once their router methods land.
 */

import { useState } from "react";
import { toast } from "sonner";
import { GitBranch } from "lucide-react";

import { api } from "@/trpc/react";

const KIND_LABEL: Record<string, string> = {
  COMPLIANCE: "compliance",
  MATURITY: "maturity",
  STANDARD: "standard",
  ORG_DEFICIENCY: "org controls",
};

export function BridgeFromAssessment({ planId }: { planId: string }) {
  const utils = api.useUtils();
  const { data: sources } = api.compliancePlan.listBridgeSources.useQuery();
  const bridgeCompliance = api.compliancePlan.bridgeComplianceAssessment.useMutation();
  const bridgeMaturity = api.compliancePlan.bridgeMaturityAssessment.useMutation();
  const bridgeStandard = api.compliancePlan.bridgeStandardExceptions.useMutation();
  const bridgeOrg = api.compliancePlan.bridgeOrgDeficiencies.useMutation();

  const [selected, setSelected] = useState("");
  const busy =
    bridgeCompliance.isPending || bridgeMaturity.isPending || bridgeStandard.isPending || bridgeOrg.isPending;

  const runBridge = (kind: string, id: string) => {
    switch (kind) {
      case "COMPLIANCE":
        return bridgeCompliance.mutateAsync({ planId, assessmentId: id });
      case "MATURITY":
        return bridgeMaturity.mutateAsync({ planId, assessmentId: id });
      case "STANDARD":
        return bridgeStandard.mutateAsync({ planId, standardId: id });
      case "ORG_DEFICIENCY":
        return bridgeOrg.mutateAsync({ planId });
      default:
        throw new Error("Unknown bridge source");
    }
  };

  const handleBridge = async () => {
    if (!selected) return;
    const idx = selected.indexOf(":");
    const kind = selected.slice(0, idx);
    const id = selected.slice(idx + 1);
    try {
      const res = await runBridge(kind, id);
      await utils.compliancePlan.get.invalidate({ id: planId });
      toast.success(`Bridged ${res.added} control${res.added === 1 ? "" : "s"} (${res.skipped} already present)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not bridge gaps");
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Bridge from assessment
        <select
          aria-label="Bridge from assessment"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-72 rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Select an assessment…</option>
          {(sources ?? []).map((s) => (
            <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
              {s.name} ({KIND_LABEL[s.kind] ?? s.kind.toLowerCase()})
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void handleBridge()}
        disabled={busy || selected === ""}
        className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        <GitBranch className="h-4 w-4" />
        Bridge gaps
      </button>
    </div>
  );
}
