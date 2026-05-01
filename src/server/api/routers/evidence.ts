/**
 * Evidence Router - tRPC procedures for evidence management
 *
 * Handles:
 * - Evidence file upload with malware scanning
 * - Evidence listing with pagination and filtering
 * - Evidence metadata updates
 * - Evidence soft deletion and hard deletion
 *
 * @see Story 3.1: Evidence File Upload and Processing
 * @see Story 3.2: File Storage in Docker Volumes
 * @module server/api/routers/evidence
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  requirePermission,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import { createAuditLog } from "@/server/services/audit-log.service";
import { fileUploadService } from "@/server/services/file-upload";
import { fileStorageService } from "@/server/services/file-storage";
import { malwareScannerService } from "@/server/services/malware-scanner";
import { evidenceMappingService } from "@/server/services/evidence-mapping";
import {
  validateFile,
  MAX_FILE_SIZE,
  SUPPORTED_EXTENSIONS,
  formatFileSize,
} from "@/utils/file-validation";
import {
  getAffectedFrameworkIdsForEvidence,
  queueMultipleFrameworkRecalculations,
} from "@/server/services/complianceJobQueue";

/**
 * Extract relative storage path from full file path
 *
 * Converts: /app/uploads/orgId/uuid_filename or ./uploads/orgId/uuid_filename
 * To: orgId/uuid_filename (relative storage path)
 */
function extractStoragePath(filePath: string, organizationId: string): string | null {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Try to find organizationId in the path
  const orgIndex = normalized.indexOf(`/${organizationId}/`);
  if (orgIndex !== -1) {
    return normalized.substring(orgIndex + 1);
  }

  // Try with path segments
  const parts = normalized.split("/");
  const orgPartIndex = parts.findIndex((p) => p === organizationId);

  if (orgPartIndex !== -1) {
    return parts.slice(orgPartIndex).join("/");
  }

  // If path already starts with organizationId, it might be relative
  if (normalized.startsWith(organizationId)) {
    return normalized;
  }

  return null;
}

/**
 * Input schema for evidence upload
 *
 * Story 3.3: Added controlDomainIds for control taxonomy tagging
 * BU-Scoped Compliance: Added businessUnitId for BU-specific evidence
 */
const uploadEvidenceInput = z.object({
  /** Base64 encoded file content */
  fileContent: z.string().min(1, "File content is required"),
  /** Original file name */
  fileName: z.string().min(1, "File name is required").max(255),
  /** MIME type of the file */
  mimeType: z.string().min(1, "MIME type is required"),
  /** User-friendly title for the evidence */
  title: z.string().min(1, "Title is required").max(200),
  /** Optional description */
  description: z.string().max(5000).optional(),
  /**
   * Control domain IDs for tagging (0-5) - Story 3.3.
   * Required in the generic evidence flow; empty is allowed for control-scoped
   * uploads that live entirely under an OrganizationalControl.
   */
  controlDomainIds: z
    .array(z.string())
    .max(5, "Maximum 5 control domains allowed"),
  /** Business Unit ID for BU-scoped compliance (optional during migration) */
  businessUnitId: z.string().optional(),
});

/**
 * Input schema for evidence list query
 *
 * Story 3.3: Added controlDomainId filter for tag-based filtering
 * Story 3.7: Added frameworkCode filter for framework-based filtering
 * Story 3.10: Added date range filter and additional sort fields
 * BU-Scoped Compliance: Added businessUnitId filter
 */
