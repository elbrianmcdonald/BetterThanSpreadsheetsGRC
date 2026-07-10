/**
 * Compliance Assessment Router
 *
 * tRPC router for Compliance Assessment operations.
 * Allows organizations to assess their compliance against frameworks.
 *
 * Features:
 * - Assessment CRUD operations
 * - Control scoring with compliance status
 * - Bulk updates for efficient scoring
 * - Workflow: Draft → In Progress → In Review → Completed
 * - Automatic metric calculations
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  UserRole,
  ComplianceStatus,
  ComplianceAssessmentStatus,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { READ_ROLES, WRITE_ROLES, APPROVE_ROLES } from "@/lib/auth/roles";

/**
 * Roles that can manage compliance assessments (any mutation)
 */
const COMPLIANCE_MANAGE_ROLES: UserRole[] = WRITE_ROLES as UserRole[];

/**
 * Roles that can view compliance assessments
 */
const COMPLIANCE_VIEW_ROLES: UserRole[] = READ_ROLES as UserRole[];

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Schema for creating a compliance assessment
 */
const createAssessmentSchema = z.object({
  frameworkId: z.string().min(1, "Framework ID is required"),
  businessUnitId: z.string().optional().nullable(),
  baseline: z.string().optional().nullable(), // "LOW", "MODERATE", "HIGH", "PRIVACY", or null (all controls)
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  assessorId: z.string().optional().nullable(),
  targetCompletionDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
});

/**
 * Schema for updating a compliance assessment
 */
const updateAssessmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.nativeEnum(ComplianceAssessmentStatus).optional(),
  assessorId: z.string().optional().nullable(),
  targetCompletionDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
});

/**
 * Schema for listing assessments
 */
