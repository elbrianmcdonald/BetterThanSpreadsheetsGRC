"use client";

/**
 * Story 17.2: Severity filter chips (AC14).
 *
 * "All severities" + one chip per tier, each with a colored dot. Controlled:
 * selecting a chip filters BOTH the register and the heatmap dots (the parent
 * body owns the state). Counts, when supplied, reflect the UNFILTERED totals
 * (AC16) and are shown after the label.
 */

import { severityToVar, severityLabel } from "./tone";
import type { DeliverableSeverity } from "./types";

const TIERS: DeliverableSeverity[] = ["critical", "high", "medium", "low"];

export function SeverityChips({
  value,
  onChange,
  counts,
}: {
  value: DeliverableSeverity | null;
  onChange: (v: DeliverableSeverity | null) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip active={value === null} onClick={() => onChange(null)}>
        All severities
        {counts ? <Count>{Object.values(counts).reduce((a, b) => a + b, 0)}</Count> : null}
      </Chip>
      {TIERS.map((tier) => {
        const color = severityToVar(tier);
        return (
          <Chip
            key={tier}
            active={value === tier}
            color={color}
            onClick={() => onChange(value === tier ? null : tier)}
          >
            <span
              aria-hidden
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: color }}
            />
            {severityLabel(tier)}
            {counts ? <Count>{counts[tier] ?? 0}</Count> : null}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      style={{
        color: active ? "var(--primary-foreground)" : "var(--foreground)",
        background: active ? (color ?? "var(--primary)") : "var(--card)",
        borderColor: active ? (color ?? "var(--primary)") : "var(--border)",
      }}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono tabular-nums opacity-70" style={{ fontSize: 11 }}>
      {children}
    </span>
  );
}
