/**
 * Objective Router
 *
 * tRPC router for Objective management operations within Goals.
 *
 * Story 2.2: Objective CRUD API
 * - create: Create new objective within a goal
 * - getById: Get objective with details and calculated progress
 * - update: Update objective details with KPI validation
 * - delete: Delete objective
 * - reorder: Reorder objectives within a goal
 * - listByGoal: List objectives for a goal
 *
 * Story 2.3: Objective Assignee Management
 * - listMyAssignments: List objectives assigned to the current user (AC4)
 * - SECURITY_ENGINEER can update assigned objectives but not assignees (AC3)
 * - IT_STAKEHOLDER can only view their assigned objectives (AC4, AC5)
 *
 * Story 6.1: Complete Role-Based Access Control
 * - AC6: IT_STAKEHOLDER assignee-only filtering for getById and listByGoal
 *
 * Story 2.4: Comments on Objectives
 * - addComment: Add a comment to an objective (AC3)
 * - getById returns comments ordered by createdAt desc (AC4)
 *
 * Story 3.2: Entity Link/Unlink API
 * - linkRisk/unlinkRisk: Link/unlink Risk to Objective (AC1, AC2)
 * - linkControl/unlinkControl: Link/unlink Control to Objective (AC3, AC4)
 * - linkEvidence/unlinkEvidence: Link/unlink Evidence to Objective (AC5, AC6)
 * - Multi-tenant isolation: 403 if entity from different org (AC7)
 *
 * Story 3.3: Entity Search for Linking
 * - searchRisks: Search Risks by title/description (AC1)
 * - searchControls: Search Controls by name/description (AC2)
 * - searchEvidence: Search Evidence by title/description (AC3)
 * - Results limited to 20 items (AC4), marks already-linked entities (AC5)
 *
 * Story 3.4: Auto-Calculated KPI Engine
 * - calculateKpi: Compute and update KPI from linked entities (AC8)
 * - Supports: RISK_REMEDIATION_RATE (AC1), RISK_OPEN_COUNT (AC2),
 *   HIGH_SEVERITY_RISK_COUNT (AC3), CONTROL_IMPLEMENTATION_RATE (AC4),
 *   CONTROL_EFFECTIVENESS_AVG (AC5), EVIDENCE_FRESHNESS_RATE (AC6),
 *   EVIDENCE_COVERAGE (AC7)
 * - getLinkedEntityCounts: Get link statistics for an objective
 *
 * @see Story 2.2: Objective CRUD tRPC Router
 * @see Story 2.3: Objective Assignee Management
 * @see Story 2.4: Comments on Goals and Objectives
 * @see Story 3.2: Entity Link/Unlink API
 * @see Story 3.3: Entity Search for Linking
 * @see docs/epics-strategy.md
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AuditAction, KpiType, ObjectiveStatus, RiskStatus, Severity, OrgControlStatus, ChangeType } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import type { db } from "@/server/db";
import {
  buildCreateChangedFields,
  buildUpdateChangedFields,
  buildDeleteChangedFields,
  extractObjectiveFields,
} from "@/server/services/historyService";
import { calculateObjectiveProgress } from "@/server/services/progressService";

/**
 * Roles that can manage objectives (FR58)
 * - CISO: Full CRUD access
 * - GRC_ANALYST: Full CRUD access
 * - ORG_ADMIN: Full CRUD access
 */
const OBJECTIVE_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can update assigned objectives (FR59)
 * SECURITY_ENGINEER can update objectives they are assigned to
 */
const OBJECTIVE_UPDATE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
];

/**
 * Roles that can view objectives (FR59-FR62)
 * All authenticated org users can view objectives
 */
const OBJECTIVE_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * Roles that can add comments on objectives
 * Story 6.1 AC2: AUDITOR cannot add comments (read-only access)
 */
const OBJECTIVE_COMMENT_ROLES = [
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
 * Schema for creating an objective (AC1)
 */
const createObjectiveSchema = z.object({
  goalId: z.string().min(1, "Goal ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(ObjectiveStatus).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  kpiType: z.nativeEnum(KpiType).optional(),
  targetValue: z.number().optional().nullable(),
  currentValue: z.number().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

/**
 * Schema for getting an objective by ID
 */
const getByIdSchema = z.object({
  id: z.string().min(1, "Objective ID is required"),
});

/**
 * Schema for updating an objective (AC3)
 */
const updateObjectiveSchema = z.object({
  id: z.string().min(1, "Objective ID is required"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(ObjectiveStatus).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  kpiType: z.nativeEnum(KpiType).optional(),
  targetValue: z.number().optional().nullable(),
  currentValue: z.number().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

/**
 * Schema for deleting an objective (AC4)
 */
const deleteObjectiveSchema = z.object({
  id: z.string().min(1, "Objective ID is required"),
});

/**
 * Schema for reordering objectives (AC2)
 */
const reorderObjectivesSchema = z.object({
  goalId: z.string().min(1, "Goal ID is required"),
  objectiveOrders: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

/**
 * Schema for listing objectives by goal
 */
const listByGoalSchema = z.object({
  goalId: z.string().min(1, "Goal ID is required"),
});

/**
 * Story 2.4 AC3: Schema for adding a comment to an objective
 */
const addCommentSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(5000, "Comment must be 5000 characters or less"),
});

// =============================================================================
// Story 3.2: Entity Linking Schemas
// =============================================================================

/**
 * Story 3.2 AC1-AC2: Schema for linking/unlinking a Risk to an Objective
 */
const linkRiskSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  riskId: z.string().min(1, "Risk ID is required"),
});

/**
 * Story 3.2 AC3-AC4: Schema for linking/unlinking a Control to an Objective
 */
const linkControlSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  controlId: z.string().min(1, "Control ID is required"),
});

/**
 * Story 3.2 AC5-AC6: Schema for linking/unlinking Evidence to an Objective
 */
const linkEvidenceSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  evidenceId: z.string().min(1, "Evidence ID is required"),
});

/**
 * Story 3.3: Schema for searching entities to link to an Objective
 * AC4: Results limited to 20 items
 * AC5: Include objectiveId to check if already linked
 */
const searchEntitiesSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required"),
  query: z.string().min(1, "Search query is required").max(100),
  limit: z.number().min(1).max(20).optional().default(20),
});

