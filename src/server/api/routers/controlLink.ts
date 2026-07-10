/**
 * Control Link Router
 *
 * Story 12.1: Control Linkage Data Models & tRPC Router
 *
 * Provides mutations and queries for linking risks and findings to framework controls.
 *
 * Risk-Control Links (AC17-AC24):
 * - linkRiskToControl, unlinkRiskFromControl, getRiskControls, getControlRisks
 *
 * Finding-Control Links (AC25-AC32):
 * - linkFindingToControl, unlinkFindingFromControl, getFindingControls, getControlFindings
 *
 * Control Health Queries (AC33-AC38):
 * - getControlRiskSummary, getControlFindingSummary, getControlHealth, getFrameworkControlHealth
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  RiskControlLinkType,
  FindingControlLinkType,
  AuditAction,
} from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { createAuditLog } from "@/server/services/audit-log.service";
import { WRITE_ROLES } from "@/lib/auth/roles";

/**
 * Roles that can create/update control links (AC23, AC31)
 */
const CONTROL_LINK_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Calculate control health based on linked risks and findings
 * Returns: 'CRITICAL' | 'AT_RISK' | 'HEALTHY'
 */
function calculateControlHealth(
  riskLinks: { linkType: RiskControlLinkType }[],
  findingLinks: { linkType: FindingControlLinkType }[]
): "CRITICAL" | "AT_RISK" | "HEALTHY" {
  // Critical if any GAP risk or VIOLATION finding
  const hasCritical =
    riskLinks.some((l) => l.linkType === "GAP") ||
    findingLinks.some((l) => l.linkType === "VIOLATION");

  if (hasCritical) return "CRITICAL";

  // At Risk if any AFFECTED risk or WEAKNESS finding
  const hasAtRisk =
    riskLinks.some((l) => l.linkType === "AFFECTED") ||
    findingLinks.some((l) => l.linkType === "WEAKNESS");

  if (hasAtRisk) return "AT_RISK";

  return "HEALTHY";
}

/**
 * Get summary statistics for Story 12.2 (AC9-AC14)
 */
interface FrameworkHealthSummary {
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  isActive: boolean;
  totalControls: number;
  atRiskControls: number;
  criticalControls: number;
  healthyControls: number;
  health: "HEALTHY" | "AT_RISK" | "CRITICAL";
}

