/**
 * Story 17.5: Effort pill (AC11).
 *
 * Tiny mono pill rendering the derived effort band S / M / L. Tokens only — the
 * pill tints from `var(--foreground)` so it reads as a quiet neutral chip and
 * does not compete with the severity/brand colors used elsewhere on the card.
 */

export function EffortPill({ effort }: { effort: "S" | "M" | "L" }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 font-mono text-xs font-medium"
      style={{
        color: "var(--foreground)",
        borderColor: "var(--border)",
        background: "color-mix(in oklch, var(--foreground) 6%, transparent)",
      }}
      aria-label={`Effort ${effort}`}
    >
      {effort}
    </span>
  );
}
