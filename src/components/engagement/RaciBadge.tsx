"use client";

/**
 * RACI badge + legend (Epic 18 — Story 18.4).
 *
 * Token-driven colors (no hardcoded hex):
 *   R = --primary, A = --destructive, C = --warning, I = --muted-foreground.
 */

import type { RaciRole } from "./types";

export const RACI_TOKEN: Record<RaciRole, string> = {
  R: "var(--primary)",
  A: "var(--destructive)",
  C: "var(--warning)",
  I: "var(--muted-foreground)",
};

export const RACI_MEANING: Record<RaciRole, string> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

export function RaciBadge({ raci }: { raci: RaciRole }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
      style={{ background: RACI_TOKEN[raci], color: "var(--primary-foreground)" }}
    >
      {raci}
    </span>
  );
}

export function RaciLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {(Object.keys(RACI_MEANING) as RaciRole[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <RaciBadge raci={r} />
          {RACI_MEANING[r]}
        </span>
      ))}
    </div>
  );
}
