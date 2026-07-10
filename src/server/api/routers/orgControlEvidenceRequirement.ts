/**
 * Organizational Control Evidence Requirement tRPC Router
 *
 * A requirement is a *specification* of evidence expected to prove control operation.
 * Separate from the actual Evidence artifacts linked to the control (those live in
 * `orgControlEvidence`). One requirement can be fulfilled by many Evidence rows.
 *
 * Sub-Epic D.1 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction, EvidenceArtifactType } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { WRITE_ROLES } from "@/lib/auth/roles";

const ALLOWED_MUTATION_ROLES: readonly string[] = WRITE_ROLES;

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} evidence requirements`,
    });
  }
}

export const orgControlEvidenceRequirementRouter = createTRPCRouter({
  /**
   * List requirements for a control with fulfillment counts.
   */
  list: organizationProcedure
    .input(z.object({ orgControlId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlEvidenceRequirement.findMany({
        where: {
          organizationId: ctx.organizationId!,
          orgControlId: input.orgControlId,
        },
        orderBy: { createdAt: "asc" },
        include: {
          Owner: { select: { id: true, name: true, email: true, jobTitle: true } },
          _count: { select: { Evidence: true } },
        },
      });
    }),

  create: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string(),
        description: z.string().min(1).max(5000),
        artifactType: z.nativeEnum(EvidenceArtifactType),
        required: z.boolean().default(true),
        ownerId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "create");

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const control = await ctx.db.organizationalControl.findFirst({
        where: { id: input.orgControlId, organizationId },
        select: { id: true },
      });
      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      const created = await ctx.db.orgControlEvidenceRequirement.create({
        data: {
          id: randomUUID(),
          organizationId,
          orgControlId: control.id,
          description: input.description,
          artifactType: input.artifactType,
          required: input.required,
          ownerId: input.ownerId ?? null,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: control.id,
          changes: {
            action: "EVIDENCE_REQUIREMENT_CREATED",
            requirementId: created.id,
            artifactType: created.artifactType,
            required: created.required,
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
          description: z.string().min(1).max(5000).optional(),
          artifactType: z.nativeEnum(EvidenceArtifactType).optional(),
          required: z.boolean().optional(),
          ownerId: z.string().optional().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.orgControlEvidenceRequirement.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Requirement not found" });
      }

      const updated = await ctx.db.orgControlEvidenceRequirement.update({
        where: { id: input.id },
        data: {
          ...(input.data.description !== undefined && { description: input.data.description }),
          ...(input.data.artifactType !== undefined && { artifactType: input.data.artifactType }),
          ...(input.data.required !== undefined && { required: input.data.required }),
          ...(input.data.ownerId !== undefined && { ownerId: input.data.ownerId }),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.orgControlId,
          changes: {
            action: "EVIDENCE_REQUIREMENT_UPDATED",
            requirementId: updated.id,
            before: {
              description: existing.description,
              artifactType: existing.artifactType,
              required: existing.required,
            },
            after: {
              description: updated.description,
              artifactType: updated.artifactType,
              required: updated.required,
            },
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

      const existing = await ctx.db.orgControlEvidenceRequirement.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: { _count: { select: { Evidence: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Requirement not found" });
      }

      // Junction rows FK with onDelete: SetNull, so linked Evidence rows survive
      await ctx.db.orgControlEvidenceRequirement.delete({ where: { id: input.id } });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.orgControlId,
          changes: {
            action: "EVIDENCE_REQUIREMENT_DELETED",
            requirementId: existing.id,
            artifactType: existing.artifactType,
            fulfilledCount: existing._count.Evidence,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),
});
