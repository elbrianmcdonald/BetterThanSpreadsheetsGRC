/**
 * Business Unit Management tRPC Router
 *
 * Story 7.0.3: BU Admin CRUD UI
 *
 * Handles CRUD operations for business units with hierarchical structure.
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: Only ORG_ADMIN can create/update/delete BUs
 * - Deletion protection: Cannot delete BU with users or children
 *
 * **Hierarchy Features:**
 * - Max depth: 5 levels (validated)
 * - Circular reference prevention
 * - Parent must be in same organization
 */

import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  createTRPCRouter,
  adminProcedure,
  organizationProcedure,
} from "@/server/api/trpc";
import {
  validateBUOperation,
  canDeleteBusinessUnit,
  getBUWithDescendants,
} from "@/server/services/businessUnitService";
import { AuditAction } from "@prisma/client";

// Zod schemas for input validation
const createBusinessUnitSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().max(20).optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

const updateBusinessUnitSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(100).optional(),
  code: z.string().max(20).optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const deleteBusinessUnitSchema = z.object({
  id: z.string(),
});

const listBusinessUnitsSchema = z.object({
  includeInactive: z.boolean().default(false),
});

// Types for tree structure
interface BusinessUnitWithCounts {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    users: number;
    children: number;
  };
}

interface TreeNode extends BusinessUnitWithCounts {
  children: TreeNode[];
  depth: number;
}

/**
 * Build tree structure from flat list of BUs
 */
