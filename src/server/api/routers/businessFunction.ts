/**
 * Business Function tRPC Router
 *
 * Epic 10: BIA Core Module
 * Story 10.1: Business Function Data Model & CRUD
 *
 * Provides CRUD operations for Business Functions - parent categories
 * for organizing Business Processes.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { UserRole, AuditAction, BusinessProcessStatus } from "@prisma/client";
import { createAuditLog } from "@/server/services/audit-log.service";
import { generateIdentifier } from "@/server/services/identifierService";

// Roles that can view business functions
const BF_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// Roles that can manage business functions
const BF_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

// Input schemas
const createBusinessFunctionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
});

const updateBusinessFunctionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

const listBusinessFunctionSchema = z.object({
  includeInactive: z.boolean().default(false),
  search: z.string().optional(),
});

export const businessFunctionRouter = createTRPCRouter({
  /**
   * List all business functions for the organization
   */
  list: organizationProcedure
    .use(requireRole(BF_VIEW_ROLES))
    .input(listBusinessFunctionSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        organizationId,
      };

      if (!input.includeInactive) {
        where.isActive = true;
      }

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { identifier: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const functions = await ctx.db.businessFunction.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              businessProcesses: {
                where: {
                  status: { not: BusinessProcessStatus.DELETED },
                },
              },
            },
          },
        },
      });

      return functions.map((fn) => ({
        ...fn,
        processCount: fn._count.businessProcesses,
      }));
    }),

  /**
   * Get a single business function by ID
   */
  getById: organizationProcedure
    .use(requireRole(BF_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const fn = await ctx.db.businessFunction.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          businessProcesses: {
            where: {
              status: { not: BusinessProcessStatus.DELETED },
            },
            select: {
              id: true,
              identifier: true,
              name: true,
              status: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!fn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business function not found",
        });
      }

      return fn;
    }),

  /**
   * Create a new business function
   */
  create: organizationProcedure
    .use(requireRole(BF_MANAGE_ROLES))
    .input(createBusinessFunctionSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Generate unique identifier
      const identifier = await generateIdentifier(organizationId, "BF");

      const fn = await ctx.db.businessFunction.create({
        data: {
          organizationId,
          identifier,
          name: input.name,
          description: input.description,
          createdById: ctx.session!.user.id,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_FUNCTION_CREATED,
        entityType: "BusinessFunction",
        entityId: fn.id,
        changes: {
          after: {
            identifier: fn.identifier,
            name: fn.name,
            description: fn.description,
          },
        },
      });

      return fn;
    }),

  /**
   * Update an existing business function
   */
  update: organizationProcedure
    .use(requireRole(BF_MANAGE_ROLES))
    .input(updateBusinessFunctionSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get existing function
      const existing = await ctx.db.businessFunction.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business function not found",
        });
      }

      const fn = await ctx.db.businessFunction.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_FUNCTION_UPDATED,
        entityType: "BusinessFunction",
        entityId: fn.id,
        changes: {
          before: {
            name: existing.name,
            description: existing.description,
            isActive: existing.isActive,
          },
          after: {
            name: fn.name,
            description: fn.description,
            isActive: fn.isActive,
          },
        },
      });

      return fn;
    }),

  /**
   * Delete a business function
   * Only allowed if no child processes exist
   */
  delete: organizationProcedure
    .use(requireRole(BF_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get function with process count
      const fn = await ctx.db.businessFunction.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          _count: {
            select: {
              businessProcesses: {
                where: {
                  status: { not: BusinessProcessStatus.DELETED },
                },
              },
            },
          },
        },
      });

      if (!fn) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business function not found",
        });
      }

      if (fn._count.businessProcesses > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete: ${fn._count.businessProcesses} business process(es) are assigned to this function. Reassign or delete them first.`,
        });
      }

      await ctx.db.businessFunction.delete({
        where: { id: input.id },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_FUNCTION_DELETED,
        entityType: "BusinessFunction",
        entityId: fn.id,
        changes: {
          before: {
            identifier: fn.identifier,
            name: fn.name,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Check if a business function can be deleted
   */
  canDelete: organizationProcedure
    .use(requireRole(BF_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const fn = await ctx.db.businessFunction.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          _count: {
            select: {
              businessProcesses: {
                where: {
                  status: { not: BusinessProcessStatus.DELETED },
                },
              },
            },
          },
        },
      });

      if (!fn) {
        return { canDelete: false, reason: "Business function not found" };
      }

      if (fn._count.businessProcesses > 0) {
        return {
          canDelete: false,
          reason: `${fn._count.businessProcesses} business process(es) are assigned to this function`,
          processCount: fn._count.businessProcesses,
        };
      }

      return { canDelete: true };
    }),
});
