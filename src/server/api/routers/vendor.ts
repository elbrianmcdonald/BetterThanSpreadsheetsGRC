/**
 * Vendor Router
 *
 * tRPC router for vendor registry management operations.
 *
 * Epic 1: TPRM Vendor Registry
 * - Story 1.1: Vendor Data Model and Create Form (FR1)
 * - Story 1.2: Vendor List View with Filtering (FR2)
 * - Story 1.3: Vendor Detail Page (FR3)
 * - Story 1.4: Edit Vendor Information (FR4)
 * - Story 1.5: Vendor Status Management (FR5)
 * - Story 1.6: Business Unit and Owner Assignment (FR6, FR7)
 * - Story 1.7: Role-Based Vendor Access (FR8, FR9, FR10)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, VendorStatus, VendorRiskTier, VendorAssessmentStatus, FindingStatus, Severity, AuditAction, Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";
import { generateIdentifier } from "@/server/services/identifierService";
import { createAuditLog } from "@/server/services/audit-log.service";
import { enqueueEmail } from "@/server/services/emailQueue.service";
import { renderVendorOwnerAssignedEmail } from "@/server/email/templates";

/**
 * Calculate next review date based on risk tier (FR12)
 * - Critical: 6 months
 * - High: 12 months
 * - Medium: 18 months
 * - Low: 24 months
 */
function calculateNextReviewDate(tier: VendorRiskTier, fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  switch (tier) {
    case VendorRiskTier.CRITICAL:
      date.setMonth(date.getMonth() + 6);
      break;
    case VendorRiskTier.HIGH:
      date.setMonth(date.getMonth() + 12);
      break;
    case VendorRiskTier.MEDIUM:
      date.setMonth(date.getMonth() + 18);
      break;
    case VendorRiskTier.LOW:
      date.setMonth(date.getMonth() + 24);
      break;
  }
  return date;
}

/**
 * Roles that can view vendors (FR8)
 * Most roles can view vendors for context and reporting
 */
const VENDOR_VIEW_ROLES: UserRole[] = [...READ_ROLES];

/**
 * Roles that can create/edit vendors (FR9)
 * Write tier — MANAGER/ANALYST/ADMINISTRATOR can manage vendor records
 */
const VENDOR_MANAGE_ROLES: UserRole[] = [...WRITE_ROLES];

/**
 * Create Vendor Input Schema (Story 1.1 - FR1)
 */
const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  category: z.string().max(100).optional(),
  primaryContactName: z.string().max(100).optional(),
  primaryContactEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  businessUnitId: z.string().optional(),
  itOwnerId: z.string().optional(),
  businessOwnerId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Update Vendor Input Schema (Story 1.4 - FR4)
 */
const updateVendorSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(200).optional(),
  category: z.string().max(100).optional().nullable(),
  primaryContactName: z.string().max(100).optional().nullable(),
  primaryContactEmail: z.string().email().optional().nullable().or(z.literal("")),
  businessUnitId: z.string().optional().nullable(),
  itOwnerId: z.string().optional().nullable(),
  businessOwnerId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Update Status Input Schema (Story 1.5 - FR5)
 */
const updateStatusSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(VendorStatus),
});

/**
 * List Vendors Input Schema (Story 1.2 - FR2, Story 2.1 - FR11)
 */