const listEvidenceInput = z.object({
  /** Page number (1-indexed) */
  page: z.number().min(1).default(1),
  /** Items per page - Story 3.10: Default to 50 for TanStack Table */
  pageSize: z.number().min(1).max(100).default(50),
  /** Search query (searches title, description, and filename) - Story 3.10: AC13 */
  search: z.string().optional(),
  /** Filter by isActive status */
  isActive: z.boolean().optional(),
  /** Filter by control domain ID - Story 3.3 */
  controlDomainId: z.string().optional(),
  /** Filter by framework code - Story 3.7 */
  frameworkCode: z.string().optional(),
  /** Filter by business unit ID - BU-Scoped Compliance */
  businessUnitId: z.string().optional(),
  /** Filter by upload date start - Story 3.10: AC16 */
  uploadDateStart: z.date().optional(),
  /** Filter by upload date end - Story 3.10: AC16 */
  uploadDateEnd: z.date().optional(),
  /** Sort by field - Story 3.10: Added originalFileName */
  sortBy: z.enum(["createdAt", "title", "fileSize", "originalFileName"]).default("createdAt"),
  /** Sort direction */
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Input schema for evidence update
 */
const updateEvidenceInput = z.object({
  /** Evidence ID to update */
  id: z.string().uuid(),
  /** New title */
  title: z.string().min(1).max(200).optional(),
  /** New description */
  description: z.string().max(5000).optional(),
});

/**
 * Evidence router definition
 */
export const evidenceRouter = createTRPCRouter({
  /**
   * Upload a new evidence file
   *
   * - Validates file type, size, and MIME type
   * - Performs malware scan (if enabled)
   * - Stores file in organization-specific directory
   * - Creates evidence record in database
   *
   * @requires EVIDENCE_CREATE permission
   */
  upload: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_CREATE))
    .input(uploadEvidenceInput)
    .mutation(async ({ ctx, input }) => {
      // Decode base64 file content
      const fileBuffer = Buffer.from(input.fileContent, "base64");
      const fileSize = fileBuffer.length;

      // Validate file
      const validation = validateFile(input.fileName, fileSize, input.mimeType);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.map((e) => e.message).join("; "),
        });
      }

      // Story 3.3: Validate control domain IDs exist
      const validDomains = await ctx.db.controlDomain.findMany({
        where: {
          id: { in: input.controlDomainIds },
          isActive: true,
        },
        select: { id: true, name: true },
      });

      if (validDomains.length !== input.controlDomainIds.length) {
        const validIds = new Set(validDomains.map((d) => d.id));
        const invalidIds = input.controlDomainIds.filter((id) => !validIds.has(id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid control domain IDs: ${invalidIds.join(", ")}`,
        });
      }

      // Save to temp location for malware scan
      let tempPath: string | null = null;
      try {
        tempPath = await fileUploadService.saveToTemp(fileBuffer, input.fileName);

        // Perform malware scan
        const scanResult = await malwareScannerService.scanFile(tempPath);

        if (scanResult.isInfected) {
          // Log malware detection to audit trail
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "UPLOAD_EVIDENCE",
            entityType: "Evidence",
            entityId: "blocked",
            changes: {
              after: {
                blocked: true,
                reason: "Malware detected",
                viruses: scanResult.viruses,
              },
            },
          });

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File rejected: Malware detected (${scanResult.viruses.join(", ")})`,
          });
        }

        // Move file from temp to permanent storage
        const uploadResult = await fileUploadService.moveFromTemp(
          tempPath,
          ctx.organizationId!,
          input.fileName,
          input.mimeType
        );
        tempPath = null; // Mark as moved (don't delete in finally)

        // Story 3.3: Create evidence with control domain tags in transaction
        const evidence = await ctx.db.$transaction(async (tx) => {
          // Create evidence record
          // BU-Scoped Compliance: Include businessUnitId if provided
          const newEvidence = await tx.evidence.create({
            data: {
              id: randomUUID(),
              title: input.title,
              originalFileName: input.fileName,
              description: input.description,
              filePath: uploadResult.filePath,
              fileSize: uploadResult.fileSize,
              fileType: input.mimeType,
              uploadedBy: ctx.session!.user.id,
              organizationId: ctx.organizationId!,
              businessUnitId: input.businessUnitId ?? null,
              updatedAt: new Date(),
            },
          });

          // Create control domain tags
          await tx.evidenceControlDomain.createMany({
            data: input.controlDomainIds.map((domainId) => ({
              id: randomUUID(),
              evidenceId: newEvidence.id,
              controlDomainId: domainId,
            })),
          });

          // Return evidence with tags included
          return tx.evidence.findUnique({
            where: { id: newEvidence.id },
            include: {
              EvidenceControlDomain: {
                include: {
                  ControlDomain: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
            },
          });
        });

        // Audit log
        await createAuditLog({
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "UPLOAD_EVIDENCE",
          entityType: "Evidence",
          entityId: evidence!.id,
          changes: {
            after: {
              title: input.title,
              fileName: input.fileName,
              fileSize: uploadResult.fileSize,
              mimeType: input.mimeType,
              malwareScanned: scanResult.scanned,
              controlDomains: validDomains.map((d) => d.name),
            },
          },
        });

        // Story 5.3 AC1-AC5: Trigger compliance recalculation for affected frameworks
        // AC2: Runs asynchronously (doesn't slow down evidence upload)
        // AC3: Only affected frameworks recalculated
        void (async () => {
          try {
            const affectedFrameworkIds = await getAffectedFrameworkIdsForEvidence(
              evidence!.id,
              ctx.db
            );
            if (affectedFrameworkIds.length > 0) {
              // AC5: Jobs are debounced to avoid excessive recalculation
              queueMultipleFrameworkRecalculations(
                affectedFrameworkIds,
                ctx.organizationId!,
                "evidence_upload"
              );
            }
          } catch (error) {
            // AC17: Job failures logged but don't block user operations
            console.error("[Evidence] Failed to queue compliance recalculation:", error);
          }
        })();

        return evidence;
      } catch (error) {
        // Re-throw TRPC errors
        if (error instanceof TRPCError) {
          throw error;
        }

        // Log unexpected errors
        console.error("Evidence upload failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload evidence file",
        });
      } finally {
        // Clean up temp file if still exists
        if (tempPath) {
          await fileUploadService.deleteTempFile(tempPath);
        }
      }
    }),

  /**
   * Batch-fetch evidence rows by id. Used by assessment scoring UIs to
   * render the metadata for evidenceLinks/evidenceIds arrays in a single
   * round trip. Returns active rows only; missing ids are silently dropped.
   */
  listByIds: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(z.object({ ids: z.array(z.string()).max(200) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      return ctx.db.evidence.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId!,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
        },
      });
    }),

  /**
   * List evidence with pagination and filtering
   *
   * @requires EVIDENCE_READ permission
   */
  list: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(listEvidenceInput)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, isActive, controlDomainId, sortBy, sortDir, uploadDateStart, uploadDateEnd, businessUnitId } = input;
      let { frameworkCode } = input;
      const skip = (page - 1) * pageSize;

      // Story 3.7 AC21: Auditor role framework access enforcement
      // If user is AUDITOR with assigned frameworks, enforce access restriction
      const userRole = ctx.session?.user?.role;
      const assignedFrameworks = ctx.session?.user?.assignedFrameworks ?? [];

      if (userRole === UserRole.AUDITOR && assignedFrameworks.length > 0) {
        // If auditor requests a framework, verify it's in their assigned list
        if (frameworkCode && !assignedFrameworks.includes(frameworkCode)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this framework",
          });
        }

        // If no framework specified and auditor has assignments,
        // default to first assigned framework (AC20: pre-select)
        if (!frameworkCode) {
          frameworkCode = assignedFrameworks[0];
        }
      }

      // Build where clause
      // Story 3.3: Added controlDomainId filter for tag-based filtering
      // Story 3.5: Always exclude soft-deleted evidence (deletedAt is null)
      // Story 3.7: Added frameworkCode filter for framework-based filtering
      //
      // Story 3.7 AC15-AC16: When both controlDomainId and frameworkCode are specified,
      // use AND logic - evidence must satisfy BOTH filters
      // Build EvidenceControlDomain conditions dynamically to support multi-filter
      const evidenceControlDomainConditions: Array<{
        controlDomainId?: string;
        ControlDomain?: {
          ControlDomainMapping: {
            some: { frameworkCode: string };
          };
        };
      }> = [];

      // Story 3.3: Filter by control domain if specified
      if (controlDomainId) {
        evidenceControlDomainConditions.push({ controlDomainId });
      }

      // Story 3.7: Filter by framework if specified (AC8-AC11)
      // Joins: Evidence → EvidenceControlDomain → ControlDomain → ControlDomainMapping → frameworkCode
      if (frameworkCode) {
        evidenceControlDomainConditions.push({
          ControlDomain: {
            ControlDomainMapping: {
              some: { frameworkCode },
            },
          },
        });
      }

      const where = {
        organizationId: ctx.organizationId!,
        deletedAt: null, // Exclude soft-deleted evidence
        ...(isActive !== undefined ? { isActive } : {}),
        // BU-Scoped Compliance: Filter by business unit
        ...(businessUnitId ? { businessUnitId } : {}),
        // Story 3.10 AC13: Search by filename, title, and description (case-insensitive)
        ...(search ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { originalFileName: { contains: search, mode: "insensitive" as const } },
          ],
        } : {}),
        // Story 3.10 AC16: Date range filter for upload date
        ...(uploadDateStart || uploadDateEnd ? {
          createdAt: {
            ...(uploadDateStart ? { gte: uploadDateStart } : {}),
            ...(uploadDateEnd ? { lte: uploadDateEnd } : {}),
          },
        } : {}),
        // Apply EvidenceControlDomain filters with AND logic (AC15-AC16)
        ...(evidenceControlDomainConditions.length > 0 ? {
          AND: evidenceControlDomainConditions.map((condition) => ({
            EvidenceControlDomain: { some: condition },
          })),
        } : {}),
      };

      // Get total count and evidence
      const [total, evidence] = await Promise.all([
        ctx.db.evidence.count({ where }),
        ctx.db.evidence.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortDir },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            EvidenceControlDomain: {
              include: {
                ControlDomain: {
                  // Story 3.7 AC12: Include control mappings for framework control count
                  include: {
                    ControlDomainMapping: frameworkCode ? {
                      where: { frameworkCode },
                      select: {
                        id: true,
                        controlId: true,
                        frameworkCode: true,
                      },
                    } : undefined,
                  },
                },
              },
            },
          },
        }),
      ]);

      // Story 3.7 AC12-AC14: Calculate framework-specific control count when framework filter is active
      const evidenceWithControlCount = evidence.map((e) => {
        let frameworkControlCount = 0;

        if (frameworkCode) {
          // Count unique controls from the filtered framework across all control domains
          const controlIds = new Set<string>();
          for (const ecd of e.EvidenceControlDomain) {
            const mappings = (ecd.ControlDomain as { ControlDomainMapping?: Array<{ controlId: string }> }).ControlDomainMapping;
            if (mappings) {
              for (const mapping of mappings) {
                controlIds.add(mapping.controlId);
              }
            }
          }
          frameworkControlCount = controlIds.size;
        }

        return {
          ...e,
          frameworkControlCount,
        };
      });

      // Story 3.7 AC14: Sort by framework control count when framework filter is active
      // (client can also sort, but we do it server-side for consistency)
      const sortedEvidence = frameworkCode
        ? evidenceWithControlCount.sort((a, b) => b.frameworkControlCount - a.frameworkControlCount)
        : evidenceWithControlCount;

      return {
        items: sortedEvidence,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        frameworkCode: frameworkCode ?? null,
      };
    }),

  /**
   * Get a single evidence by ID
   *
   * @requires EVIDENCE_READ permission
   */
  getById: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const evidence = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
          isActive: true, // Story 3.11: Exclude soft-deleted evidence
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          EvidenceControlDomain: {
            include: {
              ControlDomain: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Story 3.8: Log VIEW_EVIDENCE action for audit trail (AC24-AC27 - auditor access logging)
      const userRole = ctx.session?.user?.role;
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session?.user?.id ?? "unknown",
        action: "VIEW_EVIDENCE",
        entityType: "Evidence",
        entityId: evidence.id,
        changes: {
          before: null,
          after: {
            evidenceTitle: evidence.title,
            viewedBy: ctx.session?.user?.email ?? "unknown",
            userRole: userRole ?? "unknown",
            isAuditor: userRole === UserRole.AUDITOR,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return evidence;
    }),

  /**
   * Update evidence metadata
   *
   * @requires EVIDENCE_UPDATE permission
   */
  update: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_UPDATE))
    .input(updateEvidenceInput)
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Build update data
      const updateData: { title?: string; description?: string } = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;

      // Update evidence
      const updated = await ctx.db.evidence.update({
        where: { id: input.id },
        data: updateData,
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_EVIDENCE",
        entityType: "Evidence",
        entityId: input.id,
        changes: {
          before: { title: existing.title, description: existing.description },
          after: updateData,
        },
      });

      return updated;
    }),

  /**
   * Update control domain tags for evidence
   *
   * Story 3.3: AC11 - Evidence edit page allows updating control domain tags
   * Story 3.3: AC12 - Tag changes logged to audit trail with old and new values
   *
   * @requires EVIDENCE_UPDATE permission
   */
  updateTags: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_UPDATE))
    .input(
      z.object({
        id: z.string().uuid(),
        controlDomainIds: z
          .array(z.string())
          .min(1, "At least one control domain is required")
          .max(5, "Maximum 5 control domains allowed"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          EvidenceControlDomain: {
            include: {
              ControlDomain: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Validate new control domain IDs exist
      const validDomains = await ctx.db.controlDomain.findMany({
        where: {
          id: { in: input.controlDomainIds },
          isActive: true,
        },
        select: { id: true, name: true },
      });

      if (validDomains.length !== input.controlDomainIds.length) {
        const validIds = new Set(validDomains.map((d) => d.id));
        const invalidIds = input.controlDomainIds.filter((id) => !validIds.has(id));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid control domain IDs: ${invalidIds.join(", ")}`,
        });
      }

      // Get old tags for audit log
      const oldTags = existing.EvidenceControlDomain.map((cd) => ({
        id: cd.ControlDomain.id,
        name: cd.ControlDomain.name,
      }));

      // Update tags in transaction
      await ctx.db.$transaction(async (tx) => {
        // Delete existing tags
        await tx.evidenceControlDomain.deleteMany({
          where: { evidenceId: input.id },
        });

        // Create new tags
        await tx.evidenceControlDomain.createMany({
          data: input.controlDomainIds.map((domainId) => ({
            id: randomUUID(),
            evidenceId: input.id,
            controlDomainId: domainId,
          })),
        });
      });

      // Fetch updated evidence with tags
      const updated = await ctx.db.evidence.findUnique({
        where: { id: input.id },
        include: {
          EvidenceControlDomain: {
            include: {
              ControlDomain: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
      });

      // Audit log with old and new values (AC12)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "TAG_EVIDENCE",
        entityType: "Evidence",
        entityId: input.id,
        changes: {
          before: {
            controlDomains: oldTags.map((t) => t.name),
          },
          after: {
            controlDomains: validDomains.map((d) => d.name),
          },
        },
      });

      return updated;
    }),

  /**
   * Soft delete evidence (sets isActive to false and deletedAt timestamp)
   *
   * Story 3.5: AC12 - Deleting evidence soft-deletes all versions
   * Story 5.3: AC6-AC9 - Triggers compliance recalculation
   *
   * @requires EVIDENCE_DELETE permission
   */
  delete: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_DELETE))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Story 5.3 AC6: Get affected frameworks BEFORE deletion
      // (mappings still exist at this point)
      let affectedFrameworkIds: string[] = [];
      try {
        affectedFrameworkIds = await getAffectedFrameworkIdsForEvidence(input.id, ctx.db);
      } catch (error) {
        console.error("[Evidence] Failed to get affected frameworks for recalculation:", error);
      }

      const now = new Date();

      // Soft delete evidence and all versions in transaction (AC12)
      const deleted = await ctx.db.$transaction(async (tx) => {
        // Soft delete all versions
        await tx.evidenceVersion.updateMany({
          where: { evidenceId: input.id },
          data: { deletedAt: now },
        });

        // Soft delete evidence
        return tx.evidence.update({
          where: { id: input.id },
          data: {
            isActive: false,
            deletedAt: now,
          },
        });
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DELETE_EVIDENCE",
        entityType: "Evidence",
        entityId: input.id,
        changes: {
          before: {
            title: existing.title,
            fileName: existing.originalFileName,
            isActive: true,
          },
          after: {
            isActive: false,
            deletedAt: now.toISOString(),
          },
        },
      });

      // Story 5.3 AC6-AC9: Trigger compliance recalculation for affected frameworks
      // AC7: Coverage decreases if deleted evidence was only proof for controls
      // AC8: Coverage unchanged if other evidence exists for same controls
      // AC9: Recalculation asynchronous and debounced
      if (affectedFrameworkIds.length > 0) {
        queueMultipleFrameworkRecalculations(
          affectedFrameworkIds,
          ctx.organizationId!,
          "evidence_delete"
        );
      }

      return deleted;
    }),

  /**
   * Restore soft-deleted evidence
   *
   * Story 3.5: Restores evidence and all its versions
   *
   * @requires EVIDENCE_UPDATE permission
   */
  restore: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_UPDATE))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Restore evidence and all versions in transaction
      const restored = await ctx.db.$transaction(async (tx) => {
        // Restore all versions
        await tx.evidenceVersion.updateMany({
          where: { evidenceId: input.id },
          data: { deletedAt: null },
        });

        // Restore evidence
        return tx.evidence.update({
          where: { id: input.id },
          data: {
            isActive: true,
            deletedAt: null,
          },
        });
      });

      // Audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "RESTORE_EVIDENCE",
        entityType: "Evidence",
        entityId: input.id,
        changes: {
          before: {
            isActive: false,
            deletedAt: existing.deletedAt?.toISOString(),
          },
          after: {
            isActive: true,
            restoredAt: new Date().toISOString(),
          },
        },
      });

      return restored;
    }),

  /**
   * Permanently delete evidence (removes DB record AND file from filesystem)
   *
   * Story 3.2: File Storage in Docker Volumes
   *
   * This is a destructive operation that cannot be undone.
   * Use soft delete (delete) for recoverable deletion.
   *
   * @requires EVIDENCE_DELETE permission
   */
  hardDelete: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_DELETE))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Extract storage path from file path for deletion
      const storagePath = extractStoragePath(existing.filePath, ctx.organizationId!);

      // Audit log BEFORE deletion (we need the evidence data)
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DELETE_EVIDENCE",
        entityType: "Evidence",
        entityId: input.id,
        changes: {
          before: {
            title: existing.title,
            fileName: existing.originalFileName,
            filePath: existing.filePath,
            fileSize: existing.fileSize,
          },
          after: {
            permanentlyDeleted: true,
            deletedAt: new Date().toISOString(),
          },
        },
      });

      // Delete database record first (most important)
      await ctx.db.evidence.delete({
        where: { id: input.id },
      });

      // Then delete file from filesystem (orphaned files are acceptable)
      if (storagePath) {
        try {
          await fileStorageService.deleteFile(storagePath, ctx.organizationId!);
          console.log(`[Evidence] Deleted file: ${storagePath}`);
        } catch (error) {
          // Log but don't fail - database record is already deleted
          console.error(`[Evidence] Failed to delete file ${storagePath}:`, error);
        }
      }

      return { success: true, id: input.id };
    }),

  /**
   * Get upload constraints for client-side validation
   */
  getUploadConstraints: organizationProcedure.query(() => {
    return {
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE),
      supportedExtensions: SUPPORTED_EXTENSIONS,
      malwareScanEnabled: malwareScannerService.isEnabled(),
    };
  }),

  /**
   * Get evidence statistics for dashboard
   *
   * @requires EVIDENCE_READ permission
   */
  getStatistics: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .query(async ({ ctx }) => {
      const [total, active, totalSize, byType] = await Promise.all([
        // Total evidence count
        ctx.db.evidence.count({
          where: { organizationId: ctx.organizationId! },
        }),
        // Active evidence count
        ctx.db.evidence.count({
          where: {
            organizationId: ctx.organizationId!,
            isActive: true,
          },
        }),
        // Total storage size
        ctx.db.evidence.aggregate({
          where: { organizationId: ctx.organizationId! },
          _sum: { fileSize: true },
        }),
        // Evidence by file type
        ctx.db.evidence.groupBy({
          by: ["fileType"],
          where: { organizationId: ctx.organizationId! },
          _count: true,
        }),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        totalStorageBytes: totalSize._sum.fileSize ?? 0,
        totalStorageFormatted: formatFileSize(totalSize._sum.fileSize ?? 0),
        byFileType: byType.map((t) => ({
          type: t.fileType,
          count: t._count,
        })),
      };
    }),

  /**
   * Get framework mappings for control domain IDs
   *
   * Story 3.4: AC1-AC6, AC7-AC8
   * Used in evidence upload form to show real-time preview of
   * which framework controls will be satisfied.
   *
   * Performance target: < 500ms for 5 control domains (AC21)
   *
   * @requires EVIDENCE_READ permission
   */
  getFrameworkMappings: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(
      z.object({
        controlDomainIds: z.array(z.string()).min(0).max(5),
      })
    )
    .query(async ({ ctx, input }) => {
      return evidenceMappingService.calculateFrameworkMappings({
        controlDomainIds: input.controlDomainIds,
        organizationId: ctx.organizationId!,
      });
    }),

  /**
   * Get framework mappings for a specific evidence record
   *
   * Story 3.4: AC13-AC17
   * Used in evidence detail page to show which framework controls
   * the evidence satisfies based on its control domain tags.
   *
   * @requires EVIDENCE_READ permission
   */
  getEvidenceFrameworkMappings: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(
      z.object({
        evidenceId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await evidenceMappingService.calculateMappingsForEvidence({
        evidenceId: input.evidenceId,
        organizationId: ctx.organizationId!,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      return result;
    }),

  /**
   * Replace evidence file with a new version
   *
   * Story 3.5: AC6-AC11, AC22-AC25
   * Creates version record from current evidence, then updates evidence with new file.
   *
   * @requires EVIDENCE_UPDATE permission
   */
  replaceFile: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_UPDATE))
    .input(
      z.object({
        evidenceId: z.string().uuid(),
        fileContent: z.string().min(1, "File content is required"),
        fileName: z.string().min(1, "File name is required").max(255),
        mimeType: z.string().min(1, "MIME type is required"),
        changeReason: z.string().min(10, "Change reason must be at least 10 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const existing = await ctx.db.evidence.findUnique({
        where: {
          id: input.evidenceId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      if (existing.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot replace file for deleted evidence",
        });
      }

      // Decode and validate new file
      const fileBuffer = Buffer.from(input.fileContent, "base64");
      const fileSize = fileBuffer.length;
      const validation = validateFile(input.fileName, fileSize, input.mimeType);

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.errors.map((e) => e.message).join("; "),
        });
      }

      // Save to temp for malware scan
      let tempPath: string | null = null;
      try {
        tempPath = await fileUploadService.saveToTemp(fileBuffer, input.fileName);
        const scanResult = await malwareScannerService.scanFile(tempPath);

        if (scanResult.isInfected) {
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "REPLACE_EVIDENCE_FILE",
            entityType: "Evidence",
            entityId: input.evidenceId,
            changes: {
              after: {
                blocked: true,
                reason: "Malware detected",
                viruses: scanResult.viruses,
              },
            },
          });

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File rejected: Malware detected (${scanResult.viruses.join(", ")})`,
          });
        }

        // Move file from temp to permanent storage
        const uploadResult = await fileUploadService.moveFromTemp(
          tempPath,
          ctx.organizationId!,
          input.fileName,
          input.mimeType
        );
        tempPath = null;

        // Create version record and update evidence in transaction
        const updated = await ctx.db.$transaction(async (tx) => {
          // Create version record from current evidence (AC6-AC8)
          await tx.evidenceVersion.create({
            data: {
              evidenceId: existing.id,
              versionNumber: existing.currentVersion,
              filename: existing.originalFileName,
              fileSize: existing.fileSize,
              storagePath: existing.filePath,
              changeReason: existing.currentVersion === 1 ? "Initial version" : input.changeReason,
              uploadedById: existing.uploadedBy,
              uploadedAt: existing.createdAt,
            },
          });

          // Update evidence with new file data (AC9)
          return tx.evidence.update({
            where: { id: input.evidenceId },
            data: {
              originalFileName: input.fileName,
              filePath: uploadResult.filePath,
              fileSize: uploadResult.fileSize,
              fileType: input.mimeType,
              currentVersion: existing.currentVersion + 1,
              uploadedBy: ctx.session!.user.id,
              updatedAt: new Date(),
            },
            include: {
              User: {
                select: { id: true, name: true, email: true },
              },
            },
          });
        });

        // Delete old file (after successful update)
        const oldStoragePath = extractStoragePath(existing.filePath, ctx.organizationId!);
        if (oldStoragePath) {
          try {
            await fileStorageService.deleteFile(oldStoragePath, ctx.organizationId!);
          } catch {
            // Log but don't fail
            console.error(`[Evidence] Failed to delete old file: ${oldStoragePath}`);
          }
        }

        // Audit log (AC25)
        await createAuditLog({
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "REPLACE_EVIDENCE_FILE",
          entityType: "Evidence",
          entityId: input.evidenceId,
          changes: {
            before: {
              version: existing.currentVersion,
              fileName: existing.originalFileName,
              fileSize: existing.fileSize,
            },
            after: {
              version: updated.currentVersion,
              fileName: input.fileName,
              fileSize: uploadResult.fileSize,
              changeReason: input.changeReason,
            },
          },
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Evidence file replacement failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to replace evidence file",
        });
      } finally {
        if (tempPath) {
          await fileUploadService.deleteTempFile(tempPath);
        }
      }
    }),

  /**
   * Get version history for an evidence record
   *
   * Story 3.5: AC18-AC21
   * Returns all versions in descending order (newest first)
   *
   * @requires EVIDENCE_READ permission
   */
  getVersionHistory: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(z.object({ evidenceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const evidence = await ctx.db.evidence.findUnique({
        where: {
          id: input.evidenceId,
          organizationId: ctx.organizationId!,
        },
        include: {
          User: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      // Get all versions (AC19)
      const versions = await ctx.db.evidenceVersion.findMany({
        where: {
          evidenceId: input.evidenceId,
          deletedAt: null,
        },
        orderBy: { versionNumber: "desc" }, // AC11: newest first
        include: {
          User: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Current version is the evidence itself (AC21)
      const currentVersion = {
        id: evidence.id,
        versionNumber: evidence.currentVersion,
        filename: evidence.originalFileName,
        fileSize: evidence.fileSize,
        storagePath: evidence.filePath,
        changeReason: "Current version",
        uploadedById: evidence.uploadedBy,
        uploadedAt: evidence.createdAt,
        uploader: evidence.User,
        isCurrent: true,
      };

      // Map previous versions
      const previousVersions = versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        filename: v.filename,
        fileSize: v.fileSize,
        storagePath: v.storagePath,
        changeReason: v.changeReason,
        uploadedById: v.uploadedById,
        uploadedAt: v.uploadedAt,
        uploader: v.User,
        isCurrent: false,
      }));

      return {
        evidenceId: evidence.id,
        evidenceTitle: evidence.title,
        currentVersion,
        versions: previousVersions,
        totalVersions: previousVersions.length + 1,
      };
    }),

  /**
   * Get risks linked to an evidence record (AC15-AC17)
   *
   * Story 3.6: Evidence-to-Risk Linkage
   * Returns all risks this evidence is linked to, ordered by severity.
   *
   * @requires EVIDENCE_READ permission
   */
  getLinkedRisks: organizationProcedure
    .use(requirePermission(Permission.EVIDENCE_READ))
    .input(z.object({ evidenceId: z.string().min(1, "Evidence ID is required") }))
    .query(async ({ ctx, input }) => {
      // Verify evidence exists and belongs to organization
      const evidence = await ctx.db.evidence.findUnique({
        where: { id: input.evidenceId },
        select: { id: true, organizationId: true, title: true },
      });

      if (!evidence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Evidence not found",
        });
      }

      if (evidence.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this evidence",
        });
      }

      // Get all linked risks (AC16)
      const links = await ctx.db.riskEvidence.findMany({
        where: { evidenceId: input.evidenceId },
        include: {
          Risk: {
            select: {
              id: true,
              title: true,
              description: true,
              severity: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      // Map and sort by severity (AC17: HIGH → MEDIUM → LOW)
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const linkedRisks = links
        .map((link) => ({
          id: link.Risk.id,
          title: link.Risk.title,
          description: link.Risk.description,
          severity: link.Risk.severity,
          status: link.Risk.status,
          createdAt: link.Risk.createdAt,
          linkType: link.linkType,
          linkedAt: link.linkedAt,
        }))
        .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return {
        evidenceId: evidence.id,
        evidenceTitle: evidence.title,
        linkedRisks,
        totalCount: linkedRisks.length,
      };
    }),
});
