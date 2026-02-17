/**
 * MITRE ATT&CK tRPC Router
 *
 * Story 13.1: MITRE Data Model & tRPC Router
 * Story 13.2-13.4: STIX JSON Seeder and Admin Sync
 *
 * Provides queries for browsing and searching MITRE ATT&CK tactics and techniques.
 * Data is seeded from the official STIX JSON (Story 13.2).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { seedMitreData, needsMitreSeeding, getLastMitreSync } from "@/server/services/mitreSeeder";

export const mitreRouter = createTRPCRouter({
  // ============================================================================
  // Tactic Queries
  // ============================================================================

  /**
   * Get all tactics in kill chain order
   */
  getTactics: protectedProcedure.query(async ({ ctx }) => {
    const tactics = await ctx.db.mitreTactic.findMany({
      orderBy: { killChainOrder: "asc" },
      include: {
        _count: {
          select: { techniques: true },
        },
      },
    });

    return tactics.map((tactic) => ({
      id: tactic.id,
      externalId: tactic.externalId,
      name: tactic.name,
      description: tactic.description,
      url: tactic.url,
      shortName: tactic.shortName,
      killChainOrder: tactic.killChainOrder,
      techniqueCount: tactic._count.techniques,
    }));
  }),

  /**
   * Get a single tactic by ID with its techniques
   */
  getTacticById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tactic = await ctx.db.mitreTactic.findUnique({
        where: { id: input.id },
        include: {
          techniques: {
            include: {
              technique: {
                include: {
                  subTechniques: true,
                },
              },
            },
          },
        },
      });

      if (!tactic) return null;

      return {
        id: tactic.id,
        externalId: tactic.externalId,
        name: tactic.name,
        description: tactic.description,
        url: tactic.url,
        shortName: tactic.shortName,
        killChainOrder: tactic.killChainOrder,
        techniques: tactic.techniques
          .map((tt) => ({
            id: tt.technique.id,
            externalId: tt.technique.externalId,
            name: tt.technique.name,
            description: tt.technique.description,
            url: tt.technique.url,
            isSubTechnique: tt.technique.isSubTechnique,
            subTechniqueCount: tt.technique.subTechniques.length,
          }))
          .filter((t) => !t.isSubTechnique), // Only parent techniques
      };
    }),

  /**
   * Get tactic by external ID (e.g., "TA0001")
   */
  getTacticByExternalId: protectedProcedure
    .input(z.object({ externalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tactic = await ctx.db.mitreTactic.findUnique({
        where: { externalId: input.externalId },
        include: {
          _count: {
            select: { techniques: true },
          },
        },
      });

      if (!tactic) return null;

      return {
        id: tactic.id,
        externalId: tactic.externalId,
        name: tactic.name,
        description: tactic.description,
        url: tactic.url,
        shortName: tactic.shortName,
        killChainOrder: tactic.killChainOrder,
        techniqueCount: tactic._count.techniques,
      };
    }),

  // ============================================================================
  // Technique Queries
  // ============================================================================

  /**
   * Get all techniques with optional filtering
   */
  getTechniques: protectedProcedure
    .input(
      z.object({
        tacticId: z.string().optional(),
        includeSubTechniques: z.boolean().default(true),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (!input.includeSubTechniques) {
        where.isSubTechnique = false;
      }

      if (input.tacticId) {
        where.tactics = {
          some: { tacticId: input.tacticId },
        };
      }

      const [techniques, total] = await Promise.all([
        ctx.db.mitreTechnique.findMany({
          where,
          include: {
            parent: {
              select: { id: true, externalId: true, name: true },
            },
            subTechniques: {
              select: { id: true, externalId: true, name: true },
            },
            tactics: {
              include: {
                tactic: {
                  select: { id: true, externalId: true, name: true, shortName: true },
                },
              },
            },
          },
          orderBy: { externalId: "asc" },
          skip: input.page * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.mitreTechnique.count({ where }),
      ]);

      return {
        techniques: techniques.map((t) => ({
          id: t.id,
          externalId: t.externalId,
          name: t.name,
          description: t.description,
          url: t.url,
          isSubTechnique: t.isSubTechnique,
          parent: t.parent,
          subTechniqueCount: t.subTechniques.length,
          tactics: t.tactics.map((tt) => tt.tactic),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: (input.page + 1) * input.pageSize < total,
      };
    }),

  /**
   * Get a single technique by ID
   */
  getTechniqueById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const technique = await ctx.db.mitreTechnique.findUnique({
        where: { id: input.id },
        include: {
          parent: true,
          subTechniques: {
            orderBy: { externalId: "asc" },
          },
          tactics: {
            include: {
              tactic: true,
            },
          },
        },
      });

      if (!technique) return null;

      return {
        id: technique.id,
        externalId: technique.externalId,
        name: technique.name,
        description: technique.description,
        url: technique.url,
        detection: technique.detection,
        isSubTechnique: technique.isSubTechnique,
        parent: technique.parent
          ? {
              id: technique.parent.id,
              externalId: technique.parent.externalId,
              name: technique.parent.name,
            }
          : null,
        subTechniques: technique.subTechniques.map((st) => ({
          id: st.id,
          externalId: st.externalId,
          name: st.name,
        })),
        tactics: technique.tactics.map((tt) => ({
          id: tt.tactic.id,
          externalId: tt.tactic.externalId,
          name: tt.tactic.name,
          shortName: tt.tactic.shortName,
        })),
      };
    }),

  /**
   * Get technique by external ID (e.g., "T1566" or "T1566.001")
   */
  getTechniqueByExternalId: protectedProcedure
    .input(z.object({ externalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const technique = await ctx.db.mitreTechnique.findUnique({
        where: { externalId: input.externalId },
        include: {
          parent: {
            select: { id: true, externalId: true, name: true },
          },
          subTechniques: {
            select: { id: true, externalId: true, name: true },
            orderBy: { externalId: "asc" },
          },
          tactics: {
            include: {
              tactic: {
                select: { id: true, externalId: true, name: true, shortName: true },
              },
            },
          },
        },
      });

      if (!technique) return null;

      return {
        id: technique.id,
        externalId: technique.externalId,
        name: technique.name,
        description: technique.description,
        url: technique.url,
        detection: technique.detection,
        isSubTechnique: technique.isSubTechnique,
        parent: technique.parent,
        subTechniques: technique.subTechniques,
        tactics: technique.tactics.map((tt) => tt.tactic),
      };
    }),

  /**
   * Search techniques by ID or name
   */
  searchTechniques: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        tacticId: z.string().optional(),
        includeSubTechniques: z.boolean().default(true),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        OR: [
          { externalId: { contains: input.query, mode: "insensitive" } },
          { name: { contains: input.query, mode: "insensitive" } },
        ],
      };

      if (!input.includeSubTechniques) {
        where.isSubTechnique = false;
      }

      if (input.tacticId) {
        where.tactics = {
          some: { tacticId: input.tacticId },
        };
      }

      const techniques = await ctx.db.mitreTechnique.findMany({
        where,
        include: {
          parent: {
            select: { id: true, externalId: true, name: true },
          },
          tactics: {
            include: {
              tactic: {
                select: { id: true, externalId: true, name: true, shortName: true },
              },
            },
          },
        },
        orderBy: [
          // Exact ID match first
          { externalId: "asc" },
        ],
        take: input.limit,
      });

      return techniques.map((t) => ({
        id: t.id,
        externalId: t.externalId,
        name: t.name,
        isSubTechnique: t.isSubTechnique,
        parent: t.parent,
        tactics: t.tactics.map((tt) => tt.tactic),
      }));
    }),

  // ============================================================================
  // Stats and Metadata
  // ============================================================================

  /**
   * Get MITRE data statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [tacticsCount, techniquesCount, subTechniquesCount, lastSync] = await Promise.all([
      ctx.db.mitreTactic.count(),
      ctx.db.mitreTechnique.count({ where: { isSubTechnique: false } }),
      ctx.db.mitreTechnique.count({ where: { isSubTechnique: true } }),
      ctx.db.mitreSyncMetadata.findFirst({
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      tacticsCount,
      techniquesCount,
      subTechniquesCount,
      totalTechniques: techniquesCount + subTechniquesCount,
      lastSyncAt: lastSync?.lastSyncAt ?? null,
      lastSyncStatus: lastSync?.syncStatus ?? null,
      version: lastSync?.version ?? null,
      isEmpty: tacticsCount === 0,
    };
  }),

  /**
   * Get techniques for a specific tactic (for picker component)
   */
  getTechniquesByTactic: protectedProcedure
    .input(
      z.object({
        tacticId: z.string(),
        includeSubTechniques: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const techniques = await ctx.db.mitreTechnique.findMany({
        where: {
          tactics: {
            some: { tacticId: input.tacticId },
          },
          isSubTechnique: input.includeSubTechniques ? undefined : false,
        },
        include: {
          subTechniques: input.includeSubTechniques
            ? {
                select: { id: true, externalId: true, name: true },
                orderBy: { externalId: "asc" },
              }
            : false,
        },
        orderBy: { externalId: "asc" },
      });

      return techniques.map((t) => ({
        id: t.id,
        externalId: t.externalId,
        name: t.name,
        subTechniques: input.includeSubTechniques
          ? (t.subTechniques as { id: string; externalId: string; name: string }[])
          : [],
      }));
    }),

  // ============================================================================
  // Admin Sync Operations (Story 13.3, 13.4)
  // ============================================================================

  /**
   * Check if MITRE data needs seeding (Story 13.3)
   */
  needsSeeding: protectedProcedure.query(async ({ ctx }) => {
    return needsMitreSeeding(ctx.db);
  }),

  /**
   * Get last sync information (Story 13.4)
   */
  getLastSync: protectedProcedure.query(async ({ ctx }) => {
    return getLastMitreSync(ctx.db);
  }),

  /**
   * Sync MITRE data from official STIX JSON (Story 13.4)
   * Requires ORG_ADMIN role
   */
  syncFromStix: protectedProcedure.mutation(async ({ ctx }) => {
    // Check admin permission
    if (ctx.session?.user?.role !== UserRole.ORG_ADMIN) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Organization Administrators can sync MITRE data",
      });
    }

    const result = await seedMitreData(ctx.db);

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error ?? "Failed to sync MITRE data",
      });
    }

    return {
      success: true,
      tacticsCount: result.tacticsCount,
      techniquesCount: result.techniquesCount,
      subTechniquesCount: result.subTechniquesCount,
      relationshipsCount: result.relationshipsCount,
    };
  }),

  /**
   * Seed MITRE data if empty (for initial setup - Story 13.3)
   * Can be called by any authenticated user but only seeds if empty
   */
  seedIfEmpty: protectedProcedure.mutation(async ({ ctx }) => {
    const isEmpty = await needsMitreSeeding(ctx.db);

    if (!isEmpty) {
      return {
        seeded: false,
        message: "MITRE data already exists",
      };
    }

    const result = await seedMitreData(ctx.db);

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error ?? "Failed to seed MITRE data",
      });
    }

    return {
      seeded: true,
      tacticsCount: result.tacticsCount,
      techniquesCount: result.techniquesCount,
      subTechniquesCount: result.subTechniquesCount,
    };
  }),
});
