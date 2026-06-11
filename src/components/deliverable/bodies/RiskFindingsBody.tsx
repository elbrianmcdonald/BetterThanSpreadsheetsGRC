"use client";

/**
 * Story 17.2: Risk / Findings deliverable body (AC8-AC21).
 *
 * Presentational — receives pre-shaped `RiskRow[]` via props (the orchestrator
 * wires the tRPC procedure). Renders, inside DeliverableSection slots:
 *   1. Heatmap + impact axis labels + summary strip.
 *   2. Severity chips → filter applied to BOTH the heatmap and the register.
 *   3. The ranked findings register (DESC by L×I, identifier tie-break).
 * Rows and heatmap dots open the SHARED Finding Drawer; this body owns NO drawer.
 */

import { useMemo, useState } from "react";
import { DeliverableSection } from "../DeliverableSection";
import { useFindingDrawer } from "../FindingDrawerProvider";
import { RiskHeatmap } from "../RiskHeatmap";
import { HeatmapYNums } from "../HeatmapYNums";
import { SeverityChips } from "../SeverityChips";
import { SummaryStrip } from "../SummaryStrip";
import { SevBadge } from "../SevBadge";
import type { DeliverableSeverity } from "../types";
import type { RiskRow } from "@/server/services/deliverableRiskData";

function sortRows(rows: RiskRow[]): RiskRow[] {
  return [...rows].sort((a, b) => {
    const sa = a.likelihood * a.impact;
    const sb = b.likelihood * b.impact;
    if (sb !== sa) return sb - sa;
    return a.identifier.localeCompare(b.identifier);
  });
}

export function RiskFindingsBody({ rows }: { rows: RiskRow[] }) {
  const { openFinding } = useFindingDrawer();
  const [severity, setSeverity] = useState<DeliverableSeverity | null>(null);

  const ordered = useMemo(() => sortRows(rows), [rows]);

  // Counts always reflect the UNFILTERED totals (AC16).
  const counts = useMemo(() => {
    const c: Record<DeliverableSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const r of rows) c[r.severityTier]++;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (severity ? ordered.filter((r) => r.severityTier === severity) : ordered),
    [ordered, severity],
  );

  return (
    <>
      <DeliverableSection n="01" title="Risk Heatmap">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex items-stretch gap-2">
            <HeatmapYNums cell={88} />
            <div className="flex flex-col gap-2">
              <RiskHeatmap rows={visible} cell={88} selectedSeverity={severity} />
              <div className="eyebrow text-center">Likelihood 1–5</div>
            </div>
          </div>
          <div className="flex-1">
            <SummaryStrip total={rows.length} counts={counts} />
          </div>
        </div>
      </DeliverableSection>

      <DeliverableSection n="02" title="Findings Register">
        <div className="mb-4">
          <SeverityChips value={severity} onChange={setSeverity} counts={counts} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                {["ID", "Finding", "Domain", "Organizations", "Effort", "L×I", "Severity"].map(
                  (h) => (
                    <th
                      key={h}
                      className="eyebrow border-b pb-2 pr-4 font-normal"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <RegisterRow key={row.id} row={row} onOpen={() => openFinding(row)} />
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No findings match the selected severity.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DeliverableSection>
    </>
  );
}

function RegisterRow({ row, onOpen }: { row: RiskRow; onOpen: () => void }) {
  const score = row.likelihood * row.impact;
  return (
    <tr
      onClick={onOpen}
      className="group border-b transition-colors hover:bg-muted"
      style={{ cursor: "pointer", borderColor: "var(--border)" }}
    >
      <td className="py-3 pr-4 align-top">
        <IdTag>{row.identifier}</IdTag>
      </td>
      <td className="py-3 pr-4 align-top">
        <div className="font-medium text-foreground">{row.title}</div>
        {row.asset ? (
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{row.asset}</div>
        ) : null}
      </td>
      <td className="py-3 pr-4 align-top text-muted-foreground">{row.domain ?? "—"}</td>
      <td className="py-3 pr-4 align-top">
        <OrgsCell organizations={row.organizations} />
      </td>
      <td className="py-3 pr-4 align-top text-muted-foreground">{row.effort ?? "—"}</td>
      <td className="py-3 pr-4 align-top font-mono tabular-nums text-foreground">
        {row.likelihood}×{row.impact}
        <span className="ml-1 text-muted-foreground">({score})</span>
      </td>
      <td className="py-3 align-top">
        <SevBadge severity={row.severityTier} size="sm" />
      </td>
    </tr>
  );
}

function OrgsCell({ organizations }: { organizations: string[] }) {
  if (organizations.length === 0) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = organizations;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-foreground">{first}</span>
      {rest.length > 0 ? (
        <span className="font-mono text-xs text-muted-foreground">+{rest.length}</span>
      ) : null}
    </span>
  );
}

/** Mono ID pill, matching the drawer header's IdTag styling. */
function IdTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}
