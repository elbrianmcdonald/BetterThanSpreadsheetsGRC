/**
 * Story 17.4: a single domain's maturity bar on a fixed 0–5 axis.
 *
 * The current level is the colored fill (by {@link levelColor}); the target is
 * a notch/marker on the SAME bar — never a second full bar that hides the gap
 * (AC2). The axis is fixed at 0–5 so bars are visually comparable across
 * domains (AC6). NA rows render muted with no fill.
 *
 * Presentational only — all data arrives via props; no tRPC, no fetching.
 */

import { levelColor } from "@/server/services/deliverableMaturityData";

const AXIS_MAX = 5;

export function DomainMaturityBar({
  name,
  currentLevel,
  targetLevel,
  isNotApplicable = false,
}: {
  name: string;
  currentLevel: number | null;
  targetLevel: number | null;
  isNotApplicable?: boolean;
}) {
  const na = isNotApplicable || currentLevel === null;
  const fillPct = na ? 0 : (clamp(currentLevel) / AXIS_MAX) * 100;
  const hasTarget = !na && targetLevel !== null;
  const targetPct = hasTarget ? (clamp(targetLevel) / AXIS_MAX) * 100 : 0;
  const gap =
    !na && currentLevel !== null && targetLevel !== null
      ? targetLevel - currentLevel
      : null;
  const belowTarget = gap !== null && gap > 0;

  const fillColor = na ? "var(--muted-foreground)" : levelColor(currentLevel);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="flex items-center gap-2 font-mono text-xs">
          {na ? (
            <span style={{ color: "var(--muted-foreground)" }}>N/A</span>
          ) : (
            <>
              <span style={{ color: fillColor }}>{currentLevel}</span>
              {targetLevel !== null ? (
                <span style={{ color: "var(--muted-foreground)" }}>
                  / target {targetLevel}
                </span>
              ) : null}
              {belowTarget ? (
                <span
                  className="rounded px-1 py-0.5 text-[0.65rem] font-semibold"
                  style={{
                    color: "var(--severity-high)",
                    background:
                      "color-mix(in oklch, var(--severity-high) 14%, var(--card))",
                  }}
                >
                  −{gap}
                </span>
              ) : null}
            </>
          )}
        </span>
      </div>

      {/* Track — fixed 0–5 axis */}
      <div
        className="relative h-3 w-full overflow-hidden rounded-sm"
        style={{ background: "color-mix(in oklch, var(--border) 60%, var(--card))" }}
        role="img"
        aria-label={
          na
            ? `${name}: not applicable`
            : `${name}: level ${currentLevel} of ${AXIS_MAX}${
                targetLevel !== null ? `, target ${targetLevel}` : ""
              }`
        }
      >
        {/* Current-level fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-sm transition-[width]"
          style={{
            width: `${fillPct}%`,
            background: fillColor,
          }}
        />
        {/* Target marker — a notch on the same bar, not a second bar */}
        {hasTarget ? (
          <div
            className="absolute inset-y-0 w-0.5"
            style={{
              left: `calc(${targetPct}% - 1px)`,
              background: "var(--foreground)",
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function clamp(level: number | null): number {
  if (level === null) return 0;
  if (level < 0) return 0;
  if (level > AXIS_MAX) return AXIS_MAX;
  return level;
}
