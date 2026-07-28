/**
 * Unit tests for computeAppetiteBoundarySegments — the shared risk-appetite
 * contour helper used by both the SVG (RiskScoreHeatmap) and canvas
 * (CanvasHeatmap) renderers. Endpoints are in cell units.
 */

import {
  computeAppetiteBoundarySegments,
  type AppetiteBoundaryEdge,
} from "@/lib/matrix/heatmap";

/** Order-independent edge-set comparison (normalize endpoint direction). */
function edgeKey(e: AppetiteBoundaryEdge): string {
  const a = `${e.x1},${e.y1}`;
  const b = `${e.x2},${e.y2}`;
  return [a, b].sort().join("|");
}
function edgeSet(edges: AppetiteBoundaryEdge[]): Set<string> {
  return new Set(edges.map(edgeKey));
}

describe("computeAppetiteBoundarySegments", () => {
  it("returns no edges when nothing is flagged", () => {
    expect(
      computeAppetiteBoundarySegments([
        [false, false],
        [false, false],
      ])
    ).toEqual([]);
  });

  it("returns no edges for an empty grid", () => {
    expect(computeAppetiteBoundarySegments([])).toEqual([]);
  });

  it("outlines a single flagged cell with its four edges", () => {
    const edges = computeAppetiteBoundarySegments([[true]]);
    expect(edges).toHaveLength(4);
    expect(edgeSet(edges)).toEqual(
      edgeSet([
        { x1: 0, y1: 0, x2: 1, y2: 0 }, // top
        { x1: 0, y1: 1, x2: 1, y2: 1 }, // bottom
        { x1: 0, y1: 0, x2: 0, y2: 1 }, // left
        { x1: 1, y1: 0, x2: 1, y2: 1 }, // right
      ])
    );
  });

  it("omits interior edges of a fully-flagged block (perimeter only)", () => {
    // 2x2 all flagged → outer perimeter is 8 unit edges, no shared interior.
    const edges = computeAppetiteBoundarySegments([
      [true, true],
      [true, true],
    ]);
    expect(edges).toHaveLength(8);
    // The two interior edges (between the adjacent cells) must be absent.
    const keys = edgeSet(edges);
    expect(keys.has(edgeKey({ x1: 1, y1: 0, x2: 1, y2: 1 }))).toBe(false); // vertical middle
    expect(keys.has(edgeKey({ x1: 0, y1: 1, x2: 1, y2: 1 }))).toBe(false); // horizontal middle
  });

  it("handles a non-rectangular (L-shaped) region", () => {
    // Flagged: (0,0), (1,0), (1,1). The concave corner should still close.
    const edges = computeAppetiteBoundarySegments([
      [true, false],
      [true, true],
    ]);
    // 3 cells, each contributes edges not shared with a flagged neighbor.
    // Shared edges: (0,0)-(1,0) vertical-adjacent and (1,0)-(1,1) horizontal.
    // 3*4 = 12 candidate edges - 2 shared pairs *2 = 4 removed => 8 boundary edges.
    expect(edges).toHaveLength(8);
    // Boundary is closed: every vertex is touched an even number of times.
    const vertexCount = new Map<string, number>();
    for (const e of edges) {
      for (const v of [`${e.x1},${e.y1}`, `${e.x2},${e.y2}`]) {
        vertexCount.set(v, (vertexCount.get(v) ?? 0) + 1);
      }
    }
    for (const [, n] of vertexCount) expect(n % 2).toBe(0);
  });

  it("keeps disjoint flagged regions as separate outlines", () => {
    // Two diagonally-opposite cells never share an edge → two 4-edge squares.
    const edges = computeAppetiteBoundarySegments([
      [true, false],
      [false, true],
    ]);
    expect(edges).toHaveLength(8);
  });
});
