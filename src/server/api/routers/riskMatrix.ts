/**
 * Risk Matrix Template & Version Management tRPC Router
 *
 * Story 7.8.2: RiskMatrixTemplate Schema
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle
 *
 * Handles CRUD operations for risk matrix templates and versions.
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: Only ORG_ADMIN can create/update templates and versions
 * - Immutability enforcement: Published versions cannot be edited
 *
 * **Features:**
 * - Soft delete via isActive flag (no hard delete)
 * - Unique name per organization
 * - 2D (Likelihood × Impact) or 3D (L×I×Exposure) matrix support
 * - Version lifecycle: Draft → Published (immutable)
 */

import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  createTRPCRouter,
  adminProcedure,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { AuditAction, Prisma, UserRole } from "@prisma/client";

/**
 * Roles allowed to READ a matrix version (drives the severity-scoring selects
 * in the identified-risk / questionnaire risk dialogs). Editing matrices stays
 * ORG_ADMIN-only — analysts/managers just need to read the scales to score.
 */
const MATRIX_READ_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_MANAGER,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
];
import {
  matrixScalesSchema,
  thresholdArraySchema,
  validateMatrixVersion,
  type MatrixScales,
  type Threshold,
} from "@/lib/matrix";
import { getDefaultsForGridSize } from "@/lib/matrix/defaults";

// Zod schemas for input validation (AC21-AC25)
// Story 11.1: Added gridSize field for 3x3, 4x4, or 5x5 matrix support
const createMatrixTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  dimensionCount: z.number().int().min(2, "Dimension count must be at least 2").max(3, "Dimension count must be at most 3").default(2),
  gridSize: z.number().int().min(3, "Grid size must be at least 3").max(5, "Grid size must be at most 5").default(5), // Story 11.1
  outputScaleMax: z.number().positive("Output scale must be positive").max(1000, "Output scale must be 1000 or less"),
});

const updateMatrixTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional().nullable(),
  // Note: dimensionCount and outputScaleMax cannot be updated (AC12, AC25)
  isActive: z.boolean().optional(),
});

const listMatrixTemplatesSchema = z.object({
  includeInactive: z.boolean().default(false),
});

// Story 7.8.3: Version input schemas (AC25-AC30)
const createVersionSchema = z.object({
  templateId: z.string(),
  copyFromVersionId: z.string().optional(), // AC25: Copy from existing version
  scales: matrixScalesSchema.optional(),     // Initial scales (optional if copying)
  thresholds: thresholdArraySchema.optional(), // Initial thresholds (optional if copying)
});

const updateVersionSchema = z.object({
  id: z.string(),
  scales: matrixScalesSchema.optional(),
  thresholds: thresholdArraySchema.optional(),
});

const publishVersionSchema = z.object({
  id: z.string(),
});

const listVersionsSchema = z.object({
  templateId: z.string(),
  includeDrafts: z.boolean().default(true),
});

const getVersionSchema = z.object({
  id: z.string(),
});

const deleteVersionSchema = z.object({
  id: z.string(),
});

