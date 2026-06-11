/**
 * Epic 19 / Story 19.2: ToxicMark — the ⬡ hex badge marking toxic findings.
 *
 * Reused on the Exploitation Pathway panes AND the Findings Register row
 * (where `finding.isToxic === true`) so the two surfaces stay identical.
 * Critical/toxic color resolves to `var(--destructive)`; the tint is derived
 * from the same token via color-mix so there are no hardcoded hex values.
 */

export function ToxicMark({ size = 13 }: { size?: number }) {
  return (
    <span
      title="Part of the exploitation pathway"
      aria-label="Part of the exploitation pathway"
      className="inline-flex items-center justify-center rounded-full font-mono leading-none"
      style={{
        width: size + 6,
        height: size + 6,
        fontSize: size,
        background: "color-mix(in oklch, var(--destructive) 12%, transparent)",
        color: "var(--destructive)",
      }}
    >
      ⬡
    </span>
  );
}
