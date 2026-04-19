/**
 * Organizational Control Evidence tRPC Router
 *
 * Junction between `OrganizationalControl` and existing `Evidence` artifacts.
 * Purely a linking surface — does NOT upload files (the `evidence` router owns
 * file operations). One Evidence row can be linked to many controls.
 *
 * Sub-Epic D.2 (tech-spec: docs/sprint-artifacts/tech-spec-org-controls-redesign.md)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { AuditAction } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";

const ALLOWED_MUTATION_ROLES = ["ORG_ADMIN", "GRC_ANALYST", "SECURITY_ENGINEER"];

function assertMutationAllowed(role: string | undefined, action: string): void {
  if (!role || !ALLOWED_MUTATION_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${action} control evidence`,
    });
  }
}

export const orgControlEvidenceRouter = createTRPCRouter({
  /**
   * List evidence linked to a control.
   */
  list: organizationProcedure
    .input(z.object({ orgControlId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.orgControlEvidence.findMany({
        where: {
          organizationId: ctx.organizationId!,
          orgControlId: input.orgControlId,
        },
        orderBy: { createdAt: "desc" },
        include: {
          Evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileSize: true,
              fileType: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              uploadedBy: true,
            },
          },
          EvidenceRequirement: {
            select: { id: true, description: true, artifactType: true },
          },
          TestRecord: {
            select: { id: true, testedAt: true, result: true },
          },
          CreatedBy: { select: { id: true, name: true, email: true } },
        },
      });
    }),

  /**
   * Link an existing Evidence record to this control.
   * Rejects duplicates — same Evidence can only be linked to the same control once.
   */
  link: organizationProcedure
    .input(
      z.object({
        orgControlId: z.string(),
        evidenceId: z.string(),
        evidenceRequirementId: z.string().optional().nullable(),
        testRecordId: z.string().optional().nullable(),
        periodCovered: z.string().max(120).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "link");

      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify control + evidence belong to this org
      const [control, evidence] = await Promise.all([
        ctx.db.organizationalControl.findFirst({
          where: { id: input.orgControlId, organizationId },
          select: { id: true },
        }),
        ctx.db.evidence.findFirst({
          where: { id: input.evidenceId, organizationId },
          select: { id: true, title: true },
        }),
      ]);

      if (!control) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Control not found" });
      }
      if (!evidence) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evidence not found" });
      }

      const existing = await ctx.db.orgControlEvidence.findFirst({
        where: { orgControlId: control.id, evidenceId: evidence.id },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This evidence is already linked to the control",
        });
      }

      const created = await ctx.db.orgControlEvidence.create({
        data: {
          id: randomUUID(),
          organizationId,
          orgControlId: control.id,
          evidenceId: evidence.id,
          evidenceRequirementId: input.evidenceRequirementId ?? null,
          testRecordId: input.testRecordId ?? null,
          periodCovered: input.periodCovered ?? null,
          createdById: userId,
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
            action: "EVIDENCE_LINKED",
            linkId: created.id,
            evidenceId: evidence.id,
            evidenceTitle: evidence.title,
            requirementId: created.evidenceRequirementId,
            testRecordId: created.testRecordId,
            periodCovered: created.periodCovered,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return created;
    }),

  /**
   * Update linkage metadata (requirement, test record, period).
   * Does NOT change which Evidence is linked — use unlink + link for that.
   */
  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          evidenceRequirementId: z.string().optional().nullable(),
          testRecordId: z.string().optional().nullable(),
          periodCovered: z.string().max(120).optional().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "update");

      const existing = await ctx.db.orgControlEvidence.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evidence link not found" });
      }

      const updated = await ctx.db.orgControlEvidence.update({
        where: { id: input.id },
        data: {
          ...(input.data.evidenceRequirementId !== undefined && {
            evidenceRequirementId: input.data.evidenceRequirementId,
          }),
          ...(input.data.testRecordId !== undefined && {
            testRecordId: input.data.testRecordId,
          }),
          ...(input.data.periodCovered !== undefined && {
            periodCovered: input.data.periodCovered,
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
          entityId: existing.orgControlId,
          changes: {
            action: "EVIDENCE_LINK_UPDATED",
            linkId: updated.id,
            before: {
              requirementId: existing.evidenceRequirementId,
              testRecordId: existing.testRecordId,
              periodCovered: existing.periodCovered,
            },
            after: {
              requirementId: updated.evidenceRequirementId,
              testRecordId: updated.testRecordId,
              periodCovered: updated.periodCovered,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updated;
    }),

  unlink: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertMutationAllowed(ctx.session?.user.role, "unlink");

      const existing = await ctx.db.orgControlEvidence.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId! },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evidence link not found" });
      }

      await ctx.db.orgControlEvidence.delete({ where: { id: input.id } });

      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.UPDATE_CONTROL,
          entityType: "OrganizationalControl",
          entityId: existing.orgControlId,
          changes: {
            action: "EVIDENCE_UNLINKED",
            linkId: existing.id,
            evidenceId: existing.evidenceId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),
});
