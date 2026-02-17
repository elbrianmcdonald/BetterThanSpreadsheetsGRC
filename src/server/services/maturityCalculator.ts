/**
 * Maturity Calculator Service
 *
 * Calculates maturity scores based on framework-specific scoring methodologies.
 *
 * Supported frameworks:
 * - NIST CSF 2.0: Implementation Tiers 1-4 (Partial, Risk Informed, Repeatable, Adaptive)
 * - C2M2: Maturity Indicator Levels 0-3 (Not Performed, Initiated, Performed, Managed)
 * - OWASP SAMM: Maturity Levels 0-3 (Implicit, Initial, Managed, Defined)
 */

import { MaturityFrameworkType } from "@prisma/client";

/**
 * Scoring result containing both level and decimal score
 */
export interface MaturityScoreResult {
  level: number; // Integer level (1-4 for NIST, 0-3 for C2M2)
  score: number; // Decimal score for more granular comparison
  method: string; // Description of calculation method used
}

/**
 * Framework scoring configuration
 */
interface FrameworkScoringConfig {
  minLevel: number;
  maxLevel: number;
  method: "lowest" | "average" | "weighted";
}

const FRAMEWORK_CONFIG: Record<MaturityFrameworkType, FrameworkScoringConfig> = {
  NIST_CSF_2: {
    minLevel: 1,
    maxLevel: 4,
    method: "lowest", // NIST CSF uses "lowest function" or "average" - we default to lowest for conservative assessment
  },
  C2M2: {
    minLevel: 0,
    maxLevel: 3,
    method: "lowest", // C2M2 overall MIL is typically the lowest domain MIL
  },
  OWASP_SAMM: {
    minLevel: 0,
    maxLevel: 3,
    method: "average", // SAMM uses averages, NOT lowest
  },
};

/**
 * Calculate maturity score based on framework type and domain scores
 *
 * @param frameworkType - The type of maturity framework
 * @param domainScores - Array of integer scores for each domain
 * @param options - Optional configuration for calculation method
 * @returns MaturityScoreResult with level, score, and method description
 */
export function calculateMaturityScore(
  frameworkType: MaturityFrameworkType,
  domainScores: number[],
  options?: { method?: "lowest" | "average" | "weighted" }
): MaturityScoreResult {
  if (domainScores.length === 0) {
    const config = FRAMEWORK_CONFIG[frameworkType];
    return {
      level: config.minLevel,
      score: config.minLevel,
      method: "No scores available",
    };
  }

  const config = FRAMEWORK_CONFIG[frameworkType];
  const method = options?.method ?? config.method;

  switch (method) {
    case "lowest":
      return calculateLowestScore(domainScores, config);
    case "average":
      return calculateAverageScore(domainScores, config);
    case "weighted":
      return calculateWeightedScore(domainScores, config);
    default:
      return calculateAverageScore(domainScores, config);
  }
}

/**
 * Calculate using lowest domain score (conservative approach)
 * Used by: NIST CSF 2.0, C2M2
 */
function calculateLowestScore(
  scores: number[],
  config: FrameworkScoringConfig
): MaturityScoreResult {
  const minScore = Math.min(...scores);
  const clampedScore = Math.max(config.minLevel, Math.min(config.maxLevel, minScore));

  return {
    level: clampedScore,
    score: clampedScore,
    method: "Lowest domain score (conservative)",
  };
}

/**
 * Calculate using average of all domain scores
 */
function calculateAverageScore(
  scores: number[],
  config: FrameworkScoringConfig
): MaturityScoreResult {
  const sum = scores.reduce((acc, score) => acc + score, 0);
  const average = sum / scores.length;
  const clampedScore = Math.max(config.minLevel, Math.min(config.maxLevel, average));

  // Round to 2 decimal places
  const roundedScore = Math.round(clampedScore * 100) / 100;

  return {
    level: Math.floor(clampedScore),
    score: roundedScore,
    method: "Average of domain scores",
  };
}

/**
 * Calculate using weighted average (domains can have different weights)
 * For future use with custom weighting
 */
function calculateWeightedScore(
  scores: number[],
  config: FrameworkScoringConfig,
  weights?: number[]
): MaturityScoreResult {
  // Default to equal weights if not provided
  const actualWeights = weights ?? scores.map(() => 1);

  if (actualWeights.length !== scores.length) {
    throw new Error("Weights array must match scores array length");
  }

  const totalWeight = actualWeights.reduce((acc, w) => acc + w, 0);
  const weightedSum = scores.reduce((acc, score, i) => acc + score * actualWeights[i]!, 0);
  const weightedAverage = weightedSum / totalWeight;
  const clampedScore = Math.max(config.minLevel, Math.min(config.maxLevel, weightedAverage));

  // Round to 2 decimal places
  const roundedScore = Math.round(clampedScore * 100) / 100;

  return {
    level: Math.floor(clampedScore),
    score: roundedScore,
    method: "Weighted average of domain scores",
  };
}

