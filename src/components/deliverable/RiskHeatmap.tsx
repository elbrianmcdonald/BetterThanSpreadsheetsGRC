"use client";

/**
 * Story 17.2: Shared 5×5 L×I risk heatmap (AC1-AC6, AC20).
 *
 * x-axis = Likelihood 1→5 (left→right); y-axis = Impact 5 (top) → 1 (bottom).
 * Cells are tinted by `sevOf(l*i)` with intensity scaling on the score; finding
 * dots cluster within their cell and open the SHARED Finding Drawer on click.
 * This component invents NO scoring of its own — it consumes the matrix-anchored
 * likelihood/impact already carried on each row.
 */

import { useFindingDrawer } from "./FindingDrawerProvider";
import { sevOf, severityToVar } from "./tone";
import type { DeliverableSeverity } from "./types";
import type { RiskRow } from "@/server/services/deliverableRiskData";

const COLS = [1, 2, 3, 4, 5] as const; // likelihood, left → right
const ROWS = [5, 4, 3, 2, 1] as const; // impact, top → bottom

/** Cell tint: severity token mixed into the card surface, intensity by score. */
function cellFill(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  const color = severityToVar(sevOf(score));
  const intensity = Math.min(100, 20 + score * 3);
  return `color-mix(in oklch, ${color} ${intensity}%, var(--card))`;
}

/**
 * Fan a cell's dots out from center so labels stay readable. 1 dot is centered;
 * additional dots distribute on a small ring.
 */
function dotOffsets(count: number, cell: number): Array<{ dx: number; dy: number }> {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  const radius = Math.min(cell / 4, 14);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  });
}

export function RiskHeatmap({
  rows,
  cell = 88,
  selectedSeverity = null,
}: {
  rows: RiskRow[];
  cell?: number;
  selectedSeverity?: DeliverableSeverity | null;
}) {
  const { openFinding } = useFindingDrawer();
  const grid = cell * 5;

  // Bucket rows by their cell key "l-i".
  const byCell = new Map<string, RiskRow[]>();
  for (const r of rows) {
    const key = `${r.likelihood}-${r.impact}`;
    const arr = byCell.get(key);
    if (arr) arr.push(r);
    else byCell.set(key, [r]);
  }

  return (
    <svg
      width={grid}
      height={grid}
      viewBox={`0 0 ${grid} ${grid}`}
      role="img"
      aria-label="Likelihood by impact risk heatmap"
      style={{ display: "block" }}
    >
      {ROWS.map((impact, rowIdx) =>
        COLS.map((likelihood, colIdx) => {
          const x = colIdx * cell;
          const y = rowIdx * cell;
          const score = likelihood * impact;
          const cellRows = byCell.get(`${likelihood}-${impact}`) ?? [];
          const offsets = dotOffsets(cellRows.length, cell);
          return (
            <g key={`${likelihood}-${impact}`}>
              <rect
                x={x}
                y={y}
                width={cell}
                height={cell}
                fill={cellFill(likelihood, impact)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              {/* Per-cell mono score label, top-left (AC5). */}
              <text
                x={x + 6}
                y={y + 14}
                fontSize={9.5}
                fontFamily="var(--font-mono, ui-monospace, monospace)"
                fill="var(--muted-foreground)"
              >
                {score}
              </text>

              {cellRows.map((row, i) => {
                const sevColor = severityToVar(row.severityTier);
                const dimmed =
                  selectedSeverity != null && row.severityTier !== selectedSeverity;
                if (dimmed) return null;
                const cx = x + cell / 2 + offsets[i]!.dx;
                const cy = y + cell / 2 + offsets[i]!.dy;
                return (
                  <g
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Finding ${row.identifier}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => openFinding(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFinding(row);
                      }
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9}
                      fill="var(--card)"
                      stroke={sevColor}
                      strokeWidth={2}
                    />
                    <text
                      x={cx}
                      y={cy}
                      fontSize={10}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--foreground)"
                      style={{ pointerEvents: "none" }}
                    >
                      {row.displayNumber}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }),
      )}
    </svg>
  );
}
