/**
 * Risk derived-score recomputation (Story 22.1 — Risk Model Cleanup Epic 22).
 *
 * Sibling of enterpriseRiskScore.ts, one tier down:
 *   calculated = max of inherentScore across OPEN linked findings
 *                (statuses outside TERMINAL_STATUSES — closing a finding
 *                 drops it from the rollup, giving burndown for free)
 *   effective  = manualScore when useManualScore is set, else calculated
 *
 * Change-detected: only writes (and audits RISK_SCORE_RECALCULATED) when the
 * effective or calculated values actually moved. Fire-and-forget from link /
 * rescore / transition mutations — never blocks the triggering interaction.
 */

import { AuditAction, Prisma, type PrismaClient } from "@prisma/client";
import { TERMINAL_STATUSES } from "@/server/services/findingStateMachine";
import { createAuditLog } from "@/server/services/audit-log.service";
import { recomputeEnterpriseRiskScore } from "@/server/services/enterpriseRiskScore";

type Db = PrismaClient | Prisma.TransactionClient;

function decimalsEqual(a: Prisma.Decimal | null, b: Prisma.Decimal | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.equals(b);
}

/**
 * Recompute calculated/effective score for a single risk. Safe to call on
 * every link/score/status change of a linked finding. Returns the updated
 * record (or null if the risk vanished).
 *
 * @param trigger - short description for the audit trail, e.g. "finding-linked"
 * @param userId  - actor when the trigger was user-initiated (else SYSTEM-ish null)
 */
export async function recomputeRiskScore(
  db: Db,
  riskId: string,
  trigger: string,
  userId?: string,
) {
  // Story 23.5 (review MJ-4): the read→compute→write is guarded by an
  // optimistic updatedAt check with retry — concurrent recomputes (or a
  // just-committed manual override) can no longer be stomped by a staler
  // in-flight computation. On a collision we re-read and recompute.
  for (let attempt = 0; attempt < 3; attempt++) {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: {
        id: true,
        organizationId: true,
        enterpriseRiskId: true,
        useManualScore: true,
        manualScore: true,
        manualScoreLabel: true,
        calculatedScore: true,
        calculatedScoreLabel: true,
        effectiveScore: true,
        effectiveScoreLabel: true,
        effectiveScoreSource: true,
        updatedAt: true,
      },
    });
    if (!risk) return null;

    // Calculated: max inherentScore across OPEN linked findings. Unpublished
    // assessment findings (discoveryStatus PENDING) don't feed register risk
    // scores until their assessment is approved (2026-07-06) — the approval
    // flow recomputes affected risks when it publishes them.
    const links = await db.riskFindingLink.findMany({
      where: {
        riskId,
        finding: {
          status: { notIn: TERMINAL_STATUSES },
          OR: [{ discoveryStatus: "PUBLISHED" }, { discoveryStatus: null }],
        },
      },
      select: {
        finding: { select: { inherentScore: true, severityLabel: true } },
      },
    });

    let calculatedScore: Prisma.Decimal | null = null;
    let calculatedLabel: string | null = null;
    for (const link of links) {
      const score = link.finding.inherentScore;
      if (score === null || score === undefined) continue;
      if (calculatedScore === null || score.greaterThan(calculatedScore)) {
        calculatedScore = score;
        calculatedLabel = link.finding.severityLabel ?? null;
      }
    }

    const useManual = risk.useManualScore && risk.manualScore !== null;
    const newEffectiveScore = useManual ? risk.manualScore : calculatedScore;
    const newEffectiveLabel = useManual ? risk.manualScoreLabel : calculatedLabel;
    const newSource =
      newEffectiveScore === null ? null : useManual ? ("MANUAL" as const) : ("CALCULATED" as const);

    const changed =
      !decimalsEqual(risk.calculatedScore, calculatedScore) ||
      risk.calculatedScoreLabel !== calculatedLabel ||
      !decimalsEqual(risk.effectiveScore, newEffectiveScore ?? null) ||
      risk.effectiveScoreLabel !== (newEffectiveLabel ?? null) ||
      risk.effectiveScoreSource !== newSource;

    if (!changed) {
      return risk;
    }

    // Story 23.1: an accepted risk whose effective score RISES gets flagged for
    // acceptance re-review instead of silently keeping its stale decision.
    const effectiveRose =
      newEffectiveScore !== null &&
      newEffectiveScore !== undefined &&
      (risk.effectiveScore === null || newEffectiveScore.greaterThan(risk.effectiveScore));
    let flagReReview = false;
    if (effectiveRose) {
      const latestTreatment = await db.riskTreatment.findFirst({
        where: { riskId },
        orderBy: { decidedAt: "desc" },
        select: { treatmentType: true },
      });
      flagReReview = latestTreatment?.treatmentType === "ACCEPT";
    }

    const { count } = await db.risk.updateMany({
      where: { id: riskId, updatedAt: risk.updatedAt },
      data: {
        calculatedScore,
        calculatedScoreLabel: calculatedLabel,
        effectiveScore: newEffectiveScore ?? null,
        effectiveScoreLabel: newEffectiveLabel ?? null,
        effectiveScoreSource: newSource,
        ...(flagReReview
          ? {
              acceptanceReReviewRequired: true,
              // Pull the review forward so cadence queries surface it now.
              nextReviewDue: new Date(),
            }
          : {}),
      },
    });
    if (count === 0) continue; // someone else wrote first — recompute fresh

    void createAuditLog({
      organizationId: risk.organizationId,
      userId: userId ?? null,
      action: AuditAction.RISK_SCORE_RECALCULATED,
      entityType: "Risk",
      entityId: riskId,
      changes: {
        before: {
          calculatedScore: risk.calculatedScore?.toNumber() ?? null,
          effectiveScore: risk.effectiveScore?.toNumber() ?? null,
          effectiveScoreLabel: risk.effectiveScoreLabel,
          effectiveScoreSource: risk.effectiveScoreSource,
        },
        after: {
          calculatedScore: calculatedScore?.toNumber() ?? null,
          effectiveScore: newEffectiveScore?.toNumber() ?? null,
          effectiveScoreLabel: newEffectiveLabel ?? null,
          effectiveScoreSource: newSource,
          trigger,
          openLinkedFindings: links.length,
          ...(flagReReview ? { acceptanceReReviewFlagged: true } : {}),
        },
      },
    });

    // Story 22.4: two-hop cascade — a changed effective score moves the parent
    // enterprise risk's rollup (which snapshots its own trend on change).
    if (risk.enterpriseRiskId) {
      await recomputeEnterpriseRiskScore(db, risk.enterpriseRiskId);
    }

    return db.risk.findUnique({ where: { id: riskId } });
  }

  // Retries exhausted under heavy contention: the last writer's state stands;
  // the next trigger reconciles. Return current state.
  return db.risk.findUnique({ where: { id: riskId } });
}

/**
 * Recompute every risk linked to a finding (rescore / status-transition
 * triggers). Fire-and-forget friendly.
 */
export async function recomputeRiskScoresForFinding(
  db: Db,
  findingId: string,
  trigger: string,
  userId?: string,
) {
  const links = await db.riskFindingLink.findMany({
    where: { findingId },
    select: { riskId: true },
  });
  for (const link of links) {
    await recomputeRiskScore(db, link.riskId, trigger, userId);
  }
}
