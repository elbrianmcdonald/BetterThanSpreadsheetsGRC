/**
 * Asset Registry tRPC Router
 *
 * Epic 14: Asset Registry & BIA Integration
 * Stories 14.1-14.6: Asset CRUD, Linking, Tier Inheritance
 *
 * Provides full CRUD operations for IT Assets with:
 * - Asset type and status management
 * - Many-to-many linking to business processes
 * - Automatic tier inheritance from linked processes
 * - Role-based access control
 * - Full audit trail
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { UserRole, AuditAction, AssetType, AssetStatus } from "@prisma/client";
import { createAuditLog } from "@/server/services/audit-log.service";
import { generateIdentifier } from "@/server/services/identifierService";

// Roles that can view assets
const ASSET_VIEW_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// Roles that can manage all assets
const ASSET_MANAGE_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

// Roles that can only manage owned assets
const ASSET_OWNER_EDIT_ROLES: UserRole[] = [
  UserRole.IT_STAKEHOLDER,
];

// Input schemas
const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.nativeEnum(AssetType),
  description: z.string().max(4000).optional(),
  ownerId: z.string().optional(),
  businessUnitId: z.string().optional(),
  lossMinimum: z.number().min(0).max(1e12).nullable().optional(),
  lossProbable: z.number().min(0).max(1e12).nullable().optional(),
  lossMaximum: z.number().min(0).max(1e12).nullable().optional(),
});

const updateAssetSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(AssetType).optional(),
  description: z.string().max(4000).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  businessUnitId: z.string().nullable().optional(),
  // Loss Event Range — dollar amounts, must satisfy min ≤ probable ≤ max when present
  lossMinimum: z.number().min(0).max(1e12).nullable().optional(),
  lossProbable: z.number().min(0).max(1e12).nullable().optional(),
  lossMaximum: z.number().min(0).max(1e12).nullable().optional(),
});

const updateStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(AssetStatus),
});

const listAssetSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.array(z.nativeEnum(AssetStatus)).optional(),
  type: z.array(z.nativeEnum(AssetType)).optional(),
  businessUnitId: z.string().optional(),
  ownerId: z.string().optional(),
  tierId: z.string().optional(),
  sortBy: z.enum(["name", "identifier", "type", "status", "updatedAt", "tier"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const linkToProcessSchema = z.object({
  assetId: z.string(),
  businessProcessId: z.string(),
  dependencyType: z.enum(["PRIMARY", "BACKUP", "SUPPORTING"]).optional(),
  notes: z.string().max(500).optional(),
});

const unlinkFromProcessSchema = z.object({
  assetId: z.string(),
  businessProcessId: z.string(),
});

const updateProcessLinkSchema = z.object({
  assetId: z.string(),
  businessProcessId: z.string(),
  dependencyType: z.enum(["PRIMARY", "BACKUP", "SUPPORTING"]).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/**
 * Recalculate the tier for an asset based on its linked processes
 * Asset tier = MAX criticality (lowest sortOrder) of all linked processes
 */
async function recalculateAssetTier(
  db: any,
  assetId: string
): Promise<{ tierId: string | null; tierName: string | null; sourceProcessIds: string[] }> {
  // Get all linked processes with their effective tiers
  const linkedProcesses = await db.businessProcessAsset.findMany({
    where: { assetId },
    include: {
      businessProcess: {
        include: {
          calculatedTier: true,
          overrideTier: true,
        },
      },
    },
  });

  // Get effective tier for each process (override takes precedence)
  const processesWithTiers = linkedProcesses
    .map((link: any) => {
      const process = link.businessProcess;
      const effectiveTier = process.overrideTier ?? process.calculatedTier;
      return {
        processId: process.id,
        tierId: effectiveTier?.id,
        sortOrder: effectiveTier?.sortOrder,
      };
    })
    .filter((p: any) => p.tierId != null);

  if (processesWithTiers.length === 0) {
    // No linked processes with tiers - clear asset tier
    await db.asset.update({
      where: { id: assetId },
      data: { calculatedTierId: null },
    });
    return { tierId: null, tierName: null, sourceProcessIds: [] };
  }

  // Find highest criticality (lowest sortOrder)
  const minSortOrder = Math.min(...processesWithTiers.map((p: any) => p.sortOrder!));
  const highestTierProcesses = processesWithTiers.filter(
    (p: any) => p.sortOrder === minSortOrder
  );

  const highestTierId = highestTierProcesses[0]!.tierId!;

  await db.asset.update({
    where: { id: assetId },
    data: { calculatedTierId: highestTierId },
  });

  const tier = await db.bIATierDefinition.findUnique({
    where: { id: highestTierId },
  });

  return {
    tierId: highestTierId,
    tierName: tier?.name ?? null,
    sourceProcessIds: highestTierProcesses.map((p: any) => p.processId),
  };
}

