/**
 * Story 17.2: Impact-axis labels for the heatmap (AC7).
 *
 * Renders 5→1 top-to-bottom, vertically centered against each row of the 5×5
 * grid so it lines up beside {@link RiskHeatmap} (same `cell` size).
 */

const ROWS = [5, 4, 3, 2, 1] as const;

export function HeatmapYNums({ cell = 88 }: { cell?: number }) {
  return (
    <div
      aria-hidden
      style={{ display: "flex", flexDirection: "column", height: cell * 5 }}
    >
      {ROWS.map((n) => (
        <div
          key={n}
          className="font-mono text-xs"
          style={{
            height: cell,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 8,
            color: "var(--muted-foreground)",
          }}
        >
          {n}
        </div>
      ))}
    </div>
  );
}
