/**
 * Standard Router
 *
 * tRPC router for Standards management operations.
 *
 * Story: Standards Module
 * - create: Create new standard
 * - list: List standards with filtering and pagination
 * - getById: Get standard with controls
 * - update: Update standard details
 * - delete: Delete standard (cascade to controls)
 * - Standard Control CRUD operations
 * - Framework mapping operations
 * - Exception management operations
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  StandardStatus,
  StandardControlCriticality,
  StandardMappingType,
  ControlExceptionStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";
import {
  parseControlsExcel,
  generateControlTemplate,
  validateExcelFileBase64,
  MAX_UPLOAD_ROWS,
  type ControlRow,
} from "@/lib/excel-parser";
import { createAuditLog } from "@/server/services/audit-log.service";
import { AuditAction } from "@prisma/client";

/**
 * Roles that can manage standards
 * - CISO: Full CRUD access
 * - GRC_ANALYST: Full CRUD access
 * - ORG_ADMIN: Full CRUD access
 */
const STANDARD_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can view standards
 */
const STANDARD_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

/**
 * Roles that can approve exceptions
 */
const EXCEPTION_APPROVE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

// =============================================================================
// Input Schemas
// =============================================================================

const createStandardSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  description: z.string().min(1, "Description is required"),
  ownerId: z.string().optional().nullable(),
  effectiveDate: z.coerce.date(),
  reviewCycleMonths: z.number().int().min(1).max(60).default(12),
  status: z.nativeEnum(StandardStatus).default(StandardStatus.DRAFT),
});