function buildTree(flatList: BusinessUnitWithCounts[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create nodes with depth 0
  flatList.forEach((bu) => {
    map.set(bu.id, { ...bu, children: [], depth: 0 });
  });

  // Second pass: build tree and calculate depths
  flatList.forEach((bu) => {
    const node = map.get(bu.id)!;
    if (bu.parentId && map.has(bu.parentId)) {
      const parent = map.get(bu.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Third pass: update depths recursively
  function updateDepths(nodes: TreeNode[], depth: number) {
    nodes.forEach((node) => {
      node.depth = depth;
      updateDepths(node.children, depth + 1);
    });
  }
  updateDepths(roots, 0);

  return roots;
}

/**
 * Flatten tree to array with path info (for parent select)
 */
function flattenTreeWithPath(
  nodes: TreeNode[],
  prefix = ""
): Array<{ id: string; label: string; depth: number }> {
  const result: Array<{ id: string; label: string; depth: number }> = [];

  nodes.forEach((node) => {
    const label = prefix ? `${prefix} > ${node.name}` : node.name;
    result.push({ id: node.id, label, depth: node.depth });
    result.push(...flattenTreeWithPath(node.children, label));
  });

  return result;
}

export const businessUnitRouter = createTRPCRouter({
  /**
   * Get all active business units (simple list for dropdowns)
   *
   * Story 16.5: Business unit filter dropdown (AC12)
   * Accessible to all organization users
   */
  getAll: organizationProcedure.query(async ({ ctx }) => {
    const units = await ctx.db.businessUnit.findMany({
      where: {
        organizationId: ctx.organizationId!,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
      },
      orderBy: [
        { parentId: { sort: "asc", nulls: "first" } },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    return units;
  }),

  /**
   * List Business Units as Tree
   *
   * AC33: Returns hierarchical tree structure with user and child counts
   * AC37: Restricted to ORG_ADMIN role
   */
  list: adminProcedure
    .input(listBusinessUnitsSchema)
    .query(async ({ ctx, input }) => {
      const units = await ctx.db.businessUnit.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          _count: { select: { users: true, children: true } },
        },
        orderBy: [
          { parentId: { sort: "asc", nulls: "first" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
      });

      const tree = buildTree(units);
      const flatOptions = flattenTreeWithPath(tree);

      return {
        tree,
        flatOptions,
        totalCount: units.length,
      };
    }),

  /**
   * Get single Business Unit by ID
   */
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bu = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: { select: { users: true, children: true } },
          parent: { select: { id: true, name: true } },
        },
      });

      if (!bu) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      return bu;
    }),

  /**
   * Create Business Unit
   *
   * AC34: Creates new BU with hierarchy validation
   * AC37: Restricted to ORG_ADMIN role
   */
  create: adminProcedure
    .input(createBusinessUnitSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate hierarchy (depth, circular refs, org match)
      await validateBUOperation({
        parentId: input.parentId ?? null,
        organizationId: ctx.organizationId!,
      });

      // Check unique name within organization
      const existing = await ctx.db.businessUnit.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A business unit with this name already exists",
        });
      }

      const newBU = await ctx.db.businessUnit.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          code: input.code ?? null,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder,
          isActive: true,
        },
        include: {
          _count: { select: { users: true, children: true } },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "BusinessUnit",
          entityId: newBU.id,
          changes: {
            action: "CREATE",
            name: input.name,
            code: input.code,
            parentId: input.parentId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return newBU;
    }),

  /**
   * Update Business Unit
   *
   * AC35: Updates BU with hierarchy validation
   * AC37: Restricted to ORG_ADMIN role
   */
  update: adminProcedure
    .input(updateBusinessUnitSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify BU exists and belongs to organization
      const existing = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      // If parent is changing, validate hierarchy
      if (input.parentId !== undefined && input.parentId !== existing.parentId) {
        await validateBUOperation({
          buId: input.id,
          parentId: input.parentId ?? null,
          organizationId: ctx.organizationId!,
        });
      }

      // If name is changing, check uniqueness
      if (input.name && input.name !== existing.name) {
        const nameConflict = await ctx.db.businessUnit.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: input.name,
            id: { not: input.id },
          },
        });

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A business unit with this name already exists",
          });
        }
      }

      const updatedBU = await ctx.db.businessUnit.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code }),
          ...(input.parentId !== undefined && { parentId: input.parentId }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          _count: { select: { users: true, children: true } },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "BusinessUnit",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            before: {
              name: existing.name,
              code: existing.code,
              parentId: existing.parentId,
              sortOrder: existing.sortOrder,
              isActive: existing.isActive,
            },
            after: {
              name: updatedBU.name,
              code: updatedBU.code,
              parentId: updatedBU.parentId,
              sortOrder: updatedBU.sortOrder,
              isActive: updatedBU.isActive,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updatedBU;
    }),

  /**
   * Delete Business Unit (soft delete)
   *
   * AC36: Soft-deletes BU with protection for users/children
   * AC37: Restricted to ORG_ADMIN role
   */
  delete: adminProcedure
    .input(deleteBusinessUnitSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify BU exists and belongs to organization
      const existing = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      // Check if deletion is allowed
      const deleteCheck = await canDeleteBusinessUnit(input.id);
      if (!deleteCheck.canDelete) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: deleteCheck.reason ?? "Cannot delete this business unit",
        });
      }

      // Soft delete (set isActive = false)
      await ctx.db.businessUnit.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "BusinessUnit",
          entityId: input.id,
          changes: {
            action: "DELETE",
            name: existing.name,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),

  /**
   * Check if BU can be deleted
   *
   * Returns deletion status with reasons if blocked
   */
  canDelete: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify BU belongs to organization
      const existing = await ctx.db.businessUnit.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business unit not found",
        });
      }

      return canDeleteBusinessUnit(input.id);
    }),

  /**
   * Get parent options for dropdown (excludes self and descendants)
   */
  getParentOptions: adminProcedure
    .input(z.object({ excludeId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const units = await ctx.db.businessUnit.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        orderBy: [
          { parentId: { sort: "asc", nulls: "first" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
      });

      // Build tree and flatten with paths
      const tree = buildTree(
        units.map((u) => ({ ...u, _count: { users: 0, children: 0 } }))
      );
      const flatOptions = flattenTreeWithPath(tree);

      // If editing, exclude self and descendants
      if (input.excludeId) {
        const descendants = await getBUWithDescendants(input.excludeId);
        return flatOptions.filter(
          (opt) => !descendants.includes(opt.id) && opt.depth < 4 // Max depth - 1
        );
      }

      // For create, exclude BUs at max depth
      return flatOptions.filter((opt) => opt.depth < 4);
    }),

  /**
   * Quick Create Business Unit
   *
   * Creates a simple top-level business unit with just a name.
   * Used for inline creation in forms (e.g., when creating a finding/risk).
   * Accessible to ORG_ADMIN, GRC_ANALYST, and SECURITY_ENGINEER roles.
   *
   * @returns The created or existing business unit
   */
  quickCreate: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
        code: z.string().max(20).optional(),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has permission (ORG_ADMIN, GRC_ANALYST, SECURITY_ENGINEER)
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create business units",
        });
      }

      // Validate hierarchy if parent specified
      if (input.parentId) {
        await validateBUOperation({
          parentId: input.parentId,
          organizationId: ctx.organizationId!,
        });
      }

      // Check for existing BU with same name (case-insensitive)
      const existing = await ctx.db.businessUnit.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: { equals: input.name, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          isActive: true,
        },
      });

      // If exists, return it
      if (existing) {
        return { ...existing, created: false };
      }

      // Create new BU
      const newBU = await ctx.db.businessUnit.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          code: input.code ?? null,
          parentId: input.parentId ?? null,
          sortOrder: 0,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
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
          entityType: "BusinessUnit",
          entityId: newBU.id,
          changes: {
            action: "QUICK_CREATE",
            name: input.name,
            code: input.code,
            parentId: input.parentId,
            source: "inline_form",
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { ...newBU, created: true };
    }),

  /**
   * Search Business Units by name
   *
   * Returns matching BUs for autocomplete/typeahead functionality.
   */
  search: organizationProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const units = await ctx.db.businessUnit.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          name: { contains: input.query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });

      return units;
    }),
});