export const assetRouter = createTRPCRouter({
  /**
   * List assets with pagination, search, filter, and sort
   */
  list: organizationProcedure
    .use(requireRole(ASSET_VIEW_ROLES))
    .input(listAssetSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      // Build where clause
      const where: any = {
        organizationId,
      };

      // Role-based filtering
      // IT_STAKEHOLDER and BUSINESS_STAKEHOLDER only see their owned assets
      if (
        (ASSET_OWNER_EDIT_ROLES.includes(userRole) || userRole === UserRole.BUSINESS_STAKEHOLDER) &&
        !ASSET_MANAGE_ROLES.includes(userRole)
      ) {
        where.ownerId = userId;
      }

      // Status filter - exclude DECOMMISSIONED unless explicitly requested
      if (input.status && input.status.length > 0) {
        where.status = { in: input.status };
      } else {
        where.status = { not: AssetStatus.DECOMMISSIONED };
      }

      // Type filter
      if (input.type && input.type.length > 0) {
        where.type = { in: input.type };
      }

      // Business unit filter
      if (input.businessUnitId) {
        where.businessUnitId = input.businessUnitId;
      }

      // Owner filter
      if (input.ownerId) {
        where.ownerId = input.ownerId;
      }

      // Tier filter
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
        case "type":
          orderBy = { type: input.sortOrder };
          break;
        case "status":
          orderBy = { status: input.sortOrder };
          break;
        case "updatedAt":
          orderBy = { updatedAt: input.sortOrder };
          break;
        case "tier":
          orderBy = { calculatedTier: { sortOrder: input.sortOrder } };
          break;
        default:
          orderBy = { name: "asc" };
      }

      // Execute queries in parallel
      const [assets, total] = await Promise.all([
        ctx.db.asset.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
            businessUnit: {
              select: { id: true, name: true },
            },
            calculatedTier: {
              select: { id: true, name: true, colorHex: true, sortOrder: true },
            },
            _count: {
              select: { businessProcessLinks: true },
            },
          },
        }),
        ctx.db.asset.count({ where }),
      ]);

      return {
        items: assets,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get a single asset by ID
   */
  getById: organizationProcedure
    .use(requireRole(ASSET_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      const asset = await ctx.db.asset.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          organization: true,
          owner: {
            select: { id: true, name: true, email: true },
          },
          businessUnit: {
            select: { id: true, name: true },
          },
          calculatedTier: true,
          createdBy: {
            select: { id: true, name: true },
          },
          businessProcessLinks: {
            include: {
              businessProcess: {
                include: {
                  calculatedTier: true,
                  overrideTier: true,
                },
              },
              createdBy: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Role-based access check
      if (
        (ASSET_OWNER_EDIT_ROLES.includes(userRole) || userRole === UserRole.BUSINESS_STAKEHOLDER) &&
        !ASSET_MANAGE_ROLES.includes(userRole)
      ) {
        if (asset.ownerId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only view assets you own",
          });
        }
      }

      // Determine edit permissions
      const canEdit = ASSET_MANAGE_ROLES.includes(userRole) ||
        (ASSET_OWNER_EDIT_ROLES.includes(userRole) && asset.ownerId === userId);
      const canDelete = ASSET_MANAGE_ROLES.includes(userRole);
      const canLinkProcesses = ASSET_MANAGE_ROLES.includes(userRole);

      // Add effective tier to each linked process
      const processLinksWithEffectiveTier = asset.businessProcessLinks.map((link: any) => ({
        ...link,
        businessProcess: {
          ...link.businessProcess,
          effectiveTier: link.businessProcess.overrideTier ?? link.businessProcess.calculatedTier,
        },
      }));

      // Find the source process(es) for the tier
      const tierSourceProcesses = processLinksWithEffectiveTier
        .filter((link: any) =>
          link.businessProcess.effectiveTier?.id === asset.calculatedTierId
        )
        .map((link: any) => ({
          id: link.businessProcess.id,
          name: link.businessProcess.name,
          identifier: link.businessProcess.identifier,
        }));

      return {
        asset: {
          ...asset,
          businessProcessLinks: processLinksWithEffectiveTier,
        },
        tierSourceProcesses,
        permissions: {
          canEdit,
          canDelete,
          canLinkProcesses,
        },
      };
    }),

  /**
   * Create a new asset
   */
  create: organizationProcedure
    .use(requireRole([...ASSET_MANAGE_ROLES, ...ASSET_OWNER_EDIT_ROLES]))
    .input(createAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userRole = ctx.session!.user.role as UserRole;

      // IT_STAKEHOLDER can only create assets they own
      let ownerId = input.ownerId;
      if (ASSET_OWNER_EDIT_ROLES.includes(userRole) && !ASSET_MANAGE_ROLES.includes(userRole)) {
        ownerId = ctx.session!.user.id;
      }

      // Validate owner exists if provided. Asset.ownerId references AssetOwner, not User.
      if (ownerId) {
        const owner = await ctx.db.assetOwner.findFirst({
          where: {
            id: ownerId,
            organizationId,
          },
        });
        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Asset owner not found",
          });
        }
      }

      // Validate business unit exists if provided
      if (input.businessUnitId) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId,
            isActive: true,
          },
        });
        if (!bu) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business unit not found",
          });
        }
      }

      // Generate unique identifier
      const identifier = await generateIdentifier(organizationId, "AST");

      // Loss Event Range — server-side ordering validation on create.
      if (
        input.lossMinimum !== null && input.lossMinimum !== undefined &&
        input.lossProbable !== null && input.lossProbable !== undefined &&
        input.lossMinimum > input.lossProbable
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss minimum cannot exceed probable." });
      }
      if (
        input.lossProbable !== null && input.lossProbable !== undefined &&
        input.lossMaximum !== null && input.lossMaximum !== undefined &&
        input.lossProbable > input.lossMaximum
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss probable cannot exceed maximum." });
      }
      if (
        input.lossMinimum !== null && input.lossMinimum !== undefined &&
        input.lossMaximum !== null && input.lossMaximum !== undefined &&
        input.lossMinimum > input.lossMaximum
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Loss minimum cannot exceed maximum." });
      }

      const asset = await ctx.db.asset.create({
        data: {
          organizationId,
          identifier,
          name: input.name,
          type: input.type,
          description: input.description,
          ownerId,
          businessUnitId: input.businessUnitId,
          status: AssetStatus.ACTIVE,
          createdById: ctx.session!.user.id,
          lossMinimum: input.lossMinimum ?? null,
          lossProbable: input.lossProbable ?? null,
          lossMaximum: input.lossMaximum ?? null,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_CREATED,
        entityType: "Asset",
        entityId: asset.id,
        changes: {
          after: {
            identifier: asset.identifier,
            name: asset.name,
            type: asset.type,
            ownerId: asset.ownerId,
            businessUnitId: asset.businessUnitId,
            status: asset.status,
          },
        },
      });

      return asset;
    }),

  /**
   * Update an asset
   */
  update: organizationProcedure
    .use(requireRole([...ASSET_MANAGE_ROLES, ...ASSET_OWNER_EDIT_ROLES]))
    .input(updateAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role as UserRole;

      // Get existing asset
      const existing = await ctx.db.asset.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Permission check
      if (ASSET_OWNER_EDIT_ROLES.includes(userRole) && !ASSET_MANAGE_ROLES.includes(userRole)) {
        if (existing.ownerId !== userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only edit assets you own",
          });
        }
        // Owners cannot change ownership or business unit
        if (input.ownerId !== undefined || input.businessUnitId !== undefined) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only GRC Analysts can change ownership or business unit",
          });
        }
      }

      // Validate owner if changing. Asset.ownerId references AssetOwner, not User.
      if (input.ownerId) {
        const owner = await ctx.db.assetOwner.findFirst({
          where: {
            id: input.ownerId,
            organizationId,
          },
        });
        if (!owner) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Asset owner not found",
          });
        }
      }

      // Validate business unit if changing
      if (input.businessUnitId) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId,
            isActive: true,
          },
        });
        if (!bu) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business unit not found",
          });
        }
      }

      // Loss Event Range — server-side ordering validation (min ≤ probable ≤ max).
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

      const asset = await ctx.db.asset.update({
        where: { id: input.id },
        data: {
          name: input.name,
          type: input.type,
          description: input.description,
          ownerId: input.ownerId,
          businessUnitId: input.businessUnitId,
          ...(input.lossMinimum !== undefined ? { lossMinimum: input.lossMinimum } : {}),
          ...(input.lossProbable !== undefined ? { lossProbable: input.lossProbable } : {}),
          ...(input.lossMaximum !== undefined ? { lossMaximum: input.lossMaximum } : {}),
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_UPDATED,
        entityType: "Asset",
        entityId: asset.id,
        changes: {
          before: {
            name: existing.name,
            type: existing.type,
            description: existing.description,
            ownerId: existing.ownerId,
            businessUnitId: existing.businessUnitId,
          },
          after: {
            name: asset.name,
            type: asset.type,
            description: asset.description,
            ownerId: asset.ownerId,
            businessUnitId: asset.businessUnitId,
          },
        },
      });

      return asset;
    }),

  /**
   * Update asset status
   */
  updateStatus: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const existing = await ctx.db.asset.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      const asset = await ctx.db.asset.update({
        where: { id: input.id },
        data: {
          status: input.status,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_STATUS_CHANGED,
        entityType: "Asset",
        entityId: asset.id,
        changes: {
          before: { status: existing.status },
          after: { status: asset.status },
        },
      });

      return asset;
    }),

  /**
   * Soft delete an asset (change status to DECOMMISSIONED)
   */
  delete: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const existing = await ctx.db.asset.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      const asset = await ctx.db.asset.update({
        where: { id: input.id },
        data: {
          status: AssetStatus.DECOMMISSIONED,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_STATUS_CHANGED,
        entityType: "Asset",
        entityId: asset.id,
        changes: {
          before: {
            identifier: existing.identifier,
            name: existing.name,
            status: existing.status,
          },
          after: {
            status: AssetStatus.DECOMMISSIONED,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Link an asset to a business process
   */
  linkToProcess: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(linkToProcessSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify asset exists and belongs to organization
      const asset = await ctx.db.asset.findFirst({
        where: {
          id: input.assetId,
          organizationId,
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Verify process exists and belongs to organization
      const process = await ctx.db.businessProcess.findFirst({
        where: {
          id: input.businessProcessId,
          organizationId,
        },
      });

      if (!process) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Check for existing link
      const existingLink = await ctx.db.businessProcessAsset.findUnique({
        where: {
          businessProcessId_assetId: {
            businessProcessId: input.businessProcessId,
            assetId: input.assetId,
          },
        },
      });

      if (existingLink) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Asset is already linked to this process",
        });
      }

      // Create link
      const link = await ctx.db.businessProcessAsset.create({
        data: {
          businessProcessId: input.businessProcessId,
          assetId: input.assetId,
          dependencyType: input.dependencyType,
          notes: input.notes,
          createdById: ctx.session!.user.id,
        },
        include: {
          businessProcess: {
            select: { id: true, identifier: true, name: true },
          },
        },
      });

      // Recalculate asset tier
      const tierResult = await recalculateAssetTier(ctx.db, input.assetId);

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_PROCESS_LINKED,
        entityType: "Asset",
        entityId: input.assetId,
        changes: {
          after: {
            processId: input.businessProcessId,
            processIdentifier: link.businessProcess.identifier,
            processName: link.businessProcess.name,
            dependencyType: input.dependencyType,
            newTierId: tierResult.tierId,
            newTierName: tierResult.tierName,
          },
        },
      });

      return { link, tierResult };
    }),

  /**
   * Unlink an asset from a business process
   */
  unlinkFromProcess: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(unlinkFromProcessSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify asset exists and belongs to organization
      const asset = await ctx.db.asset.findFirst({
        where: {
          id: input.assetId,
          organizationId,
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Find the link
      const link = await ctx.db.businessProcessAsset.findUnique({
        where: {
          businessProcessId_assetId: {
            businessProcessId: input.businessProcessId,
            assetId: input.assetId,
          },
        },
        include: {
          businessProcess: {
            select: { id: true, identifier: true, name: true },
          },
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found",
        });
      }

      // Delete link
      await ctx.db.businessProcessAsset.delete({
        where: {
          businessProcessId_assetId: {
            businessProcessId: input.businessProcessId,
            assetId: input.assetId,
          },
        },
      });

      // Recalculate asset tier
      const tierResult = await recalculateAssetTier(ctx.db, input.assetId);

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.ASSET_PROCESS_UNLINKED,
        entityType: "Asset",
        entityId: input.assetId,
        changes: {
          before: {
            processId: input.businessProcessId,
            processIdentifier: link.businessProcess.identifier,
            processName: link.businessProcess.name,
            dependencyType: link.dependencyType,
          },
          after: {
            newTierId: tierResult.tierId,
            newTierName: tierResult.tierName,
          },
        },
      });

      return { success: true, tierResult };
    }),

  /**
   * Update a process link (dependency type, notes)
   */
  updateProcessLink: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(updateProcessLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify asset exists and belongs to organization
      const asset = await ctx.db.asset.findFirst({
        where: {
          id: input.assetId,
          organizationId,
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      // Find the link
      const existingLink = await ctx.db.businessProcessAsset.findUnique({
        where: {
          businessProcessId_assetId: {
            businessProcessId: input.businessProcessId,
            assetId: input.assetId,
          },
        },
      });

      if (!existingLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found",
        });
      }

      // Update link
      const link = await ctx.db.businessProcessAsset.update({
        where: {
          businessProcessId_assetId: {
            businessProcessId: input.businessProcessId,
            assetId: input.assetId,
          },
        },
        data: {
          dependencyType: input.dependencyType,
          notes: input.notes,
        },
      });

      return link;
    }),

  /**
   * Get available asset owners for owner dropdown
   */
  getAvailableOwners: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(z.object({ search: z.string().optional() }))
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
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          title: true,
        },
        orderBy: { name: "asc" },
        take: 50,
      });

      return owners;
    }),

  /**
   * Get available processes for linking
   */
  getAvailableProcesses: organizationProcedure
    .use(requireRole(ASSET_MANAGE_ROLES))
    .input(z.object({
      assetId: z.string(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get already linked process IDs
      const linkedProcessIds = await ctx.db.businessProcessAsset.findMany({
        where: { assetId: input.assetId },
        select: { businessProcessId: true },
      });

      const excludeIds = linkedProcessIds.map((l: any) => l.businessProcessId);

      const where: any = {
        organizationId,
        status: { not: "DELETED" },
        id: { notIn: excludeIds },
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { identifier: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const processes = await ctx.db.businessProcess.findMany({
        where,
        select: {
          id: true,
          identifier: true,
          name: true,
          calculatedTier: {
            select: { id: true, name: true, colorHex: true },
          },
          overrideTier: {
            select: { id: true, name: true, colorHex: true },
          },
        },
        orderBy: { name: "asc" },
        take: 50,
      });

      // Add effective tier
      return processes.map((p: any) => ({
        ...p,
        effectiveTier: p.overrideTier ?? p.calculatedTier,
      }));
    }),

  /**
   * Get audit history for an asset
   */
  getAuditHistory: organizationProcedure
    .use(requireRole(ASSET_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Verify asset exists and user has access
      const asset = await ctx.db.asset.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      const logs = await ctx.db.auditLog.findMany({
        where: {
          organizationId,
          entityType: "Asset",
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
