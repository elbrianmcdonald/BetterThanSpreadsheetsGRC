"use client";

/**
 * Story 17.5: Action Plan / Roadmap deliverable body (AC1–AC16).
 *
 * Presentational — receives pre-shaped `RoadmapAction[]` via props (the
 * orchestrator wires the tRPC procedure). Renders, inside DeliverableSection
 * slots:
 *   1–3. The three timeline phases (always all three; empty phase → empty state),
 *        each an ordered list of expandable ActionCards.
 *   4.   The Effort-vs-Impact bubble plot + three stat tiles.
 *
 * Cards open the SHARED Finding Drawer (via ActionCard → useFindingDrawer), so
 * this body MUST be mounted inside a FindingDrawerProvider. It owns NO drawer.
 */

import { useMemo, useRef } from "react";
import { DeliverableSection } from "../DeliverableSection";
import { ActionCard } from "../ActionCard";
import { EffortImpactPlot } from "../EffortImpactPlot";
import {
  PHASES,
  computeRoadmapTallies,
  groupActionsByPhase,
  type Phase,
  type RoadmapAction,
} from "@/server/services/deliverableRoadmapData";

/** Static phase header copy (mono window pill + name + description). */
const PHASE_META: Record<Phase, { window: string; name: string; description: string }> = {
  "0–30 days": {
    window: "0–30 DAYS",
    name: "Immediate",
    description: "Contain the highest-exposure gaps and bank quick wins.",
  },
  "30–90 days": {
    window: "30–90 DAYS",
    name: "Near-term",
    description: "Stand up the controls and processes that close the next tier.",
  },
  "1–2 quarters": {
    window: "1–2 QUARTERS",
    name: "Structural",
    description: "Durable, programmatic changes that reshape the risk posture.",
  },
};

const EFFORT_RANK: Record<"S" | "M" | "L", number> = { S: 0, M: 1, L: 2 };

/**
 * Deterministic in-phase ordering: risk-reduction impact DESC, then effort
 * ASC (S < M < L), then id for a stable final tie-break (snapshot-safe).
 */
function orderActions(actions: RoadmapAction[]): RoadmapAction[] {
  return [...actions].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    if (EFFORT_RANK[a.effort] !== EFFORT_RANK[b.effort]) {
      return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
    }
    return a.id.localeCompare(b.id);
  });
}

export function RoadmapBody({
  actions,
  prioritizeTop = false,
}: {
  actions: RoadmapAction[];
  /** When true, render the prioritization plot + stats right under the header
   * (matches the Action Plans tab design) instead of as a trailing section. */
  prioritizeTop?: boolean;
}) {
  const grouped = useMemo(() => groupActionsByPhase(actions), [actions]);
  const tallies = useMemo(() => computeRoadmapTallies(actions), [actions]);

  // Refs per card so a bubble pick can scroll-to / highlight the ActionCard.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const onPick = (id: string) => {
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const initiativeCount = actions.length;

  const statTiles = (
    <>
      <StatTile label="Initiatives" value={tallies.initiatives} tone="brand" />
      <StatTile
        label="Break the exploitation pathway"
        value={tallies.breakPathway}
        tone="crit"
      />
      <StatTile label="Quick wins" value={tallies.quickWins} tone="ok" />
    </>
  );

  return (
    <>
      <RoadmapHeader actions={actions} count={initiativeCount} />

      {prioritizeTop ? (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <p className="eyebrow mb-3" style={{ color: "var(--muted-foreground)" }}>
              Prioritization &mdash; effort vs. risk reduction
            </p>
            <EffortImpactPlot actions={actions} onPick={onPick} />
          </div>
          <div
            className="grid grid-cols-3 gap-3 rounded-xl border p-4 lg:grid-cols-1 lg:content-start"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {statTiles}
          </div>
        </div>
      ) : null}

      {PHASES.map((phase, i) => {
        const phaseActions = orderActions(grouped[phase]);
        const meta = PHASE_META[phase];
        const n = String(i + 1).padStart(2, "0");
        return (
          <DeliverableSection
            key={phase}
            n={n}
            title={meta.name}
            right={
              <span
                className="rounded-md px-2 py-1 font-mono text-xs"
                style={{ background: "var(--foreground)", color: "var(--background)" }}
              >
                {meta.window}
              </span>
            }
          >
            <p className="mb-4 text-sm text-muted-foreground">{meta.description}</p>
            {phaseActions.length === 0 ? (
              <div
                className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                No actions scheduled in this phase.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {phaseActions.map((a) => (
                  <div
                    key={a.id}
                    ref={(el) => {
                      cardRefs.current[a.id] = el;
                    }}
                  >
                    <ActionCard action={a} />
                  </div>
                ))}
              </div>
            )}
          </DeliverableSection>
        );
      })}

      {!prioritizeTop ? (
        <DeliverableSection n="04" title="Effort vs. Impact">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <EffortImpactPlot actions={actions} onPick={onPick} />
            </div>
            <div className="grid grid-cols-3 gap-3 lg:w-56 lg:grid-cols-1">
              {statTiles}
            </div>
          </div>
        </DeliverableSection>
      ) : null}
    </>
  );
}

/**
 * Header block: eyebrow + "Action plan" title + subtitle, with an "Export plan"
 * button (top-right) that downloads the actions as a CSV via a client Blob.
 */
function RoadmapHeader({ actions, count }: { actions: RoadmapAction[]; count: number }) {
  const onExport = () => exportActionsCsv(actions);
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="eyebrow">Remediation roadmap</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Action plan
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {count} initiative{count === 1 ? "" : "s"} sequenced by effort and risk
          reduction. Each maps to the findings it closes; flame-marked items break
          the exploitation pathway.
        </p>
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={count === 0}
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "var(--border)" }}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4">
          <path
            d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Export plan
      </button>
    </div>
  );
}

/** Quote a CSV cell, escaping embedded quotes. */
function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Client-side CSV download of the roadmap actions. */
function exportActionsCsv(actions: RoadmapAction[]) {
  const header = [
    "identifier",
    "title",
    "owner",
    "effort",
    "cost_band",
    "risk_reduction",
    "phase",
    "breaks_pathway",
    "findings",
  ];
  const rows = actions.map((a) =>
    [
      a.id,
      a.title,
      a.owner ?? "",
      a.effort,
      a.costBand,
      a.impact,
      a.phase,
      a.breaksToxic ? "yes" : "no",
      a.remediates.map((f) => f.identifier ?? f.id).join("; "),
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "action-plan.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "crit" | "ok";
}) {
  const color =
    tone === "crit"
      ? "var(--destructive)"
      : tone === "ok"
        ? "var(--success)"
        : "var(--primary)";
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}
