/**
 * Evidence Request Router - tRPC procedures for evidence request workflow
 *
 * Story 3.12: Evidence Request Workflow (GRC Analyst → User)
 *
 * Handles:
 * - Evidence request creation (GRC Analyst/Org Admin → User)
 * - Evidence request listing (for recipients and senders)
 * - Evidence request fulfillment (recipient uploads evidence)
 * - Evidence request cancellation
 * - Request status tracking
 *
 * @see Story 3.12: Evidence Request Workflow
 * @module server/api/routers/evidence-request
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EvidenceRequestStatus } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requirePermission,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import { createAuditLog } from "@/server/services/audit-log.service";
import { emailService } from "@/server/services/email.service";
import { env } from "@/env";

/**
 * Input schema for creating an evidence request
 *
 * AC2: Request form captures: recipient user, control domains, due date, instructions, framework context
 * AC3: Recipient user must be from same organization (validated in mutation)
 * AC4: Control domains limited to 1-5 selections
 * AC5: Due date must be future date
 */
const createEvidenceRequestInput = z.object({
  /** Recipient user ID (AC2) */
  recipientUserId: z.string().min(1, "Recipient user is required"),
  /** Control domain IDs - 1-5 required (AC4) */
  controlTaxonomyIds: z
    .array(z.string())
    .min(1, "At least one control domain is required")
    .max(5, "Maximum 5 control domains allowed"),
  /** Due date - must be in the future (AC5) */
  dueDate: z.date().refine(
    (date) => date > new Date(),
    "Due date must be in the future"
  ),
  /** Instructions for the recipient (AC2) */
  instructions: z.string().min(10, "Instructions must be at least 10 characters"),
  /** Optional framework code for context (AC2) */
  frameworkCode: z.string().optional(),
});

/**
 * Input schema for listing evidence requests
 */
const listEvidenceRequestsInput = z.object({
  /** Filter by status */
  status: z.nativeEnum(EvidenceRequestStatus).optional(),
  /** Include deleted requests */
  includeDeleted: z.boolean().default(false),
  /** Page number (1-indexed) */
  page: z.number().min(1).default(1),
  /** Items per page */
  pageSize: z.number().min(1).max(50).default(20),
});

/**
 * Evidence Request Router definition
 */
