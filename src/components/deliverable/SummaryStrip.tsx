/**
 * Story 17.2: Summary strip card (AC15, AC16).
 *
 * Total findings + per-severity counts. Numbers are large/bold SANS (the design
 * system stays sans/mono — hierarchy comes from weight/size, not serif). Counts
 * always reflect the UNFILTERED totals.
 */

import { severityToVar, severityLabel } from "./tone";
import type { DeliverableSeverity } from "./types";

const TIERS: DeliverableSeverity[] = ["critical", "high", "medium", "low"];

export function SummaryStrip({
  total,
  counts,
}: {
  total: number;
  counts: Record<DeliverableSeverity, number>;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="eyebrow">Findings summary</div>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
        <Stat label="Total findings" value={total} color="var(--foreground)" />
        {TIERS.map((tier) => (
          <Stat
            key={tier}
            label={severityLabel(tier)}
            value={counts[tier] ?? 0}
            color={severityToVar(tier)}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        className="font-semibold leading-none tabular-nums"
        style={{ fontSize: 30, color }}
      >
        {value}
      </div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  );
}
