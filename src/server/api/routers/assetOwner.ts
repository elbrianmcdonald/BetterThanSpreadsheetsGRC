/**
 * Asset Owner tRPC Router
 *
 * Epic 14: Asset Registry & BIA Integration
 * Manages asset owners as a separate entity from users
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { UserRole } from "@prisma/client";

// Roles that can view asset owners
const OWNER_VIEW_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// Roles that can manage asset owners
const OWNER_MANAGE_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

// Input schemas
const createOwnerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  department: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
});

const updateOwnerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(50).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  title: z.string().max(100).optional().nullable(),
});

const listOwnerSchema = z.object({
  search: z.string().optional(),
});

export const assetOwnerRouter = createTRPCRouter({
  /**
   * List all asset owners
   */
  list: organizationProcedure
    .use(requireRole(OWNER_VIEW_ROLES))
    .input(listOwnerSchema)
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
          { department: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const owners = await ctx.db.assetOwner.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { assets: true },
          },
        },
      });

      return owners;
    }),

  /**
   * Get a single asset owner by ID
   */
  getById: organizationProcedure
    .use(requireRole(OWNER_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const owner = await ctx.db.assetOwner.findFirst({
        where: { id: input.id },
        include: {
          assets: {
            select: {
              id: true,
              identifier: true,
              name: true,
              type: true,
              status: true,
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });

      if (!owner) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset owner not found",
        });
      }

      return owner;
    }),

  /**
   * Create a new asset owner
   */
  create: organizationProcedure
    .use(requireRole(OWNER_MANAGE_ROLES))
    .input(createOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Check for existing owner with same name
      const existing = await ctx.db.assetOwner.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An owner with this name already exists",
        });
      }

      const owner = await ctx.db.assetOwner.create({
        data: {
          organizationId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          department: input.department || null,
          title: input.title || null,
          createdById: userId,
        },
      });

      return owner;
    }),

  /**
   * Quick create - for inline creation from dropdowns
   */
  quickCreate: organizationProcedure
    .use(requireRole(OWNER_MANAGE_ROLES))
    .input(createOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Check for existing owner with same name (return it if exists)
      const existing = await ctx.db.assetOwner.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
        },
      });

      if (existing) {
        return existing;
      }

      const owner = await ctx.db.assetOwner.create({
        data: {
          organizationId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          department: input.department || null,
          title: input.title || null,
          createdById: userId,
        },
      });

      return owner;
    }),

  /**
   * Update an asset owner
   */
  update: organizationProcedure
    .use(requireRole(OWNER_MANAGE_ROLES))
    .input(updateOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check owner exists
      const existing = await ctx.db.assetOwner.findFirst({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset owner not found",
        });
      }

      // Check name uniqueness if changing name
      if (data.name && data.name !== existing.name) {
        const nameConflict = await ctx.db.assetOwner.findFirst({
          where: {
            name: { equals: data.name, mode: "insensitive" },
            id: { not: id },
          },
        });

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An owner with this name already exists",
          });
        }
      }

      const owner = await ctx.db.assetOwner.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email === "" ? null : data.email,
          phone: data.phone === "" ? null : data.phone,
          department: data.department === "" ? null : data.department,
          title: data.title === "" ? null : data.title,
        },
      });

      return owner;
    }),

  /**
   * Delete an asset owner
   */
  delete: organizationProcedure
    .use(requireRole(OWNER_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.assetOwner.findFirst({
        where: { id: input.id },
        include: {
          _count: {
            select: { assets: true },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset owner not found",
        });
      }

      if (existing._count.assets > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete owner with ${existing._count.assets} assigned assets. Reassign assets first.`,
        });
      }

      await ctx.db.assetOwner.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
