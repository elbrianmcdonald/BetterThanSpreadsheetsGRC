/**
 * Audit Log Query Router
 *
 * Provides read-only access to audit logs for compliance reporting.
 *
 * **Security:**
 * - Only ORG_ADMIN and CISO roles can access audit logs (AC25)
 * - Automatic organization filtering (multi-tenant isolation)
 * - Immutable - no update/delete operations (AC3)
 *
 * **Use Cases:**
 * - View audit trail for specific entity (risk, evidence, user)
 * - View all actions by specific user
 * - Export audit logs for compliance reporting
 * - Investigate security incidents
 *
 * @see Story 1.10: Audit Logging Infrastructure
 * @see docs/AUDIT_LOGGING.md
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";
import { createTRPCRouter, organizationProcedure, requirePermission } from "@/server/api/trpc";
import { requireRole } from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import { READ_ROLES } from "@/lib/auth/roles";

// Audit-log access is read/export of the org's own audit trail (read tier).
const AUDIT_READ_ROLES: UserRole[] = [...READ_ROLES];

/**
 * Audit log pagination response schema
 */
interface AuditLogResponse {
  logs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const auditRouter = createTRPCRouter({
  /**
   * Get audit trail for specific entity (AC21)
   *
   * **Example**: View full history of a risk record
   * ```typescript
   * const history = await trpc.audit.getByEntity.query({
   *   entityType: "Risk",
   *   entityId: "risk-123",
   *   page: 1,
   *   pageSize: 50,
   * });
   * ```
   *
   * **Authorization**: ORG_ADMIN or CISO only
   */
  getByEntity: organizationProcedure
    .use(requireRole(AUDIT_READ_ROLES))
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }): Promise<AuditLogResponse> => {
      const { entityType, entityId, page, pageSize } = input;

      // Query audit logs for this entity (automatic org filtering by Story 1.9)
      const logs = await ctx.db.auditLog.findMany({
        where: {
          // organizationId automatically filtered by middleware
          entityType,
          entityId,
        },
        include: {
          User: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: "desc" }, // Most recent first
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      // Count total matching records for pagination
      const total = await ctx.db.auditLog.count({
        where: {
          entityType,
          entityId,
        },
      });

      return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get audit trail for a specific evidence record
   *
   * Story 3.9: Evidence Audit Trail (AC20-AC24)
   *
   * **Example**: View full audit history for an evidence file
   * ```typescript
   * const history = await trpc.audit.getEvidenceAuditLog.query({
   *   evidenceId: "evidence-123",
   *   page: 1,
   *   pageSize: 10,
   * });
   * ```
   *
   * **Authorization**: Users with EVIDENCE_READ permission
   * (same access as viewing the evidence itself)
   */
  getEvidenceAuditLog: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(
      z.object({
        evidenceId: z.string().uuid("Invalid evidence ID"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(10),
      }),
    )
    .query(async ({ ctx, input }): Promise<AuditLogResponse> => {
      const { evidenceId, page, pageSize } = input;

      // Verify evidence exists and belongs to organization
      const evidence = await ctx.db.evidence.findUnique({
        where: { id: evidenceId },
        select: { id: true, organizationId: true },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      if (evidence.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this evidence",
        });
      }

      // Query audit logs for this evidence (AC20-AC22)
      const logs = await ctx.db.auditLog.findMany({
        where: {
          entityType: "Evidence",
          entityId: evidenceId,
          organizationId: ctx.organizationId,
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: "desc" }, // AC22: Most recent first
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      // Count total matching records for pagination (AC19)
      const total = await ctx.db.auditLog.count({
        where: {
          entityType: "Evidence",
          entityId: evidenceId,
          organizationId: ctx.organizationId,
        },
      });

      return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get all actions by specific user (AC22)
   *
   * **Example**: View all actions performed by a user (for investigation)
   * ```typescript
   * const userActions = await trpc.audit.getByUser.query({
   *   userId: "user-456",
   *   page: 1,
   * });
   * ```
   *
   * **Authorization**: ORG_ADMIN or CISO only
   */
  getByUser: organizationProcedure
    .use(requireRole(AUDIT_READ_ROLES))
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }): Promise<AuditLogResponse> => {
      const { userId, page, pageSize } = input;

      // Verify user belongs to current organization (prevent cross-org access)
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (user.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User belongs to a different organization",
        });
      }

      // Query audit logs for this user
      const logs = await ctx.db.auditLog.findMany({
        where: {
          userId,
        },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const total = await ctx.db.auditLog.count({
        where: {
          userId,
        },
      });

      return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get audit logs by date range (AC23)
   *
   * **Example**: View all actions in last 30 days
   * ```typescript
   * const recentLogs = await trpc.audit.getByDateRange.query({
   *   startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
   *   endDate: new Date(),
   * });
   * ```
   *
   * **Authorization**: ORG_ADMIN or CISO only
   */
  getByDateRange: organizationProcedure
    .use(requireRole(AUDIT_READ_ROLES))
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }): Promise<AuditLogResponse> => {
      const { startDate, endDate, page, pageSize } = input;

      // Validate date range
      if (startDate > endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "startDate must be before endDate",
        });
      }

      const logs = await ctx.db.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          User: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const total = await ctx.db.auditLog.count({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Export audit logs to CSV (AC24)
   *
   * **Example**: Export last 90 days for SOC 2 audit
   * ```typescript
   * const csv = await trpc.audit.exportToCsv.mutation({
   *   startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
   *   endDate: new Date(),
   * });
   *
   * // Download CSV file
   * const blob = new Blob([csv], { type: "text/csv" });
   * const url = URL.createObjectURL(blob);
   * ```
   *
   * **Authorization**: ORG_ADMIN or CISO only
   */
  exportToCsv: organizationProcedure
    .use(requireRole(AUDIT_READ_ROLES))
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<string> => {
      const { startDate, endDate } = input;

      // Validate date range
      if (startDate > endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "startDate must be before endDate",
        });
      }

      // Fetch all audit logs in date range (no pagination for export)
      const logs = await ctx.db.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          User: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
      });

      // Convert to CSV format
      const csv = convertAuditLogsToCsv(logs);
      return csv;
    }),

  /**
   * Get audit log statistics
   *
   * **Example**: Dashboard metrics for compliance reporting
   * ```typescript
   * const stats = await trpc.audit.getStatistics.query({
   *   days: 30,
   * });
   * ```
   *
   * **Authorization**: ORG_ADMIN or CISO only
   */
  getStatistics: organizationProcedure
    .use(requireRole(AUDIT_READ_ROLES))
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const [totalLogs, actionCounts, failedAuthCount] = await Promise.all([
        // Total audit logs in period
        ctx.db.auditLog.count({
          where: {
            timestamp: {
              gte: startDate,
            },
          },
        }),

        // Count by action type
        ctx.db.auditLog.groupBy({
          by: ["action"],
          where: {
            timestamp: {
              gte: startDate,
            },
          },
          _count: {
            action: true,
          },
        }),

        // Failed authorization attempts
        ctx.db.auditLog.count({
          where: {
            timestamp: {
              gte: startDate,
            },
            action: "AUTHORIZATION_FAILED",
          },
        }),
      ]);

      return {
        totalLogs,
        actionCounts,
        failedAuthCount,
        periodDays: input.days,
      };
    }),
});

