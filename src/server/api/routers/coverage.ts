/**
 * Coverage Router - tRPC procedures for framework coverage calculation
 *
 * Calculates compliance coverage percentages based on evidence mapped to controls.
 * Coverage = (controls with evidence / total controls) × 100
 *
 * The coverage chain:
 * Evidence → EvidenceControlDomain → ControlDomain → ControlDomainMapping → Control
 *
 * @see Story 2.6: Framework Coverage Calculation Engine
 * @module server/api/routers/coverage
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  organizationProcedure,
  requirePermission,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";

/**
 * Coverage result type for a single framework
 */
interface FrameworkCoverage {
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  totalControls: number;
  satisfiedControls: number;
  coveragePercentage: number;
  isActive: boolean;
}

/**
 * Gap analysis control type
 */
interface GapControl {
  id: string;
  controlId: string;
  title: string;
  description: string;
  controlDomains: string[];
}

/**
 * Coverage router definition
 */
export const coverageRouter = createTRPCRouter({
  /**
   * Calculate coverage for a single framework
   *
   * @requires FRAMEWORK_READ permission
   * @see Story 2.6: AC13
   */
  calculateFrameworkCoverage: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ frameworkId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<FrameworkCoverage> => {
      // Get framework with control count
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: { Control: true },
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      const totalControls = framework._count.Control;

      // Get satisfied controls count
      // A control is satisfied if there's evidence linked to a control domain
      // that maps to that control via ControlDomainMapping
      const satisfiedControls = await calculateSatisfiedControls(
        ctx.db,
        input.frameworkId,
        framework.code,
        ctx.organizationId!
      );

      const coveragePercentage = totalControls > 0
        ? Math.round((satisfiedControls / totalControls) * 1000) / 10
        : 0;

      return {
        frameworkId: framework.id,
        frameworkCode: framework.code,
        frameworkName: framework.name,
        totalControls,
        satisfiedControls,
        coveragePercentage,
        isActive: framework.isActive,
      };
    }),

  /**
   * Calculate coverage for all active frameworks
   *
   * Returns coverage metrics for all frameworks activated by the organization.
   *
   * @requires FRAMEWORK_READ permission
   * @see Story 2.6: AC14, AC19
   */
  calculateAllFrameworkCoverage: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }): Promise<FrameworkCoverage[]> => {
      // Get all active frameworks for the organization
      const activeFrameworks = await ctx.db.framework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        include: {
          _count: {
            select: { Control: true },
          },
        },
        orderBy: { name: "asc" },
      });

      // Calculate coverage for each framework
      const coverageResults = await Promise.all(
        activeFrameworks.map(async (framework) => {
          const totalControls = framework._count.Control;

          const satisfiedControls = await calculateSatisfiedControls(
            ctx.db,
            framework.id,
            framework.code,
            ctx.organizationId!
          );

          const coveragePercentage = totalControls > 0
            ? Math.round((satisfiedControls / totalControls) * 1000) / 10
            : 0;

          return {
            frameworkId: framework.id,
            frameworkCode: framework.code,
            frameworkName: framework.name,
            totalControls,
            satisfiedControls,
            coveragePercentage,
            isActive: framework.isActive,
          };
        })
      );

      return coverageResults;
    }),

  /**
   * Get framework gaps (unsatisfied controls)
   *
   * Returns controls that don't have any evidence mapped to them.
   *
   * @requires FRAMEWORK_READ permission
   * @see Story 2.6: AC25-AC29
   */
  getFrameworkGaps: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({
      frameworkId: z.string().uuid(),
      controlDomainCode: z.string().optional(),
      page: z.number().int().min(0).default(0),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }): Promise<{
      gaps: GapControl[];
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
      };
    }> => {
      // Get framework
      const framework = await ctx.db.framework.findUnique({
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

      // Get all control IDs that have evidence
      const satisfiedControlIds = await getSatisfiedControlIds(
        ctx.db,
        input.frameworkId,
        framework.code,
        ctx.organizationId!
      );

      // Build where clause for unsatisfied controls
      const whereClause: {
        frameworkId: string;
        id?: { notIn: string[] };
      } = {
        frameworkId: input.frameworkId,
      };

      if (satisfiedControlIds.length > 0) {
        whereClause.id = { notIn: satisfiedControlIds };
      }

      // Get total count for pagination
      const totalCount = await ctx.db.control.count({
        where: whereClause,
      });

      // Get unsatisfied controls with pagination
      const gaps = await ctx.db.control.findMany({
        where: whereClause,
        orderBy: { controlId: "asc" },
        skip: input.page * input.pageSize,
        take: input.pageSize,
      });

      // Get control domain mappings for these controls
      const controlDomainMappings = await ctx.db.controlDomainMapping.findMany({
        where: {
          frameworkCode: framework.code,
          controlId: { in: gaps.map(g => g.controlId) },
        },
        include: {
          ControlDomain: {
            select: { name: true },
          },
        },
      });

      // Map control domains to controls
      const domainsByControlId = new Map<string, string[]>();
      for (const mapping of controlDomainMappings) {
        const domains = domainsByControlId.get(mapping.controlId) ?? [];
        domains.push(mapping.ControlDomain.name);
        domainsByControlId.set(mapping.controlId, domains);
      }

      return {
        gaps: gaps.map((control) => ({
          id: control.id,
          controlId: control.controlId,
          title: control.title,
          description: control.description,
          controlDomains: domainsByControlId.get(control.controlId) ?? [],
        })),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / input.pageSize),
        },
      };
    }),

  /**
   * Get coverage summary statistics
   *
   * Returns overall compliance statistics across all active frameworks.
   *
   * @requires FRAMEWORK_READ permission
   */
  getCoverageSummary: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }) => {
      // Get all active frameworks
      const activeFrameworks = await ctx.db.framework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        include: {
          _count: {
            select: { Control: true },
          },
        },
      });

      let totalControls = 0;
      let totalSatisfied = 0;

      for (const framework of activeFrameworks) {
        totalControls += framework._count.Control;
        const satisfied = await calculateSatisfiedControls(
          ctx.db,
          framework.id,
          framework.code,
          ctx.organizationId!
        );
        totalSatisfied += satisfied;
      }

      const overallCoverage = totalControls > 0
        ? Math.round((totalSatisfied / totalControls) * 1000) / 10
        : 0;

      // Get evidence count
      const evidenceCount = await ctx.db.evidence.count({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      // Get tagged evidence count
      const taggedEvidenceCount = await ctx.db.evidence.count({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          EvidenceControlDomain: {
            some: {},
          },
        },
      });

      return {
        activeFrameworks: activeFrameworks.length,
        totalControls,
        satisfiedControls: totalSatisfied,
        overallCoverage,
        evidenceCount,
        taggedEvidenceCount,
      };
    }),

  /**
   * Get evidence distribution by control domain
   *
   * Shows how many evidence items are tagged to each control domain.
   *
   * @requires FRAMEWORK_READ permission
   * @see Story 2.6: AC17
   */
  getEvidenceDistribution: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }) => {
      // Get all control domains with evidence counts
      const domains = await ctx.db.controlDomain.findMany({
        where: {
          isActive: true,
        },
        include: {
          _count: {
            select: {
              EvidenceControlDomain: {
                where: {
                  Evidence: {
                    organizationId: ctx.organizationId!,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      return domains.map((domain) => ({
        domainId: domain.id,
        domainCode: domain.code,
        domainName: domain.name,
        evidenceCount: domain._count.EvidenceControlDomain,
      }));
    }),
});

/**
 * Calculate the number of satisfied controls for a framework
 *
 * A control is satisfied if:
 * 1. There's a ControlDomainMapping linking the control ID to a control domain
 * 2. There's evidence tagged with that control domain (via EvidenceControlDomain)
 */
async function calculateSatisfiedControls(
  db: typeof import("@/server/db").db,
  frameworkId: string,
  frameworkCode: string,
  organizationId: string
): Promise<number> {
  // Get all control IDs in this framework
  const controls = await db.control.findMany({
    where: {
      frameworkId,
    },
    select: {
      controlId: true,
    },
  });

  if (controls.length === 0) {
    return 0;
  }

  // Get control domain IDs that have active evidence for this organization
  const domainsWithEvidence = await db.evidenceControlDomain.findMany({
    where: {
      Evidence: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      controlDomainId: true,
    },
    distinct: ["controlDomainId"],
  });

  if (domainsWithEvidence.length === 0) {
    return 0;
  }

  const domainIds = domainsWithEvidence.map((d) => d.controlDomainId);

  // Get control IDs that are mapped to these domains for this framework
  const satisfiedMappings = await db.controlDomainMapping.findMany({
    where: {
      frameworkCode,
      controlDomainId: { in: domainIds },
    },
    select: {
      controlId: true,
    },
    distinct: ["controlId"],
  });

  const satisfiedControlIds = new Set(satisfiedMappings.map((m) => m.controlId));

  // Count how many of our framework's controls are satisfied
  let satisfiedCount = 0;
  for (const control of controls) {
    if (satisfiedControlIds.has(control.controlId)) {
      satisfiedCount++;
    }
  }

  return satisfiedCount;
}

/**
 * Get the IDs of satisfied controls (for gap analysis)
 */
async function getSatisfiedControlIds(
  db: typeof import("@/server/db").db,
  frameworkId: string,
  frameworkCode: string,
  organizationId: string
): Promise<string[]> {
  // Get control domain IDs that have active evidence
  const domainsWithEvidence = await db.evidenceControlDomain.findMany({
    where: {
      Evidence: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      controlDomainId: true,
    },
    distinct: ["controlDomainId"],
  });

  if (domainsWithEvidence.length === 0) {
    return [];
  }

  const domainIds = domainsWithEvidence.map((d) => d.controlDomainId);

  // Get control IDs that are mapped to these domains
  const satisfiedMappings = await db.controlDomainMapping.findMany({
    where: {
      frameworkCode,
      controlDomainId: { in: domainIds },
    },
    select: {
      controlId: true,
    },
    distinct: ["controlId"],
  });

  const satisfiedControlIds = new Set(satisfiedMappings.map((m) => m.controlId));

  // Get the database IDs of controls that are satisfied
  const satisfiedControls = await db.control.findMany({
    where: {
      frameworkId,
      controlId: { in: Array.from(satisfiedControlIds) },
    },
    select: {
      id: true,
    },
  });

  return satisfiedControls.map((c) => c.id);
}
