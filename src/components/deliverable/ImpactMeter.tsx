/**
 * Story 17.5: Impact (risk-reduction) meter (AC11).
 *
 * Horizontal filled meter for a 1–`max` value. The filled fraction uses
 * `var(--primary)`; the track is a quiet hairline ghost. Tokens only.
 */

export function ImpactMeter({ value, max = 5 }: { value: number; max?: number }) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max === 0 ? 0 : Math.round((clamped / max) * 100);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="img"
      aria-label={`Risk reduction ${clamped} of ${max}`}
    >
      <span
        aria-hidden
        className="relative inline-block h-1.5 w-14 overflow-hidden rounded-full"
        style={{ background: "color-mix(in oklch, var(--foreground) 14%, transparent)" }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: "var(--primary)" }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {clamped}/{max}
      </span>
    </span>
  );
}