/**
 * Get tier/level label for a framework score
 */
export function getMaturityLevelLabel(
  frameworkType: MaturityFrameworkType,
  level: number
): string {
  switch (frameworkType) {
    case "NIST_CSF_2":
      return getNistCsfTierLabel(level);
    case "C2M2":
      return getC2m2MilLabel(level);
    case "OWASP_SAMM":
      return getOwaspSammLevelLabel(level);
    default:
      return `Level ${level}`;
  }
}

function getNistCsfTierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return "Tier 1 - Partial";
    case 2:
      return "Tier 2 - Risk Informed";
    case 3:
      return "Tier 3 - Repeatable";
    case 4:
      return "Tier 4 - Adaptive";
    default:
      return `Tier ${tier}`;
  }
}

function getC2m2MilLabel(mil: number): string {
  switch (mil) {
    case 0:
      return "MIL 0 - Not Performed";
    case 1:
      return "MIL 1 - Initiated";
    case 2:
      return "MIL 2 - Performed";
    case 3:
      return "MIL 3 - Managed";
    default:
      return `MIL ${mil}`;
  }
}

function getOwaspSammLevelLabel(level: number): string {
  switch (level) {
    case 0:
      return "Level 0 - Implicit";
    case 1:
      return "Level 1 - Initial";
    case 2:
      return "Level 2 - Managed";
    case 3:
      return "Level 3 - Defined";
    default:
      return `Level ${level}`;
  }
}

/**
 * SAMM answer weight mapping.
 * Maps answer index (0-3) to OWASP SAMM weights.
 */
export const SAMM_ANSWER_WEIGHTS = [0, 0.25, 0.5, 1.0] as const;

/**
 * Get the weight for a SAMM answer index
 */
export function sammAnswerWeight(answerIndex: number): number {
  return SAMM_ANSWER_WEIGHTS[answerIndex] ?? 0;
}

/**
 * Calculate a SAMM stream score from 3 question answer weights.
 * Stream score = SUM of question weights (range 0-3).
 */
export function calculateSammStreamScore(questionWeights: number[]): number {
  return questionWeights.reduce((sum, w) => sum + w, 0);
}

/**
 * Calculate gap between current and target level
 */
export function calculateMaturityGap(
  currentLevel: number | null,
  targetLevel: number | null
): { gap: number; status: "behind" | "on_track" | "exceeded" | "not_assessed" } {
  if (currentLevel === null) {
    return { gap: 0, status: "not_assessed" };
  }

  if (targetLevel === null) {
    return { gap: 0, status: "on_track" };
  }

  const gap = targetLevel - currentLevel;

  if (gap > 0) {
    return { gap, status: "behind" };
  } else if (gap < 0) {
    return { gap: Math.abs(gap), status: "exceeded" };
  } else {
    return { gap: 0, status: "on_track" };
  }
}

/**
 * Calculate progress percentage towards target
 */
export function calculateMaturityProgress(
  frameworkType: MaturityFrameworkType,
  currentLevel: number | null,
  targetLevel: number | null
): number {
  if (currentLevel === null || targetLevel === null) {
    return 0;
  }

  const config = FRAMEWORK_CONFIG[frameworkType];

  // Calculate progress as percentage of target
  // If target is 4 and current is 3, progress = 75%
  // If target is 4 and current is 4, progress = 100%
  // If current exceeds target, cap at 100%
  const baseLevel = config.minLevel;
  const adjustedCurrent = currentLevel - baseLevel;
  const adjustedTarget = targetLevel - baseLevel;

  if (adjustedTarget <= 0) {
    return currentLevel >= targetLevel ? 100 : 0;
  }

  const progress = (adjustedCurrent / adjustedTarget) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Get color code for gap status
 */
export function getGapStatusColor(
  status: "behind" | "on_track" | "exceeded" | "not_assessed"
): string {
  switch (status) {
    case "behind":
      return "text-amber-600 bg-amber-50";
    case "on_track":
      return "text-green-600 bg-green-50";
    case "exceeded":
      return "text-blue-600 bg-blue-50";
    case "not_assessed":
      return "text-gray-500 bg-gray-50";
  }
}
