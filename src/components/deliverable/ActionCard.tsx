"use client";

/**
 * Story 17.5: Expandable action card (AC6–AC11).
 *
 * Collapsed: ID tag + title + owner + findings-count, a right metric cluster
 * (Effort / Cost / Risk-reduction), and a chevron that rotates on expand.
 * Expanded: detail text, a "Findings remediated" list (each row: severity dot +
 * identifier + title, clickable → opens the SHARED Finding Drawer), and a
 * metadata block (Timeline phase / Owner / Cost band / Effort).
 *
 * The toggle is a real <button> with aria-expanded so it is keyboard-accessible.
 * This card owns NO drawer — it uses the shared useFindingDrawer() from 17.1.
 */

import { useId, useState } from "react";
import { useFindingDrawer } from "./FindingDrawerProvider";
import { EffortPill } from "./EffortPill";
import { CostPill } from "./CostPill";
import { ImpactMeter } from "./ImpactMeter";
import { sevOf, severityToVar } from "./tone";
import type { FindingLike } from "./types";
import type { RoadmapAction } from "@/server/services/deliverableRoadmapData";

export function ActionCard({ action }: { action: RoadmapAction }) {
  const { openFinding } = useFindingDrawer();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const findingCount = action.remediates.length;

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        <IdTag>{action.id}</IdTag>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground">
              {action.title}
            </span>
            {action.breaksToxic ? <BreaksPathwayBadge /> : null}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{action.owner ?? "Unassigned"}</span>
            <span aria-hidden>·</span>
            <span>
              closes {findingCount} finding{findingCount === 1 ? "" : "s"}
            </span>
          </span>
        </span>

        <span className="hidden items-center gap-4 sm:flex">
          <MetricCluster action={action} />
        </span>

        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4 shrink-0 text-muted-foreground transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          {action.detail ? (
            <p className="text-sm leading-relaxed text-foreground">{action.detail}</p>
          ) : null}

          <div className="mt-4">
            <div className="eyebrow mb-2">Findings remediated</div>
            {findingCount === 0 ? (
              <div className="text-sm text-muted-foreground">
                No linked findings.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {action.remediates.map((f) => (
                  <li key={f.id}>
                    <RemediatedFindingRow finding={f} onOpen={() => openFinding(f)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Meta label="Timeline" value={action.phase} />
            <Meta label="Owner" value={action.owner ?? "Unassigned"} />
            <Meta
              label="Cost band"
              value={<CostPill band={action.costBand} />}
            />
            <Meta label="Effort" value={<EffortPill effort={action.effort} />} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function MetricCluster({ action }: { action: RoadmapAction }) {
  return (
    <>
      <Labeled label="Effort">
        <EffortPill effort={action.effort} />
      </Labeled>
      <Labeled label="Cost">
        <CostPill band={action.costBand} />
      </Labeled>
      <Labeled label="Risk ↓">
        <ImpactMeter value={action.impact} />
      </Labeled>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </span>
  );
}

function RemediatedFindingRow({
  finding,
  onOpen,
}: {
  finding: FindingLike;
  onOpen: () => void;
}) {
  const score = finding.likelihood * finding.impact;
  const color = severityToVar(sevOf(score));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="font-mono text-xs text-muted-foreground">
        {finding.identifier ?? finding.id.slice(0, 8)}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{finding.title}</span>
    </button>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Small destructive-tinted "BREAKS PATHWAY" badge (flame icon) shown next to the
 * title when an action breaks the exploitation pathway. Token-only.
 */
function BreaksPathwayBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: "color-mix(in oklch, var(--destructive) 14%, transparent)",
        color: "var(--destructive)",
      }}
      title="Breaks the exploitation pathway"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3">
        <path
          d="M8 1.5c1 2 3.2 3 3.2 5.6A3.2 3.2 0 0 1 8 10.3 3.2 3.2 0 0 1 4.8 7.1c0-1 .5-1.7 1-2.3.3.7.9 1 1.5 1 .2-1.6-.4-3-.3-4.3.4.3.7.6 1 .9C8.3 2 8 1.8 8 1.5Z"
          fill="currentColor"
        />
        <path
          d="M8 14.5c2.2 0 4-1.4 4-3.4 0-1.3-.8-2.3-1.6-3 .1 1.5-.9 2.3-1.6 2.5.3-1.1-.1-2.3-.8-3-.1 1-.7 1.6-1.3 2.2-.5.5-1.1 1.2-1.1 2.3 0 1.6 1.4 2.4 2.4 2.4Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
      Breaks pathway
    </span>
  );
}

/** Mono ID pill, matching the drawer header / register IdTag styling. */
function IdTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block shrink-0 whitespace-nowrap rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}
