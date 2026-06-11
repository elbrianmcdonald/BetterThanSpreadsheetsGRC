/**
 * Story 17.5: Cost band (AC11).
 *
 * Three vertical bars; the first `band` bars are filled (`var(--primary)`), the
 * rest are quiet hairline ghosts. band 1 = low spend, 3 = high. Tokens only.
 */

export function CostBand({ band }: { band: 0 | 1 | 2 | 3 }) {
  return (
    <span
      className="inline-flex items-end gap-0.5"
      aria-label={band === 0 ? "No cost" : `Cost band ${band} of 3`}
      role="img"
    >
      {([1, 2, 3] as const).map((i) => {
        const filled = i <= band;
        return (
          <span
            key={i}
            aria-hidden
            className="inline-block w-1 rounded-sm"
            style={{
              height: 4 + i * 3, // 7 / 10 / 13px — ascending bars
              background: filled
                ? "var(--primary)"
                : "color-mix(in oklch, var(--foreground) 14%, transparent)",
            }}
          />
        );
      })}
    </span>
  );
}
