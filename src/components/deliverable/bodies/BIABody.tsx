"use client";

/**
 * BIA (Business Impact Analysis) Deliverable — body.
 *
 * Presentational only: all data arrives via props (no tRPC). Renders, inside
 * the shared {@link DeliverableSection} primitives:
 *   01 Criticality & Recovery — tier / RTO / RPO recovery objectives + an
 *      optional workaround procedure block.
 *   02 Impact by Category     — per-category impact score bars.
 *   03 Dependencies           — upstream processes this process depends on.
 *   04 Linked Risks           — register rows; each opens the SHARED Finding
 *      Drawer (this body owns NO drawer).
 *
 * Colors resolve to design-system tokens only (no hardcoded hex), sans/mono.
 */

import { DeliverableSection } from "../DeliverableSection";
import { useFindingDrawer } from "../FindingDrawerProvider";
import type {
  BiaDependencyRow,
  BiaImpactRow,
  BiaRiskRow,
} from "@/server/services/deliverableBiaData";

const MAX_IMPACT = 5;

export function BIABody({
  impacts,
  dependencies,
  risks,
  tierName,
  rto,
  rpo,
  assessmentStatusLabel,
  workaroundProcedure,
}: {
  impacts: BiaImpactRow[];
  dependencies: BiaDependencyRow[];
  risks: BiaRiskRow[];
  tierName: string | null;
  rto: string | null;
  rpo: string | null;
  assessmentStatusLabel: string;
  workaroundProcedure: string | null;
}) {
  const { openFinding } = useFindingDrawer();

  return (
    <>
      <DeliverableSection
        n="01"
        title="Criticality & Recovery"
        right={<span className="eyebrow">{assessmentStatusLabel}</span>}
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Stat label="Criticality tier" value={tierName ?? "—"} />
          <Stat label="RTO" value={rto ?? "—"} />
          <Stat label="RPO" value={rpo ?? "—"} />
        </div>

        {workaroundProcedure ? (
          <div className="mt-5">
            <p className="eyebrow">Workaround procedure</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {workaroundProcedure}
            </p>
          </div>
        ) : null}
      </DeliverableSection>

      <DeliverableSection
        n="02"
        title="Impact by Category"
        right={
          <span className="eyebrow">
            {impacts.length} {impacts.length === 1 ? "category" : "categories"}
          </span>
        }
      >
        {impacts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No impact scores have been recorded for this process yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {impacts.map((row) => (
              <ImpactBar key={row.category} row={row} />
            ))}
          </div>
        )}
      </DeliverableSection>

      <DeliverableSection
        n="03"
        title="Dependencies"
        right={
          <span className="eyebrow">
            {dependencies.length} upstream
          </span>
        }
      >
        {dependencies.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            This process has no recorded upstream dependencies.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dependencies.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span
                    className="shrink-0 font-mono text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {d.identifier}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {d.name}
                  </span>
                </div>
                {d.tier ? (
                  <span className="eyebrow shrink-0">{d.tier}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </DeliverableSection>

      <DeliverableSection
        n="04"
        title="Linked Risks"
        right={
          <span className="eyebrow">
            {risks.length} {risks.length === 1 ? "risk" : "risks"}
          </span>
        }
      >
        {risks.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No risks are linked to this process.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  {["ID", "Risk", "Severity", "Status"].map((h) => (
                    <th
                      key={h}
                      className="eyebrow border-b pb-2 pr-4 font-normal"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openFinding(row)}
                    className="group border-b transition-colors hover:bg-muted"
                    style={{ cursor: "pointer", borderColor: "var(--border)" }}
                  >
                    <td className="py-3 pr-4 align-top">
                      <IdTag>{row.identifier}</IdTag>
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-foreground">{row.title}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-muted-foreground">
                      {row.severityLabel ?? "—"}
                    </td>
                    <td className="py-3 align-top text-muted-foreground">
                      {row.status.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DeliverableSection>
    </>
  );
}

function ImpactBar({ row }: { row: BiaImpactRow }) {
  const pct = Math.max(0, Math.min(100, (row.score / MAX_IMPACT) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{row.category}</span>
        <span
          className="font-mono text-xs tabular-nums"
          style={{ color: "var(--muted-foreground)" }}
        >
          {row.score} / {MAX_IMPACT}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--muted)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--primary)" }}
        />
      </div>
      {row.description ? (
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {row.description}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold leading-none text-foreground">{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
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
