/**
 * Risk Register Router
 *
 * tRPC router for risk register entry operations.
 *
 * Story 7.10: Risk Register Entry Creation
 * - list query (AC21-AC24)
 *
 * Story 16.5: Unified Risk Register Page
 * - Enhanced list with filters (AC1-AC7)
 *
 * Story 16.6: Risk Register Status Transitions
 * - updateStatus mutation (AC1-AC4)
 * - getStatusHistory query (AC13-AC14)
 *
 * @see Story 7.10: Risk Register Entry Creation
 * @see Story 16.5: Unified Risk Register Page
 * @see Story 16.6: Risk Register Status Transitions
 */

import { z } from "zod";
import { RiskRegisterStatus, AuditAction, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
} from "@/server/api/trpc";

/**
 * Story 16.6: Valid status transitions (AC2)
 *
 * Defines which status transitions are allowed:
 * - OPEN → IN_TREATMENT
 * - IN_TREATMENT → ACCEPTED, MITIGATED, TRANSFERRED, CLOSED
 * - ACCEPTED/MITIGATED/TRANSFERRED → CLOSED
 * - Any → OPEN (reopen)
 */
const VALID_TRANSITIONS: Record<RiskRegisterStatus, RiskRegisterStatus[]> = {
  OPEN: [RiskRegisterStatus.IN_TREATMENT],
  IN_TREATMENT: [
    RiskRegisterStatus.ACCEPTED,
    RiskRegisterStatus.MITIGATED,
    RiskRegisterStatus.TRANSFERRED,
    RiskRegisterStatus.CLOSED,
  ],
  ACCEPTED: [RiskRegisterStatus.CLOSED],
  MITIGATED: [RiskRegisterStatus.CLOSED],
  TRANSFERRED: [RiskRegisterStatus.CLOSED],
  CLOSED: [], // No forward transitions from CLOSED
};

/**
 * Check if a status transition is valid (AC2)
 */
