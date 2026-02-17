/**
 * Strategy Router
 *
 * tRPC router for Security Strategy management operations.
 *
 * Story 1.2: Strategy CRUD API
 * - create: Create new strategy
 * - list: List strategies with filtering and pagination
 * - getById: Get strategy with goals
 * - update: Update strategy details
 * - delete: Delete strategy (cascade to goals)
 *
 * @see Story 1.2: Strategy CRUD tRPC Router
 * @see docs/epics-strategy.md
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, StrategyStatus, AuditAction, ChangeType } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import {
  createHistory,
  buildCreateChangedFields,
  buildUpdateChangedFields,
  buildDeleteChangedFields,
  extractStrategyFields,
} from "@/server/services/historyService";
import {
  calculateObjectiveProgress,
  calculateStrategyProgress,
  calculateStrategiesProgressBatch,
} from "@/server/services/progressService";

/**
 * Roles that can manage strategies (FR58)
 * - CISO: Full CRUD access
 * - GRC_ANALYST: Full CRUD access
 * - ORG_ADMIN: Full CRUD access
 */
const STRATEGY_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can view strategies (FR59-FR62)
 * All authenticated org users can view strategies
 */
const STRATEGY_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Schema for creating a strategy (AC1)
 */
const createStrategySchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000).optional().nullable(),
  fiscalYearStart: z
    .number()
    .int()
    .min(2000, "Fiscal year must be 2000 or later")
    .max(2100, "Fiscal year must be 2100 or earlier"),
  fiscalYearEnd: z
    .number()
    .int()
    .min(2000, "Fiscal year must be 2000 or later")
    .max(2100, "Fiscal year must be 2100 or earlier"),
  status: z.nativeEnum(StrategyStatus).default(StrategyStatus.DRAFT),
  ownerId: z.string().optional().nullable(),
});

/**
 * Schema for listing strategies (AC2)
 */
