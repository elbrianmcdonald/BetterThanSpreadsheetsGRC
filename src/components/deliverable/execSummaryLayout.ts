/**
 * Executive-summary section layout — shared, kind-aware, pure config.
 *
 * Each assessment kind has its own ordered set of deliverable sections (a mix of
 * type-native sections and the cross-cutting ones — statement, heatmap, findings,
 * action plans, pathway, interviewees). This module owns the per-kind default
 * order, the labels, and a normalizer that turns the persisted JSON into a
 * complete `[{ key, enabled }]` list. Shared by the bodies, the Customize dialog,
 * the tRPC mutation/service, and the PDF builder. Keep free of React/Prisma.
 *
 * The cover + scorecard ("Scores") are the report header and are NOT configurable.
 */

import type { AssessmentKind } from "@/components/engagement/types";

export type ExecSectionKey =
  // cross-cutting
  | "statement"
  | "heatmap"
  | "findings"
  | "actionPlans"
  | "pathway"
  | "interviewees"
  // risk-native
  | "graphs"
  | "risks"
  // compliance-native
  | "controls"
  | "gaps"
  // maturity-native
  | "domains"
  | "belowTarget"
  // vendor-native
  | "vendorSummary"
  | "questionnaires"
  // bia-native
  | "criticality"
  | "impacts"
  | "dependencies"
  | "biaRisks";

export interface ExecSectionConfig {
  key: ExecSectionKey;
  enabled: boolean;
}

export const EXEC_SECTION_LABELS: Record<ExecSectionKey, string> = {
  statement: "Executive Statement",
  heatmap: "Risk Heatmap",
  findings: "Findings",
  actionPlans: "Action Plans",
  pathway: "Exploitation Pathway",
  interviewees: "People Interviewed",
  graphs: "Graphs",
  risks: "Risks",
  controls: "Control Status",
  gaps: "Gap Register",
  domains: "Domain Maturity",
  belowTarget: "Below Target",
  vendorSummary: "Assessment Summary",
  questionnaires: "Questionnaire Completion",
  criticality: "Criticality & Recovery",
  impacts: "Impact by Category",
  dependencies: "Dependencies",
  biaRisks: "Linked Risks",
};

/** Canonical section order per assessment kind. */
const SECTIONS_BY_KIND: Record<AssessmentKind, ExecSectionKey[]> = {
  RISK: ["statement", "graphs", "actionPlans", "risks", "pathway", "findings", "interviewees"],
  COMPLIANCE: ["statement", "controls", "gaps", "heatmap", "findings", "actionPlans", "pathway", "interviewees"],
  MATURITY: ["statement", "domains", "belowTarget", "heatmap", "findings", "actionPlans", "pathway", "interviewees"],
  VENDOR: ["statement", "vendorSummary", "questionnaires", "heatmap", "findings", "actionPlans", "pathway", "interviewees"],
  BIA: ["statement", "criticality", "impacts", "dependencies", "biaRisks", "actionPlans", "pathway", "interviewees"],
};

/** The ordered section keys valid for a given assessment kind. */
export function sectionsForKind(kind: AssessmentKind): ExecSectionKey[] {
  return SECTIONS_BY_KIND[kind];
}

/** Canonical default: every section for the kind enabled, in declaration order. */
export function defaultLayout(kind: AssessmentKind): ExecSectionConfig[] {
  return sectionsForKind(kind).map((key) => ({ key, enabled: true }));
}

/**
 * Normalize persisted layout JSON for a kind into a complete ordered list: keep
 * recognized keys in their saved order (dedup), then append any of the kind's
 * remaining keys (enabled) in canonical order. Keys not valid for the kind are
 * dropped. A null/garbage input → the kind's default.
 */
export function normalizeLayout(kind: AssessmentKind, raw: unknown): ExecSectionConfig[] {
  const valid = new Set<string>(sectionsForKind(kind));
  const out: ExecSectionConfig[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = (item as { key?: unknown })?.key;
      if (typeof key === "string" && valid.has(key) && !seen.has(key)) {
        seen.add(key);
        out.push({ key: key as ExecSectionKey, enabled: (item as { enabled?: unknown }).enabled !== false });
      }
    }
  }
  for (const key of sectionsForKind(kind)) {
    if (!seen.has(key)) out.push({ key, enabled: true });
  }
  return out;
}

/** Validate a layout payload for a kind (mutation guard). */
export function isValidLayoutPayload(kind: AssessmentKind, raw: unknown): raw is ExecSectionConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const valid = new Set<string>(sectionsForKind(kind));
  return raw.every(
    (i) =>
      i &&
      typeof (i as ExecSectionConfig).key === "string" &&
      valid.has((i as ExecSectionConfig).key) &&
      typeof (i as ExecSectionConfig).enabled === "boolean",
  );
}
