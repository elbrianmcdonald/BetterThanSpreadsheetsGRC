/**
 * Legacy risk-model backfill + parity proof (Story 23.2 — Risk Model Cleanup).
 *
 * Idempotent, re-runnable passes gating (and re-verifiable after) the Story
 * 23.3 column drops:
 *
 * 1. repairManualScoreInit — re-runs the Story 22.1 initialization for any
 *    risk it missed: legacy directly-entered scores move to manual-override
 *    mode (`manualScore = residualScore ?? inherentScore`, effective mirrors
 *    manual). Guarded so risks already on the new model — an override set, a
 *    rollup computed, or explicitly switched to calculated — are never
 *    clobbered; they surface in the parity report instead.
 *
 * 2. generateParityReport — every legacy-scored risk, old score vs. new
 *    effective score. Mismatches are classified, not auto-fixed:
 *    MANUAL_OVERRIDE_CHANGED and ROLLUP_DRIVEN are reviewed exceptions;
 *    UNEXPLAINED fails the gate.
 *
 * (The spawn-link pass — `Risk.spawnedFromFindingId` → `RiskFindingLink` —
 * ran to completion in Story 23.2 and was removed in 23.3 with the column.)
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type Db = PrismaClient;

/**
 * All passes accept an optional org scope. The prod runner goes unscoped
 * (whole deployment); tests scope to their fixture org so parallel suites'
 * transient risks are never touched or counted.
 */
export interface BackfillScope {
  organizationId?: string;
}

function orgWhere(scope?: BackfillScope) {
  return scope?.organizationId ? { organizationId: scope.organizationId } : {};
}

export interface ManualInitRepairResult {
  /** Risks repaired into manual mode this run */
  repaired: number;
  /** Repaired risk ids (for the report/log) */
  repairedRiskIds: string[];
}

export type ParityMismatchReason =
  | "MANUAL_OVERRIDE_CHANGED" // user moved the override after initialization
  | "ROLLUP_DRIVEN" // effective legitimately derives from linked findings
  | "UNEXPLAINED"; // fails the gate

export interface ParityRow {
  riskId: string;
  identifier: string | null;
  title: string;
  organizationId: string;
  /** Legacy directly-entered score: residualScore ?? inherentScore */
  oldScore: number;
  /** New-model effective score */
  newEffectiveScore: number | null;
  effectiveScoreSource: string | null;
  match: boolean;
  mismatchReason: ParityMismatchReason | null;
}

export interface ParityReport {
  totalLegacyScored: number;
  matches: number;
  reviewedExceptions: number;
  unexplained: number;
  /** True when every row matches or is a classified, reviewed exception */
  pass: boolean;
  rows: ParityRow[];
}

export async function repairManualScoreInit(
  db: Db,
  scope?: BackfillScope,
): Promise<ManualInitRepairResult> {
  // "Missed by initialization" = has a legacy score but has never been
  // touched by any new-model machinery. A set manualScore, a computed
  // rollup, an explicit switch to calculated mode, or ANY RiskFindingLink
  // disqualifies — a linked risk whose findings have all closed has a
  // legitimately-empty rollup (calculatedScore null) and must NOT be flipped
  // back to a stale legacy score (Story 23.5, review MJ-8: makes the repair
  // pass safe to re-run after cutover).
  const missed = await db.risk.findMany({
    where: {
      useManualScore: false,
      manualScore: null,
      calculatedScore: null,
      findingLinks: { none: {} },
      OR: [{ residualScore: { not: null } }, { inherentScore: { not: null } }],
      ...orgWhere(scope),
    },
    select: {
      id: true,
      organizationId: true,
      residualScore: true,
      residualScoreLabel: true,
      residualLikelihood: true,
      residualImpact: true,
      inherentScore: true,
      inherentScoreLabel: true,
      inherentLikelihood: true,
      inherentImpact: true,
    },
  });

  for (const r of missed) {
    // Per-column COALESCE — exact parity with the Story 22.1 initialization SQL.
    const score = r.residualScore ?? r.inherentScore;
    const label = r.residualScoreLabel ?? r.inherentScoreLabel;
    const likelihood = r.residualLikelihood ?? r.inherentLikelihood;
    const impact = r.residualImpact ?? r.inherentImpact;

    await runWithOrganizationContext(r.organizationId, async () => {
      await db.risk.update({
        where: { id: r.id },
        data: {
          useManualScore: true,
          manualScore: score,
          manualScoreLabel: label,
          manualLikelihood: likelihood,
          manualImpact: impact,
          effectiveScore: score,
          effectiveScoreLabel: label,
          effectiveScoreSource: "MANUAL",
        },
      });
    });
  }

  return { repaired: missed.length, repairedRiskIds: missed.map((r) => r.id) };
}

export async function generateParityReport(
  db: Db,
  scope?: BackfillScope,
): Promise<ParityReport> {
  const legacyScored = await db.risk.findMany({
    where: {
      OR: [{ residualScore: { not: null } }, { inherentScore: { not: null } }],
      ...orgWhere(scope),
    },
    select: {
      id: true,
      identifier: true,
      title: true,
      organizationId: true,
      residualScore: true,
      inherentScore: true,
      useManualScore: true,
      manualScore: true,
      effectiveScore: true,
      effectiveScoreSource: true,
      _count: { select: { findingLinks: true } },
    },
    orderBy: { identifier: "asc" },
  });

  const rows: ParityRow[] = legacyScored.map((r) => {
    const oldScore = (r.residualScore ?? r.inherentScore) as Prisma.Decimal;
    const match = r.effectiveScore !== null && oldScore.equals(r.effectiveScore);

    let mismatchReason: ParityMismatchReason | null = null;
    if (!match) {
      if (r.useManualScore && r.manualScore !== null && !oldScore.equals(r.manualScore)) {
        mismatchReason = "MANUAL_OVERRIDE_CHANGED";
      } else if (r.effectiveScoreSource === "CALCULATED" || r._count.findingLinks > 0) {
        // A link-governed risk is rollup-driven even when the rollup is
        // currently EMPTY (all linked findings closed → effective null) —
        // Story 23.5, review MJ-8 companion fix.
        mismatchReason = "ROLLUP_DRIVEN";
      } else {
        mismatchReason = "UNEXPLAINED";
      }
    }

    return {
      riskId: r.id,
      identifier: r.identifier,
      title: r.title,
      organizationId: r.organizationId,
      oldScore: Number(oldScore),
      newEffectiveScore: r.effectiveScore === null ? null : Number(r.effectiveScore),
      effectiveScoreSource: r.effectiveScoreSource,
      match,
      mismatchReason,
    };
  });

  const matches = rows.filter((r) => r.match).length;
  const unexplained = rows.filter((r) => r.mismatchReason === "UNEXPLAINED").length;

  return {
    totalLegacyScored: rows.length,
    matches,
    reviewedExceptions: rows.length - matches - unexplained,
    unexplained,
    pass: unexplained === 0,
    rows,
  };
}

/** Run the passes in order; returns everything the runner prints. */
export async function runLegacyRiskBackfill(db: Db, scope?: BackfillScope) {
  const manualInit = await repairManualScoreInit(db, scope);
  const parity = await generateParityReport(db, scope);
  return { manualInit, parity };
}
