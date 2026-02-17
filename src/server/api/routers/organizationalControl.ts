/**
 * Organizational Control tRPC Router
 *
 * Manages user-defined controls that can be:
 * - Created on-the-fly while editing risks
 * - Optionally mapped to framework controls
 * - Linked to risks as "in place" or "needed"
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction, OrgControlType, OrgControlStatus, RiskOrgControlRole } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";

export const organizationalControlRouter = createTRPCRouter({
  /**
   * List all organizational controls for the organization
   */
  list: organizationProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.nativeEnum(OrgControlStatus).optional(),
        controlType: z.nativeEnum(OrgControlType).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const controls = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.status && { status: input.status }),
          ...(input.controlType && { controlType: input.controlType }),
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              RiskLinks: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | undefined;
      if (controls.length > input.limit) {
        const nextItem = controls.pop();
        nextCursor = nextItem?.id;
      }

      return {
        controls,
        nextCursor,
      };
    }),

  /**
   * Search controls by name for autocomplete
   */
  search: organizationProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
        excludeIds: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const controls = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId: ctx.organizationId!,
          status: OrgControlStatus.ACTIVE,
          name: { contains: input.query, mode: "insensitive" },
          ...(input.excludeIds?.length && {
            id: { notIn: input.excludeIds },
          }),
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });

      return controls;
    }),

  /**
   * Quick create - Create a control with just a name (or return existing)
   * Similar to business unit quick create pattern
   */
  quickCreate: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(200),
        controlType: z.nativeEnum(OrgControlType).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create controls",
        });
      }

      // Check for existing control with same name (case-insensitive)
      const existing = await ctx.db.organizationalControl.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: { equals: input.name, mode: "insensitive" },
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                },
              },
            },
          },
        },
      });

      if (existing) {
        return { ...existing, created: false };
      }

      // Create new control
      const newControl = await ctx.db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          controlType: input.controlType ?? OrgControlType.MITIGATING,
          status: OrgControlStatus.ACTIVE,
          createdById: ctx.session!.user.id,
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                },
              },
            },
          },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: newControl.id,
          changes: {
            action: "QUICK_CREATE",
            name: input.name,
            controlType: input.controlType,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { ...newControl, created: true };
    }),

  /**
   * Create a control with full details including optional framework mapping
   */
  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(200),
        description: z.string().max(5000).optional(),
        controlType: z.nativeEnum(OrgControlType).default(OrgControlType.MITIGATING),
        frameworkControlId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create controls",
        });
      }

      // Check for duplicate name
      const existing = await ctx.db.organizationalControl.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          name: { equals: input.name, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A control with this name already exists",
        });
      }

      // Validate framework control if provided
      if (input.frameworkControlId) {
        const frameworkControl = await ctx.db.control.findFirst({
          where: {
            id: input.frameworkControlId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!frameworkControl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Framework control not found",
          });
        }
      }

      const newControl = await ctx.db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          description: input.description,
          controlType: input.controlType,
          status: OrgControlStatus.ACTIVE,
          frameworkControlId: input.frameworkControlId,
          createdById: ctx.session!.user.id,
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.CREATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: newControl.id,
          changes: {
            action: "CREATE",
            ...input,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return newControl;
    }),

  /**
   * Update an organizational control
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(5000).optional().nullable(),
        controlType: z.nativeEnum(OrgControlType).optional(),
        status: z.nativeEnum(OrgControlStatus).optional(),
        frameworkControlId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update controls",
        });
      }

      const existing = await ctx.db.organizationalControl.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Check for name conflict if updating name
      if (input.name && input.name !== existing.name) {
        const duplicate = await ctx.db.organizationalControl.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            name: { equals: input.name, mode: "insensitive" },
            id: { not: input.id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A control with this name already exists",
          });
        }
      }

      const updated = await ctx.db.organizationalControl.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.controlType && { controlType: input.controlType }),
          ...(input.status && { status: input.status }),
          ...(input.frameworkControlId !== undefined && { frameworkControlId: input.frameworkControlId }),
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return updated;
    }),

  /**
   * Get controls linked to a specific risk
   */
  getForRisk: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.riskOrganizationalControl.findMany({
        where: {
          riskId: input.riskId,
          organizationId: ctx.organizationId!,
        },
        include: {
          OrganizationalControl: {
            include: {
              FrameworkControl: {
                select: {
                  id: true,
                  controlId: true,
                  title: true,
                  Framework: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          OrganizationalControl: { name: "asc" },
        },
      });

      // Group by role
      const inPlace = links.filter((l) => l.role === RiskOrgControlRole.IN_PLACE);
      const needed = links.filter((l) => l.role === RiskOrgControlRole.NEEDED);

      return { inPlace, needed };
    }),

  /**
   * Link a control to a risk
   */
  linkToRisk: organizationProcedure
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
        role: z.nativeEnum(RiskOrgControlRole),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to link controls",
        });
      }

      // Verify risk exists
      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Verify control exists
      const control = await ctx.db.organizationalControl.findFirst({
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

      // Check if already linked
      const existingLink = await ctx.db.riskOrganizationalControl.findUnique({
        where: {
          riskId_organizationalControlId: {
            riskId: input.riskId,
            organizationalControlId: input.controlId,
          },
        },
      });

      if (existingLink) {
        // Update existing link's role
        const updated = await ctx.db.riskOrganizationalControl.update({
          where: { id: existingLink.id },
          data: {
            role: input.role,
            notes: input.notes,
          },
          include: {
            OrganizationalControl: {
              include: {
                FrameworkControl: {
                  select: {
                    id: true,
                    controlId: true,
                    title: true,
                    Framework: {
                      select: {
                        id: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        return updated;
      }

      // Create new link
      const link = await ctx.db.riskOrganizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          riskId: input.riskId,
          organizationalControlId: input.controlId,
          role: input.role,
          notes: input.notes,
          createdById: ctx.session!.user.id,
        },
        include: {
          OrganizationalControl: {
            include: {
              FrameworkControl: {
                select: {
                  id: true,
                  controlId: true,
                  title: true,
                  Framework: {
                    select: {
                      id: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return link;
    }),

  /**
   * Unlink a control from a risk
   */
  unlinkFromRisk: organizationProcedure
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to unlink controls",
        });
      }

      const link = await ctx.db.riskOrganizationalControl.findUnique({
        where: {
          riskId_organizationalControlId: {
            riskId: input.riskId,
            organizationalControlId: input.controlId,
          },
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found",
        });
      }

      await ctx.db.riskOrganizationalControl.delete({
        where: { id: link.id },
      });

      return { success: true };
    }),

  /**
   * Bulk link controls to a risk
   */
  bulkLinkToRisk: organizationProcedure
    .input(
      z.object({
        riskId: z.string(),
        controlIds: z.array(z.string()),
        role: z.nativeEnum(RiskOrgControlRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const allowedRoles = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];
      if (!allowedRoles.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to link controls",
        });
      }

      // Verify risk exists
      const risk = await ctx.db.risk.findFirst({
        where: {
          id: input.riskId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      // Get existing links
      const existingLinks = await ctx.db.riskOrganizationalControl.findMany({
        where: {
          riskId: input.riskId,
          organizationalControlId: { in: input.controlIds },
        },
      });

      const existingControlIds = new Set(existingLinks.map((l) => l.organizationalControlId));
      const newControlIds = input.controlIds.filter((id) => !existingControlIds.has(id));

      // Create new links
      if (newControlIds.length > 0) {
        await ctx.db.riskOrganizationalControl.createMany({
          data: newControlIds.map((controlId) => ({
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            riskId: input.riskId,
            organizationalControlId: controlId,
            role: input.role,
            createdById: ctx.session!.user.id,
          })),
        });
      }

      // Update existing links to new role
      if (existingLinks.length > 0) {
        await ctx.db.riskOrganizationalControl.updateMany({
          where: {
            id: { in: existingLinks.map((l) => l.id) },
          },
          data: { role: input.role },
        });
      }

      return { created: newControlIds.length, updated: existingLinks.length };
    }),
});