export const riskMatrixRouter = createTRPCRouter({
  /**
   * Create Matrix Template (AC8)
   *
   * Creates a new risk matrix template with name, dimensionCount, and outputScaleMax.
   * AC12: Mutations require ORG_ADMIN role
   * AC24: Duplicate name rejected with user-friendly error
   * AC22: dimensionCount must be 2 or 3
   * AC23: outputScaleMax must be positive, max 1000
   */
  createTemplate: adminProcedure
    .input(createMatrixTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check unique name within organization (AC24)
      const existing = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A risk matrix template with this name already exists",
        });
      }

      // Get pre-seeded defaults based on gridSize and dimensionCount
      const defaults = getDefaultsForGridSize(
        input.gridSize as 3 | 4 | 5,
        input.dimensionCount as 2 | 3
      );

      // Create template and initial draft version in a transaction
      const templateId = randomUUID();
      const versionId = randomUUID();

      const [newTemplate, newVersion] = await ctx.db.$transaction([
        ctx.db.riskMatrixTemplate.create({
          data: {
            id: templateId,
            organizationId: ctx.organizationId!,
            name: input.name,
            description: input.description ?? null,
            dimensionCount: input.dimensionCount,
            gridSize: input.gridSize, // Story 11.1: Save gridSize
            outputScaleMax: new Prisma.Decimal(input.outputScaleMax),
            isActive: true,
          },
        }),
        // Create pre-seeded draft version
        ctx.db.riskMatrixVersion.create({
          data: {
            id: versionId,
            templateId: templateId,
            versionNumber: 1,
            scales: defaults.scales as unknown as object,
            thresholds: defaults.thresholds as unknown as object[],
            isActive: false, // Draft starts inactive
          },
        }),
      ]);

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixTemplate",
          entityId: newTemplate.id,
          changes: {
            action: "CREATE",
            name: input.name,
            dimensionCount: input.dimensionCount,
            gridSize: input.gridSize, // Story 11.1
            outputScaleMax: input.outputScaleMax,
            initialVersionId: newVersion.id,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        ...newTemplate,
        outputScaleMax: Number(newTemplate.outputScaleMax),
        initialVersionId: newVersion.id,
      };
    }),

  /**
   * Update Matrix Template (AC9)
   *
   * Updates name and description only.
   * AC12: Cannot change dimensionCount or outputScaleMax after creation
   * AC13: Soft delete via isActive flag
   * AC14: Cannot deactivate template with assessments using its versions
   */
  updateTemplate: adminProcedure
    .input(updateMatrixTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify template exists and belongs to organization
      const existing = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // If name is changing, check uniqueness (AC24)
      if (input.name && input.name !== existing.name) {
        const nameConflict = await ctx.db.riskMatrixTemplate.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: input.name,
            id: { not: input.id },
          },
        });

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A risk matrix template with this name already exists",
          });
        }
      }

      // AC14: If deactivating, check for assessments using this template's versions
      if (input.isActive === false && existing.isActive === true) {
        // Check if any assessments are using versions from this template
        // Note: In Story 7.8.3, we'll add proper version checking
        // For now, just check if currentVersionId is set (meaning at least one version exists)
        if (existing.currentVersionId) {
          // When RiskMatrixVersion is added in 7.8.3, this will check:
          // const assessmentCount = await ctx.db.riskAssessment.count({
          //   where: {
          //     matrixVersionId: { in: versionIds },
          //     status: { not: "REJECTED" },
          //   },
          // });

          // For now, prevent deactivation if any version is published
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot deactivate: This template has a published version.",
          });
        }
      }

      const updatedTemplate = await ctx.db.riskMatrixTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixTemplate",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            before: {
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
            },
            after: {
              name: updatedTemplate.name,
              description: updatedTemplate.description,
              isActive: updatedTemplate.isActive,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        ...updatedTemplate,
        outputScaleMax: Number(updatedTemplate.outputScaleMax),
      };
    }),

  /**
   * List Matrix Templates (AC10)
   *
   * Returns templates for organization with version count.
   * Story 7.8.3: Now includes actual version counts.
   */
  listTemplates: adminProcedure
    .input(listMatrixTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const templates = await ctx.db.riskMatrixTemplate.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: {
            select: { versions: true },
          },
        },
        orderBy: [
          { isDefault: "desc" }, // Default first
          { isActive: "desc" }, // Then active
          { name: "asc" },
        ],
      });

      return templates.map((template) => ({
        ...template,
        outputScaleMax: Number(template.outputScaleMax),
        gridSize: template.gridSize, // Explicitly include for TypeScript inference
        versionCount: template._count.versions,
        hasPublishedVersion: !!template.currentVersionId,
        // Story 7.8.4: isDefault indicates the system-seeded template
      }));
    }),

  /**
   * Get Matrix Template by ID (AC11)
   *
   * Returns single template with version details.
   * Story 7.8.3: Now includes versions list.
   */
  getTemplate: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          versions: {
            include: {
              publisher: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { versionNumber: "desc" },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      return {
        ...template,
        outputScaleMax: Number(template.outputScaleMax),
        gridSize: template.gridSize, // Explicitly include for TypeScript inference
        versions: template.versions.map((v) => ({
          ...v,
          scales: v.scales as unknown as MatrixScales,
          thresholds: v.thresholds as unknown as Threshold[],
          isCurrent: template.currentVersionId === v.id,
          isDraft: !v.publishedAt,
        })),
        versionCount: template.versions.length,
        hasPublishedVersion: !!template.currentVersionId,
      };
    }),

  /**
   * Get Active Templates for Dropdown
   *
   * Returns active templates for use in assessment forms.
   * Uses organizationProcedure since any authenticated user may need this for reading.
   */
  getActiveTemplates: organizationProcedure
    .query(async ({ ctx }) => {
      const templates = await ctx.db.riskMatrixTemplate.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          currentVersionId: { not: null }, // Only templates with published versions
        },
        select: {
          id: true,
          name: true,
          description: true,
          dimensionCount: true,
          gridSize: true, // Story 11.1
          outputScaleMax: true,
        },
        orderBy: { name: "asc" },
      });

      return templates.map((t) => ({
        ...t,
        outputScaleMax: Number(t.outputScaleMax),
      }));
    }),

  /**
   * Get Organization's Published Matrix
   *
   * Story 16.4: Returns the org's default published matrix version for residual severity UI.
   * Returns scales, thresholds, and output scale max for client-side score preview.
   */
  getOrgPublishedMatrix: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;

    // Get the org's default template with published version
    const defaultTemplate = await ctx.db.riskMatrixTemplate.findFirst({
      where: {
        organizationId,
        isDefault: true,
        isActive: true,
        currentVersionId: { not: null },
      },
      include: {
        currentVersion: true,
      },
    });

    if (!defaultTemplate?.currentVersion) {
      return null;
    }

    const version = defaultTemplate.currentVersion;

    return {
      versionId: version.id,
      templateId: defaultTemplate.id,
      templateName: defaultTemplate.name,
      dimensionCount: defaultTemplate.dimensionCount,
      gridSize: defaultTemplate.gridSize,
      outputScaleMax: Number(defaultTemplate.outputScaleMax),
      scales: version.scales as unknown as MatrixScales,
      thresholds: version.thresholds as unknown as Threshold[],
    };
  }),

  /**
   * Get Active Templates with Current Version Details
   *
   * Story 7.8.9: Returns templates with their current version info for the MatrixSelector.
   * AC6: Assessment form includes Matrix dropdown
   * AC7: Dropdown shows active matrix templates with published versions
   * AC10: Matrix version displayed: "Standard Risk Matrix v2"
   */
  getTemplatesWithVersions: organizationProcedure
    .query(async ({ ctx }) => {
      const templates = await ctx.db.riskMatrixTemplate.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          currentVersionId: { not: null },
        },
        include: {
          currentVersion: {
            select: {
              id: true,
              versionNumber: true,
            },
          },
        },
        orderBy: [
          { isDefault: "desc" }, // Default first
          { name: "asc" },
        ],
      });

      return templates
        .filter((t) => t.currentVersion !== null)
        .map((t) => ({
          templateId: t.id,
          versionId: t.currentVersion!.id,
          name: t.name,
          description: t.description,
          dimensionCount: t.dimensionCount,
          gridSize: t.gridSize, // Story 11.1
          outputScaleMax: Number(t.outputScaleMax),
          versionNumber: t.currentVersion!.versionNumber,
          displayLabel: `${t.name} v${t.currentVersion!.versionNumber}`,
          isDefault: t.isDefault,
        }));
    }),

  /**
   * Get Version for Assessment Form
   *
   * Story 7.8.9: Returns version details for assessment scoring.
   * Uses organizationProcedure since any authenticated user may need this for assessments.
   * AC11-AC17: Scale selectors need version scales and thresholds.
   */
  getVersionForAssessment: organizationProcedure
    .input(getVersionSchema)
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: input.id,
          template: { organizationId: ctx.organizationId! },
          publishedAt: { not: null }, // Only published versions accessible
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              dimensionCount: true,
              gridSize: true, // Story 11.1
              outputScaleMax: true,
            },
          },
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      return {
        id: version.id,
        versionNumber: version.versionNumber,
        scales: version.scales as unknown as MatrixScales,
        thresholds: version.thresholds as unknown as Threshold[],
        template: {
          id: version.template.id,
          name: version.template.name,
          dimensionCount: version.template.dimensionCount,
          gridSize: version.template.gridSize, // Story 11.1
          outputScaleMax: Number(version.template.outputScaleMax),
        },
      };
    }),

  /**
   * Check if Template can be deactivated
   *
   * Returns status with details about what's preventing deactivation.
   */
  canDeactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify template belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // Check if has published version
      const hasPublishedVersion = !!template.currentVersionId;

      return {
        canDeactivate: !hasPublishedVersion,
        hasPublishedVersion,
        assessmentCount: 0,
        reason: hasPublishedVersion
          ? "This template has a published version."
          : null,
      };
    }),

  // ============================================================================
  // Story 7.8.3: RiskMatrixVersion CRUD Operations (AC25-AC30)
  // ============================================================================

  /**
   * Create Version (AC25)
   *
   * Creates a new draft version from template or copies existing version.
   * AC19: New versions start as draft (isActive = false)
   * AC5: versionNumber auto-incremented per template
   */
  createVersion: adminProcedure
    .input(createVersionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify template exists and belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organization: { id: ctx.organizationId! },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // Get next version number (AC5)
      const lastVersion = await ctx.db.riskMatrixVersion.findFirst({
        where: { templateId: input.templateId },
        orderBy: { versionNumber: "desc" },
      });
      const newVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

      // Determine initial scales and thresholds
      let scalesData: object;
      let thresholdsData: object[];

      if (input.copyFromVersionId) {
        // Copy from existing version
        const sourceVersion = await ctx.db.riskMatrixVersion.findFirst({
          where: {
            id: input.copyFromVersionId,
            template: { organization: { id: ctx.organizationId! } },
          },
        });

        if (!sourceVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source version not found",
          });
        }

        scalesData = sourceVersion.scales as object;
        thresholdsData = sourceVersion.thresholds as object[];
      } else {
        // Use provided or empty defaults
        scalesData = input.scales ?? {
          likelihood: [],
          impact: [],
          ...(template.dimensionCount === 3 ? { exposure: [] } : {}),
        };
        thresholdsData = input.thresholds ?? [];
      }

      const newVersion = await ctx.db.riskMatrixVersion.create({
        data: {
          id: randomUUID(),
          templateId: input.templateId,
          versionNumber: newVersionNumber,
          scales: scalesData,
          thresholds: thresholdsData,
          isActive: false, // AC19: Drafts start inactive
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixVersion",
          entityId: newVersion.id,
          changes: {
            action: "CREATE",
            templateId: input.templateId,
            versionNumber: newVersionNumber,
            copiedFrom: input.copyFromVersionId ?? null,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        ...newVersion,
        scales: newVersion.scales as unknown as MatrixScales,
        thresholds: newVersion.thresholds as unknown as Threshold[],
      };
    }),

  /**
   * Update Version (AC26)
   *
   * Updates draft version scales and/or thresholds.
   * AC20: Draft versions can be edited freely
   * AC23: Published versions cannot be edited (immutable)
   */
  updateVersion: adminProcedure
    .input(updateVersionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify version exists and belongs to organization
      const existing = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: input.id,
          template: { organization: { id: ctx.organizationId! } },
        },
        include: { template: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      // AC23: Published versions cannot be edited
      if (existing.publishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Published versions cannot be edited",
        });
      }

      const updatedVersion = await ctx.db.riskMatrixVersion.update({
        where: { id: input.id },
        data: {
          ...(input.scales !== undefined && { scales: input.scales }),
          ...(input.thresholds !== undefined && { thresholds: input.thresholds }),
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixVersion",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            versionNumber: existing.versionNumber,
            scalesUpdated: input.scales !== undefined,
            thresholdsUpdated: input.thresholds !== undefined,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        ...updatedVersion,
        scales: updatedVersion.scales as unknown as MatrixScales,
        thresholds: updatedVersion.thresholds as unknown as Threshold[],
      };
    }),

  /**
   * Publish Version (AC27)
   *
   * Publishes a draft version after validation.
   * AC21: Publishing sets isActive = true, publishedAt, publishedBy
   * AC22: Publishing updates template.currentVersionId
   * AC24: Multiple drafts allowed, only one active/current version
   */
  publishVersion: adminProcedure
    .input(publishVersionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify version exists and belongs to organization
      const existing = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: input.id,
          template: { organization: { id: ctx.organizationId! } },
        },
        include: { template: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      // Cannot republish already published version
      if (existing.publishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Version is already published",
        });
      }

      // Validate scales and thresholds before publishing (AC9-AC18)
      // Story 11.1: Include gridSize validation
      const validation = validateMatrixVersion(
        existing.scales as unknown as MatrixScales,
        existing.thresholds as unknown as Threshold[],
        existing.template.dimensionCount,
        Number(existing.template.outputScaleMax),
        existing.template.gridSize
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot publish: ${validation.errors.join("; ")}`,
        });
      }

      // Publish version and update template in a transaction
      const [publishedVersion] = await ctx.db.$transaction([
        // AC21: Set isActive, publishedAt, publishedBy
        ctx.db.riskMatrixVersion.update({
          where: { id: input.id },
          data: {
            isActive: true,
            publishedAt: new Date(),
            publishedBy: ctx.session!.user.id,
          },
        }),
        // AC22: Update template.currentVersionId
        ctx.db.riskMatrixTemplate.update({
          where: { id: existing.templateId },
          data: { currentVersionId: input.id },
        }),
      ]);

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixVersion",
          entityId: input.id,
          changes: {
            action: "PUBLISH",
            templateId: existing.templateId,
            versionNumber: existing.versionNumber,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return {
        ...publishedVersion,
        scales: publishedVersion.scales as unknown as MatrixScales,
        thresholds: publishedVersion.thresholds as unknown as Threshold[],
      };
    }),

  /**
   * List Versions (AC28)
   *
   * Returns all versions for a template with publish status.
   */
  listVersions: adminProcedure
    .input(listVersionsSchema)
    .query(async ({ ctx, input }) => {
      // Verify template belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organization: { id: ctx.organizationId! },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      const versions = await ctx.db.riskMatrixVersion.findMany({
        where: {
          templateId: input.templateId,
          ...(input.includeDrafts ? {} : { publishedAt: { not: null } }),
        },
        include: {
          publisher: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { versionNumber: "desc" },
      });

      return versions.map((v) => ({
        ...v,
        scales: v.scales as unknown as MatrixScales,
        thresholds: v.thresholds as unknown as Threshold[],
        isCurrent: template.currentVersionId === v.id,
        isDraft: !v.publishedAt,
      }));
    }),

  /**
   * Get Version (AC29)
   *
   * Returns full version details including scales and thresholds.
   * Read access: ORG_ADMIN + managers/analysts/engineers so the risk-scoring
   * selects populate during assessments. Editing stays admin-only.
   */
  getVersion: organizationProcedure
    .use(requireRole(MATRIX_READ_ROLES))
    .input(getVersionSchema)
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: input.id,
          template: { organization: { id: ctx.organizationId! } },
        },
        include: {
          template: true,
          publisher: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      return {
        ...version,
        scales: version.scales as unknown as MatrixScales,
        thresholds: version.thresholds as unknown as Threshold[],
        template: {
          ...version.template,
          outputScaleMax: Number(version.template.outputScaleMax),
        },
        isCurrent: version.template.currentVersionId === version.id,
        isDraft: !version.publishedAt,
      };
    }),

  /**
   * Delete Version (AC30)
   *
   * Deletes a draft version only. Published versions cannot be deleted.
   */
  deleteVersion: adminProcedure
    .input(deleteVersionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify version exists and belongs to organization
      const existing = await ctx.db.riskMatrixVersion.findFirst({
        where: {
          id: input.id,
          template: { organization: { id: ctx.organizationId! } },
        },
        include: { template: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix version not found",
        });
      }

      // Cannot delete published versions
      if (existing.publishedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Published versions cannot be deleted",
        });
      }

      await ctx.db.riskMatrixVersion.delete({
        where: { id: input.id },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixVersion",
          entityId: input.id,
          changes: {
            action: "DELETE",
            templateId: existing.templateId,
            versionNumber: existing.versionNumber,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true, id: input.id };
    }),

  // ============================================================================
  // Story 11.8: Default Matrix & Activation Management (AC1-AC26)
  // ============================================================================

  /**
   * Set Matrix Template as Default (AC1-AC7)
   *
   * Sets a template as the organization's default risk matrix.
   * AC1: Only active, published templates can be default
   * AC2-AC3: Atomic swap ensures only one default per org
   * AC7: Audit logging for default changes
   */
  setAsDefault: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify template exists and belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
        },
        include: {
          versions: {
            where: { publishedAt: { not: null } },
            take: 1,
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // AC1: Cannot set inactive template as default
      if (!template.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot set inactive template as default. Activate it first.",
        });
      }

      // AC25: Must have a published version
      if (template.versions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Template must have a published version to be set as default.",
        });
      }

      // Already default?
      if (template.isDefault) {
        return { success: true, alreadyDefault: true };
      }

      // Get current default for audit log
      const currentDefault = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          isDefault: true,
        },
      });

      // AC2-AC3: Atomic swap - remove old default, set new
      await ctx.db.$transaction([
        ctx.db.riskMatrixTemplate.updateMany({
          where: {
            organizationId: ctx.organizationId!,
            isDefault: true,
          },
          data: { isDefault: false },
        }),
        ctx.db.riskMatrixTemplate.update({
          where: { id: input.templateId },
          data: { isDefault: true },
        }),
      ]);

      // AC7: Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixTemplate",
          entityId: input.templateId,
          changes: {
            action: "SET_DEFAULT",
            newDefault: template.name,
            previousDefault: currentDefault?.name ?? null,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),

  /**
   * Activate Matrix Template (AC8-AC13)
   *
   * Reactivates a previously deactivated template.
   * AC13: Audit logging for activation changes
   */
  activate: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify template exists and belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // Already active?
      if (template.isActive) {
        return { success: true, alreadyActive: true };
      }

      await ctx.db.riskMatrixTemplate.update({
        where: { id: input.templateId },
        data: { isActive: true },
      });

      // AC13: Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixTemplate",
          entityId: input.templateId,
          changes: {
            action: "ACTIVATE",
            templateName: template.name,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),

  /**
   * Deactivate Matrix Template (AC8-AC13)
   *
   * Deactivates a template, making it unavailable for new assessments.
   * AC5/AC12/AC23: Cannot deactivate the default matrix
   * AC11: Warning when assessments are using this matrix
   * AC13: Audit logging for deactivation changes
   */
  deactivate: adminProcedure
    .input(z.object({
      templateId: z.string(),
      force: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify template exists and belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
        },
        include: {
          versions: {
            select: { id: true },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      // AC5/AC12/AC23: Cannot deactivate default matrix
      if (template.isDefault) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate the default matrix. Set another matrix as default first.",
        });
      }

      // Already inactive?
      if (!template.isActive) {
        return { success: true, alreadyInactive: true };
      }

      // AC11: Check for active assessments using this template's versions
      // Note: AssessmentStatus only has DRAFT, APPROVED, REJECTED - check for DRAFT (active) assessments
      const versionIds = template.versions.map((v) => v.id);
      if (versionIds.length > 0 && !input.force) {
        const activeAssessmentCount = await ctx.db.riskAssessment.count({
          where: {
            matrixVersionId: { in: versionIds },
            status: "DRAFT",
          },
        });

        if (activeAssessmentCount > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot deactivate: ${activeAssessmentCount} active assessment(s) use this matrix. Use force option to override.`,
          });
        }
      }

      await ctx.db.riskMatrixTemplate.update({
        where: { id: input.templateId },
        data: { isActive: false },
      });

      // AC13: Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "RiskMatrixTemplate",
          entityId: input.templateId,
          changes: {
            action: "DEACTIVATE",
            templateName: template.name,
            forced: input.force,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),

  /**
   * Check Deactivation Impact (AC11)
   *
   * Returns count of active assessments using this template.
   */
  checkDeactivationImpact: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify template belongs to organization
      const template = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId!,
        },
        include: {
          versions: { select: { id: true } },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk matrix template not found",
        });
      }

      const versionIds = template.versions.map((v) => v.id);
      let activeAssessmentCount = 0;

      if (versionIds.length > 0) {
        activeAssessmentCount = await ctx.db.riskAssessment.count({
          where: {
            matrixVersionId: { in: versionIds },
            status: "DRAFT",
          },
        });
      }

      return {
        isDefault: template.isDefault,
        activeAssessmentCount,
        canDeactivate: !template.isDefault,
        warningMessage: template.isDefault
          ? "This is the default matrix. Set another matrix as default before deactivating."
          : activeAssessmentCount > 0
            ? `${activeAssessmentCount} active assessment(s) use this matrix.`
            : null,
      };
    }),

  /**
   * Get Current Default Template
   *
   * Returns the organization's default risk matrix template.
   */
  getDefault: organizationProcedure
    .query(async ({ ctx }) => {
      // Prefer the explicitly-marked default; fall back to any active matrix
      // with a published version so consumers (e.g. CreateFindingDialog) get
      // matrix-aligned options even when no default flag has been set yet.
      const include = {
        currentVersion: {
          select: {
            id: true,
            versionNumber: true,
            thresholds: true,
            scales: true,
          },
        },
      } as const;
      const defaultTemplate =
        (await ctx.db.riskMatrixTemplate.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            isDefault: true,
            isActive: true,
            currentVersionId: { not: null },
          },
          include,
        })) ??
        (await ctx.db.riskMatrixTemplate.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            isActive: true,
            currentVersionId: { not: null },
          },
          orderBy: { updatedAt: "desc" },
          include,
        }));

      if (!defaultTemplate) {
        return null;
      }

      return {
        id: defaultTemplate.id,
        name: defaultTemplate.name,
        dimensionCount: defaultTemplate.dimensionCount,
        gridSize: defaultTemplate.gridSize,
        outputScaleMax: Number(defaultTemplate.outputScaleMax),
        currentVersionId: defaultTemplate.currentVersionId,
        currentVersionNumber: defaultTemplate.currentVersion?.versionNumber ?? null,
        // Threshold labels surface to UIs that need matrix-aligned severity
        // options (e.g., CreateFindingDialog), so findings and risks share
        // the same qualitative vocabulary.
        thresholds:
          (defaultTemplate.currentVersion?.thresholds as unknown as Threshold[] | null) ?? null,
        // Scales (L/I/E levels) so scoring UIs can render level selectors that
        // match the matrix; exposure is present only for 3D matrices.
        scales:
          (defaultTemplate.currentVersion?.scales as unknown as MatrixScales | null) ?? null,
      };
    }),
});
