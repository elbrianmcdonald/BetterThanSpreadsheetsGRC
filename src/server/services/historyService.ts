/**
 * History Service
 *
 * Story 4.2: History Creation Service
 * Automatically creates history records on Strategy, Goal, and Objective mutations.
 *
 * AC1: createHistory helper with entityType, entityId, changeType, changedFields, userId
 * AC2-AC4: changedFields format: { fieldName: { old: value, new: value } }
 * AC7: Captures changedById and changedAt timestamp
 * AC8: History records are immutable (no update/delete API exposed)
 *
 * @see docs/epics-strategy.md - Story 4.2
 */

import type { PrismaClient, ChangeType } from "@prisma/client";

/**
 * Entity types that support history tracking
 */
export type HistoryEntityType = "Strategy" | "Goal" | "Objective";

/**
 * Type for a single field change record
 * AC1: changedFields stored as { fieldName: { old: value, new: value } }
 */
export interface FieldChange {
  old: unknown;
  new: unknown;
}

/**
 * Type for the changedFields JSON structure
 */
export type ChangedFields = Record<string, FieldChange>;

/**
 * Input for creating a history record
 */
export interface CreateHistoryInput {
  entityType: HistoryEntityType;
  entityId: string;
  changeType: ChangeType;
  changedFields: ChangedFields;
  changedById: string;
}

/**
 * Create a history record for an entity change
 *
 * AC1: Creates history record in the appropriate table based on entityType
 * AC7: changedById and changedAt are captured automatically
 *
 * @param db - Prisma client instance
 * @param input - History creation input
 */
export async function createHistory(
  db: PrismaClient,
  input: CreateHistoryInput
): Promise<void> {
  const { entityType, entityId, changeType, changedFields, changedById } = input;

  switch (entityType) {
    case "Strategy":
      await db.strategyHistory.create({
        data: {
          strategyId: entityId,
          changeType,
          changedFields: changedFields as object,
          changedById,
        },
      });
      break;

    case "Goal":
      await db.goalHistory.create({
        data: {
          goalId: entityId,
          changeType,
          changedFields: changedFields as object,
          changedById,
        },
      });
      break;

    case "Objective":
      await db.objectiveHistory.create({
        data: {
          objectiveId: entityId,
          changeType,
          changedFields: changedFields as object,
          changedById,
        },
      });
      break;
  }
}

/**
 * Build changedFields for CREATE operation
 *
 * AC2: For CREATE, changedFields contains all initial field values with old: null
 *
 * @param data - Object with the created entity's field values
 * @returns ChangedFields object with old: null for each field
 */
export function buildCreateChangedFields<T extends Record<string, unknown>>(
  data: T
): ChangedFields {
  const changedFields: ChangedFields = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip internal fields that shouldn't be tracked
    if (key === "id" || key === "createdAt" || key === "updatedAt") {
      continue;
    }
    changedFields[key] = { old: null, new: value };
  }

  return changedFields;
}

/**
 * Build changedFields for UPDATE operation
 *
 * AC3: For UPDATE, changedFields contains only the fields that changed with old and new values
 *
 * @param oldData - Object with the entity's previous field values
 * @param newData - Object with the entity's new field values
 * @returns ChangedFields object with only changed fields
 */
export function buildUpdateChangedFields<T extends Record<string, unknown>>(
  oldData: T,
  newData: T
): ChangedFields {
  const changedFields: ChangedFields = {};

  for (const key of Object.keys(newData)) {
    // Skip internal fields
    if (key === "id" || key === "createdAt" || key === "updatedAt") {
      continue;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    // Compare values - handle dates specially
    const oldComparable = oldValue instanceof Date ? oldValue.toISOString() : oldValue;
    const newComparable = newValue instanceof Date ? newValue.toISOString() : newValue;

    if (oldComparable !== newComparable) {
      changedFields[key] = { old: oldValue, new: newValue };
    }
  }

  return changedFields;
}

/**
 * Build changedFields for DELETE operation
 *
 * AC4: For DELETE, changedFields contains final field values with new: null
 *
 * @param data - Object with the entity's final field values before deletion
 * @returns ChangedFields object with new: null for each field
 */
export function buildDeleteChangedFields<T extends Record<string, unknown>>(
  data: T
): ChangedFields {
  const changedFields: ChangedFields = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip internal fields
    if (key === "id" || key === "createdAt" || key === "updatedAt") {
      continue;
    }
    changedFields[key] = { old: value, new: null };
  }

  return changedFields;
}

/**
 * Extract trackable fields from a Strategy entity
 * Returns only fields that should be tracked in history
 */
export function extractStrategyFields(strategy: {
  title: string;
  description: string | null;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  status: string;
  ownerId: string | null;
  createdById: string | null;
  organizationId: string;
}): Record<string, unknown> {
  return {
    title: strategy.title,
    description: strategy.description,
    fiscalYearStart: strategy.fiscalYearStart,
    fiscalYearEnd: strategy.fiscalYearEnd,
    status: strategy.status,
    ownerId: strategy.ownerId,
    createdById: strategy.createdById,
    organizationId: strategy.organizationId,
  };
}

/**
 * Extract trackable fields from a Goal entity
 * Returns only fields that should be tracked in history
 */
export function extractGoalFields(goal: {
  title: string;
  description: string | null;
  sortOrder: number;
  targetDate: Date | null;
  ownerId: string | null;
  createdById: string | null;
  strategyId: string;
}): Record<string, unknown> {
  return {
    title: goal.title,
    description: goal.description,
    sortOrder: goal.sortOrder,
    targetDate: goal.targetDate,
    ownerId: goal.ownerId,
    createdById: goal.createdById,
    strategyId: goal.strategyId,
  };
}

/**
 * Extract trackable fields from an Objective entity
 * Returns only fields that should be tracked in history
 */
export function extractObjectiveFields(objective: {
  title: string;
  description: string | null;
  status: string;
  sortOrder: number;
  dueDate: Date | null;
  kpiType: string;
  targetValue: number | null;
  currentValue: number | null;
  createdById: string | null;
  goalId: string;
}): Record<string, unknown> {
  return {
    title: objective.title,
    description: objective.description,
    status: objective.status,
    sortOrder: objective.sortOrder,
    dueDate: objective.dueDate,
    kpiType: objective.kpiType,
    targetValue: objective.targetValue,
    currentValue: objective.currentValue,
    createdById: objective.createdById,
    goalId: objective.goalId,
  };
}
