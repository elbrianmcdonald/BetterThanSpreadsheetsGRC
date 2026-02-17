/**
 * Goal Router
 *
 * tRPC router for Goal management operations within Strategies.
 *
 * Story 1.3: Goal CRUD API
 * - create: Create new goal within a strategy
 * - getById: Get goal with details
 * - update: Update goal details
 * - delete: Delete goal (cascade to objectives)
 * - reorder: Reorder goals within a strategy
 *
 * Story 2.4: Comments on Goals
 * - addComment: Add a comment to a goal (AC2)
 * - getById returns comments ordered by createdAt desc (AC4)
 *
 * Story 6.1: Complete Role-Based Access Control
 * - AC2: AUDITOR cannot add comments (read-only access)
 *
 * @see Story 1.3: Goal CRUD tRPC Router
 * @see Story 2.4: Comments on Goals and Objectives
 * @see docs/epics-strategy.md
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AuditAction, ChangeType } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import {
  buildCreateChangedFields,
  buildUpdateChangedFields,
  buildDeleteChangedFields,
  extractGoalFields,
} from "@/server/services/historyService";
import {
  calculateObjectiveProgress,
  calculateGoalProgress,
} from "@/server/services/progressService";

/**
 * Roles that can manage goals (FR58)
 * - CISO: Full CRUD access
 * - GRC_ANALYST: Full CRUD access
 * - ORG_ADMIN: Full CRUD access
 */
const GOAL_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can view goals (FR59-FR62)
 * All authenticated org users can view goals
 */
const GOAL_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * Roles that can add comments on goals
 * Story 6.1 AC2: AUDITOR cannot add comments (read-only access)
 */
const GOAL_COMMENT_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
];

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Schema for creating a goal (AC1)
 */
