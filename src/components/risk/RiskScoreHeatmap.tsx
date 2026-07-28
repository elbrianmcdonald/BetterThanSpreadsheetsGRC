"use client";

/**
 * Standalone Likelihood × Impact risk heatmap + ranked list.
 *
 * Matrix-aware (sizes the grid to the matrix scales via buildHeatmapGrid, so a
 * 3×3 matrix renders a 3×3 grid). Unlike the deliverable heatmaps it has NO
 * FindingDrawer dependency — clicking a dot or a ranked-list row navigates to
 * the item's href. Used for the Enterprise Risk view (tagged child risks) and
 * the Enterprise Risks list page (all enterprise risks).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3 } from "lucide-react";

import { buildHeatmapGrid, getContrastColor, computeAppetiteBoundarySegments } from "@/lib/matrix";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface HeatmapItem {
  id: string;
  /** Short code/identifier shown as a chip in the ranked list (optional). */
  label?: string | null;
  title: string;
  /** Scale-level values; null when the item isn't scored (excluded from grid). */
  likelihood: number | null;
  impact: number | null;
  score: number | null;
  scoreLabel: string | null;
  /** Threshold band color for the dot stroke / list marker. */
  color: string;
  /** Navigation target on click. */
  href: string;
}

interface RiskScoreHeatmapProps {
  matrix: {
    scales: MatrixScales;
    thresholds: Threshold[];
    outputScaleMax: number;
  };
  rows: HeatmapItem[];
  title?: string;
  subtitle?: string;
  /** Empty-state copy when there are no scored items. */
  emptyLabel?: string;
}

/** Fan co-located dots out from center so labels stay readable. */
function dotOffsets(count: number, cell: number): Array<{ dx: number; dy: number }> {
  if (count <= 1) return [{ dx: 0, dy: 0 }];
  const radius = Math.min(cell / 4, 12);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  });
}