export const controlLinkRouter = createTRPCRouter({
  // ============================================================================
  // Risk-Control Link Mutations (AC17-AC24)
  // ============================================================================

  /**
   * Link a risk to a control (AC18)
   */
  linkRiskToControl: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
        linkType: z.nativeEnum(RiskControlLinkType),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, controlId, linkType, notes } = input;

      // Verify risk exists and belongs to org (AC39)
      const risk = await ctx.db.risk.findFirst({
        where: { id: riskId, organizationId: ctx.organizationId! },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found or access denied",
        });
      }

      // Verify control exists and is active (AC40)
      const control = await ctx.db.control.findFirst({
        where: { id: controlId, organizationId: ctx.organizationId! },
        include: { Framework: true },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found or access denied",
        });
      }

      if (!control.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot link to inactive/deprecated control",
        });
      }

      // Check for duplicate (AC41)
      const existing = await ctx.db.riskControlLink.findUnique({
        where: { riskId_controlId: { riskId, controlId } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Risk is already linked to this control",
        });
      }

      // Create the link
      const link = await ctx.db.riskControlLink.create({
        data: {
          organizationId: ctx.organizationId!,
          riskId,
          controlId,
          linkType,
          notes,
          createdById: ctx.session!.user.id,
        },
        include: {
          control: { include: { Framework: true } },
          risk: true,
        },
      });

      // Audit log (AC24)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.LINK_RISK_TO_CONTROL,
        entityType: "RiskControlLink",
        entityId: link.id,
        changes: {
          after: {
            riskId,
            riskTitle: risk.title,
            controlId,
            controlTitle: control.controlId,
            linkType,
            notes,
          },
        },
      });

      return link;
    }),

  /**
   * Unlink a risk from a control (AC19)
   */
  unlinkRiskFromControl: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, controlId } = input;

      const link = await ctx.db.riskControlLink.findUnique({
        where: { riskId_controlId: { riskId, controlId } },
        include: {
          risk: true,
          control: true,
        },
      });

      if (!link || link.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found or access denied",
        });
      }

      await ctx.db.riskControlLink.delete({
        where: { riskId_controlId: { riskId, controlId } },
      });

      // Audit log (AC24)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UNLINK_RISK_FROM_CONTROL,
        entityType: "RiskControlLink",
        entityId: link.id,
        changes: {
          before: {
            riskId,
            riskTitle: link.risk.title,
            controlId,
            controlTitle: link.control.controlId,
            linkType: link.linkType,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Bulk link a risk to multiple controls
   */
  bulkLinkRiskToControls: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        controlIds: z.array(z.string()).min(1).max(50),
        linkType: z.nativeEnum(RiskControlLinkType),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, controlIds, linkType, notes } = input;

      // Verify risk exists and belongs to org
      const risk = await ctx.db.risk.findFirst({
        where: { id: riskId, organizationId: ctx.organizationId! },
      });

      if (!risk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found or access denied",
        });
      }

      // Verify framework controls exist and are active. Any IDs that don't
      // match are treated as organizational-control IDs and routed to the
      // RiskOrganizationalControl table instead — picker UIs that mix the
      // two control sources won't blow up with a hard validation error.
      const frameworkControls = await ctx.db.control.findMany({
        where: {
          id: { in: controlIds },
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        select: { id: true },
      });
      const frameworkControlIds = new Set(frameworkControls.map((c) => c.id));
      const nonFrameworkIds = controlIds.filter((id) => !frameworkControlIds.has(id));

      // Best-effort: link any non-framework IDs that match an organizational
      // control to the risk. We don't error if nothing matches; we just skip.
      let orgLinkCount = 0;
      if (nonFrameworkIds.length > 0) {
        const orgControls = await ctx.db.organizationalControl.findMany({
          where: {
            id: { in: nonFrameworkIds },
            organizationId: ctx.organizationId!,
          },
          select: { id: true },
        });
        if (orgControls.length > 0) {
          const orgRole =
            linkType === "MITIGATING" ? "IN_PLACE" : "NEEDED";
          const existing = await ctx.db.riskOrganizationalControl.findMany({
            where: {
              riskId,
              organizationalControlId: { in: orgControls.map((c) => c.id) },
            },
            select: { organizationalControlId: true },
          });
          const existingSet = new Set(
            existing.map((e) => e.organizationalControlId)
          );
          const toCreate = orgControls
            .map((c) => c.id)
            .filter((id) => !existingSet.has(id));
          if (toCreate.length > 0) {
            await ctx.db.riskOrganizationalControl.createMany({
              data: toCreate.map((organizationalControlId) => ({
                organizationId: ctx.organizationId!,
                riskId,
                organizationalControlId,
                role: orgRole,
                createdById: ctx.session!.user.id,
              })),
              skipDuplicates: true,
            });
            orgLinkCount = toCreate.length;
          }
        }
      }

      // Continue with framework links (the original code path)
      const existingLinks = await ctx.db.riskControlLink.findMany({
        where: {
          riskId,
          controlId: { in: Array.from(frameworkControlIds) },
        },
        select: { controlId: true },
      });

      const existingControlIds = new Set(existingLinks.map((l) => l.controlId));
      const newControlIds = Array.from(frameworkControlIds).filter(
        (id) => !existingControlIds.has(id)
      );

      if (newControlIds.length === 0) {
        return {
          created: orgLinkCount,
          skipped: controlIds.length - orgLinkCount,
        };
      }

      // Create links in a transaction
      const links = await ctx.db.$transaction(
        newControlIds.map((controlId) =>
          ctx.db.riskControlLink.create({
            data: {
              organizationId: ctx.organizationId!,
              riskId,
              controlId,
              linkType,
              notes,
              createdById: ctx.session!.user.id,
            },
          })
        )
      );

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.LINK_RISK_TO_CONTROL,
        entityType: "RiskControlLink",
        entityId: riskId,
        changes: {
          after: {
            riskId,
            riskTitle: risk.title,
            controlIds: newControlIds,
            linkType,
            notes,
            count: links.length,
          },
        },
      });

      return {
        created: links.length + orgLinkCount,
        skipped: existingControlIds.size,
      };
    }),

  /**
   * Update a risk-control link (AC22)
   */
  updateRiskControlLink: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        riskId: z.string(),
        controlId: z.string(),
        linkType: z.nativeEnum(RiskControlLinkType),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { riskId, controlId, linkType, notes } = input;

      const existing = await ctx.db.riskControlLink.findUnique({
        where: { riskId_controlId: { riskId, controlId } },
      });

      if (!existing || existing.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found or access denied",
        });
      }

      const updated = await ctx.db.riskControlLink.update({
        where: { riskId_controlId: { riskId, controlId } },
        data: {
          linkType,
          notes,
        },
        include: {
          control: { include: { Framework: true } },
          risk: true,
        },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_RISK_CONTROL_LINK,
        entityType: "RiskControlLink",
        entityId: updated.id,
        changes: {
          before: { linkType: existing.linkType, notes: existing.notes },
          after: { linkType, notes },
        },
      });

      return updated;
    }),

  /**
   * Get all controls linked to a risk (AC20)
   */
  getRiskControls: organizationProcedure
    .input(z.object({ riskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.riskControlLink.findMany({
        where: {
          riskId: input.riskId,
          organizationId: ctx.organizationId!,
        },
        include: {
          control: {
            include: {
              Framework: true,
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return links;
    }),

  /**
   * Get all risks linked to a control (AC21)
   */
  getControlRisks: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.riskControlLink.findMany({
        where: {
          controlId: input.controlId,
          organizationId: ctx.organizationId!,
        },
        include: {
          risk: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return links;
    }),

  // ============================================================================
  // Finding-Control Link Mutations (AC25-AC32)
  // ============================================================================

  /**
   * Link a finding to a control (AC26)
   */
  linkFindingToControl: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        controlId: z.string(),
        linkType: z.nativeEnum(FindingControlLinkType),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, controlId, linkType, notes } = input;

      // Verify finding exists and belongs to org (AC39)
      const finding = await ctx.db.finding.findFirst({
        where: { id: findingId, organizationId: ctx.organizationId! },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found or access denied",
        });
      }

      // Verify control exists and is active (AC40)
      const control = await ctx.db.control.findFirst({
        where: { id: controlId, organizationId: ctx.organizationId! },
        include: { Framework: true },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found or access denied",
        });
      }

      if (!control.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot link to inactive/deprecated control",
        });
      }

      // Check for duplicate (AC41)
      const existing = await ctx.db.findingControlLink.findUnique({
        where: { findingId_controlId: { findingId, controlId } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Finding is already linked to this control",
        });
      }

      // Create the link
      const link = await ctx.db.findingControlLink.create({
        data: {
          organizationId: ctx.organizationId!,
          findingId,
          controlId,
          linkType,
          notes,
          createdById: ctx.session!.user.id,
        },
        include: {
          control: { include: { Framework: true } },
          finding: true,
        },
      });

      // Audit log (AC32)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.LINK_FINDING_TO_CONTROL,
        entityType: "FindingControlLink",
        entityId: link.id,
        changes: {
          after: {
            findingId,
            findingIdentifier: finding.identifier,
            controlId,
            controlTitle: control.controlId,
            linkType,
            notes,
          },
        },
      });

      return link;
    }),

  /**
   * Unlink a finding from a control (AC27)
   */
  unlinkFindingFromControl: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        controlId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, controlId } = input;

      const link = await ctx.db.findingControlLink.findUnique({
        where: { findingId_controlId: { findingId, controlId } },
        include: {
          finding: true,
          control: true,
        },
      });

      if (!link || link.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found or access denied",
        });
      }

      await ctx.db.findingControlLink.delete({
        where: { findingId_controlId: { findingId, controlId } },
      });

      // Audit log (AC32)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UNLINK_FINDING_FROM_CONTROL,
        entityType: "FindingControlLink",
        entityId: link.id,
        changes: {
          before: {
            findingId,
            findingIdentifier: link.finding.identifier,
            controlId,
            controlTitle: link.control.controlId,
            linkType: link.linkType,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Bulk link a finding to multiple controls
   */
  bulkLinkFindingToControls: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        controlIds: z.array(z.string()).min(1).max(50),
        linkType: z.nativeEnum(FindingControlLinkType),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, controlIds, linkType, notes } = input;

      // Verify finding exists and belongs to org
      const finding = await ctx.db.finding.findFirst({
        where: { id: findingId, organizationId: ctx.organizationId! },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found or access denied",
        });
      }

      // Verify all controls exist and are active
      const controls = await ctx.db.control.findMany({
        where: {
          id: { in: controlIds },
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        include: { Framework: true },
      });

      if (controls.length !== controlIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some controls not found or are inactive",
        });
      }

      // Get existing links to skip duplicates
      const existingLinks = await ctx.db.findingControlLink.findMany({
        where: {
          findingId,
          controlId: { in: controlIds },
        },
        select: { controlId: true },
      });

      const existingControlIds = new Set(existingLinks.map((l) => l.controlId));
      const newControlIds = controlIds.filter((id) => !existingControlIds.has(id));

      if (newControlIds.length === 0) {
        return { created: 0, skipped: controlIds.length };
      }

      // Create links in a transaction
      const links = await ctx.db.$transaction(
        newControlIds.map((controlId) =>
          ctx.db.findingControlLink.create({
            data: {
              organizationId: ctx.organizationId!,
              findingId,
              controlId,
              linkType,
              notes,
              createdById: ctx.session!.user.id,
            },
          })
        )
      );

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.LINK_FINDING_TO_CONTROL,
        entityType: "FindingControlLink",
        entityId: findingId,
        changes: {
          after: {
            findingId,
            findingIdentifier: finding.identifier,
            controlIds: newControlIds,
            linkType,
            notes,
            count: links.length,
          },
        },
      });

      return {
        created: links.length,
        skipped: existingControlIds.size,
      };
    }),

  /**
   * Update a finding-control link (AC30)
   */
  updateFindingControlLink: organizationProcedure
    .use(requireRole(CONTROL_LINK_ROLES))
    .input(
      z.object({
        findingId: z.string(),
        controlId: z.string(),
        linkType: z.nativeEnum(FindingControlLinkType),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { findingId, controlId, linkType, notes } = input;

      const existing = await ctx.db.findingControlLink.findUnique({
        where: { findingId_controlId: { findingId, controlId } },
      });

      if (!existing || existing.organizationId !== ctx.organizationId!) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Link not found or access denied",
        });
      }

      const updated = await ctx.db.findingControlLink.update({
        where: { findingId_controlId: { findingId, controlId } },
        data: {
          linkType,
          notes,
        },
        include: {
          control: { include: { Framework: true } },
          finding: true,
        },
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.UPDATE_FINDING_CONTROL_LINK,
        entityType: "FindingControlLink",
        entityId: updated.id,
        changes: {
          before: { linkType: existing.linkType, notes: existing.notes },
          after: { linkType, notes },
        },
      });

      return updated;
    }),

  /**
   * Get all controls linked to a finding (AC28)
   */
  getFindingControls: organizationProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.findingControlLink.findMany({
        where: {
          findingId: input.findingId,
          organizationId: ctx.organizationId!,
        },
        include: {
          control: {
            include: {
              Framework: true,
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return links;
    }),

  /**
   * Get all findings linked to a control (AC29)
   */
  getControlFindings: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.findingControlLink.findMany({
        where: {
          controlId: input.controlId,
          organizationId: ctx.organizationId!,
        },
        include: {
          finding: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return links;
    }),

  // ============================================================================
  // Control Health Queries (AC33-AC38)
  // ============================================================================

  /**
   * Get risk summary for a control (AC33)
   */
  getControlRiskSummary: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.riskControlLink.findMany({
        where: {
          controlId: input.controlId,
          organizationId: ctx.organizationId!,
        },
        select: { linkType: true },
      });

      const summary = {
        total: links.length,
        byType: {
          MITIGATING: links.filter((l) => l.linkType === "MITIGATING").length,
          GAP: links.filter((l) => l.linkType === "GAP").length,
          AFFECTED: links.filter((l) => l.linkType === "AFFECTED").length,
        },
      };

      return summary;
    }),

  /**
   * Get finding summary for a control (AC34)
   */
  getControlFindingSummary: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.findingControlLink.findMany({
        where: {
          controlId: input.controlId,
          organizationId: ctx.organizationId!,
        },
        select: { linkType: true },
      });

      const summary = {
        total: links.length,
        byType: {
          VIOLATION: links.filter((l) => l.linkType === "VIOLATION").length,
          WEAKNESS: links.filter((l) => l.linkType === "WEAKNESS").length,
          OBSERVATION: links.filter((l) => l.linkType === "OBSERVATION").length,
        },
      };

      return summary;
    }),

  /**
   * Get health status for a control (AC35)
   */
  getControlHealth: organizationProcedure
    .input(z.object({ controlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [riskLinks, findingLinks, control] = await Promise.all([
        ctx.db.riskControlLink.findMany({
          where: {
            controlId: input.controlId,
            organizationId: ctx.organizationId!,
          },
          select: { linkType: true },
        }),
        ctx.db.findingControlLink.findMany({
          where: {
            controlId: input.controlId,
            organizationId: ctx.organizationId!,
          },
          select: { linkType: true },
        }),
        ctx.db.control.findFirst({
          where: {
            id: input.controlId,
            organizationId: ctx.organizationId!,
          },
          include: { Framework: true },
        }),
      ]);

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      const health = calculateControlHealth(riskLinks, findingLinks);

      return {
        controlId: control.id,
        controlCode: control.controlId,
        title: control.title,
        frameworkId: control.frameworkId,
        frameworkCode: control.Framework.code,
        frameworkName: control.Framework.name,
        health,
        riskCount: riskLinks.length,
        findingCount: findingLinks.length,
        risksByType: {
          MITIGATING: riskLinks.filter((l) => l.linkType === "MITIGATING")
            .length,
          GAP: riskLinks.filter((l) => l.linkType === "GAP").length,
          AFFECTED: riskLinks.filter((l) => l.linkType === "AFFECTED").length,
        },
        findingsByType: {
          VIOLATION: findingLinks.filter((l) => l.linkType === "VIOLATION")
            .length,
          WEAKNESS: findingLinks.filter((l) => l.linkType === "WEAKNESS")
            .length,
          OBSERVATION: findingLinks.filter((l) => l.linkType === "OBSERVATION")
            .length,
        },
      };
    }),

  /**
   * Get health summary for all controls in a framework (AC36)
   */
  getFrameworkControlHealth: organizationProcedure
    .input(z.object({ frameworkId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all active controls for the framework
      const controls = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        include: {
          RiskLinks: { select: { linkType: true } },
          FindingLinks: { select: { linkType: true } },
          Framework: true,
        },
      });

      // Calculate health for each control
      const controlsWithHealth = controls.map((control) => ({
        id: control.id,
        controlId: control.controlId,
        title: control.title,
        frameworkId: control.frameworkId,
        frameworkCode: control.Framework.code,
        health: calculateControlHealth(control.RiskLinks, control.FindingLinks),
        riskCount: control.RiskLinks.length,
        findingCount: control.FindingLinks.length,
      }));

      // Aggregate summary
      const summary = {
        total: controls.length,
        healthy: controlsWithHealth.filter((c) => c.health === "HEALTHY")
          .length,
        atRisk: controlsWithHealth.filter((c) => c.health === "AT_RISK").length,
        critical: controlsWithHealth.filter((c) => c.health === "CRITICAL")
          .length,
      };

      return {
        frameworkId: input.frameworkId,
        summary,
        controls: controlsWithHealth,
      };
    }),

  /**
   * Get all frameworks with health summary (Story 12.2 AC1-AC8)
   */
  getFrameworksWithHealth: organizationProcedure.query(async ({ ctx }) => {
    // Get all frameworks with their controls and links
    const frameworks = await ctx.db.framework.findMany({
      where: { organizationId: ctx.organizationId! },
      include: {
        Control: {
          where: { isActive: true },
          include: {
            RiskLinks: { select: { linkType: true } },
            FindingLinks: { select: { linkType: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate health for each framework
    const frameworksWithHealth: FrameworkHealthSummary[] = frameworks.map(
      (framework) => {
        let healthyCount = 0;
        let atRiskCount = 0;
        let criticalCount = 0;

        for (const control of framework.Control) {
          const health = calculateControlHealth(
            control.RiskLinks,
            control.FindingLinks
          );
          if (health === "HEALTHY") healthyCount++;
          else if (health === "AT_RISK") atRiskCount++;
          else criticalCount++;
        }

        // Overall framework health
        let health: "HEALTHY" | "AT_RISK" | "CRITICAL" = "HEALTHY";
        if (criticalCount > 0) health = "CRITICAL";
        else if (atRiskCount > 0) health = "AT_RISK";

        return {
          frameworkId: framework.id,
          frameworkCode: framework.code,
          frameworkName: framework.name,
          isActive: framework.isActive,
          totalControls: framework.Control.length,
          atRiskControls: atRiskCount,
          criticalControls: criticalCount,
          healthyControls: healthyCount,
          health,
        };
      }
    );

    // Overall summary statistics (AC9-AC14)
    const summary = {
      totalFrameworks: frameworks.length,
      activeFrameworks: frameworks.filter((f) => f.isActive).length,
      totalControls: frameworksWithHealth.reduce(
        (sum, f) => sum + f.totalControls,
        0
      ),
      atRiskControls: frameworksWithHealth.reduce(
        (sum, f) => sum + f.atRiskControls + f.criticalControls,
        0
      ),
      healthyFrameworks: frameworksWithHealth.filter(
        (f) => f.health === "HEALTHY"
      ).length,
      atRiskFrameworks: frameworksWithHealth.filter(
        (f) => f.health === "AT_RISK"
      ).length,
      criticalFrameworks: frameworksWithHealth.filter(
        (f) => f.health === "CRITICAL"
      ).length,
    };

    return {
      frameworks: frameworksWithHealth,
      summary,
    };
  }),

  /**
   * Get controls with health for browsing (for Story 12.8)
   */
  listControlsWithHealth: organizationProcedure
    .input(
      z.object({
        frameworkId: z.string().optional(),
        health: z.enum(["HEALTHY", "AT_RISK", "CRITICAL"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { frameworkId, health, search, limit, offset } = input;

      // Build where clause
      const where: {
        organizationId: string;
        isActive: boolean;
        frameworkId?: string;
        OR?: Array<{
          controlId?: { contains: string; mode: "insensitive" };
          title?: { contains: string; mode: "insensitive" };
          description?: { contains: string; mode: "insensitive" };
        }>;
      } = {
        organizationId: ctx.organizationId!,
        isActive: true,
      };

      if (frameworkId) {
        where.frameworkId = frameworkId;
      }

      if (search) {
        where.OR = [
          { controlId: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count
      const total = await ctx.db.control.count({ where });

      // Get controls with links
      const controls = await ctx.db.control.findMany({
        where,
        include: {
          RiskLinks: { select: { linkType: true } },
          FindingLinks: { select: { linkType: true } },
          Framework: true,
        },
        orderBy: [{ Framework: { code: "asc" } }, { controlId: "asc" }],
        skip: offset,
        take: limit,
      });

      // Calculate health and filter if needed
      let controlsWithHealth = controls.map((control) => ({
        id: control.id,
        controlId: control.controlId,
        title: control.title,
        description: control.description,
        frameworkId: control.frameworkId,
        frameworkCode: control.Framework.code,
        frameworkName: control.Framework.name,
        health: calculateControlHealth(control.RiskLinks, control.FindingLinks),
        riskCount: control.RiskLinks.length,
        findingCount: control.FindingLinks.length,
      }));

      // Filter by health if specified
      if (health) {
        controlsWithHealth = controlsWithHealth.filter(
          (c) => c.health === health
        );
      }

      return {
        controls: controlsWithHealth,
        total,
        limit,
        offset,
      };
    }),
});
