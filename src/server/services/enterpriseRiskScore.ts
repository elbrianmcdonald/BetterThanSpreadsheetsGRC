/**
 * Enterprise Risk Score recomputation.
 *
 * Calculated score = max of (residualScore ?? inherentScore) across child risks.
 * Effective score = manualScore when useManualScore is true and manualScore is set,
 *                   otherwise calculated.
 *
 * On every recompute we compare the new effective score to the cached one and
 * append a snapshot row if it changed (powers the trend chart).
 */

import { Prisma, type PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

function decimalsEqual(a: Prisma.Decimal | null, b: Prisma.Decimal | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.equals(b);
}

/**
 * Recompute calculated/effective score for a single enterprise risk and write a
 * snapshot if the effective score changed. Safe to call on every child-risk
 * change. Returns the updated record (or null if not found).
 */
export async function recomputeEnterpriseRiskScore(
  db: Db,
  enterpriseRiskId: string,
) {
  const er = await db.enterpriseRisk.findUnique({
    where: { id: enterpriseRiskId },
    select: {
      id: true,
      useManualScore: true,
      manualScore: true,
      manualScoreLabel: true,
      effectiveScore: true,
      effectiveScoreLabel: true,
      effectiveScoreSource: true,
    },
  });
  if (!er) return null;

  // Calculated score: max of residual (preferred) or inherent across child risks.
  const children = await db.risk.findMany({
    where: { enterpriseRiskId },
    select: { residualScore: true, residualScoreLabel: true, inherentScore: true, inherentScoreLabel: true },
  });

  let calculatedScore: Prisma.Decimal | null = null;
  let calculatedLabel: string | null = null;
  for (const child of children) {
    const score = child.residualScore ?? child.inherentScore;
    const label = child.residualScore ? child.residualScoreLabel : child.inherentScoreLabel;
    if (score === null || score === undefined) continue;
    if (calculatedScore === null || score.greaterThan(calculatedScore)) {
      calculatedScore = score;
      calculatedLabel = label ?? null;
    }
  }

  const useManual = er.useManualScore && er.manualScore !== null;
  const newEffectiveScore = useManual ? er.manualScore : calculatedScore;
  const newEffectiveLabel = useManual ? er.manualScoreLabel : calculatedLabel;
  const newSource = useManual ? "MANUAL" : "CALCULATED";

  const changed =
    !decimalsEqual(er.effectiveScore, newEffectiveScore ?? null) ||
    er.effectiveScoreLabel !== (newEffectiveLabel ?? null) ||
    er.effectiveScoreSource !== newSource;

  if (!changed) {
    return er;
  }

  const updated = await db.enterpriseRisk.update({
    where: { id: enterpriseRiskId },
    data: {
      effectiveScore: newEffectiveScore ?? null,
      effectiveScoreLabel: newEffectiveLabel ?? null,
      effectiveScoreSource: newSource,
    },
  });

  await db.enterpriseRiskSeveritySnapshot.create({
    data: {
      enterpriseRiskId,
      score: newEffectiveScore ?? null,
      scoreLabel: newEffectiveLabel ?? null,
      source: newSource,
    },
  });

  return updated;
}
