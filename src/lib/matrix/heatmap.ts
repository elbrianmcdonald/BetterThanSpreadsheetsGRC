/**
 * Risk-matrix heatmap grid helper (pure).
 *
 * Builds the 2D Likelihood×Impact grid for a configured matrix version so a risk
 * heatmap can be sized to the matrix's actual scales and tinted by its threshold
 * bands/colors — instead of a hardcoded 5×5 with fixed score cutoffs. Shared by
 * the on-screen deliverable heatmap and the server-side PDF renderer, so it must
 * stay free of React / Prisma / server imports.
 *
 * 2D projection: cell score = (L × I) / (maxL × maxI) × outputScaleMax, matched
 * to a threshold band — mirroring the matrix-settings preview
 * (`MatrixPreview`/`getThreshold`). For 3D matrices the grid is the L×I face;
 * a finding's own (possibly 3D) score still drives its dot/severity color.
 */

import type { MatrixScales, Threshold } from "./types";

export interface HeatmapAxisLevel {
  value: number;
  label: string;
}

export interface HeatmapCell {
  likelihood: number;
  impact: number;
  score: number;
  color: string;
  label: string;
  /** True when this cell's band is flagged as exceeding risk appetite. */
  overAppetite: boolean;
}

export interface HeatmapGrid {
  /** Likelihood levels, ascending (left → right). */
  cols: HeatmapAxisLevel[];
  /** Impact levels, descending (top → bottom). */
  rows: HeatmapAxisLevel[];
  /** cells[rowIdx][colIdx], row-major over (rows × cols). */
  cells: HeatmapCell[][];
}

const NEUTRAL = "#CCCCCC";

/**
 * Match a normalized score to its threshold band (inclusive both ends; mirrors
 * MatrixPreview). Ordered by `minValue` ascending so the lower band wins at a
 * shared boundary and so it's robust to matrices whose thresholds omit
 * `sortOrder`.
 */
export function thresholdForScore(
  score: number,
  thresholds: Threshold[],
): Threshold | undefined {
  const sorted = [...thresholds].sort((a, b) => a.minValue - b.minValue);
  return (
    sorted.find((t) => score >= t.minValue && score <= t.maxValue) ??
    sorted[sorted.length - 1]
  );
}

/** A single boundary edge in CELL UNITS (multiply by cell size + offset to render). */
export interface AppetiteBoundaryEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Trace the outline of the over-appetite region on a grid. For each flagged
 * cell, emits the edges it does NOT share with another flagged cell (grid edges
 * included), producing a closed contour around the danger zone — correct for
 * non-rectangular, holed, or disjoint regions since each boundary edge is
 * emitted exactly once from the flagged side.
 *
 * `overGrid[r][c] === true` means the cell at row r, col c is over appetite.
 * Endpoints are in cell units; the caller scales/offsets for SVG or canvas.
 * Shared by the SVG (RiskScoreHeatmap) and canvas (CanvasHeatmap) renderers so
 * the index math lives in one testable place.
 */
export function computeAppetiteBoundarySegments(
  overGrid: boolean[][],
): AppetiteBoundaryEdge[] {
  const edges: AppetiteBoundaryEdge[] = [];
  const isOver = (r: number, c: number) =>
    r >= 0 && r < overGrid.length && c >= 0 && c < (overGrid[r]?.length ?? 0)
      ? overGrid[r]![c]!
      : false;
  for (let r = 0; r < overGrid.length; r++) {
    for (let c = 0; c < (overGrid[r]?.length ?? 0); c++) {
      if (!overGrid[r]![c]) continue;
      if (!isOver(r - 1, c)) edges.push({ x1: c, y1: r, x2: c + 1, y2: r });
      if (!isOver(r + 1, c)) edges.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
      if (!isOver(r, c - 1)) edges.push({ x1: c, y1: r, x2: c, y2: r + 1 });
      if (!isOver(r, c + 1)) edges.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
    }
  }
  return edges;
}

/** 2D normalized score for a likelihood/impact pair against the matrix scales. */
export function score2D(
  likelihood: number,
  impact: number,
  scales: MatrixScales,
  outputScaleMax: number,
): number {
  const maxL = Math.max(...scales.likelihood.map((l) => Number(l.value)), 1);
  const maxI = Math.max(...scales.impact.map((i) => Number(i.value)), 1);
  const maxPossible = maxL * maxI;
  if (maxPossible === 0) return 0;
  return (likelihood * impact) / maxPossible * outputScaleMax;
}

/** Build the full L×I grid (cells colored/labelled by their threshold band). */
export function buildHeatmapGrid(
  scales: MatrixScales,
  thresholds: Threshold[],
  outputScaleMax: number,
): HeatmapGrid {
  const cols: HeatmapAxisLevel[] = [...scales.likelihood]
    .map((l) => ({ value: Number(l.value), label: l.label }))
    .sort((a, b) => a.value - b.value);
  const rows: HeatmapAxisLevel[] = [...scales.impact]
    .map((i) => ({ value: Number(i.value), label: i.label }))
    .sort((a, b) => b.value - a.value);

  const cells = rows.map((r) =>
    cols.map((c) => {
      const score = score2D(c.value, r.value, scales, outputScaleMax);
      const t = thresholdForScore(score, thresholds);
      return {
        likelihood: c.value,
        impact: r.value,
        score,
        color: t?.color ?? NEUTRAL,
        label: t?.label ?? "",
        overAppetite: t?.overAppetite ?? false,
      } satisfies HeatmapCell;
    }),
  );

  return { cols, rows, cells };
}