const listStandardsSchema = z.object({
  status: z.nativeEnum(StandardStatus).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["title", "createdAt", "updatedAt", "effectiveDate", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

const getByIdSchema = z.object({
  id: z.string().min(1, "Standard ID is required"),
});

const updateStandardSchema = z.object({
  id: z.string().min(1, "Standard ID is required"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  effectiveDate: z.coerce.date().optional(),
  reviewCycleMonths: z.number().int().min(1).max(60).optional(),
  status: z.nativeEnum(StandardStatus).optional(),
});

const deleteStandardSchema = z.object({
  id: z.string().min(1, "Standard ID is required"),
});

// Standard Control schemas
const createControlSchema = z.object({
  standardId: z.string().min(1, "Standard ID is required"),
  code: z.string().min(1, "Code is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional().nullable(),
  criticality: z.nativeEnum(StandardControlCriticality).default(StandardControlCriticality.MEDIUM),
  sortOrder: z.number().int().min(0).default(0),
});

const updateControlSchema = z.object({
  id: z.string().min(1, "Control ID is required"),
  code: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  criticality: z.nativeEnum(StandardControlCriticality).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const deleteControlSchema = z.object({
  id: z.string().min(1, "Control ID is required"),
});

/**
 * Duplicate handling mode for bulk import (Story 12.4 AC36)
 */
const DuplicateMode = z.enum(["error", "skip", "update"]);
type DuplicateModeType = z.infer<typeof DuplicateMode>;

// Bulk upload schema (Story 12.4 AC33-AC38)
const bulkCreateControlsSchema = z.object({
  standardId: z.string().min(1, "Standard ID is required"),
  fileContent: z.string().min(1, "File content is required").max(10 * 1024 * 1024, "File content too large"), // ~7.5MB actual file
  fileName: z.string().min(1, "File name is required"),
  duplicateMode: DuplicateMode.default("error"), // Story 12.4 AC36: skip, update, or error
});

// Preview schema for import preview (Story 12.4 AC35)
const previewBulkUploadSchema = z.object({
  standardId: z.string().min(1, "Standard ID is required"),
  fileContent: z.string().min(1, "File content is required").max(10 * 1024 * 1024, "File content too large"),
  fileName: z.string().min(1, "File name is required"),
});

// Upload Standard from CSV schema
// CSV columns: Standard (ignored), control number, Control Language
const uploadStandardFromCsvSchema = z.object({
  title: z.string().min(1, "Standard name is required").max(200),
  description: z.string().optional(),
  effectiveDate: z.coerce.date().optional(),
  csvContent: z.string().min(1, "CSV content is required"),
});

// Mapping schemas
const createMappingSchema = z.object({
  standardControlId: z.string().min(1, "Standard Control ID is required"),
  controlId: z.string().min(1, "Framework Control ID is required"),
  mappingType: z.nativeEnum(StandardMappingType).default(StandardMappingType.COVERS),
  notes: z.string().optional().nullable(),
});

const deleteMappingSchema = z.object({
  id: z.string().min(1, "Mapping ID is required"),
});

// Exception schemas
const createExceptionSchema = z.object({
  standardControlId: z.string().min(1, "Standard Control ID is required"),
  justification: z.string().min(10, "Justification must be at least 10 characters"),
  compensatingControls: z.string().optional().nullable(),
  expiresAt: z.coerce.date(),
});

const approveExceptionSchema = z.object({
  id: z.string().min(1, "Exception ID is required"),
  approved: z.boolean(),
  approvalNotes: z.string().optional().nullable(),
});

const listExceptionsSchema = z.object({
  standardControlId: z.string().optional(),
  status: z.nativeEnum(ControlExceptionStatus).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// =============================================================================
// Router
// =============================================================================

export const standardRouter = createTRPCRouter({
  // =========================================================================
  // Standard CRUD Operations
  // =========================================================================

  /**
   * Create a new standard
   */
  create: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(createStandardSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate owner if specified
      if (input.ownerId) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Owner must be a user in your organization",
          });
        }
      }

      // Check for duplicate title
      const existing = await ctx.db.standard.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          title: input.title,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A standard with this title already exists",
        });
      }

      const standard = await ctx.db.standard.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          title: input.title,
          description: input.description,
          ownerId: input.ownerId ?? null,
          effectiveDate: input.effectiveDate,
          reviewCycleMonths: input.reviewCycleMonths,
          status: input.status,
          createdById: ctx.session!.user.id,
        },
        include: {
          Owner: {
            select: { id: true, name: true, email: true },
          },
          CreatedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { Controls: true },
          },
        },
      });

      return standard;
    }),

  /**
   * Upload a new standard with controls from CSV
   * CSV columns: Standard (ignored), control number, Control Language
   * Creates Standard + StandardControls in one operation
   */
  uploadStandardFromCsv: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(uploadStandardFromCsvSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate title
      const existing = await ctx.db.standard.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          title: input.title,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A standard with this title already exists",
        });
      }

      // Parse CSV content
      const lines = input.csvContent.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must contain a header row and at least one data row",
        });
      }

      // Parse header to find column indices
      const headerLine = lines[0]!;
      const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

      const controlNumberIdx = headers.findIndex((h) =>
        h === "control number" || h === "controlnumber" || h === "control_number" || h === "code" || h === "identifier"
      );
      const controlLanguageIdx = headers.findIndex((h) =>
        h === "control language" || h === "controllanguage" || h === "control_language" || h === "description" || h === "language"
      );

      if (controlNumberIdx === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must contain a 'control number' column",
        });
      }

      if (controlLanguageIdx === -1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must contain a 'Control Language' column",
        });
      }

      // Parse data rows
      const controls: Array<{ code: string; description: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;

        // Simple CSV parsing (handles basic cases)
        const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));

        const code = values[controlNumberIdx]?.trim();
        const description = values[controlLanguageIdx]?.trim();

        if (code) {
          controls.push({
            code,
            description: description || "",
          });
        }
      }

      if (controls.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid controls found in CSV",
        });
      }

      // Create standard and controls in a transaction
      const standard = await ctx.db.$transaction(async (tx) => {
        // Create the standard
        const newStandard = await tx.standard.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            title: input.title,
            description: input.description || `Uploaded standard: ${input.title}`,
            effectiveDate: input.effectiveDate || new Date(),
            reviewCycleMonths: 12,
            status: StandardStatus.DRAFT,
            createdById: ctx.session!.user.id,
          },
        });

        // Create controls
        await tx.standardControl.createMany({
          data: controls.map((control, index) => ({
            id: randomUUID(),
            standardId: newStandard.id,
            code: control.code,
            title: control.code, // Use code as title
            description: control.description,
            criticality: StandardControlCriticality.MEDIUM,
            sortOrder: index,
          })),
        });

        return newStandard;
      });

      // Return the created standard with control count
      const result = await ctx.db.standard.findUnique({
        where: { id: standard.id },
        include: {
          Owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { Controls: true },
          },
        },
      });

      return {
        standard: result,
        controlsCreated: controls.length,
      };
    }),

  /**
   * List standards with filtering and pagination
   */
  list: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .input(listStandardsSchema)
    .query(async ({ ctx, input }) => {
      const { status, page, pageSize, sortBy, sortOrder, search } = input;

      const where = {
        organizationId: ctx.organizationId!,
        ...(status && { status }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [standards, total] = await Promise.all([
        ctx.db.standard.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            Owner: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { Controls: true },
            },
          },
        }),
        ctx.db.standard.count({ where }),
      ]);

      return {
        standards,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  /**
   * Get standard by ID with controls
   */
  getById: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      const standard = await ctx.db.standard.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          Owner: {
            select: { id: true, name: true, email: true },
          },
          CreatedBy: {
            select: { id: true, name: true, email: true },
          },
          Controls: {
            orderBy: { sortOrder: "asc" },
            include: {
              FrameworkMappings: {
                include: {
                  FrameworkControl: {
                    select: {
                      id: true,
                      controlId: true,
                      title: true,
                      Framework: {
                        select: { id: true, name: true, code: true },
                      },
                    },
                  },
                },
              },
              Exceptions: {
                where: {
                  status: { in: [ControlExceptionStatus.PENDING, ControlExceptionStatus.APPROVED] },
                },
                include: {
                  RequestedBy: {
                    select: { id: true, name: true, email: true },
                  },
                  ApprovedBy: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
              _count: {
                select: { FrameworkMappings: true, Exceptions: true },
              },
            },
          },
        },
      });

      if (!standard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      return standard;
    }),

  /**
   * Update a standard
   */
  update: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(updateStandardSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify standard exists and belongs to org
      const existing = await ctx.db.standard.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      // Check title uniqueness if changing
      if (data.title && data.title !== existing.title) {
        const duplicate = await ctx.db.standard.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            title: data.title,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A standard with this title already exists",
          });
        }
      }

      // Validate owner if specified
      if (data.ownerId) {
        const owner = await ctx.db.user.findFirst({
          where: {
            id: data.ownerId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Owner must be a user in your organization",
          });
        }
      }

      const standard = await ctx.db.standard.update({
        where: { id },
        data: {
          ...data,
          ownerId: data.ownerId === null ? null : data.ownerId,
        },
        include: {
          Owner: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { Controls: true },
          },
        },
      });

      return standard;
    }),

  /**
   * Delete a standard
   */
  delete: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(deleteStandardSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.standard.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      await ctx.db.standard.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // =========================================================================
  // Standard Control Operations
  // =========================================================================

  /**
   * Create a standard control
   */
  createControl: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(createControlSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify standard exists and belongs to org
      const standard = await ctx.db.standard.findFirst({
        where: {
          id: input.standardId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!standard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      // Check for duplicate code within standard
      const existing = await ctx.db.standardControl.findFirst({
        where: {
          standardId: input.standardId,
          code: input.code,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A control with this code already exists in this standard",
        });
      }

      const control = await ctx.db.standardControl.create({
        data: {
          id: randomUUID(),
          standardId: input.standardId,
          code: input.code,
          title: input.title,
          description: input.description ?? null,
          criticality: input.criticality,
          sortOrder: input.sortOrder,
        },
      });

      return control;
    }),

  /**
   * Update a standard control
   */
  updateControl: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(updateControlSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify control exists and belongs to org's standard
      const existing = await ctx.db.standardControl.findFirst({
        where: { id },
        include: {
          Standard: {
            select: { organizationId: true },
          },
        },
      });

      if (!existing || existing.Standard.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Check code uniqueness if changing
      if (data.code && data.code !== existing.code) {
        const duplicate = await ctx.db.standardControl.findFirst({
          where: {
            standardId: existing.standardId,
            code: data.code,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A control with this code already exists in this standard",
          });
        }
      }

      const control = await ctx.db.standardControl.update({
        where: { id },
        data,
      });

      return control;
    }),

  /**
   * Delete a standard control
   */
  deleteControl: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(deleteControlSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.standardControl.findFirst({
        where: { id: input.id },
        include: {
          Standard: {
            select: { organizationId: true },
          },
        },
      });

      if (!existing || existing.Standard.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      await ctx.db.standardControl.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Preview bulk upload - validates file and shows what will be imported
   * Story 12.4 AC35: CSV preview with validation before import
   */
  previewBulkUpload: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(previewBulkUploadSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate file (using base64-aware validation)
      const fileError = validateExcelFileBase64(input.fileName, input.fileContent);
      if (fileError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: fileError,
        });
      }

      // Verify standard exists and belongs to org
      const standard = await ctx.db.standard.findFirst({
        where: {
          id: input.standardId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!standard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      // Parse Excel file
      const parseResult = parseControlsExcel(input.fileContent);

      if (!parseResult.success || !parseResult.data) {
        return {
          valid: false,
          errors: parseResult.errors ?? [],
          totalRows: parseResult.totalRows ?? 0,
          preview: [],
          duplicates: [],
          newControls: 0,
          existingControls: 0,
        };
      }

      // Get existing control codes for this standard
      const existingControls = await ctx.db.standardControl.findMany({
        where: { standardId: input.standardId },
        select: { id: true, code: true },
      });

      const existingCodesMap = new Map(
        existingControls.map((c) => [c.code.toUpperCase(), c.id])
      );

      // Categorize controls
      const duplicates: Array<{ code: string; title: string; existingId: string }> = [];
      const newControls: ControlRow[] = [];

      for (const control of parseResult.data) {
        const existingId = existingCodesMap.get(control.code.toUpperCase());
        if (existingId) {
          duplicates.push({ code: control.code, title: control.title, existingId });
        } else {
          newControls.push(control);
        }
      }

      return {
        valid: true,
        errors: [],
        totalRows: parseResult.data.length,
        preview: parseResult.data.slice(0, 20), // Show first 20 rows
        duplicates,
        newControls: newControls.length,
        existingControls: duplicates.length,
      };
    }),

  /**
   * Bulk create controls from Excel file
   * Story 12.4 AC33-AC38: Full bulk import with duplicate handling and audit logging
   */
  bulkCreateControls: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(bulkCreateControlsSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate file (using base64-aware validation)
      const fileError = validateExcelFileBase64(input.fileName, input.fileContent);
      if (fileError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: fileError,
        });
      }

      // Verify standard exists and belongs to org
      const standard = await ctx.db.standard.findFirst({
        where: {
          id: input.standardId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!standard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard not found",
        });
      }

      // Parse Excel file
      const parseResult = parseControlsExcel(input.fileContent);

      if (!parseResult.success || !parseResult.data) {
        const errorMessages = parseResult.errors
          ?.map((e) => `Row ${e.row}: ${e.message}`)
          .join("; ") ?? "Failed to parse Excel file";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errorMessages,
        });
      }

      // Get existing control codes for this standard
      const existingControls = await ctx.db.standardControl.findMany({
        where: { standardId: input.standardId },
        select: { id: true, code: true },
      });

      const existingCodesMap = new Map(
        existingControls.map((c) => [c.code.toUpperCase(), c.id])
      );

      // Track import statistics (Story 12.4 AC37)
      const importStats = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as Array<{ row: number; code: string; message: string }>,
      };

      // Categorize and process controls based on duplicate mode (Story 12.4 AC36)
      // Note: guidance, parentControlId, domains fields are parsed but require schema migration to store
      const controlsToCreate: Array<{
        id: string;
        standardId: string;
        code: string;
        title: string;
        description: string | null;
        criticality: typeof StandardControlCriticality[keyof typeof StandardControlCriticality];
        sortOrder: number;
      }> = [];
      const controlsToUpdate: Array<{
        id: string;
        code: string;
        title: string;
        description: string | null;
        criticality: typeof StandardControlCriticality[keyof typeof StandardControlCriticality];
        sortOrder: number;
      }> = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const control = parseResult.data[i]!;
        const existingId = existingCodesMap.get(control.code.toUpperCase());

        if (existingId) {
          // Handle duplicate based on mode
          switch (input.duplicateMode) {
            case "error":
              importStats.errors.push({
                row: i + 1,
                code: control.code,
                message: `Control code "${control.code}" already exists`,
              });
              break;
            case "skip":
              importStats.skipped++;
              break;
            case "update":
              controlsToUpdate.push({
                id: existingId,
                code: control.code,
                title: control.title,
                description: control.description ?? null,
                criticality: control.criticality ?? StandardControlCriticality.MEDIUM,
                sortOrder: control.sortOrder ?? i,
              });
              break;
          }
        } else {
          // New control
          controlsToCreate.push({
            id: randomUUID(),
            standardId: input.standardId,
            code: control.code,
            title: control.title,
            description: control.description ?? null,
            criticality: control.criticality ?? StandardControlCriticality.MEDIUM,
            sortOrder: control.sortOrder ?? i,
          });
        }
      }

      // If in error mode and there are errors, fail the entire import
      if (input.duplicateMode === "error" && importStats.errors.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Duplicate control codes found: ${importStats.errors.map(e => e.code).join(", ")}. Use skip or update mode to handle duplicates.`,
        });
      }

      // Execute batch create
      if (controlsToCreate.length > 0) {
        const createResult = await ctx.db.standardControl.createMany({
          data: controlsToCreate,
        });
        importStats.created = createResult.count;
      }

      // Execute updates (one by one since Prisma doesn't support batch update)
      for (const controlData of controlsToUpdate) {
        await ctx.db.standardControl.update({
          where: { id: controlData.id },
          data: {
            title: controlData.title,
            description: controlData.description,
            criticality: controlData.criticality,
            sortOrder: controlData.sortOrder,
          },
        });
        importStats.updated++;
      }

      // Story 12.4 AC38: Log audit action
      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: AuditAction.BULK_IMPORT_CONTROLS,
        entityType: "Standard",
        entityId: input.standardId,
        changes: {
          after: {
            fileName: input.fileName,
            totalRows: parseResult.data.length,
            created: importStats.created,
            updated: importStats.updated,
            skipped: importStats.skipped,
            errors: importStats.errors.length,
            duplicateMode: input.duplicateMode,
          },
        },
      });

      // Return detailed summary (Story 12.4 AC37)
      return {
        success: true,
        summary: {
          totalRows: parseResult.data.length,
          created: importStats.created,
          updated: importStats.updated,
          skipped: importStats.skipped,
          errors: importStats.errors,
        },
        // Legacy field for backward compatibility
        createdCount: importStats.created,
      };
    }),

  /**
   * Download Excel template for control imports
   */
  downloadControlTemplate: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .query(() => {
      const templateBase64 = generateControlTemplate();
      return {
        fileName: "control-import-template.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: templateBase64,
      };
    }),

  // =========================================================================
  // Framework Mapping Operations
  // =========================================================================

  /**
   * Create a mapping between standard control and framework control
   */
  createMapping: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(createMappingSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify standard control exists and belongs to org
      const standardControl = await ctx.db.standardControl.findFirst({
        where: { id: input.standardControlId },
        include: {
          Standard: {
            select: { organizationId: true },
          },
        },
      });

      if (!standardControl || standardControl.Standard.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard control not found",
        });
      }

      // Verify framework control exists and belongs to org
      const frameworkControl = await ctx.db.control.findFirst({
        where: {
          id: input.controlId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!frameworkControl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework control not found",
        });
      }

      // Check for existing mapping
      const existing = await ctx.db.standardControlMapping.findFirst({
        where: {
          standardControlId: input.standardControlId,
          controlId: input.controlId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This mapping already exists",
        });
      }

      const mapping = await ctx.db.standardControlMapping.create({
        data: {
          id: randomUUID(),
          standardControlId: input.standardControlId,
          controlId: input.controlId,
          mappingType: input.mappingType,
          notes: input.notes ?? null,
          createdById: ctx.session!.user.id,
        },
        include: {
          FrameworkControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      });

      return mapping;
    }),

  /**
   * Delete a mapping
   */
  deleteMapping: organizationProcedure
    .use(requireRole(STANDARD_MANAGE_ROLES))
    .input(deleteMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.standardControlMapping.findFirst({
        where: { id: input.id },
        include: {
          StandardControl: {
            include: {
              Standard: {
                select: { organizationId: true },
              },
            },
          },
        },
      });

      if (!existing || existing.StandardControl.Standard.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mapping not found",
        });
      }

      await ctx.db.standardControlMapping.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // =========================================================================
  // Exception Operations
  // =========================================================================

  /**
   * Create an exception request
   */
  createException: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .input(createExceptionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify standard control exists and belongs to org
      const standardControl = await ctx.db.standardControl.findFirst({
        where: { id: input.standardControlId },
        include: {
          Standard: {
            select: { organizationId: true },
          },
        },
      });

      if (!standardControl || standardControl.Standard.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standard control not found",
        });
      }

      // Validate expiration is in the future
      if (input.expiresAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Expiration date must be in the future",
        });
      }

      const exception = await ctx.db.controlException.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          standardControlId: input.standardControlId,
          justification: input.justification,
          compensatingControls: input.compensatingControls ?? null,
          expiresAt: input.expiresAt,
          requestedById: ctx.session!.user.id,
          status: ControlExceptionStatus.PENDING,
        },
        include: {
          RequestedBy: {
            select: { id: true, name: true, email: true },
          },
          StandardControl: {
            select: {
              id: true,
              code: true,
              title: true,
              Standard: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      return exception;
    }),

  /**
   * Approve or deny an exception
   */
  approveException: organizationProcedure
    .use(requireRole(EXCEPTION_APPROVE_ROLES))
    .input(approveExceptionSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.controlException.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exception not found",
        });
      }

      if (existing.status !== ControlExceptionStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This exception has already been processed",
        });
      }

      const exception = await ctx.db.controlException.update({
        where: { id: input.id },
        data: {
          status: input.approved
            ? ControlExceptionStatus.APPROVED
            : ControlExceptionStatus.DENIED,
          approvedById: ctx.session!.user.id,
          approvedAt: new Date(),
          approvalNotes: input.approvalNotes ?? null,
        },
        include: {
          RequestedBy: {
            select: { id: true, name: true, email: true },
          },
          ApprovedBy: {
            select: { id: true, name: true, email: true },
          },
          StandardControl: {
            select: {
              id: true,
              code: true,
              title: true,
              Standard: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      return exception;
    }),

  /**
   * List exceptions
   */
  listExceptions: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .input(listExceptionsSchema)
    .query(async ({ ctx, input }) => {
      const { standardControlId, status, page, pageSize } = input;

      const where = {
        organizationId: ctx.organizationId!,
        ...(standardControlId && { standardControlId }),
        ...(status && { status }),
      };

      const [exceptions, total] = await Promise.all([
        ctx.db.controlException.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            RequestedBy: {
              select: { id: true, name: true, email: true },
            },
            ApprovedBy: {
              select: { id: true, name: true, email: true },
            },
            StandardControl: {
              select: {
                id: true,
                code: true,
                title: true,
                Standard: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        }),
        ctx.db.controlException.count({ where }),
      ]);

      return {
        exceptions,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  // =========================================================================
  // Gap Analysis Operations
  // =========================================================================

  /**
   * Get framework coverage report
   * Shows how well standards cover a specific framework
   */
  getFrameworkCoverage: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .input(z.object({
      frameworkId: z.string().min(1, "Framework ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Get all controls for the framework
      const frameworkControls = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        include: {
          StandardControlMappings: {
            include: {
              StandardControl: {
                include: {
                  Standard: {
                    select: { id: true, title: true, status: true },
                  },
                },
              },
            },
          },
        },
      });

      const totalControls = frameworkControls.length;
      const coveredControls = frameworkControls.filter(
        (c) => c.StandardControlMappings.length > 0
      ).length;
      const coveragePercent = totalControls > 0
        ? Math.round((coveredControls / totalControls) * 100)
        : 0;

      // Group by mapping type
      const mappingTypes = {
        COVERS: 0,
        PARTIAL: 0,
        EXCEEDS: 0,
      };

      const unmappedControls: Array<{
        id: string;
        controlId: string;
        title: string;
      }> = [];

      for (const control of frameworkControls) {
        if (control.StandardControlMappings.length === 0) {
          unmappedControls.push({
            id: control.id,
            controlId: control.controlId,
            title: control.title,
          });
        } else {
          for (const mapping of control.StandardControlMappings) {
            mappingTypes[mapping.mappingType]++;
          }
        }
      }

      return {
        frameworkId: input.frameworkId,
        totalControls,
        coveredControls,
        coveragePercent,
        mappingTypes,
        unmappedControls: unmappedControls.slice(0, 50), // Limit to 50 for performance
        unmappedCount: unmappedControls.length,
      };
    }),

  /**
   * Get standards summary for dashboard
   */
  getSummary: organizationProcedure
    .use(requireRole(STANDARD_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const [
        totalStandards,
        activeStandards,
        totalControls,
        pendingExceptions,
        activeExceptions,
      ] = await Promise.all([
        ctx.db.standard.count({
          where: { organizationId: ctx.organizationId! },
        }),
        ctx.db.standard.count({
          where: {
            organizationId: ctx.organizationId!,
            status: StandardStatus.ACTIVE,
          },
        }),
        // Count controls through their parent standards
        ctx.db.standard.findMany({
          where: { organizationId: ctx.organizationId! },
          select: { _count: { select: { Controls: true } } },
        }).then(standards => standards.reduce((sum, s) => sum + s._count.Controls, 0)),
        ctx.db.controlException.count({
          where: {
            organizationId: ctx.organizationId!,
            status: ControlExceptionStatus.PENDING,
          },
        }),
        ctx.db.controlException.count({
          where: {
            organizationId: ctx.organizationId!,
            status: ControlExceptionStatus.APPROVED,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);

      return {
        totalStandards,
        activeStandards,
        totalControls,
        pendingExceptions,
        activeExceptions,
      };
    }),
});
