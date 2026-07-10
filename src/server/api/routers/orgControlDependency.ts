/**
 * Organizational Control Dependency tRPC Router
 *
 * A dependency is either internal (child is another OrgControl) or external
 * (a free-text tool / service / process). Exactly one of the two must be set.
 *
 * Sub-Epic E.2 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { WRITE_ROLES } from "@/lib/auth/roles";

const ALLOWED_MUTATION_ROLES: readonly string[] = WRITE_ROLES;

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} dependencies`,
    });
  }
}

// Require exactly one of: childOrgControlId XOR (externalDependency + externalType)
function validateXor(opts: {
  childOrgControlId?: string | null;
  externalDependency?: string | null;
  externalType?: string | null;
}): void {
  const hasInternal = !!opts.childOrgControlId;
  const hasExternal = !!opts.externalDependency && !!opts.externalType;

  if (hasInternal && (opts.externalDependency || opts.externalType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "A dependency is either internal (child control) OR external (dependency + type), not both",
    });
  }
  if (!hasInternal && !hasExternal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Provide either childOrgControlId OR both externalDependency and externalType",
    });
  }
}

export const orgControlDependencyRouter = createTRPCRouter({
  /**
   * List dependencies for a control in both directions.
   */
  list: organizationProcedure
    .input(z.object({ orgControlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const [outgoing, incoming] = await Promise.all([
        ctx.db.orgControlDependency.findMany({
          where: { organizationId, parentOrgControlId: input.orgControlId },
          orderBy: { createdAt: "asc" },
          include: {
            Child: {
              select: {
                id: true,
                localControlId: true,
                name: true,
                status: true,
              },
            },
          },
        }),
        ctx.db.orgControlDependency.findMany({
          where: { organizationId, childOrgControlId: input.orgControlId },
          orderBy: { createdAt: "asc" },
          include: {
            Parent: {
              select: {
                id: true,
                localControlId: true,
                name: true,
                status: true,
              },
            },
          },
        }),
      ]);

      return { outgoing, incoming };
    }),

  create: organizationProcedure
    .input(
      z.object({
        parentOrgControlId: z.string(),
        childOrgControlId: z.string().optional().nullable(),
        externalDependency: z.string().max(200).optional().nullable(),
        externalType: z.string().max(100).optional().nullable(),
        notes: z.string().max(5000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "add");
      validateXor(input);

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const parent = await ctx.db.organizationalControl.findFirst({
        where: { id: input.parentOrgControlId, organizationId },
        select: { id: true },
      });
      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Parent control not found" });
      }

      if (input.childOrgControlId) {
        if (input.childOrgControlId === parent.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A control cannot depend on itself",
          });
        }
        const child = await ctx.db.organizationalControl.findFirst({
          where: { id: input.childOrgControlId, organizationId },
          select: { id: true },
        });
        if (!child) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Child control not found" });
        }

        const duplicate = await ctx.db.orgControlDependency.findFirst({
          where: {
            organizationId,
            parentOrgControlId: parent.id,
            childOrgControlId: child.id,
          },
        });
        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This dependency already exists",
          });
        }
      }

      const created = await ctx.db.orgControlDependency.create({
        data: {
          id: randomUUID(),
          organizationId,
          parentOrgControlId: parent.id,
          childOrgControlId: input.childOrgControlId ?? null,
          externalDependency: input.externalDependency ?? null,
          externalType: input.externalType ?? null,
          notes: input.notes ?? null,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: parent.id,
          changes: {
            action: "DEPENDENCY_ADDED",
            dependencyId: created.id,
            kind: created.childOrgControlId ? "internal" : "external",
            target: created.childOrgControlId ?? created.externalDependency,
            externalType: created.externalType,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return created;
    }),

  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          notes: z.string().max(5000).optional().nullable(),
          externalDependency: z.string().max(200).optional().nullable(),
          externalType: z.string().max(100).optional().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.orgControlDependency.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dependency not found" });
      }

      // Only allow editing external-field values on external dependencies; block on internal
      if (
        existing.childOrgControlId &&
        (input.data.externalDependency !== undefined ||
          input.data.externalType !== undefined)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This is an internal dependency — external fields can't be set. Delete and recreate to change kind.",
        });
      }

      const updated = await ctx.db.orgControlDependency.update({
        where: { id: input.id },
        data: {
          ...(input.data.notes !== undefined && { notes: input.data.notes }),
          ...(input.data.externalDependency !== undefined && {
            externalDependency: input.data.externalDependency,
          }),
          ...(input.data.externalType !== undefined && {
            externalType: input.data.externalType,
          }),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.parentOrgControlId,
          changes: {
            action: "DEPENDENCY_UPDATED",
            dependencyId: updated.id,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "delete");

      const existing = await ctx.db.orgControlDependency.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dependency not found" });
      }

      await ctx.db.orgControlDependency.delete({ where: { id: input.id } });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.parentOrgControlId,
          changes: {
            action: "DEPENDENCY_REMOVED",
            dependencyId: existing.id,
            kind: existing.childOrgControlId ? "internal" : "external",
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),
});
