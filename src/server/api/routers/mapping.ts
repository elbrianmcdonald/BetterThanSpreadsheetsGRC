/**
 * Control Domain Mapping Router
 *
 * OSCAL Translation Engine API - maps simplified control domains
 * to framework-specific OSCAL control IDs.
 *
 * @see Story 2.4: OSCAL Translation Engine
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";

export const mappingRouter = createTRPCRouter({
  /**
   * Translate a control domain to OSCAL control IDs across frameworks
   *
   * Returns controls grouped by framework for display in the UI.
   * Optionally filters by specific framework codes.
   */
  translateDomainToControls: publicProcedure
    .input(
      z.object({
        controlDomainId: z.string(),
        frameworkCodes: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const mappings = await ctx.db.controlDomainMapping.findMany({
        where: {
          controlDomainId: input.controlDomainId,
          frameworkCode: input.frameworkCodes
            ? { in: input.frameworkCodes }
            : undefined,
          confidence: { gte: input.minConfidence },
        },
        include: {
          ControlDomain: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: [{ frameworkCode: "asc" }, { controlId: "asc" }],
      });

      // Group by framework
      const grouped = mappings.reduce(
        (acc, mapping) => {
          const fwCode = mapping.frameworkCode;
          if (!acc[fwCode]) {
            acc[fwCode] = {
              frameworkCode: fwCode,
              controls: [],
            };
          }
          acc[fwCode].controls.push({
            controlId: mapping.controlId,
            confidence: mapping.confidence,
          });
          return acc;
        },
        {} as Record<
          string,
          {
            frameworkCode: string;
            controls: Array<{ controlId: string; confidence: number }>;
          }
        >
      );

      return {
        controlDomain: mappings[0]?.ControlDomain ?? null,
        frameworks: Object.values(grouped),
        totalControls: mappings.length,
      };
    }),

  /**
   * Find which control domains map to a specific control ID
   *
   * Reverse lookup - given a control ID and framework, find matching domains.
   */
  findDomainsForControl: publicProcedure
    .input(
      z.object({
        controlId: z.string(),
        frameworkCode: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const mappings = await ctx.db.controlDomainMapping.findMany({
        where: {
          controlId: input.controlId,
          frameworkCode: input.frameworkCode,
        },
        include: {
          ControlDomain: true,
        },
        orderBy: { confidence: "desc" },
      });

      return mappings.map((m) => ({
        domain: m.ControlDomain,
        confidence: m.confidence,
      }));
    }),

  /**
   * List all mappings with aggregated statistics
   *
   * Returns mapping summary grouped by domain and framework for admin UI.
   */
  listMappingSummary: adminProcedure.query(async ({ ctx }) => {
    const mappings = await ctx.db.controlDomainMapping.findMany({
      include: {
        ControlDomain: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [
        { ControlDomain: { sortOrder: "asc" } },
        { frameworkCode: "asc" },
      ],
    });

    // Group by domain and framework
    const summary = new Map<
      string,
      {
        domainId: string;
        domainCode: string;
        domainName: string;
        frameworks: Map<
          string,
          {
            frameworkCode: string;
            controlCount: number;
            totalConfidence: number;
          }
        >;
      }
    >();

    for (const mapping of mappings) {
      const domainKey = mapping.controlDomainId;

      if (!summary.has(domainKey)) {
        summary.set(domainKey, {
          domainId: mapping.ControlDomain.id,
          domainCode: mapping.ControlDomain.code,
          domainName: mapping.ControlDomain.name,
          frameworks: new Map(),
        });
      }

      const domainSummary = summary.get(domainKey)!;
      const fwKey = mapping.frameworkCode;

      if (!domainSummary.frameworks.has(fwKey)) {
        domainSummary.frameworks.set(fwKey, {
          frameworkCode: fwKey,
          controlCount: 0,
          totalConfidence: 0,
        });
      }

      const fwSummary = domainSummary.frameworks.get(fwKey)!;
      fwSummary.controlCount++;
      fwSummary.totalConfidence += mapping.confidence;
    }

    // Convert to array format
    return Array.from(summary.values()).map((domain) => ({
      domainId: domain.domainId,
      domainCode: domain.domainCode,
      domainName: domain.domainName,
      frameworks: Array.from(domain.frameworks.values()).map((fw) => ({
        frameworkCode: fw.frameworkCode,
        controlCount: fw.controlCount,
        avgConfidence: Math.round(fw.totalConfidence / fw.controlCount),
      })),
      totalMappings: Array.from(domain.frameworks.values()).reduce(
        (sum, fw) => sum + fw.controlCount,
        0
      ),
    }));
  }),

  /**
   * List mappings for a specific domain-framework pair
   *
   * Returns detailed mappings for drill-down view in admin UI.
   */
  listMappingsForDomainFramework: adminProcedure
    .input(
      z.object({
        controlDomainId: z.string(),
        frameworkCode: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.controlDomainMapping.findMany({
        where: {
          controlDomainId: input.controlDomainId,
          frameworkCode: input.frameworkCode,
        },
        orderBy: { controlId: "asc" },
      });
    }),

  /**
   * Create a new mapping
   *
   * Admin only - allows manual override of mappings.
   */
  createMapping: adminProcedure
    .input(
      z.object({
        controlDomainId: z.string(),
        frameworkCode: z.string(),
        controlId: z.string(),
        confidence: z.number().min(0).max(100).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate
      const existing = await ctx.db.controlDomainMapping.findUnique({
        where: {
          controlDomainId_frameworkCode_controlId: {
            controlDomainId: input.controlDomainId,
            frameworkCode: input.frameworkCode,
            controlId: input.controlId,
          },
        },
      });

      if (existing) {
        throw new Error("Mapping already exists");
      }

      const mapping = await ctx.db.controlDomainMapping.create({
        data: {
          id: randomUUID(),
          controlDomainId: input.controlDomainId,
          frameworkCode: input.frameworkCode,
          controlId: input.controlId,
          confidence: input.confidence,
          updatedAt: new Date(),
        },
        include: {
          ControlDomain: {
            select: { code: true, name: true },
          },
        },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "CREATE_MAPPING",
        entityType: "ControlDomainMapping",
        entityId: mapping.id,
        changes: {
          after: {
            controlDomainCode: mapping.ControlDomain.code,
            frameworkCode: mapping.frameworkCode,
            controlId: mapping.controlId,
            confidence: mapping.confidence,
          },
        },
      });

      return mapping;
    }),

  /**
   * Update mapping confidence score
   *
   * Admin only - allows adjusting confidence of existing mappings.
   */
  updateMappingConfidence: adminProcedure
    .input(
      z.object({
        id: z.string(),
        confidence: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.controlDomainMapping.findUnique({
        where: { id: input.id },
        include: {
          ControlDomain: { select: { code: true } },
        },
      });

      if (!existing) {
        throw new Error("Mapping not found");
      }

      const mapping = await ctx.db.controlDomainMapping.update({
        where: { id: input.id },
        data: { confidence: input.confidence },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_MAPPING",
        entityType: "ControlDomainMapping",
        entityId: mapping.id,
        changes: {
          before: { confidence: existing.confidence },
          after: { confidence: mapping.confidence },
        },
      });

      return mapping;
    }),

  /**
   * Delete a mapping
   *
   * Admin only - allows removing incorrect mappings.
   */
  deleteMapping: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.controlDomainMapping.findUnique({
        where: { id: input.id },
        include: {
          ControlDomain: { select: { code: true, name: true } },
        },
      });

      if (!existing) {
        throw new Error("Mapping not found");
      }

      await ctx.db.controlDomainMapping.delete({
        where: { id: input.id },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DELETE_MAPPING",
        entityType: "ControlDomainMapping",
        entityId: input.id,
        changes: {
          before: {
            controlDomainCode: existing.ControlDomain.code,
            frameworkCode: existing.frameworkCode,
            controlId: existing.controlId,
            confidence: existing.confidence,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get mapping statistics
   *
   * Returns overview statistics for the mapping dashboard.
   */
  getStatistics: publicProcedure.query(async ({ ctx }) => {
    const [totalMappings, domainCounts, frameworkCounts] = await Promise.all([
      ctx.db.controlDomainMapping.count(),
      ctx.db.controlDomainMapping.groupBy({
        by: ["controlDomainId"],
        _count: true,
      }),
      ctx.db.controlDomainMapping.groupBy({
        by: ["frameworkCode"],
        _count: true,
      }),
    ]);

    const avgMappingsPerDomain =
      domainCounts.length > 0
        ? Math.round(totalMappings / domainCounts.length)
        : 0;

    return {
      totalMappings,
      totalDomains: domainCounts.length,
      totalFrameworks: frameworkCounts.length,
      avgMappingsPerDomain,
      frameworkBreakdown: frameworkCounts.map((fc) => ({
        frameworkCode: fc.frameworkCode,
        count: fc._count,
      })),
    };
  }),

  /**
   * Export mappings to CSV format
   *
   * Admin only - exports all mappings for external review.
   */
  exportMappings: adminProcedure.query(async ({ ctx }) => {
    const mappings = await ctx.db.controlDomainMapping.findMany({
      include: {
        ControlDomain: {
          select: { code: true, name: true },
        },
      },
      orderBy: [
        { ControlDomain: { code: "asc" } },
        { frameworkCode: "asc" },
        { controlId: "asc" },
      ],
    });

    return mappings.map((m) => ({
      domainCode: m.ControlDomain.code,
      domainName: m.ControlDomain.name,
      frameworkCode: m.frameworkCode,
      controlId: m.controlId,
      confidence: m.confidence,
    }));
  }),
});
