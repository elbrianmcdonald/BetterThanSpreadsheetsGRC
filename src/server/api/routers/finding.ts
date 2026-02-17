/**
 * Finding Router
 *
 * tRPC router for finding management operations including creation and triage.
 *
 * Story 7.2: Finding Creation Form
 * - create mutation
 *
 * Story 7.3: Finding Triage Workflow
 * - transition mutation
 * - search query
 *
 * @see Story 7.2: Finding Creation Form
 * @see Story 7.3: Finding Triage Workflow
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, FindingSource, Severity, AuditAction, FindingStatus, AssessmentStatus, Prisma } from "@prisma/client";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import { generateIdentifier } from "@/server/services/identifierService";
import { createAuditLog } from "@/server/services/audit-log.service";
import { assertFindingTransition } from "@/server/services/findingStateMachine";
import {
  formatFindingsForCSV,
  generateFindingsExportFilename,
  type FindingExportData,
} from "@/lib/csvFormatter";

/**
 * Roles that can create findings (Story 7.2 AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const FINDING_CREATE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can triage findings (Story 7.3 AC29)
 * - Security Engineer
 * - GRC Analyst
 * - Org Admin
 */
const FINDING_TRIAGE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Create Finding Input Schema (Story 7.2 AC24)
 * Validates input for finding creation with proper constraints
 */
const createFindingInput = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(500, "Title must be less than 500 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters"),
  source: z.nativeEnum(FindingSource),
  severity: z.nativeEnum(Severity),
  affectedAssets: z.array(z.string()).optional().default([]),
  affectedBusinessUnitIds: z.array(z.string()).optional().default([]),
  assigneeId: z.string().optional(),
});

/**
 * Transition Finding Input Schema (Story 7.3 AC7)
 * Validates input for finding status transition
 */
const transitionFindingInput = z.object({
  findingId: z.string(),
  targetStatus: z.nativeEnum(FindingStatus),
  duplicateOfId: z.string().optional(), // Required when targetStatus is DUPLICATE (AC11)
  rejectionReason: z.string().max(500).optional(), // Optional for REJECTED (AC24)
});

/**
 * Search Finding Input Schema (Story 7.3 AC20)
 * For duplicate finder modal
 */
const searchFindingInput = z.object({
  query: z.string().min(1),
  excludeId: z.string().optional(),
});

/**
 * List Finding Input Schema (Story 7.12)
 * Supports filtering, sorting, and cursor-based pagination
 */
