/**
 * Finding scoring options — pure helpers shared by every finding-creation
 * entry point (findings register form, compliance/maturity dialog,
 * risk-assessment project dialog, vendor questionnaire).
 *
 * Story 20.1: Score a Finding at Creation (Risk Model Cleanup Epic 20).
 * Extracted from CreateFindingDialog so all entry points share one severity
 * vocabulary and one submit-field mapping. No React in this module — it is
 * unit-tested standalone.
 */

import { Severity } from "@prisma/client";
import type { Threshold } from "@/lib/matrix/types";

/**
 * Severity option as rendered in a categorical dropdown. When the org has a
 * default risk matrix, the matrix's threshold labels (with their colors) are
 * surfaced so findings and risks share the same vocabulary; otherwise the
 * legacy HIGH/MEDIUM/LOW enum values are used.
 */
export type SeverityOption = {
  /** Stable key for the dropdown — uses the threshold label or enum value */
  key: string;
  /** Human-readable label, e.g. "Critical" */
  label: string;
  /** Hex color from the matrix threshold (or null for legacy options) */
  color: string | null;
  /** Coarse Severity enum that gets persisted alongside severityLabel */
  severity: Severity;
  /** Threshold label (matches Risk.inherentScoreLabel format) */
  severityLabel: string | null;
};

export const FALLBACK_SEVERITY_OPTIONS: SeverityOption[] = [
  { key: "HIGH", label: "High", color: null, severity: "HIGH", severityLabel: null },
  { key: "MEDIUM", label: "Medium", color: null, severity: "MEDIUM", severityLabel: null },
  { key: "LOW", label: "Low", color: null, severity: "LOW", severityLabel: null },
];

/**
 * Map a threshold position (0-indexed, sorted by sortOrder ascending) to
 * the legacy Severity enum so existing filters/badges keep working. The
 * top tier always maps to HIGH and the bottom tier to LOW; intermediates
 * fall to MEDIUM. For a typical 4-tier matrix (Low/Medium/High/Critical)
 * this gives Low→LOW, Medium→MEDIUM, High→MEDIUM, Critical→HIGH.
 */
export function severityForThresholdIndex(index: number, total: number): Severity {
  if (total <= 1) return "MEDIUM";
  if (index === 0) return "LOW";
  if (index === total - 1) return "HIGH";
  return "MEDIUM";
}

/**
 * Coarse Severity enum from a matrix threshold label. Mirrors the server
 * (finding.ts `severityFromLabel`): Critical/High → HIGH, Low → LOW, else
 * MEDIUM. Used for the live preview only; the server recomputes authoritatively.
 */
export function severityFromLabel(label: string | null | undefined): Severity {
  if (!label) return "MEDIUM";
  const upper = label.toUpperCase();
  if (upper === "CRITICAL" || upper === "HIGH") return "HIGH";
  if (upper === "LOW") return "LOW";
  return "MEDIUM";
}

export function buildSeverityOptions(
  thresholds: Threshold[] | null | undefined
): SeverityOption[] {
  if (!thresholds || thresholds.length === 0) return FALLBACK_SEVERITY_OPTIONS;
  // Sort ascending by sortOrder so position-based mapping is predictable,
  // then reverse for display so the highest tier appears first.
  const sortedAsc = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = sortedAsc.length;
  const options = sortedAsc.map((t, i) => ({
    key: t.label,
    label: t.label,
    color: t.color,
    severity: severityForThresholdIndex(i, total),
    severityLabel: t.label,
  }));
  return options.reverse();
}

/**
 * Normalized scoring state reported by FindingMatrixScoringSection. One shape
 * for both paths: matrix L×I(×E) scoring and the categorical fallback.
 */
export interface FindingScoringValue {
  mode: "matrix" | "categorical";
  likelihood: number | null;
  impact: number | null;
  exposure: number | null;
  is3D: boolean;
  /** Categorical selection, or advisory severity derived from the live score */
  severity: Severity;
  /** Threshold label backing the selection/live score (null without a matrix) */
  severityLabel: string | null;
  matrixVersionId: string | null;
  /** Matrix mode: all axes picked. Categorical mode: always true. */
  isComplete: boolean;
}

/** Scoring fields accepted by finding.create / createFromQuestionnaireResponse. */
export interface ScoringSubmitFields {
  severity: Severity;
  severityLabel?: string;
  matrixVersionId?: string;
  likelihood?: number;
  impact?: number;
  exposure?: number;
}

/**
 * Map the normalized scoring state to mutation input fields. Matrix mode
 * sends L/I(/E) + matrixVersionId and lets the server compute the score and
 * labels authoritatively (client severity is advisory). Categorical mode
 * sends the picked severity, plus the threshold label + version when the
 * dropdown tiers came from a matrix.
 */
export function buildScoringSubmitFields(v: FindingScoringValue): ScoringSubmitFields {
  if (v.mode === "matrix" && v.isComplete && v.likelihood != null && v.impact != null) {
    return {
      severity: v.severity,
      likelihood: v.likelihood,
      impact: v.impact,
      exposure: v.is3D && v.exposure != null ? v.exposure : undefined,
      matrixVersionId: v.matrixVersionId ?? undefined,
    };
  }
  return {
    severity: v.severity,
    severityLabel: v.severityLabel ?? undefined,
    matrixVersionId:
      v.severityLabel && v.matrixVersionId ? v.matrixVersionId : undefined,
  };
}
