/**
 * Progress Calculation Service
 *
 * Story 4.3: Progress Rollup Calculation
 * Calculates progress that cascades from objectives → goals → strategies.
 *
 * AC1: Objective progress = (currentValue / targetValue) * 100, capped at 0-100%
 * AC2: Goal progress = average of child objective progress percentages
 * AC3: Strategy progress = average of child goal progress percentages
 * AC4: Recursively calculates from bottom up
 * AC5: Returns progress with 1 decimal precision (e.g., 75.5%)
 *
 * @see docs/epics-strategy.md - Story 4.3
 */

import type { PrismaClient, KpiType } from "@prisma/client";
import { KpiType as KpiTypeEnum } from "@prisma/client";

// Progress calculation constants
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;
const DECIMAL_PRECISION = 10; // For rounding to 1 decimal place

/**
 * Reduction KPI scaling factor.
 * For "reduce to X" KPIs (e.g., reduce open risks to 5), progress is calculated
 * using a scaling formula where 50% represents the target being met.
 * This creates a linear scale where:
 * - 0% = current equals 2x the target (no progress)
 * - 50% = current equals target (halfway)
 * - 100% = current is 0 or below target (exceeded)
 */
const REDUCTION_KPI_SCALE_FACTOR = 50;

/**
 * Round to 1 decimal precision (AC5)
 */
function roundToOneDecimal(value: number): number {
  return Math.round(value * DECIMAL_PRECISION) / DECIMAL_PRECISION;
}

/**
 * AC1: Calculate objective progress based on KPI type (FR39)
 *
 * Progress = (currentValue / targetValue) * 100, capped at 0-100%
 * If targetValue is null or 0, progress is 0%
 *
 * @param kpiType - The type of KPI
 * @param currentValue - Current value
 * @param targetValue - Target value
 * @returns Progress percentage (0-100) with 1 decimal precision
 */
export function calculateObjectiveProgress(
  kpiType: KpiType,
  currentValue: number | null,
  targetValue: number | null
): number {
  // AC1: If currentValue is null/undefined, progress is 0%
  if (currentValue === null || currentValue === undefined) {
    return 0;
  }

  let progress: number;

  switch (kpiType) {
    // MANUAL_BOOLEAN - 100% if achieved (1), 0% otherwise
    case KpiTypeEnum.MANUAL_BOOLEAN:
      progress = currentValue === 1 ? PROGRESS_MAX : PROGRESS_MIN;
      break;

    // MANUAL_PERCENTAGE - currentValue is already a percentage
    case KpiTypeEnum.MANUAL_PERCENTAGE:
      progress = Math.max(PROGRESS_MIN, Math.min(PROGRESS_MAX, currentValue));
      break;

    // All other types: count-based or rate-based
    case KpiTypeEnum.MANUAL_COUNT:
    case KpiTypeEnum.RISK_REMEDIATION_RATE:
    case KpiTypeEnum.RISK_OPEN_COUNT:
    case KpiTypeEnum.HIGH_SEVERITY_RISK_COUNT:
    case KpiTypeEnum.CONTROL_IMPLEMENTATION_RATE:
    case KpiTypeEnum.CONTROL_EFFECTIVENESS_AVG:
    case KpiTypeEnum.EVIDENCE_FRESHNESS_RATE:
    case KpiTypeEnum.EVIDENCE_COVERAGE:
      // AC1: If targetValue is null or 0, progress is 0%
      if (!targetValue || targetValue === 0) {
        return 0;
      }

      // For count-based "reduce to X" targets, invert the calculation
      if (
        kpiType === KpiTypeEnum.RISK_OPEN_COUNT ||
        kpiType === KpiTypeEnum.HIGH_SEVERITY_RISK_COUNT
      ) {
        // Progress increases as current approaches/goes below target
        // If target is 5 and current is 10, progress is lower
        // If target is 5 and current is 5, progress is 100%
        // If target is 5 and current is 2, progress is 100% (exceeded)
        progress = Math.max(
          PROGRESS_MIN,
          Math.min(PROGRESS_MAX, ((targetValue - currentValue) / targetValue + 1) * REDUCTION_KPI_SCALE_FACTOR)
        );
      } else {
        // Standard calculation: currentValue / targetValue * 100
        progress = Math.max(PROGRESS_MIN, Math.min(PROGRESS_MAX, (currentValue / targetValue) * PROGRESS_MAX));
      }
      break;

    default:
      progress = 0;
  }

  // AC5: Return with 1 decimal precision
  return roundToOneDecimal(progress);
}