function isValidTransition(
  fromStatus: RiskRegisterStatus,
  toStatus: RiskRegisterStatus
): boolean {
  // Reopen is always allowed (Any → OPEN)
  if (toStatus === RiskRegisterStatus.OPEN) {
    return fromStatus !== RiskRegisterStatus.OPEN; // Can't reopen if already open
  }

  // Check if the transition is in the valid list
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Get human-readable transition action name for UI
 */
function getTransitionActionName(toStatus: RiskRegisterStatus): string {
  switch (toStatus) {
    case RiskRegisterStatus.IN_TREATMENT:
      return "Start Treatment";
    case RiskRegisterStatus.ACCEPTED:
      return "Mark Accepted";
    case RiskRegisterStatus.MITIGATED:
      return "Mark Mitigated";
    case RiskRegisterStatus.TRANSFERRED:
      return "Mark Transferred";
    case RiskRegisterStatus.CLOSED:
      return "Close";
    case RiskRegisterStatus.OPEN:
      return "Reopen";
    default:
      return toStatus;
  }
}

export const riskRegisterRouter = createTRPCRouter({
  /**
   * List risk register entries with filtering, sorting and pagination
   *
   * Story 7.10: AC21-AC24
   * - AC21: Returns RiskRegisterEntry records with related assessment/finding
   * - AC22: Supports filtering by status
   * - AC23: Supports filtering by owner
   * - AC24: Supports cursor-based pagination
   *
   * Story 16.5: Enhanced filters (AC1-AC7)
   * - AC2: Filter by status (multi-select)
   * - AC3: Filter by businessUnitId
   * - AC4: Filter by ownerId
   * - AC5: Filter by severity label
   * - AC6: Sort by dueDate, createdAt, severity
   * - AC7: Pagination
   * - AC15: Search by identifier or title
   */
  list: organizationProcedure
    .input(
      z.object({
        // Story 16.5: Multi-select status filter (AC2, AC11)
        status: z.array(z.nativeEnum(RiskRegisterStatus)).optional(),
        // Story 16.5: Business Unit filter (AC3, AC12)
        businessUnitId: z.string().optional(),
        // Story 16.5: Owner filter (AC4, AC13)
        ownerId: z.string().optional(),
        // Story 16.5: Severity filter (AC5, AC14)
        severityLabels: z.array(z.string()).optional(),
        // Story 16.5: Search by ID or title (AC15)
        search: z.string().optional(),
        // Story 16.5: Sort options (AC6)
        sortBy: z.enum(["createdAt", "dueDate", "severity"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        // Pagination
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Build where clause. Entries are now either assessment-backed (finding
      // flow) or risk-backed (project-discovered flow). Filters through the
      // assessment relation are applied via an AND so risk-backed rows are
      // not filtered out unless an explicit assessment-only filter is set.
      const assessmentSubFilter: Prisma.RiskAssessmentWhereInput = {
        ...(input.businessUnitId && { businessUnitId: input.businessUnitId }),
        ...(input.severityLabels && input.severityLabels.length > 0 && {
          inherentScoreLabel: { in: input.severityLabels },
        }),
      };
      const hasAssessmentFilter =
        Boolean(input.businessUnitId) ||
        (input.severityLabels?.length ?? 0) > 0;

      const searchClause: Prisma.RiskRegisterEntryWhereInput | undefined = input.search
        ? {
            OR: [
              { identifier: { contains: input.search, mode: "insensitive" as const } },
              {
                assessment: {
                  is: {
                    OR: [
                      { identifier: { contains: input.search, mode: "insensitive" as const } },
                      {
                        finding: { title: { contains: input.search, mode: "insensitive" as const } },
                      },
                    ],
                  },
                },
              },
              {
                risk: {
                  is: { title: { contains: input.search, mode: "insensitive" as const } },
                },
              },
            ],
          }
        : undefined;

      const whereClause: Prisma.RiskRegisterEntryWhereInput = {
        organizationId,
        ...(input.status && input.status.length > 0 && { status: { in: input.status } }),
        ...(input.ownerId && { ownerId: input.ownerId }),
        ...(hasAssessmentFilter && { assessment: { is: assessmentSubFilter } }),
        ...(searchClause ?? {}),
      };

      // Build orderBy clause
      let orderBy: Prisma.RiskRegisterEntryOrderByWithRelationInput;
      switch (input.sortBy) {
        case "dueDate":
          orderBy = { slaDueDate: input.sortOrder };
          break;
        case "severity":
          // Sort by inherent score through assessment
          orderBy = { assessment: { inherentScore: input.sortOrder } };
          break;
        case "createdAt":
        default:
          orderBy = { createdAt: input.sortOrder };
      }

      const entries = await ctx.db.riskRegisterEntry.findMany({
        where: whereClause,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy,
        include: {
          assessment: {
            include: {
              finding: {
                select: {
                  id: true,
                  identifier: true,
                  title: true,
                  source: true,
                  // Epic 19: exploitation-pathway membership (drives the ⬡ indicator)
                  isToxic: true,
                },
              },
              // Story 16.5: Include business unit (AC17)
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          risk: {
            select: {
              id: true,
              identifier: true,
              title: true,
              severity: true,
              status: true,
              // Epic 19: exploitation-pathway membership (drives the ⬡ indicator)
              isToxic: true,
              BusinessUnit: { select: { id: true, name: true } },
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          closer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (entries.length > input.limit) {
        const nextItem = entries.pop();
        nextCursor = nextItem?.id;
      }

      // Story 16.5: Calculate SLA status for each entry (AC19)
      const now = new Date();
      const serializedEntries = entries.map((entry) => {
        // Calculate SLA status
        let slaStatus: "on_track" | "at_risk" | "breached" | "no_sla" = "no_sla";
        let daysRemaining: number | null = null;
        let daysOverdue: number | null = null;

        if (entry.slaDueDate) {
          const dueDate = new Date(entry.slaDueDate);
          const diffMs = dueDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            slaStatus = "breached";
            daysOverdue = Math.abs(diffDays);
          } else if (diffDays <= 3) {
            slaStatus = "at_risk";
            daysRemaining = diffDays;
          } else {
            slaStatus = "on_track";
            daysRemaining = diffDays;
          }
        }

        return {
          ...entry,
          slaStatus,
          daysRemaining,
          daysOverdue,
          assessment: entry.assessment
            ? {
                ...entry.assessment,
                likelihoodValue: entry.assessment.likelihoodValue
                  ? Number(entry.assessment.likelihoodValue)
                  : null,
                impactValue: entry.assessment.impactValue
                  ? Number(entry.assessment.impactValue)
                  : null,
                exposureValue: entry.assessment.exposureValue
                  ? Number(entry.assessment.exposureValue)
                  : null,
                inherentScore: entry.assessment.inherentScore
                  ? Number(entry.assessment.inherentScore)
                  : null,
              }
            : null,
          risk: entry.risk ?? null,
        };
      });

      return {
        entries: serializedEntries,
        nextCursor,
      };
    }),

  /**
   * Get a single risk register entry by ID
   *
   * Story 7.10: Additional helper query for detail views
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const entry = await ctx.db.riskRegisterEntry.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          assessment: {
            include: {
              finding: {
                select: {
                  id: true,
                  identifier: true,
                  title: true,
                  source: true,
                  description: true,
                },
              },
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          risk: {
            select: {
              id: true,
              identifier: true,
              title: true,
              description: true,
              severity: true,
              status: true,
              BusinessUnit: { select: { id: true, name: true } },
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          closer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!entry) {
        return null;
      }

      return {
        ...entry,
        assessment: entry.assessment
          ? {
              ...entry.assessment,
              likelihoodValue: entry.assessment.likelihoodValue
                ? Number(entry.assessment.likelihoodValue)
                : null,
              impactValue: entry.assessment.impactValue
                ? Number(entry.assessment.impactValue)
                : null,
              exposureValue: entry.assessment.exposureValue
                ? Number(entry.assessment.exposureValue)
                : null,
              inherentScore: entry.assessment.inherentScore
                ? Number(entry.assessment.inherentScore)
                : null,
            }
          : null,
        risk: entry.risk ?? null,
      };
    }),

  /**
   * Get counts by status for dashboard
   *
   * Story 7.10: Additional helper query for status overview
   * Story 16.5: Enhanced to include overdue count (AC10)
   */
  getStatusCounts: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;

    // Get counts by status
    const counts = await ctx.db.riskRegisterEntry.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { id: true },
    });

    // Story 16.5: Get overdue count (AC10)
    const now = new Date();
    const overdueCount = await ctx.db.riskRegisterEntry.count({
      where: {
        organizationId,
        slaDueDate: { lt: now },
        status: {
          notIn: [RiskRegisterStatus.CLOSED, RiskRegisterStatus.MITIGATED, RiskRegisterStatus.ACCEPTED],
        },
      },
    });

    // Story 16.5: Get total count
    const totalCount = await ctx.db.riskRegisterEntry.count({
      where: { organizationId },
    });

    // Build a map with all statuses initialized to 0
    const statusCounts: Record<RiskRegisterStatus, number> = {
      OPEN: 0,
      IN_TREATMENT: 0,
      ACCEPTED: 0,
      TRANSFERRED: 0,
      MITIGATED: 0,
      CLOSED: 0,
    };

    // Fill in actual counts
    for (const count of counts) {
      statusCounts[count.status] = count._count.id;
    }

    return {
      ...statusCounts,
      overdue: overdueCount,
      total: totalCount,
    };
  }),

  /**
   * Get users who own risk register entries (for owner filter dropdown)
   *
   * Story 16.5: Owner filter dropdown (AC13)
   */
  getOwners: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;

    // Get unique owner IDs
    const ownerIds = await ctx.db.riskRegisterEntry.findMany({
      where: { organizationId },
      select: { ownerId: true },
      distinct: ["ownerId"],
    });

    if (ownerIds.length === 0) {
      return [];
    }

    // Get user details
    const owners = await ctx.db.user.findMany({
      where: {
        id: { in: ownerIds.map((o) => o.ownerId) },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return owners;
  }),

  /**
   * Update risk register entry status (AC1-AC4)
   *
   * Story 16.6: Risk Register Status Transitions
   * - AC1: Accepts entryId and newStatus
   * - AC2: Validates status transitions
   * - AC3: Returns error for invalid transitions
   * - AC4: Creates audit log entry
   */
  updateStatus: organizationProcedure
    .input(
      z.object({
        entryId: z.string(),
        newStatus: z.nativeEnum(RiskRegisterStatus),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Get the current entry
      const entry = await ctx.db.riskRegisterEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk register entry not found",
        });
      }

      const oldStatus = entry.status;
      const newStatus = input.newStatus;

      // AC2: Validate the transition
      if (!isValidTransition(oldStatus, newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid status transition from ${oldStatus} to ${newStatus}`,
        });
      }

      // AC8/AC11: Require comment for Accept and Close actions
      if (
        (newStatus === RiskRegisterStatus.ACCEPTED ||
          newStatus === RiskRegisterStatus.CLOSED) &&
        !input.comment
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Comment is required when ${getTransitionActionName(newStatus).toLowerCase()}`,
        });
      }

      // Update the entry status
      const now = new Date();
      const updatedEntry = await ctx.db.riskRegisterEntry.update({
        where: { id: input.entryId },
        data: {
          status: newStatus,
          // Set closedAt and closedBy when closing
          ...(newStatus === RiskRegisterStatus.CLOSED && {
            closedAt: now,
            closedBy: userId,
          }),
          // Clear closedAt and closedBy when reopening
          ...(newStatus === RiskRegisterStatus.OPEN && {
            closedAt: null,
            closedBy: null,
          }),
        },
        include: {
          assessment: {
            include: {
              finding: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      // Create status history record (AC13-AC14)
      await ctx.db.riskRegisterStatusHistory.create({
        data: {
          id: randomUUID(),
          entryId: input.entryId,
          oldStatus,
          newStatus,
          comment: input.comment ?? null,
          changedById: userId,
          organizationId,
        },
      });

      // AC4: Create audit log entry
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.UPDATE_RISK_STATUS,
          entityType: "RiskRegisterEntry",
          entityId: input.entryId,
          changes: {
            action: getTransitionActionName(newStatus),
            oldStatus,
            newStatus,
            comment: input.comment,
            entryIdentifier: entry.identifier,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updatedEntry;
    }),

  /**
   * Get available status transitions for an entry (AC5-AC6)
   *
   * Story 16.6: Returns valid transitions for the current status
   */
  getAvailableTransitions: organizationProcedure
    .input(z.object({ entryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const entry = await ctx.db.riskRegisterEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
        select: { status: true },
      });

      if (!entry) {
        return [];
      }

      const currentStatus = entry.status;
      const transitions: Array<{
        status: RiskRegisterStatus;
        label: string;
        requiresComment: boolean;
      }> = [];

      // Get forward transitions
      const forwardTransitions = VALID_TRANSITIONS[currentStatus] ?? [];
      for (const status of forwardTransitions) {
        transitions.push({
          status,
          label: getTransitionActionName(status),
          requiresComment:
            status === RiskRegisterStatus.ACCEPTED ||
            status === RiskRegisterStatus.CLOSED,
        });
      }

      // Add reopen option if not already open
      if (currentStatus !== RiskRegisterStatus.OPEN) {
        transitions.push({
          status: RiskRegisterStatus.OPEN,
          label: "Reopen",
          requiresComment: false,
        });
      }

      return transitions;
    }),

  /**
   * Get status history for an entry (AC13-AC14)
   *
   * Story 16.6: Returns status change history with user and comments
   */
  getStatusHistory: organizationProcedure
    .input(z.object({ entryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify entry belongs to organization
      const entry = await ctx.db.riskRegisterEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
        select: { id: true },
      });

      if (!entry) {
        return [];
      }

      const history = await ctx.db.riskRegisterStatusHistory.findMany({
        where: { entryId: input.entryId },
        orderBy: { changedAt: "desc" },
        include: {
          changedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return history;
    }),
});
