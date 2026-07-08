/**
 * NIST SP 800-34 System Contingency BIA — document-level deliverable feeding
 * the Information System Contingency Plan (ISCP).
 *
 * Anchored to either an Asset or a BusinessProcess (exactly one). Impact
 * categories are drawn from the existing BIAImpactCategory configuration so
 * values stay consistent across all BIAs.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  ContingencyBIAStatus,
  ContingencyImpactLevel,
  HasBCP,
} from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";

const ALLOWED_MUTATION_ROLES = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];

function assertCanMutate(role: string | undefined): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to edit system contingency BIAs",
    });
  }
}

const processInput = z.object({
  id: z.string().optional(),
  businessProcessId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  mtdHours: z.number().int().min(0).max(100_000).optional().nullable(),
  rtoHours: z.number().int().min(0).max(100_000).optional().nullable(),
  rpoHours: z.number().int().min(0).max(100_000).optional().nullable(),
  rpoNote: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().optional(),
  impacts: z
    .array(
      z.object({
        biaImpactCategoryId: z.string(),
        level: z.nativeEnum(ContingencyImpactLevel),
      })
    )
    .optional(),
});

const resourceInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  platformOsVersion: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const priorityInput = z.object({
  id: z.string().optional(),
  priority: z.number().int().min(1).max(1000),
  resourceName: z.string().min(1).max(200),
  component: z.string().max(200).optional().nullable(),
  rtoDescription: z.string().max(500).optional().nullable(),
  alternateStrategy: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const coreFieldsInput = z
  .object({
    assetId: z.string().optional().nullable(),
    businessProcessId: z.string().optional().nullable(),
    status: z.nativeEnum(ContingencyBIAStatus).optional(),
    hasBCP: z.nativeEnum(HasBCP).optional().nullable(),
    completionDate: z.date().optional().nullable(),
    overview: z.string().max(10_000).optional().nullable(),
    systemDescription: z.string().max(10_000).optional().nullable(),
    downtimeDrivers: z.string().max(10_000).optional().nullable(),
    alternateMeans: z.string().max(10_000).optional().nullable(),
    alternateStrategies: z.string().max(10_000).optional().nullable(),
    processes: z.array(processInput).optional(),
    resources: z.array(resourceInput).optional(),
    recoveryPriorities: z.array(priorityInput).optional(),
  })
  .superRefine((val, ctx) => {
    const hasAsset = !!val.assetId;
    const hasProcess = !!val.businessProcessId;
    if (hasAsset === hasProcess) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "BIA must be anchored to exactly one of: an Asset, or a BusinessProcess",
        path: ["assetId"],
      });
    }
  });

export const biaSystemContingencyRouter = createTRPCRouter({
  list: organizationProcedure
    .input(
      z
        .object({
          anchor: z.enum(["ASSET", "PROCESS"]).optional(),
          status: z.nativeEnum(ContingencyBIAStatus).optional(),
          hasBCP: z.enum(["YES", "NO", "NA", "UNSET"]).optional(),
          search: z.string().max(200).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const search = input?.search?.trim();

      return ctx.db.systemContingencyBIA.findMany({
        where: {
          organizationId,
          ...(input?.anchor === "ASSET" && { assetId: { not: null } }),
          ...(input?.anchor === "PROCESS" && { businessProcessId: { not: null } }),
          ...(input?.status && { status: input.status }),
          ...(input?.hasBCP === "UNSET" && { hasBCP: null }),
          ...(input?.hasBCP &&
            input.hasBCP !== "UNSET" && { hasBCP: input.hasBCP as HasBCP }),
          ...(search && {
            OR: [
              { asset: { name: { contains: search, mode: "insensitive" } } },
              { asset: { identifier: { contains: search, mode: "insensitive" } } },
              { businessProcess: { name: { contains: search, mode: "insensitive" } } },
              { businessProcess: { identifier: { contains: search, mode: "insensitive" } } },
              { overview: { contains: search, mode: "insensitive" } },
              { systemDescription: { contains: search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          asset: { select: { id: true, identifier: true, name: true } },
          businessProcess: {
            select: { id: true, identifier: true, name: true },
          },
          _count: {
            select: {
              processes: true,
              resources: true,
              recoveryPriorities: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  /**
   * Register summary stats — counts by status / anchor / BCP for the cards.
   * Stale = last updated more than a year ago (BIAs are reviewed annually).
   */
  getRegisterStats: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;
    const STALE_DAYS = 365;
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

    const [
      total,
      draftCount,
      finalCount,
      bcpYes,
      bcpNo,
      bcpNA,
      bcpUnset,
      assetAnchored,
      processAnchored,
      staleCount,
    ] = await Promise.all([
      ctx.db.systemContingencyBIA.count({ where: { organizationId } }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, status: ContingencyBIAStatus.DRAFT },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, status: ContingencyBIAStatus.FINAL },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, hasBCP: HasBCP.YES },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, hasBCP: HasBCP.NO },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, hasBCP: HasBCP.NA },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, hasBCP: null },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, assetId: { not: null } },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, businessProcessId: { not: null } },
      }),
      ctx.db.systemContingencyBIA.count({
        where: { organizationId, updatedAt: { lt: staleCutoff } },
      }),
    ]);

    return {
      total,
      byStatus: { draft: draftCount, final: finalCount },
      byBCP: { yes: bcpYes, no: bcpNo, na: bcpNA, unset: bcpUnset },
      byAnchor: { asset: assetAnchored, process: processAnchored },
      staleCount,
      staleCutoffDays: STALE_DAYS,
    };
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bia = await ctx.db.systemContingencyBIA.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          asset: { select: { id: true, identifier: true, name: true } },
          businessProcess: {
            select: { id: true, identifier: true, name: true },
          },
          processes: {
            orderBy: { sortOrder: "asc" },
            include: {
              impacts: {
                include: {
                  category: { select: { id: true, name: true } },
                },
              },
              businessProcess: {
                select: { id: true, identifier: true, name: true },
              },
            },
          },
          resources: { orderBy: { sortOrder: "asc" } },
          recoveryPriorities: { orderBy: { priority: "asc" } },
        },
      });
      if (!bia) {
        throw new TRPCError({ code: "NOT_FOUND", message: "BIA not found" });
      }
      return bia;
    }),

  create: organizationProcedure
    .input(coreFieldsInput)
    .mutation(async ({ ctx, input }) => {
      assertCanMutate(ctx.session?.user.role);
      const organizationId = ctx.organizationId!;

      // Verify anchor belongs to this org
      if (input.assetId) {
        const asset = await ctx.db.asset.findFirst({
          where: { id: input.assetId, organizationId },
          select: { id: true },
        });
        if (!asset) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Asset not found in this organization",
          });
        }
      }
      if (input.businessProcessId) {
        const proc = await ctx.db.businessProcess.findFirst({
          where: { id: input.businessProcessId, organizationId },
          select: { id: true },
        });
        if (!proc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business process not found in this organization",
          });
        }
      }

      const created = await ctx.db.systemContingencyBIA.create({
        data: {
          organizationId,
          assetId: input.assetId ?? null,
          businessProcessId: input.businessProcessId ?? null,
          status: input.status ?? ContingencyBIAStatus.DRAFT,
          hasBCP: input.hasBCP ?? null,
          completionDate: input.completionDate ?? null,
          preparedById: ctx.session!.user.id,
          overview: input.overview ?? null,
          systemDescription: input.systemDescription ?? null,
          downtimeDrivers: input.downtimeDrivers ?? null,
          alternateMeans: input.alternateMeans ?? null,
          alternateStrategies: input.alternateStrategies ?? null,
          updatedById: ctx.session!.user.id,
        },
      });

      return created;
    }),

  /**
   * Replace-style update: nested arrays (processes/resources/priorities)
   * are fully replaced with the incoming set. Existing rows with matching
   * `id` are updated; rows without `id` are created; rows in DB but not in
   * the input are deleted (via cascade on the regenerated set).
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: coreFieldsInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertCanMutate(ctx.session?.user.role);
      const organizationId = ctx.organizationId!;

      const existing = await ctx.db.systemContingencyBIA.findFirst({
        where: { id: input.id, organizationId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "BIA not found" });
      }

      const data = input.data;

      // Re-verify anchor belongs to this org (if changed)
      if (data.assetId) {
        const asset = await ctx.db.asset.findFirst({
          where: { id: data.assetId, organizationId },
          select: { id: true },
        });
        if (!asset) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
        }
      }
      if (data.businessProcessId) {
        const proc = await ctx.db.businessProcess.findFirst({
          where: { id: data.businessProcessId, organizationId },
          select: { id: true },
        });
        if (!proc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Business process not found",
          });
        }
      }

      // Wipe + recreate children in a transaction for atomic consistency
      await ctx.db.$transaction(async (tx) => {
        await tx.systemContingencyBIA.update({
          where: { id: input.id },
          data: {
            assetId: data.assetId ?? null,
            businessProcessId: data.businessProcessId ?? null,
            status: data.status,
            hasBCP: data.hasBCP ?? null,
            completionDate: data.completionDate ?? null,
            overview: data.overview ?? null,
            systemDescription: data.systemDescription ?? null,
            downtimeDrivers: data.downtimeDrivers ?? null,
            alternateMeans: data.alternateMeans ?? null,
            alternateStrategies: data.alternateStrategies ?? null,
            updatedById: ctx.session!.user.id,
          },
        });

        if (data.processes) {
          await tx.contingencyProcess.deleteMany({
            where: { biaId: input.id },
          });
          for (let i = 0; i < data.processes.length; i++) {
            const p = data.processes[i]!;
            const created = await tx.contingencyProcess.create({
              data: {
                biaId: input.id,
                businessProcessId: p.businessProcessId ?? null,
                name: p.name,
                description: p.description ?? null,
                mtdHours: p.mtdHours ?? null,
                rtoHours: p.rtoHours ?? null,
                rpoHours: p.rpoHours ?? null,
                rpoNote: p.rpoNote ?? null,
                sortOrder: p.sortOrder ?? i,
              },
            });
            if (p.impacts?.length) {
              await tx.contingencyProcessImpact.createMany({
                data: p.impacts.map((imp) => ({
                  processId: created.id,
                  biaImpactCategoryId: imp.biaImpactCategoryId,
                  level: imp.level,
                })),
                skipDuplicates: true,
              });
            }
          }
        }

        if (data.resources) {
          await tx.contingencyResource.deleteMany({
            where: { biaId: input.id },
          });
          if (data.resources.length) {
            await tx.contingencyResource.createMany({
              data: data.resources.map((r, i) => ({
                biaId: input.id,
                name: r.name,
                platformOsVersion: r.platformOsVersion ?? null,
                description: r.description ?? null,
                sortOrder: r.sortOrder ?? i,
              })),
            });
          }
        }

        if (data.recoveryPriorities) {
          await tx.contingencyRecoveryPriority.deleteMany({
            where: { biaId: input.id },
          });
          if (data.recoveryPriorities.length) {
            await tx.contingencyRecoveryPriority.createMany({
              data: data.recoveryPriorities.map((p, i) => ({
                biaId: input.id,
                priority: p.priority,
                resourceName: p.resourceName,
                component: p.component ?? null,
                rtoDescription: p.rtoDescription ?? null,
                alternateStrategy: p.alternateStrategy ?? null,
                sortOrder: p.sortOrder ?? i,
              })),
            });
          }
        }
      });

      return { id: input.id };
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertCanMutate(ctx.session?.user.role);
      const existing = await ctx.db.systemContingencyBIA.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "BIA not found" });
      }
      await ctx.db.systemContingencyBIA.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /**
   * Impact categories from the org's active BIAConfiguration — used to
   * render the per-process impact matrix.
   */
  getImpactCategories: organizationProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.bIAConfiguration.findFirst({
      where: { organizationId: ctx.organizationId! },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        impactCategories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
    return config?.impactCategories ?? [];
  }),
});
