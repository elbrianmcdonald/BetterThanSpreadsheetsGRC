/**
 * Organizational Control Deficiency tRPC Router
 *
 * Tracks gaps discovered during control testing and their remediation lifecycle.
 * Every deficiency must originate from a specific test record.
 *
 * Sub-Epic C.2 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction, DeficiencySeverity, RemediationStatus } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { WRITE_ROLES } from "@/lib/auth/roles";

const ALLOWED_MUTATION_ROLES: readonly string[] = WRITE_ROLES;

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} deficiencies`,
    });
  }
}

export const orgControlDeficiencyRouter = createTRPCRouter({
  /**
   * List deficiencies for a control.
   */
  list: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string().optional(),
        remediationStatus: z.nativeEnum(RemediationStatus).optional(),
        includeResolved: z.boolean().default(true),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlDeficiency.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.orgControlId && { orgControlId: input.orgControlId }),
          ...(input.remediationStatus && { remediationStatus: input.remediationStatus }),
          ...(!input.includeResolved && {
            remediationStatus: { not: RemediationStatus.COMPLETED },
          }),
        },
        orderBy: [{ remediationStatus: "asc" }, { createdAt: "desc" }],
        take: input.limit,
        include: {
          RemediationOwner: { select: { id: true, name: true, email: true } },
          TestRecord: {
            select: { id: true, testedAt: true, result: true },
          },
        },
      });
    }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const deficiency = await ctx.db.orgControlDeficiency.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          RemediationOwner: { select: { id: true, name: true, email: true } },
          TestRecord: {
            select: {
              id: true,
              testedAt: true,
              result: true,
              TestedBy: { select: { id: true, name: true, email: true } },
            },
          },
          OrgControl: { select: { id: true, localControlId: true, name: true } },
        },
      });

      if (!deficiency) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deficiency not found" });
      }
      return deficiency;
    }),

  /**
   * Create a new deficiency tied to a specific test record.
   */
  create: organizationProcedure
    .input(
      z.object({
        testRecordId: z.string(),
        description: z.string().min(1).max(5000),
        severity: z.nativeEnum(DeficiencySeverity),
        remediationOwnerId: z.string().optional().nullable(),
        remediationDueDate: z.date().optional().nullable(),
        remediationNotes: z.string().max(5000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "record");

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const testRecord = await ctx.db.orgControlTestRecord.findFirst({
        where: { id: input.testRecordId, organizationId },
        select: { id: true, orgControlId: true },
      });

      if (!testRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test record not found" });
      }

      const created = await ctx.db.orgControlDeficiency.create({
        data: {
          id: randomUUID(),
          organizationId,
          testRecordId: testRecord.id,
          orgControlId: testRecord.orgControlId,
          description: input.description,
          severity: input.severity,
          remediationStatus: RemediationStatus.OPEN,
          remediationOwnerId: input.remediationOwnerId ?? null,
          remediationDueDate: input.remediationDueDate ?? null,
          remediationNotes: input.remediationNotes ?? null,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: testRecord.orgControlId,
          changes: {
            action: "DEFICIENCY_CREATED",
            deficiencyId: created.id,
            testRecordId: testRecord.id,
            severity: created.severity,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return created;
    }),

  /**
   * Update fields on an open deficiency. Auto-sets resolvedAt when transitioning to COMPLETED.
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          description: z.string().min(1).max(5000).optional(),
          severity: z.nativeEnum(DeficiencySeverity).optional(),
          remediationStatus: z.nativeEnum(RemediationStatus).optional(),
          remediationOwnerId: z.string().optional().nullable(),
          remediationDueDate: z.date().optional().nullable(),
          remediationNotes: z.string().max(5000).optional().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.orgControlDeficiency.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deficiency not found" });
      }

      const data = input.data;
      const transitioningToResolved =
        data.remediationStatus === RemediationStatus.COMPLETED &&
        existing.remediationStatus !== RemediationStatus.COMPLETED;
      const transitioningAwayFromResolved =
        data.remediationStatus !== undefined &&
        data.remediationStatus !== RemediationStatus.COMPLETED &&
        existing.remediationStatus === RemediationStatus.COMPLETED;

      const updated = await ctx.db.orgControlDeficiency.update({
        where: { id: input.id },
        data: {
          ...(data.description !== undefined && { description: data.description }),
          ...(data.severity !== undefined && { severity: data.severity }),
          ...(data.remediationStatus !== undefined && {
            remediationStatus: data.remediationStatus,
          }),
          ...(data.remediationOwnerId !== undefined && {
            remediationOwnerId: data.remediationOwnerId,
          }),
          ...(data.remediationDueDate !== undefined && {
            remediationDueDate: data.remediationDueDate,
          }),
          ...(data.remediationNotes !== undefined && {
            remediationNotes: data.remediationNotes,
          }),
          ...(transitioningToResolved && { resolvedAt: new Date() }),
          ...(transitioningAwayFromResolved && { resolvedAt: null }),
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
            action: "DEFICIENCY_UPDATED",
            deficiencyId: updated.id,
            before: {
              remediationStatus: existing.remediationStatus,
              severity: existing.severity,
              remediationOwnerId: existing.remediationOwnerId,
            },
            after: {
              remediationStatus: updated.remediationStatus,
              severity: updated.severity,
              remediationOwnerId: updated.remediationOwnerId,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  /**
   * Convenience mutation: mark a deficiency as resolved.
   */
  resolve: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "resolve");

      const existing = await ctx.db.orgControlDeficiency.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deficiency not found" });
      }

      if (existing.remediationStatus === RemediationStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deficiency is already resolved",
        });
      }

      const updated = await ctx.db.orgControlDeficiency.update({
        where: { id: input.id },
        data: {
          remediationStatus: RemediationStatus.COMPLETED,
          resolvedAt: new Date(),
          ...(input.notes && { remediationNotes: input.notes }),
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
            action: "DEFICIENCY_RESOLVED",
            deficiencyId: updated.id,
            resolvedAt: updated.resolvedAt,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),
});
