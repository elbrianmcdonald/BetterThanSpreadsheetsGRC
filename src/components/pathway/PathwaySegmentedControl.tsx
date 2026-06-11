/**
 * Epic 19 / Story 19.2 AC12: segmented control switching the three pathway modes.
 *
 * Kill Chain / ATT&CK Matrix / Attack Narrative. The active tab is styled as a
 * white card + shadow on a muted track. Built as plain buttons (not Radix) so
 * it switches via a click handler — avoids the known jsdom spinbutton issue and
 * keeps the click-to-switch test simple.
 */

"use client";

import type { PathwayMode } from "./types";

const MODES: { value: PathwayMode; label: string }[] = [
  { value: "killchain", label: "Kill Chain" },
  { value: "matrix", label: "ATT&CK Matrix" },
  { value: "narrative", label: "Attack Narrative" },
];

export function PathwaySegmentedControl({
  mode,
  onChange,
}: {
  mode: PathwayMode;
  onChange: (mode: PathwayMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Pathway visualization"
      className="inline-flex items-center gap-1 rounded-lg p-1"
      style={{ background: "var(--muted)" }}
    >
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.value)}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={
              active
                ? {
                    background: "var(--card)",
                    color: "var(--foreground)",
                    boxShadow: "0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)",
                  }
                : { background: "transparent", color: "var(--muted-foreground)" }
            }
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
