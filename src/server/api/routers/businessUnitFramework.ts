/**
 * Business Unit Framework Router
 *
 * BU-Scoped Compliance: Manages framework-to-business-unit assignments
 *
 * Enables admins to assign which frameworks apply to which business units,
 * supporting BU-specific compliance tracking.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requirePermission,
  requireRole,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createAuditLog } from "@/server/services/audit-log.service";
import { migrateOrganizationToBUScoped } from "@/server/services/buScopedMigration";

export const businessUnitFrameworkRouter = createTRPCRouter({
  /**
   * List all BU-Framework assignments for the organization
   */
  list: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }) => {
      const assignments = await ctx.db.businessUnitFramework.findMany({
        where: { organizationId: ctx.organizationId! },
        include: {
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
          framework: {
            select: { id: true, code: true, name: true, version: true, isActive: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [
          { businessUnit: { name: "asc" } },
          { framework: { name: "asc" } },
        ],
      });

      return assignments;
    }),

  /**
   * Get frameworks assigned to a specific business unit
   */
  getByBusinessUnit: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ businessUnitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignments = await ctx.db.businessUnitFramework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          businessUnitId: input.businessUnitId,
        },
        include: {
          framework: {
            select: { id: true, code: true, name: true, version: true, isActive: true },
          },
        },
        orderBy: { framework: { name: "asc" } },
      });

      return assignments.map((a) => a.framework);
    }),

  /**
   * Get business units assigned to a specific framework
   */
  getByFramework: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ frameworkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignments = await ctx.db.businessUnitFramework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          frameworkId: input.frameworkId,
        },
        include: {
          businessUnit: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { businessUnit: { name: "asc" } },
      });

      return assignments.map((a) => a.businessUnit);
    }),

  /**
   * Assign a framework to a business unit
   */
  assign: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        businessUnitId: z.string(),
        frameworkId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify business unit exists
      const bu = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.businessUnitId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      if (!bu) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      // Verify framework exists
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Check if already assigned
      const existing = await ctx.db.businessUnitFramework.findUnique({
        where: {
          businessUnitId_frameworkId: {
            businessUnitId: input.businessUnitId,
            frameworkId: input.frameworkId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Framework is already assigned to this business unit",
        });
      }

      // Create assignment
      const assignment = await ctx.db.businessUnitFramework.create({
        data: {
          businessUnitId: input.businessUnitId,
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
          assignedById: ctx.session?.user.id,
        },
        include: {
          businessUnit: { select: { name: true } },
          framework: { select: { name: true, code: true } },
        },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "ACTIVATE_FRAMEWORK",
        entityType: "BusinessUnitFramework",
        entityId: assignment.id,
        changes: {
          after: {
            businessUnit: assignment.businessUnit.name,
            framework: `${assignment.framework.name} (${assignment.framework.code})`,
          },
        },
      });

      return assignment;
    }),

  /**
   * Remove a framework assignment from a business unit
   */
  unassign: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        businessUnitId: z.string(),
        frameworkId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find existing assignment
      const existing = await ctx.db.businessUnitFramework.findFirst({
        where: {
          businessUnitId: input.businessUnitId,
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        include: {
          businessUnit: { select: { name: true } },
          framework: { select: { name: true, code: true } },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assignment not found",
        });
      }

      // Delete assignment
      await ctx.db.businessUnitFramework.delete({
        where: { id: existing.id },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DEACTIVATE_FRAMEWORK",
        entityType: "BusinessUnitFramework",
        entityId: existing.id,
        changes: {
          before: {
            businessUnit: existing.businessUnit.name,
            framework: `${existing.framework.name} (${existing.framework.code})`,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Bulk assign frameworks to a business unit
   */
  bulkAssign: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        businessUnitId: z.string(),
        frameworkIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify business unit exists
      const bu = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.businessUnitId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      if (!bu) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      // Verify all frameworks exist
      const frameworks = await ctx.db.framework.findMany({
        where: {
          id: { in: input.frameworkIds },
          organizationId: ctx.organizationId!,
        },
      });

      if (frameworks.length !== input.frameworkIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more frameworks not found",
        });
      }

      // Get existing assignments
      const existing = await ctx.db.businessUnitFramework.findMany({
        where: {
          businessUnitId: input.businessUnitId,
          organizationId: ctx.organizationId!,
        },
        select: { frameworkId: true },
      });

      const existingIds = new Set(existing.map((e) => e.frameworkId));
      const newIds = input.frameworkIds.filter((id) => !existingIds.has(id));

      // Create new assignments
      if (newIds.length > 0) {
        await ctx.db.businessUnitFramework.createMany({
          data: newIds.map((frameworkId) => ({
            businessUnitId: input.businessUnitId,
            frameworkId,
            organizationId: ctx.organizationId!,
            assignedById: ctx.session?.user.id,
          })),
        });
      }

      return {
        added: newIds.length,
        skipped: input.frameworkIds.length - newIds.length,
      };
    }),

  /**
   * Sync frameworks for a business unit (replace all assignments)
   */
  sync: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        businessUnitId: z.string(),
        frameworkIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify business unit exists
      const bu = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.businessUnitId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      if (!bu) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      // Transaction: delete all existing, create new
      await ctx.db.$transaction(async (tx) => {
        // Delete all existing assignments for this BU
        await tx.businessUnitFramework.deleteMany({
          where: {
            businessUnitId: input.businessUnitId,
            organizationId: ctx.organizationId!,
          },
        });

        // Create new assignments
        if (input.frameworkIds.length > 0) {
          await tx.businessUnitFramework.createMany({
            data: input.frameworkIds.map((frameworkId) => ({
              businessUnitId: input.businessUnitId,
              frameworkId,
              organizationId: ctx.organizationId!,
              assignedById: ctx.session?.user.id,
            })),
          });
        }
      });

      return { assigned: input.frameworkIds.length };
    }),

  /**
   * Get a matrix view of all BUs and Frameworks with assignment status
   */
  getMatrix: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }) => {
      const [businessUnits, frameworks, assignments] = await Promise.all([
        ctx.db.businessUnit.findMany({
          where: { organizationId: ctx.organizationId!, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        }),
        ctx.db.framework.findMany({
          where: { organizationId: ctx.organizationId!, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true, version: true },
        }),
        ctx.db.businessUnitFramework.findMany({
          where: { organizationId: ctx.organizationId! },
          select: { businessUnitId: true, frameworkId: true },
        }),
      ]);

      // Build assignment lookup
      const assignmentSet = new Set(
        assignments.map((a) => `${a.businessUnitId}:${a.frameworkId}`)
      );

      return {
        businessUnits,
        frameworks,
        assignments: assignmentSet,
        isAssigned: (buId: string, fwId: string) =>
          assignmentSet.has(`${buId}:${fwId}`),
      };
    }),

  /**
   * Migrate organization to BU-scoped compliance
   *
   * BU-Scoped Compliance: Story 6 - Data Migration
   *
   * This migration:
   * 1. Creates a default "Organization-Wide" BU if none exists
   * 2. Assigns all existing evidence without a BU to the default BU
   * 3. Creates framework assignments for all BU-Framework pairs
   * 4. Recalculates coverage for all BU-Framework pairs
   *
   * @requires ORG_ADMIN role
   */
  migrateToScoped: organizationProcedure
    .use(requireRole(ADMIN_ROLES))
    .mutation(async ({ ctx }) => {
      const result = await migrateOrganizationToBUScoped(
        ctx.organizationId!,
        ctx.db
      );

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "SYSTEM_CONFIGURATION_CHANGED",
        entityType: "Organization",
        entityId: ctx.organizationId!,
        changes: {
          after: {
            migration: "BU-Scoped Compliance",
            createdDefaultBU: result.createdDefaultBU,
            evidenceMigrated: result.evidenceMigrated,
            frameworkAssignmentsCreated: result.frameworkAssignmentsCreated,
            coverageRecalculated: result.coverageRecalculated,
          },
        },
      });

      return result;
    }),
});
