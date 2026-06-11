/**
 * Cost pill — mirrors EffortPill (a tiny mono letter chip) but for the cost
 * band: 0 = none/$0 ("–"), 1 = low ("L"), 2 = moderate ("M"), 3 = high ("H").
 * Tokens only; quiet neutral chip so it doesn't compete with severity/brand.
 */

const COST_LETTER: Record<0 | 1 | 2 | 3, string> = {
  0: "–",
  1: "L",
  2: "M",
  3: "H",
};

const COST_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "None",
  1: "Low",
  2: "Moderate",
  3: "High",
};

export function CostPill({ band }: { band: 0 | 1 | 2 | 3 }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 font-mono text-xs font-medium"
      style={{
        color: "var(--foreground)",
        borderColor: "var(--border)",
        background: "color-mix(in oklch, var(--foreground) 6%, transparent)",
      }}
      aria-label={`Cost ${COST_LABEL[band]}`}
    >
      {COST_LETTER[band]}
    </span>
  );
}