const listFindingInput = z.object({
  // Filters (AC13-AC16)
  status: z.array(z.nativeEnum(FindingStatus)).optional(),
  source: z.array(z.nativeEnum(FindingSource)).optional(),
  severity: z.array(z.nativeEnum(Severity)).optional(),
  search: z.string().optional(),
  // Sorting (AC19-AC21)
  sortBy: z.enum(["identifier", "title", "severity", "status", "createdAt"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  // Pagination (AC22-AC25)
  limit: z.number().min(1).max(100).optional().default(25),
  cursor: z.string().optional(),
});

export const findingRouter = createTRPCRouter({
  /**
   * Get a finding by ID with all related data
   *
   * Story 7.11: Finding Detail Page
   * AC1-AC6: Page fetches finding with related assessment
   * Returns finding with:
   * - Creator, assignee, triager, accepter info
   * - Affected business units
   * - Risk assessment (if status = ACCEPTED)
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const finding = await ctx.db.finding.findFirst({
        where: {
          id: input.id,
          organizationId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          triager: { select: { id: true, name: true, email: true } },
          accepter: { select: { id: true, name: true, email: true } },
          affectedBusinessUnits: { select: { id: true, name: true } },
          duplicateOf: { select: { id: true, identifier: true, title: true } },
          riskAssessment: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
              scenarios: { select: { id: true, description: true } },
              // Story 7.9: Include approval info for AssessmentActions
              riskRegisterEntry: { select: { id: true, identifier: true, status: true } },
            },
          },
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      return finding;
    }),

  /**
   * List findings with filtering, sorting, and pagination
   *
   * Story 7.12: Findings List Page
   * AC5: Returns findings with required columns
   * AC13-AC16: Status, source, severity, search filters
   * AC19-AC21: Sorting by multiple columns
   * AC22-AC25: Cursor-based pagination
   */
  list: organizationProcedure
    .input(listFindingInput)
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { status, source, severity, search, sortBy, sortOrder, limit, cursor } = input;

      // Build where clause with filters
      const where: Prisma.FindingWhereInput = {
        organizationId,
        ...(status && status.length > 0 && { status: { in: status } }),
        ...(source && source.length > 0 && { source: { in: source } }),
        ...(severity && severity.length > 0 && { severity: { in: severity } }),
        ...(search && {
          OR: [
            { identifier: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      // Build orderBy clause
      const orderBy: Prisma.FindingOrderByWithRelationInput = {
        [sortBy!]: sortOrder,
      };

      // Get total count for pagination info
      const totalCount = await ctx.db.finding.count({ where });

      // Fetch findings with cursor-based pagination
      // Returns all displayable fields for column customization
      const findings = await ctx.db.finding.findMany({
        where,
        orderBy,
        take: limit! + 1, // Fetch one extra to determine if there's a next page
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          // Core fields
          id: true,
          identifier: true,
          title: true,
          description: true,
          source: true,
          severity: true,
          status: true,
          // Array fields
          affectedAssets: true,
          // Date fields
          createdAt: true,
          updatedAt: true,
          triagedAt: true,
          acceptedAt: true,
          dueDate: true,
          closedAt: true,
          // SLA fields
          slaBreached: true,
          // Duplicate tracking
          duplicateOfId: true,
          // User relations
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          triager: { select: { id: true, name: true, email: true } },
          accepter: { select: { id: true, name: true, email: true } },
          // Business unit relations
          affectedBusinessUnits: { select: { id: true, name: true } },
          // Counts for related items
          _count: {
            select: {
              ControlLinks: true,
              comments: true,
              evidenceLinks: true,
            },
          },
        },
      });

      // Determine if there's a next page
      let nextCursor: string | undefined;
      if (findings.length > limit!) {
        const nextItem = findings.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: findings,
        nextCursor,
        totalCount,
      };
    }),

  /**
   * Create a new finding
   *
   * AC23: `finding.create` mutation defined in finding router
   * AC24: Input validated with Zod schema
   * AC25: Identifier generated via `generateIdentifier(orgId, "FND")`
   * AC26: createdBy set from session user
   * AC27: organizationId set from session user
   * AC28: Returns created finding with id and identifier
   * AC29: SecurityOrg role members can create findings
   * AC32-AC33: Finding creation logged with action FINDING_CREATED
   */
  create: organizationProcedure
    .use(requireRole(FINDING_CREATE_ROLES))
    .input(createFindingInput)
    .mutation(async ({ ctx, input }) => {
      const { affectedBusinessUnitIds, assigneeId, ...findingData } = input;

      // organizationProcedure guarantees session and organizationId are non-null
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // AC25: Generate sequential identifier
      const identifier = await generateIdentifier(organizationId, "FND");

      // Validate BUs are in same organization (if provided)
      if (affectedBusinessUnitIds && affectedBusinessUnitIds.length > 0) {
        const validBUs = await ctx.db.businessUnit.count({
          where: {
            id: { in: affectedBusinessUnitIds },
            organizationId,
          },
        });
        if (validBUs !== affectedBusinessUnitIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit(s) - must be in same organization",
          });
        }
      }

      // Validate assignee is in same organization (if provided)
      if (assigneeId) {
        const validAssignee = await ctx.db.user.findFirst({
          where: {
            id: assigneeId,
            organizationId,
          },
        });
        if (!validAssignee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assignee - must be in same organization",
          });
        }
      }

      // AC22, AC26, AC27: Create finding with status NEW, createdBy and organizationId from session
      const finding = await ctx.db.finding.create({
        data: {
          ...findingData,
          identifier,
          organizationId,
          createdBy: userId,
          status: "NEW",
          assigneeId: assigneeId ?? null,
          affectedBusinessUnits: affectedBusinessUnitIds?.length
            ? { connect: affectedBusinessUnitIds.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          affectedBusinessUnits: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      // AC32-AC33: Audit log finding creation
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_CREATED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: null,
          after: {
            identifier: finding.identifier,
            title: finding.title,
            source: finding.source,
            severity: finding.severity,
            assigneeId: finding.assigneeId,
            affectedBusinessUnits: finding.affectedBusinessUnits.map((bu) => bu.id),
          },
        },
      });

      // AC28: Return created finding with id and identifier
      return finding;
    }),

  /**
   * Transition a finding to a new status
   *
   * Story 7.3: Finding Triage Workflow
   * AC7: `finding.transition` mutation accepts findingId and targetStatus
   * AC8: Mutation validates state transition is allowed
   * AC9: Mutation updates finding status and timestamp fields
   * AC10: TRIAGED transition sets triagedBy and triagedAt
   * AC11: DUPLICATE transition requires duplicateOfId parameter
   * AC12: Returns updated finding
   * AC29: Only SecurityOrg role members can triage findings
   * AC31-AC33: Audit logging with FINDING_TRANSITIONED action
   */
  transition: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(transitionFindingInput)
    .mutation(async ({ ctx, input }) => {
      const { findingId, targetStatus, duplicateOfId, rejectionReason } = input;
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch finding and validate organization ownership
      const finding = await ctx.db.finding.findFirst({
        where: { id: findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      // AC8: Validate state transition is allowed
      assertFindingTransition(finding.status, targetStatus);

      // Build update data based on target status
      const updateData: Prisma.FindingUpdateInput = {
        status: targetStatus,
      };

      // AC10: TRIAGED transition sets triagedBy and triagedAt
      if (targetStatus === FindingStatus.TRIAGED) {
        updateData.triager = { connect: { id: userId } };
        updateData.triagedAt = new Date();
      }

      // AC11: DUPLICATE transition requires duplicateOfId parameter
      if (targetStatus === FindingStatus.DUPLICATE) {
        if (!duplicateOfId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "duplicateOfId is required when marking as duplicate",
          });
        }
        // Validate duplicate finding exists in same org
        const originalFinding = await ctx.db.finding.findFirst({
          where: { id: duplicateOfId, organizationId },
        });
        if (!originalFinding) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Original finding not found in organization",
          });
        }
        // Prevent self-reference
        if (duplicateOfId === findingId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A finding cannot be a duplicate of itself",
          });
        }
        updateData.duplicateOf = { connect: { id: duplicateOfId } };
      }

      // AC9, AC12: Update finding status and return result
      const updated = await ctx.db.finding.update({
        where: { id: findingId },
        data: updateData,
        include: {
          affectedBusinessUnits: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          duplicateOf: { select: { id: true, identifier: true, title: true } },
        },
      });

      // AC31-AC33: Audit log finding transition
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_TRANSITIONED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: { status: finding.status },
          after: {
            status: targetStatus,
            ...(duplicateOfId && { duplicateOfId }),
            ...(rejectionReason && { rejectionReason }),
          },
        },
      });

      return updated;
    }),

  /**
   * Search for findings (for duplicate finder modal)
   *
   * Story 7.3: Finding Triage Workflow
   * AC19: "Mark Duplicate" opens modal to search/select original finding
   * AC20: Search finds findings by identifier or title (within organization)
   */
  search: organizationProcedure
    .input(searchFindingInput)
    .query(async ({ ctx, input }) => {
      const { query, excludeId } = input;
      const organizationId = ctx.organizationId!;

      return ctx.db.finding.findMany({
        where: {
          organizationId,
          ...(excludeId && { id: { not: excludeId } }),
          OR: [
            { identifier: { startsWith: query.toUpperCase() } },
            { title: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          title: true,
          status: true,
          severity: true,
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Accept a triaged finding and create a Risk Assessment
   *
   * Story 7.4: Finding Acceptance (Creates Risk Assessment)
   * AC1: `finding.accept` mutation defined in finding router
   * AC2: Mutation validates finding is in TRIAGED status
   * AC3: Mutation creates locked snapshot of finding fields
   * AC4: Mutation transitions finding to ACCEPTED status
   * AC5: Mutation sets acceptedBy and acceptedAt
   * AC6: Mutation generates RSK identifier for assessment
   * AC7: Mutation creates RiskAssessment in DRAFT status
   * AC8: Operation is transactional (all or nothing)
   * AC9: lockedSnapshot stores required fields
   * AC13-AC18: Risk Assessment pre-populated from finding
   * AC26-AC27: Returns both finding and assessment
   * AC28-AC29: Role-based access control
   * AC30-AC32: Audit logging for both entities
   *
   * Story 7.8.9: Assessment Form Matrix Integration (AC27-AC30)
   * AC27: When finding accepted, assessment created with org's default matrix
   * AC28: Default assessment type pre-selected
   * AC29: Analyst can change type and matrix on draft assessment
   * AC30: Once approved, matrix version permanently locked
   */
  accept: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES)) // AC28: GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN
    .input(z.object({ findingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // AC1: Fetch finding with business units for snapshot
      const finding = await ctx.db.finding.findFirst({
        where: {
          id: input.findingId,
          organizationId,
        },
        include: {
          affectedBusinessUnits: { select: { id: true } },
        },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      // AC2: Validate finding is in TRIAGED status
      assertFindingTransition(finding.status, FindingStatus.ACCEPTED);

      // AC3, AC9: Create locked snapshot of finding fields
      const lockedSnapshot = {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        affectedAssets: finding.affectedAssets,
        businessUnits: finding.affectedBusinessUnits.map((bu) => bu.id),
        source: finding.source,
        snapshotAt: new Date().toISOString(),
      };

      // AC6: Generate RSK identifier for assessment
      const assessmentIdentifier = await generateIdentifier(organizationId, "RSK");

      // Story 7.8.9 AC27-AC28: Get organization's default assessment type and matrix
      const defaultAssessmentType = await ctx.db.assessmentType.findFirst({
        where: {
          organizationId,
          isDefault: true,
          isActive: true,
        },
        select: { id: true },
      });

      const defaultMatrixTemplate = await ctx.db.riskMatrixTemplate.findFirst({
        where: {
          organizationId,
          isDefault: true,
          isActive: true,
          currentVersionId: { not: null },
        },
        select: { currentVersionId: true },
      });

      // AC8: Wrap in transaction for atomicity
      return ctx.db.$transaction(async (tx) => {
        // AC4, AC5: Update finding with status, acceptedBy, acceptedAt, lockedSnapshot
        const updatedFinding = await tx.finding.update({
          where: { id: input.findingId },
          data: {
            status: FindingStatus.ACCEPTED,
            acceptedBy: userId,
            acceptedAt: new Date(),
            lockedSnapshot,
          },
          include: {
            affectedBusinessUnits: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            creator: { select: { id: true, name: true, email: true } },
            accepter: { select: { id: true, name: true, email: true } },
          },
        });

        // AC7, AC13-AC18: Create Risk Assessment with pre-populated fields
        // Story 7.8.9 AC27-AC28: Include default assessment type and matrix version
        const assessment = await tx.riskAssessment.create({
          data: {
            identifier: assessmentIdentifier,
            organizationId,
            findingId: input.findingId,
            createdBy: userId,
            // AC13: Title copied from finding
            title: finding.title,
            // AC14: Context copied from description
            context: finding.description,
            // AC15: affectedSystems copied from affectedAssets
            affectedSystems: finding.affectedAssets,
            // AC16: Status = DRAFT
            status: AssessmentStatus.DRAFT,
            // Story 7.8.9 AC27-AC28: Set defaults (analyst can change while in DRAFT - AC29)
            assessmentTypeId: defaultAssessmentType?.id ?? null,
            matrixVersionId: defaultMatrixTemplate?.currentVersionId ?? null,
          },
        });

        // AC30-AC32: Audit logging for both entities
        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            organizationId,
            userId,
            action: AuditAction.FINDING_ACCEPTED,
            entityType: "Finding",
            entityId: finding.id,
            changes: {
              findingId: finding.id,
              findingIdentifier: finding.identifier,
              assessmentId: assessment.id,
              assessmentIdentifier: assessment.identifier,
              lockedSnapshot,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            organizationId,
            userId,
            action: AuditAction.ASSESSMENT_CREATED,
            entityType: "RiskAssessment",
            entityId: assessment.id,
            changes: {
              assessmentId: assessment.id,
              identifier: assessment.identifier,
              findingId: finding.id,
              findingIdentifier: finding.identifier,
              prePopulatedFrom: {
                title: finding.title,
                description: finding.description,
                affectedAssets: finding.affectedAssets,
              },
            },
          },
        });

        // AC26-AC27: Return both finding and assessment
        return {
          finding: updatedFinding,
          assessment: {
            id: assessment.id,
            identifier: assessment.identifier,
            title: assessment.title,
            status: assessment.status,
          },
        };
      });
    }),

  // ============================================================================
  // Story 14.5: Finding Comments & Collaboration
  // ============================================================================

  /**
   * Add a comment to a finding
   *
   * Story 14.5: Finding Comments
   * AC1: Any stakeholder can add comments
   * AC3: Comments displayed in chronological order
   */
  addComment: organizationProcedure
    .input(z.object({
      findingId: z.string(),
      content: z.string().min(1, "Comment cannot be empty").max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify finding exists in organization
      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      const comment = await ctx.db.findingComment.create({
        data: {
          organizationId,
          findingId: input.findingId,
          userId,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return comment;
    }),

  /**
   * Get comments for a finding
   *
   * Story 14.5: Finding Comments
   * AC3: Comments displayed in chronological order
   * AC4: Shows commenter name and timestamp
   */
  getComments: organizationProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      return ctx.db.findingComment.findMany({
        where: {
          findingId: input.findingId,
          organizationId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Update a comment (author only)
   *
   * Story 14.5: Finding Comments
   * AC5: Edit own comments
   */
  updateComment: organizationProcedure
    .input(z.object({
      commentId: z.string(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const comment = await ctx.db.findingComment.findFirst({
        where: {
          id: input.commentId,
          organizationId,
          userId, // Can only edit own comments
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found or you cannot edit it",
        });
      }

      return ctx.db.findingComment.update({
        where: { id: input.commentId },
        data: { content: input.content },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    }),

  /**
   * Delete a comment (author only)
   *
   * Story 14.5: Finding Comments
   * AC5: Delete own comments
   */
  deleteComment: organizationProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      const comment = await ctx.db.findingComment.findFirst({
        where: {
          id: input.commentId,
          organizationId,
          userId,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found or you cannot delete it",
        });
      }

      await ctx.db.findingComment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),

  // ============================================================================
  // Story 14.6: Finding Evidence Attachment
  // ============================================================================

  /**
   * Attach evidence to a finding
   *
   * Story 14.6: Finding Evidence
   * AC2: Can attach existing evidence from repository
   */
  attachEvidence: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      evidenceId: z.string(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Verify finding exists
      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      // Verify evidence exists
      const evidence = await ctx.db.evidence.findFirst({
        where: { id: input.evidenceId, organizationId },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Create attachment
      const attachment = await ctx.db.findingEvidence.create({
        data: {
          organizationId,
          findingId: input.findingId,
          evidenceId: input.evidenceId,
          attachedById: userId,
          notes: input.notes,
        },
        include: {
          evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileType: true,
              createdAt: true,
            },
          },
          attachedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return attachment;
    }),

  /**
   * Get evidence attached to a finding
   *
   * Story 14.6: Finding Evidence
   * AC4: Evidence list shows file name, upload date, uploader
   */
  getEvidence: organizationProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      return ctx.db.findingEvidence.findMany({
        where: {
          findingId: input.findingId,
          organizationId,
        },
        include: {
          evidence: {
            select: {
              id: true,
              title: true,
              originalFileName: true,
              fileType: true,
              fileSize: true,
              createdAt: true,
            },
          },
          attachedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { attachedAt: "desc" },
      });
    }),

  /**
   * Remove evidence attachment from a finding
   *
   * Story 14.6: Finding Evidence
   * AC5: Remove attachment action
   */
  removeEvidence: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      evidenceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const attachment = await ctx.db.findingEvidence.findFirst({
        where: {
          findingId: input.findingId,
          evidenceId: input.evidenceId,
          organizationId,
        },
      });

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence attachment not found",
        });
      }

      await ctx.db.findingEvidence.delete({
        where: { id: attachment.id },
      });

      return { success: true };
    }),

  // ============================================================================
  // Story 14.7: Finding SLA Tracking
  // ============================================================================

  /**
   * Update finding with due date for SLA tracking
   *
   * Story 14.7: Finding SLA
   * AC1: Due date field on finding
   */
  updateDueDate: organizationProcedure
    .use(requireRole(FINDING_TRIAGE_ROLES))
    .input(z.object({
      findingId: z.string(),
      dueDate: z.date().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      const finding = await ctx.db.finding.findFirst({
        where: { id: input.findingId, organizationId },
      });

      if (!finding) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found",
        });
      }

      return ctx.db.finding.update({
        where: { id: input.findingId },
        data: { dueDate: input.dueDate },
      });
    }),

  /**
   * Get findings with SLA status
   *
   * Story 14.7: Finding SLA
   * AC2: SLA status calculated (On Track, At Risk, Breached)
   */
  getWithSlaStatus: organizationProcedure
    .input(z.object({
      slaStatus: z.enum(["on_track", "at_risk", "breached"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Build where clause based on SLA status filter
      let whereClause: Prisma.FindingWhereInput = {
        organizationId,
        status: { in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO] },
        dueDate: { not: null },
      };

      if (input.slaStatus === "breached") {
        whereClause = {
          ...whereClause,
          OR: [
            { slaBreached: true },
            { dueDate: { lt: now } },
          ],
        };
      } else if (input.slaStatus === "at_risk") {
        whereClause = {
          ...whereClause,
          dueDate: { gte: now, lte: threeDaysFromNow },
          slaBreached: false,
        };
      } else if (input.slaStatus === "on_track") {
        whereClause = {
          ...whereClause,
          dueDate: { gt: threeDaysFromNow },
          slaBreached: false,
        };
      }

      return ctx.db.finding.findMany({
        where: whereClause,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { dueDate: "asc" },
      });
    }),

  /**
   * Mark SLA as breached (for cron job)
   *
   * Story 14.8: SLA Breach Detection
   * AC2: Updates slaBreached = true for overdue findings
   */
  markSlaBreach: organizationProcedure
    .use(requireRole([UserRole.ORG_ADMIN]))
    .mutation(async ({ ctx }) => {
      const now = new Date();

      // Find all non-closed findings that are past due and not yet marked breached
      const result = await ctx.db.finding.updateMany({
        where: {
          status: { in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO] },
          dueDate: { lt: now },
          slaBreached: false,
        },
        data: { slaBreached: true },
      });

      return { breachedCount: result.count };
    }),

  /**
   * Get findings summary statistics
   *
   * Returns aggregate stats for the Findings Register dashboard:
   * - Total open findings count (NEW, NEEDS_INFO, TRIAGED)
   * - Severity distribution
   * - Source distribution
   * - Status breakdown
   */
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId!;

    // Count open findings by status
    const [newCount, needsInfoCount, triagedCount, acceptedCount, rejectedCount, duplicateCount] =
      await Promise.all([
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.NEW },
        }),
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.NEEDS_INFO },
        }),
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.TRIAGED },
        }),
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.ACCEPTED },
        }),
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.REJECTED },
        }),
        ctx.db.finding.count({
          where: { organizationId, status: FindingStatus.DUPLICATE },
        }),
      ]);

    // Severity distribution for open findings (not resolved)
    const [highCount, mediumCount, lowCount] = await Promise.all([
      ctx.db.finding.count({
        where: {
          organizationId,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.HIGH,
        },
      }),
      ctx.db.finding.count({
        where: {
          organizationId,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.MEDIUM,
        },
      }),
      ctx.db.finding.count({
        where: {
          organizationId,
          status: { in: [FindingStatus.NEW, FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED] },
          severity: Severity.LOW,
        },
      }),
    ]);

    const openCount = newCount + needsInfoCount + triagedCount;

    return {
      openCount,
      statusDistribution: {
        NEW: newCount,
        NEEDS_INFO: needsInfoCount,
        TRIAGED: triagedCount,
        ACCEPTED: acceptedCount,
        REJECTED: rejectedCount,
        DUPLICATE: duplicateCount,
      },
      severityDistribution: {
        HIGH: highCount,
        MEDIUM: mediumCount,
        LOW: lowCount,
      },
    };
  }),

  /**
   * Export findings to CSV
   *
   * Generates a CSV file with all findings matching the current filters.
   */
  exportFindings: organizationProcedure
    .use(
      requireRole([
        UserRole.GRC_ANALYST,
        UserRole.SECURITY_ENGINEER,
        UserRole.ORG_ADMIN,
        UserRole.AUDITOR,
      ])
    )
    .input(
      z.object({
        status: z.array(z.nativeEnum(FindingStatus)).optional(),
        source: z.array(z.nativeEnum(FindingSource)).optional(),
        severity: z.array(z.nativeEnum(Severity)).optional(),
        search: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const { status, source, severity, search } = input;

      // Build where clause
      const where: Prisma.FindingWhereInput = {
        organizationId,
        ...(status && status.length > 0 && { status: { in: status } }),
        ...(source && source.length > 0 && { source: { in: source } }),
        ...(severity && severity.length > 0 && { severity: { in: severity } }),
        ...(search && {
          OR: [
            { identifier: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      // Fetch all findings matching filters
      const findings = await ctx.db.finding.findMany({
        where,
        include: {
          creator: { select: { name: true, email: true } },
          assignee: { select: { name: true, email: true } },
          triager: { select: { name: true } },
          accepter: { select: { name: true } },
          affectedBusinessUnits: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Transform to export format
      const exportData: FindingExportData[] = findings.map((finding) => ({
        id: finding.id,
        identifier: finding.identifier,
        title: finding.title,
        description: finding.description,
        source: finding.source,
        severity: finding.severity,
        status: finding.status,
        affectedAssets: finding.affectedAssets,
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt,
        creator: finding.creator,
        assignee: finding.assignee,
        triager: finding.triager,
        accepter: finding.accepter,
        affectedBusinessUnits: finding.affectedBusinessUnits,
        triagedAt: finding.triagedAt,
        acceptedAt: finding.acceptedAt,
      }));

      // Generate CSV
      const csv = formatFindingsForCSV(exportData);
      const filename = generateFindingsExportFilename();

      // Audit log
      void createAuditLog({
        organizationId,
        userId: ctx.session!.user.id,
        action: AuditAction.EXPORT_FINDINGS,
        entityType: "Finding",
        entityId: "CSV_EXPORT",
        changes: {
          before: null,
          after: {
            exportType: "CSV",
            filters: { status, source, severity, search },
            rowCount: findings.length,
            filename,
          },
        },
        actorName: ctx.session!.user.name ?? "Unknown",
        actorRole: ctx.session!.user.role,
      });

      return {
        filename,
        data: csv,
        rowCount: findings.length,
      };
    }),

  /**
   * Create a finding from a questionnaire response
   *
   * Epic 5: Vendor Risk & Finding Integration
   * FR45: Assessor can create a finding directly from a questionnaire response
   * FR46: System links vendor findings to the main Findings register
   * FR50: Finding created from vendor assessment includes source context
   */
  createFromQuestionnaireResponse: organizationProcedure
    .use(requireRole(FINDING_CREATE_ROLES))
    .input(
      z.object({
        questionnaireResponseId: z.string(),
        title: z
          .string()
          .min(5, "Title must be at least 5 characters")
          .max(500, "Title must be less than 500 characters"),
        description: z
          .string()
          .min(20, "Description must be at least 20 characters"),
        severity: z.nativeEnum(Severity),
        affectedAssets: z.array(z.string()).optional().default([]),
        assigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        questionnaireResponseId,
        title,
        description,
        severity,
        affectedAssets,
        assigneeId,
      } = input;
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Fetch the questionnaire response with full context
      const response = await ctx.db.questionnaireResponse.findUnique({
        where: { id: questionnaireResponseId },
        include: {
          question: {
            include: {
              section: {
                include: {
                  template: true,
                },
              },
            },
          },
          questionnaire: {
            include: {
              assessment: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
      });

      if (!response) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire response not found",
        });
      }

      // Validate the assessment belongs to this organization
      if (response.questionnaire.assessment.organizationId !== organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Assessment does not belong to this organization",
        });
      }

      // Check if a finding already exists for this response
      const existingFinding = await ctx.db.finding.findFirst({
        where: { questionnaireResponseId },
      });
      if (existingFinding) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A finding has already been created for this response",
        });
      }

      // Validate assignee if provided
      if (assigneeId) {
        const validAssignee = await ctx.db.user.findFirst({
          where: { id: assigneeId, organizationId },
        });
        if (!validAssignee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid assignee - must be in same organization",
          });
        }
      }

      // Generate identifier
      const identifier = await generateIdentifier(organizationId, "FND");

      // Extract vendor info
      const vendorId = response.questionnaire.assessment.vendor.id;
      const vendorAssessmentId = response.questionnaire.assessment.id;
      const vendorName = response.questionnaire.assessment.vendor.name;
      const questionText = response.question.questionText;

      // Create the finding with vendor context
      const finding = await ctx.db.finding.create({
        data: {
          organizationId,
          identifier,
          title,
          description,
          source: FindingSource.MANUAL, // Questionnaire-sourced findings are treated as manual
          severity,
          status: "NEW",
          affectedAssets,
          createdBy: userId,
          assigneeId: assigneeId ?? null,
          // Epic 5: Vendor integration
          vendorId,
          vendorAssessmentId,
          questionnaireResponseId,
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          vendor: { select: { id: true, name: true, identifier: true } },
          vendorAssessment: { select: { id: true, identifier: true, title: true } },
        },
      });

      // Audit log with vendor context (FR50)
      void createAuditLog({
        organizationId,
        userId,
        action: AuditAction.FINDING_CREATED,
        entityType: "Finding",
        entityId: finding.id,
        changes: {
          before: null,
          after: {
            identifier: finding.identifier,
            title: finding.title,
            severity: finding.severity,
            vendorId,
            vendorAssessmentId,
            questionnaireResponseId,
            sourceContext: {
              vendorName,
              questionText,
              assessmentId: vendorAssessmentId,
              templateName: response.question.section.template.name,
            },
          },
        },
      });

      return finding;
    }),

  /**
   * Get findings linked to a specific vendor
   *
   * Epic 5: FR47 - GRC Analyst can view vendor-related findings on the vendor profile
   */
  getByVendorId: organizationProcedure
    .input(z.object({ vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;

      // Validate vendor exists in org
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: input.vendorId, organizationId },
      });
      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return ctx.db.finding.findMany({
        where: {
          organizationId,
          vendorId: input.vendorId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          vendorAssessment: { select: { id: true, identifier: true, title: true } },
          questionnaireResponse: {
            include: {
              question: { select: { id: true, questionText: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
