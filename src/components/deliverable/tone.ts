/**
 * Story 17.1: Deliverable Shell — tone → token mapping (AC10) and severity logic.
 *
 * No hardcoded hex/rgb anywhere. Every visual value resolves to a design-system
 * CSS custom property from globals.css. The canonical tier scale is documented
 * there: Critical = destructive · High = severity-high · Medium = warning ·
 * Low = success.
 */

import type { DeliverableSeverity, ScorecardTone } from "./types";

/**
 * Map a scorecard tone to a CSS variable string. An invalid/absent tone falls
 * back to `var(--foreground)` without throwing (AC10).
 */
export function toneToVar(tone?: ScorecardTone | null): string {
  switch (tone) {
    case "ok":
      return "var(--success)";
    case "high":
      return "var(--severity-high)";
    case "crit":
      return "var(--destructive)";
    case "med":
      return "var(--warning)";
    case "low":
      return "var(--primary)";
    case "brand":
      return "var(--primary)";
    default:
      return "var(--foreground)";
  }
}

/**
 * Severity gating — must match the design handoff exactly. score = likelihood × impact.
 */
export function sevOf(score: number): DeliverableSeverity {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

/** Map a deliverable severity tier to its design-system token. */
export function severityToVar(sev: DeliverableSeverity): string {
  switch (sev) {
    case "critical":
      return "var(--destructive)";
    case "high":
      return "var(--severity-high)";
    case "medium":
      return "var(--warning)";
    case "low":
      return "var(--success)";
  }
}

/** Human label for a severity tier. */
export function severityLabel(sev: DeliverableSeverity): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1);
}
