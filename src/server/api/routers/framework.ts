/**
 * Framework Router - tRPC procedures for framework and OSCAL management
 *
 * Handles:
 * - OSCAL catalog import (JSON/YAML)
 * - Import preview before committing
 * - Framework CRUD operations
 * - Framework activation/deactivation
 *
 * @see Story 2.1: OSCAL Catalog Import Pipeline
 * @module server/api/routers/framework
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import {
  UserRole,
  ControlType,
  ControlNature,
  OrgControlStatus,
  ControlFrequency,
  AssignmentRole,
} from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  adminProcedure,
  requirePermission,
} from "@/server/api/trpc";
import { Permission } from "@/server/auth/permissions";
import {
  parseOscalCatalog,
  generateImportPreview,
  validateOscalCatalog,
  getValidationSummary,
} from "@/server/services/oscal";
import type {
  OscalImportResult,
  OscalValidationIssue,
} from "@/types/oscal";
import { createAuditLog } from "@/server/services/audit-log.service";
import {
  parseFrameworkImportFile,
  validateImportFileBase64,
} from "@/lib/framework-import-parser";
import { buildControlsFromMapping } from "@/lib/framework-import-mapping";
import { OSCALUpdater } from "@/server/services/oscal-updater";
import { getTemplateMetadata, getTemplate, getTemplatePreview } from "@/data/frameworks";

/**
 * Input schema for OSCAL import
 */
const oscalImportInput = z.object({
  /** Raw file content as string (JSON or YAML) */
  content: z.string().min(1, "File content is required"),
  /** Original filename for format detection */
  filename: z.string().optional(),
  /** Optional format override */
  format: z.enum(["json", "yaml", "yml"]).optional(),
  /** Framework code (e.g., "NIST-800-53", "SOC2") */
  code: z.string().min(1).max(50),
});

/**
 * Input schema for import preview
 */
const previewInput = z.object({
  /** Raw file content as string (JSON or YAML) */
  content: z.string().min(1, "File content is required"),
  /** Original filename for format detection */
  filename: z.string().optional(),
  /** Optional format override */
  format: z.enum(["json", "yaml", "yml"]).optional(),
});

/**
 * Input schema for CSV/XLSX framework import file parsing (Story 24.1)
 *
 * fileContent max length caps the base64 payload so oversized uploads fail
 * fast at validation (5MB file ≈ 6.7MB base64; 8M chars is a safe ceiling).
 */
const parseImportFileInput = z.object({
  /** Base64-encoded file content (CSV or XLSX) */
  fileContent: z.string().min(1, "File content is required").max(8_000_000),
  /** Original file name (used for extension validation) */
  fileName: z.string().min(1, "File name is required").max(255),
});

/**
 * Input schema for committing a mapped CSV/XLSX import (Story 24.3)
 */
const commitImportInput = z.object({
  fileContent: z.string().min(1, "File content is required").max(8_000_000),
  fileName: z.string().min(1, "File name is required").max(255),
  name: z.string().min(1, "Framework name is required").max(200),
  code: z.string().min(1, "Framework code is required").max(50),
  version: z.string().min(1, "Framework version is required").max(50),
  mapping: z.object({
    controlId: z.number().int().min(0),
    title: z.number().int().min(0),
    description: z.number().int().min(0).nullable(),
    family: z.number().int().min(0).nullable(),
    parentControlId: z.number().int().min(0).nullable(),
  }),
});

/**
 * Framework router definition
 */
