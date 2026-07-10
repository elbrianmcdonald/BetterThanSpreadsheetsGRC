/**
 * Email Queue Router (Story 4.15)
 *
 * Provides email queue monitoring and management for admins.
 *
 * AC30-AC35: Email queue metrics query
 * AC36-AC40: Color indicators and dashboard data
 *
 * **Security:**
 * - Only ORG_ADMIN can access email queue data
 * - Automatic organization filtering (multi-tenant isolation)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";
import { createTRPCRouter, organizationProcedure, requireRole } from "@/server/api/trpc";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// Email-queue monitoring/management is platform/system infrastructure (admin tier).
const EMAIL_QUEUE_ADMIN_ROLES: UserRole[] = [...ADMIN_ROLES];

/**
 * Color indicator thresholds for success rate
 * - green: >= 98% success rate
 * - yellow: 95-98% success rate
 * - red: < 95% success rate
 */
const SUCCESS_RATE_THRESHOLDS = {
  green: 98,
  yellow: 95,
} as const;

/**
 * Determine color indicator based on success rate
 */
function getSuccessRateColor(successRate: number): "green" | "yellow" | "red" {
  if (successRate >= SUCCESS_RATE_THRESHOLDS.green) return "green";
  if (successRate >= SUCCESS_RATE_THRESHOLDS.yellow) return "yellow";
  return "red";
}

/**
 * Alert thresholds (AC34)
 */
const ALERT_THRESHOLDS = {
  pendingCount: 100,
  failureRate: 5,
} as const;

/**
 * Email queue metrics response
 */
interface EmailQueueMetrics {
  /** Total emails pending (PENDING + RETRYING) */
  totalPending: number;
  /** Total emails sent in last 24h */
  totalSent: number;
  /** Total emails failed in last 24h */
  totalFailed: number;
  /** Average time from queue to sent (in seconds) */
  averageSendTimeSeconds: number | null;
  /** Success rate percentage (0-100) */
  successRate: number;
  /** Color indicator based on success rate */
  successRateColor: "green" | "yellow" | "red";
  /** Emails currently retrying */
  retrying: number;
  /** Oldest pending email age in minutes */
  oldestPendingMinutes: number | null;
  /** AC34: Alert flags */
  alerts: {
    /** Alert when pending count > 100 */
    highPendingCount: boolean;
    /** Alert when failure rate > 5% */
    highFailureRate: boolean;
  };
}