const createGoalSchema = z.object({
  strategyId: z.string().min(1, "Strategy ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000).optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

/**
 * Schema for getting a goal by ID
 */
const getByIdSchema = z.object({
  id: z.string().min(1, "Goal ID is required"),
});

/**
 * Schema for updating a goal (AC3)
 */
const updateGoalSchema = z.object({
  id: z.string().min(1, "Goal ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

/**
 * Schema for deleting a goal (AC4)
 */
const deleteGoalSchema = z.object({
  id: z.string().min(1, "Goal ID is required"),
});

/**
 * Schema for reordering goals (AC2)
 */
const reorderGoalsSchema = z.object({
  strategyId: z.string().min(1, "Strategy ID is required"),
  goalOrders: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

/**
 * Story 2.4 AC2: Schema for adding a comment to a goal
 */
const addCommentSchema = z.object({
  goalId: z.string().min(1, "Goal ID is required"),
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(5000, "Comment must be 5000 characters or less"),
});

// =============================================================================
// Helper Functions
// =============================================================================

// Type alias for the database client
type DbClient = PrismaClient;

/**
 * Verify that a strategy belongs to the user's organization
 */
async function verifyStrategyAccess(
  db: DbClient,
  strategyId: string,
  organizationId: string
): Promise<{ id: string; title: string } | null> {
  return db.strategy.findFirst({
    where: {
      id: strategyId,
      organizationId,
    },
    select: {
      id: true,
      title: true,
    },
  });
}

/**
 * Verify that a goal belongs to the user's organization via its strategy
 */
async function verifyGoalAccess(
  db: DbClient,
  goalId: string,
  organizationId: string
): Promise<{ id: string; title: string; strategyId: string } | null> {
  return db.goal.findFirst({
    where: {
      id: goalId,
      strategy: {
        organizationId,
      },
    },
    select: {
      id: true,
      title: true,
      strategyId: true,
    },
  });
}

// =============================================================================
// Router
// =============================================================================

export const goalRouter = createTRPCRouter({
  /**
   * Create a new goal within a strategy
   *
   * AC1: Create goal with auto-generated sortOrder
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  create: organizationProcedure
    .use(requireRole(GOAL_MANAGE_ROLES))
    .input(createGoalSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to user's organization
      const strategy = await verifyStrategyAccess(
        ctx.db,
        input.strategyId,
        ctx.organizationId!
      );

      if (!strategy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // If owner is specified, validate they belong to the same organization
      if (input.ownerId) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Owner must be a user in your organization",
          });
        }
      }

      // Get the next sortOrder value for this strategy
      const maxSortOrder = await ctx.db.goal.aggregate({
        where: { strategyId: input.strategyId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      const goalId = randomUUID();
      const goal = await ctx.db.$transaction(async (tx) => {
        // Create the goal
        const newGoal = await tx.goal.create({
          data: {
            id: goalId,
            strategyId: input.strategyId,
            title: input.title,
            description: input.description ?? null,
            targetDate: input.targetDate ?? null,
            sortOrder: nextSortOrder,
            ownerId: input.ownerId ?? null,
            createdById: ctx.session!.user.id,
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            strategy: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.GOAL_CREATED,
            entityType: "Goal",
            entityId: goalId,
            changes: {
              action: "CREATE",
              strategyId: input.strategyId,
              strategyTitle: strategy.title,
              title: input.title,
              targetDate: input.targetDate,
              ownerId: input.ownerId,
              sortOrder: nextSortOrder,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC5: Create history record for CREATE operation
        await tx.goalHistory.create({
          data: {
            goalId: goalId,
            changeType: ChangeType.CREATE,
            changedFields: buildCreateChangedFields(
              extractGoalFields({
                title: newGoal.title,
                description: newGoal.description,
                sortOrder: newGoal.sortOrder,
                targetDate: newGoal.targetDate,
                ownerId: newGoal.ownerId,
                createdById: newGoal.createdById,
                strategyId: newGoal.strategyId,
              })
            ) as object,
            changedById: ctx.session!.user.id,
          },
        });

        return newGoal;
      });

      return goal;
    }),

  /**
   * Get a goal by ID
   *
   * Story 4.3: Includes calculated progress for goal and its objectives
   *
   * @requires Any authenticated user in org
   */
  getById: organizationProcedure
    .use(requireRole(GOAL_VIEW_ROLES))
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      const goal = await ctx.db.goal.findFirst({
        where: {
          id: input.id,
          strategy: {
            organizationId: ctx.organizationId!,
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          strategy: {
            select: {
              id: true,
              title: true,
              status: true,
              fiscalYearStart: true,
              fiscalYearEnd: true,
            },
          },
          // Story 2.4 AC4: Include comments ordered by createdAt descending
          comments: {
            orderBy: { createdAt: "desc" },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          // Story 4.3: Include objectives for progress calculation
          objectives: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              kpiType: true,
              currentValue: true,
              targetValue: true,
              dueDate: true,
            },
          },
          _count: {
            select: {
              objectives: true,
            },
          },
        },
      });

      if (!goal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Goal not found",
        });
      }

      // Story 4.3: Calculate progress for each objective
      const objectivesWithProgress = goal.objectives.map((obj) => ({
        ...obj,
        progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
      }));

      // Story 4.3 AC2: Goal progress = average of child objective progress
      const progress =
        objectivesWithProgress.length > 0
          ? Math.round(
              (objectivesWithProgress.reduce((sum, obj) => sum + obj.progress, 0) /
                objectivesWithProgress.length) *
                10
            ) / 10
          : 0;

      return {
        ...goal,
        objectives: objectivesWithProgress,
        progress,
      };
    }),

  /**
   * Update a goal
   *
   * AC3: Update goal with timestamp refresh
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  update: organizationProcedure
    .use(requireRole(GOAL_MANAGE_ROLES))
    .input(updateGoalSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify goal exists and belongs to user's organization
      const existing = await ctx.db.goal.findFirst({
        where: {
          id: input.id,
          strategy: {
            organizationId: ctx.organizationId!,
          },
        },
        include: {
          strategy: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Goal not found",
        });
      }

      // If owner is being changed, validate they belong to the same organization
      if (input.ownerId !== undefined && input.ownerId !== null) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Owner must be a user in your organization",
          });
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.targetDate !== undefined) updateData.targetDate = input.targetDate;
      if (input.ownerId !== undefined) updateData.ownerId = input.ownerId;

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      const updated = await ctx.db.$transaction(async (tx) => {
        // Update the goal
        const updatedGoal = await tx.goal.update({
          where: { id: input.id },
          data: updateData,
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            strategy: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.GOAL_UPDATED,
            entityType: "Goal",
            entityId: input.id,
            changes: {
              action: "UPDATE",
              strategyId: existing.strategyId,
              strategyTitle: existing.strategy.title,
              before: {
                title: existing.title,
                description: existing.description,
                targetDate: existing.targetDate,
                ownerId: existing.ownerId,
              },
              after: {
                title: updatedGoal.title,
                description: updatedGoal.description,
                targetDate: updatedGoal.targetDate,
                ownerId: updatedGoal.ownerId,
              },
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC5: Create history record for UPDATE operation
        const changedFields = buildUpdateChangedFields(
          extractGoalFields({
            title: existing.title,
            description: existing.description,
            sortOrder: existing.sortOrder,
            targetDate: existing.targetDate,
            ownerId: existing.ownerId,
            createdById: existing.createdById,
            strategyId: existing.strategyId,
          }),
          extractGoalFields({
            title: updatedGoal.title,
            description: updatedGoal.description,
            sortOrder: updatedGoal.sortOrder,
            targetDate: updatedGoal.targetDate,
            ownerId: updatedGoal.ownerId,
            createdById: updatedGoal.createdById,
            strategyId: updatedGoal.strategyId,
          })
        );

        // Only create history if fields actually changed
        if (Object.keys(changedFields).length > 0) {
          await tx.goalHistory.create({
            data: {
              goalId: input.id,
              changeType: ChangeType.UPDATE,
              changedFields: changedFields as object,
              changedById: ctx.session!.user.id,
            },
          });
        }

        return updatedGoal;
      });

      return updated;
    }),

  /**
   * Delete a goal
   *
   * AC4: Delete goal with cascade to child objectives
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  delete: organizationProcedure
    .use(requireRole(GOAL_MANAGE_ROLES))
    .input(deleteGoalSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify goal exists and belongs to user's organization
      const existing = await ctx.db.goal.findFirst({
        where: {
          id: input.id,
          strategy: {
            organizationId: ctx.organizationId!,
          },
        },
        include: {
          strategy: {
            select: {
              id: true,
              title: true,
            },
          },
          // _count for objectives will be added once Objective model exists
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Goal not found",
        });
      }

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      await ctx.db.$transaction(async (tx) => {
        // Story 4.2 AC5: Create history record BEFORE the delete
        await tx.goalHistory.create({
          data: {
            goalId: input.id,
            changeType: ChangeType.DELETE,
            changedFields: buildDeleteChangedFields(
              extractGoalFields({
                title: existing.title,
                description: existing.description,
                sortOrder: existing.sortOrder,
                targetDate: existing.targetDate,
                ownerId: existing.ownerId,
                createdById: existing.createdById,
                strategyId: existing.strategyId,
              })
            ) as object,
            changedById: ctx.session!.user.id,
          },
        });

        // Delete the goal (cascade will delete objectives once they exist)
        await tx.goal.delete({
          where: { id: input.id },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.GOAL_DELETED,
            entityType: "Goal",
            entityId: input.id,
            changes: {
              action: "DELETE",
              strategyId: existing.strategyId,
              strategyTitle: existing.strategy.title,
              title: existing.title,
              // objectivesDeleted will be added once Objective model exists
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, id: input.id };
    }),

  /**
   * Reorder goals within a strategy
   *
   * AC2: Update sort order values for goals
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  reorder: organizationProcedure
    .use(requireRole(GOAL_MANAGE_ROLES))
    .input(reorderGoalsSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to user's organization
      const strategy = await verifyStrategyAccess(
        ctx.db,
        input.strategyId,
        ctx.organizationId!
      );

      if (!strategy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // Verify all goals belong to this strategy
      const goalIds = input.goalOrders.map((g) => g.id);
      const existingGoals = await ctx.db.goal.findMany({
        where: {
          id: { in: goalIds },
          strategyId: input.strategyId,
        },
        select: { id: true },
      });

      if (existingGoals.length !== goalIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more goals do not belong to this strategy",
        });
      }

      // Update sort orders in a transaction
      await ctx.db.$transaction(
        input.goalOrders.map((goalOrder) =>
          ctx.db.goal.update({
            where: { id: goalOrder.id },
            data: { sortOrder: goalOrder.sortOrder },
          })
        )
      );

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.GOAL_REORDERED,
          entityType: "Strategy",
          entityId: input.strategyId,
          changes: {
            action: "REORDER_GOALS",
            strategyTitle: strategy.title,
            goalOrders: input.goalOrders,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      // Return the reordered goals
      const reorderedGoals = await ctx.db.goal.findMany({
        where: { strategyId: input.strategyId },
        orderBy: { sortOrder: "asc" },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return reorderedGoals;
    }),

  /**
   * List goals for a strategy
   *
   * Helper query for loading goals separately from strategy
   * Story 4.3: Includes calculated progress for each goal
   */
  listByStrategy: organizationProcedure
    .use(requireRole(GOAL_VIEW_ROLES))
    .input(
      z.object({
        strategyId: z.string().min(1, "Strategy ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to user's organization
      const strategy = await verifyStrategyAccess(
        ctx.db,
        input.strategyId,
        ctx.organizationId!
      );

      if (!strategy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      const goals = await ctx.db.goal.findMany({
        where: { strategyId: input.strategyId },
        orderBy: { sortOrder: "asc" },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              objectives: true,
            },
          },
        },
      });

      // Story 4.3: Calculate progress for each goal
      const goalsWithProgress = await Promise.all(
        goals.map(async (goal) => {
          const progress = await calculateGoalProgress(ctx.db, goal.id);
          return {
            ...goal,
            progress,
          };
        })
      );

      return goalsWithProgress;
    }),

  /**
   * Add a comment to a goal
   *
   * Story 2.4 AC2: Create a comment linked to a goal
   * AC2: Comment includes content, authorId, createdAt
   * Story 6.1 AC2: AUDITOR cannot add comments (read-only access)
   *
   * @requires Any authenticated org user except AUDITOR
   */
  addComment: organizationProcedure
    .use(requireRole(GOAL_COMMENT_ROLES))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the goal exists and belongs to user's organization
      const goal = await verifyGoalAccess(
        ctx.db,
        input.goalId,
        ctx.organizationId!
      );

      if (!goal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Goal not found or access denied",
        });
      }

      // Create the comment
      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          authorId: ctx.session!.user.id,
          goalId: input.goalId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return comment;
    }),

  /**
   * Get history for a goal
   *
   * Story 4.5 AC2: Paginated history ordered by changedAt descending
   * Returns changeType, changedFields, changedBy, changedAt
   *
   * @requires Any authenticated user who can view goals
   */
  getHistory: organizationProcedure
    .use(requireRole(GOAL_VIEW_ROLES))
    .input(
      z.object({
        goalId: z.string().min(1, "Goal ID is required"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify goal exists and belongs to organization
      const goal = await verifyGoalAccess(
        ctx.db,
        input.goalId,
        ctx.organizationId!
      );

      if (!goal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Goal not found",
        });
      }

      // Fetch paginated history records
      const [history, total] = await Promise.all([
        ctx.db.goalHistory.findMany({
          where: { goalId: input.goalId },
          orderBy: { changedAt: "desc" },
          skip: input.offset,
          take: input.limit,
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        ctx.db.goalHistory.count({
          where: { goalId: input.goalId },
        }),
      ]);

      return {
        history: history.map((h) => ({
          id: h.id,
          changeType: h.changeType,
          changedFields: h.changedFields as Record<string, { old: unknown; new: unknown }>,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
        })),
        total,
        hasMore: input.offset + history.length < total,
      };
    }),
});