/**
 * Convert audit logs to CSV format
 *
 * **CSV Columns:**
 * - Timestamp: ISO 8601 format
 * - User Email: Who performed the action
 * - User Role: Role at time of action
 * - Action: Action type (enum value)
 * - Entity Type: Type of entity affected
 * - Entity ID: ID of affected entity
 * - Changes: JSON string of before/after state
 * - IP Address: Client IP (if available)
 * - User Agent: Client browser/device info
 *
 * @param logs - Audit log records to convert
 * @returns CSV string with header and data rows
 */
function convertAuditLogsToCsv(logs: any[]): string {
  // CSV header
  const header =
    "Timestamp,User Email,User Role,Action,Entity Type,Entity ID,Changes,IP Address,User Agent\n";

  // Convert each log to CSV row
  const rows = logs
    .map((log) => {
      return [
        log.timestamp.toISOString(),
        log.user.email || "",
        log.user.role || "",
        log.action,
        log.entityType,
        log.entityId,
        JSON.stringify(log.changes || {}),
        log.ipAddress || "",
        escapeCSV(log.userAgent || ""),
      ].join(",");
    })
    .join("\n");

  return header + rows;
}

/**
 * Escape CSV special characters
 *
 * Wraps fields in quotes if they contain commas, quotes, or newlines.
 *
 * @param value - String value to escape
 * @returns Escaped CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
