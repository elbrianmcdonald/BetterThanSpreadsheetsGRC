/**
 * Vendor Assessment Router
 *
 * tRPC router for vendor assessment workflow operations.
 *
 * Epic 3: Assessment Workflow
 * - Story 3.1: Create Vendor Assessment (FR17)
 * - Story 3.2: Assign Assessor and Due Date (FR18, FR19)
 * - Story 3.3: Assessment Status Workflow (FR20)
 * - Story 3.4: Assessment Scoring and Recommendation (FR21, FR22)
 * - Story 3.5: Assessment Notes and Summary (FR23)
 * - Story 3.6: Assessment History View (FR24)
 * - Story 3.7: IT Stakeholder Assessment Access (FR25, FR26)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  VendorAssessmentStatus,
  VendorAssessmentRecommendation,
  AuditAction,
  Prisma,
} from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { generateIdentifier } from "@/server/services/identifierService";
import { createAuditLog } from "@/server/services/audit-log.service";
import { enqueueEmail } from "@/server/services/emailQueue.service";
import { renderAssessmentStatusChangedEmail } from "@/server/email/templates";

/**
 * Roles that can view assessments
 * Includes assessors, analysts, and stakeholders
 */
const ASSESSMENT_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * Roles that can create/manage assessments
 */
const ASSESSMENT_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

/**
 * Roles that can complete assessments (final approval)
 */
const ASSESSMENT_COMPLETE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

/**
 * Create Assessment Input Schema (Story 3.1 - FR17)
 */
const createAssessmentSchema = z.object({
  vendorId: z.string(),
  title: z.string().min(1, "Title is required").max(200),
  dueDate: z.date().optional(),
  assessorId: z.string().optional(),
});

/**
 * Update Assessment Input Schema (Stories 3.2-3.5)
 */
const updateAssessmentSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  dueDate: z.date().optional().nullable(),
  assessorId: z.string().optional().nullable(),
  riskScore: z.number().min(0).max(100).optional().nullable(),
  recommendation: z.nativeEnum(VendorAssessmentRecommendation).optional().nullable(),
  conditions: z.string().max(2000).optional().nullable(),
  rejectionReason: z.string().max(2000).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
});

/**
 * Update Assessment Status Schema (Story 3.3 - FR20)
 */
const updateStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(VendorAssessmentStatus),
});

/**
 * List Assessments Input Schema (Story 3.6 - FR24)
 */
