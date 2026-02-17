/**
 * Strategy Dashboard Router
 *
 * tRPC router for executive dashboard data aggregation.
 *
 * Story 5.1: Strategy Dashboard API
 * - getSummary: Aggregated metrics for organization
 * - getProgressChart: Strategy progress data for charts
 * - getStatusBreakdown: Counts by status
 * - getOverdue: Overdue objectives list
 *
 * Story 5.4: Dashboard Filters & Date Range
 * - AC6: API endpoints support dateFrom and dateTo parameters
 *
 * @see Story 5.1: Strategy Dashboard API
 * @see docs/epics-strategy.md
 */

import { z } from "zod";
import { UserRole, ObjectiveStatus, StrategyStatus } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { calculateObjectiveProgress } from "@/server/services/progressService";

/**
 * Roles that can view dashboard (all authenticated org users)
 */
const DASHBOARD_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

export const strategyDashboardRouter = createTRPCRouter({
  /**
   * Get aggregated summary metrics
   *
   * Story 5.1 AC1: Aggregated metrics
   * Story 5.1 AC5: Optional strategyId filter
   */
  getSummary: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(
      z.object({
        strategyId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const strategyFilter = input?.strategyId
        ? { id: input.strategyId, organizationId: ctx.organizationId! }
        : { organizationId: ctx.organizationId! };

      // Get all strategies with goals and objectives for the org
      const strategies = await ctx.db.strategy.findMany({
        where: strategyFilter,
        include: {
          goals: {
            include: {
              objectives: {
                select: {
                  id: true,
                  status: true,
                  kpiType: true,
                  currentValue: true,
                  targetValue: true,
                },
              },
            },
          },
        },
      });

      // Calculate metrics
      const totalStrategies = strategies.length;
      const activeStrategies = strategies.filter(s => s.status === StrategyStatus.ACTIVE);
      const activeStrategyCount = activeStrategies.length;

      // Calculate total goals and objectives
      let totalGoals = 0;
      let totalObjectives = 0;
      let totalProgress = 0;

      for (const strategy of strategies) {
        totalGoals += strategy.goals.length;

        for (const goal of strategy.goals) {
          totalObjectives += goal.objectives.length;
        }
      }

      // Calculate average progress for active strategies
      for (const strategy of activeStrategies) {
        let strategyObjectiveCount = 0;
        let strategyProgressSum = 0;

        for (const goal of strategy.goals) {
          for (const obj of goal.objectives) {
            const progress = calculateObjectiveProgress(
              obj.kpiType,
              obj.currentValue,
              obj.targetValue
            );
            strategyProgressSum += progress;
            strategyObjectiveCount++;
          }
        }

        if (strategyObjectiveCount > 0) {
          totalProgress += strategyProgressSum / strategyObjectiveCount;
        }
      }

      const averageProgress = activeStrategyCount > 0
        ? Math.round((totalProgress / activeStrategyCount) * 10) / 10
        : 0;

      return {
        totalStrategies,
        activeStrategyCount,
        averageProgress,
        totalGoals,
        totalObjectives,
      };
    }),

  /**
   * Get strategy progress data for charts
   *
   * Story 5.1 AC2: Progress chart data
   */
  getProgressChart: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(
      z.object({
        sortBy: z.enum(["progress", "title", "updatedAt"]).default("progress"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        statusFilter: z.nativeEnum(StrategyStatus).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId!,
      };

      // Default to ACTIVE strategies for dashboard, or use filter
      if (input?.statusFilter) {
        where.status = input.statusFilter;
      }

      const strategies = await ctx.db.strategy.findMany({
        where,
        include: {
          goals: {
            include: {
              objectives: {
                select: {
                  kpiType: true,
                  currentValue: true,
                  targetValue: true,
                },
              },
            },
          },
        },
        orderBy: input?.sortBy === "title"
          ? { title: input?.sortOrder || "asc" }
          : input?.sortBy === "updatedAt"
          ? { updatedAt: input?.sortOrder || "desc" }
          : undefined,
      });

      // Calculate progress for each strategy
      const chartData = strategies.map(strategy => {
        let objectiveCount = 0;
        let progressSum = 0;

        for (const goal of strategy.goals) {
          for (const obj of goal.objectives) {
            const progress = calculateObjectiveProgress(
              obj.kpiType,
              obj.currentValue,
              obj.targetValue
            );
            progressSum += progress;
            objectiveCount++;
          }
        }

        const progress = objectiveCount > 0
          ? Math.round((progressSum / objectiveCount) * 10) / 10
          : 0;

        return {
          id: strategy.id,
          title: strategy.title,
          status: strategy.status,
          progress,
          goalCount: strategy.goals.length,
          objectiveCount,
        };
      });

      // Sort by progress if requested (default)
      if (input?.sortBy === "progress" || !input?.sortBy) {
        chartData.sort((a, b) =>
          input?.sortOrder === "asc"
            ? a.progress - b.progress
            : b.progress - a.progress
        );
      }

      return { strategies: chartData };
    }),

  /**
   * Get status breakdown for goals and objectives
   *
   * Story 5.1 AC3: Status breakdown counts
   */
  getStatusBreakdown: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(
      z.object({
        strategyId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Build goal filter
      const goalFilter: Record<string, unknown> = {};
      if (input?.strategyId) {
        goalFilter.strategyId = input.strategyId;
      } else {
        goalFilter.strategy = { organizationId: ctx.organizationId! };
      }

      // Build objective filter
      const objectiveFilter: Record<string, unknown> = {};
      if (input?.strategyId) {
        objectiveFilter.goal = { strategyId: input.strategyId };
      } else {
        objectiveFilter.goal = { strategy: { organizationId: ctx.organizationId! } };
      }

      // Get objective status counts
      const objectiveStatusCounts = await ctx.db.objective.groupBy({
        by: ["status"],
        where: objectiveFilter,
        _count: { status: true },
      });

      // Format objective status breakdown
      const objectivesByStatus: Record<ObjectiveStatus, number> = {
        NOT_STARTED: 0,
        IN_PROGRESS: 0,
        AT_RISK: 0,
        COMPLETED: 0,
      };

      for (const item of objectiveStatusCounts) {
        objectivesByStatus[item.status] = item._count.status;
      }

      // Get strategy status counts (for overall organization view)
      const strategyFilter: Record<string, unknown> = {
        organizationId: ctx.organizationId!,
      };
      if (input?.strategyId) {
        strategyFilter.id = input.strategyId;
      }

      const strategyStatusCounts = await ctx.db.strategy.groupBy({
        by: ["status"],
        where: strategyFilter,
        _count: { status: true },
      });

      const strategiesByStatus: Record<StrategyStatus, number> = {
        DRAFT: 0,
        ACTIVE: 0,
        COMPLETED: 0,
        ARCHIVED: 0,
      };

      for (const item of strategyStatusCounts) {
        strategiesByStatus[item.status] = item._count.status;
      }

      return {
        objectives: objectivesByStatus,
        strategies: strategiesByStatus,
      };
    }),

  /**
   * Get overdue objectives
   *
   * Story 5.1 AC4: Overdue objectives list
   * Story 5.4 AC6: Date range filtering via dateFrom/dateTo
   */
  getOverdue: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        strategyId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build date filter for overdue objectives
      // Story 5.4 AC2: Filter by dueDate within date range
      const dueDateFilter: Record<string, unknown> = { lt: today };

      // If dateFrom is specified, only show objectives with dueDate >= dateFrom
      if (input?.dateFrom) {
        dueDateFilter.gte = input.dateFrom;
      }

      // If dateTo is specified, only show objectives with dueDate <= dateTo
      if (input?.dateTo) {
        dueDateFilter.lt = input.dateTo < today ? input.dateTo : today;
      }

      // Build filter for overdue objectives
      const where: Record<string, unknown> = {
        dueDate: dueDateFilter,
        status: { not: ObjectiveStatus.COMPLETED },
      };

      if (input?.strategyId) {
        where.goal = { strategyId: input.strategyId };
      } else {
        where.goal = { strategy: { organizationId: ctx.organizationId! } };
      }

      const overdueObjectives = await ctx.db.objective.findMany({
        where,
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              strategy: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: input?.limit || 10,
      });

      // Calculate days overdue for each
      return {
        objectives: overdueObjectives.map(obj => ({
          id: obj.id,
          title: obj.title,
          dueDate: obj.dueDate,
          status: obj.status,
          daysOverdue: obj.dueDate
            ? Math.floor((today.getTime() - new Date(obj.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          goalId: obj.goal.id,
          goalTitle: obj.goal.title,
          strategyId: obj.goal.strategy.id,
          strategyTitle: obj.goal.strategy.title,
          assignees: obj.assignees.map(a => ({
            id: a.user.id,
            name: a.user.name,
            email: a.user.email,
            image: a.user.image,
          })),
        })),
        total: overdueObjectives.length,
      };
    }),
});