/**
 * AC2: Calculate goal progress (FR40)
 *
 * Progress = average of all child objective progress percentages
 * If no objectives exist, progress is 0%
 *
 * @param db - Prisma client
 * @param goalId - Goal ID to calculate progress for
 * @returns Progress percentage (0-100) with 1 decimal precision
 */
export async function calculateGoalProgress(
  db: PrismaClient,
  goalId: string
): Promise<number> {
  // Get all objectives for this goal
  const objectives = await db.objective.findMany({
    where: { goalId },
    select: {
      kpiType: true,
      currentValue: true,
      targetValue: true,
    },
  });

  // AC2: If no objectives exist, progress is 0%
  if (objectives.length === 0) {
    return 0;
  }

  // Calculate progress for each objective and average them
  const totalProgress = objectives.reduce((sum, obj) => {
    return sum + calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue);
  }, 0);

  const averageProgress = totalProgress / objectives.length;

  // AC5: Return with 1 decimal precision
  return roundToOneDecimal(averageProgress);
}

/**
 * AC3: Calculate strategy progress (FR41)
 *
 * Progress = average of all child goal progress percentages
 * If no goals exist, progress is 0%
 *
 * @param db - Prisma client
 * @param strategyId - Strategy ID to calculate progress for
 * @returns Progress percentage (0-100) with 1 decimal precision
 */
export async function calculateStrategyProgress(
  db: PrismaClient,
  strategyId: string
): Promise<number> {
  // Get all goals for this strategy
  const goals = await db.goal.findMany({
    where: { strategyId },
    select: { id: true },
  });

  // AC3: If no goals exist, progress is 0%
  if (goals.length === 0) {
    return 0;
  }

  // Calculate progress for each goal and average them
  let totalProgress = 0;
  for (const goal of goals) {
    totalProgress += await calculateGoalProgress(db, goal.id);
  }

  const averageProgress = totalProgress / goals.length;

  // AC5: Return with 1 decimal precision
  return roundToOneDecimal(averageProgress);
}

/**
 * AC4: Calculate progress for any entity type
 *
 * Recursively calculates from the bottom up:
 * - Objective: Uses KPI formula
 * - Goal: Average of objective progress
 * - Strategy: Average of goal progress
 *
 * @param db - Prisma client
 * @param entityType - Type of entity
 * @param entityId - Entity ID
 * @returns Progress percentage (0-100) with 1 decimal precision
 */
export async function calculateProgress(
  db: PrismaClient,
  entityType: "Strategy" | "Goal" | "Objective",
  entityId: string
): Promise<number> {
  switch (entityType) {
    case "Strategy":
      return calculateStrategyProgress(db, entityId);

    case "Goal":
      return calculateGoalProgress(db, entityId);

    case "Objective": {
      // Fetch the objective data
      const objective = await db.objective.findUnique({
        where: { id: entityId },
        select: {
          kpiType: true,
          currentValue: true,
          targetValue: true,
        },
      });

      if (!objective) {
        return 0;
      }

      return calculateObjectiveProgress(
        objective.kpiType,
        objective.currentValue,
        objective.targetValue
      );
    }

    default:
      return 0;
  }
}

/**
 * AC6: Calculate all progress up the hierarchy
 *
 * When an objective is updated, recalculates progress for:
 * - The objective itself
 * - Its parent goal
 * - The goal's parent strategy
 *
 * @param db - Prisma client
 * @param objectiveId - Objective ID that was updated
 * @returns Object with progress at all levels
 */
export async function calculateHierarchyProgress(
  db: PrismaClient,
  objectiveId: string
): Promise<{
  objectiveProgress: number;
  goalProgress: number;
  strategyProgress: number;
  goalId: string;
  strategyId: string;
} | null> {
  // Get the objective with its goal and strategy
  const objective = await db.objective.findUnique({
    where: { id: objectiveId },
    select: {
      kpiType: true,
      currentValue: true,
      targetValue: true,
      goal: {
        select: {
          id: true,
          strategyId: true,
        },
      },
    },
  });

  if (!objective) {
    return null;
  }

  // Calculate progress at all levels
  const objectiveProgress = calculateObjectiveProgress(
    objective.kpiType,
    objective.currentValue,
    objective.targetValue
  );

  const goalProgress = await calculateGoalProgress(db, objective.goal.id);
  const strategyProgress = await calculateStrategyProgress(db, objective.goal.strategyId);

  return {
    objectiveProgress,
    goalProgress,
    strategyProgress,
    goalId: objective.goal.id,
    strategyId: objective.goal.strategyId,
  };
}

