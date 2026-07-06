/**
 * Story 17.5: Action Plan / Roadmap Deliverable — server data service + pure helpers.
 *
 * Derives a sequenced remediation roadmap from the REAL `RemediationOption` model
 * (the handoff's hypothetical "Action" model does not exist). Each option becomes
 * a {@link RoadmapAction}; the source Finding (when the parent Risk was spawned
 * from one) is attached as the single remediated `FindingLike` so the row can open
 * the SHARED Finding Drawer.
 *
 * IMPORTANT — client-bundle safety: this module's PURE exports (RoadmapAction,
 * Phase, phaseFor, groupActionsByPhase, computeRoadmapTallies, computeRoadmapScorecard)
 * are imported by client components. `PrismaClient` is therefore imported TYPE-ONLY;
 * a value import of `@prisma/client` would pull server code into the browser bundle.
 * Keep all runtime imports here type-only / pure.
 */

import type { PrismaClient } from "@prisma/client";
import type { FindingLike, ScorecardCellConfig } from "@/components/deliverable/types";

export type Phase = "0–30 days" | "30–90 days" | "1–2 quarters";

/** The three phases, in fixed display order. */
export const PHASES: Phase[] = ["0–30 days", "30–90 days", "1–2 quarters"];

/**
 * A roadmap action — one remediation initiative placed in a timeline phase with
 * effort / cost / risk-reduction metadata, plus the findings it remediates.
 */
export interface RoadmapAction {
  id: string;
  title: string;
  detail: string;
  owner: string | null;
  effort: "S" | "M" | "L";
  /** 0 = none/$0, 1 = low, 2 = moderate, 3 = high. */
  costBand: 0 | 1 | 2 | 3;
  /** Risk-reduction impact, 1–5. */
  impact: number;
  phase: Phase;
  /**
   * Whether this action breaks a "toxic" attack pathway. There is no such concept
   * in the schema yet (Epic 19) — always false for now.
   */
  breaksToxic: boolean;
  remediates: FindingLike[];
}

// ---------------------------------------------------------------------------
// Derivation helpers (pure, documented). Kept free of runtime server imports.
// ---------------------------------------------------------------------------

/**
 * EffortLevel → S/M/L band:
 *   LOW → "S", MEDIUM → "M", HIGH → "L", VERY_HIGH → "L".
 * (HIGH and VERY_HIGH collapse to the same large-effort band "L".)
 */
export function effortFor(effortLevel: string): "S" | "M" | "L" {
  switch (effortLevel) {
    case "LOW":
      return "S";
    case "MEDIUM":
      return "M";
    case "HIGH":
    case "VERY_HIGH":
      return "L";
    default:
      return "M";
  }
}

/**
 * Cost band from a dollar estimate:
 *   $0 → 0 (none), < $10,000 → 1, < $100,000 → 2, else → 3.
 */
export function costBandFor(cost: number): 0 | 1 | 2 | 3 {
  if (cost <= 0) return 0;
  if (cost < 10_000) return 1;
  if (cost < 100_000) return 2;
  return 3;
}

/**
 * Phase from a free-text timeline estimate (e.g. "2-3 weeks", "1 month",
 * "2 quarters"). Single documented heuristic:
 *   • contains "day" or "week"            → "0–30 days"
 *   • else contains "month" led by 1 or 2 → "30–90 days" (e.g. "1 month", "2 months")
 *   • else                                → "1–2 quarters"
 */
export function phaseFor(timelineEstimate: string): Phase {
  const t = (timelineEstimate ?? "").toLowerCase();
  if (t.includes("day") || t.includes("week")) return "0–30 days";
  if (t.includes("month") && /(^|\D)[12]\s*month/.test(t)) return "30–90 days";
  return "1–2 quarters";
}

/**
 * Risk-reduction impact (1–5) from the parent Risk's inherent score band:
 *   ≥20 → 5, ≥12 → 4, ≥6 → 3, ≥3 → 2, else → 1. Null/undefined defaults to 3.
 */
export function impactFor(inherentScore: number | null | undefined): number {
  if (inherentScore == null) return 3;
  if (inherentScore >= 20) return 5;
  if (inherentScore >= 12) return 4;
  if (inherentScore >= 6) return 3;
  if (inherentScore >= 3) return 2;
  return 1;
}

/**
 * Group actions into the three timeline phases. ALWAYS returns all three keys
 * (an empty phase yields an empty array, never a dropped key) so the body can
 * render an empty state rather than disappearing the section.
 */