export const evidenceRequestRouter = createTRPCRouter({
  /**
   * Create a new evidence request
   *
   * AC1: GRC Analyst can create evidence request from Evidence Repository page
   * AC2: Request form captures all required fields
   * AC3: Recipient must be from same organization
   * AC6: Creating request sends email notification to recipient
   * AC7: Request stored with status: PENDING
   * AC8: Request creation logged to audit trail
   *
   * @requires EVIDENCE_REQUEST_CREATE permission
   */
  create: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_CREATE))
    .input(createEvidenceRequestInput)
    .mutation(async ({ ctx, input }) => {
      // AC3: Validate recipient belongs to same organization
      const recipient = await ctx.db.user.findUnique({
        where: { id: input.recipientUserId },
        select: {
          id: true,
          email: true,
          name: true,
          organizationId: true,
        },
      });

      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient user not found",
        });
      }

      if (recipient.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Recipient must be from the same organization",
        });
      }

      // Validate control domain IDs exist and are active
      const validDomains = await ctx.db.controlDomain.findMany({
        where: {
          id: { in: input.controlTaxonomyIds },
          isActive: true,
        },
        select: { id: true, name: true },
      });

      if (validDomains.length !== input.controlTaxonomyIds.length) {
        const validIds = new Set(validDomains.map((d) => d.id));
        const invalidIds = input.controlTaxonomyIds.filter((id) => !validIds.has(id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid control domain IDs: ${invalidIds.join(", ")}`,
        });
      }

      // AC7: Create evidence request with status PENDING
      const request = await ctx.db.evidenceRequest.create({
        data: {
          recipientUserId: input.recipientUserId,
          requestedById: ctx.session!.user.id,
          controlTaxonomyIds: input.controlTaxonomyIds,
          dueDate: input.dueDate,
          instructions: input.instructions,
          frameworkCode: input.frameworkCode,
          status: EvidenceRequestStatus.PENDING,
          organizationId: ctx.organizationId!,
        },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Get requester name for email
      const requesterName = ctx.session!.user.name ?? ctx.session!.user.email ?? "GRC Analyst";

      // AC6: Send email notification to recipient
      const appUrl = env.AUTH_URL ?? "http://localhost:3000";
      const requestUrl = `${appUrl}/evidence-requests/${request.id}`;

      await emailService.sendEvidenceRequest({
        to: recipient.email ?? "",
        requesterName,
        controlDomains: validDomains.map((d) => d.name),
        dueDate: input.dueDate,
        instructions: input.instructions,
        requestUrl,
        frameworkCode: input.frameworkCode,
      });

      // AC8: Log request creation to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "CREATE_EVIDENCE_REQUEST",
        entityType: "EvidenceRequest",
        entityId: request.id,
        changes: {
          after: {
            recipientUserId: input.recipientUserId,
            recipientEmail: recipient.email,
            controlDomains: validDomains.map((d) => d.name),
            dueDate: input.dueDate.toISOString(),
            frameworkCode: input.frameworkCode,
          },
        },
      });

      // Log email delivery to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "SEND_EVIDENCE_REQUEST_EMAIL",
        entityType: "EvidenceRequest",
        entityId: request.id,
        changes: {
          after: {
            type: "request_created",
            recipientEmail: recipient.email,
            sentAt: new Date().toISOString(),
          },
        },
      });

      return request;
    }),

  /**
   * Get evidence request by ID
   *
   * AC24: Recipient can click request to view detail page with full instructions
   * AC25: Detail page displays all request information
   *
   * @requires EVIDENCE_REQUEST_READ permission
   */
  getById: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_READ))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.evidenceRequest.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          evidence: {
            select: { id: true, title: true, originalFileName: true },
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence request not found",
        });
      }

      // Get control domain names for display
      const controlDomains = await ctx.db.controlDomain.findMany({
        where: { id: { in: request.controlTaxonomyIds } },
        select: { id: true, code: true, name: true },
      });

      return {
        ...request,
        controlDomains,
        daysUntilDue: Math.ceil(
          (request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
        isOverdue: request.dueDate < new Date() && request.status === EvidenceRequestStatus.PENDING,
      };
    }),

  /**
   * List evidence requests received by the current user (for recipients)
   *
   * AC19: Recipients see "My Evidence Requests" page listing all pending requests
   * AC20: Request list shows: control domains, requester, due date, status, days until due
   * AC21: Overdue requests highlighted (handled by client using isOverdue flag)
   * AC22: Requests sortable by due date (soonest first)
   *
   * @requires EVIDENCE_REQUEST_READ permission
   */
  listMyRequests: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_READ))
    .input(listEvidenceRequestsInput)
    .query(async ({ ctx, input }) => {
      const { status, includeDeleted, page, pageSize } = input;
      const skip = (page - 1) * pageSize;

      const where = {
        organizationId: ctx.organizationId!,
        recipientUserId: ctx.session!.user.id,
        ...(status ? { status } : {}),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      };

      const [total, requests] = await Promise.all([
        ctx.db.evidenceRequest.count({ where }),
        ctx.db.evidenceRequest.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { dueDate: "asc" }, // AC22: Soonest first
          include: {
            requestedBy: {
              select: { id: true, name: true, email: true },
            },
            evidence: {
              select: { id: true, title: true },
            },
          },
        }),
      ]);

      // Enrich with control domain names and days until due
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const controlDomains = await ctx.db.controlDomain.findMany({
            where: { id: { in: request.controlTaxonomyIds } },
            select: { id: true, name: true },
          });

          const daysUntilDue = Math.ceil(
            (request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...request,
            controlDomains,
            daysUntilDue,
            isOverdue: request.dueDate < new Date() && request.status === EvidenceRequestStatus.PENDING,
          };
        })
      );

      return {
        items: enrichedRequests,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * List evidence requests sent by the current user (for analysts)
   *
   * AC30: GRC Analyst sees "Evidence Requests Sent" page listing all requests they created
   * AC31: List shows: recipient name, control domains, due date, status, days since sent
   *
   * @requires EVIDENCE_REQUEST_READ permission
   */
  listSentRequests: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_READ))
    .input(listEvidenceRequestsInput)
    .query(async ({ ctx, input }) => {
      const { status, includeDeleted, page, pageSize } = input;
      const skip = (page - 1) * pageSize;

      const where = {
        organizationId: ctx.organizationId!,
        requestedById: ctx.session!.user.id,
        ...(status ? { status } : {}),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      };

      const [total, requests] = await Promise.all([
        ctx.db.evidenceRequest.count({ where }),
        ctx.db.evidenceRequest.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" }, // Newest first for sent requests
          include: {
            recipient: {
              select: { id: true, name: true, email: true },
            },
            evidence: {
              select: { id: true, title: true },
            },
          },
        }),
      ]);

      // Enrich with control domain names and days since sent
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const controlDomains = await ctx.db.controlDomain.findMany({
            where: { id: { in: request.controlTaxonomyIds } },
            select: { id: true, name: true },
          });

          const daysSinceSent = Math.ceil(
            (Date.now() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...request,
            controlDomains,
            daysSinceSent,
            daysUntilDue: Math.ceil(
              (request.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
            isOverdue: request.dueDate < new Date() && request.status === EvidenceRequestStatus.PENDING,
          };
        })
      );

      return {
        items: enrichedRequests,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get pending evidence request count for navigation badge
   *
   * AC23: Request count badge displayed in navigation menu
   *
   * @requires EVIDENCE_REQUEST_READ permission
   */
  getPendingCount: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_READ))
    .query(async ({ ctx }) => {
      const count = await ctx.db.evidenceRequest.count({
        where: {
          organizationId: ctx.organizationId!,
          recipientUserId: ctx.session!.user.id,
          status: EvidenceRequestStatus.PENDING,
          deletedAt: null,
        },
      });

      return { count };
    }),

  /**
   * Fulfill an evidence request by linking uploaded evidence
   *
   * AC27: On evidence upload, request status changes to FULFILLED automatically
   * AC28: Fulfilled request stores evidenceId linking to uploaded evidence
   * AC29: Fulfilling request sends email notification to original requester
   *
   * @requires EVIDENCE_REQUEST_FULFILL permission
   */
  fulfill: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_FULFILL))
    .input(
      z.object({
        requestId: z.string(),
        evidenceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find the request
      const request = await ctx.db.evidenceRequest.findUnique({
        where: { id: input.requestId },
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence request not found",
        });
      }

      // Verify user is the recipient
      if (request.recipientUserId !== ctx.session!.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the request recipient can fulfill this request",
        });
      }

      // Verify request is still pending
      if (request.status !== EvidenceRequestStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot fulfill a ${request.status.toLowerCase()} request`,
        });
      }

      // Verify evidence exists and belongs to same organization
      const evidence = await ctx.db.evidence.findUnique({
        where: { id: input.evidenceId },
        select: { id: true, title: true, organizationId: true },
      });

      if (!evidence || evidence.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Get control domain names for email
      const controlDomains = await ctx.db.controlDomain.findMany({
        where: { id: { in: request.controlTaxonomyIds } },
        select: { name: true },
      });

      // AC27, AC28: Update request status to FULFILLED
      const updated = await ctx.db.evidenceRequest.update({
        where: { id: input.requestId },
        data: {
          status: EvidenceRequestStatus.FULFILLED,
          evidenceId: input.evidenceId,
          fulfilledAt: new Date(),
        },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // AC29: Send email notification to original requester
      const appUrl = env.AUTH_URL ?? "http://localhost:3000";
      const evidenceUrl = `${appUrl}/admin/evidence/${input.evidenceId}`;
      const recipientName = ctx.session!.user.name ?? ctx.session!.user.email ?? "User";

      await emailService.sendEvidenceRequestFulfilled({
        to: request.requestedBy.email ?? "",
        recipientName,
        evidenceUrl,
        controlDomains: controlDomains.map((d) => d.name),
        requestId: request.id,
      });

      // Log fulfillment to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "FULFILL_EVIDENCE_REQUEST",
        entityType: "EvidenceRequest",
        entityId: request.id,
        changes: {
          before: { status: request.status },
          after: {
            status: EvidenceRequestStatus.FULFILLED,
            evidenceId: input.evidenceId,
            fulfilledAt: new Date().toISOString(),
          },
        },
      });

      return updated;
    }),

  /**
   * Cancel an evidence request
   *
   * AC32: Analyst can cancel pending request (status changes to CANCELLED)
   * AC33: Cancelling request sends email notification to recipient
   *
   * @requires EVIDENCE_REQUEST_CANCEL permission
   */
  cancel: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_CANCEL))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find the request
      const request = await ctx.db.evidenceRequest.findUnique({
        where: { id: input.id },
        include: {
          recipient: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence request not found",
        });
      }

      // Verify request belongs to user's organization
      if (request.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this request",
        });
      }

      // Verify user is the requester (creator) or is ORG_ADMIN
      const isRequester = request.requestedById === ctx.session!.user.id;
      const isAdmin = ctx.session!.user.role === "ADMINISTRATOR";

      if (!isRequester && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the request creator or organization admin can cancel this request",
        });
      }

      // Verify request is still pending
      if (request.status !== EvidenceRequestStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel a ${request.status.toLowerCase()} request`,
        });
      }

      // Get control domain names for email
      const controlDomains = await ctx.db.controlDomain.findMany({
        where: { id: { in: request.controlTaxonomyIds } },
        select: { name: true },
      });

      // AC32: Update request status to CANCELLED
      const updated = await ctx.db.evidenceRequest.update({
        where: { id: input.id },
        data: {
          status: EvidenceRequestStatus.CANCELLED,
        },
      });

      // AC33: Send cancellation email to recipient
      const cancellerName = ctx.session!.user.name ?? ctx.session!.user.email ?? "GRC Analyst";

      await emailService.sendEvidenceRequestCancelled({
        to: request.recipient.email ?? "",
        cancellerName,
        controlDomains: controlDomains.map((d) => d.name),
        dueDate: request.dueDate,
      });

      // Log cancellation to audit trail
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "CANCEL_EVIDENCE_REQUEST",
        entityType: "EvidenceRequest",
        entityId: request.id,
        changes: {
          before: { status: request.status },
          after: { status: EvidenceRequestStatus.CANCELLED },
        },
      });

      return updated;
    }),

  /**
   * Get users available for evidence requests (same organization)
   *
   * Used by the evidence request creation form to populate recipient dropdown.
   *
   * @requires EVIDENCE_REQUEST_CREATE permission
   */
  getAvailableRecipients: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_REQUEST_CREATE))
    .query(async ({ ctx }) => {
      // Get all users in the organization except the current user
      const users = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.organizationId!,
          id: { not: ctx.session!.user.id }, // Exclude self
        },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
        },
        orderBy: { name: "asc" },
      });

      // Role Consolidation Epic 2: derive the displayed role (no stored User.role).
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.platformRole ?? "BUSINESS_USER",
      }));
    }),
});