const listAssessmentsSchema = z.object({
  vendorId: z.string().optional(),
  status: z.nativeEnum(VendorAssessmentStatus).optional(),
  assessorId: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(25),
  sortBy: z.enum(["createdAt", "dueDate", "status", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Add Comment Input Schema (Story 3.7 - FR26)
 */
const addCommentSchema = z.object({
  assessmentId: z.string(),
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

export const vendorAssessmentRouter = createTRPCRouter({
  /**
   * Create a new vendor assessment (Story 3.1 - FR17)
   */
  create: organizationProcedure
    .use(requireRole(ASSESSMENT_MANAGE_ROLES))
    .input(createAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { vendorId, title, dueDate, assessorId } = input;

      // Verify vendor exists and belongs to this organization
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: vendorId, organizationId },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Generate unique identifier (VA-YYYY-NNNN format)
      const identifier = await generateIdentifier(organizationId, "VA");

      // Create assessment
      const assessment = await ctx.db.vendorAssessment.create({
        data: {
          identifier,
          organizationId,
          vendorId,
          title,
          dueDate,
          assessorId,
          status: VendorAssessmentStatus.DRAFT,
          createdById: userId,
        },
        include: {
          vendor: { select: { id: true, identifier: true, name: true } },
          assessor: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_ASSESSMENT_CREATED,
        entityType: "VendorAssessment",
        entityId: assessment.id,
        changes: {
          before: null,
          after: {
            identifier: assessment.identifier,
            vendorId,
            title,
            status: VendorAssessmentStatus.DRAFT,
          },
        },
      });

      return assessment;
    }),

  /**
   * List assessments with filtering (Story 3.6 - FR24)
   */
  list: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .input(listAssessmentsSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { vendorId, status, assessorId, search, page, pageSize, sortBy, sortOrder } = input;

      // Build where clause
      const where: Prisma.VendorAssessmentWhereInput = {
        organizationId,
      };

      // Apply filters
      if (vendorId) {
        where.vendorId = vendorId;
      }
      if (status) {
        where.status = status;
      }
      if (assessorId) {
        where.assessorId = assessorId;
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { identifier: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      // Get total count
      const totalCount = await ctx.db.vendorAssessment.count({ where });

      // Get assessments
      const assessments = await ctx.db.vendorAssessment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          vendor: { select: { id: true, identifier: true, name: true, riskTier: true } },
          assessor: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      });

      return {
        assessments,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    }),

  /**
   * Get assessment by ID (Story 3.6 - FR24)
   */
  getById: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const assessment = await ctx.db.vendorAssessment.findFirst({
        where: { id: input.id, organizationId },
        include: {
          vendor: {
            select: {
              id: true,
              identifier: true,
              name: true,
              riskTier: true,
            },
          },
          assessor: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          comments: {
            orderBy: { createdAt: "desc" },
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      return assessment;
    }),

  /**
   * Update assessment (Stories 3.2-3.5)
   */
  update: organizationProcedure
    .use(requireRole(ASSESSMENT_MANAGE_ROLES))
    .input(updateAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, ...updateData } = input;

      // Get existing assessment
      const existingAssessment = await ctx.db.vendorAssessment.findFirst({
        where: { id, organizationId },
      });

      if (!existingAssessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Cannot update completed assessments
      if (existingAssessment.status === VendorAssessmentStatus.COMPLETED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify a completed assessment",
        });
      }

      // Build update data
      const data: Prisma.VendorAssessmentUpdateInput = {};
      if (updateData.title !== undefined) data.title = updateData.title;
      if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate;
      if (updateData.assessorId !== undefined) {
        data.assessor = updateData.assessorId
          ? { connect: { id: updateData.assessorId } }
          : { disconnect: true };
      }
      if (updateData.riskScore !== undefined) data.riskScore = updateData.riskScore;
      if (updateData.recommendation !== undefined) data.recommendation = updateData.recommendation;
      if (updateData.conditions !== undefined) data.conditions = updateData.conditions;
      if (updateData.rejectionReason !== undefined) data.rejectionReason = updateData.rejectionReason;
      if (updateData.summary !== undefined) data.summary = updateData.summary;

      // Update assessment
      const assessment = await ctx.db.vendorAssessment.update({
        where: { id },
        data,
        include: {
          vendor: { select: { id: true, identifier: true, name: true } },
          assessor: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_ASSESSMENT_UPDATED,
        entityType: "VendorAssessment",
        entityId: assessment.id,
        changes: {
          before: existingAssessment,
          after: updateData,
        },
      });

      return assessment;
    }),

  /**
   * Update assessment status (Story 3.3 - FR20)
   */
  updateStatus: organizationProcedure
    .use(requireRole(ASSESSMENT_MANAGE_ROLES))
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const userRole = ctx.session!.user.role;
      const { id, status } = input;

      // Get existing assessment
      const existingAssessment = await ctx.db.vendorAssessment.findFirst({
        where: { id, organizationId },
        include: { vendor: true },
      });

      if (!existingAssessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Validate status transitions
      const validTransitions: Record<VendorAssessmentStatus, VendorAssessmentStatus[]> = {
        [VendorAssessmentStatus.DRAFT]: [VendorAssessmentStatus.IN_PROGRESS],
        [VendorAssessmentStatus.IN_PROGRESS]: [VendorAssessmentStatus.IN_REVIEW],
        [VendorAssessmentStatus.IN_REVIEW]: [VendorAssessmentStatus.COMPLETED, VendorAssessmentStatus.IN_PROGRESS],
        [VendorAssessmentStatus.COMPLETED]: [],
      };

      if (!validTransitions[existingAssessment.status].includes(status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${existingAssessment.status} to ${status}`,
        });
      }

      // Only GRC Analyst or ORG_ADMIN can complete assessments
      if (status === VendorAssessmentStatus.COMPLETED) {
        if (!(ASSESSMENT_COMPLETE_ROLES as readonly UserRole[]).includes(userRole as UserRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only GRC Analysts or Org Admins can complete assessments",
          });
        }
      }

      // Build update data
      const data: Prisma.VendorAssessmentUpdateInput = {
        status,
        statusChangedAt: new Date(),
      };

      // Set completion fields if completing
      if (status === VendorAssessmentStatus.COMPLETED) {
        data.completedAt = new Date();
        data.completedBy = { connect: { id: userId } };
      }

      // Update assessment
      const assessment = await ctx.db.vendorAssessment.update({
        where: { id },
        data,
        include: {
          vendor: { select: { id: true, identifier: true, name: true } },
          assessor: { select: { id: true, name: true, email: true } },
        },
      });

      // Get current user name and organization for notification
      const [currentUser, organization] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
        ctx.db.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        }),
      ]);

      // Send status change notification to assessor (FR62)
      if (assessment.assessor?.email) {
        const emailData = renderAssessmentStatusChangedEmail({
          recipientName: assessment.assessor.name || "Assessor",
          vendorName: assessment.vendor.name,
          assessmentTitle: assessment.title,
          previousStatus: existingAssessment.status,
          newStatus: status,
          changedByName: currentUser?.name || "A user",
          assessmentId: assessment.id,
          vendorId: assessment.vendor.id,
          organizationName: organization?.name || "Organization",
          organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
        });

        void enqueueEmail({
          to: assessment.assessor.email,
          subject: emailData.subject,
          htmlContent: emailData.html,
          textContent: emailData.text,
          emailType: "ASSESSMENT_STATUS_CHANGED",
          relatedEntityType: "VendorAssessment",
          relatedEntityId: assessment.id,
          organizationId,
        });
      }

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_ASSESSMENT_STATUS_CHANGED,
        entityType: "VendorAssessment",
        entityId: assessment.id,
        changes: {
          before: { status: existingAssessment.status },
          after: { status },
        },
      });

      return assessment;
    }),

  /**
   * Add comment to assessment (Story 3.7 - FR26)
   */
  addComment: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { assessmentId, content } = input;

      // Verify assessment exists
      const assessment = await ctx.db.vendorAssessment.findFirst({
        where: { id: assessmentId, organizationId },
      });

      if (!assessment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assessment not found",
        });
      }

      // Create comment
      const comment = await ctx.db.vendorAssessmentComment.create({
        data: {
          assessmentId,
          authorId: userId,
          content,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_ASSESSMENT_COMMENT_ADDED,
        entityType: "VendorAssessmentComment",
        entityId: comment.id,
        changes: {
          before: null,
          after: { assessmentId, content: content.substring(0, 100) },
        },
      });

      return comment;
    }),

  /**
   * Get assessment stats for a vendor
   */
  getVendorStats: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { vendorId } = input;

      const [totalCount, statusCounts, latestAssessment] = await Promise.all([
        ctx.db.vendorAssessment.count({
          where: { organizationId, vendorId },
        }),
        ctx.db.vendorAssessment.groupBy({
          by: ["status"],
          where: { organizationId, vendorId },
          _count: { status: true },
        }),
        ctx.db.vendorAssessment.findFirst({
          where: { organizationId, vendorId, status: VendorAssessmentStatus.COMPLETED },
          orderBy: { completedAt: "desc" },
          select: {
            id: true,
            identifier: true,
            title: true,
            riskScore: true,
            recommendation: true,
            completedAt: true,
          },
        }),
      ]);

      const statusDistribution = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {} as Record<VendorAssessmentStatus, number>
      );

      return {
        totalCount,
        statusDistribution,
        latestAssessment,
      };
    }),

  /**
   * Get overall assessment stats for dashboard
   */
  getStats: organizationProcedure
    .use(requireRole(ASSESSMENT_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Build base where clause
      const baseWhere: Prisma.VendorAssessmentWhereInput = { organizationId };

      const now = new Date();

      const [totalCount, statusCounts, overdueCount, myAssignedCount] = await Promise.all([
        ctx.db.vendorAssessment.count({ where: baseWhere }),
        ctx.db.vendorAssessment.groupBy({
          by: ["status"],
          where: baseWhere,
          _count: { status: true },
        }),
        ctx.db.vendorAssessment.count({
          where: {
            ...baseWhere,
            dueDate: { lt: now },
            status: { not: VendorAssessmentStatus.COMPLETED },
          },
        }),
        ctx.db.vendorAssessment.count({
          where: {
            ...baseWhere,
            assessorId: userId,
            status: { not: VendorAssessmentStatus.COMPLETED },
          },
        }),
      ]);

      const statusDistribution = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        },
        {
          DRAFT: 0,
          IN_PROGRESS: 0,
          IN_REVIEW: 0,
          COMPLETED: 0,
        } as Record<VendorAssessmentStatus, number>
      );

      return {
        totalCount,
        statusDistribution,
        overdueCount,
        myAssignedCount,
      };
    }),
});
