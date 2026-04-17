/**
 * Risk Assessment Router
 *
 * tRPC router for risk assessment operations including update with auto-save.
 *
 * Story 7.6: Risk Assessment Form with Auto-Save
 * - getById query (AC14, AC21)
 * - update mutation (AC16-AC20)
 *
 * Story 7.8.9: Assessment Form Matrix Integration
 * - Matrix version locking (AC23-AC26)
 * - Matrix-based scoring (using Story 7.8.8 scoring algorithm)
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 * @see Story 7.8.9: Assessment Form Matrix Integration
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, TreatmentType, AssessmentStatus, AuditAction, Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { checkApprovalGates, assertApprovalGates } from "@/server/services/assessmentStateMachine";
import { generateIdentifier } from "@/server/services/identifierService";
import { createAuditLog } from "@/server/services/audit-log.service";
import { calculateScore, getScoreLabel } from "@/lib/utils/risk-scoring";
import {
  calculateInherentScore,
  isScoreResult,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";

/**
 * Roles that can update risk assessments (AC34)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const ASSESSMENT_UPDATE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Update Assessment Input Schema (AC18)
 * Accepts partial updates - only changed fields required
 *
 * Story 7.8.9: Extended to include matrix-based scoring fields
 * - assessmentTypeId: Assessment type selection (AC1-AC5)
 * - matrixVersionId: Matrix version selection (AC6-AC10)
 * - likelihoodValue, impactValue, exposureValue: Scale selections (AC11-AC17)
 */
const updateAssessmentInput = z.object({
  assessmentId: z.string(),
  title: z.string().min(1).max(500).optional(),
  context: z.string().optional(),
  riskCategory: z.string().optional(),
  affectedSystems: z.array(z.string()).optional(),
  // Story 7.8.9: Matrix-based scoring fields
  assessmentTypeId: z.string().optional().nullable(),
  matrixVersionId: z.string().optional().nullable(),
  likelihoodValue: z.number().positive().optional().nullable(),
  impactValue: z.number().positive().optional().nullable(),
  exposureValue: z.number().positive().optional().nullable(),
  // Legacy fields (may be removed after full migration to matrix-based scoring)
  treatment: z.nativeEnum(TreatmentType).optional(),
  ownerId: z.string().optional().nullable(),
  // Story 16.1: Business context fields
  businessOwnerId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  performedById: z.string().optional().nullable(),
});

