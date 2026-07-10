/**
 * Organizational Control Exception tRPC Router
 *
 * Time-bound approved-to-deviate entries for a control. Lifecycle:
 *   PENDING → APPROVED | DENIED → EXPIRED (when expiresAt passes)
 *
 * Role split:
 *   - Requesters: ORG_ADMIN | GRC_ANALYST | SECURITY_ENGINEER
 *   - Approvers:  ORG_ADMIN only
 *
 * Sub-Epic E.1 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction, ControlExceptionStatus } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { WRITE_ROLES, APPROVE_ROLES } from "@/lib/auth/roles";

const REQUESTER_ROLES: readonly string[] = WRITE_ROLES;
const APPROVER_ROLES: readonly string[] = APPROVE_ROLES;

function assertRequester(role: string | undefined): void {
  if (!role || !REQUESTER_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to request exceptions",
    });
  }
}

function assertApprover(role: string | undefined): void {
  if (!role || !APPROVER_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization admins can approve or deny exceptions",
    });
  }
}

export const orgControlExceptionRouter = createTRPCRouter({
  /**
   * List exceptions for a control with optional status filter.
   * Also opportunistically flips PENDING/APPROVED rows to EXPIRED if the
   * expiresAt date has passed (read-time expiry; see note in E.1 tech spec
   * about a future scheduled job).
   */
  list: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string().optional(),
        status: z.nativeEnum(ControlExceptionStatus).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Opportunistic expire sweep (bounded to this org + APPROVED rows past expiry)
      await ctx.db.orgControlException.updateMany({
        where: {
          organizationId,
          status: ControlExceptionStatus.APPROVED,
          expiresAt: { lt: new Date() },
        },
        data: { status: ControlExceptionStatus.EXPIRED },
      });

      return ctx.db.orgControlException.findMany({
        where: {
          organizationId,
          ...(input.orgControlId && { orgControlId: input.orgControlId }),
          ...(input.status && { status: input.status }),
        },
        orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
        include: {
          RequestedBy: { select: { id: true, name: true, email: true } },
          ApprovedBy: { select: { id: true, name: true, email: true } },
          CompensatingOrgControl: {
            select: { id: true, localControlId: true, name: true },
          },
        },
      });
    }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const exception = await ctx.db.orgControlException.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          RequestedBy: { select: { id: true, name: true, email: true } },
          ApprovedBy: { select: { id: true, name: true, email: true } },
          CompensatingOrgControl: {
            select: { id: true, localControlId: true, name: true },
          },
          OrgControl: { select: { id: true, localControlId: true, name: true } },
        },
      });

      if (!exception) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exception not found" });
      }
      return exception;
    }),

  /**
   * Request a new exception (starts PENDING).
   */
  request: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string(),
        justification: z.string().min(1).max(10000),
        compensatingControls: z.string().max(5000).optional().nullable(),
        compensatingOrgControlId: z.string().optional().nullable(),
        expiresAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertRequester(ctx.session?.user.role);

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      if (input.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Expiration must be in the future",
        });
      }

      const control = await ctx.db.organizationalControl.findFirst({
        where: { id: input.orgControlId, organizationId },
        select: { id: true },
      });
      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      if (input.compensatingOrgControlId) {
        const compensating = await ctx.db.organizationalControl.findFirst({
          where: { id: input.compensatingOrgControlId, organizationId },
          select: { id: true },
        });
        if (!compensating) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Compensating control not found",
          });
        }
      }

      const created = await ctx.db.orgControlException.create({
        data: {
          id: randomUUID(),
          organizationId,
          orgControlId: control.id,
          status: ControlExceptionStatus.PENDING,
          justification: input.justification,
          compensatingControls: input.compensatingControls ?? null,
          compensatingOrgControlId: input.compensatingOrgControlId ?? null,
          requestedById: userId,
          expiresAt: input.expiresAt,
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
            action: "EXCEPTION_REQUESTED",
            exceptionId: created.id,
            expiresAt: created.expiresAt,
            hasCompensatingControl: !!created.compensatingOrgControlId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return created;
    }),

  approve: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertApprover(ctx.session?.user.role);

      const existing = await ctx.db.orgControlException.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exception not found" });
      }
      if (existing.status !== ControlExceptionStatus.PENDING) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot approve: exception is already ${existing.status}`,
        });
      }

      const updated = await ctx.db.orgControlException.update({
        where: { id: input.id },
        data: {
          status: ControlExceptionStatus.APPROVED,
          approvedById: ctx.session!.user.id,
          approvedAt: new Date(),
          approvalNotes: input.notes ?? null,
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
            action: "EXCEPTION_APPROVED",
            exceptionId: updated.id,
            approvalNotes: updated.approvalNotes,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  deny: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertApprover(ctx.session?.user.role);

      const existing = await ctx.db.orgControlException.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exception not found" });
      }
      if (existing.status !== ControlExceptionStatus.PENDING) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot deny: exception is already ${existing.status}`,
        });
      }

      const updated = await ctx.db.orgControlException.update({
        where: { id: input.id },
        data: {
          status: ControlExceptionStatus.DENIED,
          approvedById: ctx.session!.user.id,
          approvedAt: new Date(),
          approvalNotes: input.notes ?? null,
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
            action: "EXCEPTION_DENIED",
            exceptionId: updated.id,
            approvalNotes: updated.approvalNotes,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  /**
   * Renew an approved exception — extends expiry and increments renewalCount.
   */
  renew: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        newExpiresAt: z.date(),
        notes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertApprover(ctx.session?.user.role);

      const existing = await ctx.db.orgControlException.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exception not found" });
      }
      if (
        existing.status !== ControlExceptionStatus.APPROVED &&
        existing.status !== ControlExceptionStatus.EXPIRED
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only approved or expired exceptions can be renewed",
        });
      }
      if (input.newExpiresAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New expiration must be in the future",
        });
      }

      const updated = await ctx.db.orgControlException.update({
        where: { id: input.id },
        data: {
          status: ControlExceptionStatus.APPROVED,
          expiresAt: input.newExpiresAt,
          renewalCount: { increment: 1 },
          approvedById: ctx.session!.user.id,
          approvedAt: new Date(),
          approvalNotes: input.notes ?? existing.approvalNotes,
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
            action: "EXCEPTION_RENEWED",
            exceptionId: updated.id,
            previousExpiresAt: existing.expiresAt,
            newExpiresAt: updated.expiresAt,
            renewalCount: updated.renewalCount,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),
});
