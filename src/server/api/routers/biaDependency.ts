/**
 * BIA Dependencies Router
 *
 * tRPC router for Business Process dependency management.
 *
 * Epic 12: BIA Dependencies & Integration
 * - Story 12.1: Process Dependencies Data Model (FR29, FR30)
 * - Story 12.2: Upstream/Downstream Process Linking UI
 * - Story 12.3: Vendor Linkage with Auto-Suggest (FR31, FR32, FR33)
 * - Story 12.4: Risk Registry Integration (FR34, FR35)
 * - Story 12.5: Resource Dependencies (FR36, FR37, FR38)
 * - Story 12.6: Peak Time Criticality (FR39)
 * - Story 12.7: Cross-Module Dependency Views (FR40)
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
 * Roles that can view BIA dependencies
 */
const DEPENDENCY_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * Roles that can manage BIA dependencies
 */
const DEPENDENCY_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

/**
 * Resource dependency schemas
 */
const peopleDependencySchema = z.object({
  id: z.string().optional(),
  role: z.string().min(1).max(200),
  criticality: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().max(1000).optional(),
});

const facilityDependencySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  location: z.string().max(500).optional(),
  criticality: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().max(1000).optional(),
});

const transportDependencySchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(500),
  type: z.string().max(100).optional(), // Logistics, Travel, etc.
  criticality: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().max(1000).optional(),
});