export function groupActionsByPhase(
  actions: RoadmapAction[],
): Record<Phase, RoadmapAction[]> {
  const phases: Record<Phase, RoadmapAction[]> = {
    "0–30 days": [],
    "30–90 days": [],
    "1–2 quarters": [],
  };
  for (const a of actions) {
    const key: Phase = a.phase in phases ? a.phase : "1–2 quarters";
    phases[key].push(a);
  }
  return phases;
}

/**
 * Roadmap tallies. `quickWins` = small effort AND high risk-reduction
 * (effort "S" && impact ≥ 4). `breakPathway` counts actions that break a toxic
 * pathway (always 0 until Epic 19 lands the concept).
 */
export function computeRoadmapTallies(actions: RoadmapAction[]): {
  initiatives: number;
  breakPathway: number;
  quickWins: number;
} {
  return {
    initiatives: actions.length,
    breakPathway: actions.filter((a) => a.breaksToxic).length,
    quickWins: actions.filter((a) => a.effort === "S" && a.impact >= 4).length,
  };
}

/**
 * PURE scorecard roll-up. Returns EXACTLY three cells in a fixed order so a
 * seeded fixture can be snapshotted deterministically:
 *   1. Initiatives  (tone "brand")
 *   2. Break pathway(tone "crit")
 *   3. Quick wins   (tone "ok")
 */
export function computeRoadmapScorecard(actions: RoadmapAction[]): ScorecardCellConfig[] {
  const t = computeRoadmapTallies(actions);
  return [
    { label: "Initiatives", value: t.initiatives, tone: "brand" },
    { label: "Break pathway", value: t.breakPathway, tone: "crit" },
    { label: "Quick wins", value: t.quickWins, tone: "ok" },
  ];
}

// ---------------------------------------------------------------------------
// Org-scoped data fetch + map (server-only at call-time; the value import lives
// in the tRPC router that calls this — here PrismaClient stays type-only).
// ---------------------------------------------------------------------------

/**
 * Org-scoped fetch + map for the roadmap body. Reads `RemediationOption` joined
 * to its `Owner` (Person), its own `Finding` (finding-owned options, Story
 * 20.1), and parent `Risk` (whose source finding is the oldest RiskFindingLink
 * — Story 23.3 retired the spawn relation). Each option maps to a
 * {@link RoadmapAction}; `remediates` is the source Finding as a `FindingLike`
 * when present, else [].
 */
export async function getRoadmapDeliverableData(
  organizationId: string,
  db: PrismaClient,
): Promise<{ scorecard: ScorecardCellConfig[]; actions: RoadmapAction[] }> {
  const options = await db.remediationOption.findMany({
    where: { organizationId },
    include: {
      Owner: true,
      Finding: true,
      Risk: {
        include: {
          findingLinks: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: { finding: true },
          },
        },
      },
    },
  });

  const actions: RoadmapAction[] = options.map((opt) => {
    const risk = opt.Risk;
    const finding = opt.Finding ?? risk?.findingLinks[0]?.finding ?? null;

    // L×I for the remediated finding's severity dot comes from the parent Risk's
    // inherent likelihood/impact, defaulting to 3×3 when unscored.
    const likelihood =
      risk?.inherentLikelihood != null ? Math.round(Number(risk.inherentLikelihood)) : 3;
    const impact =
      risk?.inherentImpact != null ? Math.round(Number(risk.inherentImpact)) : 3;

    const inherentScore =
      risk?.inherentScore != null ? Number(risk.inherentScore) : null;

    const remediates: FindingLike[] = finding
      ? [
          {
            id: finding.id,
            identifier: finding.identifier,
            title: finding.title,
            likelihood,
            impact,
            domain: finding.source ?? null,
            remediationEffort: opt.effortLevel,
            rationale: finding.description ?? null,
            recommendedAction: opt.approach ?? null,
            evidence: null,
          },
        ]
      : [];

    return {
      id: opt.id,
      title: opt.title,
      detail: opt.description,
      owner: opt.Owner?.name ?? null,
      effort: effortFor(opt.effortLevel),
      costBand: costBandFor(Number(opt.costEstimate)),
      impact: impactFor(inherentScore),
      phase: phaseFor(opt.timelineEstimate),
      // TODO(Epic 19): derive from toxic-pathway analysis once it exists.
      breaksToxic: false,
      remediates,
    };
  });

  return { scorecard: computeRoadmapScorecard(actions), actions };
}
