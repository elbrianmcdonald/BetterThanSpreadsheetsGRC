/**
 * Story 17.1: Scorecard grid (AC7–AC10).
 *
 * 3-column grid inside a single rounded border with overflow hidden; cells are
 * divided by hairlines, not gaps. Cell config is entirely prop-driven — the
 * scorecard has zero knowledge of any assessment type.
 */

import { toneToVar } from "./tone";
import type { ScorecardCellConfig } from "./types";

export function Scorecard({ cells }: { cells: ScorecardCellConfig[] }) {
  return (
    <div
      className="grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-3"
      role="group"
      aria-label="Scorecard"
    >
      {cells.map((cell, i) => (
        <ScorecardCell key={`${cell.label}-${i}`} cell={cell} index={i} />
      ))}
    </div>
  );
}

function ScorecardCell({
  cell,
  index,
}: {
  cell: ScorecardCellConfig;
  index: number;
}) {
  return (
    <div
      className="p-5"
      style={{
        // Hairline dividers between cells (no gaps): left border on all but the first.
        borderLeft: index > 0 ? "1px solid var(--border)" : undefined,
      }}
    >
      <div className="eyebrow">{cell.label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className="tnum font-semibold leading-none"
          style={{ fontSize: 44, color: toneToVar(cell.tone) }}
        >
          {cell.value}
        </span>
        {cell.suffix ? (
          <span className="text-sm text-muted-foreground">{cell.suffix}</span>
        ) : null}
      </div>
      {cell.deltaNote ? (
        <div className="mt-1.5 text-xs text-muted-foreground">{cell.deltaNote}</div>
      ) : null}
    </div>
  );
}
