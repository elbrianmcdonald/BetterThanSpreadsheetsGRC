/**
 * Risk Assessment Project tRPC Router
 *
 * Container-based risk discovery workflow where analysts create assessment
 * "containers" for subjects, discover multiple risks, and submit for manager
 * approval before publishing to the risk register.
 *
 * @see docs/epics-risk-assessment-project.md - Epic 1 Story 1.1
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AssessmentProjectStatus, AuditAction, Prisma, UserRole } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
} from "@/server/api/trpc";
import {
  emitAssignmentNotification,
  emitSubmittedNotification,
  emitApprovedNotification,
  emitRejectedNotification,
} from "@/lib/notifications";
import { generateIdentifier } from "@/server/services/identifierService";
import { normalizeLayout } from "@/components/deliverable/execSummaryLayout";

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Schema for creating a new risk assessment project
 */
const createProjectSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500, "Subject too long"),
  description: z.string().max(5000).optional(),
  dueDate: z.date(),
  assignToSelf: z.boolean().default(true),
  matrixVersionId: z.string().min(1, "Risk matrix is required"),
});

/**
 * Schema for listing assessment projects with pagination and filters
 */
const listProjectsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  status: z.nativeEnum(AssessmentProjectStatus).optional(),
  assigneeId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  tab: z.enum(["all", "my", "backlog", "reassessment"]).optional(),
  sortBy: z.enum(["dueDate", "createdAt", "subject"]).default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * Schema for getting a single assessment project by ID
 */
const getByIdSchema = z.object({
  id: z.string(),
});

// =============================================================================
// Router Definition
// =============================================================================

