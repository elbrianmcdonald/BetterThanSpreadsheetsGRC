/**
 * Business Process tRPC Router
 *
 * Epic 10: BIA Core Module
 * Stories 10.2-10.7: Business Process CRUD, Owner Assignment, List/Detail, Status Management
 *
 * Provides full CRUD operations for Business Processes with:
 * - Owner assignment and reassignment (FR11, FR12)
 * - Status management (FR19)
 * - Search, filter, and sort (FR13, FR14, FR15)
 * - Owner-based edit permissions (FR17)
 * - Full audit trail (FR52)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { UserRole, AuditAction, BusinessProcessStatus, BIAAssessmentStatus } from "@prisma/client";
import { createAuditLog } from "@/server/services/audit-log.service";
import { generateIdentifier } from "@/server/services/identifierService";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";

// Roles that can view business processes — read tier
const BP_VIEW_ROLES: UserRole[] = [...READ_ROLES];

// Roles that can manage all business processes — write tier
const BP_MANAGE_ROLES: UserRole[] = [...WRITE_ROLES];

// Input schemas
const createBusinessProcessSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(4000).optional(),
  businessFunctionId: z.string().optional(),
  ownerId: z.string().optional(),
  workaroundProcedure: z.string().max(10000).optional(),
});

const updateBusinessProcessSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  businessFunctionId: z.string().nullable().optional(),
  workaroundProcedure: z.string().max(10000).nullable().optional(),
  // Loss Event Range — dollar amounts, must satisfy min ≤ probable ≤ max when present
  lossMinimum: z.number().min(0).max(1e12).nullable().optional(),
  lossProbable: z.number().min(0).max(1e12).nullable().optional(),
  lossMaximum: z.number().min(0).max(1e12).nullable().optional(),
});

const updateOwnerSchema = z.object({
  id: z.string(),
  ownerId: z.string().nullable(),
});

const updateStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(BusinessProcessStatus),
});

const listBusinessProcessSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.array(z.nativeEnum(BusinessProcessStatus)).optional(),
  businessFunctionId: z.string().optional(),
  ownerId: z.string().optional(),
  tierId: z.string().optional(),
  sortBy: z.enum(["name", "identifier", "status", "updatedAt", "owner", "tier"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  myProcessesOnly: z.boolean().default(false),
});

export const businessProcessRouter = createTRPCRouter({
  /**
   * List business processes with pagination, search, filter, and sort
   * (FR13, FR14, FR15)
   */
  list: organizationProcedure
    .use(requireRole(BP_VIEW_ROLES))
    .input(listBusinessProcessSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Build where clause. Read tier (incl. BUSINESS_USER) sees all org processes.
      const where: any = {
        organizationId,
      };

      // "My processes only" filter
      if (input.myProcessesOnly) {
        where.ownerId = userId;
      }

      // Status filter - exclude DELETED unless explicitly requested
      if (input.status && input.status.length > 0) {
        where.status = { in: input.status };
      } else {
        where.status = { not: BusinessProcessStatus.DELETED };
      }

      // Business function filter
      if (input.businessFunctionId) {
        where.businessFunctionId = input.businessFunctionId;
      }

      // Owner filter
      if (input.ownerId) {
        where.ownerId = input.ownerId;
      }

      // Tier filter (uses calculated tier for filtering)
      if (input.tierId) {
        where.calculatedTierId = input.tierId;
      }

      // Search
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { identifier: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Build orderBy
      let orderBy: any;
      switch (input.sortBy) {
        case "name":
          orderBy = { name: input.sortOrder };
          break;
        case "identifier":
          orderBy = { identifier: input.sortOrder };
          break;
        case "status":
          orderBy = { status: input.sortOrder };
          break;
        case "updatedAt":
          orderBy = { updatedAt: input.sortOrder };
          break;
        case "owner":
          orderBy = { owner: { name: input.sortOrder } };
          break;
        case "tier":
          orderBy = { calculatedTier: { sortOrder: input.sortOrder } };
          break;
        default:
          orderBy = { name: "asc" };
      }

      // Execute queries in parallel
      const [processes, total] = await Promise.all([
        ctx.db.businessProcess.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            businessFunction: {
              select: { id: true, name: true },
            },
            owner: {
              select: { id: true, name: true, email: true },
            },
            calculatedTier: {
              select: { id: true, name: true, colorHex: true },
            },
            overrideTier: {
              select: { id: true, name: true, colorHex: true },
            },
          },
        }),
        ctx.db.businessProcess.count({ where }),
      ]);

      // Add effectiveTier to each process (override takes precedence)
      const itemsWithEffectiveTier = processes.map((p) => ({
        ...p,
        effectiveTier: p.overrideTier ?? p.calculatedTier,
      }));

      return {
        items: itemsWithEffectiveTier,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get a single business process by ID (FR16)
   */
  getById: organizationProcedure
    .use(requireRole(BP_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userRole = ctx.session!.user.role as UserRole;

      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          businessFunction: true,
          owner: {
            select: { id: true, name: true, email: true },
          },
          calculatedTier: true,
          overrideTier: true,
          impactScores: {
            include: {
              category: true,
            },
            orderBy: { category: { sortOrder: "asc" } },
          },
          timeImpactScores: {
            include: {
              category: true,
              timePeriod: true,
            },
          },
          vendorLinks: {
            include: {
              vendor: {
                select: { id: true, identifier: true, name: true, status: true },
              },
            },
          },
          riskLinks: {
            include: {
              risk: {
                select: { id: true, title: true },
              },
            },
          },
          upstreamDependencies: {
            include: {
              upstreamProcess: {
                select: { id: true, identifier: true, name: true },
              },
            },
          },
          downstreamDependencies: {
            include: {
              downstreamProcess: {
                select: { id: true, identifier: true, name: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          lastAssessedBy: {
            select: { id: true, name: true },
          },
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Determine edit permissions (write tier only; BUSINESS_USER is read-only)
      const canEdit = BP_MANAGE_ROLES.includes(userRole);
      const canChangeOwner = BP_MANAGE_ROLES.includes(userRole);
      const canDelete = BP_MANAGE_ROLES.includes(userRole);

      // Return process with permissions - client computes effectiveTier
      return {
        process,
        permissions: {
          canEdit,
          canChangeOwner,
          canDelete,
        },
      };
    }),

  /**
   * Create a new business process (FR10)
   */
  create: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(createBusinessProcessSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Validate business function exists if provided
      if (input.businessFunctionId) {
        const fn = await ctx.db.businessFunction.findFirst({
          where: {
            id: input.businessFunctionId,
            organizationId,
            isActive: true,
          },
        });
        if (!fn) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business function not found",
          });
        }
      }

      // Validate owner exists if provided
      if (input.ownerId) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId,
          },
        });
        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Owner user not found",
          });
        }
      }

      // Generate unique identifier
      const identifier = await generateIdentifier(organizationId, "BP");

      const process = await ctx.db.businessProcess.create({
        data: {
          organizationId,
          identifier,
          name: input.name,
          description: input.description,
          businessFunctionId: input.businessFunctionId,
          ownerId: input.ownerId,
          workaroundProcedure: input.workaroundProcedure,
          status: BusinessProcessStatus.ACTIVE,
          assessmentStatus: BIAAssessmentStatus.NOT_STARTED,
          createdById: ctx.session!.user.id,
        },
      });

      // Audit log (FR52)
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_CREATED,
        entityType: "BusinessProcess",
        entityId: process.id,
        changes: {
          after: {
            identifier: process.identifier,
            name: process.name,
            businessFunctionId: process.businessFunctionId,
            ownerId: process.ownerId,
            status: process.status,
          },
        },
      });

      return process;
    }),

  /**
   * Update a business process (FR17 - owner-based edit)
   */
  update: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(updateBusinessProcessSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get existing process
      const existing = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Validate business function if changing
      if (input.businessFunctionId) {
        const fn = await ctx.db.businessFunction.findFirst({
          where: {
            id: input.businessFunctionId,
            organizationId,
            isActive: true,
          },
        });
        if (!fn) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business function not found",
          });
        }
      }

      // Loss Event Range — server-side ordering validation (min ≤ probable ≤ max).
      // Each field is checked against whichever value (input or existing) is current.
      const lossMin = input.lossMinimum !== undefined ? input.lossMinimum : (existing.lossMinimum ? Number(existing.lossMinimum) : null);
      const lossProb = input.lossProbable !== undefined ? input.lossProbable : (existing.lossProbable ? Number(existing.lossProbable) : null);
      const lossMax = input.lossMaximum !== undefined ? input.lossMaximum : (existing.lossMaximum ? Number(existing.lossMaximum) : null);
      if (lossMin !== null && lossProb !== null && lossMin > lossProb) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss minimum cannot exceed probable." });
      }
      if (lossProb !== null && lossMax !== null && lossProb > lossMax) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss probable cannot exceed maximum." });
      }
      if (lossMin !== null && lossMax !== null && lossMin > lossMax) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss minimum cannot exceed maximum." });
      }

      const process = await ctx.db.businessProcess.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          businessFunctionId: input.businessFunctionId,
          workaroundProcedure: input.workaroundProcedure,
          ...(input.lossMinimum !== undefined ? { lossMinimum: input.lossMinimum } : {}),
          ...(input.lossProbable !== undefined ? { lossProbable: input.lossProbable } : {}),
          ...(input.lossMaximum !== undefined ? { lossMaximum: input.lossMaximum } : {}),
        },
      });

      // Audit log (FR52)
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: process.id,
        changes: {
          before: {
            name: existing.name,
            description: existing.description,
            businessFunctionId: existing.businessFunctionId,
            workaroundProcedure: existing.workaroundProcedure,
          },
          after: {
            name: process.name,
            description: process.description,
            businessFunctionId: process.businessFunctionId,
            workaroundProcedure: process.workaroundProcedure,
          },
        },
      });

      return process;
    }),

  /**
   * Change process owner (FR11, FR12)
   */
  updateOwner: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(updateOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get existing process
      const existing = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          owner: { select: { id: true, name: true } },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Validate new owner if provided
      let newOwnerName: string | null = null;
      if (input.ownerId) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId,
          },
        });
        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Owner user not found",
          });
        }
        newOwnerName = owner.name;
      }

      const process = await ctx.db.businessProcess.update({
        where: { id: input.id },
        data: {
          ownerId: input.ownerId,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log (FR52)
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_UPDATED,
        entityType: "BusinessProcess",
        entityId: process.id,
        changes: {
          before: {
            ownerId: existing.ownerId,
            ownerName: existing.owner?.name,
          },
          after: {
            ownerId: process.ownerId,
            ownerName: newOwnerName,
          },
        },
      });

      return process;
    }),

  /**
   * Update process status (FR19)
   */
  updateStatus: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get existing process
      const existing = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      const process = await ctx.db.businessProcess.update({
        where: { id: input.id },
        data: {
          status: input.status,
        },
      });

      // Audit log (FR52)
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_STATUS_CHANGED,
        entityType: "BusinessProcess",
        entityId: process.id,
        changes: {
          before: { status: existing.status },
          after: { status: process.status },
        },
      });

      return process;
    }),

  /**
   * Soft delete a business process
   */
  delete: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const existing = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Soft delete by changing status
      const process = await ctx.db.businessProcess.update({
        where: { id: input.id },
        data: {
          status: BusinessProcessStatus.DELETED,
        },
      });

      // Audit log (FR52)
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_STATUS_CHANGED,
        entityType: "BusinessProcess",
        entityId: process.id,
        changes: {
          before: {
            identifier: existing.identifier,
            name: existing.name,
            status: existing.status,
          },
          after: {
            status: BusinessProcessStatus.DELETED,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get users for owner dropdown
   */
  getAvailableOwners: organizationProcedure
    .use(requireRole(BP_MANAGE_ROLES))
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const where: any = {
        organizationId,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const users = await ctx.db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: "asc" },
        take: 50,
      });

      return users;
    }),

  /**
   * Get audit history for a process
   */
  getAuditHistory: organizationProcedure
    .use(requireRole(BP_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify process exists and user has access
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      const logs = await ctx.db.auditLog.findMany({
        where: {
          organizationId,
          entityType: "BusinessProcess",
          entityId: input.id,
        },
        include: {
          User: {
            select: { id: true, name: true },
          },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      });

      return logs;
    }),
});
