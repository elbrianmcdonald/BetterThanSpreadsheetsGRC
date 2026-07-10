/**
 * Worker tRPC Router (Story 4.18)
 *
 * Provides API endpoints for worker metrics and management.
 *
 * AC28: Worker metrics queryable via `getWorkerMetrics` query
 * AC26: Admin dashboard can show worker status and metrics
 */

import { z } from "zod";
import { UserRole } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { getWorkerStatus } from "@/server/workers/scheduler";
import { workerMetrics } from "@/server/workers/metrics";
import { getQueueStats } from "@/server/workers/emailWorker";
import { getJobHistory, JobType, getRegisteredProcessors } from "@/server/workers/jobTypes";

/**
 * Roles that can view worker metrics
 */
const CAN_VIEW_WORKER_METRICS: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
];

export const workerRouter = createTRPCRouter({
  /**
   * Get worker metrics for all workers
   *
   * AC28: Worker metrics queryable via getWorkerMetrics query
   */
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    // Check permission
    if (!CAN_VIEW_WORKER_METRICS.includes(ctx.session.user.role)) {
      throw new Error("You don't have permission to view worker metrics");
    }

    const status = getWorkerStatus();
    const emailMetrics = workerMetrics.getMetrics("email");
    const queueStats = await getQueueStats();

    return {
      timestamp: new Date().toISOString(),
      workers: {
        email: {
          status: emailMetrics?.status ?? "stopped",
          isProcessing: emailMetrics?.isProcessing ?? false,
          lastProcessedAt: emailMetrics?.lastProcessedAt?.toISOString() ?? null,
          startedAt: emailMetrics?.startedAt?.toISOString() ?? null,
          jobsProcessedLast24h: emailMetrics?.jobsProcessedLast24h ?? 0,
          jobsSucceededLast24h: emailMetrics?.jobsSucceededLast24h ?? 0,
          jobsFailedLast24h: emailMetrics?.jobsFailedLast24h ?? 0,
          errorCount: emailMetrics?.errorCount ?? 0,
          lastError: emailMetrics?.lastError ?? null,
          lastErrorAt: emailMetrics?.lastErrorAt?.toISOString() ?? null,
          avgProcessingDurationMs: emailMetrics?.avgProcessingDurationMs ?? 0,
        },
      },
      queue: {
        pending: queueStats.pending,
        retrying: queueStats.retrying,
        sent24h: queueStats.sent24h,
        failed24h: queueStats.failed24h,
      },
      config: {
        enabled: status.config.enabled,
        intervalMs: status.config.interval,
      },
      shuttingDown: status.shuttingDown,
    };
  }),

  /**
   * Get email queue statistics
   *
   * Provides summary of email queue status
   */
  getQueueStats: protectedProcedure.query(async ({ ctx }) => {
    // Check permission
    if (!CAN_VIEW_WORKER_METRICS.includes(ctx.session.user.role)) {
      throw new Error("You don't have permission to view queue stats");
    }

    return await getQueueStats();
  }),

  /**
   * Get job history for troubleshooting
   *
   * AC23: Job history retained for troubleshooting
   */
  getJobHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        jobType: z.nativeEnum(JobType).optional(),
      })
    )
    .query(({ ctx, input }) => {
      // Check permission
      if (!CAN_VIEW_WORKER_METRICS.includes(ctx.session.user.role)) {
        throw new Error("You don't have permission to view job history");
      }

      const history = getJobHistory(input.limit, input.jobType);

      return history.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        startedAt: entry.startedAt?.toISOString() ?? null,
        completedAt: entry.completedAt?.toISOString() ?? null,
      }));
    }),

  /**
   * Get registered job processors
   *
   * AC21: Shows which job types have registered processors
   */
  getRegisteredProcessors: protectedProcedure.query(({ ctx }) => {
    // Check permission
    if (!CAN_VIEW_WORKER_METRICS.includes(ctx.session.user.role)) {
      throw new Error("You don't have permission to view processor info");
    }

    const processors = getRegisteredProcessors();
    const result: Array<{
      jobType: JobType;
      description: string;
      registeredAt: string;
    }> = [];

    for (const [jobType, meta] of processors) {
      result.push({
        jobType,
        description: meta.description,
        registeredAt: meta.registeredAt.toISOString(),
      });
    }

    return result;
  }),
});
