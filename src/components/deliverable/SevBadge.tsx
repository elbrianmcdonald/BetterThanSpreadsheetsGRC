/**
 * Story 17.1: Deliverable severity badge (4-tier).
 *
 * The app's existing SeverityBadge is a 3-level enum (HIGH/MEDIUM/LOW). The
 * deliverable surfaces the handoff's 4-tier L×I scale (critical/high/medium/low),
 * so this is a small deliverable-local badge mapped to the documented tier tokens.
 */

import { severityLabel, severityToVar } from "./tone";
import type { DeliverableSeverity } from "./types";

export function SevBadge({
  severity,
  size = "md",
}: {
  severity: DeliverableSeverity;
  size?: "sm" | "md";
}) {
  const color = severityToVar(severity);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wide"
      style={{
        fontSize: size === "sm" ? 10 : 11,
        padding: size === "sm" ? "1px 7px" : "2px 9px",
        color,
        borderColor: color,
        // Tint background from the same token so it reads as a quiet pill, not candy.
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: color }}
      />
      {severityLabel(severity)}
    </span>
  );
}
