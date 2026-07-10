/**
 * BIA Dashboard tRPC Router
 *
 * Epic 13: BIA Reporting & Compliance
 * Stories 13.1-13.9: Dashboard, Filtering, Metrics, Reports, Exports
 *
 * Provides dashboard data, aggregations, and export functionality for BIA.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { UserRole, BusinessProcessStatus, BIAAssessmentStatus } from "@prisma/client";
import { READ_ROLES } from "@/lib/auth/roles";

// Roles that can view BIA dashboard and reports — read tier
const DASHBOARD_VIEW_ROLES: UserRole[] = [...READ_ROLES];

// Roles that can export reports — read tier (Business User may export CSV/PDF)
const EXPORT_ROLES: UserRole[] = [...READ_ROLES];

const dashboardFilterSchema = z.object({
  businessFunctionId: z.string().optional(),
  tierId: z.string().optional(),
  vendorId: z.string().optional(),
});

export const biaDashboardRouter = createTRPCRouter({
  /**
   * Get dashboard summary stats (Story 13.1)
   * Returns counts for processes, functions, assessment completion
   */
  getSummaryStats: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(dashboardFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const filters = input ?? {};

      // Build base where clause
      const baseWhere: any = {
        organizationId,
        status: { not: BusinessProcessStatus.DELETED },
      };

      if (filters.businessFunctionId) {
        baseWhere.businessFunctionId = filters.businessFunctionId;
      }

      if (filters.tierId) {
        baseWhere.OR = [
          { calculatedTierId: filters.tierId },
          { overrideTierId: filters.tierId },
        ];
      }

      if (filters.vendorId) {
        baseWhere.vendorLinks = {
          some: { vendorId: filters.vendorId },
        };
      }

      // Execute all counts in parallel
      const [
        totalProcesses,
        totalFunctions,
        completedAssessments,
        draftAssessments,
        neverAssessed,
      ] = await Promise.all([
        ctx.db.businessProcess.count({ where: baseWhere }),
        ctx.db.businessFunction.count({
          where: { organizationId, isActive: true },
        }),
        ctx.db.businessProcess.count({
          where: { ...baseWhere, assessmentStatus: BIAAssessmentStatus.COMPLETED },
        }),
        ctx.db.businessProcess.count({
          where: { ...baseWhere, assessmentStatus: BIAAssessmentStatus.DRAFT },
        }),
        ctx.db.businessProcess.count({
          where: { ...baseWhere, assessmentStatus: BIAAssessmentStatus.NOT_STARTED },
        }),
      ]);

      const assessmentRate = totalProcesses > 0
        ? Math.round((completedAssessments / totalProcesses) * 100)
        : 0;

      return {
        totalProcesses,
        totalFunctions,
        completedAssessments,
        inProgressAssessments: draftAssessments,
        pendingAssessments: 0, // No REQUESTED status in this schema
        neverAssessed,
        assessmentRate,
      };
    }),

  /**
   * Get tier distribution for chart (Story 13.1)
   */
  getTierDistribution: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(dashboardFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const filters = input ?? {};

      // Get all tiers for this org's BIA config
      const biaConfig = await ctx.db.bIAConfiguration.findFirst({
        where: { organizationId },
        include: {
          tierDefinitions: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!biaConfig) {
        return { tiers: [], unassigned: 0 };
      }

      // Build base where clause
      const baseWhere: any = {
        organizationId,
        status: { not: BusinessProcessStatus.DELETED },
      };

      if (filters.businessFunctionId) {
        baseWhere.businessFunctionId = filters.businessFunctionId;
      }

      if (filters.vendorId) {
        baseWhere.vendorLinks = {
          some: { vendorId: filters.vendorId },
        };
      }

      // Count processes per tier (using effective tier = override ?? calculated)
      const tierCounts = await Promise.all(
        biaConfig.tierDefinitions.map(async (tier) => {
          // Count processes where either override or calculated tier matches
          const count = await ctx.db.businessProcess.count({
            where: {
              ...baseWhere,
              OR: [
                { overrideTierId: tier.id },
                {
                  AND: [
                    { overrideTierId: null },
                    { calculatedTierId: tier.id },
                  ],
                },
              ],
            },
          });

          return {
            id: tier.id,
            name: tier.name,
            colorHex: tier.colorHex,
            rto: tier.rtoText,
            count,
          };
        })
      );

      // Count unassigned (no tier)
      const unassigned = await ctx.db.businessProcess.count({
        where: {
          ...baseWhere,
          calculatedTierId: null,
          overrideTierId: null,
        },
      });

      return {
        tiers: tierCounts,
        unassigned,
      };
    }),

  /**
   * Get assessment freshness stats (Story 13.6)
   */
  getFreshnessStats: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(dashboardFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const filters = input ?? {};
      const now = new Date();

      // Calculate date thresholds
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Build base where clause
      const baseWhere: any = {
        organizationId,
        status: { not: BusinessProcessStatus.DELETED },
        assessmentStatus: BIAAssessmentStatus.COMPLETED,
      };

      if (filters.businessFunctionId) {
        baseWhere.businessFunctionId = filters.businessFunctionId;
      }

      if (filters.vendorId) {
        baseWhere.vendorLinks = {
          some: { vendorId: filters.vendorId },
        };
      }

      // Count by freshness category
      const [current, aging, stale, neverAssessed] = await Promise.all([
        // Current: assessed within 6 months
        ctx.db.businessProcess.count({
          where: {
            ...baseWhere,
            lastAssessedAt: { gte: sixMonthsAgo },
          },
        }),
        // Aging: assessed 6-12 months ago
        ctx.db.businessProcess.count({
          where: {
            ...baseWhere,
            lastAssessedAt: {
              gte: twelveMonthsAgo,
              lt: sixMonthsAgo,
            },
          },
        }),
        // Stale: assessed more than 12 months ago
        ctx.db.businessProcess.count({
          where: {
            ...baseWhere,
            lastAssessedAt: { lt: twelveMonthsAgo },
          },
        }),
        // Never assessed
        ctx.db.businessProcess.count({
          where: {
            organizationId,
            status: { not: BusinessProcessStatus.DELETED },
            assessmentStatus: BIAAssessmentStatus.NOT_STARTED,
            ...(filters.businessFunctionId && { businessFunctionId: filters.businessFunctionId }),
            ...(filters.vendorId && {
              vendorLinks: { some: { vendorId: filters.vendorId } },
            }),
          },
        }),
      ]);

      return {
        current,
        aging,
        stale,
        neverAssessed,
        thresholds: {
          currentMonths: 6,
          staleMonths: 12,
        },
      };
    }),

  /**
   * Get vendor dependency report (Story 13.4)
   */
  getVendorDependencyReport: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      // Get all vendors with linked process counts
      const vendors = await ctx.db.vendor.findMany({
        where: { organizationId },
        select: {
          id: true,
          identifier: true,
          name: true,
          status: true,
          businessProcessLinks: {
            include: {
              process: {
                select: {
                  id: true,
                  calculatedTierId: true,
                  overrideTierId: true,
                  calculatedTier: { select: { sortOrder: true } },
                  overrideTier: { select: { sortOrder: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Get tier definitions for categorization
      const biaConfig = await ctx.db.bIAConfiguration.findFirst({
        where: { organizationId },
        include: {
          tierDefinitions: { orderBy: { sortOrder: "asc" } },
        },
      });

      const tierMap = new Map(
        biaConfig?.tierDefinitions.map((t) => [t.id, t]) ?? []
      );

      // Build report data
      const report = vendors.map((vendor) => {
        const processCount = vendor.businessProcessLinks.length;
        const tierCounts: Record<string, number> = {};

        // Initialize tier counts
        biaConfig?.tierDefinitions.forEach((t) => {
          tierCounts[t.name] = 0;
        });
        tierCounts["Unassigned"] = 0;

        // Count processes by effective tier
        vendor.businessProcessLinks.forEach((link) => {
          const effectiveTierId = link.process.overrideTierId ?? link.process.calculatedTierId;
          if (effectiveTierId) {
            const tier = tierMap.get(effectiveTierId);
            if (tier) {
              tierCounts[tier.name] = (tierCounts[tier.name] || 0) + 1;
            }
          } else {
            tierCounts["Unassigned"] = (tierCounts["Unassigned"] ?? 0) + 1;
          }
        });

        // Calculate highest criticality (lowest sortOrder = highest criticality)
        let highestCriticality: string | null = null;
        let lowestSortOrder = Infinity;

        vendor.businessProcessLinks.forEach((link) => {
          const sortOrder = link.process.overrideTier?.sortOrder
            ?? link.process.calculatedTier?.sortOrder
            ?? Infinity;
          if (sortOrder < lowestSortOrder) {
            lowestSortOrder = sortOrder;
            const effectiveTierId = link.process.overrideTierId ?? link.process.calculatedTierId;
            const tier = effectiveTierId ? tierMap.get(effectiveTierId) : null;
            highestCriticality = tier?.name ?? null;
          }
        });

        return {
          id: vendor.id,
          identifier: vendor.identifier,
          name: vendor.name,
          status: vendor.status,
          processCount,
          tierCounts,
          highestCriticality,
          // Flag concentration risk: multiple mission critical processes on one vendor
          hasConcentrationRisk: (tierCounts[biaConfig?.tierDefinitions[0]?.name ?? ""] ?? 0) >= 2,
        };
      });

      // Sort by process count descending
      report.sort((a, b) => b.processCount - a.processCount);

      // Filter out vendors with no processes
      const vendorsWithProcesses = report.filter((v) => v.processCount > 0);

      return {
        vendors: vendorsWithProcesses,
        tierNames: biaConfig?.tierDefinitions.map((t) => t.name) ?? [],
      };
    }),

  /**
   * Get tier override report for auditors (Story 13.5)
   */
  getTierOverrides: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const where = {
        organizationId,
        status: { not: BusinessProcessStatus.DELETED },
        overrideTierId: { not: null },
      };

      const [processes, total] = await Promise.all([
        ctx.db.businessProcess.findMany({
          where,
          include: {
            calculatedTier: { select: { id: true, name: true, colorHex: true } },
            overrideTier: { select: { id: true, name: true, colorHex: true } },
            businessFunction: { select: { name: true } },
            owner: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.businessProcess.count({ where }),
      ]);

      return {
        items: processes.map((p) => ({
          id: p.id,
          identifier: p.identifier,
          name: p.name,
          businessFunction: p.businessFunction?.name,
          owner: p.owner?.name,
          calculatedTier: p.calculatedTier,
          overrideTier: p.overrideTier,
          overrideJustification: p.overrideJustification,
          updatedAt: p.updatedAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get filter options for dashboard (Story 13.2)
   */
  getFilterOptions: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      const [businessFunctions, tiers, vendors] = await Promise.all([
        ctx.db.businessFunction.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        ctx.db.bIATierDefinition.findMany({
          where: { configuration: { organizationId } },
          select: { id: true, name: true, colorHex: true },
          orderBy: { sortOrder: "asc" },
        }),
        ctx.db.vendor.findMany({
          where: {
            organizationId,
            businessProcessLinks: { some: {} }, // Only vendors with linked processes
          },
          select: { id: true, identifier: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

      return {
        businessFunctions,
        tiers,
        vendors,
      };
    }),

  /**
   * Export processes as CSV (Story 13.7)
   */
  exportCsv: organizationProcedure
    .use(requireRole(EXPORT_ROLES))
    .input(dashboardFilterSchema.optional())
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const filters = input ?? {};

      // Build where clause
      const where: any = {
        organizationId,
        status: { not: BusinessProcessStatus.DELETED },
      };

      if (filters.businessFunctionId) {
        where.businessFunctionId = filters.businessFunctionId;
      }

      if (filters.tierId) {
        where.OR = [
          { calculatedTierId: filters.tierId },
          { overrideTierId: filters.tierId },
        ];
      }

      if (filters.vendorId) {
        where.vendorLinks = {
          some: { vendorId: filters.vendorId },
        };
      }

      const processes = await ctx.db.businessProcess.findMany({
        where,
        include: {
          businessFunction: { select: { name: true } },
          owner: { select: { name: true, email: true } },
          calculatedTier: { select: { name: true, rtoText: true, rpoText: true } },
          overrideTier: { select: { name: true, rtoText: true, rpoText: true } },
          impactScores: {
            include: { category: { select: { name: true } } },
          },
        },
        orderBy: { identifier: "asc" },
      });

      // Build CSV content
      const headers = [
        "Identifier",
        "Name",
        "Business Function",
        "Owner",
        "Owner Email",
        "Status",
        "Assessment Status",
        "Calculated Tier",
        "Override Tier",
        "Effective Tier",
        "RTO",
        "RPO",
        "Last Assessed",
        "Description",
        "Workaround Procedure",
      ];

      const rows = processes.map((p) => {
        const effectiveTier = p.overrideTier ?? p.calculatedTier;
        return [
          p.identifier,
          `"${p.name.replace(/"/g, '""')}"`,
          p.businessFunction?.name ?? "",
          p.owner?.name ?? "",
          p.owner?.email ?? "",
          p.status,
          p.assessmentStatus,
          p.calculatedTier?.name ?? "",
          p.overrideTier?.name ?? "",
          effectiveTier?.name ?? "",
          effectiveTier?.rtoText ?? "",
          effectiveTier?.rpoText ?? "",
          p.lastAssessedAt?.toISOString() ?? "",
          `"${(p.description ?? "").replace(/"/g, '""')}"`,
          `"${(p.workaroundProcedure ?? "").replace(/"/g, '""')}"`,
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      return {
        content: csv,
        filename: `bia-processes-${new Date().toISOString().split("T")[0]}.csv`,
        contentType: "text/csv",
      };
    }),

  /**
   * Get compliance report data for PDF export (Story 13.8)
   */
  getComplianceReportData: organizationProcedure
    .use(requireRole(EXPORT_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;
      const now = new Date();

      // Get all stats
      const [
        summaryStats,
        tierDistribution,
        freshnessStats,
        overrideCount,
        recentOverrides,
      ] = await Promise.all([
        // Summary
        ctx.db.businessProcess.groupBy({
          by: ["status"],
          where: { organizationId },
          _count: true,
        }),
        // Tier distribution (simplified for report)
        ctx.db.businessProcess.groupBy({
          by: ["calculatedTierId"],
          where: {
            organizationId,
            status: { not: BusinessProcessStatus.DELETED },
          },
          _count: true,
        }),
        // Freshness
        (async () => {
          const sixMonthsAgo = new Date(now);
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

          const twelveMonthsAgo = new Date(now);
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

          const baseWhere = {
            organizationId,
            status: { not: BusinessProcessStatus.DELETED },
          };

          return {
            current: await ctx.db.businessProcess.count({
              where: { ...baseWhere, lastAssessedAt: { gte: sixMonthsAgo } },
            }),
            stale: await ctx.db.businessProcess.count({
              where: { ...baseWhere, lastAssessedAt: { lt: twelveMonthsAgo } },
            }),
          };
        })(),
        // Override count
        ctx.db.businessProcess.count({
          where: {
            organizationId,
            status: { not: BusinessProcessStatus.DELETED },
            overrideTierId: { not: null },
          },
        }),
        // Recent overrides
        ctx.db.businessProcess.findMany({
          where: {
            organizationId,
            status: { not: BusinessProcessStatus.DELETED },
            overrideTierId: { not: null },
          },
          select: {
            identifier: true,
            name: true,
            calculatedTier: { select: { name: true } },
            overrideTier: { select: { name: true } },
            overrideJustification: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        }),
      ]);

      // Get tier names
      const tiers = await ctx.db.bIATierDefinition.findMany({
        where: { configuration: { organizationId } },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      });
      const tierMap = new Map(tiers.map((t) => [t.id, t.name]));

      // Build tier distribution with names
      const tierDist = tierDistribution.map((t) => ({
        tierName: t.calculatedTierId ? (tierMap.get(t.calculatedTierId) ?? "Unknown") : "Unassigned",
        count: t._count,
      }));

      const totalProcesses = summaryStats.reduce((sum, s) => sum + s._count, 0);
      const activeProcesses = summaryStats.find((s) => s.status === "ACTIVE")?._count ?? 0;

      return {
        generatedAt: now.toISOString(),
        generatedBy: ctx.session?.user?.name ?? "Unknown",
        summary: {
          totalProcesses,
          activeProcesses,
          assessmentCoverage: freshnessStats.current,
          staleAssessments: freshnessStats.stale,
          overrideCount,
        },
        tierDistribution: tierDist,
        recentOverrides: recentOverrides.map((o) => ({
          identifier: o.identifier,
          name: o.name,
          calculatedTier: o.calculatedTier?.name ?? "N/A",
          overrideTier: o.overrideTier?.name ?? "N/A",
          justification: o.overrideJustification,
          date: o.updatedAt.toISOString(),
        })),
      };
    }),

  /**
   * Get Asset Impact Report (Story 14.7)
   * Shows assets with their linked processes and criticality
   */
  getAssetImpactReport: organizationProcedure
    .use(requireRole(DASHBOARD_VIEW_ROLES))
    .input(z.object({
      type: z.array(z.string()).optional(),
      tierId: z.string().optional(),
      businessUnitId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const filters = input ?? {};

      // Build where clause
      const where: any = {
        organizationId,
        status: { not: "DECOMMISSIONED" },
      };

      if (filters.type && filters.type.length > 0) {
        where.type = { in: filters.type };
      }

      if (filters.tierId) {
        where.calculatedTierId = filters.tierId;
      }

      if (filters.businessUnitId) {
        where.businessUnitId = filters.businessUnitId;
      }

      // Get tier definitions for categorization
      const biaConfig = await ctx.db.bIAConfiguration.findFirst({
        where: { organizationId },
        include: {
          tierDefinitions: { orderBy: { sortOrder: "asc" } },
        },
      });

      const tierMap = new Map(
        biaConfig?.tierDefinitions.map((t: any) => [t.id, t]) ?? []
      );

      // Get tier1 (most critical) tier
      const tier1 = biaConfig?.tierDefinitions[0];

      // Get all assets with their process links
      const assets = await ctx.db.asset.findMany({
        where,
        include: {
          businessUnit: { select: { id: true, name: true } },
          calculatedTier: { select: { id: true, name: true, colorHex: true, sortOrder: true } },
          businessProcessLinks: {
            include: {
              businessProcess: {
                select: {
                  id: true,
                  identifier: true,
                  name: true,
                  calculatedTierId: true,
                  overrideTierId: true,
                  calculatedTier: { select: { id: true, name: true, colorHex: true, sortOrder: true } },
                  overrideTier: { select: { id: true, name: true, colorHex: true, sortOrder: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { calculatedTier: { sortOrder: "asc" } },
          { name: "asc" },
        ],
      });

      // Calculate summary stats
      const totalAssets = assets.length;
      const assetsWithDependencies = assets.filter((a: any) => a.businessProcessLinks.length > 0).length;
      const criticalAssets = assets.filter((a: any) =>
        a.calculatedTierId === tier1?.id
      ).length;

      // Build asset report data
      const assetData = assets.map((asset: any) => {
        const processes = asset.businessProcessLinks.map((link: any) => {
          const process = link.businessProcess;
          const effectiveTier = process.overrideTier ?? process.calculatedTier;
          return {
            id: process.id,
            identifier: process.identifier,
            name: process.name,
            dependencyType: link.dependencyType,
            tier: effectiveTier ? {
              name: effectiveTier.name,
              color: effectiveTier.colorHex,
              sortOrder: effectiveTier.sortOrder,
            } : null,
          };
        });

        // Sort processes by criticality (highest first)
        processes.sort((a: any, b: any) => {
          const aOrder = a.tier?.sortOrder ?? Infinity;
          const bOrder = b.tier?.sortOrder ?? Infinity;
          return aOrder - bOrder;
        });

        // Count critical processes (tier1)
        const criticalProcessCount = processes.filter((p: any) =>
          p.tier?.sortOrder === tier1?.sortOrder
        ).length;

        // Concentration risk: supports 3+ critical processes
        const hasConcentrationRisk = criticalProcessCount >= 3;

        return {
          id: asset.id,
          identifier: asset.identifier,
          name: asset.name,
          type: asset.type,
          status: asset.status,
          tier: asset.calculatedTier ? {
            id: asset.calculatedTier.id,
            name: asset.calculatedTier.name,
            color: asset.calculatedTier.colorHex,
            sortOrder: asset.calculatedTier.sortOrder,
          } : null,
          businessUnit: asset.businessUnit,
          processCount: processes.length,
          criticalProcessCount,
          hasConcentrationRisk,
          processes,
        };
      });

      // Filter to only assets with processes for the report
      const assetsWithProcesses = assetData.filter((a: any) => a.processCount > 0);

      // Count concentration risks
      const concentrationRiskCount = assetsWithProcesses.filter((a: any) => a.hasConcentrationRisk).length;

      return {
        summary: {
          totalAssets,
          criticalAssets,
          assetsWithDependencies,
          concentrationRiskCount,
        },
        tierNames: biaConfig?.tierDefinitions.map((t: any) => t.name) ?? [],
        assets: assetsWithProcesses,
      };
    }),
});
