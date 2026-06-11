"use client";

/**
 * Matrix-aware risk heatmap for the executive summary.
 *
 * Unlike the fixed 5×5 {@link RiskHeatmap}, this sizes the grid to the
 * assessment's configured matrix (N×M from its likelihood/impact scales) and
 * tints each cell with the matrix's threshold-band color. Scored findings plot as
 * numbered dots (band-colored stroke) in their L×I cell and open the SHARED
 * Finding Drawer on click — so this must mount inside a FindingDrawerProvider.
 *
 * x = Likelihood (ascending, left→right); y = Impact (descending, top→bottom),
 * matching the matrix-settings preview.
 */

import { useMemo } from "react";
import { buildHeatmapGrid, getContrastColor } from "@/lib/matrix";
import { useFindingDrawer } from "./FindingDrawerProvider";
import { MatrixSeverityBadge } from "./MatrixSeverityBadge";
import type { ExecMatrix, ExecFinding } from "@/server/services/deliverableRiskExecData";

/** Fan co-located dots out from center so labels stay readable. */
function dotOffsets(count: number, cell: number): Array<{ dx: number; dy: number }> {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  const radius = Math.min(cell / 4, 12);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  });
}

export function MatrixHeatmap({
  matrix,
  rows,
}: {
  matrix: ExecMatrix;
  rows: ExecFinding[];
}) {
  const { openFinding } = useFindingDrawer();

  const grid = useMemo(
    () => buildHeatmapGrid(matrix.scales, matrix.thresholds, matrix.outputScaleMax),
    [matrix],
  );

  const cell = Math.max(48, Math.min(76, Math.floor(460 / Math.max(grid.cols.length, 1))));
  const pad = 28;
  const gw = cell * grid.cols.length;
  const gh = cell * grid.rows.length;
  const W = pad + gw;
  const H = gh + pad;

  // Bucket scored findings into their cell (by matching scale level values).
  const byCell = useMemo(() => {
    const m = new Map<string, ExecFinding[]>();
    for (const r of rows) {
      if (!r.scored) continue;
      const ci = grid.cols.findIndex((c) => c.value === r.likelihood);
      const ri = grid.rows.findIndex((rr) => rr.value === r.impact);
      if (ci < 0 || ri < 0) continue;
      const k = `${ri}-${ci}`;
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return m;
  }, [rows, grid]);

  // Band legend with finding counts (ordered by threshold severity).
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) if (r.scored) counts.set(r.severityLabel, (counts.get(r.severityLabel) ?? 0) + 1);
    return [...matrix.thresholds]
      .sort((a, b) => a.minValue - b.minValue)
      .map((t) => ({ label: t.label, color: t.color, count: counts.get(t.label) ?? 0 }));
  }, [rows, matrix]);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Likelihood by impact risk heatmap"
        style={{ display: "block", maxWidth: "100%", margin: "0 auto" }}
      >
        {grid.rows.map((r, rowIdx) =>
          grid.cols.map((c, colIdx) => {
            const x = pad + colIdx * cell;
            const y = rowIdx * cell;
            const cellData = grid.cells[rowIdx]?.[colIdx];
            const fill = cellData?.color ?? "#CCCCCC";
            const score = cellData?.score ?? 0;
            const dots = byCell.get(`${rowIdx}-${colIdx}`) ?? [];
            const offs = dotOffsets(dots.length, cell);
            return (
              <g key={`${rowIdx}-${colIdx}`}>
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  fill={fill}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={x + 5}
                  y={y + 13}
                  fontSize={9.5}
                  fontFamily="var(--font-mono, ui-monospace, monospace)"
                  fill={getContrastColor(fill)}
                  opacity={0.7}
                >
                  {Number.isInteger(score) ? score : score.toFixed(1)}
                </text>
                {dots.map((row, i) => {
                  const cx = x + cell / 2 + offs[i]!.dx;
                  const cy = y + cell / 2 + offs[i]!.dy;
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
                      <circle cx={cx} cy={cy} r={9} fill="var(--card)" stroke={row.severityColor} strokeWidth={2} />
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

        {/* Axis tick labels: impact down the left, likelihood across the bottom. */}
        {grid.rows.map((r, rowIdx) => (
          <text
            key={`yr-${rowIdx}`}
            x={pad / 2}
            y={rowIdx * cell + cell / 2}
            fontSize={10}
            fontFamily="var(--font-mono, ui-monospace, monospace)"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--muted-foreground)"
          >
            {r.value}
          </text>
        ))}
        {grid.cols.map((c, colIdx) => (
          <text
            key={`xc-${colIdx}`}
            x={pad + colIdx * cell + cell / 2}
            y={gh + pad / 2 + 2}
            fontSize={10}
            fontFamily="var(--font-mono, ui-monospace, monospace)"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--muted-foreground)"
          >
            {c.value}
          </text>
        ))}
      </svg>

      <div className="eyebrow mt-1">x = Likelihood · y = Impact</div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <MatrixSeverityBadge label={l.label} color={l.color} size="sm" />
            <span className="text-xs text-muted-foreground">{l.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
