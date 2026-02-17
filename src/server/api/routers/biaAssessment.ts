/**
 * BIA Assessment tRPC Router
 *
 * Epic 11: BIA Impact Assessment
 * Stories 11.1-11.8: Impact scoring, time-to-impact matrix, tier calculation,
 * manual override, assessment workflow, and notifications.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import {
  UserRole,
  AuditAction,
  BIAAssessmentStatus,
  BIAAssessmentRequestStatus,
} from "@prisma/client";
import { createAuditLog } from "@/server/services/audit-log.service";

// Roles that can view assessments
const ASSESSMENT_VIEW_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// Roles that can request assessments
const ASSESSMENT_REQUEST_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

// Roles that can complete assessments (includes process owners)
const ASSESSMENT_COMPLETE_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
];

// Input schemas
const impactScoreInputSchema = z.object({
  categoryId: z.string(),
  score: z.number().min(1).max(10), // Allow for flexible scale
  description: z.string().max(2000).optional(),
});

const saveImpactScoresSchema = z.object({
  processId: z.string(),
  scores: z.array(impactScoreInputSchema),
});

const timeImpactScoreInputSchema = z.object({
  categoryId: z.string(),
  timePeriodId: z.string(),
  score: z.number().min(1).max(10),
});

const saveTimeImpactMatrixSchema = z.object({
  processId: z.string(),
  scores: z.array(timeImpactScoreInputSchema),
});

const overrideTierSchema = z.object({
  processId: z.string(),
  tierId: z.string(),
  justification: z.string().min(50, "Justification must be at least 50 characters"),
});

const requestAssessmentSchema = z.object({
  processId: z.string(),
  dueDate: z.date().optional(),
  message: z.string().max(1000).optional(),
});

const submitAssessmentSchema = z.object({
  processId: z.string(),
});

export const biaAssessmentRouter = createTRPCRouter({
  /**
   * Get assessment data for a business process
   * Returns impact scores, time-to-impact matrix, tier info, and config
   */
  getAssessmentData: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .input(z.object({ processId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get the process with assessment data
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
        include: {
          impactScores: {
            include: {
              category: true,
            },
          },
          timeImpactScores: {
            include: {
              category: true,
              timePeriod: true,
            },
          },
          calculatedTier: true,
          overrideTier: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Get BIA configuration for this organization
      const config = await ctx.db.bIAConfiguration.findFirst({
        where: { organizationId },
        include: {
          impactCategories: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          tierDefinitions: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          timePeriods: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // Fetch tier criteria separately (cross-reference between categories and tiers)
      const tierCriteria = config
        ? await ctx.db.bIATierCriteria.findMany({
            where: {
              category: {
                configurationId: config.id,
              },
            },
            include: {
              category: true,
              tier: true,
            },
          })
        : [];

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "BIA configuration not found. Please contact your administrator.",
        });
      }

      // Check if current user is the owner or has edit permissions
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role;
      const isOwner = process.ownerId === userId;
      const canEdit =
        isOwner ||
        userRole === UserRole.ORG_ADMIN ||
        userRole === UserRole.GRC_ANALYST;

      // Get the effective tier (override takes precedence)
      const effectiveTier = process.overrideTier ?? process.calculatedTier;

      return {
        process: {
          id: process.id,
          identifier: process.identifier,
          name: process.name,
          description: process.description,
          assessmentStatus: process.assessmentStatus,
          lastAssessedAt: process.lastAssessedAt,
          overrideJustification: process.overrideJustification,
          overrideAt: process.overrideAt,
          owner: process.owner,
        },
        impactScores: process.impactScores,
        timeImpactScores: process.timeImpactScores,
        calculatedTier: process.calculatedTier,
        overrideTier: process.overrideTier,
        effectiveTier,
        config: {
          scoreMin: config.scoreScaleMin,
          scoreMax: config.scoreScaleMax,
          impactCategories: config.impactCategories,
          tierDefinitions: config.tierDefinitions,
          timePeriods: config.timePeriods,
          tierCriteria,
        },
        permissions: {
          canEdit,
          canOverride: canEdit,
          canSubmit: canEdit,
        },
      };
    }),

  /**
   * Save impact scores for a business process
   * FR20: Process Owner can complete impact scoring
   */
  saveImpactScores: organizationProcedure
    .use(requireRole(ASSESSMENT_COMPLETE_ROLES))
    .input(saveImpactScoresSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists and user can edit
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Check permissions (owner or admin/analyst)
      const userRole = ctx.session!.user.role;
      const isOwner = process.ownerId === userId;
      const canEdit =
        isOwner ||
        userRole === UserRole.ORG_ADMIN ||
        userRole === UserRole.GRC_ANALYST;

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this assessment",
        });
      }

      // Upsert impact scores
      const scorePromises = input.scores.map((score) =>
        ctx.db.bIAImpactScore.upsert({
          where: {
            processId_categoryId: {
              processId: input.processId,
              categoryId: score.categoryId,
            },
          },
          create: {
            processId: input.processId,
            categoryId: score.categoryId,
            score: score.score,
            description: score.description,
          },
          update: {
            score: score.score,
            description: score.description,
          },
        })
      );

      await Promise.all(scorePromises);

      // Update process assessment status to IN_PROGRESS if NOT_STARTED
      if (process.assessmentStatus === BIAAssessmentStatus.NOT_STARTED) {
        await ctx.db.businessProcess.update({
          where: { id: input.processId },
          data: { assessmentStatus: BIAAssessmentStatus.DRAFT },
        });
      }

      // Calculate and update tier
      await calculateAndUpdateTier(ctx.db, input.processId, organizationId);

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          after: {
            impactScores: input.scores,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Save time-to-impact matrix values
   * FR22: Process Owner can complete time-to-impact matrix
   */
  saveTimeImpactMatrix: organizationProcedure
    .use(requireRole(ASSESSMENT_COMPLETE_ROLES))
    .input(saveTimeImpactMatrixSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists and user can edit
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Check permissions
      const userRole = ctx.session!.user.role;
      const isOwner = process.ownerId === userId;
      const canEdit =
        isOwner ||
        userRole === UserRole.ORG_ADMIN ||
        userRole === UserRole.GRC_ANALYST;

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this assessment",
        });
      }

      // Upsert time impact scores
      const scorePromises = input.scores.map((score) =>
        ctx.db.bIATimeImpactScore.upsert({
          where: {
            processId_categoryId_timePeriodId: {
              processId: input.processId,
              categoryId: score.categoryId,
              timePeriodId: score.timePeriodId,
            },
          },
          create: {
            processId: input.processId,
            categoryId: score.categoryId,
            timePeriodId: score.timePeriodId,
            score: score.score,
          },
          update: {
            score: score.score,
          },
        })
      );

      await Promise.all(scorePromises);

      // Update process assessment status to IN_PROGRESS if NOT_STARTED
      if (process.assessmentStatus === BIAAssessmentStatus.NOT_STARTED) {
        await ctx.db.businessProcess.update({
          where: { id: input.processId },
          data: { assessmentStatus: BIAAssessmentStatus.DRAFT },
        });
      }

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          after: {
            timeImpactScores: input.scores,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Manually override the calculated tier
   * FR24: Process Owner can manually override the calculated tier
   */
  overrideTier: organizationProcedure
    .use(requireRole(ASSESSMENT_COMPLETE_ROLES))
    .input(overrideTierSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
        include: {
          calculatedTier: true,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Verify tier exists
      const tier = await ctx.db.bIATierDefinition.findFirst({
        where: {
          id: input.tierId,
          configurationId: (
            await ctx.db.bIAConfiguration.findFirst({
              where: { organizationId },
              select: { id: true },
            })
          )?.id,
        },
      });

      if (!tier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tier definition not found",
        });
      }

      // Update process with override
      await ctx.db.businessProcess.update({
        where: { id: input.processId },
        data: {
          overrideTierId: input.tierId,
          overrideJustification: input.justification,
          overrideAt: new Date(),
          overrideById: userId,
        },
      });

      // Audit log with full context
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          before: {
            tier: process.calculatedTier?.name ?? "None",
          },
          after: {
            tier: tier.name,
            overrideJustification: input.justification,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Clear tier override and revert to calculated tier
   */
  clearOverride: organizationProcedure
    .use(requireRole(ASSESSMENT_COMPLETE_ROLES))
    .input(z.object({ processId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
        include: {
          overrideTier: true,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Clear override
      await ctx.db.businessProcess.update({
        where: { id: input.processId },
        data: {
          overrideTierId: null,
          overrideJustification: null,
          overrideAt: null,
          overrideById: null,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          before: {
            overrideTier: process.overrideTier?.name,
            overrideJustification: process.overrideJustification,
          },
          after: {
            overrideTier: null,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Submit completed assessment
   * FR27, FR28: Complete the assessment workflow
   */
  submitAssessment: organizationProcedure
    .use(requireRole(ASSESSMENT_COMPLETE_ROLES))
    .input(submitAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
        include: {
          impactScores: true,
          assessmentRequests: {
            where: { status: BIAAssessmentRequestStatus.PENDING },
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Check that there are impact scores
      if (process.impactScores.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Please complete impact scoring before submitting",
        });
      }

      // Update process to COMPLETED status
      await ctx.db.businessProcess.update({
        where: { id: input.processId },
        data: {
          assessmentStatus: BIAAssessmentStatus.COMPLETED,
          lastAssessedAt: new Date(),
          lastAssessedById: userId,
        },
      });

      // Complete any pending assessment requests
      if (process.assessmentRequests.length > 0) {
        await ctx.db.bIAAssessmentRequest.updateMany({
          where: {
            processId: input.processId,
            status: BIAAssessmentRequestStatus.PENDING,
          },
          data: {
            status: BIAAssessmentRequestStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // TODO: Send notification to requester (FR43)
      }

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          after: {
            assessmentStatus: BIAAssessmentStatus.COMPLETED,
            lastAssessedAt: new Date().toISOString(),
          },
        },
      });

      return { success: true };
    }),

  /**
   * Request an assessment from a Process Owner
   * FR26, FR41, FR42: Send assessment request with email notification
   */
  requestAssessment: organizationProcedure
    .use(requireRole(ASSESSMENT_REQUEST_ROLES))
    .input(requestAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify process exists and has an owner
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.processId,
          organizationId,
        },
        include: {
          owner: true,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      if (!process.owner) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Process must have an assigned owner before requesting assessment",
        });
      }

      // Create assessment request
      const request = await ctx.db.bIAAssessmentRequest.create({
        data: {
          processId: input.processId,
          requestedById: userId,
          dueDate: input.dueDate,
          message: input.message,
        },
      });

      // TODO: Send email notification to process owner (FR41, FR42)
      // This would integrate with the email service

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BIAAssessmentRequest",
        entityId: request.id,
        changes: {
          after: {
            processId: input.processId,
            processName: process.name,
            ownerEmail: process.owner.email,
            dueDate: input.dueDate?.toISOString(),
          },
        },
      });

      return { success: true, requestId: request.id };
    }),

  /**
   * Get pending assessments for current user
   * FR44: Process Owner can view their pending assessment assignments
   */
  getPendingAssessments: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role;

      // Build query based on role
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        organizationId,
      };

      // For stakeholders, only show their owned processes
      if (
        userRole === UserRole.IT_STAKEHOLDER ||
        userRole === UserRole.BUSINESS_STAKEHOLDER
      ) {
        where.ownerId = userId;
      }

      // Get processes with pending requests or incomplete assessments
      const processes = await ctx.db.businessProcess.findMany({
        where: {
          ...where,
          OR: [
            { assessmentStatus: BIAAssessmentStatus.NOT_STARTED },
            { assessmentStatus: BIAAssessmentStatus.DRAFT },
            {
              assessmentRequests: {
                some: {
                  status: BIAAssessmentRequestStatus.PENDING,
                },
              },
            },
          ],
        },
        include: {
          assessmentRequests: {
            where: { status: BIAAssessmentRequestStatus.PENDING },
            include: {
              requestedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { requestedAt: "asc" },
          },
          businessFunction: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { assessmentStatus: "asc" }, // NOT_STARTED first
          { updatedAt: "desc" },
        ],
      });

      return processes.map((p) => ({
        id: p.id,
        identifier: p.identifier,
        name: p.name,
        businessFunction: p.businessFunction,
        assessmentStatus: p.assessmentStatus,
        lastAssessedAt: p.lastAssessedAt,
        pendingRequests: p.assessmentRequests,
      }));
    }),
});