export const riskAssessmentRouter = createTRPCRouter({
  /**
   * List assessments with pagination and filtering
   *
   * Story 16.10: Risk Assessment Summary & Overall Severity
   * - AC9: Assessment list shows overall severity column
   * - AC10: Sort by overall severity
   */
  list: organizationProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.nativeEnum(AssessmentStatus).optional(),
        sortBy: z.enum(["createdAt", "updatedAt", "identifier", "overallSeverityScore"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { page, limit, status, sortBy, sortOrder, search } = input;

      const whereClause: Prisma.RiskAssessmentWhereInput = {
        organizationId,
        ...(status && { status }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { identifier: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [items, total] = await Promise.all([
        ctx.db.riskAssessment.findMany({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            identifier: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            overallSeverityScore: true,
            overallSeverityLabel: true,
            inherentScore: true,
            inherentScoreLabel: true,
            owner: { select: { id: true, name: true, email: true } },
            businessOwner: { select: { id: true, name: true, email: true } },
            businessUnit: { select: { id: true, name: true, code: true } },
            _count: { select: { childRisks: true } },
          },
        }),
        ctx.db.riskAssessment.count({ where: whereClause }),
      ]);

      return {
        items: items.map((item) => ({
          ...item,
          inherentScore: item.inherentScore ? Number(item.inherentScore) : null,
          childRiskCount: item._count.childRisks,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get an assessment by ID with all related data
   *
   * Story 7.6: AC14, AC21
   * Returns assessment with:
   * - Owner info
   * - Scenarios for approval gate check
   * - Approval gate status
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const assessment = await ctx.db.riskAssessment.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } },
          // Story 16.1: Business context relations
          businessOwner: { select: { id: true, name: true, email: true } },
          businessUnit: { select: { id: true, name: true, code: true } },
          performedBy: { select: { id: true, name: true, email: true } },
          scenarios: { select: { id: true, description: true } },
          finding: {
            select: {
              id: true,
              identifier: true,
              title: true,
              status: true,
            },
          },
          // Story 7.9: Include risk register entry for approved assessments
          riskRegisterEntry: {
            select: {
              id: true,
              identifier: true,
              status: true,
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

      // Calculate approval gates (AC21)
      const approvalGates = checkApprovalGates(assessment);

      return {
        ...assessment,
        // Convert Decimal to number for JSON serialization
        likelihoodValue: assessment.likelihoodValue
          ? Number(assessment.likelihoodValue)
          : null,
        impactValue: assessment.impactValue
          ? Number(assessment.impactValue)
          : null,
        inherentScore: assessment.inherentScore
          ? Number(assessment.inherentScore)
          : null,
        approvalGates,
      };
    }),

  /**
   * Update a risk assessment (partial update with auto-save)
   *
   * Story 7.6: AC16-AC20
   * - AC16: update mutation defined
   * - AC17: Validates assessment is in DRAFT status
   * - AC18: Accepts partial updates (only changed fields)
   * - AC19: Auto-calculates inherentScore (likelihood × impact)
   * - AC20: Sets inherentScoreLabel based on score thresholds
   * - AC21: Returns updated assessment with approval gate status
   * - AC34: Role-based access control
   *
   * Story 7.8.9: Matrix Integration (AC23-AC26)
   * - AC23: matrixVersionId stored on RiskAssessment
   * - AC24: Version locked at first save, not changeable
   * - AC25: If matrix updated after lock, assessment shows original version
   * - AC26: Info tooltip: "Scored using Matrix v2 (locked)"
   */
  update: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(updateAssessmentInput)
    .mutation(async ({ ctx, input }) => {
      const { assessmentId, ownerId, assessmentTypeId, matrixVersionId, businessOwnerId, businessUnitId, performedById, ...updateFields } = input;
      const organizationId = ctx.organizationId!;

      // Fetch assessment and validate organization ownership
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // AC17: Validate assessment is in DRAFT status
      if (assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update assessment in ${assessment.status} status. Only DRAFT assessments can be updated.`,
        });
      }

      // Validate owner is in same organization (if provided)
      if (ownerId) {
        const validOwner = await ctx.db.user.findFirst({
          where: { id: ownerId, organizationId },
        });
        if (!validOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid owner - must be in same organization",
          });
        }
      }

      // Story 16.1: Validate business context fields
      if (businessOwnerId) {
        const validBusinessOwner = await ctx.db.person.findFirst({
          where: { id: businessOwnerId, organizationId },
        });
        if (!validBusinessOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business owner - must be in same organization",
          });
        }
      }

      if (businessUnitId) {
        const validBusinessUnit = await ctx.db.businessUnit.findFirst({
          where: { id: businessUnitId, organizationId, isActive: true },
        });
        if (!validBusinessUnit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit - must be active and in same organization",
          });
        }
      }

      if (performedById) {
        const validPerformer = await ctx.db.user.findFirst({
          where: { id: performedById, organizationId },
        });
        if (!validPerformer) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assessor - must be in same organization",
          });
        }
      }

      // Story 7.8.9 AC23-AC26: Version Locking Logic
      // Once an assessment has scoring values saved (first save with scores),
      // the matrixVersionId becomes locked and cannot be changed.
      const hasExistingScores = assessment.likelihoodValue !== null || assessment.impactValue !== null;
      const isVersionLocked = assessment.matrixVersionId !== null && hasExistingScores;

      // Check if trying to change locked matrixVersionId
      if (matrixVersionId !== undefined && isVersionLocked) {
        if (matrixVersionId !== assessment.matrixVersionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Matrix version is locked after scoring. Cannot change the matrix for this assessment.",
          });
        }
      }

      // Build update data
      const updateData: Prisma.RiskAssessmentUpdateInput = {};

      // Copy simple fields if provided
      if (updateFields.title !== undefined) {
        updateData.title = updateFields.title;
      }
      if (updateFields.context !== undefined) {
        updateData.context = updateFields.context;
      }
      if (updateFields.riskCategory !== undefined) {
        updateData.riskCategory = updateFields.riskCategory;
      }
      if (updateFields.affectedSystems !== undefined) {
        updateData.affectedSystems = updateFields.affectedSystems;
      }
      if (updateFields.treatment !== undefined) {
        updateData.treatment = updateFields.treatment;
      }
      if (ownerId !== undefined) {
        if (ownerId === null) {
          updateData.owner = { disconnect: true };
        } else {
          updateData.owner = { connect: { id: ownerId } };
        }
      }

      // Story 16.1: Update business context fields
      if (businessOwnerId !== undefined) {
        if (businessOwnerId === null) {
          updateData.businessOwner = { disconnect: true };
        } else {
          updateData.businessOwner = { connect: { id: businessOwnerId } };
        }
      }
      if (businessUnitId !== undefined) {
        if (businessUnitId === null) {
          updateData.businessUnit = { disconnect: true };
        } else {
          updateData.businessUnit = { connect: { id: businessUnitId } };
        }
      }
      if (performedById !== undefined) {
        if (performedById === null) {
          updateData.performedBy = { disconnect: true };
        } else {
          updateData.performedBy = { connect: { id: performedById } };
        }
      }

      // Story 7.8.9: Update assessmentTypeId (AC1-AC5)
      // Type can be changed while in DRAFT status (AC4, AC5 - locked after approval, not first save)
      if (assessmentTypeId !== undefined) {
        if (assessmentTypeId === null) {
          updateData.assessmentType = { disconnect: true };
        } else {
          // Validate assessment type belongs to organization
          const validType = await ctx.db.assessmentType.findFirst({
            where: { id: assessmentTypeId, organizationId, isActive: true },
          });
          if (!validType) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid assessment type",
            });
          }
          updateData.assessmentType = { connect: { id: assessmentTypeId } };
        }
      }

      // Story 7.8.9: Update matrixVersionId (AC6-AC10) - only if not locked
      if (matrixVersionId !== undefined && !isVersionLocked) {
        if (matrixVersionId === null) {
          updateData.matrixVersionId = null;
        } else {
          // Validate matrix version belongs to organization and is published
          const validVersion = await ctx.db.riskMatrixVersion.findFirst({
            where: {
              id: matrixVersionId,
              template: { organizationId },
              publishedAt: { not: null },
            },
          });
          if (!validVersion) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid matrix version - must be a published version from your organization",
            });
          }
          updateData.matrixVersionId = matrixVersionId;
        }
      }

      // Handle score values
      if (updateFields.likelihoodValue !== undefined) {
        updateData.likelihoodValue = updateFields.likelihoodValue === null
          ? null
          : new Prisma.Decimal(updateFields.likelihoodValue);
      }
      if (updateFields.impactValue !== undefined) {
        updateData.impactValue = updateFields.impactValue === null
          ? null
          : new Prisma.Decimal(updateFields.impactValue);
      }
      if (updateFields.exposureValue !== undefined) {
        updateData.exposureValue = updateFields.exposureValue === null
          ? null
          : new Prisma.Decimal(updateFields.exposureValue);
      }

      // Story 7.8.9: Calculate score using matrix-based algorithm (AC18-AC22)
      // Determine the matrix version to use for scoring
      const effectiveMatrixVersionId = matrixVersionId ?? assessment.matrixVersionId;
      const newLikelihood = updateFields.likelihoodValue !== undefined
        ? updateFields.likelihoodValue
        : (assessment.likelihoodValue ? Number(assessment.likelihoodValue) : null);
      const newImpact = updateFields.impactValue !== undefined
        ? updateFields.impactValue
        : (assessment.impactValue ? Number(assessment.impactValue) : null);
      const newExposure = updateFields.exposureValue !== undefined
        ? updateFields.exposureValue
        : (assessment.exposureValue ? Number(assessment.exposureValue) : null);

      // If we have a matrix version, use matrix-based scoring
      if (effectiveMatrixVersionId && newLikelihood !== null && newImpact !== null) {
        const matrixVersion = await ctx.db.riskMatrixVersion.findFirst({
          where: { id: effectiveMatrixVersionId },
          include: {
            template: { select: { outputScaleMax: true, dimensionCount: true } },
          },
        });

        if (matrixVersion) {
          const scales = matrixVersion.scales as unknown as MatrixScales;
          const thresholds = matrixVersion.thresholds as unknown as Threshold[];
          const outputScaleMax = Number(matrixVersion.template.outputScaleMax);

          const scoreResult = calculateInherentScore(
            scales,
            thresholds,
            outputScaleMax,
            newLikelihood,
            newImpact,
            newExposure
          );

          if (isScoreResult(scoreResult)) {
            updateData.inherentScore = new Prisma.Decimal(scoreResult.normalizedScore);
            updateData.inherentScoreLabel = scoreResult.label;
          }
        }
      } else if (newLikelihood !== null && newImpact !== null) {
        // Fallback to legacy 4x4 scoring if no matrix version
        const score = calculateScore(newLikelihood, newImpact);
        updateData.inherentScore = new Prisma.Decimal(score);
        updateData.inherentScoreLabel = getScoreLabel(score);
      }

      // Update the assessment
      const updated = await ctx.db.riskAssessment.update({
        where: { id: assessmentId },
        data: updateData,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          // Story 16.1: Business context relations
          businessOwner: { select: { id: true, name: true, email: true } },
          businessUnit: { select: { id: true, name: true, code: true } },
          performedBy: { select: { id: true, name: true, email: true } },
          scenarios: { select: { id: true, description: true } },
          assessmentType: { select: { id: true, name: true } },
        },
      });

      // Fetch matrix version info separately if needed (no relation defined in schema)
      let matrixVersionInfo: { id: string; versionNumber: number; templateName: string } | null = null;
      if (updated.matrixVersionId) {
        const version = await ctx.db.riskMatrixVersion.findFirst({
          where: { id: updated.matrixVersionId },
          include: { template: { select: { name: true } } },
        });
        if (version) {
          matrixVersionInfo = {
            id: version.id,
            versionNumber: version.versionNumber,
            templateName: version.template.name,
          };
        }
      }

      // Calculate approval gates (AC21)
      const approvalGates = checkApprovalGates(updated);

      return {
        ...updated,
        // Convert Decimal to number for JSON serialization
        likelihoodValue: updated.likelihoodValue
          ? Number(updated.likelihoodValue)
          : null,
        impactValue: updated.impactValue
          ? Number(updated.impactValue)
          : null,
        exposureValue: updated.exposureValue
          ? Number(updated.exposureValue)
          : null,
        inherentScore: updated.inherentScore
          ? Number(updated.inherentScore)
          : null,
        approvalGates,
        // Story 7.8.9: Matrix version info for display
        matrixVersionInfo,
        // Story 7.8.9 AC26: Flag for UI to show locked tooltip
        isMatrixVersionLocked: isVersionLocked || (
          matrixVersionId !== undefined &&
          matrixVersionId !== null &&
          (updateFields.likelihoodValue !== undefined || updateFields.impactValue !== undefined)
        ),
      };
    }),

  /**
   * Add a scenario to a risk assessment
   *
   * Story 7.7: AC1-AC6
   * - AC1: addScenario mutation defined
   * - AC2: Validates assessment is in DRAFT status
   * - AC3: Creates RiskScenario with description and order
   * - AC4: Scenario inherits organizationId from assessment
   * - AC5: Returns created scenario
   * - AC6: Approval gates recalculated after add
   */
  addScenario: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        description: z.string().min(1, "Description is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Fetch assessment and validate
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: { scenarios: { select: { id: true } } },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // AC2: Validate assessment is in DRAFT status
      if (assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot add scenarios to assessment with status ${assessment.status}. Assessment must be in DRAFT status.`,
        });
      }

      // AC3, AC4: Create scenario with organizationId and order
      const scenario = await ctx.db.riskScenario.create({
        data: {
          organizationId,
          assessmentId: input.assessmentId,
          description: input.description,
          order: assessment.scenarios.length,
        },
      });

      return scenario;
    }),

  /**
   * Update a scenario description
   *
   * Story 7.7: AC7-AC10
   */
  updateScenario: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(
      z.object({
        scenarioId: z.string(),
        description: z.string().min(1, "Description is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const scenario = await ctx.db.riskScenario.findFirst({
        where: { id: input.scenarioId, organizationId },
        include: { assessment: { select: { status: true } } },
      });

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      if (scenario.assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot modify scenarios on assessment with status ${scenario.assessment.status}. Assessment must be in DRAFT status.`,
        });
      }

      const updated = await ctx.db.riskScenario.update({
        where: { id: input.scenarioId },
        data: { description: input.description },
      });

      return updated;
    }),

  /**
   * Remove a scenario from an assessment
   *
   * Story 7.7: AC11-AC14
   */
  removeScenario: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const scenario = await ctx.db.riskScenario.findFirst({
        where: { id: input.scenarioId, organizationId },
        include: { assessment: { select: { status: true } } },
      });

      if (!scenario) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scenario not found",
        });
      }

      if (scenario.assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete scenarios from assessment with status ${scenario.assessment.status}. Assessment must be in DRAFT status.`,
        });
      }

      await ctx.db.riskScenario.delete({
        where: { id: input.scenarioId },
      });

      return { success: true };
    }),

  /**
   * Approve a risk assessment and create a Risk Register entry
   *
   * Story 7.9: AC11-AC26, AC37-AC39
   * - AC11: approve mutation defined
   * - AC12: Validates assessment is in DRAFT status
   * - AC13: Calls assertApprovalGates (service layer enforcement)
   * - AC14: Generates RR identifier for Risk Register entry
   * - AC15: Updates assessment to APPROVED status
   * - AC16: Sets approvedBy and approvedAt
   * - AC17: Creates RiskRegisterEntry in OPEN status
   * - AC18: Operation is transactional
   * - AC19-AC23: Risk Register Entry creation
   * - AC24-AC26: Return values
   * - AC35: Role-based access (Security Engineer, GRC Analyst, Org Admin)
   * - AC37-AC39: Audit logging
   */
  approve: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch assessment with scenarios for gate checking
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: {
          id: input.assessmentId,
          organizationId,
        },
        include: {
          scenarios: { select: { id: true } },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // AC12: Validate assessment is in DRAFT status
      if (assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve assessment in ${assessment.status} status. Only DRAFT assessments can be approved.`,
        });
      }

      // AC13: Service layer enforcement - throws if gates not met
      assertApprovalGates(assessment);

      // AC5/AC19: Validate owner is set (required for risk register entry)
      if (!assessment.ownerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assessment must have an owner before approval",
        });
      }

      // AC14/AC23: Generate RR identifier
      const riskIdentifier = await generateIdentifier(organizationId, "RR");

      // AC18: Transactional operation
      const result = await ctx.db.$transaction(async (tx) => {
        // AC15-AC16: Update assessment status
        const approvedAssessment = await tx.riskAssessment.update({
          where: { id: input.assessmentId },
          data: {
            status: AssessmentStatus.APPROVED,
            approvedBy: userId,
            approvedAt: new Date(),
          },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            approver: { select: { id: true, name: true, email: true } },
          },
        });

        // AC17/AC19-AC22: Create RiskRegisterEntry
        const entry = await tx.riskRegisterEntry.create({
          data: {
            identifier: riskIdentifier,
            organizationId,
            assessmentId: input.assessmentId,
            ownerId: assessment.ownerId!,
            status: "OPEN",
          },
        });

        return { assessment: approvedAssessment, entry };
      });

      // AC37-AC39: Audit logging (outside transaction - fire and forget)
      void createAuditLog({
        action: AuditAction.ASSESSMENT_APPROVED,
        entityType: "RiskAssessment",
        entityId: input.assessmentId,
        userId,
        organizationId,
        changes: {
          before: { status: "DRAFT" },
          after: {
            status: "APPROVED",
            approvedBy: userId,
            riskRegisterEntryId: result.entry.id,
            riskRegisterIdentifier: result.entry.identifier,
          },
        },
      });

      void createAuditLog({
        action: AuditAction.RISK_REGISTER_ENTRY_CREATED,
        entityType: "RiskRegisterEntry",
        entityId: result.entry.id,
        userId,
        organizationId,
        changes: {
          before: null,
          after: {
            identifier: result.entry.identifier,
            assessmentId: input.assessmentId,
            assessmentIdentifier: assessment.identifier,
            ownerId: assessment.ownerId,
          },
        },
      });

      // AC24-AC26: Return updated assessment and created entry
      return {
        assessment: {
          ...result.assessment,
          likelihoodValue: result.assessment.likelihoodValue
            ? Number(result.assessment.likelihoodValue)
            : null,
          impactValue: result.assessment.impactValue
            ? Number(result.assessment.impactValue)
            : null,
          inherentScore: result.assessment.inherentScore
            ? Number(result.assessment.inherentScore)
            : null,
        },
        entry: {
          id: result.entry.id,
          identifier: result.entry.identifier,
          status: result.entry.status,
        },
      };
    }),

  /**
   * Reject a risk assessment
   *
   * Story 7.9: AC31-AC34, AC35
   * - AC31: Reject available for DRAFT assessments
   * - AC32: Requires reason
   * - AC33: Updates status to REJECTED
   * - AC34: Finding remains ACCEPTED (not affected)
   * - AC35: Role-based access
   */
  reject: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(
      z.object({
        assessmentId: z.string(),
        reason: z.string().min(1, "Rejection reason is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch assessment
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: {
          id: input.assessmentId,
          organizationId,
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // AC31: Validate assessment is in DRAFT status
      if (assessment.status !== AssessmentStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reject assessment in ${assessment.status} status. Only DRAFT assessments can be rejected.`,
        });
      }

      // AC33: Update status to REJECTED
      const rejectedAssessment = await ctx.db.riskAssessment.update({
        where: { id: input.assessmentId },
        data: {
          status: AssessmentStatus.REJECTED,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit logging with rejection reason
      void createAuditLog({
        action: AuditAction.ASSESSMENT_REJECTED,
        entityType: "RiskAssessment",
        entityId: input.assessmentId,
        userId,
        organizationId,
        changes: {
          before: { status: "DRAFT" },
          after: {
            status: "REJECTED",
            reason: input.reason,
          },
        },
      });

      // AC34: Finding remains in its current state (no action needed)

      return {
        ...rejectedAssessment,
        likelihoodValue: rejectedAssessment.likelihoodValue
          ? Number(rejectedAssessment.likelihoodValue)
          : null,
        impactValue: rejectedAssessment.impactValue
          ? Number(rejectedAssessment.impactValue)
          : null,
        inherentScore: rejectedAssessment.inherentScore
          ? Number(rejectedAssessment.inherentScore)
          : null,
      };
    }),

  /**
   * Recalculate overall severity from child risks
   *
   * Story 16.10: Risk Assessment Summary & Overall Severity
   * - AC1: Overall severity = highest severity among child risks
   * - AC2: Overall score = highest score among child risks
   * - AC3: Recalculated when risks are added/removed/updated
   * - AC4: Stored on RiskAssessment.overallSeverityScore and overallSeverityLabel
   */
  recalculateOverallSeverity: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(z.object({ assessmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify assessment exists
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Get all child risks for this assessment
      const childRisks = await ctx.db.risk.findMany({
        where: {
          assessmentId: input.assessmentId,
          organizationId,
        },
        select: {
          inherentScore: true,
          inherentScoreLabel: true,
          residualScore: true,
          residualScoreLabel: true,
        },
      });

      // AC1-AC2: Find highest severity among child risks
      let highestScore: number | null = null;
      let highestLabel: string | null = null;

      for (const risk of childRisks) {
        // Use residual score if available, otherwise inherent score
        const score = risk.residualScore
          ? Number(risk.residualScore)
          : risk.inherentScore
            ? Number(risk.inherentScore)
            : null;
        const label = risk.residualScoreLabel ?? risk.inherentScoreLabel ?? null;

        if (score !== null && (highestScore === null || score > highestScore)) {
          highestScore = score;
          highestLabel = label;
        }
      }

      // AC4: Update assessment with overall severity
      const updated = await ctx.db.riskAssessment.update({
        where: { id: input.assessmentId },
        data: {
          overallSeverityScore: highestScore !== null ? Math.round(highestScore) : null,
          overallSeverityLabel: highestLabel,
        },
      });

      return {
        overallSeverityScore: updated.overallSeverityScore,
        overallSeverityLabel: updated.overallSeverityLabel,
        childRiskCount: childRisks.length,
      };
    }),

  /**
   * Get assessment summary with child risks breakdown
   *
   * Story 16.10: Risk Assessment Summary & Overall Severity
   * - AC5: Summary card on assessment detail page
   * - AC6: Shows: Total risks, Overall severity badge, Business owner, Business unit
   * - AC7: Risk breakdown by severity
   */
  getSummary: organizationProcedure
    .input(z.object({ assessmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const assessment = await ctx.db.riskAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
        include: {
          businessOwner: { select: { id: true, name: true, email: true } },
          businessUnit: { select: { id: true, name: true, code: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Get child risks with severity breakdown
      const childRisks = await ctx.db.risk.findMany({
        where: {
          assessmentId: input.assessmentId,
          organizationId,
        },
        select: {
          id: true,
          title: true,
          severity: true,
          inherentScoreLabel: true,
          residualScoreLabel: true,
        },
      });

      // AC7: Calculate severity breakdown
      const severityBreakdown: Record<string, number> = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        Info: 0,
      };

      for (const risk of childRisks) {
        // Use the effective severity label
        const effectiveLabel = risk.residualScoreLabel ?? risk.inherentScoreLabel ?? risk.severity;
        if (effectiveLabel && severityBreakdown[effectiveLabel] !== undefined) {
          severityBreakdown[effectiveLabel]++;
        } else if (effectiveLabel) {
          // Handle legacy or custom severity values
          severityBreakdown[effectiveLabel] = (severityBreakdown[effectiveLabel] ?? 0) + 1;
        }
      }

      return {
        assessment: {
          id: assessment.id,
          identifier: assessment.identifier,
          title: assessment.title,
          status: assessment.status,
          overallSeverityScore: assessment.overallSeverityScore,
          overallSeverityLabel: assessment.overallSeverityLabel,
          businessOwner: assessment.businessOwner,
          businessUnit: assessment.businessUnit,
          owner: assessment.owner,
        },
        totalRisks: childRisks.length,
        severityBreakdown,
        childRisks: childRisks.map((r) => ({
          id: r.id,
          title: r.title,
          effectiveSeverity: r.residualScoreLabel ?? r.inherentScoreLabel ?? r.severity,
        })),
      };
    }),

  /**
   * Add a child risk to an assessment
   *
   * Story 16.10: Link existing risk to assessment
   */
  addChildRisk: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(z.object({
      assessmentId: z.string(),
      riskId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify assessment exists
      const assessment = await ctx.db.riskAssessment.findFirst({
        where: { id: input.assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Verify risk exists and is in same org
      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Link risk to assessment
      await ctx.db.risk.update({
        where: { id: input.riskId },
        data: { assessmentId: input.assessmentId },
      });

      // AC3: Recalculate overall severity
      const childRisks = await ctx.db.risk.findMany({
        where: { assessmentId: input.assessmentId, organizationId },
        select: {
          inherentScore: true,
          inherentScoreLabel: true,
          residualScore: true,
          residualScoreLabel: true,
        },
      });

      let highestScore: number | null = null;
      let highestLabel: string | null = null;

      for (const r of childRisks) {
        const score = r.residualScore ? Number(r.residualScore) : r.inherentScore ? Number(r.inherentScore) : null;
        const label = r.residualScoreLabel ?? r.inherentScoreLabel ?? null;
        if (score !== null && (highestScore === null || score > highestScore)) {
          highestScore = score;
          highestLabel = label;
        }
      }

      await ctx.db.riskAssessment.update({
        where: { id: input.assessmentId },
        data: {
          overallSeverityScore: highestScore !== null ? Math.round(highestScore) : null,
          overallSeverityLabel: highestLabel,
        },
      });

      return { success: true };
    }),

  /**
   * Remove a child risk from an assessment
   *
   * Story 16.10: Unlink risk from assessment
   */
  removeChildRisk: organizationProcedure
    .use(requireRole(ASSESSMENT_UPDATE_ROLES))
    .input(z.object({ riskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify risk exists
      const risk = await ctx.db.risk.findFirst({
        where: { id: input.riskId, organizationId },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      const assessmentId = risk.assessmentId;

      // Unlink risk from assessment
      await ctx.db.risk.update({
        where: { id: input.riskId },
        data: { assessmentId: null },
      });

      // AC3: Recalculate overall severity if risk was linked
      if (assessmentId) {
        const childRisks = await ctx.db.risk.findMany({
          where: { assessmentId, organizationId },
          select: {
            inherentScore: true,
            inherentScoreLabel: true,
            residualScore: true,
            residualScoreLabel: true,
          },
        });

        let highestScore: number | null = null;
        let highestLabel: string | null = null;

        for (const r of childRisks) {
          const score = r.residualScore ? Number(r.residualScore) : r.inherentScore ? Number(r.inherentScore) : null;
          const label = r.residualScoreLabel ?? r.inherentScoreLabel ?? null;
          if (score !== null && (highestScore === null || score > highestScore)) {
            highestScore = score;
            highestLabel = label;
          }
        }

        await ctx.db.riskAssessment.update({
          where: { id: assessmentId },
          data: {
            overallSeverityScore: highestScore !== null ? Math.round(highestScore) : null,
            overallSeverityLabel: highestLabel,
          },
        });
      }

      return { success: true };
    }),

  /**
   * List stale draft assessments for dashboard widget
   *
   * Story 7.13: Stale Draft Dashboard Widget
   * - AC1: "Stale" = DRAFT assessment not updated in X days (default 7)
   * - AC3: Age calculated from updatedAt timestamp
   * - AC11: Returns DRAFT assessments older than threshold
   * - AC12: Accepts daysThreshold parameter (default 7)
   * - AC13: Returns count and items
   * - AC14: Respects organization isolation
   */
  listStale: organizationProcedure
    .input(
      z.object({
        daysThreshold: z.number().min(1).default(7),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { daysThreshold, limit } = input;

      // AC1, AC3: Calculate threshold date
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      // AC11, AC14: Query for stale DRAFT assessments
      const whereClause = {
        organizationId,
        status: AssessmentStatus.DRAFT,
        updatedAt: { lt: thresholdDate },
      };

      // AC13: Get count and items in parallel
      const [count, items] = await Promise.all([
        ctx.db.riskAssessment.count({ where: whereClause }),
        ctx.db.riskAssessment.findMany({
          where: whereClause,
          take: limit,
          orderBy: { updatedAt: "asc" }, // Oldest first
          select: {
            id: true,
            identifier: true,
            title: true,
            updatedAt: true,
            finding: {
              select: {
                id: true,
                identifier: true,
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
        }),
      ]);

      return { count, items };
    }),
});