export const riskAssessmentProjectRouter = createTRPCRouter({
  /**
   * List assessment projects with pagination and filtering
   *
   * All users can view all assessments in their organization (FR5)
   * Supports filtering by status, assignee, date range (FR6)
   * Supports search by subject text (FR7)
   */
  list: organizationProcedure
    .input(listProjectsSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        status,
        assigneeId,
        search,
        dateFrom,
        dateTo,
        tab,
        sortBy,
        sortOrder,
      } = input;

      // Build where clause based on filters
      const whereClause: Prisma.RiskAssessmentProjectWhereInput = {
        organizationId: ctx.organizationId,
      };

      // Tab-specific filters
      if (tab === "my") {
        whereClause.assigneeId = ctx.session.user.id;
      } else if (tab === "backlog") {
        whereClause.assigneeId = null;
        // Only show IN_PROGRESS assessments in backlog
        whereClause.status = AssessmentProjectStatus.IN_PROGRESS;
      } else if (tab === "reassessment") {
        // Show assessments due for reassessment (within 30 days or overdue)
        whereClause.status = AssessmentProjectStatus.APPROVED;
        whereClause.reassessmentDueDate = {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        };
      }

      // Additional filters (can be combined with tabs)
      if (status && tab !== "backlog" && tab !== "reassessment") {
        whereClause.status = status;
      }

      if (assigneeId && tab !== "my" && tab !== "backlog") {
        whereClause.assigneeId = assigneeId;
      }

      if (search) {
        whereClause.subject = {
          contains: search,
          mode: "insensitive",
        };
      }

      if (dateFrom || dateTo) {
        whereClause.dueDate = {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        };
      }

      // For reassessment tab, sort by reassessmentDueDate (soonest first)
      const orderByField = tab === "reassessment" ? "reassessmentDueDate" : sortBy;
      const orderByDirection = tab === "reassessment" ? "asc" : sortOrder;

      // Execute queries in parallel
      const [items, total] = await Promise.all([
        ctx.db.riskAssessmentProject.findMany({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [orderByField]: orderByDirection },
          include: {
            assignee: {
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
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                discoveredRisks: true,
              },
            },
          },
        }),
        ctx.db.riskAssessmentProject.count({ where: whereClause }),
      ]);

      return {
        items: items.map((item) => ({
          ...item,
          riskCount: item._count.discoveredRisks,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get a single assessment project by ID
   *
   * Returns the assessment with all relations including discovered risks
   */
  getById: organizationProcedure
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignee: {
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
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          riskOwner: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
            },
          },
          parentAssessment: {
            select: {
              id: true,
              subject: true,
              status: true,
              reviewedAt: true,
            },
          },
          childAssessments: {
            select: {
              id: true,
              subject: true,
              status: true,
              createdAt: true,
            },
          },
          matrixVersion: {
            select: {
              id: true,
              versionNumber: true,
              scales: true,
              thresholds: true,
              template: {
                select: {
                  id: true,
                  name: true,
                  dimensionCount: true,
                  outputScaleMax: true,
                  gridSize: true,
                },
              },
            },
          },
          linkedAsset: { select: { id: true, identifier: true, name: true } },
          linkedBusinessProcess: { select: { id: true, identifier: true, name: true } },
          discoveredRisks: {
            where: {
              // Only include non-soft-deleted risks
              // Note: If soft-delete is implemented via a field, add filter here
            },
            select: {
              id: true,
              title: true,
              description: true,
              severity: true,
              discoveryStatus: true,
              affectedSystems: true,
              // Scoring fields for matrix-based assessment
              inherentLikelihood: true,
              inherentImpact: true,
              inherentExposure: true,
              residualLikelihood: true,
              residualImpact: true,
              residualExposure: true,
              inherentScore: true,
              residualScore: true,
              // Treatment relation
              Treatments: {
                select: {
                  id: true,
                  treatmentType: true,
                  dueDate: true,
                  completedAt: true,
                  detail: true,
                },
                take: 1,
                orderBy: { decidedAt: "desc" },
              },
              // MITRE mapping
              initialAccessVectorId: true,
              InitialAccessVector: { select: { id: true, name: true } },
              ThreatSteps: { select: { id: true, techniqueId: true, technique: { select: { id: true, name: true } } } },
              ThreatObjectives: { select: { id: true, techniqueId: true, technique: { select: { id: true, name: true } } } },
              // Control links
              ControlLinks: {
                select: {
                  id: true,
                  controlId: true,
                  linkType: true,
                  control: {
                    select: {
                      id: true,
                      controlId: true,
                      title: true,
                      Framework: { select: { id: true, code: true, name: true } },
                    },
                  },
                },
              },
              // Enterprise risk alignment + acceptance fields
              enterpriseRiskId: true,
              acceptanceJustification: true,
              acceptedById: true,
              acceptedAt: true,
              acceptanceReviewDate: true,
              acceptanceCompensatingControls: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      return project;
    }),

  /**
   * Create a new risk assessment project
   *
   * - Creator is auto-assigned unless they explicitly create for backlog (FR3, FR4)
   * - Status defaults to IN_PROGRESS
   */
  create: organizationProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const { subject, description, dueDate, assignToSelf, matrixVersionId } = input;

      // Validate due date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Due date cannot be in the past",
        });
      }

      // Validate matrix version exists and is published
      const matrixVersion = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: matrixVersionId,
          isActive: true,
          publishedAt: { not: null },
        },
      });
      if (!matrixVersion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected risk matrix is not available",
        });
      }

      const newProject = await ctx.db.riskAssessmentProject.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          subject,
          description,
          dueDate,
          assigneeId: assignToSelf ? ctx.session.user.id : null,
          createdById: ctx.session.user.id,
          status: AssessmentProjectStatus.IN_PROGRESS,
          matrixVersionId,
        },
        include: {
          assignee: {
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
        },
      });

      // Log the creation in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_CREATED,
          entityType: "RiskAssessmentProject",
          entityId: newProject.id,
          changes: {
            action: "CREATE",
            subject,
            dueDate: dueDate.toISOString(),
            assignedToSelf: assignToSelf,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      return newProject;
    }),

  /**
   * Story 3.2: Claim Assessment from Backlog
   *
   * Allows any user to claim an unassigned assessment from the backlog.
   * Handles race conditions where another user claims first.
   */
  claim: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // First, verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Check if already assigned (race condition handling)
      if (assessment.assigneeId !== null) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This assessment has already been claimed",
        });
      }

      // Check user's current assignment count for capacity warning
      const userAssignmentCount = await ctx.db.riskAssessmentProject.count({
        where: {
          assigneeId: ctx.session.user.id,
          status: AssessmentProjectStatus.IN_PROGRESS,
          organizationId: ctx.organizationId,
        },
      });

      // Update the assessment to assign to current user
      const updatedProject = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          assigneeId: ctx.session.user.id,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log the claim in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "CLAIMED",
            previousAssigneeId: null,
            newAssigneeId: ctx.session.user.id,
            claimedFromBacklog: true,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      // Story 3.4: Emit assignment notification
      await emitAssignmentNotification({
        assessmentId: id,
        assessmentSubject: assessment.subject,
        assigneeId: ctx.session.user.id,
        assigneeName: ctx.session.user.name ?? null,
        assignedById: ctx.session.user.id,
        assignedByName: ctx.session.user.name ?? null,
        previousAssigneeId: null,
        organizationId: ctx.organizationId,
      });

      return {
        ...updatedProject,
        userAssignmentCount: userAssignmentCount + 1,
        hasCapacityWarning: userAssignmentCount >= 5,
      };
    }),

  /**
   * Story 3.3: Get assignable users with assignment counts
   *
   * Returns users in the organization who can be assigned to assessments,
   * along with their current in-progress assignment counts.
   */
  getAssignableUsers: organizationProcedure.query(async ({ ctx }) => {
    // Get all users in the organization
    const users = await ctx.db.user.findMany({
      where: {
        organizationId: ctx.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get assignment counts for each user
    const assignmentCounts = await ctx.db.riskAssessmentProject.groupBy({
      by: ["assigneeId"],
      where: {
        organizationId: ctx.organizationId,
        status: AssessmentProjectStatus.IN_PROGRESS,
        assigneeId: { not: null },
      },
      _count: {
        id: true,
      },
    });

    // Map assignment counts to user IDs
    const countMap = new Map(
      assignmentCounts.map((c) => [c.assigneeId, c._count.id])
    );

    return users.map((user) => ({
      ...user,
      assignmentCount: countMap.get(user.id) || 0,
    }));
  }),

  /**
   * Story 3.3: Assign Assessment to User
   *
   * Allows managers/admins to assign or reassign assessments to specific users.
   * Only users with ORG_ADMIN or CISO roles can assign assessments.
   */
  assign: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        assigneeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, assigneeId } = input;

      // Check if user has permission to assign (ORG_ADMIN or CISO)
      const allowedRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
      if (!allowedRoles.includes(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers and admins can assign assessments",
        });
      }

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignee: {
            select: { id: true, name: true },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Verify the target user exists and belongs to this organization
      const targetUser = await ctx.db.user.findFirst({
        where: {
          id: assigneeId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target user not found in this organization",
        });
      }

      // Update the assessment to assign to target user
      const updatedProject = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          assigneeId: targetUser.id,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log the assignment in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "ASSIGNED",
            previousAssigneeId: assessment.assigneeId,
            previousAssigneeName: assessment.assignee?.name || null,
            newAssigneeId: targetUser.id,
            newAssigneeName: targetUser.name,
            assignedBy: ctx.session.user.id,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      // Story 3.4: Emit assignment notification
      await emitAssignmentNotification({
        assessmentId: id,
        assessmentSubject: assessment.subject,
        assigneeId: targetUser.id,
        assigneeName: targetUser.name ?? null,
        assignedById: ctx.session.user.id,
        assignedByName: ctx.session.user.name ?? null,
        previousAssigneeId: assessment.assigneeId,
        previousAssigneeName: assessment.assignee?.name ?? null,
        organizationId: ctx.organizationId,
      });

      return {
        ...updatedProject,
        assigneeName: targetUser.name,
      };
    }),

  /**
   * Update assessment details (description, risk owner)
   *
   * Allows the assigned analyst to update assessment details while in progress.
   * Only editable fields: description, riskOwnerId
   */
  updateDetails: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).optional().nullable(),
        riskOwnerId: z.string().optional().nullable(),
        assigneeId: z.string().optional().nullable(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, subject, description, riskOwnerId, assigneeId, dueDate } = input;

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          status: true,
          assigneeId: true,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Only allow editing if assessment is IN_PROGRESS
      if (assessment.status !== AssessmentProjectStatus.IN_PROGRESS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assessment can only be edited while in progress",
        });
      }

      // Allow ORG_ADMIN OR the assigned worker to edit
      const isAdmin = ctx.session?.user?.role === UserRole.ORG_ADMIN;
      const isAssignee = assessment.assigneeId === ctx.session?.user?.id;
      if (!isAdmin && !isAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned worker or an org admin can edit this assessment",
        });
      }

      // Validate riskOwnerId if provided
      if (riskOwnerId) {
        const person = await ctx.db.person.findFirst({
          where: {
            id: riskOwnerId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
        });
        if (!person) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid risk owner",
          });
        }
      }

      // Validate assigneeId if provided (must be a user in this org)
      if (assigneeId) {
        const user = await ctx.db.user.findFirst({
          where: { id: assigneeId, organizationId: ctx.organizationId },
        });
        if (!user) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assignee — must be a user in your organization",
          });
        }
      }

      // Validate dueDate not in the past
      if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Due date cannot be in the past",
          });
        }
      }

      // Update assessment details
      const updated = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          ...(subject !== undefined && { subject }),
          ...(description !== undefined && { description }),
          ...(riskOwnerId !== undefined && { riskOwnerId }),
          ...(assigneeId !== undefined && { assigneeId }),
          ...(dueDate !== undefined && { dueDate }),
        },
        include: {
          riskOwner: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      return updated;
    }),

  /**
   * Update the executive-summary statement shown atop the assessment's
   * Executive Summary deliverable. Editable by the assigned analyst or an
   * ORG_ADMIN. Unlike updateDetails this is NOT gated to IN_PROGRESS — the
   * executive narrative is typically written at/after completion.
   */
  updateExecutiveStatement: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        executiveStatement: z.string().max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true, assigneeId: true },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment project not found" });
      }

      const isAdmin = ctx.session?.user?.role === UserRole.ORG_ADMIN;
      const isAssignee = assessment.assigneeId === ctx.session?.user?.id;
      if (!isAdmin && !isAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned analyst or an org admin can edit the executive summary",
        });
      }

      return ctx.db.riskAssessmentProject.update({
        where: { id: input.id },
        data: { executiveStatement: input.executiveStatement },
        select: { id: true, executiveStatement: true },
      });
    }),

  /**
   * Update the executive-summary section layout (order + which sections show).
   * Same gating as updateExecutiveStatement (assigned analyst or ORG_ADMIN). The
   * payload is normalized server-side so the stored value is always complete.
   */
  updateExecSummaryLayout: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        layout: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true, assigneeId: true },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment project not found" });
      }

      const isAdmin = ctx.session?.user?.role === UserRole.ORG_ADMIN;
      const isAssignee = assessment.assigneeId === ctx.session?.user?.id;
      if (!isAdmin && !isAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned analyst or an org admin can edit the executive summary",
        });
      }

      const normalized = normalizeLayout("RISK", input.layout);
      const updated = await ctx.db.riskAssessmentProject.update({
        where: { id: input.id },
        data: { execSummaryLayout: normalized as unknown as Prisma.InputJsonValue },
        select: { id: true, execSummaryLayout: true },
      });
      return { id: updated.id, layout: normalized };
    }),

  /**
   * Link an Asset and/or BusinessProcess to the assessment, snapshotting
   * each entity's current loss event range into the assessment record.
   * Re-pick to refresh; pass null/null to clear.
   */
  setLinkedEntities: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        linkedAssetId: z.string().nullable(),
        linkedBusinessProcessId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const project = await ctx.db.riskAssessmentProject.findFirst({
        where: { id: input.id, organizationId },
        select: { id: true, status: true, assigneeId: true },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment project not found" });
      }
      if (project.status !== AssessmentProjectStatus.IN_PROGRESS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Assessment can only be edited while in progress" });
      }
      if (project.assigneeId !== ctx.session?.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned analyst can edit the assessment" });
      }

      // Snapshot loss values from the linked entities (frozen at link time).
      let lossMin: number | null = null;
      let lossProb: number | null = null;
      let lossMax: number | null = null;
      if (input.linkedAssetId) {
        const a = await ctx.db.asset.findFirst({
          where: { id: input.linkedAssetId, organizationId },
          select: { lossMinimum: true, lossProbable: true, lossMaximum: true },
        });
        if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Linked asset not found" });
        lossMin = a.lossMinimum ? Number(a.lossMinimum) : null;
        lossProb = a.lossProbable ? Number(a.lossProbable) : null;
        lossMax = a.lossMaximum ? Number(a.lossMaximum) : null;
      }
      if (input.linkedBusinessProcessId) {
        const p = await ctx.db.businessProcess.findFirst({
          where: { id: input.linkedBusinessProcessId, organizationId },
          select: { lossMinimum: true, lossProbable: true, lossMaximum: true },
        });
        if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Linked business process not found" });
        const pMin = p.lossMinimum ? Number(p.lossMinimum) : null;
        const pProb = p.lossProbable ? Number(p.lossProbable) : null;
        const pMax = p.lossMaximum ? Number(p.lossMaximum) : null;
        // Combine asset + process: take the wider envelope.
        lossMin = lossMin === null ? pMin : pMin === null ? lossMin : Math.min(lossMin, pMin);
        lossProb = lossProb === null ? pProb : pProb === null ? lossProb : Math.max(lossProb, pProb);
        lossMax = lossMax === null ? pMax : pMax === null ? lossMax : Math.max(lossMax, pMax);
      }
      const snapshotAt = input.linkedAssetId || input.linkedBusinessProcessId ? new Date() : null;

      return ctx.db.riskAssessmentProject.update({
        where: { id: input.id },
        data: {
          linkedAssetId: input.linkedAssetId,
          linkedBusinessProcessId: input.linkedBusinessProcessId,
          inheritedLossMinimum: lossMin,
          inheritedLossProbable: lossProb,
          inheritedLossMaximum: lossMax,
          inheritedLossSnapshotAt: snapshotAt,
        },
      });
    }),

  /**
   * Story 4.1: Submit Assessment for Review
   *
   * Allows the assigned analyst to submit a completed assessment for manager review.
   * Assessment must be IN_PROGRESS and have at least one discovered risk.
   */
  submit: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
        include: {
          _count: {
            select: { discoveredRisks: true },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Verify user is the assignee or an org admin
      const isAdmin = ctx.session.user.role === UserRole.ORG_ADMIN;
      const isAssignee = assessment.assigneeId === ctx.session.user.id;
      if (!isAdmin && !isAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned worker or an org admin can submit this assessment",
        });
      }

      // Verify assessment is IN_PROGRESS
      if (assessment.status !== AssessmentProjectStatus.IN_PROGRESS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only IN_PROGRESS assessments can be submitted for review",
        });
      }

      // Verify assessment has at least one risk
      if (assessment._count.discoveredRisks === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assessment must have at least one discovered risk before submission",
        });
      }

      // Update assessment status to SUBMITTED
      const updatedProject = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          status: AssessmentProjectStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { discoveredRisks: true },
          },
        },
      });

      // Log the submission in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "SUBMITTED",
            previousStatus: AssessmentProjectStatus.IN_PROGRESS,
            newStatus: AssessmentProjectStatus.SUBMITTED,
            riskCount: assessment._count.discoveredRisks,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      // Story 6.1: Emit submitted notification
      await emitSubmittedNotification({
        assessmentId: id,
        assessmentSubject: assessment.subject,
        submittedById: ctx.session.user.id,
        submittedByName: ctx.session.user.name ?? null,
        riskCount: assessment._count.discoveredRisks,
        organizationId: ctx.organizationId,
      });

      return {
        ...updatedProject,
        riskCount: updatedProject._count.discoveredRisks,
      };
    }),

  /**
   * Story 4.2: Rescind Submitted Assessment
   *
   * Allows the assigned analyst to rescind a submitted assessment before it's reviewed.
   * Returns the assessment to IN_PROGRESS status.
   */
  rescindSubmission: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Verify user is the assignee
      if (assessment.assigneeId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned analyst can rescind submission",
        });
      }

      // Verify assessment is SUBMITTED
      if (assessment.status !== AssessmentProjectStatus.SUBMITTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only SUBMITTED assessments can be rescinded",
        });
      }

      // Update assessment status back to IN_PROGRESS
      const updatedProject = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          status: AssessmentProjectStatus.IN_PROGRESS,
          submittedAt: null,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Log the rescission in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "SUBMISSION_RESCINDED",
            previousStatus: AssessmentProjectStatus.SUBMITTED,
            newStatus: AssessmentProjectStatus.IN_PROGRESS,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      return updatedProject;
    }),

  /**
   * Story 4.3: Manager Approval Queue
   *
   * Lists all SUBMITTED assessments pending manager review.
   * Only accessible by managers (ORG_ADMIN, CISO).
   */
  getPendingApprovals: organizationProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      // Verify user is a manager
      const managerRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
      if (!managerRoles.includes(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can view pending approvals",
        });
      }

      // Get count of pending approvals
      const total = await ctx.db.riskAssessmentProject.count({
        where: {
          organizationId: ctx.organizationId,
          status: AssessmentProjectStatus.SUBMITTED,
        },
      });

      // Get pending approval assessments
      const assessments = await ctx.db.riskAssessmentProject.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: AssessmentProjectStatus.SUBMITTED,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              discoveredRisks: true,
            },
          },
        },
        orderBy: {
          submittedAt: "asc", // Oldest submissions first (FIFO)
        },
        take: limit,
        skip: offset,
      });

      return {
        assessments,
        total,
        hasMore: offset + assessments.length < total,
      };
    }),

  /**
   * Story 4.3: Get pending approval count for badge
   */
  getPendingApprovalCount: organizationProcedure
    .query(async ({ ctx }) => {
      // Verify user is a manager
      const managerRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
      if (!managerRoles.includes(ctx.session.user.role as UserRole)) {
        return { count: 0 };
      }

      const count = await ctx.db.riskAssessmentProject.count({
        where: {
          organizationId: ctx.organizationId,
          status: AssessmentProjectStatus.SUBMITTED,
        },
      });

      return { count };
    }),

  /**
   * Story 4.4: Approve Assessment & Publish Risks
   *
   * Allows managers to approve a submitted assessment.
   * All PENDING risks are changed to PUBLISHED in a single transaction.
   * Only accessible by managers (ORG_ADMIN, CISO).
   */
  approve: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Verify user is a manager
      const managerRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
      if (!managerRoles.includes(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can approve assessments",
        });
      }

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          discoveredRisks: {
            select: {
              id: true,
              severity: true,
            },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Org admins can approve directly from IN_PROGRESS (skip submit step);
      // CISO and other managers require an explicit submission first.
      const isAdmin = ctx.session.user.role === UserRole.ORG_ADMIN;
      const isApprovableStatus =
        assessment.status === AssessmentProjectStatus.SUBMITTED ||
        (isAdmin && assessment.status === AssessmentProjectStatus.IN_PROGRESS);
      if (!isApprovableStatus) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only SUBMITTED assessments can be approved",
        });
      }
      // Require at least one risk before approval
      if (assessment.discoveredRisks.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assessment must have at least one identified risk before approval",
        });
      }

      const now = new Date();
      const riskCount = assessment.discoveredRisks.length;

      // Calculate reassessment due date based on highest severity risk
      // HIGH: 12 months, MEDIUM: 18 months, LOW: 24 months
      let reassessmentMonths = 12; // Default
      const severities = assessment.discoveredRisks.map(r => r.severity);
      if (severities.includes("HIGH")) {
        reassessmentMonths = 12;
      } else if (severities.includes("MEDIUM")) {
        reassessmentMonths = 18;
      } else if (severities.includes("LOW")) {
        reassessmentMonths = 24;
      }

      const reassessmentDueDate = new Date(now);
      reassessmentDueDate.setMonth(reassessmentDueDate.getMonth() + reassessmentMonths);

      // Execute all updates in a single transaction
      const [updatedProject] = await ctx.db.$transaction([
        // Update assessment status to APPROVED
        ctx.db.riskAssessmentProject.update({
          where: { id },
          data: {
            status: AssessmentProjectStatus.APPROVED,
            reviewerId: ctx.session.user.id,
            reviewedAt: now,
            reassessmentDueDate,
          },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: { discoveredRisks: true },
            },
          },
        }),
        // Update all PENDING risks to PUBLISHED
        ctx.db.risk.updateMany({
          where: {
            discoveryProjectId: id,
            discoveryStatus: "PENDING",
          },
          data: {
            discoveryStatus: "PUBLISHED",
          },
        }),
        // Publish all PENDING findings discovered in this assessment into the
        // findings register (same gating as risks).
        ctx.db.finding.updateMany({
          where: {
            discoveryProjectId: id,
            discoveryStatus: "PENDING",
          },
          data: {
            discoveryStatus: "PUBLISHED",
          },
        }),
      ]);

      // Populate the risk register: create one RiskRegisterEntry per published
      // risk that doesn't already have one. Forward-only — no backfill of
      // historical approvals.
      const publishedRisks = await ctx.db.risk.findMany({
        where: {
          discoveryProjectId: id,
          discoveryStatus: "PUBLISHED",
          RiskRegisterEntry: null,
        },
        select: { id: true },
      });

      const ownerId = assessment.assigneeId ?? ctx.session.user.id;
      for (const r of publishedRisks) {
        const identifier = await generateIdentifier(ctx.organizationId, "RR");
        await ctx.db.riskRegisterEntry.create({
          data: {
            organizationId: ctx.organizationId,
            identifier,
            ownerId,
            riskId: r.id,
          },
        });
      }

      // Log the approval in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "APPROVED",
            previousStatus: AssessmentProjectStatus.SUBMITTED,
            newStatus: AssessmentProjectStatus.APPROVED,
            riskCount,
            risksPublished: riskCount,
            reassessmentDueDate: reassessmentDueDate.toISOString(),
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      // Story 6.1: Emit approved notification to assignee
      if (assessment.assigneeId) {
        await emitApprovedNotification({
          assessmentId: id,
          assessmentSubject: assessment.subject,
          assigneeId: assessment.assigneeId,
          assigneeName: assessment.assignee?.name ?? null,
          approvedById: ctx.session.user.id,
          approvedByName: ctx.session.user.name ?? null,
          riskCount,
          organizationId: ctx.organizationId,
        });
      }

      return {
        ...updatedProject,
        riskCount,
        reassessmentDueDate,
      };
    }),

  /**
   * Story 4.5: Reject Assessment with Notes
   *
   * Allows managers to reject a submitted assessment with required feedback notes.
   * Assessment returns to IN_PROGRESS so analyst can address issues and resubmit.
   * Only accessible by managers (ORG_ADMIN, CISO).
   */
  reject: organizationProcedure
    .input(z.object({
      id: z.string(),
      rejectionNotes: z.string().min(20, "Rejection notes must be at least 20 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, rejectionNotes } = input;

      // Verify user is a manager
      const managerRoles: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
      if (!managerRoles.includes(ctx.session.user.role as UserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only managers can reject assessments",
        });
      }

      // Verify the assessment exists and belongs to this organization
      const assessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment project not found",
        });
      }

      // Verify assessment is SUBMITTED
      if (assessment.status !== AssessmentProjectStatus.SUBMITTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only SUBMITTED assessments can be rejected",
        });
      }

      const now = new Date();

      // Update assessment status back to IN_PROGRESS with rejection notes
      const updatedProject = await ctx.db.riskAssessmentProject.update({
        where: { id },
        data: {
          status: AssessmentProjectStatus.IN_PROGRESS,
          reviewerId: ctx.session.user.id,
          reviewedAt: now,
          rejectionNotes,
          // Clear submittedAt since it's back to IN_PROGRESS
          submittedAt: null,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { discoveredRisks: true },
          },
        },
      });

      // Log the rejection in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_UPDATED,
          entityType: "RiskAssessmentProject",
          entityId: id,
          changes: {
            action: "REJECTED",
            previousStatus: AssessmentProjectStatus.SUBMITTED,
            newStatus: AssessmentProjectStatus.IN_PROGRESS,
            rejectionNotes,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      // Story 6.1: Emit rejected notification to assignee
      if (assessment.assigneeId) {
        await emitRejectedNotification({
          assessmentId: id,
          assessmentSubject: assessment.subject,
          assigneeId: assessment.assigneeId,
          assigneeName: assessment.assignee?.name ?? null,
          rejectedById: ctx.session.user.id,
          rejectedByName: ctx.session.user.name ?? null,
          rejectionNotes,
          organizationId: ctx.organizationId,
        });
      }

      return updatedProject;
    }),

  /**
   * Story 5.3: Create Reassessment from Original
   *
   * Creates a new assessment linked to a parent assessment for periodic re-evaluation.
   * Subject is pre-filled with "Reassessment of: [Original Subject]".
   * Due date defaults to 2 weeks from today.
   */
  createReassessment: organizationProcedure
    .input(z.object({
      parentAssessmentId: z.string(),
      subject: z.string().min(1).max(500).optional(),
      dueDate: z.date().optional(),
      assignToSelf: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { parentAssessmentId, subject, dueDate, assignToSelf } = input;

      // Fetch the parent assessment
      const parentAssessment = await ctx.db.riskAssessmentProject.findFirst({
        where: {
          id: parentAssessmentId,
          organizationId: ctx.organizationId,
          status: AssessmentProjectStatus.APPROVED,
        },
      });

      if (!parentAssessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parent assessment not found or not approved",
        });
      }

      // Calculate default due date (2 weeks from now)
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 14);

      // Create the reassessment
      const reassessment = await ctx.db.riskAssessmentProject.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          subject: subject || `Reassessment of: ${parentAssessment.subject}`,
          dueDate: dueDate || defaultDueDate,
          assigneeId: assignToSelf ? ctx.session.user.id : null,
          createdById: ctx.session.user.id,
          status: AssessmentProjectStatus.IN_PROGRESS,
          parentAssessmentId: parentAssessmentId,
        },
        include: {
          assignee: {
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
          parentAssessment: {
            select: {
              id: true,
              subject: true,
              status: true,
            },
          },
        },
      });

      // Log the reassessment creation in audit trail
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: AuditAction.ASSESSMENT_PROJECT_CREATED,
          entityType: "RiskAssessmentProject",
          entityId: reassessment.id,
          changes: {
            action: "REASSESSMENT_CREATED",
            parentAssessmentId: parentAssessmentId,
            subject: reassessment.subject,
          },
          actorName: ctx.session.user.name,
          actorRole: ctx.session.user.role,
        },
      });

      return reassessment;
    }),

  /**
   * Aggregate controls across all identified risks in this assessment.
   * Combines organizational controls (RiskOrganizationalControl) and
   * framework controls (RiskControlLink) into a single roll-up.
   */
  getControlsAggregate: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      const risks = await ctx.db.risk.findMany({
        where: { organizationId, discoveryProjectId: input.projectId },
        select: {
          id: true,
          identifier: true,
          title: true,
          OrganizationalControls: {
            select: {
              id: true,
              role: true,
              OrganizationalControl: {
                select: { id: true, localControlId: true, name: true },
              },
            },
          },
          ControlLinks: {
            select: {
              id: true,
              linkType: true,
              control: {
                select: {
                  id: true,
                  controlId: true,
                  title: true,
                  Framework: { select: { id: true, code: true } },
                },
              },
            },
          },
        },
      });

      const rows: Array<{
        riskId: string;
        riskIdentifier: string | null;
        riskTitle: string;
        source: "organizational" | "framework";
        role: string;
        controlIdentifier: string;
        controlTitle: string;
        frameworkCode?: string | null;
      }> = [];

      for (const r of risks) {
        for (const oc of r.OrganizationalControls) {
          rows.push({
            riskId: r.id,
            riskIdentifier: r.identifier,
            riskTitle: r.title,
            source: "organizational",
            role: oc.role,
            controlIdentifier: oc.OrganizationalControl.localControlId,
            controlTitle: oc.OrganizationalControl.name,
          });
        }
        for (const cl of r.ControlLinks) {
          rows.push({
            riskId: r.id,
            riskIdentifier: r.identifier,
            riskTitle: r.title,
            source: "framework",
            role: cl.linkType,
            controlIdentifier: cl.control.controlId,
            controlTitle: cl.control.title,
            frameworkCode: cl.control.Framework?.code,
          });
        }
      }

      return rows;
    }),

  /**
   * Aggregate evidence attached to any identified risk in this assessment.
   */
  getEvidenceAggregate: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      const links = await ctx.db.riskEvidence.findMany({
        where: {
          Risk: { organizationId, discoveryProjectId: input.projectId },
        },
        select: {
          id: true,
          linkType: true,
          linkedAt: true,
          Risk: { select: { id: true, identifier: true, title: true } },
          Evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileType: true,
              fileSize: true,
            },
          },
        },
        orderBy: { linkedAt: "desc" },
      });

      return links;
    }),

  /**
   * Aggregate per-risk treatment / acceptance status across the assessment.
   */
  getRemediationAggregate: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      const risks = await ctx.db.risk.findMany({
        where: { organizationId, discoveryProjectId: input.projectId },
        select: {
          id: true,
          identifier: true,
          title: true,
          severity: true,
          status: true,
          acceptanceJustification: true,
          acceptanceReviewDate: true,
          Treatments: {
            select: {
              id: true,
              treatmentType: true,
              detail: true,
              dueDate: true,
              actionStatus: true,
              slaBreached: true,
              completedAt: true,
              decidedAt: true,
            },
            orderBy: { decidedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return risks.map((r) => {
        const t = r.Treatments[0];
        const isAccept =
          t?.treatmentType === "ACCEPT" || !!r.acceptanceJustification;
        return {
          riskId: r.id,
          riskIdentifier: r.identifier,
          riskTitle: r.title,
          severity: r.severity,
          status: r.status,
          treatmentType: t?.treatmentType ?? null,
          plan: isAccept
            ? r.acceptanceJustification ?? t?.detail ?? null
            : t?.detail ?? null,
          dueDate: isAccept
            ? r.acceptanceReviewDate ?? t?.dueDate ?? null
            : t?.dueDate ?? null,
          actionStatus: t?.actionStatus ?? null,
          slaBreached: t?.slaBreached ?? false,
          completedAt: t?.completedAt ?? null,
        };
      });
    }),

  /**
   * Aggregate treatment progress for the assessment dashboard.
   * Returns counts: total risks, with plan, accepted, breached, no decision.
   */
  getTreatmentProgress: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      const risks = await ctx.db.risk.findMany({
        where: { organizationId, discoveryProjectId: input.projectId },
        select: {
          id: true,
          acceptanceJustification: true,
          Treatments: {
            select: {
              treatmentType: true,
              slaBreached: true,
              completedAt: true,
            },
            orderBy: { decidedAt: "desc" },
            take: 1,
          },
        },
      });

      let total = 0;
      let withPlan = 0;
      let accepted = 0;
      let breached = 0;
      let completed = 0;
      let undecided = 0;

      for (const r of risks) {
        total += 1;
        const t = r.Treatments[0];
        if (t?.completedAt) completed += 1;
        if (t?.slaBreached) breached += 1;

        const isAccept =
          t?.treatmentType === "ACCEPT" || !!r.acceptanceJustification;
        if (isAccept) {
          accepted += 1;
        } else if (t?.treatmentType === "REMEDIATE") {
          withPlan += 1;
        } else if (!t?.treatmentType) {
          undecided += 1;
        }
      }

      return { total, withPlan, accepted, breached, completed, undecided };
    }),

  /**
   * List comments on an assessment project (newest first).
   */
  listComments: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.riskAssessmentProjectComment.findMany({
        where: {
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          deletedAt: null,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          Author: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Add a comment to an assessment project. Any user with access to the
   * assessment can comment.
   */
  addComment: organizationProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.riskAssessmentProject.findFirst({
        where: { id: input.projectId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      return ctx.db.riskAssessmentProjectComment.create({
        data: {
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          authorId: ctx.session.user.id,
          content: input.content,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          Author: { select: { id: true, name: true, email: true, image: true } },
        },
      });
    }),

  /**
   * Soft-delete a comment (author only).
   */
  deleteComment: organizationProcedure
    .input(z.object({ commentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.riskAssessmentProjectComment.findFirst({
        where: { id: input.commentId, organizationId: ctx.organizationId },
        select: { id: true, authorId: true },
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      const isAdmin = ctx.session.user.role === UserRole.ORG_ADMIN;
      const isAuthor = comment.authorId === ctx.session.user.id;
      if (!isAdmin && !isAuthor) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author or an admin can delete this comment",
        });
      }
      return ctx.db.riskAssessmentProjectComment.update({
        where: { id: input.commentId },
        data: { deletedAt: new Date() },
      });
    }),

  /**
   * Audit trail entries scoped to this assessment project.
   */
  getAuditTrail: organizationProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: "RiskAssessmentProject",
          entityId: input.projectId,
        },
        select: {
          id: true,
          action: true,
          changes: true,
          timestamp: true,
          actorName: true,
          actorRole: true,
          User: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      });
    }),
});
