/**
 * Organizational Control Test Record tRPC Router
 *
 * Tracks control testing runs: who tested, when, the result, and narrative findings.
 * On create, updates the parent OrganizationalControl's lastTestedDate, lastTestResult,
 * and nextTestDueDate so list views can surface overdue controls without a join.
 *
 * Sub-Epic C.1 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction, TestResult } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { WRITE_ROLES } from "@/lib/auth/roles";

const ALLOWED_MUTATION_ROLES: readonly string[] = WRITE_ROLES;

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} test records`,
    });
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export const orgControlTestRecordRouter = createTRPCRouter({
  /**
   * List test records for a control, newest first.
   */
  list: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string(),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlTestRecord.findMany({
        where: {
          organizationId: ctx.organizationId!,
          orgControlId: input.orgControlId,
        },
        orderBy: { testedAt: "desc" },
        take: input.limit,
        include: {
          TestedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { Deficiencies: true, EvidenceLinks: true } },
        },
      });
    }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const record = await ctx.db.orgControlTestRecord.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: {
          TestedBy: { select: { id: true, name: true, email: true } },
          OrgControl: { select: { id: true, localControlId: true, name: true } },
          Deficiencies: {
            orderBy: { createdAt: "desc" },
            include: {
              RemediationOwner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test record not found" });
      }
      return record;
    }),

  /**
   * Record a new test run. Updates the parent control's convenience columns.
   */
  create: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string(),
        testedById: z.string().optional(), // defaults to current user
        testedAt: z.date().optional(), // defaults to now
        result: z.nativeEnum(TestResult),
        findings: z.string().max(10000).optional().nullable(),
        nextDueDate: z.date().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "record tests for");

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const control = await ctx.db.organizationalControl.findFirst({
        where: { id: input.orgControlId, organizationId },
        select: { id: true, reviewCycleMonths: true, name: true },
      });

      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }

      const testedAt = input.testedAt ?? new Date();
      // Derive next due date from reviewCycleMonths when caller doesn't set one explicitly
      const nextDueDate =
        input.nextDueDate !== undefined
          ? input.nextDueDate
          : control.reviewCycleMonths
            ? addMonths(testedAt, control.reviewCycleMonths)
            : null;

      const created = await ctx.db.$transaction(async (tx) => {
        const record = await tx.orgControlTestRecord.create({
          data: {
            id: randomUUID(),
            organizationId,
            orgControlId: control.id,
            testedById: input.testedById ?? userId,
            testedAt,
            result: input.result,
            findings: input.findings ?? null,
            nextDueDate,
          },
        });

        // Update parent convenience columns so list views stay in sync
        await tx.organizationalControl.update({
          where: { id: control.id },
          data: {
            lastTestedDate: testedAt,
            lastTestResult: input.result,
            nextTestDueDate: nextDueDate,
          },
        });

        return record;
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
            action: "TEST_RECORDED",
            testRecordId: created.id,
            result: created.result,
            testedAt: created.testedAt,
            nextDueDate: created.nextDueDate,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return created;
    }),

  /**
   * Update findings/result/nextDueDate on an existing test record.
   * If this record is the most recent for the control, also updates parent columns.
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          result: z.nativeEnum(TestResult).optional(),
          findings: z.string().max(10000).optional().nullable(),
          nextDueDate: z.date().optional().nullable(),
          testedAt: z.date().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.orgControlTestRecord.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test record not found" });
      }

      const updated = await ctx.db.$transaction(async (tx) => {
        const result = await tx.orgControlTestRecord.update({
          where: { id: input.id },
          data: {
            ...(input.data.result !== undefined && { result: input.data.result }),
            ...(input.data.findings !== undefined && { findings: input.data.findings }),
            ...(input.data.nextDueDate !== undefined && { nextDueDate: input.data.nextDueDate }),
            ...(input.data.testedAt !== undefined && { testedAt: input.data.testedAt }),
          },
        });

        // If this is the latest record, refresh parent convenience columns
        const latest = await tx.orgControlTestRecord.findFirst({
          where: { orgControlId: existing.orgControlId },
          orderBy: { testedAt: "desc" },
        });
        if (latest && latest.id === result.id) {
          await tx.organizationalControl.update({
            where: { id: existing.orgControlId },
            data: {
              lastTestedDate: result.testedAt,
              lastTestResult: result.result,
              nextTestDueDate: result.nextDueDate,
            },
          });
        }

        return result;
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
            action: "TEST_RECORD_UPDATED",
            testRecordId: updated.id,
            before: {
              result: existing.result,
              findings: existing.findings,
              testedAt: existing.testedAt,
            },
            after: {
              result: updated.result,
              findings: updated.findings,
              testedAt: updated.testedAt,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  /**
   * Delete a test record (admin-level correction). Refreshes parent convenience
   * columns from the now-latest record.
   */
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "delete");

      const existing = await ctx.db.orgControlTestRecord.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
        include: { _count: { select: { Deficiencies: true } } },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Test record not found" });
      }

      if (existing._count.Deficiencies > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot delete: ${existing._count.Deficiencies} deficiency(ies) linked to this test. Resolve or delete deficiencies first.`,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.orgControlTestRecord.delete({ where: { id: input.id } });

        const latest = await tx.orgControlTestRecord.findFirst({
          where: { orgControlId: existing.orgControlId },
          orderBy: { testedAt: "desc" },
        });

        await tx.organizationalControl.update({
          where: { id: existing.orgControlId },
          data: {
            lastTestedDate: latest?.testedAt ?? null,
            lastTestResult: latest?.result ?? null,
            nextTestDueDate: latest?.nextDueDate ?? null,
          },
        });
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
            action: "TEST_RECORD_DELETED",
            testRecordId: existing.id,
            before: { result: existing.result, testedAt: existing.testedAt },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),
});