export const frameworkRouter = createTRPCRouter({
  /**
   * Preview OSCAL import before committing
   *
   * Parses and validates the OSCAL file, returns metadata and control counts
   * without writing to the database. Allows user to review before import.
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  preview: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(previewInput)
    .mutation(async ({ input }) => {
      try {
        const preview = generateImportPreview(
          input.content,
          input.format,
          input.filename,
        );

        return {
          success: preview.isValid,
          ...preview,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error parsing OSCAL file";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to parse OSCAL file: ${message}`,
        });
      }
    }),

  /**
   * Parse a CSV/XLSX framework import file and return a raw preview (Story 24.1)
   *
   * Stage 1 of the two-stage framework import: validates the file
   * (extension, size) and parses it into raw headers + rows so the user can
   * verify the file was read correctly before column mapping (Story 24.2).
   *
   * Read-only: no database writes, no audit log (audit lands at commit).
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  parseImportFile: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(parseImportFileInput)
    .mutation(({ input }) => {
      const validationError = validateImportFileBase64(input.fileName, input.fileContent);
      if (validationError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validationError,
        });
      }

      const parsed = parseFrameworkImportFile(input.fileContent);

      return {
        valid: parsed.valid,
        headers: parsed.headers,
        /** First 10 data rows for the preview table (AC1) */
        previewRows: parsed.rows.slice(0, 10),
        totalRows: parsed.totalRows,
        issues: parsed.issues,
      };
    }),

  /**
   * Commit a mapped CSV/XLSX framework import (Story 24.3)
   *
   * Stage 3 of the two-stage import: re-parses the file server-side, extracts
   * controls via the user's column mapping, validates (blank required fields,
   * duplicate control IDs, dangling parent refs, duplicate framework), then
   * writes an ordinary versioned Framework + Control rows in one transaction.
   *
   * Family handling: when a family column is mapped, controls WITHOUT an
   * explicit parentControlId are grouped under a synthesized family Control row
   * (mirrors how seed data models Family → Base → Enhancement hierarchy).
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  commitImport: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(commitImportInput)
    .mutation(async ({ ctx, input }) => {
      // Re-validate + re-parse server-side; never trust client-sent rows.
      const validationError = validateImportFileBase64(input.fileName, input.fileContent);
      if (validationError) {
        return { success: false as const, issues: [{ message: validationError }] };
      }

      const parsed = parseFrameworkImportFile(input.fileContent);
      if (!parsed.valid) {
        return {
          success: false as const,
          issues: parsed.issues.filter((i) => i.severity === "error"),
        };
      }

      const { controls, errors } = buildControlsFromMapping(parsed.rows, input.mapping);
      if (errors.length > 0) {
        return { success: false as const, rowErrors: errors };
      }

      // Duplicate-framework guard (mirror importOscal): org + code + version.
      const existing = await ctx.db.framework.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          code: input.code,
          version: input.version,
        },
      });
      if (existing) {
        return {
          success: false as const,
          issues: [
            {
              code: "DUPLICATE_FRAMEWORK",
              message: `Framework "${input.code}" version "${input.version}" already exists. Try a different version string.`,
            },
          ],
        };
      }

      // Resolve which controls need a synthesized family parent: family column
      // mapped, a family value present, and NO explicit parentControlId.
      const familyMapped = input.mapping.family !== null;
      const distinctFamilies = familyMapped
        ? Array.from(
            new Set(
              controls
                .filter((c) => c.family && !c.parentControlId)
                .map((c) => c.family as string),
            ),
          )
        : [];

      // Ensure synthesized family controlIds don't collide with real ones.
      const usedControlIds = new Set(controls.map((c) => c.controlId));
      const familyControlId = (family: string): string => {
        let candidate = family;
        let suffix = 1;
        while (usedControlIds.has(candidate)) {
          candidate = `${family} (family ${suffix++})`;
        }
        usedControlIds.add(candidate);
        return candidate;
      };
      const familyToControlId = new Map<string, string>();
      for (const family of distinctFamilies) {
        familyToControlId.set(family, familyControlId(family));
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const framework = await tx.framework.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            code: input.code,
            name: input.name,
            version: input.version,
            isActive: false,
            updatedAt: new Date(),
          },
        });

        const controlIdMap = new Map<string, string>(); // controlId → db id

        // Pass 0: create synthesized family parents (top-level).
        for (const [family, synthId] of familyToControlId) {
          const created = await tx.control.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              frameworkId: framework.id,
              controlId: synthId,
              title: family,
              description: family,
              isActive: true,
              isOscalImported: false,
              isCustom: false,
              updatedAt: new Date(),
            },
          });
          controlIdMap.set(synthId, created.id);
        }

        // Pass 1: create all mapped controls (no parent yet).
        for (const control of controls) {
          const created = await tx.control.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              frameworkId: framework.id,
              controlId: control.controlId,
              title: control.title,
              description: control.description || control.title,
              isActive: true,
              isOscalImported: false,
              isCustom: false,
              updatedAt: new Date(),
            },
          });
          controlIdMap.set(control.controlId, created.id);
        }

        // Pass 2: wire parent references — explicit parent wins, else family.
        for (const control of controls) {
          let parentDbId: string | undefined;
          if (control.parentControlId) {
            parentDbId = controlIdMap.get(control.parentControlId);
          } else if (familyMapped && control.family) {
            const synthId = familyToControlId.get(control.family);
            parentDbId = synthId ? controlIdMap.get(synthId) : undefined;
          }
          if (parentDbId) {
            await tx.control.update({
              where: { id: controlIdMap.get(control.controlId)! },
              data: { parentControlId: parentDbId },
            });
          }
        }

        return { framework, controlCount: controlIdMap.size };
      });

      void createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "FRAMEWORK_IMPORT",
        entityType: "Framework",
        entityId: result.framework.id,
        changes: {
          before: null,
          after: {
            code: input.code,
            name: input.name,
            version: input.version,
            controlCount: result.controlCount,
            source: "csv-xlsx",
          },
        },
      });

      return {
        success: true as const,
        frameworkId: result.framework.id,
        frameworkName: input.name,
        controlsImported: result.controlCount,
      };
    }),

  /**
   * Import OSCAL catalog
   *
   * Parses OSCAL JSON/YAML, validates structure, and imports framework
   * with all controls into the database.
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  importOscal: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(oscalImportInput)
    .mutation(async ({ ctx, input }): Promise<OscalImportResult> => {
      const issues: OscalValidationIssue[] = [];

      try {
        // Parse the OSCAL content
        const parsed = parseOscalCatalog(
          input.content,
          input.format,
          input.filename,
        );

        // Validate the parsed catalog
        const catalogIssues = validateOscalCatalog(parsed.rawCatalog);
        issues.push(...catalogIssues);

        // Check for blocking errors
        const summary = getValidationSummary(issues);
        if (!summary.isValid) {
          return {
            success: false,
            frameworkId: "",
            frameworkCode: input.code,
            frameworkName: parsed.metadata.title,
            controlsImported: 0,
            issues,
          };
        }

        // Check for existing framework with same code+version
        const existingFramework = await ctx.db.framework.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            code: input.code,
            version: parsed.metadata.version,
          },
        });

        if (existingFramework) {
          issues.push({
            severity: "error",
            code: "DUPLICATE_FRAMEWORK",
            message: `Framework "${input.code}" version "${parsed.metadata.version}" already exists`,
          });
          return {
            success: false,
            frameworkId: existingFramework.id,
            frameworkCode: input.code,
            frameworkName: parsed.metadata.title,
            controlsImported: 0,
            issues,
          };
        }

        // Create framework and controls in a transaction
        const result = await ctx.db.$transaction(async (tx) => {
          // Create framework
          const framework = await tx.framework.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              code: input.code,
              name: parsed.metadata.title,
              version: parsed.metadata.version,
              description: parsed.metadata.description,
              publicationDate: parsed.metadata.published,
              sourceUrl: parsed.metadata.sourceUrl,
              oscalCatalog: parsed.rawCatalog as object,
              isActive: false,
              updatedAt: new Date(),
            },
          });

          // Create a map of controlId -> database id for parent references
          const controlIdMap = new Map<string, string>();

          // First pass: Create all controls without parent references
          for (const control of parsed.controls) {
            const created = await tx.control.create({
              data: {
                id: randomUUID(),
                organizationId: ctx.organizationId!,
                frameworkId: framework.id,
                controlId: control.controlId,
                title: control.title,
                description: control.description || control.title,
                guidance: control.guidance,
                // Story 12.4: Mark OSCAL-imported controls as locked
                isOscalImported: true,
                updatedAt: new Date(),
                // Parent will be set in second pass
              },
            });
            controlIdMap.set(control.controlId, created.id);
          }

          // Second pass: Update parent references
          for (const control of parsed.controls) {
            if (control.parentControlId) {
              const parentDbId = controlIdMap.get(control.parentControlId);
              const controlDbId = controlIdMap.get(control.controlId);

              if (parentDbId && controlDbId) {
                await tx.control.update({
                  where: { id: controlDbId },
                  data: { parentControlId: parentDbId },
                });
              }
            }
          }

          return framework;
        });

        // Create audit log entry
        await createAuditLog({
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "IMPORT_OSCAL_CATALOG",
          entityType: "Framework",
          entityId: result.id,
          changes: {
            before: null,
            after: {
              code: input.code,
              name: parsed.metadata.title,
              version: parsed.metadata.version,
              controlCount: parsed.controls.length,
            },
          },
        });

        return {
          success: true,
          frameworkId: result.id,
          frameworkCode: input.code,
          frameworkName: parsed.metadata.title,
          controlsImported: parsed.controls.length,
          issues,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        // Check for specific Prisma errors
        if (message.includes("Unique constraint")) {
          issues.push({
            severity: "error",
            code: "DUPLICATE_FRAMEWORK",
            message: "A framework with this code and version already exists",
          });
        } else {
          issues.push({
            severity: "error",
            code: "IMPORT_ERROR",
            message: `Import failed: ${message}`,
          });
        }

        return {
          success: false,
          frameworkId: "",
          frameworkCode: input.code,
          frameworkName: "",
          controlsImported: 0,
          issues,
        };
      }
    }),

  /**
   * List all frameworks for the organization
   *
   * @requires FRAMEWORK_READ permission (all authenticated users)
   */
  /**
   * Create a framework from scratch using a selection of OrgControls from
   * the /controls library as its members. Mirrors each selected OrgControl
   * into a Control row under the new framework (isCustom=true) so the
   * existing compliance-assessment machinery can score against it without
   * changes. Also writes an OrgControlFrameworkMapping row for each pair so
   * the link back to the source OrgControl is preserved.
   */
  createCustom: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        name: z.string().min(3, "Name is required").max(200),
        code: z.string().min(2, "Code is required").max(50),
        version: z.string().min(1, "Version is required").max(50).default("1.0"),
        description: z.string().max(5000).optional(),
        orgControlIds: z
          .array(z.string())
          .min(1, "At least one control is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Code must be unique per org+version
      const codeConflict = await ctx.db.framework.findFirst({
        where: {
          organizationId,
          code: { equals: input.code, mode: "insensitive" },
          version: input.version,
        },
      });
      if (codeConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Framework with code "${input.code}" v${input.version} already exists`,
        });
      }

      // Fetch the source OrgControls — must all belong to this org
      const orgControls = await ctx.db.organizationalControl.findMany({
        where: {
          id: { in: input.orgControlIds },
          organizationId,
        },
        select: {
          id: true,
          localControlId: true,
          name: true,
          description: true,
        },
      });
      if (orgControls.length !== input.orgControlIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more selected controls were not found in this organization",
        });
      }

      const now = new Date();
      const framework = await ctx.db.$transaction(async (tx) => {
        const fw = await tx.framework.create({
          data: {
            id: randomUUID(),
            organizationId,
            code: input.code,
            name: input.name,
            version: input.version,
            description: input.description ?? null,
            isActive: true,
            activatedAt: now,
            activatedBy: userId,
            updatedAt: now,
          },
        });

        // Mirror each OrgControl into a Control row. isCustom=true marks these
        // as author-created (not OSCAL-imported) so they can be edited if
        // needed. Source OrgControl info preserved via controlId = localId
        // and the OrgControlFrameworkMapping junction rows below.
        const controlsToCreate = orgControls.map((oc) => ({
          id: randomUUID(),
          organizationId,
          frameworkId: fw.id,
          controlId: oc.localControlId,
          title: oc.name,
          description: oc.description ?? oc.name,
          isActive: true,
          isOscalImported: false,
          isCustom: true,
          updatedAt: now,
        }));
        await tx.control.createMany({ data: controlsToCreate });

        // Keep a back-reference from OrgControl → the new Control. Uses the
        // existing junction so the /controls detail view surfaces the
        // framework mapping automatically.
        await tx.orgControlFrameworkMapping.createMany({
          data: controlsToCreate.map((c) => {
            const source = orgControls.find((oc) => oc.localControlId === c.controlId);
            return {
              id: randomUUID(),
              organizationId,
              orgControlId: source!.id,
              frameworkControlId: c.id,
              mappingType: "EQUIVALENT" as const,
              createdById: userId,
            };
          }),
          skipDuplicates: true,
        });

        return fw;
      });

      void createAuditLog({
        organizationId,
        userId,
        action: "ACTIVATE_FRAMEWORK",
        entityType: "Framework",
        entityId: framework.id,
        changes: {
          after: {
            code: framework.code,
            name: framework.name,
            version: framework.version,
            controlCount: orgControls.length,
            source: "custom-from-org-controls",
          },
        },
      });

      return framework;
    }),

  /**
   * Create a custom framework AND a fresh set of OrgControls from an Excel
   * import. All-or-nothing: any duplicate (name or local ID) within the batch
   * or against existing org data blocks the whole import.
   */
  createCustomFromExcel: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(
      z.object({
        name: z.string().min(3, "Name is required").max(200),
        code: z.string().min(2, "Code is required").max(50),
        version: z.string().min(1, "Version is required").max(50).default("1.0"),
        description: z.string().max(5000).optional(),
        defaultOwnerId: z.string().optional().nullable(),
        controls: z
          .array(
            z.object({
              localControlId: z.string().min(1).max(50).optional(),
              name: z.string().min(1).max(200),
              description: z.string().max(5000).optional().nullable(),
              objective: z.string().max(5000).optional().nullable(),
              family: z.string().max(100).optional().nullable(),
              controlType: z.nativeEnum(ControlType),
              nature: z.nativeEnum(ControlNature).optional().nullable(),
              status: z.nativeEnum(OrgControlStatus),
              implementationNarrative: z.string().max(10000).optional().nullable(),
              scope: z.string().max(5000).optional().nullable(),
              frequency: z.nativeEnum(ControlFrequency).optional().nullable(),
            })
          )
          .min(1, "At least one control is required")
          .max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId!;
      const userId = ctx.session!.user.id;

      // Framework code uniqueness
      const codeConflict = await ctx.db.framework.findFirst({
        where: {
          organizationId,
          code: { equals: input.code, mode: "insensitive" },
          version: input.version,
        },
      });
      if (codeConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Framework with code "${input.code}" v${input.version} already exists`,
        });
      }

      const prepared = input.controls.map((c) => ({
        ...c,
        localControlId:
          c.localControlId ?? "OC-" + randomUUID().slice(0, 8).toUpperCase(),
      }));

      const conflicts: string[] = [];

      const existingByName = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId,
          name: { in: prepared.map((c) => c.name), mode: "insensitive" },
        },
        select: { name: true },
      });
      const existingNames = new Set(existingByName.map((r) => r.name.toLowerCase()));
      for (const c of prepared) {
        if (existingNames.has(c.name.toLowerCase())) {
          conflicts.push(`Name "${c.name}" already exists in the organization`);
        }
      }

      const existingByLocalId = await ctx.db.organizationalControl.findMany({
        where: {
          organizationId,
          localControlId: {
            in: prepared.map((c) => c.localControlId),
            mode: "insensitive",
          },
        },
        select: { localControlId: true },
      });
      const existingLocalIds = new Set(
        existingByLocalId.map((r) => r.localControlId.toLowerCase())
      );
      for (const c of prepared) {
        if (existingLocalIds.has(c.localControlId.toLowerCase())) {
          conflicts.push(
            `Local control ID "${c.localControlId}" already exists in the organization`
          );
        }
      }

      if (input.defaultOwnerId) {
        const owner = await ctx.db.person.findFirst({
          where: { id: input.defaultOwnerId, organizationId },
          select: { id: true },
        });
        if (!owner) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Default owner not found in this organization",
          });
        }
      }

      if (conflicts.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Import blocked — ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}:\n${conflicts.slice(0, 10).join("\n")}${conflicts.length > 10 ? `\n…and ${conflicts.length - 10} more` : ""}`,
        });
      }

      const now = new Date();

      const framework = await ctx.db.$transaction(async (tx) => {
        // 1. Create the framework shell
        const fw = await tx.framework.create({
          data: {
            id: randomUUID(),
            organizationId,
            code: input.code,
            name: input.name,
            version: input.version,
            description: input.description ?? null,
            isActive: true,
            activatedAt: now,
            activatedBy: userId,
            updatedAt: now,
          },
        });

        // 2. Create the OrgControls (source of truth in /controls library)
        const orgControlRows = prepared.map((c) => ({
          id: randomUUID(),
          organizationId,
          localControlId: c.localControlId,
          name: c.name,
          description: c.description ?? null,
          objective: c.objective ?? null,
          family: c.family ?? null,
          controlType: c.controlType,
          nature: c.nature ?? null,
          status: c.status,
          implementationNarrative: c.implementationNarrative ?? null,
          scope: c.scope ?? null,
          frequency: c.frequency ?? null,
          createdById: userId,
        }));
        await tx.organizationalControl.createMany({ data: orgControlRows });

        // 3. Mirror into Control rows under the new framework (isCustom=true)
        const controlRows = orgControlRows.map((oc) => ({
          id: randomUUID(),
          organizationId,
          frameworkId: fw.id,
          controlId: oc.localControlId,
          title: oc.name,
          description: oc.description ?? oc.name,
          isActive: true,
          isOscalImported: false,
          isCustom: true,
          updatedAt: now,
        }));
        await tx.control.createMany({ data: controlRows });

        // 4. Back-reference each OrgControl to the mirrored Control
        await tx.orgControlFrameworkMapping.createMany({
          data: orgControlRows.map((oc, idx) => ({
            id: randomUUID(),
            organizationId,
            orgControlId: oc.id,
            frameworkControlId: controlRows[idx]!.id,
            mappingType: "EQUIVALENT" as const,
            createdById: userId,
          })),
          skipDuplicates: true,
        });

        // 5. Optional: default owner assignment on every OrgControl
        if (input.defaultOwnerId) {
          await tx.orgControlAssignment.createMany({
            data: orgControlRows.map((oc) => ({
              id: randomUUID(),
              organizationId,
              orgControlId: oc.id,
              personId: input.defaultOwnerId!,
              role: AssignmentRole.OWNER,
              assignedById: userId,
            })),
            skipDuplicates: true,
          });
        }

        return fw;
      });

      void createAuditLog({
        organizationId,
        userId,
        action: "ACTIVATE_FRAMEWORK",
        entityType: "Framework",
        entityId: framework.id,
        changes: {
          after: {
            code: framework.code,
            name: framework.name,
            version: framework.version,
            controlCount: prepared.length,
            source: "excel-import",
            defaultOwnerId: input.defaultOwnerId ?? null,
          },
        },
      });

      return framework;
    }),

  list: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(
      z.object({
        /** Filter by active status */
        isActive: z.boolean().optional(),
        /** Include control counts */
        includeControlCount: z.boolean().default(false),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: { organizationId: string; isActive?: boolean } = {
        organizationId: ctx.organizationId!,
      };

      if (input?.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      const frameworks = await ctx.db.framework.findMany({
        where,
        orderBy: [
          { isActive: "desc" },
          { name: "asc" },
        ],
        include: input?.includeControlCount
          ? {
              _count: {
                select: { Control: true },
              },
            }
          : undefined,
      });

      return frameworks.map((f) => ({
        ...f,
        controlCount: (f as { _count?: { Control: number } })._count?.Control,
      }));
    }),

  /**
   * Get a framework by ID with controls
   *
   * @requires FRAMEWORK_READ permission
   */
  getById: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          Control: {
            orderBy: { controlId: "asc" },
          },
          _count: {
            select: { Control: true },
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      return framework;
    }),

  /**
   * Get controls for a framework with hierarchy and pagination
   *
   * Returns controls organized by parent-child relationships
   *
   * @requires FRAMEWORK_READ permission
   */
  getControls: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(
      z.object({
        frameworkId: z.string().uuid(),
        /** Only return top-level controls (no parent) */
        topLevelOnly: z.boolean().default(false),
        /** Search controls by ID or title */
        search: z.string().optional(),
        /** Page number (0-indexed) */
        page: z.number().int().min(0).default(0),
        /** Items per page */
        pageSize: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify framework belongs to organization
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      const whereClause: {
        frameworkId: string;
        parentControlId?: string | null;
        OR?: Array<{ controlId: { contains: string; mode: "insensitive" } } | { title: { contains: string; mode: "insensitive" } } | { description: { contains: string; mode: "insensitive" } }>;
      } = {
        frameworkId: input.frameworkId,
      };

      if (input.topLevelOnly) {
        whereClause.parentControlId = null;
      }

      if (input.search) {
        whereClause.OR = [
          { controlId: { contains: input.search, mode: "insensitive" } },
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Get total count for pagination
      const totalCount = await ctx.db.control.count({
        where: whereClause,
      });

      const controls = await ctx.db.control.findMany({
        where: whereClause,
        orderBy: { controlId: "asc" },
        include: {
          other_Control: {
            orderBy: { controlId: "asc" },
            take: 5, // Only include first 5 children for preview
          },
          _count: {
            select: { other_Control: true },
          },
          // Include domain tags for taxonomy
          ControlDomains: {
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
        skip: input.page * input.pageSize,
        take: input.pageSize,
      });

      return {
        controls,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / input.pageSize),
          hasNextPage: (input.page + 1) * input.pageSize < totalCount,
          hasPreviousPage: input.page > 0,
        },
      };
    }),

  /**
   * Get a single control by ID with full details
   *
   * @requires FRAMEWORK_READ permission
   */
  getControlById: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const control = await ctx.db.control.findUnique({
        where: { id: input.id },
        include: {
          Framework: {
            select: {
              id: true,
              code: true,
              name: true,
              version: true,
              organizationId: true,
            },
          },
          Control: {
            select: {
              id: true,
              controlId: true,
              title: true,
            },
          },
          other_Control: {
            orderBy: { controlId: "asc" },
            select: {
              id: true,
              controlId: true,
              title: true,
            },
          },
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Verify organization access
      if (control.Framework.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      return control;
    }),

  /**
   * Activate a framework with optional target completion date
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.5: Framework Activation and Configuration
   */
  activate: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({
      id: z.string().uuid(),
      targetCompletionDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Validate target completion date is in the future if provided
      if (input.targetCompletionDate && input.targetCompletionDate < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target completion date must be in the future",
        });
      }

      const updated = await ctx.db.framework.update({
        where: { id: input.id },
        data: {
          isActive: true,
          activatedAt: new Date(),
          activatedBy: ctx.session!.user.id,
          targetCompletionDate: input.targetCompletionDate ?? null,
          // Clear deactivation fields when activating
          deactivatedAt: null,
          deactivatedBy: null,
        },
      });

      // Create audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "ACTIVATE_FRAMEWORK",
        entityType: "Framework",
        entityId: input.id,
        changes: {
          before: { isActive: false },
          after: {
            isActive: true,
            activatedAt: updated.activatedAt,
            activatedBy: ctx.session!.user.id,
            targetCompletionDate: input.targetCompletionDate,
          },
        },
      });

      return updated;
    }),

  /**
   * Check framework dependencies before deactivation
   *
   * Returns counts of evidence and risks that reference this framework.
   * Used to warn admin before deactivation.
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.5: Framework Activation and Configuration (AC9, AC17, AC31)
   */
  checkDependencies: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // TODO: When Evidence and Risk models have frameworkId references,
      // update these queries to count actual dependencies
      // For now, return zero counts as placeholders
      const evidenceCount = 0;
      const riskCount = 0;

      return {
        frameworkId: input.id,
        frameworkName: framework.name,
        evidenceCount,
        riskCount,
        hasDependencies: evidenceCount > 0 || riskCount > 0,
      };
    }),

  /**
   * Deactivate a framework
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.5: Framework Activation and Configuration
   */
  deactivate: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({
      id: z.string().uuid(),
      force: z.boolean().default(false), // Skip dependency warning
    }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Check for dependencies if not forcing
      if (!input.force) {
        // TODO: When Evidence and Risk models have frameworkId references,
        // add actual dependency checks here
        // const evidenceCount = await ctx.db.evidence.count({ where: { frameworkId: input.id } });
        // const riskCount = await ctx.db.risk.count({ where: { frameworkId: input.id } });
        // if (evidenceCount > 0 || riskCount > 0) {
        //   throw new TRPCError({
        //     code: "PRECONDITION_FAILED",
        //     message: `Cannot deactivate framework with ${evidenceCount} evidence items and ${riskCount} risks`,
        //   });
        // }
      }

      const updated = await ctx.db.framework.update({
        where: { id: input.id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: ctx.session!.user.id,
        },
      });

      // Create audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DEACTIVATE_FRAMEWORK",
        entityType: "Framework",
        entityId: input.id,
        changes: {
          before: { isActive: true },
          after: {
            isActive: false,
            deactivatedAt: updated.deactivatedAt,
            deactivatedBy: ctx.session!.user.id,
          },
        },
      });

      return updated;
    }),

  /**
   * List only active frameworks for the organization
   *
   * Used in evidence tagging, compliance dashboard, and risk management dropdowns.
   * Returns enriched framework data with activation details.
   *
   * @requires FRAMEWORK_READ permission (all authenticated users)
   * @see Story 2.5: Framework Activation and Configuration (AC19-AC23)
   */
  listActive: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .query(async ({ ctx }) => {
      // Story 3.7 AC19-AC21: Auditor role framework access filtering
      const userRole = ctx.session?.user?.role;
      const assignedFrameworks = ctx.session?.user?.assignedFrameworks ?? [];

      // Build where clause with optional auditor filter
      const where: { organizationId: string; isActive: true; code?: { in: string[] } } = {
        organizationId: ctx.organizationId!,
        isActive: true,
      };

      // If auditor has assigned frameworks, filter to only those (AC21)
      if (userRole === UserRole.BUSINESS_USER && assignedFrameworks.length > 0) {
        where.code = { in: assignedFrameworks };
      }

      const activeFrameworks = await ctx.db.framework.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { Control: true },
          },
          User_Framework_activatedByToUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return activeFrameworks.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        version: f.version,
        description: f.description,
        controlCount: f._count.Control,
        isActive: f.isActive,
        activatedAt: f.activatedAt,
        activatedBy: f.User_Framework_activatedByToUser,
        targetCompletionDate: f.targetCompletionDate,
      }));
    }),

  /**
   * Update framework target completion date
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.5: Framework Activation and Configuration
   */
  updateTargetDate: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({
      id: z.string().uuid(),
      targetCompletionDate: z.date().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Validate target completion date is in the future if provided
      if (input.targetCompletionDate && input.targetCompletionDate < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target completion date must be in the future",
        });
      }

      const updated = await ctx.db.framework.update({
        where: { id: input.id },
        data: {
          targetCompletionDate: input.targetCompletionDate,
        },
      });

      return updated;
    }),

  /**
   * Delete a framework and all its controls
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  delete: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: { select: { Control: true } },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Delete framework (cascades to controls due to relation)
      await ctx.db.framework.delete({
        where: { id: input.id },
      });

      // Create audit log
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DEACTIVATE_FRAMEWORK", // Reusing this action for deletion
        entityType: "Framework",
        entityId: input.id,
        changes: {
          before: {
            code: framework.code,
            name: framework.name,
            version: framework.version,
            controlCount: framework._count.Control,
          },
          after: null,
        },
      });

      return { success: true, deletedId: input.id };
    }),

  /**
   * Preview OSCAL catalog update before applying
   *
   * Compares new catalog version with current, calculates control diff,
   * and returns migration impact preview.
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.7: OSCAL Catalog Update Workflow (AC1-AC5)
   */
  previewOSCALUpdate: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({
      frameworkId: z.string().uuid(),
      content: z.string().min(1, "File content is required"),
      filename: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Parse the new OSCAL content
      let newCatalog: Record<string, unknown>;
      try {
        const parsed = parseOscalCatalog(input.content, undefined, input.filename);
        newCatalog = parsed.rawCatalog as unknown as Record<string, unknown>;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to parse OSCAL file: ${message}`,
        });
      }

      // Generate migration preview
      const updater = new OSCALUpdater(ctx.db);
      const preview = await updater.generateMigrationPreview(input.frameworkId, newCatalog);

      return {
        success: preview.isValid,
        ...preview,
        summary: {
          controlsAdded: preview.controlDiff.added.length,
          controlsRemoved: preview.controlDiff.removed.length,
          controlsModified: preview.controlDiff.modified.length,
          controlsUnchanged: preview.controlDiff.unchanged.length,
        },
      };
    }),

  /**
   * Apply OSCAL catalog update to framework
   *
   * Performs atomic update: replaces catalog, adds new controls,
   * soft-deletes deprecated controls, updates modified controls.
   *
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   * @see Story 2.7: OSCAL Catalog Update Workflow (AC11-AC16)
   */
  applyOSCALUpdate: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_MANAGE))
    .input(z.object({
      frameworkId: z.string().uuid(),
      content: z.string().min(1, "File content is required"),
      filename: z.string().optional(),
      confirmationName: z.string(), // Safety check: must match framework name
    }))
    .mutation(async ({ ctx, input }) => {
      // Get framework
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        include: {
          Control: {
            where: { isActive: true },
          },
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Verify confirmation name matches
      if (input.confirmationName !== framework.name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Confirmation name does not match framework name",
        });
      }

      // Parse the new OSCAL content
      let parsed;
      try {
        parsed = parseOscalCatalog(input.content, undefined, input.filename);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to parse OSCAL file: ${message}`,
        });
      }

      const newCatalog = parsed.rawCatalog as unknown as Record<string, unknown>;
      const updater = new OSCALUpdater(ctx.db);

      // Validate update
      const detection = updater.detectUpdate(
        framework.oscalCatalog as Record<string, unknown> | null,
        newCatalog,
        framework.code,
        framework.version
      );

      if (!detection.isUpdate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: detection.error ?? "Invalid update",
        });
      }

      // Calculate control diff
      const controlDiff = updater.calculateControlDiff(framework.Control, newCatalog);

      const oldVersion = framework.version;
      const newVersion = detection.newVersion;

      // Apply update in transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Update framework catalog and metadata
        const updatedFramework = await tx.framework.update({
          where: { id: input.frameworkId },
          data: {
            oscalCatalog: newCatalog as object,
            version: parsed.metadata.version,
            publicationDate: parsed.metadata.published,
          },
        });

        // Add new controls
        const controlIdMap = new Map<string, string>();
        for (const newControl of controlDiff.added) {
          const created = await tx.control.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              frameworkId: input.frameworkId,
              controlId: newControl.id,
              title: newControl.title,
              description: newControl.description || newControl.title,
              isActive: true,
              // Story 12.4: Mark OSCAL-imported controls as locked
              isOscalImported: true,
              updatedAt: new Date(),
            },
          });
          controlIdMap.set(newControl.id, created.id);

          // Log control addition
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "CONTROL_ADDED",
            entityType: "Control",
            entityId: created.id,
            changes: {
              before: null,
              after: {
                controlId: newControl.id,
                title: newControl.title,
                frameworkId: input.frameworkId,
              },
            },
          });
        }

        // Update parent references for new controls
        for (const newControl of controlDiff.added) {
          if (newControl.parentId) {
            const parentDbId = controlIdMap.get(newControl.parentId);
            const controlDbId = controlIdMap.get(newControl.id);
            if (parentDbId && controlDbId) {
              await tx.control.update({
                where: { id: controlDbId },
                data: { parentControlId: parentDbId },
              });
            }
          }
        }

        // Soft-delete deprecated controls
        for (const removedControl of controlDiff.removed) {
          await tx.control.update({
            where: { id: removedControl.id },
            data: { isActive: false },
          });

          // Log control deprecation
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "CONTROL_DEPRECATED",
            entityType: "Control",
            entityId: removedControl.id,
            changes: {
              before: { isActive: true },
              after: { isActive: false },
            },
          });
        }

        // Update modified controls
        for (const modified of controlDiff.modified) {
          await tx.control.update({
            where: { id: modified.existing.id },
            data: {
              title: modified.updated.title,
              description: modified.updated.description || modified.updated.title,
            },
          });

          // Log control modification
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "CONTROL_MODIFIED",
            entityType: "Control",
            entityId: modified.existing.id,
            changes: {
              before: {
                title: modified.existing.title,
                description: modified.existing.description,
              },
              after: {
                title: modified.updated.title,
                description: modified.updated.description,
              },
            },
          });
        }

        return updatedFramework;
      });

      // Log framework update
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_OSCAL_CATALOG",
        entityType: "Framework",
        entityId: input.frameworkId,
        changes: {
          before: {
            version: oldVersion,
          },
          after: {
            version: newVersion,
            controlsAdded: controlDiff.added.length,
            controlsDeprecated: controlDiff.removed.length,
            controlsModified: controlDiff.modified.length,
          },
        },
      });

      // Generate reconciliation report
      const reconciliationReport = await updater.generateReconciliationReport(
        input.frameworkId,
        oldVersion,
        newVersion,
        controlDiff,
        ctx.session!.user.name ?? ctx.session!.user.email ?? "Unknown"
      );

      return {
        success: true,
        framework: result,
        reconciliationReport,
      };
    }),

  /**
   * Get reconciliation report for a framework update
   *
   * Returns cached reconciliation report if available, or generates one
   * based on current state.
   *
   * @requires FRAMEWORK_READ permission
   * @see Story 2.7: OSCAL Catalog Update Workflow (AC27-AC30)
   */
  getReconciliationReport: organizationProcedure
    .use(requirePermission(Permission.FRAMEWORK_READ))
    .input(z.object({
      frameworkId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findUnique({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        include: {
          Control: true,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Get deprecated controls with evidence counts
      const deprecatedControls = framework.Control.filter((c) => !c.isActive);
      const activeControls = framework.Control.filter((c) => c.isActive);

      // Count evidence for deprecated controls via control domain mappings
      const deprecatedControlIds = deprecatedControls.map((c) => c.controlId);
      const deprecatedWithEvidence: Array<{
        controlId: string;
        title: string;
        evidenceCount: number;
      }> = [];

      if (deprecatedControlIds.length > 0) {
        const mappings = await ctx.db.controlDomainMapping.findMany({
          where: {
            frameworkCode: framework.code,
            controlId: { in: deprecatedControlIds },
          },
          select: { controlId: true, controlDomainId: true },
        });

        const controlToDomains = new Map<string, string[]>();
        for (const mapping of mappings) {
          const domains = controlToDomains.get(mapping.controlId) ?? [];
          domains.push(mapping.controlDomainId);
          controlToDomains.set(mapping.controlId, domains);
        }

        for (const control of deprecatedControls) {
          const domainIds = controlToDomains.get(control.controlId) ?? [];
          let evidenceCount = 0;

          if (domainIds.length > 0) {
            evidenceCount = await ctx.db.evidenceControlDomain.count({
              where: {
                controlDomainId: { in: domainIds },
                Evidence: {
                  organizationId: ctx.organizationId!,
                  isActive: true,
                },
              },
            });
          }

          if (evidenceCount > 0) {
            deprecatedWithEvidence.push({
              controlId: control.controlId,
              title: control.title,
              evidenceCount,
            });
          }
        }
      }

      return {
        frameworkId: framework.id,
        frameworkCode: framework.code,
        frameworkName: framework.name,
        version: framework.version,
        totalControls: framework.Control.length,
        activeControls: activeControls.length,
        deprecatedControls: deprecatedControls.length,
        deprecatedWithEvidence,
        controlsRequiringEvidence: activeControls.slice(0, 50).map((c) => ({
          controlId: c.controlId,
          title: c.title,
        })),
      };
    }),

  // ============================================================
  // Story 12.4: Control CRUD Operations
  // ============================================================

  /**
   * Create a new control manually (not from OSCAL import)
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  createControl: adminProcedure
    .input(
      z.object({
        frameworkId: z.string().min(1),
        controlId: z.string().min(1).max(50).regex(/^[A-Za-z0-9.-]+$/, {
          message: "Control ID must be alphanumeric with dots and dashes only",
        }),
        title: z.string().min(1).max(500),
        description: z.string().min(1),
        guidance: z.string().optional(),
        parentControlId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify framework exists and belongs to organization
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Check for duplicate controlId
      const existingControl = await ctx.db.control.findUnique({
        where: {
          frameworkId_controlId: {
            frameworkId: input.frameworkId,
            controlId: input.controlId,
          },
        },
      });

      if (existingControl) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Control ID "${input.controlId}" already exists in this framework`,
        });
      }

      // Verify parent control if specified
      let parentDbId: string | null = null;
      if (input.parentControlId) {
        const parentControl = await ctx.db.control.findFirst({
          where: {
            frameworkId: input.frameworkId,
            controlId: input.parentControlId,
            organizationId: ctx.organizationId!,
          },
        });
        if (!parentControl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Parent control "${input.parentControlId}" not found`,
          });
        }
        parentDbId = parentControl.id;
      }

      const control = await ctx.db.control.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          frameworkId: input.frameworkId,
          controlId: input.controlId,
          title: input.title,
          description: input.description,
          guidance: input.guidance,
          parentControlId: parentDbId,
          isOscalImported: false, // Manual creation
          isCustom: true,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "CREATE_CONTROL",
        entityType: "Control",
        entityId: control.id,
        changes: {
          after: {
            controlId: input.controlId,
            title: input.title,
            description: input.description,
            guidance: input.guidance,
            parentControlId: input.parentControlId,
            frameworkId: input.frameworkId,
          },
        },
      });

      return control;
    }),

  /**
   * Update an existing control (only custom controls, not OSCAL-imported)
   * @requires FRAMEWORK_MANAGE permission (ORG_ADMIN)
   */
  updateControl: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(500).optional(),
        description: z.string().min(1).optional(),
        guidance: z.string().optional().nullable(),
        parentControlId: z.string().optional().nullable(),
        // Test instructions / acceptance criteria are org-authored and stay
        // editable even on OSCAL-imported controls (see lock check below).
        testInstructions: z.string().optional().nullable(),
        acceptanceCriteria: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              RiskLinks: true,
              FindingLinks: true,
            },
          },
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // OSCAL-imported controls are locked for source-integrity reasons, but
      // testInstructions / acceptanceCriteria are org-authored fields that
      // sit alongside the upstream definition — allow editing those even on
      // locked controls. Block edits only when the user is trying to change
      // a locked field.
      const isOscalLockedEditAttempt =
        control.isOscalImported &&
        (input.title !== undefined ||
          input.description !== undefined ||
          input.guidance !== undefined ||
          input.parentControlId !== undefined);
      if (isOscalLockedEditAttempt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot edit OSCAL-imported controls. They are locked to preserve source integrity.",
        });
      }

      // Verify parent control if specified
      let parentDbId: string | null | undefined = undefined;
      if (input.parentControlId !== undefined) {
        if (input.parentControlId === null) {
          parentDbId = null;
        } else {
          const parentControl = await ctx.db.control.findFirst({
            where: {
              frameworkId: control.frameworkId,
              controlId: input.parentControlId,
              organizationId: ctx.organizationId!,
            },
          });
          if (!parentControl) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Parent control "${input.parentControlId}" not found`,
            });
          }
          // Prevent circular references
          if (parentControl.id === control.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A control cannot be its own parent",
            });
          }
          parentDbId = parentControl.id;
        }
      }

      const before = {
        title: control.title,
        description: control.description,
        guidance: control.guidance,
        parentControlId: control.parentControlId,
        testInstructions: control.testInstructions,
        acceptanceCriteria: control.acceptanceCriteria,
      };

      const updated = await ctx.db.control.update({
        where: { id: input.id },
        data: {
          title: input.title ?? control.title,
          description: input.description ?? control.description,
          guidance: input.guidance === null ? null : (input.guidance ?? control.guidance),
          parentControlId: parentDbId,
          testInstructions:
            input.testInstructions === null
              ? null
              : (input.testInstructions ?? control.testInstructions),
          acceptanceCriteria:
            input.acceptanceCriteria === null
              ? null
              : (input.acceptanceCriteria ?? control.acceptanceCriteria),
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "UPDATE_CONTROL",
        entityType: "Control",
        entityId: control.id,
        changes: {
          before,
          after: {
            title: updated.title,
            description: updated.description,
            guidance: updated.guidance,
            parentControlId: updated.parentControlId,
            testInstructions: updated.testInstructions,
            acceptanceCriteria: updated.acceptanceCriteria,
          },
        },
      });

      return {
        ...updated,
        hasLinkedRisks: control._count.RiskLinks > 0,
        hasLinkedFindings: control._count.FindingLinks > 0,
      };
    }),

  /**
   * Get control impact analysis before deletion
   */
  getControlImpact: organizationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              RiskLinks: true,
              FindingLinks: true,
              other_Control: true,
            },
          },
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      return {
        controlId: control.controlId,
        title: control.title,
        isOscalImported: control.isOscalImported,
        riskCount: control._count.RiskLinks,
        findingCount: control._count.FindingLinks,
        childCount: control._count.other_Control,
        canHardDelete:
          control._count.RiskLinks === 0 &&
          control._count.FindingLinks === 0 &&
          control._count.other_Control === 0,
      };
    }),

  /**
   * Deprecate a control (soft delete)
   */
  deprecateControl: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      if (!control.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Control is already deprecated",
        });
      }

      const updated = await ctx.db.control.update({
        where: { id: input.id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DEPRECATE_CONTROL",
        entityType: "Control",
        entityId: control.id,
        changes: {
          before: { isActive: true },
          after: { isActive: false },
        },
      });

      return updated;
    }),

  /**
   * Restore a deprecated control
   */
  restoreControl: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      if (control.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Control is already active",
        });
      }

      const updated = await ctx.db.control.update({
        where: { id: input.id },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "RESTORE_CONTROL",
        entityType: "Control",
        entityId: control.id,
        changes: {
          before: { isActive: false },
          after: { isActive: true },
        },
      });

      return updated;
    }),

  /**
   * Hard delete a control (only if no links or children)
   */
  deleteControl: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const control = await ctx.db.control.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              RiskLinks: true,
              FindingLinks: true,
              other_Control: true,
            },
          },
        },
      });

      if (!control) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Control not found",
        });
      }

      // Cannot hard delete if has links or children
      if (control._count.RiskLinks > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Cannot delete control with ${control._count.RiskLinks} linked risks. Deprecate it instead.`,
        });
      }

      if (control._count.FindingLinks > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Cannot delete control with ${control._count.FindingLinks} linked findings. Deprecate it instead.`,
        });
      }

      if (control._count.other_Control > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Cannot delete control with ${control._count.other_Control} child controls. Delete or reassign children first.`,
        });
      }

      await ctx.db.control.delete({
        where: { id: input.id },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "DELETE_CONTROL",
        entityType: "Control",
        entityId: control.id,
        changes: {
          before: {
            controlId: control.controlId,
            title: control.title,
            frameworkId: control.frameworkId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Bulk deprecate multiple controls
   */
  bulkDeprecateControls: adminProcedure
    .input(
      z.object({
        controlIds: z.array(z.string()).min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const controls = await ctx.db.control.findMany({
        where: {
          id: { in: input.controlIds },
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      if (controls.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active controls found to deprecate",
        });
      }

      await ctx.db.control.updateMany({
        where: {
          id: { in: controls.map((c) => c.id) },
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "BULK_DEPRECATE_CONTROLS",
        entityType: "Control",
        entityId: controls[0]!.frameworkId,
        changes: {
          after: {
            deprecatedCount: controls.length,
            controlIds: controls.map((c) => c.controlId),
          },
        },
      });

      return {
        deprecatedCount: controls.length,
        controlIds: controls.map((c) => c.controlId),
      };
    }),

  /**
   * Bulk restore multiple controls
   */
  bulkRestoreControls: adminProcedure
    .input(
      z.object({
        controlIds: z.array(z.string()).min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const controls = await ctx.db.control.findMany({
        where: {
          id: { in: input.controlIds },
          organizationId: ctx.organizationId!,
          isActive: false,
        },
      });

      if (controls.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No inactive controls found to restore",
        });
      }

      await ctx.db.control.updateMany({
        where: {
          id: { in: controls.map((c) => c.id) },
        },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "BULK_RESTORE_CONTROLS",
        entityType: "Control",
        entityId: controls[0]!.frameworkId,
        changes: {
          after: {
            restoredCount: controls.length,
            controlIds: controls.map((c) => c.controlId),
          },
        },
      });

      return {
        restoredCount: controls.length,
        controlIds: controls.map((c) => c.controlId),
      };
    }),

  /**
   * Bulk delete multiple controls (only those with no links or children)
   */
  bulkDeleteControls: adminProcedure
    .input(
      z.object({
        controlIds: z.array(z.string()).min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const controls = await ctx.db.control.findMany({
        where: {
          id: { in: input.controlIds },
          organizationId: ctx.organizationId!,
        },
        include: {
          _count: {
            select: {
              RiskLinks: true,
              FindingLinks: true,
              other_Control: true,
            },
          },
        },
      });

      if (controls.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No controls found to delete",
        });
      }

      // Filter to only deletable controls (no links or children)
      const deletable = controls.filter(
        (c) =>
          c._count.RiskLinks === 0 &&
          c._count.FindingLinks === 0 &&
          c._count.other_Control === 0,
      );

      const skipped = controls.length - deletable.length;

      if (deletable.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "None of the selected controls can be deleted — they all have linked risks, findings, or child controls.",
        });
      }

      await ctx.db.control.deleteMany({
        where: {
          id: { in: deletable.map((c) => c.id) },
        },
      });

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "BULK_DELETE_CONTROLS",
        entityType: "Control",
        entityId: deletable[0]!.frameworkId,
        changes: {
          before: {
            deletedCount: deletable.length,
            skippedCount: skipped,
            controlIds: deletable.map((c) => c.controlId),
          },
        },
      });

      return {
        deletedCount: deletable.length,
        skippedCount: skipped,
        controlIds: deletable.map((c) => c.controlId),
      };
    }),

  /**
   * Suggest a control ID based on parent
   */
  suggestControlId: organizationProcedure
    .input(
      z.object({
        frameworkId: z.string().min(1),
        parentControlId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.parentControlId) {
        // Get highest top-level control number
        const topLevelControls = await ctx.db.control.findMany({
          where: {
            frameworkId: input.frameworkId,
            organizationId: ctx.organizationId!,
            parentControlId: null,
          },
          select: { controlId: true },
        });

        // Find next available number
        const numbers = topLevelControls
          .map((c) => parseInt(c.controlId.replace(/\D/g, ""), 10))
          .filter((n) => !isNaN(n));
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

        return { suggestedId: `CTRL-${nextNum}` };
      }

      // Get sibling controls under this parent
      const parentControl = await ctx.db.control.findFirst({
        where: {
          frameworkId: input.frameworkId,
          controlId: input.parentControlId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!parentControl) {
        return { suggestedId: null };
      }

      const siblings = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          parentControlId: parentControl.id,
          organizationId: ctx.organizationId!,
        },
        select: { controlId: true },
      });

      // Parse sibling numbers (e.g., AC-2.1, AC-2.2 -> [1, 2])
      const siblingNums = siblings
        .map((s) => {
          const match = s.controlId.match(/\.(\d+)$/);
          return match && match[1] ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);

      const nextNum = siblingNums.length > 0 ? Math.max(...siblingNums) + 1 : 1;

      return { suggestedId: `${input.parentControlId}.${nextNum}` };
    }),

  /**
   * Import controls from CSV
   */
  importControlsFromCsv: adminProcedure
    .input(
      z.object({
        frameworkId: z.string().min(1),
        csvContent: z.string().min(1),
        duplicateHandling: z.enum(["skip", "update", "error"]).default("skip"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify framework
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found",
        });
      }

      // Parse CSV (simple parser - rows separated by newlines, columns by commas)
      const lines = input.csvContent.trim().split("\n");
      if (lines.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must have a header row and at least one data row",
        });
      }

      const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
      const requiredHeaders = ["controlid", "title", "description"];
      for (const req of requiredHeaders) {
        if (!headers.includes(req)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required CSV column: ${req}`,
          });
        }
      }

      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as { row: number; error: string }[],
      };

      // Get existing controls for duplicate checking
      const existingControls = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, controlId: true },
      });
      const existingMap = new Map(existingControls.map((c) => [c.controlId, c.id]));

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]!.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? "";
        });

        const controlId = row.controlid ?? "";
        const title = row.title ?? "";
        const description = row.description ?? "";
        const guidance = row.guidance ?? "";
        const parentControlId = row.parentcontrolid ?? "";

        if (!controlId || !title) {
          results.errors.push({ row: i + 1, error: "Missing controlId or title" });
          continue;
        }

        // Validate controlId format
        if (!/^[A-Za-z0-9.-]+$/.test(controlId)) {
          results.errors.push({
            row: i + 1,
            error: `Invalid controlId format: ${controlId}`,
          });
          continue;
        }

        const existingId = existingMap.get(controlId);
        if (existingId) {
          // Handle duplicate
          if (input.duplicateHandling === "skip") {
            results.skipped++;
            continue;
          } else if (input.duplicateHandling === "error") {
            results.errors.push({
              row: i + 1,
              error: `Duplicate controlId: ${controlId}`,
            });
            continue;
          } else {
            // Update existing
            await ctx.db.control.update({
              where: { id: existingId },
              data: {
                title,
                description: description || title,
                guidance: guidance || null,
                updatedAt: new Date(),
              },
            });
            results.updated++;
          }
        } else {
          // Create new
          let parentDbId: string | null = null;
          if (parentControlId) {
            const parent = await ctx.db.control.findFirst({
              where: {
                frameworkId: input.frameworkId,
                controlId: parentControlId,
                organizationId: ctx.organizationId!,
              },
            });
            if (parent) {
              parentDbId = parent.id;
            }
          }

          await ctx.db.control.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              frameworkId: input.frameworkId,
              controlId,
              title,
              description: description || title,
              guidance: guidance || null,
              parentControlId: parentDbId,
              isOscalImported: false,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          existingMap.set(controlId, "new");
          results.created++;
        }
      }

      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "BULK_IMPORT_CONTROLS",
        entityType: "Framework",
        entityId: input.frameworkId,
        changes: {
          after: {
            created: results.created,
            updated: results.updated,
            skipped: results.skipped,
            errors: results.errors.length,
          },
        },
      });

      return results;
    }),

  /**
   * List parent control options for a framework
   */
  listParentControlOptions: organizationProcedure
    .input(
      z.object({
        frameworkId: z.string().min(1),
        excludeControlId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const controls = await ctx.db.control.findMany({
        where: {
          frameworkId: input.frameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
          ...(input.excludeControlId
            ? { NOT: { controlId: input.excludeControlId } }
            : {}),
        },
        select: {
          id: true,
          controlId: true,
          title: true,
        },
        orderBy: { controlId: "asc" },
      });

      return controls;
    }),

  // ============================================================
  // Story 12.5: Framework Template Seeder
  // ============================================================

  /**
   * Get available framework templates
   */
  getTemplates: organizationProcedure.query(async ({ ctx }) => {
    const templates = getTemplateMetadata();

    // Check which templates are already seeded
    const existingFrameworks = await ctx.db.framework.findMany({
      where: {
        organizationId: ctx.organizationId!,
        code: { in: templates.map((t) => t.code) },
      },
      select: { code: true },
    });

    const existingCodes = new Set(existingFrameworks.map((f) => f.code));

    return templates.map((t) => ({
      ...t,
      isSeeded: existingCodes.has(t.code),
    }));
  }),

  /**
   * Get template preview (first 10 controls)
   */
  getTemplatePreview: organizationProcedure
    .input(z.object({ code: z.string() }))
    .query(({ input }) => {
      const preview = getTemplatePreview(input.code);
      if (!preview) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template "${input.code}" not found`,
        });
      }
      return preview;
    }),

  /**
   * Seed a framework from template
   */
  seedFromTemplate: adminProcedure
    .input(
      z.object({
        templateCode: z.string().min(1),
        overwrite: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = getTemplate(input.templateCode);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template "${input.templateCode}" not found`,
        });
      }

      // Check if framework already exists
      const existingFramework = await ctx.db.framework.findFirst({
        where: {
          organizationId: ctx.organizationId!,
          code: template.code,
        },
      });

      if (existingFramework && !input.overwrite) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Framework "${template.code}" already exists. Set overwrite=true to replace it.`,
        });
      }

      // Use transaction for atomic seeding
      const result = await ctx.db.$transaction(async (tx) => {
        // Delete existing framework if overwriting
        if (existingFramework && input.overwrite) {
          await tx.framework.delete({
            where: { id: existingFramework.id },
          });
        }

        // Create framework
        const framework = await tx.framework.create({
          data: {
            id: randomUUID(),
            organizationId: ctx.organizationId!,
            code: template.code,
            name: template.name,
            version: template.version,
            description: template.description,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        // Create controls in two passes (like OSCAL import)
        const controlIdMap = new Map<string, string>();

        // First pass: create all controls without parent references
        for (const ctrl of template.controls) {
          const controlRecord = await tx.control.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              frameworkId: framework.id,
              controlId: ctrl.controlId,
              title: ctrl.title,
              description: ctrl.description,
              guidance: ctrl.guidance,
              isOscalImported: false, // Template controls are editable
              isActive: true,
              updatedAt: new Date(),
            },
          });
          controlIdMap.set(ctrl.controlId, controlRecord.id);
        }

        // Second pass: update parent references
        for (const ctrl of template.controls) {
          if (ctrl.parentControlId) {
            const parentDbId = controlIdMap.get(ctrl.parentControlId);
            const controlDbId = controlIdMap.get(ctrl.controlId);
            if (parentDbId && controlDbId) {
              await tx.control.update({
                where: { id: controlDbId },
                data: { parentControlId: parentDbId },
              });
            }
          }
        }

        return framework;
      });

      // Log the seeding
      await createAuditLog({
        organizationId: ctx.organizationId!,
        userId: ctx.session!.user.id,
        action: "IMPORT_OSCAL_CATALOG", // Reuse existing action
        entityType: "Framework",
        entityId: result.id,
        changes: {
          after: {
            source: "template",
            templateCode: template.code,
            controlCount: template.controls.length,
          },
        },
      });

      return {
        frameworkId: result.id,
        frameworkCode: result.code,
        controlCount: template.controls.length,
      };
    }),

  /**
   * Seed multiple frameworks from templates
   */
  seedMultipleFromTemplates: adminProcedure
    .input(
      z.object({
        templateCodes: z.array(z.string()).min(1).max(10),
        skipExisting: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { code: string; success: boolean; error?: string; frameworkId?: string }[] = [];

      for (const code of input.templateCodes) {
        try {
          const template = getTemplate(code);
          if (!template) {
            results.push({ code, success: false, error: "Template not found" });
            continue;
          }

          // Check if exists
          const existing = await ctx.db.framework.findFirst({
            where: {
              organizationId: ctx.organizationId!,
              code: template.code,
            },
          });

          if (existing) {
            if (input.skipExisting) {
              results.push({ code, success: false, error: "Already exists (skipped)" });
              continue;
            }
            // Delete if not skipping
            await ctx.db.framework.delete({ where: { id: existing.id } });
          }

          // Create framework
          const framework = await ctx.db.framework.create({
            data: {
              id: randomUUID(),
              organizationId: ctx.organizationId!,
              code: template.code,
              name: template.name,
              version: template.version,
              description: template.description,
              isActive: true,
              updatedAt: new Date(),
            },
          });

          // Create controls
          const controlIdMap = new Map<string, string>();
          for (const ctrl of template.controls) {
            const controlRecord = await ctx.db.control.create({
              data: {
                id: randomUUID(),
                organizationId: ctx.organizationId!,
                frameworkId: framework.id,
                controlId: ctrl.controlId,
                title: ctrl.title,
                description: ctrl.description,
                guidance: ctrl.guidance,
                isOscalImported: false,
                isActive: true,
                updatedAt: new Date(),
              },
            });
            controlIdMap.set(ctrl.controlId, controlRecord.id);
          }

          // Update parent references
          for (const ctrl of template.controls) {
            if (ctrl.parentControlId) {
              const parentDbId = controlIdMap.get(ctrl.parentControlId);
              const controlDbId = controlIdMap.get(ctrl.controlId);
              if (parentDbId && controlDbId) {
                await ctx.db.control.update({
                  where: { id: controlDbId },
                  data: { parentControlId: parentDbId },
                });
              }
            }
          }

          results.push({ code, success: true, frameworkId: framework.id });

          // Log
          await createAuditLog({
            organizationId: ctx.organizationId!,
            userId: ctx.session!.user.id,
            action: "IMPORT_OSCAL_CATALOG",
            entityType: "Framework",
            entityId: framework.id,
            changes: {
              after: {
                source: "template",
                templateCode: template.code,
                controlCount: template.controls.length,
              },
            },
          });
        } catch (error) {
          results.push({
            code,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        results,
        seededCount: results.filter((r) => r.success).length,
        skippedCount: results.filter((r) => !r.success).length,
      };
    }),

  // ============================================================
  // Story 12.8: Control Library / Browse Controls
  // ============================================================

  /**
   * Browse all controls across frameworks with filtering and search
   */
  browseControls: organizationProcedure
    .input(
      z.object({
        search: z.string().optional(),
        frameworkIds: z.array(z.string()).optional(),
        health: z.enum(["HEALTHY", "AT_RISK", "CRITICAL"]).optional(),
        isActive: z.boolean().optional(),
        hasRisks: z.boolean().optional(),
        hasFindings: z.boolean().optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(100).default(50),
        sortBy: z.enum(["controlId", "title", "framework", "riskCount", "findingCount"]).default("controlId"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        organizationId: ctx.organizationId!,
      };

      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      if (input.frameworkIds && input.frameworkIds.length > 0) {
        where.frameworkId = { in: input.frameworkIds };
      }

      if (input.search) {
        where.OR = [
          { controlId: { contains: input.search, mode: "insensitive" } },
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Get controls with link counts
      const controls = await ctx.db.control.findMany({
        where,
        include: {
          Framework: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: {
              RiskLinks: true,
              FindingLinks: true,
            },
          },
        },
        orderBy:
          input.sortBy === "framework"
            ? { Framework: { code: input.sortOrder } }
            : input.sortBy === "riskCount" || input.sortBy === "findingCount"
              ? undefined // Will sort in memory
              : { [input.sortBy]: input.sortOrder },
        skip: input.page * input.pageSize,
        take: input.pageSize + 1, // Take one extra to check for more pages
      });

      // Calculate health for each control
      const controlsWithHealth = await Promise.all(
        controls.slice(0, input.pageSize).map(async (control) => {
          // Get link types for health calculation
          const [riskLinks, findingLinks] = await Promise.all([
            ctx.db.riskControlLink.findMany({
              where: { controlId: control.id },
              select: { linkType: true },
            }),
            ctx.db.findingControlLink.findMany({
              where: { controlId: control.id },
              select: { linkType: true },
            }),
          ]);

          // Calculate health
          const hasCritical =
            riskLinks.some((l) => l.linkType === "GAP") ||
            findingLinks.some((l) => l.linkType === "VIOLATION");
          const hasAtRisk =
            riskLinks.some((l) => l.linkType === "AFFECTED") ||
            findingLinks.some((l) => l.linkType === "WEAKNESS");

          const health: "CRITICAL" | "AT_RISK" | "HEALTHY" = hasCritical
            ? "CRITICAL"
            : hasAtRisk
              ? "AT_RISK"
              : "HEALTHY";

          return {
            id: control.id,
            controlId: control.controlId,
            title: control.title,
            description: control.description,
            guidance: control.guidance,
            isActive: control.isActive,
            isCustom: control.isCustom,
            isOscalImported: control.isOscalImported,
            framework: control.Framework,
            riskCount: control._count.RiskLinks,
            findingCount: control._count.FindingLinks,
            health,
          };
        }),
      );

      // Apply health filter if specified
      let filteredControls = controlsWithHealth;
      if (input.health) {
        filteredControls = controlsWithHealth.filter((c) => c.health === input.health);
      }
      if (input.hasRisks === true) {
        filteredControls = filteredControls.filter((c) => c.riskCount > 0);
      }
      if (input.hasFindings === true) {
        filteredControls = filteredControls.filter((c) => c.findingCount > 0);
      }

      // Sort by risk/finding count if needed
      if (input.sortBy === "riskCount") {
        filteredControls.sort((a, b) =>
          input.sortOrder === "asc" ? a.riskCount - b.riskCount : b.riskCount - a.riskCount,
        );
      } else if (input.sortBy === "findingCount") {
        filteredControls.sort((a, b) =>
          input.sortOrder === "asc"
            ? a.findingCount - b.findingCount
            : b.findingCount - a.findingCount,
        );
      }

      // Get total count for pagination
      const total = await ctx.db.control.count({ where });

      return {
        controls: filteredControls,
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: controls.length > input.pageSize,
      };
    }),

  /**
   * Get control library summary statistics
   */
  getControlLibrarySummary: organizationProcedure.query(async ({ ctx }) => {
    const [totalControls, activeControls, inactiveControls, customControls] = await Promise.all([
      ctx.db.control.count({
        where: { organizationId: ctx.organizationId! },
      }),
      ctx.db.control.count({
        where: { organizationId: ctx.organizationId!, isActive: true },
      }),
      ctx.db.control.count({
        where: { organizationId: ctx.organizationId!, isActive: false },
      }),
      ctx.db.control.count({
        where: { organizationId: ctx.organizationId!, isCustom: true },
      }),
    ]);

    // Get controls with GAP or VIOLATION links
    const controlsWithGaps = await ctx.db.control.count({
      where: {
        organizationId: ctx.organizationId!,
        isActive: true,
        OR: [
          { RiskLinks: { some: { linkType: "GAP" } } },
          { FindingLinks: { some: { linkType: "VIOLATION" } } },
        ],
      },
    });

    // Get controls with AFFECTED or WEAKNESS links
    const controlsAtRisk = await ctx.db.control.count({
      where: {
        organizationId: ctx.organizationId!,
        isActive: true,
        OR: [
          { RiskLinks: { some: { linkType: "AFFECTED" } } },
          { FindingLinks: { some: { linkType: "WEAKNESS" } } },
        ],
        NOT: {
          OR: [
            { RiskLinks: { some: { linkType: "GAP" } } },
            { FindingLinks: { some: { linkType: "VIOLATION" } } },
          ],
        },
      },
    });

    return {
      totalControls,
      activeControls,
      inactiveControls,
      customControls,
      controlsWithGaps,
      controlsAtRisk,
      healthyControls: activeControls - controlsWithGaps - controlsAtRisk,
    };
  }),
});