/**
 * Helper function to calculate and update tier based on impact scores
 * FR23: System auto-calculates recommended tier
 */
async function calculateAndUpdateTier(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  processId: string,
  organizationId: string
): Promise<void> {
  // Get impact scores for this process
  const impactScores = await db.bIAImpactScore.findMany({
    where: { processId },
    include: {
      category: true,
    },
  });

  if (impactScores.length === 0) {
    return; // No scores to calculate from
  }

  // Get BIA configuration with tier thresholds
  const config = await db.bIAConfiguration.findFirst({
    where: { organizationId },
    include: {
      tierDefinitions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!config || config.tierDefinitions.length === 0) {
    return; // No config or tiers defined
  }

  // Calculate weighted average score
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const score of impactScores) {
    const weight = score.category.weight ?? 25; // Default 25% weight
    totalWeightedScore += score.score * weight;
    totalWeight += weight;
  }

  const averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // Find matching tier based on thresholds
  // Tiers are sorted by sortOrder (0 = most critical)
  // Higher scores should map to more critical tiers
  let matchingTier = null;

  for (const tier of config.tierDefinitions) {
    const minScore = tier.minScore ?? 0;
    const maxScore = tier.maxScore ?? 5;

    if (averageScore >= minScore && averageScore <= maxScore) {
      matchingTier = tier;
      break;
    }
  }

  // If no exact match, use the highest tier for high scores or lowest for low scores
  if (!matchingTier) {
    if (averageScore >= (config.scoreScaleMax ?? 5) * 0.8) {
      // High score - use most critical tier (first one)
      matchingTier = config.tierDefinitions[0];
    } else {
      // Low score - use least critical tier (last one)
      matchingTier = config.tierDefinitions[config.tierDefinitions.length - 1];
    }
  }

  if (matchingTier) {
    // Update process with calculated tier
    await db.businessProcess.update({
      where: { id: processId },
      data: {
        calculatedTierId: matchingTier.id,
      },
    });
  }
}