const listStrategiesSchema = z.object({
  status: z.nativeEnum(StrategyStatus).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["title", "createdAt", "updatedAt", "fiscalYearStart"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Schema for getting a strategy by ID (AC3)
 */
const getByIdSchema = z.object({
  id: z.string().min(1, "Strategy ID is required"),
});

/**
 * Schema for updating a strategy (AC4)
 */
const updateStrategySchema = z.object({
  id: z.string().min(1, "Strategy ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  fiscalYearStart: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional(),
  fiscalYearEnd: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional(),
  status: z.nativeEnum(StrategyStatus).optional(),
  ownerId: z.string().optional().nullable(),
});

/**
 * Schema for deleting a strategy (AC5)
 */
const deleteStrategySchema = z.object({
  id: z.string().min(1, "Strategy ID is required"),
});

// =============================================================================
// Router
// =============================================================================

export const strategyRouter = createTRPCRouter({
  /**
   * Create a new strategy
   *
   * AC1: Create strategy with all required fields
   * AC6: Multi-tenant isolation (organizationId from session)
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  create: organizationProcedure
    .use(requireRole(STRATEGY_MANAGE_ROLES))
    .input(createStrategySchema)
    .mutation(async ({ ctx, input }) => {
      // Validate fiscal year range
      if (input.fiscalYearEnd < input.fiscalYearStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fiscal year end must be greater than or equal to fiscal year start",
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

      // Story 6.3 AC3: Wrap mutation + history in transaction for atomicity
      const strategyId = randomUUID();
      const strategy = await ctx.db.$transaction(async (tx) => {
        // Create the strategy
        const newStrategy = await tx.strategy.create({
          data: {
            id: strategyId,
            organizationId: ctx.organizationId!,
            title: input.title,
            description: input.description ?? null,
            fiscalYearStart: input.fiscalYearStart,
            fiscalYearEnd: input.fiscalYearEnd,
            status: input.status,
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
            _count: {
              select: {
                goals: true,
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
            action: AuditAction.STRATEGY_CREATED,
            entityType: "Strategy",
            entityId: strategyId,
            changes: {
              action: "CREATE",
              title: input.title,
              fiscalYearStart: input.fiscalYearStart,
              fiscalYearEnd: input.fiscalYearEnd,
              status: input.status,
              ownerId: input.ownerId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC2: Create history record for CREATE operation
        await tx.strategyHistory.create({
          data: {
            strategyId: strategyId,
            changeType: ChangeType.CREATE,
            changedFields: buildCreateChangedFields(
              extractStrategyFields({
                title: newStrategy.title,
                description: newStrategy.description,
                fiscalYearStart: newStrategy.fiscalYearStart,
                fiscalYearEnd: newStrategy.fiscalYearEnd,
                status: newStrategy.status,
                ownerId: newStrategy.ownerId,
                createdById: newStrategy.createdById,
                organizationId: ctx.organizationId!,
              })
            ) as object,
            changedById: ctx.session!.user.id,
          },
        });

        return newStrategy;
      });

      return strategy;
    }),

  /**
   * List strategies with filtering and pagination
   *
   * AC2: Paginated list with status filter and goal count
   * AC6: Multi-tenant isolation
   * Story 4.3: Includes calculated progress for each strategy
   *
   * @requires Any authenticated user in org
   */
  list: organizationProcedure
    .use(requireRole(STRATEGY_VIEW_ROLES))
    .input(listStrategiesSchema)
    .query(async ({ ctx, input }) => {
      const { status, page, pageSize, sortBy, sortOrder } = input;
      const skip = (page - 1) * pageSize;

      // Build where clause
      const where = {
        organizationId: ctx.organizationId!,
        ...(status && { status }),
      };

      // Get total count
      const totalCount = await ctx.db.strategy.count({ where });

      // Get strategies with goal count
      const strategies = await ctx.db.strategy.findMany({
        where,
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
              goals: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      });

      // Story 4.3 + Story 6.3: Calculate progress for all strategies in one batch query
      // Optimized to avoid N+1 query problem
      const strategyIds = strategies.map((s) => s.id);
      const progressMap = await calculateStrategiesProgressBatch(ctx.db, strategyIds);

      const strategiesWithProgress = strategies.map((strategy) => ({
        ...strategy,
        progress: progressMap.get(strategy.id) ?? 0,
      }));

      return {
        strategies: strategiesWithProgress,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasMore: skip + strategies.length < totalCount,
        },
      };
    }),

  /**
   * Get a strategy by ID with goals
   *
   * AC3: Full strategy with eagerly loaded goals
   * AC6: Multi-tenant isolation (403 for wrong org)
   * Story 4.3: Includes calculated progress for strategy, goals, and objectives
   *
   * @requires Any authenticated user in org
   */
  getById: organizationProcedure
    .use(requireRole(STRATEGY_VIEW_ROLES))
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      const strategy = await ctx.db.strategy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
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
          goals: {
            orderBy: { sortOrder: "asc" },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
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
          },
        },
      });

      if (!strategy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // Story 4.3: Calculate progress for objectives, goals, and strategy
      const goalsWithProgress = strategy.goals.map((goal) => {
        // Calculate progress for each objective
        const objectivesWithProgress = goal.objectives.map((obj) => ({
          ...obj,
          progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
        }));

        // AC2: Goal progress = average of child objective progress
        const goalProgress =
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
          progress: goalProgress,
        };
      });

      // AC3: Strategy progress = average of child goal progress
      const strategyProgress =
        goalsWithProgress.length > 0
          ? Math.round(
              (goalsWithProgress.reduce((sum, goal) => sum + goal.progress, 0) /
                goalsWithProgress.length) *
                10
            ) / 10
          : 0;

      return {
        ...strategy,
        goals: goalsWithProgress,
        progress: strategyProgress,
      };
    }),

  /**
   * Update a strategy
   *
   * AC4: Update strategy with timestamp refresh
   * AC6: Multi-tenant isolation (403 for wrong org)
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  update: organizationProcedure
    .use(requireRole(STRATEGY_MANAGE_ROLES))
    .input(updateStrategySchema)
    .mutation(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to organization
      const existing = await ctx.db.strategy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // Validate fiscal year range if both are being updated or one is changing
      const newStart = input.fiscalYearStart ?? existing.fiscalYearStart;
      const newEnd = input.fiscalYearEnd ?? existing.fiscalYearEnd;
      if (newEnd < newStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fiscal year end must be greater than or equal to fiscal year start",
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
      if (input.fiscalYearStart !== undefined) updateData.fiscalYearStart = input.fiscalYearStart;
      if (input.fiscalYearEnd !== undefined) updateData.fiscalYearEnd = input.fiscalYearEnd;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.ownerId !== undefined) updateData.ownerId = input.ownerId;

      // Story 6.3 AC3: Wrap mutation + history in transaction for atomicity
      const updated = await ctx.db.$transaction(async (tx) => {
        // Update the strategy
        const result = await tx.strategy.update({
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
            _count: {
              select: {
                goals: true,
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
            action: AuditAction.STRATEGY_UPDATED,
            entityType: "Strategy",
            entityId: input.id,
            changes: {
              action: "UPDATE",
              before: {
                title: existing.title,
                description: existing.description,
                fiscalYearStart: existing.fiscalYearStart,
                fiscalYearEnd: existing.fiscalYearEnd,
                status: existing.status,
                ownerId: existing.ownerId,
              },
              after: {
                title: result.title,
                description: result.description,
                fiscalYearStart: result.fiscalYearStart,
                fiscalYearEnd: result.fiscalYearEnd,
                status: result.status,
                ownerId: result.ownerId,
              },
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC3: Create history record for UPDATE operation
        const changedFields = buildUpdateChangedFields(
          extractStrategyFields({
            title: existing.title,
            description: existing.description,
            fiscalYearStart: existing.fiscalYearStart,
            fiscalYearEnd: existing.fiscalYearEnd,
            status: existing.status,
            ownerId: existing.ownerId,
            createdById: existing.createdById,
            organizationId: existing.organizationId,
          }),
          extractStrategyFields({
            title: result.title,
            description: result.description,
            fiscalYearStart: result.fiscalYearStart,
            fiscalYearEnd: result.fiscalYearEnd,
            status: result.status,
            ownerId: result.ownerId,
            createdById: result.createdById,
            organizationId: ctx.organizationId!,
          })
        );

        // Only create history if fields actually changed
        if (Object.keys(changedFields).length > 0) {
          await tx.strategyHistory.create({
            data: {
              strategyId: input.id,
              changeType: ChangeType.UPDATE,
              changedFields: changedFields as object,
              changedById: ctx.session!.user.id,
            },
          });
        }

        return result;
      });

      return updated;
    }),

  /**
   * Delete a strategy
   *
   * AC5: Delete strategy with cascade to child goals
   * AC6: Multi-tenant isolation (403 for wrong org)
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  delete: organizationProcedure
    .use(requireRole(STRATEGY_MANAGE_ROLES))
    .input(deleteStrategySchema)
    .mutation(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to organization
      const existing = await ctx.db.strategy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              goals: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // Story 6.3 AC3: Wrap delete + audit in transaction for atomicity
      // Note: StrategyHistory is cascade deleted with Strategy (AC4 - acceptable)
      // AuditLog persists the delete action for permanent audit trail
      await ctx.db.$transaction(async (tx) => {
        // Delete the strategy (cascade will delete goals and history due to onDelete: Cascade)
        await tx.strategy.delete({
          where: { id: input.id },
        });

        // Audit log (persists even after entity deletion)
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: AuditAction.STRATEGY_DELETED,
            entityType: "Strategy",
            entityId: input.id,
            changes: {
              action: "DELETE",
              title: existing.title,
              description: existing.description,
              fiscalYearStart: existing.fiscalYearStart,
              fiscalYearEnd: existing.fiscalYearEnd,
              status: existing.status,
              ownerId: existing.ownerId,
              goalsDeleted: existing._count.goals,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, id: input.id };
    }),

  /**
   * Get history for a strategy
   *
   * Story 4.5 AC1: Paginated history ordered by changedAt descending
   * Returns changeType, changedFields, changedBy, changedAt
   *
   * @requires Any authenticated user who can view strategies
   */
  getHistory: organizationProcedure
    .use(requireRole(STRATEGY_VIEW_ROLES))
    .input(
      z.object({
        strategyId: z.string().min(1, "Strategy ID is required"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify strategy exists and belongs to organization
      const strategy = await ctx.db.strategy.findFirst({
        where: {
          id: input.strategyId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true },
      });

      if (!strategy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Strategy not found",
        });
      }

      // Fetch paginated history records
      const [history, total] = await Promise.all([
        ctx.db.strategyHistory.findMany({
          where: { strategyId: input.strategyId },
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
        ctx.db.strategyHistory.count({
          where: { strategyId: input.strategyId },
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