// =============================================================================
// Helper Functions
// =============================================================================

// Type alias for the database client (uses extended Prisma client type)
type DbClient = typeof db;

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

/**
 * Verify that an objective belongs to the user's organization via goal->strategy
 */
async function verifyObjectiveAccess(
  db: DbClient,
  objectiveId: string,
  organizationId: string
): Promise<{
  id: string;
  title: string;
  goalId: string;
  goal: { id: string; strategyId: string };
} | null> {
  return db.objective.findFirst({
    where: {
      id: objectiveId,
      goal: {
        strategy: {
          organizationId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      goalId: true,
      goal: {
        select: {
          id: true,
          strategyId: true,
        },
      },
    },
  });
}

/**
 * Validate currentValue based on KPI type (AC3)
 */
function validateKpiValue(
  kpiType: KpiType,
  currentValue: number | null | undefined
): { valid: boolean; message?: string } {
  if (currentValue === null || currentValue === undefined) {
    return { valid: true };
  }

  switch (kpiType) {
    case KpiType.MANUAL_PERCENTAGE:
      if (currentValue < 0 || currentValue > 100) {
        return {
          valid: false,
          message: "Percentage value must be between 0 and 100",
        };
      }
      break;

    case KpiType.MANUAL_BOOLEAN:
      if (currentValue !== 0 && currentValue !== 1) {
        return {
          valid: false,
          message: "Boolean value must be 0 (not achieved) or 1 (achieved)",
        };
      }
      break;

    case KpiType.MANUAL_COUNT:
      if (currentValue < 0) {
        return {
          valid: false,
          message: "Count value must be non-negative",
        };
      }
      break;
  }

  return { valid: true };
}

// =============================================================================
// Story 3.4: Auto-Calculated KPI Types
// =============================================================================

/**
 * KPI types that are auto-calculated from linked entities
 * Manual types (MANUAL_*) are excluded as they are user-entered
 */
const AUTO_CALCULATED_KPI_TYPES: KpiType[] = [
  KpiType.RISK_REMEDIATION_RATE,
  KpiType.RISK_OPEN_COUNT,
  KpiType.HIGH_SEVERITY_RISK_COUNT,
  KpiType.CONTROL_IMPLEMENTATION_RATE,
  KpiType.CONTROL_EFFECTIVENESS_AVG,
  KpiType.EVIDENCE_FRESHNESS_RATE,
  KpiType.EVIDENCE_COVERAGE,
];

/**
 * Check if a KPI type is auto-calculated
 */
function isAutoCalculatedKpi(kpiType: KpiType): boolean {
  return AUTO_CALCULATED_KPI_TYPES.includes(kpiType);
}

/**
 * Story 3.4: Calculate KPI value based on linked entities
 *
 * @param db - Prisma database client
 * @param objectiveId - The objective ID to calculate KPI for
 * @param kpiType - The KPI type to calculate
 * @returns The calculated current value
 */
async function calculateAutoKpiValue(
  db: DbClient,
  objectiveId: string,
  kpiType: KpiType
): Promise<number> {
  switch (kpiType) {
    // AC1: RISK_REMEDIATION_RATE = (CLOSED risks / total) * 100
    case KpiType.RISK_REMEDIATION_RATE: {
      const linkedRisks = await db.risk.findMany({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
        },
        select: { status: true },
      });

      if (linkedRisks.length === 0) return 0;

      const closedCount = linkedRisks.filter(
        (r) => r.status === RiskStatus.CLOSED || r.status === RiskStatus.REMEDIATED
      ).length;

      return Math.round((closedCount / linkedRisks.length) * 100);
    }

    // AC2: RISK_OPEN_COUNT = count of OPEN risks
    case KpiType.RISK_OPEN_COUNT: {
      const openCount = await db.risk.count({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
          status: { in: [RiskStatus.OPEN, RiskStatus.ASSIGNED] },
        },
      });

      return openCount;
    }

    // AC3: HIGH_SEVERITY_RISK_COUNT = count of HIGH severity risks
    case KpiType.HIGH_SEVERITY_RISK_COUNT: {
      const highSeverityCount = await db.risk.count({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
          severity: Severity.HIGH,
        },
      });

      return highSeverityCount;
    }

    // AC4: CONTROL_IMPLEMENTATION_RATE = (ACTIVE controls / total) * 100
    case KpiType.CONTROL_IMPLEMENTATION_RATE: {
      const linkedControls = await db.organizationalControl.findMany({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
        },
        select: { status: true },
      });

      if (linkedControls.length === 0) return 0;

      const implementedCount = linkedControls.filter(
        (c) => c.status === OrgControlStatus.IMPLEMENTED
      ).length;

      return Math.round((implementedCount / linkedControls.length) * 100);
    }

    // AC5: CONTROL_EFFECTIVENESS_AVG = average effectiveness score
    // Note: OrganizationalControl doesn't have effectivenessScore field yet
    // Returns 0 until that field is added to the schema
    case KpiType.CONTROL_EFFECTIVENESS_AVG: {
      // Placeholder - returns 0 as effectivenessScore field doesn't exist
      // When added, calculation would be: avg(effectivenessScore) across linked controls
      return 0;
    }

    // AC6: EVIDENCE_FRESHNESS_RATE = (evidence within 90 days / total) * 100
    case KpiType.EVIDENCE_FRESHNESS_RATE: {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const linkedEvidence = await db.evidence.findMany({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
          isActive: true,
        },
        select: { createdAt: true },
      });

      if (linkedEvidence.length === 0) return 0;

      const freshCount = linkedEvidence.filter(
        (e) => e.createdAt >= ninetyDaysAgo
      ).length;

      return Math.round((freshCount / linkedEvidence.length) * 100);
    }

    // AC7: EVIDENCE_COVERAGE = (unique control domains with evidence / total domains) * 100
    case KpiType.EVIDENCE_COVERAGE: {
      // Get all active control domains
      const totalDomains = await db.controlDomain.count({
        where: { isActive: true },
      });

      if (totalDomains === 0) return 0;

      // Get unique control domains covered by linked evidence
      const linkedEvidenceWithDomains = await db.evidence.findMany({
        where: {
          linkedObjectives: { some: { id: objectiveId } },
          isActive: true,
        },
        select: {
          EvidenceControlDomain: {
            select: { controlDomainId: true },
          },
        },
      });

      const coveredDomainIds = new Set<string>();
      for (const evidence of linkedEvidenceWithDomains) {
        for (const ecd of evidence.EvidenceControlDomain) {
          coveredDomainIds.add(ecd.controlDomainId);
        }
      }

      return Math.round((coveredDomainIds.size / totalDomains) * 100);
    }

    default:
      // Manual KPI types - return 0 (should not be called for manual types)
      return 0;
  }
}