export const biaDependencyRouter = createTRPCRouter({
  /**
   * Get all dependencies for a process
   */
  getProcessDependencies: organizationProcedure
    .use(requireRole(DEPENDENCY_VIEW_ROLES))
    .input(z.object({ processId: z.string() }))
    .query(async ({ ctx, input }) => {
      const process = await ctx.db.businessProcess.findUnique({
        where: { id: input.processId },
        include: {
          // Upstream: processes this one depends on
          upstreamDependencies: {
            include: {
              upstreamProcess: {
                include: {
                  calculatedTier: true,
                  overrideTier: true,
                  owner: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          // Downstream: processes that depend on this one
          downstreamDependencies: {
            include: {
              downstreamProcess: {
                include: {
                  calculatedTier: true,
                  overrideTier: true,
                  owner: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          // Vendor links
          vendorLinks: {
            include: {
              vendor: {
                select: {
                  id: true,
                  identifier: true,
                  name: true,
                  status: true,
                  category: true,
                },
              },
            },
          },
          // Risk links
          riskLinks: {
            include: {
              risk: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  severity: true,
                },
              },
            },
          },
        },
      });

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Business process not found",
        });
      }

      // Parse JSON resource dependencies
      const peopleDependencies = process.peopleDependencies as unknown[];
      const facilitiesDependencies = process.facilitiesDependencies as unknown[];
      const transportDependencies = process.transportDependencies as unknown[];

      return {
        // Process dependencies
        upstreamProcesses: process.upstreamDependencies.map((dep) => ({
          id: dep.id,
          notes: dep.notes,
          process: {
            id: dep.upstreamProcess.id,
            identifier: dep.upstreamProcess.identifier,
            name: dep.upstreamProcess.name,
            tier: dep.upstreamProcess.overrideTier ?? dep.upstreamProcess.calculatedTier,
            owner: dep.upstreamProcess.owner,
          },
        })),
        downstreamProcesses: process.downstreamDependencies.map((dep) => ({
          id: dep.id,
          notes: dep.notes,
          process: {
            id: dep.downstreamProcess.id,
            identifier: dep.downstreamProcess.identifier,
            name: dep.downstreamProcess.name,
            tier: dep.downstreamProcess.overrideTier ?? dep.downstreamProcess.calculatedTier,
            owner: dep.downstreamProcess.owner,
          },
        })),
        // Vendor links
        vendors: process.vendorLinks.map((link) => ({
          id: link.id,
          notes: link.notes,
          criticality: link.criticality,
          vendor: link.vendor,
        })),
        // Risk links
        risks: process.riskLinks.map((link) => ({
          id: link.id,
          notes: link.notes,
          risk: link.risk,
        })),
        // Resource dependencies
        peopleDependencies: Array.isArray(peopleDependencies) ? peopleDependencies : [],
        facilitiesDependencies: Array.isArray(facilitiesDependencies) ? facilitiesDependencies : [],
        transportDependencies: Array.isArray(transportDependencies) ? transportDependencies : [],
        // Peak time
        peakTime: {
          description: process.peakTimeDescription,
          days: process.peakDays ? JSON.parse(process.peakDays as string) : [],
          startTime: process.peakStartTime,
          endTime: process.peakEndTime,
        },
      };
    }),

  /**
   * Search processes for dependency linking (excludes current process)
   */
  searchProcesses: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      query: z.string().min(2),
      excludeProcessId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const processes = await ctx.db.businessProcess.findMany({
        where: {
          organizationId: ctx.organizationId!,
          id: { not: input.excludeProcessId },
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { identifier: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          name: true,
          calculatedTier: { select: { name: true, colorHex: true } },
          overrideTier: { select: { name: true, colorHex: true } },
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      return processes.map((p) => ({
        id: p.id,
        identifier: p.identifier,
        name: p.name,
        tier: p.overrideTier ?? p.calculatedTier,
      }));
    }),

  /**
   * Add upstream dependency (Story 12.2 - FR29)
   */
  addUpstreamDependency: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      processId: z.string(),
      upstreamProcessId: z.string(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify both processes exist and belong to org
      const [process, upstreamProcess] = await Promise.all([
        ctx.db.businessProcess.findUnique({ where: { id: input.processId } }),
        ctx.db.businessProcess.findUnique({ where: { id: input.upstreamProcessId } }),
      ]);

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Process not found" });
      }
      if (!upstreamProcess || upstreamProcess.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upstream process not found" });
      }
      if (input.processId === input.upstreamProcessId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot depend on self" });
      }

      // Check for existing dependency
      const existing = await ctx.db.businessProcessDependency.findFirst({
        where: {
          upstreamProcessId: input.upstreamProcessId,
          downstreamProcessId: input.processId,
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Dependency already exists" });
      }

      const dependency = await ctx.db.businessProcessDependency.create({
        data: {
          upstreamProcessId: input.upstreamProcessId,
          downstreamProcessId: input.processId,
          notes: input.notes,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_DEPENDENCY_ADDED,
        entityType: "BusinessProcessDependency",
        entityId: dependency.id,
        changes: {
          after: {
            processId: input.processId,
            upstreamProcessId: input.upstreamProcessId,
            type: "upstream",
          },
        },
      });

      return dependency;
    }),

  /**
   * Remove a process dependency
   */
  removeDependency: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({ dependencyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dependency = await ctx.db.businessProcessDependency.findUnique({
        where: { id: input.dependencyId },
        include: {
          upstreamProcess: { select: { organizationId: true } },
        },
      });

      if (!dependency || dependency.upstreamProcess.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dependency not found" });
      }

      await ctx.db.businessProcessDependency.delete({
        where: { id: input.dependencyId },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_DEPENDENCY_REMOVED,
        entityType: "BusinessProcessDependency",
        entityId: input.dependencyId,
        changes: { before: dependency },
      });

      return { success: true };
    }),

  /**
   * Search vendors for linking (Story 12.3 - FR32)
   */
  searchVendors: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      query: z.string().min(2),
      excludeProcessId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Get already linked vendor IDs to exclude
      const linkedVendorIds = input.excludeProcessId
        ? (await ctx.db.businessProcessVendor.findMany({
            where: { processId: input.excludeProcessId },
            select: { vendorId: true },
          })).map((v) => v.vendorId)
        : [];

      const vendors = await ctx.db.vendor.findMany({
        where: {
          organizationId: ctx.organizationId!,
          id: { notIn: linkedVendorIds },
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { identifier: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          name: true,
          status: true,
          category: true,
        },
        take: 10,
        orderBy: { name: "asc" },
      });

      return vendors;
    }),

  /**
   * Link vendor to process (Story 12.3 - FR31)
   */
  linkVendor: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      processId: z.string(),
      vendorId: z.string(),
      criticality: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify process and vendor exist
      const [process, vendor] = await Promise.all([
        ctx.db.businessProcess.findUnique({ where: { id: input.processId } }),
        ctx.db.vendor.findUnique({ where: { id: input.vendorId } }),
      ]);

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Process not found" });
      }
      if (!vendor || vendor.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      // Check for existing link
      const existing = await ctx.db.businessProcessVendor.findUnique({
        where: {
          processId_vendorId: {
            processId: input.processId,
            vendorId: input.vendorId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Vendor already linked" });
      }

      const link = await ctx.db.businessProcessVendor.create({
        data: {
          processId: input.processId,
          vendorId: input.vendorId,
          criticality: input.criticality,
          notes: input.notes,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_VENDOR_LINKED,
        entityType: "BusinessProcessVendor",
        entityId: link.id,
        changes: {
          after: { processId: input.processId, vendorId: input.vendorId },
        },
      });

      return link;
    }),

  /**
   * Unlink vendor from process
   */
  unlinkVendor: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({ linkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.businessProcessVendor.findUnique({
        where: { id: input.linkId },
        include: {
          process: { select: { organizationId: true } },
        },
      });

      if (!link || link.process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor link not found" });
      }

      await ctx.db.businessProcessVendor.delete({
        where: { id: input.linkId },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_VENDOR_UNLINKED,
        entityType: "BusinessProcessVendor",
        entityId: input.linkId,
        changes: { before: link },
      });

      return { success: true };
    }),

  /**
   * Search risks for linking (Story 12.4)
   */
  searchRisks: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      query: z.string().min(2),
      excludeProcessId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Get already linked risk IDs to exclude
      const linkedRiskIds = input.excludeProcessId
        ? (await ctx.db.businessProcessRisk.findMany({
            where: { processId: input.excludeProcessId },
            select: { riskId: true },
          })).map((r) => r.riskId)
        : [];

      const risks = await ctx.db.risk.findMany({
        where: {
          organizationId: ctx.organizationId!,
          id: { notIn: linkedRiskIds },
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
        },
        take: 10,
        orderBy: { title: "asc" },
      });

      return risks;
    }),

  /**
   * Link risk to process (Story 12.4 - FR34)
   */
  linkRisk: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      processId: z.string(),
      riskId: z.string(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify process and risk exist
      const [process, risk] = await Promise.all([
        ctx.db.businessProcess.findUnique({ where: { id: input.processId } }),
        ctx.db.risk.findUnique({ where: { id: input.riskId } }),
      ]);

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Process not found" });
      }
      if (!risk || risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      // Check for existing link
      const existing = await ctx.db.businessProcessRisk.findUnique({
        where: {
          processId_riskId: {
            processId: input.processId,
            riskId: input.riskId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Risk already linked" });
      }

      const link = await ctx.db.businessProcessRisk.create({
        data: {
          processId: input.processId,
          riskId: input.riskId,
          notes: input.notes,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_RISK_LINKED,
        entityType: "BusinessProcessRisk",
        entityId: link.id,
        changes: {
          after: { processId: input.processId, riskId: input.riskId },
        },
      });

      return link;
    }),

  /**
   * Unlink risk from process
   */
  unlinkRisk: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({ linkId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.businessProcessRisk.findUnique({
        where: { id: input.linkId },
        include: {
          process: { select: { organizationId: true } },
        },
      });

      if (!link || link.process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk link not found" });
      }

      await ctx.db.businessProcessRisk.delete({
        where: { id: input.linkId },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_RISK_UNLINKED,
        entityType: "BusinessProcessRisk",
        entityId: input.linkId,
        changes: { before: link },
      });

      return { success: true };
    }),

  /**
   * Update resource dependencies (Story 12.5 - FR36, FR37, FR38)
   */
  updateResourceDependencies: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      processId: z.string(),
      peopleDependencies: z.array(peopleDependencySchema).optional(),
      facilitiesDependencies: z.array(facilityDependencySchema).optional(),
      transportDependencies: z.array(transportDependencySchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const process = await ctx.db.businessProcess.findUnique({
        where: { id: input.processId },
      });

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Process not found" });
      }

      // Build update data - only include fields that were provided
      const updateData: Record<string, unknown> = {};
      if (input.peopleDependencies !== undefined) {
        // Add IDs to new entries
        updateData.peopleDependencies = input.peopleDependencies.map((dep) => ({
          ...dep,
          id: dep.id || `ppl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }));
      }
      if (input.facilitiesDependencies !== undefined) {
        updateData.facilitiesDependencies = input.facilitiesDependencies.map((dep) => ({
          ...dep,
          id: dep.id || `fac_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }));
      }
      if (input.transportDependencies !== undefined) {
        updateData.transportDependencies = input.transportDependencies.map((dep) => ({
          ...dep,
          id: dep.id || `trn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }));
      }

      const updated = await ctx.db.businessProcess.update({
        where: { id: input.processId },
        data: updateData,
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_RESOURCE_DEPS_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: { after: updateData },
      });

      return updated;
    }),

  /**
   * Update peak time configuration (Story 12.6 - FR39)
   */
  updatePeakTime: organizationProcedure
    .use(requireRole(DEPENDENCY_MANAGE_ROLES))
    .input(z.object({
      processId: z.string(),
      description: z.string().max(1000).optional().nullable(),
      days: z.array(z.string()).optional(),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const process = await ctx.db.businessProcess.findUnique({
        where: { id: input.processId },
      });

      if (!process || process.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Process not found" });
      }

      const updated = await ctx.db.businessProcess.update({
        where: { id: input.processId },
        data: {
          peakTimeDescription: input.description,
          peakDays: input.days ? JSON.stringify(input.days) : null,
          peakStartTime: input.startTime,
          peakEndTime: input.endTime,
        },
      });

      // Audit log
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BUSINESS_PROCESS_PEAK_TIME_UPDATED,
        entityType: "BusinessProcess",
        entityId: input.processId,
        changes: {
          after: {
            peakTimeDescription: input.description,
            peakDays: input.days,
            peakStartTime: input.startTime,
            peakEndTime: input.endTime,
          },
        },
      });

      return updated;
    }),

  /**
   * Get processes linked to a vendor (Story 12.7 - FR33, FR40)
   */
  getProcessesByVendor: organizationProcedure
    .use(requireRole(DEPENDENCY_VIEW_ROLES))
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findUnique({
        where: { id: input.vendorId },
      });

      if (!vendor || vendor.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const links = await ctx.db.businessProcessVendor.findMany({
        where: { vendorId: input.vendorId },
        include: {
          process: {
            include: {
              businessFunction: { select: { id: true, name: true } },
              calculatedTier: { select: { name: true, colorHex: true, tierLevel: true } },
              overrideTier: { select: { name: true, colorHex: true, tierLevel: true } },
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      // Calculate tier distribution
      const tierCounts: Record<string, number> = {};
      links.forEach((link) => {
        const tier = link.process.overrideTier ?? link.process.calculatedTier;
        const tierName = tier?.name ?? "Not Assessed";
        tierCounts[tierName] = (tierCounts[tierName] ?? 0) + 1;
      });

      return {
        vendor: {
          id: vendor.id,
          identifier: vendor.identifier,
          name: vendor.name,
        },
        processes: links.map((link) => ({
          id: link.process.id,
          identifier: link.process.identifier,
          name: link.process.name,
          businessFunction: link.process.businessFunction,
          tier: link.process.overrideTier ?? link.process.calculatedTier,
          owner: link.process.owner,
          criticality: link.criticality,
        })),
        tierDistribution: tierCounts,
        totalCount: links.length,
      };
    }),

  /**
   * Get processes linked to a risk (Story 12.7 - FR35)
   */
  getProcessesByRisk: organizationProcedure
    .use(requireRole(DEPENDENCY_VIEW_ROLES))
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const risk = await ctx.db.risk.findUnique({
        where: { id: input.riskId },
      });

      if (!risk || risk.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Risk not found" });
      }

      const links = await ctx.db.businessProcessRisk.findMany({
        where: { riskId: input.riskId },
        include: {
          process: {
            include: {
              businessFunction: { select: { id: true, name: true } },
              calculatedTier: { select: { name: true, colorHex: true, tierLevel: true } },
              overrideTier: { select: { name: true, colorHex: true, tierLevel: true } },
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return {
        risk: {
          id: risk.id,
          title: risk.title,
          status: risk.status,
          severity: risk.severity,
        },
        processes: links.map((link) => ({
          id: link.process.id,
          identifier: link.process.identifier,
          name: link.process.name,
          businessFunction: link.process.businessFunction,
          tier: link.process.overrideTier ?? link.process.calculatedTier,
          owner: link.process.owner,
        })),
        totalCount: links.length,
      };
    }),
});