const listVendorSchema = z.object({
  // Filters
  status: z.array(z.nativeEnum(VendorStatus)).optional(),
  riskTier: z.array(z.nativeEnum(VendorRiskTier)).optional(),
  businessUnitId: z.string().optional(),
  search: z.string().optional(),
  // Review date filters (FR14, FR15)
  reviewStatus: z.enum(["overdue", "due_in_30_days", "due_in_90_days", "all"]).optional(),
  // Sorting
  sortBy: z.enum(["identifier", "name", "category", "status", "riskTier", "nextReviewDate", "createdAt"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  // Pagination (page-based)
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(25),
});

/**
 * Update Risk Tier Input Schema (Story 2.1 - FR11)
 */
const updateRiskTierSchema = z.object({
  id: z.string(),
  riskTier: z.nativeEnum(VendorRiskTier),
});

/**
 * Override Review Date Input Schema (Story 2.5 - FR16)
 */
const overrideReviewDateSchema = z.object({
  id: z.string(),
  nextReviewDate: z.coerce.date(),
  reason: z.string().min(1, "Reason is required for override").max(500),
});

export const vendorRouter = createTRPCRouter({
  /**
   * Create a new vendor
   *
   * Story 1.1: Vendor Data Model and Create Form (FR1)
   * - Generates VND identifier
   * - Validates business unit and owner references
   * - Creates audit log entry
   */
  create: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(createVendorSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Generate sequential identifier (VND-YYYY-NNNN)
      const identifier = await generateIdentifier(organizationId, "VND");

      // Validate business unit belongs to organization
      if (input.businessUnitId) {
        const validBU = await ctx.db.businessUnit.findFirst({
          where: { id: input.businessUnitId, organizationId },
        });
        if (!validBU) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit - must be in same organization",
          });
        }
      }

      // Validate IT owner belongs to organization
      if (input.itOwnerId) {
        const validITOwner = await ctx.db.person.findFirst({
          where: { id: input.itOwnerId, organizationId },
        });
        if (!validITOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid IT owner - must be in same organization",
          });
        }
      }

      // Validate business owner belongs to organization
      if (input.businessOwnerId) {
        const validBusinessOwner = await ctx.db.person.findFirst({
          where: { id: input.businessOwnerId, organizationId },
        });
        if (!validBusinessOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business owner - must be in same organization",
          });
        }
      }

      // Create vendor
      const vendor = await ctx.db.vendor.create({
        data: {
          identifier,
          organizationId,
          name: input.name,
          category: input.category || null,
          primaryContactName: input.primaryContactName || null,
          primaryContactEmail: input.primaryContactEmail || null,
          businessUnitId: input.businessUnitId || null,
          itOwnerId: input.itOwnerId || null,
          businessOwnerId: input.businessOwnerId || null,
          notes: input.notes || null,
          createdById: userId,
          status: VendorStatus.ACTIVE,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_CREATED,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: null,
          after: {
            identifier: vendor.identifier,
            name: vendor.name,
            category: vendor.category,
            status: vendor.status,
            businessUnitId: vendor.businessUnitId,
            itOwnerId: vendor.itOwnerId,
            businessOwnerId: vendor.businessOwnerId,
          },
        },
      });

      return vendor;
    }),

  /**
   * List vendors with filtering, sorting, and pagination
   *
   * Story 1.2: Vendor List View with Filtering (FR2)
   * Story 1.7: Role-Based Vendor Access (FR8, FR9, FR10)
   * - All roles see all vendors in their organization
   */
  list: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(listVendorSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { status, riskTier, businessUnitId, search, reviewStatus, sortBy, sortOrder, page, limit } = input;

      // Build where clause with filters
      const where: Prisma.VendorWhereInput = {
        organizationId,
        ...(status && status.length > 0 && { status: { in: status } }),
        ...(riskTier && riskTier.length > 0 && { riskTier: { in: riskTier } }),
        ...(businessUnitId && { businessUnitId }),
        ...(search && {
          OR: [
            { identifier: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      // Apply review status filter (FR14, FR15)
      if (reviewStatus && reviewStatus !== "all") {
        const now = new Date();
        if (reviewStatus === "overdue") {
          where.nextReviewDate = { lt: now };
        } else if (reviewStatus === "due_in_30_days") {
          const thirtyDaysFromNow = new Date(now);
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          where.nextReviewDate = { lte: thirtyDaysFromNow, gte: now };
        } else if (reviewStatus === "due_in_90_days") {
          const ninetyDaysFromNow = new Date(now);
          ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
          where.nextReviewDate = { lte: ninetyDaysFromNow, gte: now };
        }
      }

      // Build orderBy clause
      const orderBy: Prisma.VendorOrderByWithRelationInput = {
        [sortBy!]: sortOrder,
      };

      // Get total count for pagination
      const totalCount = await ctx.db.vendor.count({ where });

      // Calculate skip for page-based pagination
      const skip = (page! - 1) * limit!;

      // Fetch vendors
      const vendors = await ctx.db.vendor.findMany({
        where,
        orderBy,
        skip,
        take: limit!,
        select: {
          id: true,
          identifier: true,
          name: true,
          category: true,
          status: true,
          riskTier: true,
          nextReviewDate: true,
          reviewDateOverridden: true,
          primaryContactName: true,
          primaryContactEmail: true,
          createdAt: true,
          updatedAt: true,
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        items: vendors,
        totalCount,
        page: page!,
        limit: limit!,
        totalPages: Math.ceil(totalCount / limit!),
      };
    }),

  /**
   * Get a vendor by ID
   *
   * Story 1.3: Vendor Detail Page (FR3)
   */
  getById: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const vendor = await ctx.db.vendor.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          // Epic 5: Include findings and risks counts (FR47, FR49)
          _count: {
            select: {
              findings: true,
              risks: true,
              assessments: true,
            },
          },
        },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return vendor;
    }),

  /**
   * Update vendor information
   *
   * Story 1.4: Edit Vendor Information (FR4)
   */
  update: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(updateVendorSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, ...updateData } = input;

      // Fetch existing vendor
      const existingVendor = await ctx.db.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!existingVendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Validate business unit if changing
      if (updateData.businessUnitId) {
        const validBU = await ctx.db.businessUnit.findFirst({
          where: { id: updateData.businessUnitId, organizationId },
        });
        if (!validBU) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit - must be in same organization",
          });
        }
      }

      // Validate IT owner if changing
      if (updateData.itOwnerId) {
        const validITOwner = await ctx.db.person.findFirst({
          where: { id: updateData.itOwnerId, organizationId },
        });
        if (!validITOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid IT owner - must be in same organization",
          });
        }
      }

      // Validate business owner if changing
      if (updateData.businessOwnerId) {
        const validBusinessOwner = await ctx.db.person.findFirst({
          where: { id: updateData.businessOwnerId, organizationId },
        });
        if (!validBusinessOwner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business owner - must be in same organization",
          });
        }
      }

      // Build update data, converting empty strings to null
      const processedUpdateData: Prisma.VendorUpdateInput = {};
      if (updateData.name !== undefined) processedUpdateData.name = updateData.name;
      if (updateData.category !== undefined) processedUpdateData.category = updateData.category || null;
      if (updateData.primaryContactName !== undefined) processedUpdateData.primaryContactName = updateData.primaryContactName || null;
      if (updateData.primaryContactEmail !== undefined) processedUpdateData.primaryContactEmail = updateData.primaryContactEmail || null;
      if (updateData.notes !== undefined) processedUpdateData.notes = updateData.notes || null;

      // Handle relations
      if (updateData.businessUnitId !== undefined) {
        processedUpdateData.businessUnit = updateData.businessUnitId
          ? { connect: { id: updateData.businessUnitId } }
          : { disconnect: true };
      }
      if (updateData.itOwnerId !== undefined) {
        processedUpdateData.itOwner = updateData.itOwnerId
          ? { connect: { id: updateData.itOwnerId } }
          : { disconnect: true };
      }
      if (updateData.businessOwnerId !== undefined) {
        processedUpdateData.businessOwner = updateData.businessOwnerId
          ? { connect: { id: updateData.businessOwnerId } }
          : { disconnect: true };
      }

      // Update vendor
      const vendor = await ctx.db.vendor.update({
        where: { id },
        data: processedUpdateData,
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Send owner assignment notifications (FR63)
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

      // Get active assessment and finding counts for the notification
      const [activeAssessmentCount, openFindingCount] = await Promise.all([
        ctx.db.vendorAssessment.count({
          where: {
            vendorId: vendor.id,
            status: { not: VendorAssessmentStatus.COMPLETED },
          },
        }),
        ctx.db.finding.count({
          where: {
            vendorId: vendor.id,
            status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          },
        }),
      ]);

      // Notify newly assigned IT Owner
      if (
        updateData.itOwnerId !== undefined &&
        updateData.itOwnerId !== existingVendor.itOwnerId &&
        vendor.itOwner?.email
      ) {
        const emailData = renderVendorOwnerAssignedEmail({
          recipientName: vendor.itOwner.name || "IT Owner",
          vendorName: vendor.name,
          vendorIdentifier: vendor.identifier,
          ownerRole: "IT_OWNER",
          assignedByName: currentUser?.name || "A user",
          vendorId: vendor.id,
          organizationName: organization?.name || "Organization",
          organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
          vendorCategory: vendor.category ?? undefined,
          activeAssessmentCount,
          openFindingCount,
        });

        void enqueueEmail({
          to: vendor.itOwner.email,
          subject: emailData.subject,
          htmlContent: emailData.html,
          textContent: emailData.text,
          emailType: "VENDOR_OWNER_ASSIGNED",
          relatedEntityType: "Vendor",
          relatedEntityId: vendor.id,
          organizationId,
        });
      }

      // Notify newly assigned Business Owner
      if (
        updateData.businessOwnerId !== undefined &&
        updateData.businessOwnerId !== existingVendor.businessOwnerId &&
        vendor.businessOwner?.email
      ) {
        const emailData = renderVendorOwnerAssignedEmail({
          recipientName: vendor.businessOwner.name || "Business Owner",
          vendorName: vendor.name,
          vendorIdentifier: vendor.identifier,
          ownerRole: "BUSINESS_OWNER",
          assignedByName: currentUser?.name || "A user",
          vendorId: vendor.id,
          organizationName: organization?.name || "Organization",
          organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
          vendorCategory: vendor.category ?? undefined,
          activeAssessmentCount,
          openFindingCount,
        });

        void enqueueEmail({
          to: vendor.businessOwner.email,
          subject: emailData.subject,
          htmlContent: emailData.html,
          textContent: emailData.text,
          emailType: "VENDOR_OWNER_ASSIGNED",
          relatedEntityType: "Vendor",
          relatedEntityId: vendor.id,
          organizationId,
        });
      }

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_UPDATED,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: {
            name: existingVendor.name,
            category: existingVendor.category,
            primaryContactName: existingVendor.primaryContactName,
            primaryContactEmail: existingVendor.primaryContactEmail,
            businessUnitId: existingVendor.businessUnitId,
            itOwnerId: existingVendor.itOwnerId,
            businessOwnerId: existingVendor.businessOwnerId,
            notes: existingVendor.notes,
          },
          after: {
            name: vendor.name,
            category: vendor.category,
            primaryContactName: vendor.primaryContactName,
            primaryContactEmail: vendor.primaryContactEmail,
            businessUnitId: vendor.businessUnitId,
            itOwnerId: vendor.itOwnerId,
            businessOwnerId: vendor.businessOwnerId,
            notes: vendor.notes,
          },
        },
      });

      return vendor;
    }),

  /**
   * Update vendor status
   *
   * Story 1.5: Vendor Status Management (FR5)
   */
  updateStatus: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(updateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, status } = input;

      // Fetch existing vendor
      const existingVendor = await ctx.db.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!existingVendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Update status
      const vendor = await ctx.db.vendor.update({
        where: { id },
        data: { status },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_STATUS_CHANGED,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: { status: existingVendor.status },
          after: { status: vendor.status },
        },
      });

      return vendor;
    }),

  /**
   * Delete vendor (soft delete via status change to OFFBOARDED)
   *
   * Story 1.5: Vendor Status Management (FR5)
   */
  delete: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch existing vendor
      const existingVendor = await ctx.db.vendor.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!existingVendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Soft delete by setting status to OFFBOARDED
      const vendor = await ctx.db.vendor.update({
        where: { id: input.id },
        data: { status: VendorStatus.OFFBOARDED },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_DELETED,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: { status: existingVendor.status },
          after: { status: VendorStatus.OFFBOARDED },
        },
      });

      return { success: true };
    }),

  /**
   * Get vendor statistics
   *
   * Returns aggregate stats for dashboard display
   */
  getStats: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organizationId!;

      // Build base where clause
      const baseWhere: Prisma.VendorWhereInput = { organizationId };

      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Open finding statuses (not closed/resolved)
      const openFindingStatuses = [
        FindingStatus.NEW,
        FindingStatus.NEEDS_INFO,
        FindingStatus.TRIAGED,
      ];

      const [
        activeCount,
        inactiveCount,
        underReviewCount,
        offboardedCount,
        totalCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        notClassifiedCount,
        overdueReviewCount,
        upcomingReviewCount,
        // FR51: Open vendor findings count
        openFindingsCount,
        // FR55: Assessment coverage - vendors with at least one completed assessment
        vendorsWithCompletedAssessment,
        criticalVendorsWithAssessment,
        highVendorsWithAssessment,
        mediumVendorsWithAssessment,
        lowVendorsWithAssessment,
      ] = await Promise.all([
        ctx.db.vendor.count({ where: { ...baseWhere, status: VendorStatus.ACTIVE } }),
        ctx.db.vendor.count({ where: { ...baseWhere, status: VendorStatus.INACTIVE } }),
        ctx.db.vendor.count({ where: { ...baseWhere, status: VendorStatus.UNDER_REVIEW } }),
        ctx.db.vendor.count({ where: { ...baseWhere, status: VendorStatus.OFFBOARDED } }),
        ctx.db.vendor.count({ where: baseWhere }),
        // Risk tier counts (FR13)
        ctx.db.vendor.count({ where: { ...baseWhere, riskTier: VendorRiskTier.CRITICAL } }),
        ctx.db.vendor.count({ where: { ...baseWhere, riskTier: VendorRiskTier.HIGH } }),
        ctx.db.vendor.count({ where: { ...baseWhere, riskTier: VendorRiskTier.MEDIUM } }),
        ctx.db.vendor.count({ where: { ...baseWhere, riskTier: VendorRiskTier.LOW } }),
        ctx.db.vendor.count({ where: { ...baseWhere, riskTier: null } }),
        // Review alert counts (FR14, FR15)
        ctx.db.vendor.count({ where: { ...baseWhere, nextReviewDate: { lt: now } } }),
        ctx.db.vendor.count({ where: { ...baseWhere, nextReviewDate: { gte: now, lte: thirtyDaysFromNow } } }),
        // FR51: Open vendor findings
        ctx.db.finding.count({
          where: {
            organizationId,
            vendorId: { not: null },
            status: { in: openFindingStatuses },
          },
        }),
        // FR55: Assessment coverage - total vendors with completed assessment
        ctx.db.vendor.count({
          where: {
            ...baseWhere,
            assessments: {
              some: { status: VendorAssessmentStatus.COMPLETED },
            },
          },
        }),
        // FR55: Critical vendors with completed assessment
        ctx.db.vendor.count({
          where: {
            ...baseWhere,
            riskTier: VendorRiskTier.CRITICAL,
            assessments: {
              some: { status: VendorAssessmentStatus.COMPLETED },
            },
          },
        }),
        // FR55: High vendors with completed assessment
        ctx.db.vendor.count({
          where: {
            ...baseWhere,
            riskTier: VendorRiskTier.HIGH,
            assessments: {
              some: { status: VendorAssessmentStatus.COMPLETED },
            },
          },
        }),
        // FR55: Medium vendors with completed assessment
        ctx.db.vendor.count({
          where: {
            ...baseWhere,
            riskTier: VendorRiskTier.MEDIUM,
            assessments: {
              some: { status: VendorAssessmentStatus.COMPLETED },
            },
          },
        }),
        // FR55: Low vendors with completed assessment
        ctx.db.vendor.count({
          where: {
            ...baseWhere,
            riskTier: VendorRiskTier.LOW,
            assessments: {
              some: { status: VendorAssessmentStatus.COMPLETED },
            },
          },
        }),
      ]);

      return {
        totalCount,
        activeCount,
        inactiveCount,
        underReviewCount,
        offboardedCount,
        statusDistribution: {
          ACTIVE: activeCount,
          INACTIVE: inactiveCount,
          UNDER_REVIEW: underReviewCount,
          OFFBOARDED: offboardedCount,
        },
        // Risk tier distribution (FR13)
        tierDistribution: {
          CRITICAL: criticalCount,
          HIGH: highCount,
          MEDIUM: mediumCount,
          LOW: lowCount,
          NOT_CLASSIFIED: notClassifiedCount,
        },
        // Review alerts (FR14, FR15)
        overdueReviewCount,
        upcomingReviewCount,
        // FR51: Open vendor findings
        openFindingsCount,
        // FR55: Assessment coverage metrics
        assessmentCoverage: {
          total: totalCount > 0 ? Math.round((vendorsWithCompletedAssessment / totalCount) * 100) : 0,
          vendorsAssessed: vendorsWithCompletedAssessment,
          byTier: {
            CRITICAL: {
              total: criticalCount,
              assessed: criticalVendorsWithAssessment,
              percentage: criticalCount > 0 ? Math.round((criticalVendorsWithAssessment / criticalCount) * 100) : 0,
            },
            HIGH: {
              total: highCount,
              assessed: highVendorsWithAssessment,
              percentage: highCount > 0 ? Math.round((highVendorsWithAssessment / highCount) * 100) : 0,
            },
            MEDIUM: {
              total: mediumCount,
              assessed: mediumVendorsWithAssessment,
              percentage: mediumCount > 0 ? Math.round((mediumVendorsWithAssessment / mediumCount) * 100) : 0,
            },
            LOW: {
              total: lowCount,
              assessed: lowVendorsWithAssessment,
              percentage: lowCount > 0 ? Math.round((lowVendorsWithAssessment / lowCount) * 100) : 0,
            },
          },
        },
      };
    }),

  /**
   * Update vendor risk tier
   *
   * Story 2.1: Risk Tier Classification (FR11)
   * Story 2.2: Automated Review Date Calculation (FR12)
   */
  updateRiskTier: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(updateRiskTierSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, riskTier } = input;

      // Fetch existing vendor
      const existingVendor = await ctx.db.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!existingVendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Calculate next review date based on tier (FR12)
      const nextReviewDate = calculateNextReviewDate(riskTier);

      // Update vendor
      const vendor = await ctx.db.vendor.update({
        where: { id },
        data: {
          riskTier,
          nextReviewDate,
          reviewDateOverridden: false, // Reset override when tier changes
          reviewOverrideReason: null,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_TIER_CHANGED,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: {
            riskTier: existingVendor.riskTier,
            nextReviewDate: existingVendor.nextReviewDate,
          },
          after: {
            riskTier: vendor.riskTier,
            nextReviewDate: vendor.nextReviewDate,
          },
        },
      });

      return vendor;
    }),

  /**
   * Override vendor review date
   *
   * Story 2.5: Manual Review Date Override (FR16)
   */
  overrideReviewDate: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(overrideReviewDateSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { id, nextReviewDate, reason } = input;

      // Fetch existing vendor
      const existingVendor = await ctx.db.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!existingVendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Update vendor
      const vendor = await ctx.db.vendor.update({
        where: { id },
        data: {
          nextReviewDate,
          reviewDateOverridden: true,
          reviewOverrideReason: reason,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.VENDOR_REVIEW_DATE_OVERRIDDEN,
        entityType: "Vendor",
        entityId: vendor.id,
        changes: {
          before: {
            nextReviewDate: existingVendor.nextReviewDate,
            reviewDateOverridden: existingVendor.reviewDateOverridden,
          },
          after: {
            nextReviewDate: vendor.nextReviewDate,
            reviewDateOverridden: true,
            reason,
          },
        },
      });

      return vendor;
    }),

  /**
   * Get vendors with upcoming or overdue reviews
   *
   * Story 2.4: Review Alerts and Notifications (FR14, FR15)
   */
  getReviewAlerts: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(z.object({
      type: z.enum(["overdue", "upcoming"]).optional().default("overdue"),
      limit: z.number().min(1).max(50).optional().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { type, limit } = input;

      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Build base where clause
      const baseWhere: Prisma.VendorWhereInput = {
        organizationId,
        nextReviewDate: { not: null },
      };

      // Apply date filter based on type
      if (type === "overdue") {
        baseWhere.nextReviewDate = { lt: now };
      } else {
        baseWhere.nextReviewDate = { gte: now, lte: thirtyDaysFromNow };
      }

      const vendors = await ctx.db.vendor.findMany({
        where: baseWhere,
        orderBy: { nextReviewDate: type === "overdue" ? "asc" : "asc" },
        take: limit,
        select: {
          id: true,
          identifier: true,
          name: true,
          riskTier: true,
          nextReviewDate: true,
          reviewDateOverridden: true,
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
        },
      });

      return vendors;
    }),

  /**
   * Validate bulk import data (FR57, FR58)
   *
   * Epic 7: Migration & Reporting
   * Validates CSV data before import and returns errors
   */
  validateBulkImport: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(z.object({
      vendors: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        primaryContactName: z.string().optional(),
        primaryContactEmail: z.string().optional(),
        riskTier: z.string().optional(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { vendors } = input;
      const validationResults: Array<{
        row: number;
        data: typeof vendors[0];
        errors: string[];
        isValid: boolean;
      }> = [];

      // Validate each vendor
      for (let i = 0; i < vendors.length; i++) {
        const vendor = vendors[i]!;
        const errors: string[] = [];

        // Validate name
        if (!vendor.name || vendor.name.trim().length === 0) {
          errors.push("Name is required");
        } else if (vendor.name.length > 200) {
          errors.push("Name must be less than 200 characters");
        }

        // Validate email if provided
        if (vendor.primaryContactEmail && vendor.primaryContactEmail.trim().length > 0) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(vendor.primaryContactEmail)) {
            errors.push("Invalid email format");
          }
        }

        // Validate risk tier if provided
        if (vendor.riskTier && vendor.riskTier.trim().length > 0) {
          const normalizedTier = vendor.riskTier.toUpperCase().replace(/\s+/g, "_");
          if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(normalizedTier)) {
            errors.push(`Invalid risk tier: ${vendor.riskTier}. Must be Critical, High, Medium, or Low`);
          }
        }

        // Validate category length
        if (vendor.category && vendor.category.length > 100) {
          errors.push("Category must be less than 100 characters");
        }

        // Validate contact name length
        if (vendor.primaryContactName && vendor.primaryContactName.length > 100) {
          errors.push("Contact name must be less than 100 characters");
        }

        // Validate notes length
        if (vendor.notes && vendor.notes.length > 2000) {
          errors.push("Notes must be less than 2000 characters");
        }

        validationResults.push({
          row: i + 1,
          data: vendor,
          errors,
          isValid: errors.length === 0,
        });
      }

      const validCount = validationResults.filter(r => r.isValid).length;
      const errorCount = validationResults.filter(r => !r.isValid).length;

      return {
        totalRows: vendors.length,
        validCount,
        errorCount,
        results: validationResults,
        canImport: errorCount === 0 && validCount > 0,
      };
    }),

  /**
   * Bulk import vendors (FR59, FR60)
   *
   * Epic 7: Migration & Reporting
   * Creates vendors from validated import data
   */
  bulkImport: organizationProcedure
    .use(requireRole(VENDOR_MANAGE_ROLES))
    .input(z.object({
      vendors: z.array(z.object({
        name: z.string().min(1).max(200),
        category: z.string().max(100).optional(),
        primaryContactName: z.string().max(100).optional(),
        primaryContactEmail: z.string().email().optional().or(z.literal("")),
        riskTier: z.string().optional(),
        notes: z.string().max(2000).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;
      const { vendors } = input;

      const createdVendors: Array<{ id: string; identifier: string; name: string }> = [];
      const errors: Array<{ row: number; name: string; error: string }> = [];

      // Create vendors one by one to generate sequential identifiers
      for (let i = 0; i < vendors.length; i++) {
        const vendorData = vendors[i]!;
        try {
          // Generate sequential identifier (FR60)
          const identifier = await generateIdentifier(organizationId, "VND");

          // Normalize risk tier
          let riskTier: VendorRiskTier | null = null;
          if (vendorData.riskTier && vendorData.riskTier.trim().length > 0) {
            const normalizedTier = vendorData.riskTier.toUpperCase().replace(/\s+/g, "_");
            if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(normalizedTier)) {
              riskTier = normalizedTier as VendorRiskTier;
            }
          }

          // Calculate next review date if tier is set
          const nextReviewDate = riskTier ? calculateNextReviewDate(riskTier) : null;

          // Create vendor
          const vendor = await ctx.db.vendor.create({
            data: {
              identifier,
              organizationId,
              name: vendorData.name.trim(),
              category: vendorData.category?.trim() || null,
              primaryContactName: vendorData.primaryContactName?.trim() || null,
              primaryContactEmail: vendorData.primaryContactEmail?.trim() || null,
              riskTier,
              nextReviewDate,
              notes: vendorData.notes?.trim() || null,
              createdById: userId,
              status: VendorStatus.ACTIVE,
            },
          });

          createdVendors.push({
            id: vendor.id,
            identifier: vendor.identifier,
            name: vendor.name,
          });
        } catch (error) {
          errors.push({
            row: i + 1,
            name: vendorData.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Audit log for bulk import
      if (createdVendors.length > 0) {
        void createAuditLog({
          organizationId,
          userId,
          action: AuditAction.VENDOR_CREATED,
          entityType: "Vendor",
          entityId: "bulk-import",
          changes: {
            before: null,
            after: {
              action: "bulk_import",
              importedCount: createdVendors.length,
              vendors: createdVendors.map(v => v.identifier),
            },
          },
        });
      }

      return {
        success: errors.length === 0,
        importedCount: createdVendors.length,
        errorCount: errors.length,
        vendors: createdVendors,
        errors,
      };
    }),

  /**
   * Export vendors to CSV (FR54)
   *
   * Epic 7: Migration & Reporting
   * Returns vendor data formatted for CSV export
   */
  exportToCSV: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(z.object({
      // Optional filters
      status: z.array(z.nativeEnum(VendorStatus)).optional(),
      riskTier: z.array(z.nativeEnum(VendorRiskTier)).optional(),
      businessUnitId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Build where clause
      const where: Prisma.VendorWhereInput = { organizationId };
      if (input?.status && input.status.length > 0) {
        where.status = { in: input.status };
      }
      if (input?.riskTier && input.riskTier.length > 0) {
        where.riskTier = { in: input.riskTier };
      }
      if (input?.businessUnitId) {
        where.businessUnitId = input.businessUnitId;
      }

      const vendors = await ctx.db.vendor.findMany({
        where,
        orderBy: { identifier: "asc" },
        include: {
          businessUnit: { select: { name: true } },
          itOwner: { select: { name: true, email: true } },
          businessOwner: { select: { name: true, email: true } },
        },
      });

      // Format for CSV export
      const csvData = vendors.map(v => ({
        identifier: v.identifier,
        name: v.name,
        category: v.category || "",
        status: v.status,
        riskTier: v.riskTier || "",
        businessUnit: v.businessUnit?.name || "",
        primaryContactName: v.primaryContactName || "",
        primaryContactEmail: v.primaryContactEmail || "",
        itOwner: v.itOwner?.name || "",
        itOwnerEmail: v.itOwner?.email || "",
        businessOwner: v.businessOwner?.name || "",
        businessOwnerEmail: v.businessOwner?.email || "",
        nextReviewDate: v.nextReviewDate ? v.nextReviewDate.toISOString().split("T")[0] : "",
        notes: v.notes || "",
        createdAt: v.createdAt.toISOString().split("T")[0],
      }));

      return {
        headers: [
          "Identifier",
          "Name",
          "Category",
          "Status",
          "Risk Tier",
          "Business Unit",
          "Primary Contact Name",
          "Primary Contact Email",
          "IT Owner",
          "IT Owner Email",
          "Business Owner",
          "Business Owner Email",
          "Next Review Date",
          "Notes",
          "Created Date",
        ],
        data: csvData,
        totalCount: csvData.length,
      };
    }),

  /**
   * Compare vendors side by side (FR52)
   * Returns detailed comparison data for selected vendors
   */
  compareVendors: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(
      z.object({
        vendorIds: z.array(z.string()).min(2).max(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const vendors = await ctx.db.vendor.findMany({
        where: {
          id: { in: input.vendorIds },
          organizationId,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
          assessments: {
            include: {
              questionnaires: {
                select: {
                  id: true,
                  status: true,
                  completedAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          findings: {
            select: {
              id: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      // Build comparison data for each vendor
      const comparisonData = vendors.map((vendor) => {
        // Calculate assessment metrics
        const totalAssessments = vendor.assessments.length;
        const completedAssessments = vendor.assessments.filter(
          (a) => a.status === VendorAssessmentStatus.COMPLETED
        ).length;
        const latestAssessment = vendor.assessments[0];

        // Calculate finding metrics
        // Open statuses: NEW, NEEDS_INFO, TRIAGED
        // Closed statuses: REJECTED, CLOSED, DUPLICATE
        const openStatuses: FindingStatus[] = [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED];
        const closedStatuses: FindingStatus[] = [FindingStatus.REJECTED, FindingStatus.CLOSED, FindingStatus.DUPLICATE];

        const openFindings = vendor.findings.filter(
          (f) => openStatuses.includes(f.status)
        ).length;
        const highFindings = vendor.findings.filter(
          (f) =>
            f.severity === Severity.HIGH &&
            openStatuses.includes(f.status)
        ).length;
        const mediumFindings = vendor.findings.filter(
          (f) =>
            f.severity === Severity.MEDIUM &&
            openStatuses.includes(f.status)
        ).length;
        const totalFindings = vendor.findings.length;
        const closedFindings = vendor.findings.filter(
          (f) => closedStatuses.includes(f.status)
        ).length;

        // Calculate questionnaire completion rate
        const allQuestionnaires = vendor.assessments.flatMap((a) => a.questionnaires);
        const completedQuestionnaires = allQuestionnaires.filter(
          (q) => q.status === "COMPLETED"
        ).length;
        const questionnaireCompletionRate =
          allQuestionnaires.length > 0
            ? Math.round((completedQuestionnaires / allQuestionnaires.length) * 100)
            : 0;

        return {
          id: vendor.id,
          identifier: vendor.identifier,
          name: vendor.name,
          category: vendor.category,
          status: vendor.status,
          riskTier: vendor.riskTier,
          businessUnit: vendor.businessUnit?.name ?? null,
          itOwner: vendor.itOwner?.name ?? null,
          businessOwner: vendor.businessOwner?.name ?? null,
          nextReviewDate: vendor.nextReviewDate,
          createdAt: vendor.createdAt,
          metrics: {
            assessments: {
              total: totalAssessments,
              completed: completedAssessments,
              completionRate:
                totalAssessments > 0
                  ? Math.round((completedAssessments / totalAssessments) * 100)
                  : 0,
              latestDate: latestAssessment?.createdAt ?? null,
              latestStatus: latestAssessment?.status ?? null,
            },
            findings: {
              total: totalFindings,
              open: openFindings,
              closed: closedFindings,
              high: highFindings,
              medium: mediumFindings,
              closureRate:
                totalFindings > 0 ? Math.round((closedFindings / totalFindings) * 100) : 100,
            },
            questionnaires: {
              total: allQuestionnaires.length,
              completed: completedQuestionnaires,
              completionRate: questionnaireCompletionRate,
            },
          },
        };
      });

      return {
        vendors: comparisonData,
        comparedAt: new Date(),
      };
    }),

  /**
   * Export vendor evidence package for audits (FR53)
   * Returns comprehensive vendor data including assessments, questionnaires, and findings
   */
  exportEvidencePackage: organizationProcedure
    .use(requireRole(VENDOR_VIEW_ROLES))
    .input(
      z.object({
        vendorId: z.string(),
        includeAssessments: z.boolean().default(true),
        includeQuestionnaires: z.boolean().default(true),
        includeFindings: z.boolean().default(true),
        includeDocuments: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Get vendor with all related data - always include all for evidence package
      const vendor = await ctx.db.vendor.findFirst({
        where: {
          id: input.vendorId,
          organizationId,
        },
        include: {
          businessUnit: { select: { id: true, name: true } },
          itOwner: { select: { id: true, name: true, email: true } },
          businessOwner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          assessments: {
            include: {
              questionnaires: {
                include: {
                  template: {
                    select: { id: true, name: true, description: true },
                  },
                  responses: {
                    include: {
                      question: {
                        select: {
                          id: true,
                          questionText: true,
                          questionType: true,
                          isRequired: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          findings: {
            include: {
              creator: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      // Get organization info for the package
      const organization = await ctx.db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      // Build the evidence package
      const evidencePackage = {
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: ctx.session?.user?.name ?? "Unknown",
          organizationName: organization?.name ?? "Unknown",
          packageVersion: "1.0",
        },
        vendor: {
          id: vendor.id,
          identifier: vendor.identifier,
          name: vendor.name,
          category: vendor.category,
          status: vendor.status,
          riskTier: vendor.riskTier,
          primaryContactName: vendor.primaryContactName,
          primaryContactEmail: vendor.primaryContactEmail,
          businessUnit: vendor.businessUnit?.name ?? null,
          itOwner: vendor.itOwner
            ? { name: vendor.itOwner.name, email: vendor.itOwner.email }
            : null,
          businessOwner: vendor.businessOwner
            ? { name: vendor.businessOwner.name, email: vendor.businessOwner.email }
            : null,
          nextReviewDate: vendor.nextReviewDate?.toISOString() ?? null,
          notes: vendor.notes,
          createdAt: vendor.createdAt.toISOString(),
          createdBy: vendor.createdBy?.name ?? null,
        },
        assessments: input.includeAssessments
          ? vendor.assessments.map((assessment) => ({
              id: assessment.id,
              identifier: assessment.identifier,
              title: assessment.title,
              status: assessment.status,
              dueDate: assessment.dueDate?.toISOString() ?? null,
              completedAt: assessment.completedAt?.toISOString() ?? null,
              summary: assessment.summary,
              riskScore: assessment.riskScore,
              recommendation: assessment.recommendation,
              assessorId: assessment.assessorId,
              createdById: assessment.createdById,
              createdAt: assessment.createdAt.toISOString(),
              questionnaires: input.includeQuestionnaires
                ? assessment.questionnaires.map((q) => ({
                    id: q.id,
                    templateName: q.template.name,
                    status: q.status,
                    sentAt: q.sentAt?.toISOString() ?? null,
                    viewedAt: q.viewedAt?.toISOString() ?? null,
                    completedAt: q.completedAt?.toISOString() ?? null,
                    responses: q.responses.map((r) => ({
                      questionText: r.question.questionText,
                      questionType: r.question.questionType,
                      isRequired: r.question.isRequired,
                      textResponse: r.textResponse,
                      selectedChoiceId: r.selectedChoiceId,
                      isPreFilled: r.isPreFilled,
                      wasModified: r.wasModified,
                    })),
                  }))
                : [],
            }))
          : [],
        findings: input.includeFindings
          ? vendor.findings.map((finding) => ({
              id: finding.id,
              identifier: finding.identifier,
              title: finding.title,
              description: finding.description,
              severity: finding.severity,
              status: finding.status,
              source: finding.source,
              affectedAssets: finding.affectedAssets,
              createdBy: finding.creator?.name ?? null,
              createdAt: finding.createdAt.toISOString(),
            }))
          : [],
        summary: {
          totalAssessments: input.includeAssessments && vendor.assessments
            ? vendor.assessments.length
            : 0,
          completedAssessments: input.includeAssessments && vendor.assessments
            ? vendor.assessments.filter((a) => a.status === VendorAssessmentStatus.COMPLETED).length
            : 0,
          totalFindings: input.includeFindings && vendor.findings
            ? vendor.findings.length
            : 0,
          openFindings: input.includeFindings
            ? vendor.findings.filter((f) =>
                ([FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] as FindingStatus[]).includes(f.status)
              ).length
            : 0,
          highSeverityFindings: input.includeFindings && vendor.findings
            ? vendor.findings.filter((f) => f.severity === Severity.HIGH).length
            : 0,
        },
      };

      return evidencePackage;
    }),
});
