/**
 * Risk Impact Calculator Service
 *
 * Calculates impact scores for risks based on multiple weighted factors.
 *
 * Story 4.7: Automated Impact Calculation Engine
 * - AC1: Weighted sum formula: (severity × 40%) + (frameworks × 30%) + (criticality × 20%) + (audit × 10%)
 * - AC2: Severity scores: HIGH=100, MEDIUM=50, LOW=25
 * - AC3: Frameworks affected score: (# frameworks) × 20 (max 100)
 * - AC4: Asset criticality: CRITICAL=100, HIGH=75, MEDIUM=50, LOW=25, NONE=0
 * - AC5: Audit proximity: <30 days=100, 30-60=75, 60-90=50, >90=25, no audit=0
 * - AC6: Final impact score range: 0-100
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import type { PrismaClient, Severity, AssetCriticality, Risk } from "@prisma/client";

/**
 * Breakdown of impact score components for transparency
 */
export interface ImpactScoreBreakdown {
  /** Severity component score (0-100) */
  severityScore: number;
  /** Frameworks affected component score (0-100) */
  frameworksScore: number;
  /** Asset criticality component score (0-100) */
  criticalityScore: number;
  /** Audit proximity component score (0-100) */
  auditScore: number;
  /** Final weighted score (0-100) */
  totalScore: number;
  /** Number of frameworks affected */
  frameworksAffectedCount: number;
  /** Days until next audit (null if no audit date) */
  daysUntilAudit: number | null;
  /** List of affected framework names */
  affectedFrameworkNames: string[];
}

/**
 * Weights for each component of the impact score
 * @see AC1
 */
const WEIGHTS = {
  severity: 0.4,
  frameworks: 0.3,
  criticality: 0.2,
  audit: 0.1,
} as const;

/**
 * Severity scores mapping
 * @see AC2
 */
const SEVERITY_SCORES: Record<Severity, number> = {
  HIGH: 100,
  MEDIUM: 50,
  LOW: 25,
};

/**
 * Asset criticality scores mapping
 * @see AC4
 */
const CRITICALITY_SCORES: Record<AssetCriticality, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  NONE: 0,
};

/**
 * Calculate severity score
 * @see AC2
 */
export function calculateSeverityScore(severity: Severity): number {
  return SEVERITY_SCORES[severity];
}

/**
 * Calculate frameworks affected score
 * @see AC3: (# frameworks) × 20, max 100 for 5+ frameworks
 */
export function calculateFrameworksScore(frameworksCount: number): number {
  return Math.min(frameworksCount * 20, 100);
}

/**
 * Calculate asset criticality score
 * @see AC4
 */
export function calculateCriticalityScore(criticality: AssetCriticality): number {
  return CRITICALITY_SCORES[criticality];
}

/**
 * Calculate audit proximity score based on days until next audit
 * @see AC5: <30=100, 30-60=75, 60-90=50, >90=25, null=0
 */
export function calculateAuditProximityScore(nextAuditDate: Date | null): {
  score: number;
  daysUntilAudit: number | null;
} {
  if (!nextAuditDate) {
    return { score: 0, daysUntilAudit: null };
  }

  const now = new Date();
  const daysUntilAudit = Math.floor(
    (nextAuditDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Past audits don't contribute to urgency
  if (daysUntilAudit < 0) {
    return { score: 0, daysUntilAudit };
  }

  let score: number;
  if (daysUntilAudit < 30) {
    score = 100;
  } else if (daysUntilAudit < 60) {
    score = 75;
  } else if (daysUntilAudit < 90) {
    score = 50;
  } else {
    score = 25;
  }

  return { score, daysUntilAudit };
}

/**
 * Calculate frameworks affected by a risk through linked evidence
 *
 * Counts distinct frameworks that have controls mapped to evidence linked to this risk.
 *
 * @see AC18-AC21
 */
export async function calculateFrameworksAffected(
  riskId: string,
  db: PrismaClient
): Promise<{ count: number; frameworkNames: string[] }> {
  // Get all evidence linked to this risk
  const linkedEvidence = await db.riskEvidence.findMany({
    where: { riskId },
    select: {
      Evidence: {
        select: {
          id: true,
          EvidenceControlDomain: {
            select: {
              ControlDomain: {
                select: {
                  ControlDomainMapping: {
                    select: {
                      frameworkCode: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Collect unique framework codes
  const frameworkCodes = new Set<string>();
  linkedEvidence.forEach((re) => {
    re.Evidence.EvidenceControlDomain.forEach((ecd) => {
      ecd.ControlDomain.ControlDomainMapping.forEach((cdm) => {
        frameworkCodes.add(cdm.frameworkCode);
      });
    });
  });

  // Get framework names for display
  const frameworkNames: string[] = [];
  if (frameworkCodes.size > 0) {
    const frameworks = await db.framework.findMany({
      where: {
        code: { in: Array.from(frameworkCodes) },
      },
      select: { code: true, name: true },
    });
    frameworkNames.push(...frameworks.map((f) => f.name));
  }

  return { count: frameworkCodes.size, frameworkNames };
}

/**
 * Calculate complete impact score with breakdown
 *
 * @see AC1-AC6
 */
export async function calculateImpactScore(
  risk: Pick<Risk, "id" | "severity" | "assetCriticality" | "nextAuditDate">,
  db: PrismaClient
): Promise<ImpactScoreBreakdown> {
  // Calculate component scores
  const severityScore = calculateSeverityScore(risk.severity);
  const criticalityScore = calculateCriticalityScore(risk.assetCriticality);
  const { score: auditScore, daysUntilAudit } = calculateAuditProximityScore(
    risk.nextAuditDate
  );

  // Calculate frameworks affected
  const { count: frameworksAffectedCount, frameworkNames: affectedFrameworkNames } =
    await calculateFrameworksAffected(risk.id, db);
  const frameworksScore = calculateFrameworksScore(frameworksAffectedCount);

  // Calculate weighted sum (AC1)
  const totalScore = Math.round(
    severityScore * WEIGHTS.severity +
      frameworksScore * WEIGHTS.frameworks +
      criticalityScore * WEIGHTS.criticality +
      auditScore * WEIGHTS.audit
  );

  return {
    severityScore,
    frameworksScore,
    criticalityScore,
    auditScore,
    totalScore,
    frameworksAffectedCount,
    daysUntilAudit,
    affectedFrameworkNames,
  };
}

/**
 * Recalculate and update impact score for a risk
 *
 * @returns Updated impact score breakdown
 */
export async function recalculateRiskImpact(
  riskId: string,
  db: PrismaClient
): Promise<ImpactScoreBreakdown> {
  // Fetch risk with required fields
  const risk = await db.risk.findUnique({
    where: { id: riskId },
    select: {
      id: true,
      severity: true,
      assetCriticality: true,
      nextAuditDate: true,
    },
  });

  if (!risk) {
    throw new Error(`Risk not found: ${riskId}`);
  }

  // Calculate impact score
  const breakdown = await calculateImpactScore(risk, db);

  // Update risk with new score
  await db.risk.update({
    where: { id: riskId },
    data: {
      impactScore: breakdown.totalScore,
      impactScoreCalculatedAt: new Date(),
    },
  });

  return breakdown;
}