/**
 * Calculate progress for multiple strategies in a single query
 *
 * Story 6.3: Optimizes N+1 query problem in list operations.
 * Instead of calling calculateStrategyProgress for each strategy (N+1),
 * this function fetches all goals+objectives in one query and calculates in memory.
 *
 * @param db - Prisma client
 * @param strategyIds - Array of strategy IDs to calculate progress for
 * @returns Map of strategyId to progress percentage
 */
export async function calculateStrategiesProgressBatch(
  db: PrismaClient,
  strategyIds: string[]
): Promise<Map<string, number>> {
  if (strategyIds.length === 0) {
    return new Map();
  }

  // Single query to get all goals with objectives for all strategies
  const goals = await db.goal.findMany({
    where: { strategyId: { in: strategyIds } },
    select: {
      id: true,
      strategyId: true,
      objectives: {
        select: {
          kpiType: true,
          currentValue: true,
          targetValue: true,
        },
      },
    },
  });

  // Group goals by strategyId
  const goalsByStrategy = new Map<string, typeof goals>();
  for (const goal of goals) {
    const existing = goalsByStrategy.get(goal.strategyId) ?? [];
    existing.push(goal);
    goalsByStrategy.set(goal.strategyId, existing);
  }

  // Calculate progress for each strategy
  const progressMap = new Map<string, number>();
  for (const strategyId of strategyIds) {
    const strategyGoals = goalsByStrategy.get(strategyId) ?? [];

    if (strategyGoals.length === 0) {
      progressMap.set(strategyId, 0);
      continue;
    }

    // Calculate progress for each goal
    let totalGoalProgress = 0;
    for (const goal of strategyGoals) {
      if (goal.objectives.length === 0) {
        // Goal with no objectives has 0% progress
        continue;
      }

      // Calculate average objective progress for this goal
      const totalObjProgress = goal.objectives.reduce((sum, obj) => {
        return sum + calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue);
      }, 0);
      totalGoalProgress += totalObjProgress / goal.objectives.length;
    }

    // Strategy progress = average of goal progress
    const strategyProgress = roundToOneDecimal(totalGoalProgress / strategyGoals.length);
    progressMap.set(strategyId, strategyProgress);
  }

  return progressMap;
}

/**
 * Get progress for a strategy with all its goals and objectives
 *
 * Returns a complete progress breakdown for display in the UI
 *
 * @param db - Prisma client
 * @param strategyId - Strategy ID
 * @returns Strategy progress with goal and objective breakdowns
 */
export async function getStrategyProgressBreakdown(
  db: PrismaClient,
  strategyId: string
): Promise<{
  strategyProgress: number;
  goals: Array<{
    id: string;
    progress: number;
    objectives: Array<{
      id: string;
      progress: number;
    }>;
  }>;
}> {
  // Get all goals with their objectives
  const goals = await db.goal.findMany({
    where: { strategyId },
    select: {
      id: true,
      objectives: {
        select: {
          id: true,
          kpiType: true,
          currentValue: true,
          targetValue: true,
        },
      },
    },
  });

  // Calculate progress for each objective and goal
  const goalsWithProgress = goals.map((goal) => {
    const objectivesWithProgress = goal.objectives.map((obj) => ({
      id: obj.id,
      progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
    }));

    const goalProgress =
      objectivesWithProgress.length > 0
        ? roundToOneDecimal(
            objectivesWithProgress.reduce((sum, obj) => sum + obj.progress, 0) /
              objectivesWithProgress.length
          )
        : 0;

    return {
      id: goal.id,
      progress: goalProgress,
      objectives: objectivesWithProgress,
    };
  });

  // Calculate strategy progress
  const strategyProgress =
    goalsWithProgress.length > 0
      ? roundToOneDecimal(
          goalsWithProgress.reduce((sum, goal) => sum + goal.progress, 0) /
            goalsWithProgress.length
        )
      : 0;

  return {
    strategyProgress,
    goals: goalsWithProgress,
  };
}