export function RiskScoreHeatmap({
  matrix,
  rows,
  title = "Risk Heatmap",
  subtitle = "Likelihood × impact",
  emptyLabel = "No scored items yet.",
}: RiskScoreHeatmapProps) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const grid = useMemo(
    () => buildHeatmapGrid(matrix.scales, matrix.thresholds, matrix.outputScaleMax),
    [matrix],
  );

  // Scored rows ranked by score desc → drives both dot numbers and the list.
  const { ranked, unscored, numberById } = useMemo(() => {
    const scored = rows
      .filter((r) => r.likelihood !== null && r.impact !== null && r.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const map = new Map<string, number>();
    scored.forEach((r, i) => map.set(r.id, i + 1));
    return {
      ranked: scored,
      unscored: rows.filter((r) => r.likelihood === null || r.impact === null || r.score === null),
      numberById: map,
    };
  }, [rows]);

  // Bucket scored rows into grid cells by matching scale level values.
  const byCell = useMemo(() => {
    const m = new Map<string, HeatmapItem[]>();
    for (const r of ranked) {
      const ci = grid.cols.findIndex((c) => c.value === r.likelihood);
      const ri = grid.rows.findIndex((rr) => rr.value === r.impact);
      if (ci < 0 || ri < 0) continue;
      const k = `${ri}-${ci}`;
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return m;
  }, [ranked, grid]);

  const cell = Math.max(56, Math.min(92, Math.floor(460 / Math.max(grid.cols.length, 1))));
  const pad = 30;
  const gw = cell * grid.cols.length;
  const gh = cell * grid.rows.length;
  const W = pad + gw;
  const H = gh + pad;

  // Risk-appetite boundary: a closed contour around the flagged region (shared
  // pure helper does the edge math; we just scale cell-units into SVG coords).
  // Empty unless the matrix has at least one flagged band, so the heatmap is
  // unchanged for orgs that haven't configured an appetite.
  const appetiteSegments = useMemo(() => {
    const overGrid = grid.cells.map((row) => row.map((c) => c.overAppetite));
    return computeAppetiteBoundarySegments(overGrid).map((e) => ({
      x1: pad + e.x1 * cell,
      y1: e.y1 * cell,
      x2: pad + e.x2 * cell,
      y2: e.y2 * cell,
    }));
  }, [grid, cell, pad]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 && unscored.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-start">
            {/* Grid */}
            <div>
              <svg
                width={W}
                height={H}
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="Likelihood by impact risk heatmap"
                style={{ display: "block", maxWidth: "100%" }}
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
                          x={x + 6}
                          y={y + 14}
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
                          const isHover = hover === row.id;
                          return (
                            <g
                              key={row.id}
                              role="button"
                              tabIndex={0}
                              aria-label={row.title}
                              style={{ cursor: "pointer" }}
                              onClick={() => router.push(row.href)}
                              onMouseEnter={() => setHover(row.id)}
                              onMouseLeave={() => setHover(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  router.push(row.href);
                                }
                              }}
                            >
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isHover ? 12 : 10}
                                fill="var(--card)"
                                stroke={row.color}
                                strokeWidth={isHover ? 3 : 2}
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
                                {numberById.get(row.id)}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  }),
                )}

                {/* Risk-appetite boundary contour (drawn above cell fills). A
                    light casing keeps it legible over any band color; the dashed
                    danger line reads as a distinct channel from cell borders. */}
                {appetiteSegments.length > 0 && (
                  <g aria-hidden="true">
                    {appetiteSegments.map((s, i) => (
                      <line
                        key={`ac-${i}`}
                        x1={s.x1}
                        y1={s.y1}
                        x2={s.x2}
                        y2={s.y2}
                        stroke="var(--card)"
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                    ))}
                    {appetiteSegments.map((s, i) => (
                      <line
                        key={`al-${i}`}
                        x1={s.x1}
                        y1={s.y1}
                        x2={s.x2}
                        y2={s.y2}
                        stroke="var(--destructive)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeDasharray="6 3"
                      />
                    ))}
                  </g>
                )}

                {/* Axis tick labels: impact down the left, likelihood across the bottom. */}
                {grid.rows.map((r, rowIdx) => (
                  <text
                    key={`yr-${rowIdx}`}
                    x={pad / 2}
                    y={rowIdx * cell + cell / 2}
                    fontSize={11}
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
                    fontSize={11}
                    fontFamily="var(--font-mono, ui-monospace, monospace)"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--muted-foreground)"
                  >
                    {c.value}
                  </text>
                ))}
              </svg>
              <div className="eyebrow mt-1 text-center">
                Likelihood → · Impact ↑
              </div>
              {appetiteSegments.length > 0 && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block w-5 border-t-2 border-dashed"
                    style={{ borderColor: "var(--destructive)" }}
                  />
                  Dashed line marks the risk-appetite boundary
                </div>
              )}
            </div>

            {/* Ranked list */}
            <div className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                <h3 className="text-sm font-semibold">Ranked by risk score</h3>
                <span className="font-mono text-[11px] text-muted-foreground">L × I</span>
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y">
                {ranked.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => router.push(row.href)}
                    onMouseEnter={() => setHover(row.id)}
                    onMouseLeave={() => setHover(null)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      hover === row.id ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span
                      className="w-7 text-center font-mono text-sm font-semibold"
                      style={{ color: row.color }}
                    >
                      {row.score !== null && Number.isInteger(row.score)
                        ? row.score
                        : row.score?.toFixed(1)}
                    </span>
                    {row.label && (
                      <span className="font-mono text-[11px] rounded border px-1.5 py-0.5 text-muted-foreground shrink-0">
                        {row.label}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm font-medium">{row.title}</span>
                    {row.scoreLabel && (
                      <span
                        className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: row.color, color: getContrastColor(row.color) }}
                      >
                        {row.scoreLabel}
                      </span>
                    )}
                  </button>
                ))}
                {unscored.length > 0 && (
                  <div className="px-4 py-2.5">
                    <p className="eyebrow mb-1.5">Not yet scored ({unscored.length})</p>
                    <div className="space-y-1">
                      {unscored.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => router.push(row.href)}
                          className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
                        >
                          {row.label && (
                            <span className="font-mono text-[11px] rounded border px-1.5 py-0.5 shrink-0">
                              {row.label}
                            </span>
                          )}
                          <span className="flex-1 truncate">{row.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
