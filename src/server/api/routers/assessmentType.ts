/**
 * Assessment Type Management tRPC Router
 *
 * Story 7.8.1: AssessmentType Schema & CRUD
 *
 * Handles CRUD operations for assessment types (IT Risk, Vendor Risk, Compliance Risk, etc.)
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: Only ORG_ADMIN can create/update/deactivate types
 * - Deactivation protection: Cannot deactivate type with active assessments
 *
 * **Features:**
 * - Soft delete via isActive flag (no hard delete)
 * - Unique name per organization
 * - Usage count included in list query
 */

import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  createTRPCRouter,
  adminProcedure,
  organizationProcedure,
} from "@/server/api/trpc";
import { AuditAction, AssessmentStatus } from "@prisma/client";

// Zod schemas for input validation (AC19-AC21)
const createAssessmentTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

const updateAssessmentTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional().nullable(),
  isActive: z.boolean().optional(),
});

const listAssessmentTypesSchema = z.object({
  includeInactive: z.boolean().default(false),
});

export const assessmentTypeRouter = createTRPCRouter({
  /**
   * Create Assessment Type (AC6)
   *
   * Creates a new assessment type with name and optional description.
   * AC12: Restricted to ORG_ADMIN role
   * AC21: Duplicate name rejected with user-friendly error
   */
  create: adminProcedure
    .input(createAssessmentTypeSchema)
    .mutation(async ({ ctx, input }) => {
      // Check unique name within organization (AC21)
      const existing = await ctx.db.assessmentType.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An assessment type with this name already exists",
        });
      }

      const newType = await ctx.db.assessmentType.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          description: input.description ?? null,
          isActive: true,
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "AssessmentType",
          entityId: newType.id,
          changes: {
            action: "CREATE",
            name: input.name,
            description: input.description,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return newType;
    }),

  /**
   * Update Assessment Type (AC7)
   *
   * Updates name, description, or isActive status.
   * AC10: Soft delete via isActive flag
   * AC11: Cannot deactivate type with active assessments
   * AC12: Restricted to ORG_ADMIN role
   */
  update: adminProcedure
    .input(updateAssessmentTypeSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify type exists and belongs to organization
      const existing = await ctx.db.assessmentType.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment type not found",
        });
      }

      // If name is changing, check uniqueness (AC21)
      if (input.name && input.name !== existing.name) {
        const nameConflict = await ctx.db.assessmentType.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: input.name,
            id: { not: input.id },
          },
        });

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An assessment type with this name already exists",
          });
        }
      }

      // If deactivating, check for active assessments (AC11)
      if (input.isActive === false && existing.isActive === true) {
        const activeAssessments = await ctx.db.riskAssessment.count({
          where: {
            assessmentTypeId: input.id,
            status: { not: AssessmentStatus.REJECTED },
          },
        });

        if (activeAssessments > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot deactivate: ${activeAssessments} active assessment${activeAssessments > 1 ? "s" : ""} use this type`,
          });
        }
      }

      const updatedType = await ctx.db.assessmentType.update({
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
          entityType: "AssessmentType",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            before: {
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
            },
            after: {
              name: updatedType.name,
              description: updatedType.description,
              isActive: updatedType.isActive,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updatedType;
    }),

  /**
   * List Assessment Types (AC8)
   *
   * Returns types for organization with assessment count.
   * AC14: Table listing shows assessment count
   * AC18: Supports filter by active/inactive status
   */
  list: adminProcedure
    .input(listAssessmentTypesSchema)
    .query(async ({ ctx, input }) => {
      const types = await ctx.db.assessmentType.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: {
            select: {
              riskAssessments: true,
            },
          },
        },
        orderBy: [
          { isDefault: "desc" }, // Default first
          { isActive: "desc" }, // Then active
          { name: "asc" },
        ],
      });

      return types.map((type) => ({
        ...type,
        assessmentCount: type._count.riskAssessments,
        // Story 7.8.4: isDefault indicates the system-seeded type (cannot be hard deleted)
      }));
    }),

  /**
   * Get Assessment Type by ID (AC9)
   *
   * Returns single type with organization isolation.
   */
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const type = await ctx.db.assessmentType.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              riskAssessments: true,
            },
          },
        },
      });

      if (!type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment type not found",
        });
      }

      return {
        ...type,
        assessmentCount: type._count.riskAssessments,
      };
    }),

  /**
   * Get Active Types for Dropdown
   *
   * Returns active types for use in assessment forms.
   * Uses organizationProcedure since any authenticated user may need this for reading.
   */
  getActiveTypes: organizationProcedure
    .query(async ({ ctx }) => {
      const types = await ctx.db.assessmentType.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: { name: "asc" },
      });

      return types;
    }),

  /**
   * Check if Assessment Type can be deactivated
   *
   * Returns status with count of assessments using the type.
   */
  canDeactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify type belongs to organization
      const type = await ctx.db.assessmentType.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment type not found",
        });
      }

      const activeAssessments = await ctx.db.riskAssessment.count({
        where: {
          assessmentTypeId: input.id,
          status: { not: AssessmentStatus.REJECTED },
        },
      });

      return {
        canDeactivate: activeAssessments === 0,
        assessmentCount: activeAssessments,
        reason: activeAssessments > 0
          ? `${activeAssessments} active assessment${activeAssessments > 1 ? "s" : ""} use this type`
          : null,
      };
    }),
});
