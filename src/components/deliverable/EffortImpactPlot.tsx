"use client";

/**
 * Story 17.5: Effort-vs-Impact bubble chart (AC12–AC15).
 *
 * SVG scatter: x = effort (S / M / L), y = risk-reduction impact (1–5). Bubbles
 * that break a toxic pathway render in `var(--destructive)`; all others in
 * `var(--primary)` (NOT `--accent`, which is a neutral tint in this design system).
 * The top-left region (small effort, high impact) is the "Quick wins" zone and is
 * labeled. Clicking a bubble calls `onPick(actionId)` so the body can scroll to /
 * highlight the matching ActionCard. Tokens only — no hardcoded hex.
 */

import type { RoadmapAction } from "@/server/services/deliverableRoadmapData";

const EFFORT_X: Record<"S" | "M" | "L", number> = { S: 0, M: 1, L: 2 };
const EFFORT_LABEL: Record<"S" | "M" | "L", string> = { S: "Small", M: "Medium", L: "Large" };

// SVG viewport + plot insets (room for axis labels).
const W = 520;
const H = 320;
const PAD_L = 44;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 40;

export function EffortImpactPlot({
  actions,
  onPick,
  selectedId,
}: {
  actions: RoadmapAction[];
  onPick?: (actionId: string) => void;
  selectedId?: string | null;
}) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  // x slot centers for the 3 effort columns; y for impact 1..5 (5 at top).
  const xFor = (effort: "S" | "M" | "L") =>
    PAD_L + ((EFFORT_X[effort] + 0.5) / 3) * plotW;
  const yFor = (impact: number) => {
    const clamped = Math.max(1, Math.min(impact, 5));
    return PAD_T + ((5 - clamped) / 4) * plotH;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Effort versus risk-reduction impact bubble chart"
    >
      {/* Quick-wins region: top-left (small effort, high impact). */}
      <rect
        x={PAD_L}
        y={PAD_T}
        width={plotW / 3}
        height={plotH / 2}
        rx={6}
        fill="color-mix(in oklch, var(--primary) 8%, transparent)"
      />
      <text
        x={PAD_L + 8}
        y={PAD_T + 16}
        className="font-mono"
        style={{ fontSize: 10, fill: "var(--primary)", letterSpacing: "0.04em" }}
      >
        QUICK WINS
      </text>

      {/* Axes (hairlines). */}
      <line
        x1={PAD_L}
        y1={PAD_T}
        x2={PAD_L}
        y2={H - PAD_B}
        stroke="var(--border)"
        strokeWidth={1}
      />
      <line
        x1={PAD_L}
        y1={H - PAD_B}
        x2={W - PAD_R}
        y2={H - PAD_B}
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Y axis ticks 1..5. */}
      {[1, 2, 3, 4, 5].map((v) => (
        <text
          key={v}
          x={PAD_L - 10}
          y={yFor(v) + 3}
          textAnchor="end"
          className="font-mono"
          style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        >
          {v}
        </text>
      ))}
      <text
        x={14}
        y={PAD_T + plotH / 2}
        transform={`rotate(-90 14 ${PAD_T + plotH / 2})`}
        textAnchor="middle"
        className="font-mono"
        style={{ fontSize: 10, fill: "var(--muted-foreground)", letterSpacing: "0.04em" }}
      >
        RISK REDUCTION
      </text>

      {/* X axis ticks S/M/L. */}
      {(["S", "M", "L"] as const).map((e) => (
        <text
          key={e}
          x={xFor(e)}
          y={H - PAD_B + 18}
          textAnchor="middle"
          className="font-mono"
          style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        >
          {EFFORT_LABEL[e]}
        </text>
      ))}
      <text
        x={PAD_L + plotW / 2}
        y={H - 6}
        textAnchor="middle"
        className="font-mono"
        style={{ fontSize: 10, fill: "var(--muted-foreground)", letterSpacing: "0.04em" }}
      >
        EFFORT
      </text>

      {/* Bubbles. Deterministic jitter (by id hash) so co-located actions don't
          fully overlap; pathway-breaking = destructive, others = primary. */}
      {actions.map((a) => {
        const j = jitter(a.id);
        const cx = xFor(a.effort) + j.x;
        const cy = yFor(a.impact) + j.y;
        const fill = a.breaksToxic ? "var(--destructive)" : "var(--primary)";
        const isSel = selectedId === a.id;
        return (
          <g key={a.id} style={{ cursor: onPick ? "pointer" : "default" }}>
            <circle
              cx={cx}
              cy={cy}
              r={11}
              fill={`color-mix(in oklch, ${fill} 22%, transparent)`}
              stroke={fill}
              strokeWidth={isSel ? 2.5 : 1.25}
              onClick={onPick ? () => onPick(a.id) : undefined}
            >
              <title>{a.title}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/** Deterministic small offset from an id string so overlapping bubbles spread. */
function jitter(id: string): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const ax = Math.abs(h);
  return {
    x: ((ax % 17) - 8) * 1.1,
    y: (((ax >> 5) % 17) - 8) * 1.1,
  };
}