export const emailQueueRouter = createTRPCRouter({
  /**
   * Get email queue metrics (AC30-AC40)
   *
   * Returns aggregated metrics for the email queue including:
   * - Pending/retrying counts
   * - Sent/failed counts (last 24h)
   * - Average send time
   * - Success rate with color indicator
   *
   * **Authorization**: ORG_ADMIN only
   */
  getMetrics: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .query(async ({ ctx }): Promise<EmailQueueMetrics> => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      // organizationId filtering is automatic via middleware (Story 1.9)

      // Run all count queries in parallel
      const [
        pendingCount,
        retryingCount,
        sentLast24h,
        failedLast24h,
        oldestPending,
        sentEmails,
      ] = await Promise.all([
        // AC31: Total PENDING
        ctx.db.emailQueue.count({
          where: {
            status: "PENDING",
          },
        }),

        // Retrying count
        ctx.db.emailQueue.count({
          where: {
            status: "RETRYING",
          },
        }),

        // AC32: Total SENT in last 24h
        ctx.db.emailQueue.count({
          where: {
            status: "SENT",
            sentAt: { gte: yesterday },
          },
        }),

        // AC33: Total FAILED in last 24h
        ctx.db.emailQueue.count({
          where: {
            status: "FAILED",
            updatedAt: { gte: yesterday },
          },
        }),

        // Oldest pending email for age calculation
        ctx.db.emailQueue.findFirst({
          where: {
            status: { in: ["PENDING", "RETRYING"] },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),

        // Sent emails for average send time calculation (AC34)
        ctx.db.emailQueue.findMany({
          where: {
            status: "SENT",
            sentAt: { gte: yesterday },
          },
          select: {
            createdAt: true,
            sentAt: true,
          },
        }),
      ]);

      // AC30: Total pending = PENDING + RETRYING
      const totalPending = pendingCount + retryingCount;

      // AC34: Calculate average send time
      let averageSendTimeSeconds: number | null = null;
      if (sentEmails.length > 0) {
        const totalSendTime = sentEmails.reduce((sum, email) => {
          if (email.sentAt) {
            return sum + (email.sentAt.getTime() - email.createdAt.getTime());
          }
          return sum;
        }, 0);
        averageSendTimeSeconds = Math.round(totalSendTime / sentEmails.length / 1000);
      }

      // AC35: Calculate success rate
      const totalAttempted = sentLast24h + failedLast24h;
      const successRate = totalAttempted > 0
        ? Math.round((sentLast24h / totalAttempted) * 10000) / 100
        : 100; // 100% if no emails attempted

      // AC36-AC40: Determine color indicator
      const successRateColor = getSuccessRateColor(successRate);

      // Calculate oldest pending age
      let oldestPendingMinutes: number | null = null;
      if (oldestPending) {
        oldestPendingMinutes = Math.round(
          (now.getTime() - oldestPending.createdAt.getTime()) / 60000
        );
      }

      // AC34: Calculate alert flags
      const failureRate = totalAttempted > 0
        ? (failedLast24h / totalAttempted) * 100
        : 0;
      const alerts = {
        highPendingCount: totalPending > ALERT_THRESHOLDS.pendingCount,
        highFailureRate: failureRate > ALERT_THRESHOLDS.failureRate,
      };

      return {
        totalPending,
        totalSent: sentLast24h,
        totalFailed: failedLast24h,
        averageSendTimeSeconds,
        successRate,
        successRateColor,
        retrying: retryingCount,
        oldestPendingMinutes,
        alerts,
      };
    }),

  /**
   * Get failed emails list (AC31-AC33)
   *
   * Returns paginated list of failed emails for admin review.
   *
   * **Authorization**: ORG_ADMIN only
   */
  getFailedEmails: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        emailType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, emailType } = input;
      // organizationId filtering is automatic via middleware (Story 1.9)

      const where = {
        status: "FAILED" as const,
        ...(emailType && { emailType: emailType as any }),
      };

      const [emails, total] = await Promise.all([
        ctx.db.emailQueue.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            to: true,
            subject: true,
            emailType: true,
            error: true,
            retryCount: true,
            maxRetries: true,
            relatedEntityType: true,
            relatedEntityId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        ctx.db.emailQueue.count({ where }),
      ]);

      return {
        emails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get pending/retrying emails list
   *
   * Returns paginated list of pending emails for monitoring.
   *
   * **Authorization**: ORG_ADMIN only
   */
  getPendingEmails: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      // organizationId filtering is automatic via middleware (Story 1.9)

      const where = {
        status: { in: ["PENDING", "RETRYING"] as ("PENDING" | "RETRYING")[] },
      };

      const [emails, total] = await Promise.all([
        ctx.db.emailQueue.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            to: true,
            subject: true,
            emailType: true,
            status: true,
            retryCount: true,
            maxRetries: true,
            lastRetryAt: true,
            error: true,
            createdAt: true,
          },
        }),
        ctx.db.emailQueue.count({ where }),
      ]);

      return {
        emails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Retry a failed email
   *
   * Resets a failed email to PENDING status for reprocessing.
   *
   * **Authorization**: ORG_ADMIN only
   */
  retryEmail: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(
      z.object({
        emailId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = await ctx.db.emailQueue.findUnique({
        where: { id: input.emailId },
        select: { id: true, status: true, organizationId: true },
      });

      if (!email) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        });
      }

      // Verify email belongs to user's organization (secondary check)
      if (email.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email belongs to a different organization",
        });
      }

      if (email.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed emails can be retried",
        });
      }

      // Reset to PENDING for reprocessing
      const updated = await ctx.db.emailQueue.update({
        where: { id: input.emailId },
        data: {
          status: "PENDING",
          retryCount: 0,
          error: null,
          lastRetryAt: null,
        },
      });

      console.log(
        `[EmailQueue] Admin retry: ${updated.emailType} "${updated.subject}" to ${updated.to}`
      );

      return { success: true, emailId: updated.id };
    }),

  /**
   * Delete a failed email (AC33)
   *
   * Permanently removes an unrecoverable failed email.
   *
   * **Authorization**: ORG_ADMIN only
   */
  deleteFailedEmail: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(
      z.object({
        emailId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = await ctx.db.emailQueue.findUnique({
        where: { id: input.emailId },
        select: { id: true, status: true, organizationId: true, subject: true, to: true },
      });

      if (!email) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        });
      }

      // Verify email belongs to user's organization (secondary check)
      if (email.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email belongs to a different organization",
        });
      }

      if (email.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed emails can be deleted",
        });
      }

      await ctx.db.emailQueue.delete({
        where: { id: input.emailId },
      });

      console.log(
        `[EmailQueue] Admin deleted failed email: "${email.subject}" to ${email.to}`
      );

      return { success: true };
    }),

  /**
   * Bulk retry failed emails
   *
   * Resets multiple failed emails to PENDING status.
   *
   * **Authorization**: ORG_ADMIN only
   */
  bulkRetryEmails: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(
      z.object({
        emailIds: z.array(z.string()).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify all emails belong to this organization and are failed
      const emails = await ctx.db.emailQueue.findMany({
        where: {
          id: { in: input.emailIds },
          status: "FAILED",
        },
        select: { id: true, organizationId: true },
      });

      // Filter to only emails belonging to this organization
      const validIds = emails
        .filter((e) => e.organizationId === ctx.organizationId!)
        .map((e) => e.id);

      if (validIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid failed emails found to retry",
        });
      }

      // Bulk update
      const result = await ctx.db.emailQueue.updateMany({
        where: { id: { in: validIds } },
        data: {
          status: "PENDING",
          retryCount: 0,
          error: null,
          lastRetryAt: null,
        },
      });

      console.log(
        `[EmailQueue] Admin bulk retry: ${result.count} emails reset to PENDING`
      );

      return { success: true, count: result.count };
    }),

  /**
   * Get email details by ID
   *
   * **Authorization**: ORG_ADMIN only
   */
  getById: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const email = await ctx.db.emailQueue.findUnique({
        where: { id: input.id },
      });

      if (!email) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        });
      }

      // Verify email belongs to user's organization (secondary check)
      if (email.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email belongs to a different organization",
        });
      }

      return email;
    }),

  /**
   * Get queue statistics by email type
   *
   * **Authorization**: ORG_ADMIN only
   */
  getStatsByType: organizationProcedure
    .use(requireRole(EMAIL_QUEUE_ADMIN_ROLES))
    .query(async ({ ctx }) => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // organizationId filtering is automatic via middleware (Story 1.9)

      const stats = await ctx.db.emailQueue.groupBy({
        by: ["emailType", "status"],
        where: {
          updatedAt: { gte: yesterday },
        },
        _count: {
          id: true,
        },
      });

      // Transform to a more usable format
      const byType: Record<string, { sent: number; failed: number; pending: number }> = {};

      for (const stat of stats) {
        const emailType = stat.emailType;
        if (!byType[emailType]) {
          byType[emailType] = { sent: 0, failed: 0, pending: 0 };
        }

        const entry = byType[emailType]!;
        if (stat.status === "SENT") {
          entry.sent = stat._count.id;
        } else if (stat.status === "FAILED") {
          entry.failed = stat._count.id;
        } else if (stat.status === "PENDING" || stat.status === "RETRYING") {
          entry.pending += stat._count.id;
        }
      }

      return byType;
    }),
});
