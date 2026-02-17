/**
 * BIA Configuration Router
 *
 * tRPC router for Business Impact Assessment configuration management.
 *
 * Epic 9: BIA Configuration Admin
 * - Story 9.1: BIA Configuration Data Model & Seed Data (FR7, FR8)
 * - Story 9.2: Impact Categories Management (FR1)
 * - Story 9.3: Score Scale Configuration (FR2)
 * - Story 9.4: Tier Definitions Management (FR3)
 * - Story 9.5: Tier Criteria Configuration (FR4)
 * - Story 9.6: Time Period Configuration (FR5)
 * - Story 9.7: Tier Threshold Rules Configuration (FR6)
 * - Story 9.8: BIA Configuration Role-Based Access (FR58)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, AuditAction } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";

/**
 * Roles that can view BIA configuration (FR58)
 */
const BIA_CONFIG_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.AUDITOR,
];

/**
 * Roles that can manage BIA configuration (FR58)
 */
const BIA_CONFIG_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

/**
 * Default BIA configuration seed data (Story 9.1 - FR7)
 */
const DEFAULT_IMPACT_CATEGORIES = [
  { name: "Financial", description: "Direct and indirect financial impact from business disruption", weight: 25, sortOrder: 0 },
  { name: "Compliance", description: "Regulatory, legal, and contractual compliance impact", weight: 25, sortOrder: 1 },
  { name: "Operational", description: "Impact on business operations and service delivery", weight: 25, sortOrder: 2 },
  { name: "Strategic", description: "Impact on strategic objectives, reputation, and market position", weight: 25, sortOrder: 3 },
];

const DEFAULT_TIER_DEFINITIONS = [
  { name: "Mission Critical", tierLevel: 0, rtoText: "30 minutes", rpoText: "No data loss", colorHex: "#EF4444", description: "Systems critical to immediate business survival", sortOrder: 0 },
  { name: "High", tierLevel: 1, rtoText: "4 hours", rpoText: "1 hour", colorHex: "#F97316", description: "Systems essential for core business operations", sortOrder: 1 },
  { name: "Medium", tierLevel: 2, rtoText: "24 hours", rpoText: "24 hours", colorHex: "#EAB308", description: "Systems important but with available workarounds", sortOrder: 2 },
  { name: "Low", tierLevel: 3, rtoText: "Best Effort", rpoText: "24 hours", colorHex: "#22C55E", description: "Non-critical systems with minimal impact if unavailable", sortOrder: 3 },
];

const DEFAULT_TIME_PERIODS = [
  { label: "30 minutes", durationMinutes: 30, sortOrder: 0 },
  { label: "4 hours", durationMinutes: 240, sortOrder: 1 },
  { label: "24 hours", durationMinutes: 1440, sortOrder: 2 },
  { label: "48 hours", durationMinutes: 2880, sortOrder: 3 },
  { label: "1 week", durationMinutes: 10080, sortOrder: 4 },
  { label: "1 month", durationMinutes: 43200, sortOrder: 5 },
];

const DEFAULT_TIER_CRITERIA: Array<{ categoryName: string; tierName: string; description: string }> = [
  // Financial criteria
  { categoryName: "Financial", tierName: "Mission Critical", description: "$200M+ financial impact; potential bankruptcy or market exit" },
  { categoryName: "Financial", tierName: "High", description: "$50M-$200M financial impact; significant revenue loss" },
  { categoryName: "Financial", tierName: "Medium", description: "$10M-$50M financial impact; material but manageable losses" },
  { categoryName: "Financial", tierName: "Low", description: "<$10M financial impact; minimal financial effect" },
  // Compliance criteria
  { categoryName: "Compliance", tierName: "Mission Critical", description: "Critical regulatory violations; license revocation or criminal liability" },
  { categoryName: "Compliance", tierName: "High", description: "Major regulatory fines; formal enforcement actions" },
  { categoryName: "Compliance", tierName: "Medium", description: "Moderate compliance gaps; audit findings requiring remediation" },
  { categoryName: "Compliance", tierName: "Low", description: "Minor compliance observations; low regulatory risk" },
  // Operational criteria
  { categoryName: "Operational", tierName: "Mission Critical", description: "Complete operational shutdown; unable to deliver any services" },
  { categoryName: "Operational", tierName: "High", description: "Major operational degradation; critical services unavailable" },
  { categoryName: "Operational", tierName: "Medium", description: "Moderate operational impact; some services affected with workarounds" },
  { categoryName: "Operational", tierName: "Low", description: "Minor operational inconvenience; business continues normally" },
  // Strategic criteria
  { categoryName: "Strategic", tierName: "Mission Critical", description: "Existential reputational damage; loss of major customers/partners" },
  { categoryName: "Strategic", tierName: "High", description: "Significant reputation impact; national media coverage" },
  { categoryName: "Strategic", tierName: "Medium", description: "Moderate reputation impact; localized or industry-specific coverage" },
  { categoryName: "Strategic", tierName: "Low", description: "Minimal reputation impact; internal awareness only" },
];

