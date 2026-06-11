/**
 * Story 17.1: Deliverable Shell — shared types
 *
 * These types are intentionally assessment-type-agnostic. The shell knows only
 * about a cover, a scorecard config, and a body slot. Type-specific logic
 * (risk / compliance / maturity) lives in the body modules (Stories 17.2–17.5).
 */

/** Tone keys map to design-system tokens via {@link toneToVar}. */
export type ScorecardTone = "ok" | "high" | "crit" | "med" | "low" | "brand";

export interface ScorecardCellConfig {
  label: string;
  value: string | number;
  suffix?: string;
  deltaNote?: string;
  tone?: ScorecardTone;
}

export interface DeliverableCover {
  /** Defaults to "CONFIDENTIAL". */
  confidentialLabel?: string;
  eyebrow: string;
  title: string;
  engagement: string;
  period: string;
  preparedBy: string;
}

/** The four severity tiers from the design handoff (sevOf). */
export type DeliverableSeverity = "critical" | "high" | "medium" | "low";

/**
 * The minimal shape any body row needs to open the shared Finding Drawer.
 * Bodies (17.2–17.5) widen this with their own fields; the drawer renders the
 * common subset.
 */
export interface FindingLike {
  id: string;
  identifier?: string | null;
  title: string;
  likelihood: number;
  impact: number;
  domain?: string | null;
  remediationEffort?: string | null;
  rationale?: string | null;
  recommendedAction?: string | null;
  evidence?: string | null;
}