// =============================================================================
// Router
// =============================================================================

export const objectiveRouter = createTRPCRouter({
  /**
   * Create a new objective within a goal
   *
   * AC1: Create objective with auto-generated sortOrder
   * AC1: Status defaults to NOT_STARTED if not provided
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  create: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(createObjectiveSchema)
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

      // Validate KPI value if provided
      const kpiType = input.kpiType ?? KpiType.MANUAL_PERCENTAGE;
      const validation = validateKpiValue(kpiType, input.currentValue);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message,
        });
      }

      // Verify assignees belong to the same organization
      if (input.assigneeIds && input.assigneeIds.length > 0) {
        const validAssignees = await ctx.db.user.findMany({
          where: {
            id: { in: input.assigneeIds },
            organizationId: ctx.organizationId!,
          },
          select: { id: true },
        });

        if (validAssignees.length !== input.assigneeIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more assignees are not valid users in your organization",
          });
        }
      }

      // Get the next sortOrder value for this goal
      const maxSortOrder = await ctx.db.objective.aggregate({
        where: { goalId: input.goalId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      const objectiveId = randomUUID();
      const objective = await ctx.db.$transaction(async (tx) => {
        // Create the objective
        const newObjective = await tx.objective.create({
          data: {
            id: objectiveId,
            goalId: input.goalId,
            title: input.title,
            description: input.description ?? null,
            status: input.status ?? ObjectiveStatus.NOT_STARTED,
            dueDate: input.dueDate ?? null,
            sortOrder: nextSortOrder,
            kpiType: kpiType,
            targetValue: input.targetValue ?? null,
            currentValue: input.currentValue ?? 0,
            createdById: ctx.session!.user.id,
            assignees: input.assigneeIds
              ? {
                  create: input.assigneeIds.map((userId) => ({
                    userId,
                  })),
                }
              : undefined,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
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
        });

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_CREATED,
            entityType: "Objective",
            entityId: objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              title: input.title,
              goalId: input.goalId,
              goalTitle: goal.title,
              kpiType: kpiType,
              targetValue: input.targetValue,
              sortOrder: nextSortOrder,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC6: Create history record for CREATE operation
        await tx.objectiveHistory.create({
          data: {
            objectiveId: objectiveId,
            changeType: ChangeType.CREATE,
            changedFields: buildCreateChangedFields(
              extractObjectiveFields({
                title: newObjective.title,
                description: newObjective.description,
                status: newObjective.status,
                sortOrder: newObjective.sortOrder,
                dueDate: newObjective.dueDate,
                kpiType: newObjective.kpiType,
                targetValue: newObjective.targetValue,
                currentValue: newObjective.currentValue,
                createdById: newObjective.createdById,
                goalId: newObjective.goalId,
              })
            ) as object,
            changedById: ctx.session!.user.id,
          },
        });

        return newObjective;
      });

      // Calculate progress for response
      const progress = calculateObjectiveProgress(
        objective.kpiType,
        objective.currentValue,
        objective.targetValue
      );

      return {
        ...objective,
        progress,
        assignees: objective.assignees.map((a) => a.user),
      };
    }),

  /**
   * Get an objective by ID
   *
   * Includes calculated progress percentage
   *
   * @requires Any authenticated user in the organization
   */
  getById: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.id,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              strategyId: true,
              strategy: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
          // Story 3.5: Include linked entities for display
          linkedRisks: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          },
          linkedControls: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          linkedEvidence: {
            select: {
              id: true,
              title: true,
              createdAt: true,
              fileType: true,
            },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }

      // Story 6.1 AC6: IT_STAKEHOLDER can only view objectives where they are assigned
      const userRole = ctx.session!.user.role as UserRole;
      if (userRole === UserRole.IT_STAKEHOLDER) {
        const isAssigned = objective.assignees.some(
          (a) => a.user.id === ctx.session!.user.id
        );
        if (!isAssigned) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only view objectives you are assigned to",
          });
        }
      }

      // Calculate progress
      const progress = calculateObjectiveProgress(
        objective.kpiType,
        objective.currentValue,
        objective.targetValue
      );

      return {
        ...objective,
        progress,
        assignees: objective.assignees.map((a) => a.user),
      };
    }),

  /**
   * Update an objective
   *
   * AC3: Validates currentValue based on KPI type
   * - MANUAL_PERCENTAGE: 0-100
   * - MANUAL_BOOLEAN: 0 or 1
   *
   * @requires CISO, GRC_ANALYST, ORG_ADMIN, or SECURITY_ENGINEER (if assigned)
   */
  update: organizationProcedure
    .use(requireRole(OBJECTIVE_UPDATE_ROLES))
    .input(updateObjectiveSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and get its details
      const existingObjective = await ctx.db.objective.findFirst({
        where: {
          id: input.id,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        include: {
          assignees: {
            select: { userId: true },
          },
        },
      });

      if (!existingObjective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // For SECURITY_ENGINEER, verify they are assigned to this objective (FR59)
      const userRole = ctx.session!.user.role as UserRole;
      if (userRole === UserRole.SECURITY_ENGINEER) {
        const isAssigned = existingObjective.assignees.some(
          (a) => a.userId === ctx.session!.user.id
        );
        if (!isAssigned) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only update objectives you are assigned to",
          });
        }

        // SECURITY_ENGINEER cannot change assignees (AC3 in Story 2.3)
        if (input.assigneeIds !== undefined) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to change assignees",
          });
        }
      }

      // Determine the KPI type to use for validation
      const kpiType = input.kpiType ?? existingObjective.kpiType;

      // Validate KPI value
      const validation = validateKpiValue(kpiType, input.currentValue);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message,
        });
      }

      // Verify new assignees belong to the same organization
      if (input.assigneeIds !== undefined && input.assigneeIds.length > 0) {
        const validAssignees = await ctx.db.user.findMany({
          where: {
            id: { in: input.assigneeIds },
            organizationId: ctx.organizationId!,
          },
          select: { id: true },
        });

        if (validAssignees.length !== input.assigneeIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more assignees are not valid users in your organization",
          });
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
      if (input.kpiType !== undefined) updateData.kpiType = input.kpiType;
      if (input.targetValue !== undefined)
        updateData.targetValue = input.targetValue;
      if (input.currentValue !== undefined)
        updateData.currentValue = input.currentValue;

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      const objective = await ctx.db.$transaction(async (tx) => {
        // Update assignees: delete all existing and create new ones
        if (input.assigneeIds !== undefined) {
          await tx.objectiveAssignee.deleteMany({
            where: { objectiveId: input.id },
          });

          if (input.assigneeIds.length > 0) {
            await tx.objectiveAssignee.createMany({
              data: input.assigneeIds.map((userId) => ({
                objectiveId: input.id,
                userId,
              })),
            });
          }
        }

        // Update the objective
        const updatedObjective = await tx.objective.update({
          where: { id: input.id },
          data: updateData,
          include: {
            goal: {
              select: {
                id: true,
                title: true,
                strategyId: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
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
        });

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_UPDATED,
            entityType: "Objective",
            entityId: input.id,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              title: updatedObjective.title,
              goalId: updatedObjective.goalId,
              changedFields: Object.keys(updateData),
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Story 4.2 AC6: Create history record for UPDATE operation
        const changedFields = buildUpdateChangedFields(
          extractObjectiveFields({
            title: existingObjective.title,
            description: existingObjective.description,
            status: existingObjective.status,
            sortOrder: existingObjective.sortOrder,
            dueDate: existingObjective.dueDate,
            kpiType: existingObjective.kpiType,
            targetValue: existingObjective.targetValue,
            currentValue: existingObjective.currentValue,
            createdById: existingObjective.createdById,
            goalId: existingObjective.goalId,
          }),
          extractObjectiveFields({
            title: updatedObjective.title,
            description: updatedObjective.description,
            status: updatedObjective.status,
            sortOrder: updatedObjective.sortOrder,
            dueDate: updatedObjective.dueDate,
            kpiType: updatedObjective.kpiType,
            targetValue: updatedObjective.targetValue,
            currentValue: updatedObjective.currentValue,
            createdById: updatedObjective.createdById,
            goalId: updatedObjective.goalId,
          })
        );

        // Only create history if fields actually changed
        if (Object.keys(changedFields).length > 0) {
          await tx.objectiveHistory.create({
            data: {
              objectiveId: input.id,
              changeType: ChangeType.UPDATE,
              changedFields: changedFields as object,
              changedById: ctx.session!.user.id,
            },
          });
        }

        return updatedObjective;
      });

      // Calculate progress
      const progress = calculateObjectiveProgress(
        objective.kpiType,
        objective.currentValue,
        objective.targetValue
      );

      return {
        ...objective,
        progress,
        assignees: objective.assignees.map((a) => a.user),
      };
    }),

  /**
   * Delete an objective
   *
   * AC4: Objective is deleted
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  delete: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(deleteObjectiveSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and get full data for history
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.id,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Story 6.3 AC3: Wrap mutation + audit + history in transaction for atomicity
      await ctx.db.$transaction(async (tx) => {
        // Story 4.2 AC6: Create history record BEFORE the delete
        await tx.objectiveHistory.create({
          data: {
            objectiveId: input.id,
            changeType: ChangeType.DELETE,
            changedFields: buildDeleteChangedFields(
              extractObjectiveFields({
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
              })
            ) as object,
            changedById: ctx.session!.user.id,
          },
        });

        // Create audit log entry before deletion
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_DELETED,
            entityType: "Objective",
            entityId: input.id,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              title: objective.title,
              goalId: objective.goalId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });

        // Delete the objective (cascade deletes assignees)
        await tx.objective.delete({
          where: { id: input.id },
        });
      });

      return { success: true, id: input.id };
    }),

  /**
   * Reorder objectives within a goal
   *
   * AC2: Objectives are reordered according to provided sort orders
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  reorder: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(reorderObjectivesSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the goal exists
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

      // Update all objective sort orders
      await Promise.all(
        input.objectiveOrders.map((order) =>
          ctx.db.objective.update({
            where: { id: order.id },
            data: { sortOrder: order.sortOrder },
          })
        )
      );

      // Create audit log entry
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          action: AuditAction.OBJECTIVE_REORDERED,
          entityType: "Goal",
          entityId: input.goalId,
          userId: ctx.session!.user.id,
          organizationId: ctx.organizationId!,
          changes: {
            goalTitle: goal.title,
            objectiveOrders: input.objectiveOrders,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      // Return the reordered objectives
      const objectives = await ctx.db.objective.findMany({
        where: { goalId: input.goalId },
        orderBy: { sortOrder: "asc" },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
      });

      return objectives.map((obj) => ({
        ...obj,
        progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
        assignees: obj.assignees.map((a) => a.user),
      }));
    }),

  /**
   * List objectives for a goal
   *
   * @requires Any authenticated user in the organization
   */
  listByGoal: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(listByGoalSchema)
    .query(async ({ ctx, input }) => {
      // Verify the goal exists
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

      // Story 6.1 AC6: IT_STAKEHOLDER can only see objectives where they are assigned
      const userRole = ctx.session!.user.role as UserRole;
      const whereClause: Record<string, unknown> = { goalId: input.goalId };

      if (userRole === UserRole.IT_STAKEHOLDER) {
        whereClause.assignees = {
          some: { userId: ctx.session!.user.id },
        };
      }

      const objectives = await ctx.db.objective.findMany({
        where: whereClause,
        orderBy: { sortOrder: "asc" },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
      });

      return objectives.map((obj) => ({
        ...obj,
        progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
        assignees: obj.assignees.map((a) => a.user),
      }));
    }),

  /**
   * List objectives assigned to the current user
   *
   * Story 2.3 AC4: IT_STAKEHOLDER can view only objectives where they are an assignee
   *
   * Returns all objectives where the current user is an assignee,
   * with goal and strategy context for navigation.
   *
   * @requires Any authenticated user in the organization
   */
  listMyAssignments: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(
      z.object({
        status: z.nativeEnum(ObjectiveStatus).optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;

      // Build where clause
      const whereClause: {
        assignees: { some: { userId: string } };
        goal: { strategy: { organizationId: string } };
        status?: ObjectiveStatus;
      } = {
        assignees: {
          some: {
            userId: userId,
          },
        },
        goal: {
          strategy: {
            organizationId: ctx.organizationId!,
          },
        },
      };

      if (input.status) {
        whereClause.status = input.status;
      }

      // Get total count for pagination
      const total = await ctx.db.objective.count({
        where: whereClause,
      });

      // Get assigned objectives with full context
      const objectives = await ctx.db.objective.findMany({
        where: whereClause,
        orderBy: [
          { dueDate: "asc" },
          { sortOrder: "asc" },
        ],
        skip: input.offset,
        take: input.limit,
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
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
      });

      return {
        objectives: objectives.map((obj) => ({
          ...obj,
          progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
          assignees: obj.assignees.map((a) => a.user),
        })),
        total,
        hasMore: input.offset + objectives.length < total,
      };
    }),

  /**
   * Add a comment to an objective
   *
   * Story 2.4 AC3: Create a comment linked to an objective
   * AC3: Comment includes content, authorId, createdAt
   * Story 6.1 AC2: AUDITOR cannot add comments (read-only access)
   *
   * @requires Any authenticated org user except AUDITOR
   */
  addComment: organizationProcedure
    .use(requireRole(OBJECTIVE_COMMENT_ROLES))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Create the comment
      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          authorId: ctx.session!.user.id,
          objectiveId: input.objectiveId,
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

  // ===========================================================================
  // Story 3.2: Entity Linking API
  // ===========================================================================

  /**
   * Link a Risk to an Objective
   *
   * Story 3.2 AC1: Link operation is atomic
   * Story 3.2 AC7: Returns 403 if Risk is from different organization
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  linkRisk: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkRiskSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // AC7: Verify the Risk belongs to the same organization
      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, title: true },
      });

      if (!risk) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Risk not found or belongs to a different organization",
        });
      }

      // AC1: Link the Risk to the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedRisks: {
              connect: { id: input.riskId },
            },
          },
        });

        // Story 3.2: Audit log for entity linking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_RISK_LINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "LINK_RISK",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              riskId: input.riskId,
              riskTitle: risk.title,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, riskId: input.riskId };
    }),

  /**
   * Unlink a Risk from an Objective
   *
   * Story 3.2 AC2: Risk is unlinked from the Objective
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  unlinkRisk: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkRiskSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Unlink the Risk from the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedRisks: {
              disconnect: { id: input.riskId },
            },
          },
        });

        // Story 3.2: Audit log for entity unlinking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_RISK_UNLINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "UNLINK_RISK",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              riskId: input.riskId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, riskId: input.riskId };
    }),

  /**
   * Link a Control (OrganizationalControl) to an Objective
   *
   * Story 3.2 AC3: Control is linked to the Objective
   * Story 3.2 AC7: Returns 403 if Control is from different organization
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  linkControl: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkControlSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // AC7: Verify the Control belongs to the same organization
      const control = await ctx.db.organizationalControl.findFirst({
        where: {
          id: input.controlId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, name: true },
      });

      if (!control) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Control not found or belongs to a different organization",
        });
      }

      // AC3: Link the Control to the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedControls: {
              connect: { id: input.controlId },
            },
          },
        });

        // Story 3.2: Audit log for entity linking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_CONTROL_LINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "LINK_CONTROL",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              controlId: input.controlId,
              controlName: control.name,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, controlId: input.controlId };
    }),

  /**
   * Unlink a Control from an Objective
   *
   * Story 3.2 AC4: Control is unlinked from the Objective
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  unlinkControl: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkControlSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Unlink the Control from the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedControls: {
              disconnect: { id: input.controlId },
            },
          },
        });

        // Story 3.2: Audit log for entity unlinking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_CONTROL_UNLINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "UNLINK_CONTROL",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              controlId: input.controlId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, controlId: input.controlId };
    }),

  /**
   * Link Evidence to an Objective
   *
   * Story 3.2 AC5: Evidence is linked to the Objective
   * Story 3.2 AC7: Returns 403 if Evidence is from different organization
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  linkEvidence: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkEvidenceSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // AC7: Verify the Evidence belongs to the same organization
      const evidence = await ctx.db.evidence.findFirst({
        where: {
          id: input.evidenceId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, title: true },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Evidence not found or belongs to a different organization",
        });
      }

      // AC5: Link the Evidence to the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedEvidence: {
              connect: { id: input.evidenceId },
            },
          },
        });

        // Story 3.2: Audit log for entity linking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_EVIDENCE_LINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "LINK_EVIDENCE",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              evidenceId: input.evidenceId,
              evidenceTitle: evidence.title,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, evidenceId: input.evidenceId };
    }),

  /**
   * Unlink Evidence from an Objective
   *
   * Story 3.2 AC6: Evidence is unlinked from the Objective
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  unlinkEvidence: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(linkEvidenceSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Unlink the Evidence from the Objective with audit logging
      await ctx.db.$transaction(async (tx) => {
        await tx.objective.update({
          where: { id: input.objectiveId },
          data: {
            linkedEvidence: {
              disconnect: { id: input.evidenceId },
            },
          },
        });

        // Story 3.2: Audit log for entity unlinking
        await tx.auditLog.create({
          data: {
            id: randomUUID(),
            action: AuditAction.OBJECTIVE_EVIDENCE_UNLINKED,
            entityType: "Objective",
            entityId: input.objectiveId,
            userId: ctx.session!.user.id,
            organizationId: ctx.organizationId!,
            changes: {
              action: "UNLINK_EVIDENCE",
              objectiveId: input.objectiveId,
              objectiveTitle: objective.title,
              evidenceId: input.evidenceId,
            },
            actorName: ctx.session!.user.name,
            actorRole: ctx.session!.user.role,
          },
        });
      });

      return { success: true, objectiveId: input.objectiveId, evidenceId: input.evidenceId };
    }),

  // ===========================================================================
  // Story 3.3: Entity Search for Linking
  // ===========================================================================

  /**
   * Search Risks to link to an Objective
   *
   * Story 3.3 AC1: Search by title or description (case-insensitive)
   * Story 3.3 AC4: Limited to 20 results
   * Story 3.3 AC5: Mark already-linked entities
   *
   * @requires Any authenticated user who can view objectives
   */
  searchRisks: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(searchEntitiesSchema)
    .query(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.objectiveId,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        select: {
          id: true,
          linkedRisks: {
            select: { id: true },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Get already linked risk IDs for AC5
      const linkedRiskIds = new Set(objective.linkedRisks.map((r) => r.id));

      // AC1: Search Risks by title or description (case-insensitive)
      const risks = await ctx.db.risk.findMany({
        where: {
          organizationId: ctx.organizationId!,
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
      });

      // AC5: Mark already-linked entities
      return risks.map((risk) => ({
        ...risk,
        isLinked: linkedRiskIds.has(risk.id),
      }));
    }),

  /**
   * Search Controls (OrganizationalControls) to link to an Objective
   *
   * Story 3.3 AC2: Search by name or description
   * Story 3.3 AC4: Limited to 20 results
   * Story 3.3 AC5: Mark already-linked entities
   *
   * @requires Any authenticated user who can view objectives
   */
  searchControls: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(searchEntitiesSchema)
    .query(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.objectiveId,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        select: {
          id: true,
          linkedControls: {
            select: { id: true },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Get already linked control IDs for AC5
      const linkedControlIds = new Set(objective.linkedControls.map((c) => c.id));

      // AC2: Search Controls by name or description (case-insensitive)
      const controls = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
      });

      // AC5: Mark already-linked entities and format response.
      // Note: framework mapping is now a many-to-many junction
      // (OrgControlFrameworkMapping). Omitted here until next sprint.
      return controls.map((control) => ({
        id: control.id,
        name: control.name,
        status: control.status,
        framework: null,
        isLinked: linkedControlIds.has(control.id),
      }));
    }),

  /**
   * Search Evidence to link to an Objective
   *
   * Story 3.3 AC3: Search by title or description
   * Story 3.3 AC4: Limited to 20 results
   * Story 3.3 AC5: Mark already-linked entities
   *
   * @requires Any authenticated user who can view objectives
   */
  searchEvidence: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(searchEntitiesSchema)
    .query(async ({ ctx, input }) => {
      // Verify the objective exists and belongs to user's organization
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.objectiveId,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        select: {
          id: true,
          linkedEvidence: {
            select: { id: true },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Get already linked evidence IDs for AC5
      const linkedEvidenceIds = new Set(objective.linkedEvidence.map((e) => e.id));

      // AC3: Search Evidence by title or description (case-insensitive)
      const evidence = await ctx.db.evidence.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          EvidenceControlDomain: {
            select: {
              ControlDomain: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
            take: 1, // Get primary control domain
          },
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });

      // AC5: Mark already-linked entities and format response
      return evidence.map((e) => ({
        id: e.id,
        title: e.title,
        uploadedAt: e.createdAt,
        controlDomain: e.EvidenceControlDomain[0]?.ControlDomain ?? null,
        isLinked: linkedEvidenceIds.has(e.id),
      }));
    }),

  // ===========================================================================
  // Story 3.4: Auto-Calculated KPI Engine
  // ===========================================================================

  /**
   * Calculate and update KPI value for an objective
   *
   * Story 3.4 AC8: Computes currentValue from linked entities and updates database
   *
   * For auto-calculated KPI types:
   * - AC1: RISK_REMEDIATION_RATE = (CLOSED/REMEDIATED risks / total) * 100
   * - AC2: RISK_OPEN_COUNT = count of OPEN/ASSIGNED risks
   * - AC3: HIGH_SEVERITY_RISK_COUNT = count of HIGH severity risks
   * - AC4: CONTROL_IMPLEMENTATION_RATE = (ACTIVE controls / total) * 100
   * - AC5: CONTROL_EFFECTIVENESS_AVG = average effectiveness (placeholder)
   * - AC6: EVIDENCE_FRESHNESS_RATE = (evidence < 90 days / total) * 100
   * - AC7: EVIDENCE_COVERAGE = (domains with evidence / total domains) * 100
   *
   * @requires CISO, GRC_ANALYST, or ORG_ADMIN role
   */
  calculateKpi: organizationProcedure
    .use(requireRole(OBJECTIVE_MANAGE_ROLES))
    .input(
      z.object({
        objectiveId: z.string().min(1, "Objective ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the objective exists and get its KPI type
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.objectiveId,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        select: {
          id: true,
          title: true,
          kpiType: true,
          targetValue: true,
          currentValue: true,
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      // Check if this is an auto-calculated KPI type
      if (!isAutoCalculatedKpi(objective.kpiType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `KPI type ${objective.kpiType} is not auto-calculated. Use update to set manual values.`,
        });
      }

      // Calculate the new value
      const calculatedValue = await calculateAutoKpiValue(
        ctx.db,
        input.objectiveId,
        objective.kpiType
      );

      // Update the objective with the new value
      const updatedObjective = await ctx.db.objective.update({
        where: { id: input.objectiveId },
        data: { currentValue: calculatedValue },
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              strategyId: true,
            },
          },
        },
      });

      // Calculate progress for response
      const progress = calculateObjectiveProgress(
        updatedObjective.kpiType,
        calculatedValue,
        updatedObjective.targetValue
      );

      return {
        id: updatedObjective.id,
        title: updatedObjective.title,
        kpiType: updatedObjective.kpiType,
        previousValue: objective.currentValue,
        currentValue: calculatedValue,
        targetValue: updatedObjective.targetValue,
        progress,
      };
    }),

  /**
   * Get linked entity counts for an objective
   *
   * Useful for displaying link statistics without full entity data
   *
   * @requires Any authenticated user who can view objectives
   */
  getLinkedEntityCounts: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(
      z.object({
        objectiveId: z.string().min(1, "Objective ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify the objective exists
      const objective = await ctx.db.objective.findFirst({
        where: {
          id: input.objectiveId,
          goal: {
            strategy: {
              organizationId: ctx.organizationId!,
            },
          },
        },
        select: {
          id: true,
          _count: {
            select: {
              linkedRisks: true,
              linkedControls: true,
              linkedEvidence: true,
            },
          },
        },
      });

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found or access denied",
        });
      }

      return {
        objectiveId: objective.id,
        risks: objective._count.linkedRisks,
        controls: objective._count.linkedControls,
        evidence: objective._count.linkedEvidence,
        total:
          objective._count.linkedRisks +
          objective._count.linkedControls +
          objective._count.linkedEvidence,
      };
    }),

  /**
   * Get objectives linked to a specific entity (Risk, Control, or Evidence)
   *
   * Story 3.5 AC6-AC8: Bidirectional display - show objectives on entity detail pages
   *
   * @requires Any authenticated user who can view objectives
   */
  getLinkedToEntity: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(
      z.object({
        entityType: z.enum(["risk", "control", "evidence"]),
        entityId: z.string().min(1, "Entity ID is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build the where clause based on entity type
      const whereClause: {
        goal: { strategy: { organizationId: string } };
        linkedRisks?: { some: { id: string } };
        linkedControls?: { some: { id: string } };
        linkedEvidence?: { some: { id: string } };
      } = {
        goal: {
          strategy: {
            organizationId: ctx.organizationId!,
          },
        },
      };

      switch (input.entityType) {
        case "risk":
          whereClause.linkedRisks = { some: { id: input.entityId } };
          break;
        case "control":
          whereClause.linkedControls = { some: { id: input.entityId } };
          break;
        case "evidence":
          whereClause.linkedEvidence = { some: { id: input.entityId } };
          break;
      }

      const objectives = await ctx.db.objective.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          status: true,
          kpiType: true,
          currentValue: true,
          targetValue: true,
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
        },
        orderBy: { updatedAt: "desc" },
      });

      // Calculate progress for each objective
      return {
        objectives: objectives.map((obj) => ({
          ...obj,
          progress: calculateObjectiveProgress(obj.kpiType, obj.currentValue, obj.targetValue),
        })),
      };
    }),

  /**
   * Get history for an objective
   *
   * Story 4.5 AC3: Paginated history ordered by changedAt descending
   * Returns changeType, changedFields, changedBy, changedAt
   *
   * @requires Any authenticated user who can view objectives
   */
  getHistory: organizationProcedure
    .use(requireRole(OBJECTIVE_VIEW_ROLES))
    .input(
      z.object({
        objectiveId: z.string().min(1, "Objective ID is required"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify objective exists and belongs to organization
      const objective = await verifyObjectiveAccess(
        ctx.db,
        input.objectiveId,
        ctx.organizationId!
      );

      if (!objective) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Objective not found",
        });
      }

      // Fetch paginated history records
      const [history, total] = await Promise.all([
        ctx.db.objectiveHistory.findMany({
          where: { objectiveId: input.objectiveId },
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
        ctx.db.objectiveHistory.count({
          where: { objectiveId: input.objectiveId },
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