/**
 * Input schemas
 */
const updateScoreScaleSchema = z.object({
  scoreScaleMin: z.number().min(0).max(10),
  scoreScaleMax: z.number().min(1).max(10),
}).refine(data => data.scoreScaleMax > data.scoreScaleMin, {
  message: "Max score must be greater than min score",
});

const createImpactCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  weight: z.number().min(0).max(100),
  sortOrder: z.number().optional(),
});

const updateImpactCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  weight: z.number().min(0).max(100).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const createTierDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  tierLevel: z.number().min(0).max(10),
  rtoText: z.string().min(1).max(50),
  rpoText: z.string().min(1).max(50),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: z.string().max(500).optional(),
  sortOrder: z.number().optional(),
});

const updateTierDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  rtoText: z.string().min(1).max(50).optional(),
  rpoText: z.string().min(1).max(50).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const updateTierCriteriaSchema = z.object({
  categoryId: z.string(),
  tierId: z.string(),
  description: z.string().min(1).max(1000),
});

const createTimePeriodSchema = z.object({
  label: z.string().min(1).max(50),
  durationMinutes: z.number().min(1),
  sortOrder: z.number().optional(),
});

const updateTimePeriodSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50).optional(),
  durationMinutes: z.number().min(1).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const tierThresholdSchema = z.object({
  minScore: z.number(),
  maxScore: z.number(),
  tierId: z.string(),
});

const updateTierThresholdsSchema = z.object({
  thresholds: z.array(tierThresholdSchema),
});