const listAssessmentsSchema = z.object({
  frameworkId: z.string().optional(),
  businessUnitId: z.string().optional(),
  status: z.nativeEnum(ComplianceAssessmentStatus).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/**
 * Schema for updating a control score
 */
const updateControlScoreSchema = z.object({
  assessmentId: z.string().min(1),
  controlId: z.string().min(1),
  status: z.nativeEnum(ComplianceStatus).optional(),
  notes: z.string().max(5000).optional().nullable(),
  evidenceLinks: z.array(z.string()).optional(),
  gapDescription: z.string().max(5000).optional().nullable(),
  remediationPlan: z.string().max(5000).optional().nullable(),
  remediationDueDate: z.date().optional().nullable(),
});

/**
 * Schema for bulk updating control scores
 */
const bulkUpdateControlScoresSchema = z.object({
  assessmentId: z.string().min(1),
  scores: z.array(
    z.object({
      controlId: z.string().min(1),
      status: z.nativeEnum(ComplianceStatus).optional(),
      notes: z.string().max(5000).optional().nullable(),
      gapDescription: z.string().max(5000).optional().nullable(),
      remediationPlan: z.string().max(5000).optional().nullable(),
    })
  ),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate assessment identifier (COMP-YYYY-NNNN)
 */
async function generateAssessmentIdentifier(
  db: PrismaClient,
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `COMP-${year}-`;

  // Get count of assessments this year
  const count = await db.complianceAssessment.count({
    where: {
      organizationId,
      identifier: { startsWith: prefix },
    },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/**
 * Calculate compliance metrics for an assessment
 */
async function calculateAssessmentMetrics(
  db: PrismaClient,
  assessmentId: string
): Promise<{
  totalControls: number;
  compliantCount: number;
  nonCompliantCount: number;
  partialCount: number;
  notApplicableCount: number;
  notAssessedCount: number;
  complianceScore: Prisma.Decimal | null;
}> {
  const scores = await db.controlAssessmentScore.findMany({
    where: { assessmentId },
    select: { status: true },
  });

  const totalControls = scores.length;
  const compliantCount = scores.filter((s) => s.status === ComplianceStatus.COMPLIANT).length;
  const nonCompliantCount = scores.filter((s) => s.status === ComplianceStatus.NON_COMPLIANT).length;
  const partialCount = scores.filter((s) => s.status === ComplianceStatus.PARTIALLY_COMPLIANT).length;
  const notApplicableCount = scores.filter((s) => s.status === ComplianceStatus.NOT_APPLICABLE).length;
  const notAssessedCount = scores.filter((s) => s.status === ComplianceStatus.NOT_ASSESSED).length;

  // Calculate compliance score (exclude N/A controls)
  const assessedControls = totalControls - notApplicableCount - notAssessedCount;
  let complianceScore: Prisma.Decimal | null = null;

  if (assessedControls > 0) {
    // Full compliance = 100%, Partial = 50%, Non-compliant = 0%
    const score = ((compliantCount * 100) + (partialCount * 50)) / assessedControls;
    complianceScore = new Prisma.Decimal(score.toFixed(2));
  }

  return {
    totalControls,
    compliantCount,
    nonCompliantCount,
    partialCount,
    notApplicableCount,
    notAssessedCount,
    complianceScore,
  };
}

/**
 * Update assessment metrics in the database
 */
async function updateAssessmentMetrics(
  db: PrismaClient,
  assessmentId: string
): Promise<void> {
  const metrics = await calculateAssessmentMetrics(db, assessmentId);

  await db.complianceAssessment.update({
    where: { id: assessmentId },
    data: metrics,
  });
}

// =============================================================================
// Router
// =============================================================================

export const complianceAssessmentRouter = createTRPCRouter({
  /**
   * Create a new compliance assessment
   */
  create: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(createAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Verify framework exists and belongs to organization
      const framework = await db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId,
          isActive: true,
        },
        include: {
          Control: {
            where: {
              isActive: true,
              // If baseline is specified, only include controls that belong to that baseline
              ...(input.baseline ? { baselines: { contains: input.baseline } } : {}),
            },
            select: { id: true },
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found or not active",
        });
      }

      // Generate identifier
      const identifier = await generateAssessmentIdentifier(db, organizationId);

      // Create assessment with initial control scores
      const assessment = await db.complianceAssessment.create({
        data: {
          organizationId,
          frameworkId: input.frameworkId,
          businessUnitId: input.businessUnitId ?? null,
          baseline: input.baseline ?? null,
          identifier,
          name: input.name,
          description: input.description ?? null,
          status: ComplianceAssessmentStatus.DRAFT,
          ownerId: session.user.id,
          assessorId: input.assessorId ?? null,
          targetCompletionDate: input.targetCompletionDate ?? null,
          dueDate: input.dueDate ?? null,
          totalControls: framework.Control.length,
          notAssessedCount: framework.Control.length,
          // Create initial scores for all controls
          controlScores: {
            create: framework.Control.map((control) => ({
              controlId: control.id,
              status: ComplianceStatus.NOT_ASSESSED,
            })),
          },
        },
        include: {
          framework: {
            select: { name: true, code: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return assessment;
    }),

  /**
   * List compliance assessments with pagination and filters
   */
  list: organizationProcedure
    .use(requireRole(COMPLIANCE_VIEW_ROLES))
    .input(listAssessmentsSchema)
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      const { frameworkId, businessUnitId, status, page, pageSize } = input;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const where = {
        organizationId,
        ...(frameworkId && { frameworkId }),
        ...(businessUnitId && { businessUnitId }),
        ...(status && { status }),
      };

      const [assessments, total] = await Promise.all([
        db.complianceAssessment.findMany({
          where,
          include: {
            framework: {
              select: { id: true, name: true, code: true },
            },
            businessUnit: {
              select: { id: true, name: true, code: true },
            },
            owner: {
              select: { id: true, name: true, email: true },
            },
            assessor: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.complianceAssessment.count({ where }),
      ]);

      return {
        assessments,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  /**
   * Get a compliance assessment by ID with all control scores
   */
  getById: organizationProcedure
    .use(requireRole(COMPLIANCE_VIEW_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          framework: {
            select: { id: true, name: true, code: true, version: true },
          },
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          owner: {
            select: { id: true, name: true, email: true },
          },
          assessor: {
            select: { id: true, name: true, email: true },
          },
          submittedBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          controlScores: {
            include: {
              control: {
                select: {
                  id: true,
                  controlId: true,
                  title: true,
                  description: true,
                  parentControlId: true,
                  // Org-authored testing fields shown read-only in the
                  // scoring panel so the assessor can see how to verify the
                  // control while documenting evidence.
                  testInstructions: true,
                  acceptanceCriteria: true,
                },
              },
              assessedBy: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: {
              control: { controlId: "asc" },
            },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      return assessment;
    }),

  /**
   * Update a compliance assessment
   */
  update: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(updateAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      const { id, ...data } = input;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Only allow status changes if valid transition
      if (data.status) {
        const validTransitions: Record<ComplianceAssessmentStatus, ComplianceAssessmentStatus[]> = {
          DRAFT: [ComplianceAssessmentStatus.IN_PROGRESS],
          IN_PROGRESS: [ComplianceAssessmentStatus.IN_REVIEW, ComplianceAssessmentStatus.DRAFT],
          IN_REVIEW: [ComplianceAssessmentStatus.COMPLETED, ComplianceAssessmentStatus.IN_PROGRESS],
          COMPLETED: [ComplianceAssessmentStatus.ARCHIVED],
          ARCHIVED: [],
        };

        if (!validTransitions[assessment.status].includes(data.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot transition from ${assessment.status} to ${data.status}`,
          });
        }
      }

      const updated = await db.complianceAssessment.update({
        where: { id },
        data: {
          ...data,
          description: data.description ?? null,
          assessorId: data.assessorId ?? null,
          targetCompletionDate: data.targetCompletionDate ?? null,
          dueDate: data.dueDate ?? null,
        },
        include: {
          framework: {
            select: { name: true, code: true },
          },
        },
      });

      return updated;
    }),

  /**
   * Delete a compliance assessment (admin roles only, any status).
   * Cascades to ControlAssessmentScore rows via the schema relation.
   */
  delete: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      await db.complianceAssessment.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Update a single control score
   */
  updateControlScore: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(updateControlScoreSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      const { assessmentId, controlId, ...data } = input;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Verify assessment exists and is editable
      const assessment = await db.complianceAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (
        assessment.status === ComplianceAssessmentStatus.COMPLETED ||
        assessment.status === ComplianceAssessmentStatus.ARCHIVED
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify completed or archived assessments",
        });
      }

      // Update or create the score
      const score = await db.controlAssessmentScore.upsert({
        where: {
          assessmentId_controlId: { assessmentId, controlId },
        },
        create: {
          assessmentId,
          controlId,
          status: data.status ?? ComplianceStatus.NOT_ASSESSED,
          notes: data.notes ?? null,
          evidenceLinks: data.evidenceLinks ?? [],
          gapDescription: data.gapDescription ?? null,
          remediationPlan: data.remediationPlan ?? null,
          remediationDueDate: data.remediationDueDate ?? null,
          assessedById: session.user.id,
          assessedAt: new Date(),
        },
        update: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.evidenceLinks !== undefined && { evidenceLinks: data.evidenceLinks }),
          ...(data.gapDescription !== undefined && { gapDescription: data.gapDescription }),
          ...(data.remediationPlan !== undefined && { remediationPlan: data.remediationPlan }),
          ...(data.remediationDueDate !== undefined && { remediationDueDate: data.remediationDueDate }),
          assessedById: session.user.id,
          assessedAt: new Date(),
        },
        include: {
          control: {
            select: { id: true, controlId: true, title: true },
          },
        },
      });

      // Update assessment metrics
      await updateAssessmentMetrics(db, assessmentId);

      return score;
    }),

  /**
   * Attach or detach a piece of evidence on a single control score. Treats
   * evidenceLinks as a set — same evidence can't be attached twice, detach
   * is a no-op if not currently attached.
   */
  attachEvidenceToControl: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        controlId: z.string(),
        evidenceId: z.string(),
        action: z.enum(["attach", "detach"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      if (!organizationId || !session?.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });
      if (!assessment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      if (
        assessment.status === ComplianceAssessmentStatus.COMPLETED ||
        assessment.status === ComplianceAssessmentStatus.ARCHIVED
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify completed or archived assessments",
        });
      }

      // Verify evidence belongs to the same org so users can't cross-link.
      const evidence = await db.evidence.findFirst({
        where: { id: input.evidenceId, organizationId },
      });
      if (!evidence) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evidence not found" });
      }

      const existing = await db.controlAssessmentScore.findUnique({
        where: {
          assessmentId_controlId: {
            assessmentId: input.assessmentId,
            controlId: input.controlId,
          },
        },
      });

      const currentLinks = existing?.evidenceLinks ?? [];
      const nextLinks =
        input.action === "attach"
          ? Array.from(new Set([...currentLinks, input.evidenceId]))
          : currentLinks.filter((id) => id !== input.evidenceId);

      const score = await db.controlAssessmentScore.upsert({
        where: {
          assessmentId_controlId: {
            assessmentId: input.assessmentId,
            controlId: input.controlId,
          },
        },
        create: {
          assessmentId: input.assessmentId,
          controlId: input.controlId,
          status: ComplianceStatus.NOT_ASSESSED,
          evidenceLinks: nextLinks,
          assessedById: session.user.id,
          assessedAt: new Date(),
        },
        update: {
          evidenceLinks: nextLinks,
          assessedById: session.user.id,
          assessedAt: new Date(),
        },
      });

      return score;
    }),

  /**
   * Bulk update control scores
   */
  bulkUpdateControlScores: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(bulkUpdateControlScoresSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;
      const { assessmentId, scores } = input;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Verify assessment exists and is editable
      const assessment = await db.complianceAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (
        assessment.status === ComplianceAssessmentStatus.COMPLETED ||
        assessment.status === ComplianceAssessmentStatus.ARCHIVED
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify completed or archived assessments",
        });
      }

      // Update each score
      const updatedScores = await Promise.all(
        scores.map((score) =>
          db.controlAssessmentScore.upsert({
            where: {
              assessmentId_controlId: {
                assessmentId,
                controlId: score.controlId,
              },
            },
            create: {
              assessmentId,
              controlId: score.controlId,
              status: score.status ?? ComplianceStatus.NOT_ASSESSED,
              notes: score.notes ?? null,
              gapDescription: score.gapDescription ?? null,
              remediationPlan: score.remediationPlan ?? null,
              assessedById: session.user.id,
              assessedAt: new Date(),
            },
            update: {
              ...(score.status !== undefined && { status: score.status }),
              ...(score.notes !== undefined && { notes: score.notes }),
              ...(score.gapDescription !== undefined && { gapDescription: score.gapDescription }),
              ...(score.remediationPlan !== undefined && { remediationPlan: score.remediationPlan }),
              assessedById: session.user.id,
              assessedAt: new Date(),
            },
          })
        )
      );

      // Update assessment metrics
      await updateAssessmentMetrics(db, assessmentId);

      return { updated: updatedScores.length };
    }),

  /**
   * Submit assessment for review
   */
  submitForReview: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (assessment.status !== ComplianceAssessmentStatus.IN_PROGRESS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only in-progress assessments can be submitted for review",
        });
      }

      const updated = await db.complianceAssessment.update({
        where: { id: input.id },
        data: {
          status: ComplianceAssessmentStatus.IN_REVIEW,
          submittedAt: new Date(),
          submittedById: session.user.id,
        },
      });

      return updated;
    }),

  /**
   * Approve assessment
   */
  approve: organizationProcedure
    .use(requireRole(APPROVE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, session, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (assessment.status !== ComplianceAssessmentStatus.IN_REVIEW) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only assessments in review can be approved",
        });
      }

      const updated = await db.complianceAssessment.update({
        where: { id: input.id },
        data: {
          status: ComplianceAssessmentStatus.COMPLETED,
          approvedAt: new Date(),
          approvedById: session.user.id,
        },
      });

      return updated;
    }),

  /**
   * Start assessment (move from Draft to In Progress)
   */
  start: organizationProcedure
    .use(requireRole(COMPLIANCE_MANAGE_ROLES))
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      const assessment = await db.complianceAssessment.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      if (assessment.status !== ComplianceAssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft assessments can be started",
        });
      }

      const updated = await db.complianceAssessment.update({
        where: { id: input.id },
        data: {
          status: ComplianceAssessmentStatus.IN_PROGRESS,
        },
      });

      return updated;
    }),

  /**
   * Get assessments for the compliance dashboard
   * Returns assessments filtered by status with summary counts
   */
  getDashboardAssessments: organizationProcedure
    .use(requireRole(COMPLIANCE_VIEW_ROLES))
    .input(
      z.object({
        businessUnitId: z.string().optional().nullable(),
        limit: z.number().int().min(1).max(50).default(12),
        statuses: z.array(z.nativeEnum(ComplianceAssessmentStatus)).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;
      const { businessUnitId, limit, statuses } = input;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Default to active statuses if not specified
      const statusFilter = statuses ?? [
        ComplianceAssessmentStatus.IN_PROGRESS,
        ComplianceAssessmentStatus.IN_REVIEW,
        ComplianceAssessmentStatus.COMPLETED,
      ];

      const where = {
        organizationId,
        status: {
          in: statusFilter,
        },
        ...(businessUnitId && { businessUnitId }),
      };

      const [assessments, counts] = await Promise.all([
        db.complianceAssessment.findMany({
          where,
          include: {
            framework: {
              select: { id: true, name: true, code: true },
            },
            businessUnit: {
              select: { id: true, name: true, code: true },
            },
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [
            // Show in-progress first, then in-review, then completed
            { status: "asc" },
            { updatedAt: "desc" },
          ],
          take: limit,
        }),
        // Get counts by status
        db.complianceAssessment.groupBy({
          by: ["status"],
          where: {
            organizationId,
            ...(businessUnitId && { businessUnitId }),
          },
          _count: { id: true },
        }),
      ]);

      // Convert counts to a summary object
      const summary = {
        inProgress: 0,
        inReview: 0,
        completed: 0,
        draft: 0,
        archived: 0,
        total: 0,
      };

      for (const count of counts) {
        const statusKey =
          count.status === ComplianceAssessmentStatus.IN_PROGRESS
            ? "inProgress"
            : count.status === ComplianceAssessmentStatus.IN_REVIEW
              ? "inReview"
              : count.status === ComplianceAssessmentStatus.COMPLETED
                ? "completed"
                : count.status === ComplianceAssessmentStatus.DRAFT
                  ? "draft"
                  : "archived";
        summary[statusKey] = count._count.id;
        summary.total += count._count.id;
      }

      return {
        assessments,
        summary,
      };
    }),

  /**
   * Get available baselines for a framework
   * Returns distinct baseline values and counts for controls that have baselines set.
   */
  getFrameworkBaselines: organizationProcedure
    .use(requireRole(COMPLIANCE_VIEW_ROLES))
    .input(z.object({ frameworkId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { db, organizationId } = ctx;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization context required",
        });
      }

      // Get all controls for this framework that have baselines
      const controls = await db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          organizationId,
          isActive: true,
          baselines: { not: null },
        },
        select: { baselines: true },
      });

      // Collect unique baselines with counts
      const baselineCounts: Record<string, number> = {};
      for (const control of controls) {
        if (!control.baselines) continue;
        for (const baseline of control.baselines.split(",")) {
          const trimmed = baseline.trim();
          if (trimmed) {
            baselineCounts[trimmed] = (baselineCounts[trimmed] || 0) + 1;
          }
        }
      }

      // Return sorted baselines with counts
      const BASELINE_ORDER = ["LOW", "MODERATE", "HIGH", "PRIVACY"];
      const baselines = BASELINE_ORDER
        .filter((b) => baselineCounts[b])
        .map((b) => ({
          value: b,
          label: b.charAt(0) + b.slice(1).toLowerCase(),
          count: baselineCounts[b] || 0,
        }));

      return { baselines };
    }),
});
