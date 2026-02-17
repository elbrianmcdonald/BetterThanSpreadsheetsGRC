/**
 * Control Domain Router - tRPC procedures for simplified control taxonomy
 *
 * Provides:
 * - List active control domains (public for dropdowns)
 * - List all control domains (admin view)
 * - Update control domain (activate/deactivate, reorder)
 *
 * @see Story 2.3: Simplified Control Taxonomy Definition
 * @module server/api/routers/controlDomain
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";

/**
 * Control Domain Router
 */
export const controlDomainRouter = createTRPCRouter({
  /**
   * List active control domains
   *
   * Returns only active domains, sorted by sortOrder.
   * Used for dropdowns in evidence tagging and risk templates.
   *
   * @public - No authentication required for taxonomy data
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const domains = await ctx.db.controlDomain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
    });

    return domains;
  }),

  /**
   * List all control domains (including inactive)
   *
   * Returns all domains for admin management.
   *
   * @requires ORG_ADMIN role
   */
  listAll: adminProcedure.query(async ({ ctx }) => {
    const domains = await ctx.db.controlDomain.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return domains;
  }),

  /**
   * Get a single control domain by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const domain = await ctx.db.controlDomain.findUnique({
        where: { id: input.id },
      });

      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control domain not found",
        });
      }

      return domain;
    }),

  /**
   * Update control domain (activate/deactivate or reorder)
   *
   * @requires ORG_ADMIN role
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current domain state
      const currentDomain = await ctx.db.controlDomain.findUnique({
        where: { id: input.id },
      });

      if (!currentDomain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control domain not found",
        });
      }

      // Build update data
      const updateData: { isActive?: boolean; sortOrder?: number } = {};

      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      if (input.sortOrder !== undefined) {
        updateData.sortOrder = input.sortOrder;
      }

      // Update domain
      const updatedDomain = await ctx.db.controlDomain.update({
        where: { id: input.id },
        data: updateData,
      });

      // Create audit log if status changed
      if (input.isActive !== undefined && input.isActive !== currentDomain.isActive) {
        await createAuditLog({
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: input.isActive ? "ACTIVATE_DOMAIN" : "DEACTIVATE_DOMAIN",
          entityType: "ControlDomain",
          entityId: input.id,
          changes: {
            before: { isActive: currentDomain.isActive },
            after: { isActive: input.isActive },
          },
        });
      }

      return updatedDomain;
    }),

  /**
   * Get evidence counts per control domain
   *
   * Story 3.3: AC17 - Control domain tag counts queryable
   * Returns count of active evidence files per control domain.
   *
   * @requires Authentication
   */
  getEvidenceCounts: protectedProcedure.query(async ({ ctx }) => {
    // Get all control domains with their evidence counts
    const domains = await ctx.db.controlDomain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
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
    });

    return domains.map((domain) => ({
      id: domain.id,
      code: domain.code,
      name: domain.name,
      evidenceCount: domain._count.EvidenceControlDomain,
    }));
  }),

  /**
   * Reorder control domains (bulk update sortOrder)
   *
   * @requires ORG_ADMIN role
   */
  reorder: adminProcedure
    .input(
      z.object({
        orderings: z.array(
          z.object({
            id: z.string(),
            sortOrder: z.number().int().min(1),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update all domains in a transaction
      await ctx.db.$transaction(
        input.orderings.map((item) =>
          ctx.db.controlDomain.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          })
        )
      );

      // Create audit log for reordering
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "REORDER_DOMAINS",
        entityType: "ControlDomain",
        entityId: "bulk",
        changes: {
          after: { orderings: input.orderings },
        },
      });

      return { success: true };
    }),

  // ============================================
  // Control Tagging Endpoints
  // ============================================

  /**
   * Tag a framework control with domains
   * @requires ORG_ADMIN role
   */
  tagControl: adminProcedure
    .input(
      z.object({
        controlId: z.string(),
        domainIds: z.array(z.string()).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify control exists and belongs to organization
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.controlId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Verify all domains exist
      const domains = await ctx.db.controlDomain.findMany({
        where: { id: { in: input.domainIds } },
      });

      if (domains.length !== input.domainIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more domains not found",
        });
      }

      // Create tags (skip duplicates)
      await ctx.db.controlDomainControl.createMany({
        data: input.domainIds.map((domainId) => ({
          controlDomainId: domainId,
          controlId: input.controlId,
        })),
        skipDuplicates: true,
      });

      return { success: true };
    }),

  /**
   * Remove domain tags from a framework control
   * @requires ORG_ADMIN role
   */
  untagControl: adminProcedure
    .input(
      z.object({
        controlId: z.string(),
        domainIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify control exists and belongs to organization
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.controlId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      await ctx.db.controlDomainControl.deleteMany({
        where: {
          controlId: input.controlId,
          controlDomainId: { in: input.domainIds },
        },
      });

      return { success: true };
    }),

  /**
   * Set domains for a framework control (replaces existing)
   * @requires ORG_ADMIN role
   */
  setControlDomains: adminProcedure
    .input(
      z.object({
        controlId: z.string(),
        domainIds: z.array(z.string()).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify control exists and belongs to organization
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.controlId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Transaction: delete existing and create new
      await ctx.db.$transaction(async (tx) => {
        await tx.controlDomainControl.deleteMany({
          where: { controlId: input.controlId },
        });

        if (input.domainIds.length > 0) {
          await tx.controlDomainControl.createMany({
            data: input.domainIds.map((domainId) => ({
              controlDomainId: domainId,
              controlId: input.controlId,
            })),
          });
        }
      });

      return { success: true };
    }),

  /**
   * Tag a standard control with domains
   * @requires ORG_ADMIN role
   */
  tagStandardControl: adminProcedure
    .input(
      z.object({
        standardControlId: z.string(),
        domainIds: z.array(z.string()).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify standard control exists and belongs to organization's standard
      const standardControl = await ctx.db.standardControl.findFirst({
        where: {
          id: input.standardControlId,
          Standard: { organizationId: ctx.organizationId! },
        },
      });

      if (!standardControl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard control not found",
        });
      }

      await ctx.db.controlDomainStandardControl.createMany({
        data: input.domainIds.map((domainId) => ({
          controlDomainId: domainId,
          standardControlId: input.standardControlId,
        })),
        skipDuplicates: true,
      });

      return { success: true };
    }),

  /**
   * Set domains for a standard control (replaces existing)
   * @requires ORG_ADMIN role
   */
  setStandardControlDomains: adminProcedure
    .input(
      z.object({
        standardControlId: z.string(),
        domainIds: z.array(z.string()).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const standardControl = await ctx.db.standardControl.findFirst({
        where: {
          id: input.standardControlId,
          Standard: { organizationId: ctx.organizationId! },
        },
      });

      if (!standardControl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard control not found",
        });
      }

      await ctx.db.$transaction(async (tx) => {
        // Delete existing tags
        await tx.controlDomainStandardControl.deleteMany({
          where: { standardControlId: input.standardControlId },
        });

        // Create new tags if any
        if (input.domainIds.length > 0) {
          await tx.controlDomainStandardControl.createMany({
            data: input.domainIds.map((domainId) => ({
              controlDomainId: domainId,
              standardControlId: input.standardControlId,
            })),
          });
        }
      });

      return { success: true };
    }),

  /**
   * Get domains for a framework control
   */
  getDomainsForControl: protectedProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tags = await ctx.db.controlDomainControl.findMany({
        where: { controlId: input.controlId },
        include: {
          ControlDomain: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      return tags.map((t) => t.ControlDomain);
    }),

  /**
   * Get domains for a standard control
   */
  getDomainsForStandardControl: protectedProcedure
    .input(z.object({ standardControlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tags = await ctx.db.controlDomainStandardControl.findMany({
        where: { standardControlId: input.standardControlId },
        include: {
          ControlDomain: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      return tags.map((t) => t.ControlDomain);
    }),

  /**
   * Get all framework controls tagged with specific domains
   */
  getControlsByDomains: protectedProcedure
    .input(
      z.object({
        domainIds: z.array(z.string()).min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const tags = await ctx.db.controlDomainControl.findMany({
        where: {
          controlDomainId: { in: input.domainIds },
          Control: { organizationId: ctx.organizationId! },
        },
        include: {
          Control: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          ControlDomain: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      return tags;
    }),

  /**
   * Get all standard controls tagged with specific domains
   */
  getStandardControlsByDomains: protectedProcedure
    .input(
      z.object({
        domainIds: z.array(z.string()).min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const tags = await ctx.db.controlDomainStandardControl.findMany({
        where: {
          controlDomainId: { in: input.domainIds },
          StandardControl: {
            Standard: { organizationId: ctx.organizationId! },
          },
        },
        include: {
          StandardControl: {
            select: {
              id: true,
              code: true,
              title: true,
              Standard: {
                select: { id: true, title: true },
              },
            },
          },
          ControlDomain: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      return tags;
    }),
});