export const biaConfigRouter = createTRPCRouter({
  /**
   * Get BIA configuration for the organization (Story 9.1 - FR8)
   * Creates default configuration if none exists
   */
  get: organizationProcedure
    .use(requireRole(BIA_CONFIG_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      // Try to find existing configuration
      let config = await ctx.db.bIAConfiguration.findUnique({
        where: { organizationId },
        include: {
          impactCategories: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          tierDefinitions: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          timePeriods: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      // If no configuration exists, create default (FR7)
      if (!config) {
        config = await ctx.db.$transaction(async (tx) => {
          // Create base configuration
          const newConfig = await tx.bIAConfiguration.create({
            data: {
              organizationId,
              scoreScaleMin: 1,
              scoreScaleMax: 5,
              tierThresholds: JSON.stringify([
                { minScore: 4.5, maxScore: 5.0, tierLevel: 0 },
                { minScore: 3.5, maxScore: 4.49, tierLevel: 1 },
                { minScore: 2.5, maxScore: 3.49, tierLevel: 2 },
                { minScore: 1.0, maxScore: 2.49, tierLevel: 3 },
              ]),
            },
          });

          // Create default impact categories
          const categories = await Promise.all(
            DEFAULT_IMPACT_CATEGORIES.map(cat =>
              tx.bIAImpactCategory.create({
                data: {
                  configurationId: newConfig.id,
                  ...cat,
                },
              })
            )
          );

          // Create default tier definitions
          const tiers = await Promise.all(
            DEFAULT_TIER_DEFINITIONS.map(tier =>
              tx.bIATierDefinition.create({
                data: {
                  configurationId: newConfig.id,
                  ...tier,
                },
              })
            )
          );

          // Create default time periods
          await Promise.all(
            DEFAULT_TIME_PERIODS.map(period =>
              tx.bIATimePeriod.create({
                data: {
                  configurationId: newConfig.id,
                  ...period,
                },
              })
            )
          );

          // Create default tier criteria (16 intersections)
          for (const criteria of DEFAULT_TIER_CRITERIA) {
            const category = categories.find(c => c.name === criteria.categoryName);
            const tier = tiers.find(t => t.name === criteria.tierName);
            if (category && tier) {
              await tx.bIATierCriteria.create({
                data: {
                  categoryId: category.id,
                  tierId: tier.id,
                  description: criteria.description,
                },
              });
            }
          }

          // Return full config with relations
          return tx.bIAConfiguration.findUnique({
            where: { id: newConfig.id },
            include: {
              impactCategories: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
              tierDefinitions: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
              timePeriods: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          });
        });
      }

      return config;
    }),

  /**
   * Update score scale configuration (Story 9.3 - FR2)
   */
  updateScoreScale: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateScoreScaleSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const config = await ctx.db.bIAConfiguration.update({
        where: { organizationId },
        data: {
          scoreScaleMin: input.scoreScaleMin,
          scoreScaleMax: input.scoreScaleMax,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_CONFIG_UPDATED,
        entityType: "BIAConfiguration",
        entityId: config.id,
        changes: {
          after: { scoreScaleMin: input.scoreScaleMin, scoreScaleMax: input.scoreScaleMax },
        },
      });

      return config;
    }),

  /**
   * Get tier criteria matrix (Story 9.5 - FR4)
   */
  getTierCriteria: organizationProcedure
    .use(requireRole(BIA_CONFIG_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const config = await ctx.db.bIAConfiguration.findUnique({
        where: { organizationId: ctx.organizationId! },
        include: {
          impactCategories: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              tierCriteria: {
                include: {
                  tier: true,
                },
              },
            },
          },
          tierDefinitions: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "BIA configuration not found",
        });
      }

      return config;
    }),

  /**
   * Update tier threshold rules (Story 9.7 - FR6)
   */
  updateTierThresholds: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateTierThresholdsSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Validate no gaps or overlaps in thresholds
      const sortedThresholds = [...input.thresholds].sort((a, b) => b.maxScore - a.maxScore);
      for (let i = 0; i < sortedThresholds.length - 1; i++) {
        const current = sortedThresholds[i];
        const next = sortedThresholds[i + 1];
        if (current && next && Math.abs(current.minScore - next.maxScore) > 0.01) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Gap or overlap detected between thresholds at ${current.minScore} and ${next.maxScore}`,
          });
        }
      }

      const config = await ctx.db.bIAConfiguration.update({
        where: { organizationId },
        data: {
          tierThresholds: JSON.stringify(input.thresholds),
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_CONFIG_UPDATED,
        entityType: "BIAConfiguration",
        entityId: config.id,
        changes: {
          after: { tierThresholds: input.thresholds },
        },
      });

      return config;
    }),

  // ==================== Impact Categories (Story 9.2 - FR1) ====================

  /**
   * Create impact category
   */
  createImpactCategory: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(createImpactCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.bIAConfiguration.findUnique({
        where: { organizationId: ctx.organizationId! },
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "BIA configuration not found",
        });
      }

      // Get next sort order if not provided
      const sortOrder = input.sortOrder ?? await ctx.db.bIAImpactCategory.count({
        where: { configurationId: config.id },
      });

      const category = await ctx.db.bIAImpactCategory.create({
        data: {
          configurationId: config.id,
          name: input.name,
          description: input.description,
          weight: input.weight,
          sortOrder,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_IMPACT_CATEGORY_CREATED,
        entityType: "BIAImpactCategory",
        entityId: category.id,
        changes: { after: input },
      });

      return category;
    }),

  /**
   * Update impact category
   */
  updateImpactCategory: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateImpactCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.db.bIAImpactCategory.findUnique({
        where: { id },
        include: { configuration: true },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Impact category not found",
        });
      }

      const category = await ctx.db.bIAImpactCategory.update({
        where: { id },
        data,
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_IMPACT_CATEGORY_UPDATED,
        entityType: "BIAImpactCategory",
        entityId: id,
        changes: { before: existing, after: category },
      });

      return category;
    }),

  /**
   * Delete impact category (soft delete via isActive)
   */
  deleteImpactCategory: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.bIAImpactCategory.findUnique({
        where: { id: input.id },
        include: {
          configuration: true,
          impactScores: { take: 1 },
        },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Impact category not found",
        });
      }

      // Check if category is in use
      if (existing.impactScores.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete category with existing impact scores. Deactivate instead.",
        });
      }

      const category = await ctx.db.bIAImpactCategory.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_IMPACT_CATEGORY_DELETED,
        entityType: "BIAImpactCategory",
        entityId: input.id,
        changes: { before: existing },
      });

      return category;
    }),

  /**
   * Reorder impact categories
   */
  reorderImpactCategories: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(z.object({
      categoryIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.categoryIds.map((id, index) =>
          ctx.db.bIAImpactCategory.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      return { success: true };
    }),

  // ==================== Tier Definitions (Story 9.4 - FR3) ====================

  /**
   * Create tier definition
   */
  createTierDefinition: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(createTierDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.bIAConfiguration.findUnique({
        where: { organizationId: ctx.organizationId! },
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "BIA configuration not found",
        });
      }

      const sortOrder = input.sortOrder ?? await ctx.db.bIATierDefinition.count({
        where: { configurationId: config.id },
      });

      const tier = await ctx.db.bIATierDefinition.create({
        data: {
          configurationId: config.id,
          name: input.name,
          tierLevel: input.tierLevel,
          rtoText: input.rtoText,
          rpoText: input.rpoText,
          colorHex: input.colorHex,
          description: input.description,
          sortOrder,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIER_DEFINITION_CREATED,
        entityType: "BIATierDefinition",
        entityId: tier.id,
        changes: { after: input },
      });

      return tier;
    }),

  /**
   * Update tier definition
   */
  updateTierDefinition: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateTierDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.db.bIATierDefinition.findUnique({
        where: { id },
        include: { configuration: true },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tier definition not found",
        });
      }

      const tier = await ctx.db.bIATierDefinition.update({
        where: { id },
        data,
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIER_DEFINITION_UPDATED,
        entityType: "BIATierDefinition",
        entityId: id,
        changes: { before: existing, after: tier },
      });

      return tier;
    }),

  /**
   * Delete tier definition (soft delete via isActive)
   */
  deleteTierDefinition: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.bIATierDefinition.findUnique({
        where: { id: input.id },
        include: {
          configuration: true,
          calculatedProcesses: { take: 1 },
          overrideProcesses: { take: 1 },
        },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tier definition not found",
        });
      }

      // Check if tier is used by any process (calculated or override)
      if (existing.calculatedProcesses.length > 0 || existing.overrideProcesses.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete tier with assigned business processes. Deactivate instead.",
        });
      }

      const tier = await ctx.db.bIATierDefinition.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIER_DEFINITION_DELETED,
        entityType: "BIATierDefinition",
        entityId: input.id,
        changes: { before: existing },
      });

      return tier;
    }),

  // ==================== Tier Criteria (Story 9.5 - FR4) ====================

  /**
   * Update tier criteria
   */
  updateTierCriteria: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateTierCriteriaSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify category and tier belong to this organization
      const category = await ctx.db.bIAImpactCategory.findUnique({
        where: { id: input.categoryId },
        include: { configuration: true },
      });

      const tier = await ctx.db.bIATierDefinition.findUnique({
        where: { id: input.tierId },
        include: { configuration: true },
      });

      if (!category || category.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Impact category not found",
        });
      }

      if (!tier || tier.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tier definition not found",
        });
      }

      // Upsert the criteria
      const criteria = await ctx.db.bIATierCriteria.upsert({
        where: {
          categoryId_tierId: {
            categoryId: input.categoryId,
            tierId: input.tierId,
          },
        },
        update: {
          description: input.description,
        },
        create: {
          categoryId: input.categoryId,
          tierId: input.tierId,
          description: input.description,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIER_CRITERIA_UPDATED,
        entityType: "BIATierCriteria",
        entityId: criteria.id,
        changes: {
          after: {
            categoryId: input.categoryId,
            tierId: input.tierId,
            description: input.description,
          },
        },
      });

      return criteria;
    }),

  // ==================== Time Periods (Story 9.6 - FR5) ====================

  /**
   * Create time period
   */
  createTimePeriod: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(createTimePeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.bIAConfiguration.findUnique({
        where: { organizationId: ctx.organizationId! },
      });

      if (!config) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "BIA configuration not found",
        });
      }

      const sortOrder = input.sortOrder ?? await ctx.db.bIATimePeriod.count({
        where: { configurationId: config.id },
      });

      const period = await ctx.db.bIATimePeriod.create({
        data: {
          configurationId: config.id,
          label: input.label,
          durationMinutes: input.durationMinutes,
          sortOrder,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIME_PERIOD_CREATED,
        entityType: "BIATimePeriod",
        entityId: period.id,
        changes: { after: input },
      });

      return period;
    }),

  /**
   * Update time period
   */
  updateTimePeriod: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(updateTimePeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.db.bIATimePeriod.findUnique({
        where: { id },
        include: { configuration: true },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Time period not found",
        });
      }

      const period = await ctx.db.bIATimePeriod.update({
        where: { id },
        data,
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIME_PERIOD_UPDATED,
        entityType: "BIATimePeriod",
        entityId: id,
        changes: { before: existing, after: period },
      });

      return period;
    }),

  /**
   * Delete time period (soft delete via isActive)
   */
  deleteTimePeriod: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.bIATimePeriod.findUnique({
        where: { id: input.id },
        include: {
          configuration: true,
          timeImpactScores: { take: 1 },
        },
      });

      if (!existing || existing.configuration.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Time period not found",
        });
      }

      if (existing.timeImpactScores.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete time period with existing impact scores. Deactivate instead.",
        });
      }

      const period = await ctx.db.bIATimePeriod.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BIA_TIME_PERIOD_DELETED,
        entityType: "BIATimePeriod",
        entityId: input.id,
        changes: { before: existing },
      });

      return period;
    }),

  /**
   * Reorder time periods
   */
  reorderTimePeriods: organizationProcedure
    .use(requireRole(BIA_CONFIG_MANAGE_ROLES))
    .input(z.object({
      periodIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.periodIds.map((id, index) =>
          ctx.db.bIATimePeriod.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      return { success: true };
    }),
});
