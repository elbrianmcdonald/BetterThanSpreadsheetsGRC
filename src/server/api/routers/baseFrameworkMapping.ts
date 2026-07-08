/**
 * Base Framework Mapping Router
 *
 * tRPC router for Base-Centric Control Mapping operations.
 *
 * Feature: Base-Centric Control Mapping
 * - Set/get/clear base (framework OR standard) configuration
 * - Base-centric view: base controls with their mapped source controls
 * - Create/update/delete control mappings (many sources → one base)
 * - Coverage statistics and gap analysis
 * - Export mappings
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UserRole, FrameworkMappingType, BaseType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  requireRole,
} from "@/server/api/trpc";

/**
 * Roles that can manage base framework mappings
 */
const MAPPING_MANAGE_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Roles that can view base framework mappings
 */
const MAPPING_VIEW_ROLES = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
  UserRole.SECURITY_ENGINEER,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

// =============================================================================
// Input Schemas
// =============================================================================

const setBaseSchema = z.object({
  baseType: z.nativeEnum(BaseType),
  baseId: z.string().min(1, "Base ID is required"),
});

const createMappingSchema = z.object({
  sourceControlId: z.string().min(1, "Source control ID is required"),
  targetControlId: z.string().min(1, "Target control ID is required"),
  mappingType: z.nativeEnum(FrameworkMappingType).default(FrameworkMappingType.EQUIVALENT),
  confidence: z.number().int().min(0).max(100).default(100),
  notes: z.string().optional().nullable(),
});

// Bulk create mappings to a single base control
const createMappingsSchema = z.object({
  targetControlId: z.string().min(1, "Target (base) control ID is required"),
  mappings: z.array(z.object({
    sourceType: z.nativeEnum(BaseType),
    sourceControlId: z.string().min(1, "Source control ID is required"),
    mappingType: z.nativeEnum(FrameworkMappingType).default(FrameworkMappingType.EQUIVALENT),
    notes: z.string().optional().nullable(),
  })).min(1).max(50),
});

const updateMappingSchema = z.object({
  id: z.string().min(1, "Mapping ID is required"),
  mappingType: z.nativeEnum(FrameworkMappingType).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
});

const deleteMappingSchema = z.object({
  id: z.string().min(1, "Mapping ID is required"),
});

const bulkDeleteMappingsSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

const getBaseControlsWithMappingsSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  showMappedOnly: z.boolean().optional(),
  showUnmappedOnly: z.boolean().optional(),
  domainIds: z.array(z.string()).optional(), // Filter by control domains
});

const getAvailableSourceControlsSchema = z.object({
  sourceType: z.nativeEnum(BaseType),
  sourceId: z.string().min(1),
  search: z.string().optional(),
  excludeBaseControls: z.boolean().default(true),
});

const exportMappingsSchema = z.object({
  frameworkId: z.string().optional(), // If not provided, export all
});

// =============================================================================
// Router
// =============================================================================

export const baseFrameworkMappingRouter = createTRPCRouter({
  // =========================================================================
  // Base Configuration
  // =========================================================================

  /**
   * Get current base (framework or standard) for the organization
   */
  getBase: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: {
          baseType: true,
          baseFrameworkId: true,
          baseStandardId: true,
          BaseFramework: {
            select: {
              id: true,
              code: true,
              name: true,
              version: true,
              _count: { select: { Control: true } },
            },
          },
          BaseStandard: {
            select: {
              id: true,
              title: true,
              _count: { select: { Controls: true } },
            },
          },
        },
      });

      if (!org?.baseType) {
        return null;
      }

      if (org.baseType === BaseType.FRAMEWORK && org.BaseFramework) {
        return {
          baseType: BaseType.FRAMEWORK,
          id: org.BaseFramework.id,
          code: org.BaseFramework.code,
          name: org.BaseFramework.name,
          version: org.BaseFramework.version,
          controlCount: org.BaseFramework._count.Control,
        };
      }

      if (org.baseType === BaseType.STANDARD && org.BaseStandard) {
        return {
          baseType: BaseType.STANDARD,
          id: org.BaseStandard.id,
          code: null,
          name: org.BaseStandard.title,
          version: null,
          controlCount: org.BaseStandard._count.Controls,
        };
      }

      return null;
    }),

  /**
   * Set base (framework or standard) for the organization
   */
  setBase: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(setBaseSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.baseType === BaseType.FRAMEWORK) {
        // Validate framework exists and is active
        const framework = await ctx.db.framework.findFirst({
          where: {
            id: input.baseId,
            organizationId: ctx.organizationId!,
            isActive: true,
          },
        });

        if (!framework) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Framework not found or not active",
          });
        }

        await ctx.db.organization.update({
          where: { id: ctx.organizationId! },
          data: {
            baseType: BaseType.FRAMEWORK,
            baseFrameworkId: input.baseId,
            baseStandardId: null,
          },
        });

        return { success: true, baseType: BaseType.FRAMEWORK, baseId: input.baseId };
      } else {
        // Validate standard exists
        const standard = await ctx.db.standard.findFirst({
          where: {
            id: input.baseId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!standard) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Standard not found",
          });
        }

        await ctx.db.organization.update({
          where: { id: ctx.organizationId! },
          data: {
            baseType: BaseType.STANDARD,
            baseFrameworkId: null,
            baseStandardId: input.baseId,
          },
        });

        return { success: true, baseType: BaseType.STANDARD, baseId: input.baseId };
      }
    }),

  /**
   * Clear base setting
   */
  clearBase: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .mutation(async ({ ctx }) => {
      await ctx.db.organization.update({
        where: { id: ctx.organizationId! },
        data: {
          baseType: null,
          baseFrameworkId: null,
          baseStandardId: null,
        },
      });

      return { success: true };
    }),

  // =========================================================================
  // Base-Centric View: Base Controls with Mappings
  // =========================================================================

  /**
   * Get base controls with all their mappings (base-centric view)
   */
  getBaseControlsWithMappings: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .input(getBaseControlsWithMappingsSchema)
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize, showMappedOnly, showUnmappedOnly, domainIds } = input;

      // Get organization's base configuration
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: {
          baseType: true,
          baseFrameworkId: true,
          baseStandardId: true,
        },
      });

      if (!org?.baseType) {
        return { controls: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
      }

      // Handle FRAMEWORK base type
      if (org.baseType === BaseType.FRAMEWORK && org.baseFrameworkId) {
        // Build where clause with optional domain filter
        const where: Prisma.ControlWhereInput = {
          frameworkId: org.baseFrameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
          ...(search && {
            OR: [
              { controlId: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }),
          // Filter by domain tags if specified
          ...(domainIds && domainIds.length > 0 && {
            ControlDomains: {
              some: {
                controlDomainId: { in: domainIds },
              },
            },
          }),
        };

        // Get base controls with mappings and domains
        const [allControls, total] = await Promise.all([
          ctx.db.control.findMany({
            where,
            orderBy: { controlId: "asc" },
            select: {
              id: true,
              controlId: true,
              title: true,
              description: true,
              ControlDomains: {
                select: {
                  ControlDomain: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
              TargetMappings: {
                select: {
                  id: true,
                  mappingType: true,
                  confidence: true,
                  notes: true,
                  SourceControl: {
                    select: {
                      id: true,
                      controlId: true,
                      title: true,
                      Framework: {
                        select: { id: true, code: true, name: true },
                      },
                    },
                  },
                },
              },
            },
          }),
          ctx.db.control.count({ where }),
        ]);

        // Apply mapped/unmapped filter
        let filteredControls = allControls;
        if (showMappedOnly) {
          filteredControls = allControls.filter((c) => c.TargetMappings.length > 0);
        } else if (showUnmappedOnly) {
          filteredControls = allControls.filter((c) => c.TargetMappings.length === 0);
        }

        // Apply pagination after filtering
        const paginatedControls = filteredControls.slice(
          (page - 1) * pageSize,
          page * pageSize
        );

        const controls = paginatedControls.map((c) => ({
          id: c.id,
          controlId: c.controlId,
          title: c.title,
          description: c.description,
          domains: c.ControlDomains.map((cd) => cd.ControlDomain),
          mappings: c.TargetMappings.map((m) => ({
            id: m.id,
            sourceType: BaseType.FRAMEWORK,
            sourceFramework: m.SourceControl.Framework,
            sourceStandard: null,
            sourceControl: {
              id: m.SourceControl.id,
              controlId: m.SourceControl.controlId,
              title: m.SourceControl.title,
            },
            mappingType: m.mappingType,
            confidence: m.confidence,
            notes: m.notes,
          })),
          mappingCount: c.TargetMappings.length,
        }));

        const filteredTotal = showMappedOnly || showUnmappedOnly
          ? filteredControls.length
          : total;

        return {
          controls,
          pagination: {
            page,
            pageSize,
            total: filteredTotal,
            totalPages: Math.ceil(filteredTotal / pageSize),
          },
        };
      }

      // Handle STANDARD base type
      if (org.baseType === BaseType.STANDARD && org.baseStandardId) {
        // Build where clause with optional domain filter
        const where: Prisma.StandardControlWhereInput = {
          standardId: org.baseStandardId,
          ...(search && {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }),
          // Filter by domain tags if specified
          ...(domainIds && domainIds.length > 0 && {
            ControlDomains: {
              some: {
                controlDomainId: { in: domainIds },
              },
            },
          }),
        };

        // Get standard controls with framework mappings and domains
        const [allControls, total] = await Promise.all([
          ctx.db.standardControl.findMany({
            where,
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              code: true,
              title: true,
              description: true,
              ControlDomains: {
                select: {
                  ControlDomain: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
              FrameworkMappings: {
                select: {
                  id: true,
                  mappingType: true,
                  notes: true,
                  FrameworkControl: {
                    select: {
                      id: true,
                      controlId: true,
                      title: true,
                      Framework: {
                        select: { id: true, code: true, name: true },
                      },
                    },
                  },
                },
              },
            },
          }),
          ctx.db.standardControl.count({ where }),
        ]);

        // Apply mapped/unmapped filter
        let filteredControls = allControls;
        if (showMappedOnly) {
          filteredControls = allControls.filter((c) => c.FrameworkMappings.length > 0);
        } else if (showUnmappedOnly) {
          filteredControls = allControls.filter((c) => c.FrameworkMappings.length === 0);
        }

        // Apply pagination after filtering
        const paginatedControls = filteredControls.slice(
          (page - 1) * pageSize,
          page * pageSize
        );

        const controls = paginatedControls.map((c) => ({
          id: c.id,
          controlId: c.code,
          title: c.title,
          description: c.description,
          domains: c.ControlDomains.map((cd) => cd.ControlDomain),
          mappings: c.FrameworkMappings.map((m) => ({
            id: m.id,
            sourceType: BaseType.FRAMEWORK,
            sourceFramework: m.FrameworkControl.Framework,
            sourceStandard: null,
            sourceControl: {
              id: m.FrameworkControl.id,
              controlId: m.FrameworkControl.controlId,
              title: m.FrameworkControl.title,
            },
            mappingType: m.mappingType,
            confidence: 100, // StandardControlMapping doesn't have confidence
            notes: m.notes,
          })),
          mappingCount: c.FrameworkMappings.length,
        }));

        const filteredTotal = showMappedOnly || showUnmappedOnly
          ? filteredControls.length
          : total;

        return {
          controls,
          pagination: {
            page,
            pageSize,
            total: filteredTotal,
            totalPages: Math.ceil(filteredTotal / pageSize),
          },
        };
      }

      return { controls: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    }),

  /**
   * Get available source controls for mapping dialog
   */
  getAvailableSourceControls: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .input(getAvailableSourceControlsSchema)
    .query(async ({ ctx, input }) => {
      const { sourceType, sourceId, search, excludeBaseControls } = input;

      // Get base framework/standard ID to exclude if needed
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true, baseStandardId: true },
      });

      if (sourceType === BaseType.FRAMEWORK) {
        // Exclude base framework controls if requested
        if (excludeBaseControls && org?.baseType === BaseType.FRAMEWORK && sourceId === org.baseFrameworkId) {
          return [];
        }

        const where = {
          frameworkId: sourceId,
          organizationId: ctx.organizationId!,
          isActive: true,
          ...(search && {
            OR: [
              { controlId: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const controls = await ctx.db.control.findMany({
          where,
          orderBy: { controlId: "asc" },
          take: 100,
          select: {
            id: true,
            controlId: true,
            title: true,
            description: true,
            Framework: { select: { id: true, code: true, name: true } },
          },
        });

        return controls.map((c) => ({
          id: c.id,
          controlId: c.controlId,
          title: c.title,
          description: c.description,
          sourceType: BaseType.FRAMEWORK,
          framework: c.Framework,
          standard: null,
        }));
      } else {
        // Standard as source
        // Exclude base standard controls if requested
        if (excludeBaseControls && org?.baseType === BaseType.STANDARD && sourceId === org.baseStandardId) {
          return [];
        }

        const where = {
          standardId: sourceId,
          ...(search && {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        };

        const controls = await ctx.db.standardControl.findMany({
          where,
          orderBy: { sortOrder: "asc" },
          take: 100,
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            Standard: { select: { id: true, title: true } },
          },
        });

        return controls.map((c) => ({
          id: c.id,
          controlId: c.code,
          title: c.title,
          description: c.description,
          sourceType: BaseType.STANDARD,
          framework: null,
          standard: c.Standard,
        }));
      }
    }),

  /**
   * Get available frameworks for source selection (excluding base)
   */
  getAvailableSourceFrameworks: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true },
      });

      const excludeId = org?.baseType === BaseType.FRAMEWORK ? org.baseFrameworkId : null;

      const frameworks = await ctx.db.framework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          ...(excludeId && { id: { not: excludeId } }),
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          version: true,
          _count: { select: { Control: true } },
        },
      });

      return frameworks;
    }),

  /**
   * Get available standards for source selection (excluding base)
   */
  getAvailableSourceStandards: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseStandardId: true },
      });

      const excludeId = org?.baseType === BaseType.STANDARD ? org.baseStandardId : null;

      const standards = await ctx.db.standard.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(excludeId && { id: { not: excludeId } }),
        },
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          _count: { select: { Controls: true } },
        },
      });

      return standards;
    }),

  // =========================================================================
  // Mapping CRUD Operations
  // =========================================================================

  /**
   * Create mappings to a base control (bulk operation)
   */
  createMappings: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(createMappingsSchema)
    .mutation(async ({ ctx, input }) => {
      // Get base configuration
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true, baseStandardId: true },
      });

      if (!org?.baseType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No base has been set",
        });
      }

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      };

      // Handle FRAMEWORK base type
      if (org.baseType === BaseType.FRAMEWORK && org.baseFrameworkId) {
        // Validate target control exists and is in base framework
        const targetControl = await ctx.db.control.findFirst({
          where: {
            id: input.targetControlId,
            frameworkId: org.baseFrameworkId,
            organizationId: ctx.organizationId!,
          },
        });

        if (!targetControl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target control not found in base framework",
          });
        }

        for (const mapping of input.mappings) {
          try {
            if (mapping.sourceType !== BaseType.FRAMEWORK) {
              results.errors.push(`Cannot map standard controls to framework base (${mapping.sourceControlId})`);
              continue;
            }

            // Validate source control
            const sourceControl = await ctx.db.control.findFirst({
              where: {
                id: mapping.sourceControlId,
                organizationId: ctx.organizationId!,
              },
              select: { id: true, frameworkId: true },
            });

            if (!sourceControl) {
              results.errors.push(`Source control ${mapping.sourceControlId} not found`);
              continue;
            }

            if (sourceControl.frameworkId === org.baseFrameworkId) {
              results.errors.push(`Source control ${mapping.sourceControlId} cannot be from base framework`);
              continue;
            }

            // Check for existing mapping
            const existing = await ctx.db.frameworkControlMapping.findFirst({
              where: {
                sourceControlId: mapping.sourceControlId,
                targetControlId: input.targetControlId,
              },
            });

            if (existing) {
              results.skipped++;
              continue;
            }

            // Create mapping
            await ctx.db.frameworkControlMapping.create({
              data: {
                id: randomUUID(),
                organizationId: ctx.organizationId!,
                sourceControlId: mapping.sourceControlId,
                targetControlId: input.targetControlId,
                mappingType: mapping.mappingType,
                confidence: 100,
                notes: mapping.notes ?? null,
                createdById: ctx.session!.user.id,
              },
            });

            results.created++;
          } catch (error) {
            results.errors.push(`Error creating mapping for ${mapping.sourceControlId}: ${String(error)}`);
          }
        }
      }

      // Handle STANDARD base type
      if (org.baseType === BaseType.STANDARD && org.baseStandardId) {
        // Validate target control exists and is in base standard
        const targetControl = await ctx.db.standardControl.findFirst({
          where: {
            id: input.targetControlId,
            standardId: org.baseStandardId,
          },
        });

        if (!targetControl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target control not found in base standard",
          });
        }

        for (const mapping of input.mappings) {
          try {
            if (mapping.sourceType !== BaseType.FRAMEWORK) {
              results.errors.push(`Cannot map standard controls to standard base (${mapping.sourceControlId})`);
              continue;
            }

            // Validate source control (framework control)
            const sourceControl = await ctx.db.control.findFirst({
              where: {
                id: mapping.sourceControlId,
                organizationId: ctx.organizationId!,
              },
            });

            if (!sourceControl) {
              results.errors.push(`Source control ${mapping.sourceControlId} not found`);
              continue;
            }

            // Check for existing mapping
            const existing = await ctx.db.standardControlMapping.findFirst({
              where: {
                standardControlId: input.targetControlId,
                controlId: mapping.sourceControlId,
              },
            });

            if (existing) {
              results.skipped++;
              continue;
            }

            // Create standard control mapping
            await ctx.db.standardControlMapping.create({
              data: {
                id: randomUUID(),
                standardControlId: input.targetControlId,
                controlId: mapping.sourceControlId,
                mappingType: mapping.mappingType,
                notes: mapping.notes ?? null,
                createdById: ctx.session!.user.id,
              },
            });

            results.created++;
          } catch (error) {
            results.errors.push(`Error creating mapping for ${mapping.sourceControlId}: ${String(error)}`);
          }
        }
      }

      return results;
    }),

  /**
   * Create a single framework-to-framework mapping (legacy support)
   */
  createMapping: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(createMappingSchema)
    .mutation(async ({ ctx, input }) => {
      // Get base framework ID
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true },
      });

      if (org?.baseType !== BaseType.FRAMEWORK || !org.baseFrameworkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No base framework has been set",
        });
      }

      // Validate source control exists and belongs to org
      const sourceControl = await ctx.db.control.findFirst({
        where: {
          id: input.sourceControlId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, frameworkId: true },
      });

      if (!sourceControl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source control not found",
        });
      }

      // Validate target control exists and belongs to org
      const targetControl = await ctx.db.control.findFirst({
        where: {
          id: input.targetControlId,
          organizationId: ctx.organizationId!,
        },
        select: { id: true, frameworkId: true },
      });

      if (!targetControl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target control not found",
        });
      }

      // Validate source is NOT from base framework
      if (sourceControl.frameworkId === org.baseFrameworkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source control cannot be from the base framework",
        });
      }

      // Validate target IS from base framework
      if (targetControl.frameworkId !== org.baseFrameworkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target control must be from the base framework",
        });
      }

      // Check for duplicate mapping
      const existing = await ctx.db.frameworkControlMapping.findFirst({
        where: {
          sourceControlId: input.sourceControlId,
          targetControlId: input.targetControlId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This mapping already exists",
        });
      }

      const mapping = await ctx.db.frameworkControlMapping.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          sourceControlId: input.sourceControlId,
          targetControlId: input.targetControlId,
          mappingType: input.mappingType,
          confidence: input.confidence,
          notes: input.notes ?? null,
          createdById: ctx.session!.user.id,
        },
        include: {
          SourceControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
              Framework: { select: { id: true, code: true, name: true } },
            },
          },
          TargetControl: {
            select: {
              id: true,
              controlId: true,
              title: true,
            },
          },
        },
      });

      return mapping;
    }),

  /**
   * Update a mapping
   */
  updateMapping: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(updateMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Get base type to determine which table to update
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true },
      });

      if (org?.baseType === BaseType.FRAMEWORK) {
        const existing = await ctx.db.frameworkControlMapping.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId!,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mapping not found",
          });
        }

        const mapping = await ctx.db.frameworkControlMapping.update({
          where: { id },
          data: {
            ...(data.mappingType !== undefined && { mappingType: data.mappingType }),
            ...(data.confidence !== undefined && { confidence: data.confidence }),
            ...(data.notes !== undefined && { notes: data.notes }),
          },
          include: {
            SourceControl: {
              select: {
                id: true,
                controlId: true,
                title: true,
                Framework: { select: { id: true, code: true, name: true } },
              },
            },
            TargetControl: {
              select: {
                id: true,
                controlId: true,
                title: true,
              },
            },
          },
        });

        return mapping;
      } else if (org?.baseType === BaseType.STANDARD) {
        // Update StandardControlMapping
        const existing = await ctx.db.standardControlMapping.findFirst({
          where: { id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mapping not found",
          });
        }

        const mapping = await ctx.db.standardControlMapping.update({
          where: { id },
          data: {
            ...(data.mappingType !== undefined && { mappingType: data.mappingType }),
            ...(data.notes !== undefined && { notes: data.notes }),
          },
          include: {
            StandardControl: {
              select: { id: true, code: true, title: true },
            },
            FrameworkControl: {
              select: {
                id: true,
                controlId: true,
                title: true,
                Framework: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        return mapping;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No base has been set",
      });
    }),

  /**
   * Delete a single mapping
   */
  deleteMapping: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(deleteMappingSchema)
    .mutation(async ({ ctx, input }) => {
      // Get base type to determine which table to delete from
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true },
      });

      if (org?.baseType === BaseType.FRAMEWORK) {
        const existing = await ctx.db.frameworkControlMapping.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId!,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mapping not found",
          });
        }

        await ctx.db.frameworkControlMapping.delete({
          where: { id: input.id },
        });

        return { success: true };
      } else if (org?.baseType === BaseType.STANDARD) {
        const existing = await ctx.db.standardControlMapping.findFirst({
          where: { id: input.id },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Mapping not found",
          });
        }

        await ctx.db.standardControlMapping.delete({
          where: { id: input.id },
        });

        return { success: true };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No base has been set",
      });
    }),

  /**
   * Bulk delete mappings (max 100)
   */
  bulkDeleteMappings: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(bulkDeleteMappingsSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true },
      });

      if (org?.baseType === BaseType.FRAMEWORK) {
        const result = await ctx.db.frameworkControlMapping.deleteMany({
          where: {
            id: { in: input.ids },
            organizationId: ctx.organizationId!,
          },
        });
        return { deleted: result.count };
      } else if (org?.baseType === BaseType.STANDARD) {
        const result = await ctx.db.standardControlMapping.deleteMany({
          where: { id: { in: input.ids } },
        });
        return { deleted: result.count };
      }

      return { deleted: 0 };
    }),

  // =========================================================================
  // Coverage & Analysis
  // =========================================================================

  /**
   * Get comprehensive coverage statistics
   */
  getCoverageStatistics: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true, baseStandardId: true },
      });

      if (!org?.baseType) {
        return null;
      }

      if (org.baseType === BaseType.FRAMEWORK && org.baseFrameworkId) {
        // Get base framework controls
        const baseControls = await ctx.db.control.findMany({
          where: {
            frameworkId: org.baseFrameworkId,
            organizationId: ctx.organizationId!,
            isActive: true,
          },
          select: { id: true },
        });

        const baseControlIds = baseControls.map((c) => c.id);

        // Get all mappings to base controls
        const mappings = await ctx.db.frameworkControlMapping.findMany({
          where: {
            organizationId: ctx.organizationId!,
            targetControlId: { in: baseControlIds },
          },
          select: {
            targetControlId: true,
            mappingType: true,
            confidence: true,
          },
        });

        // Calculate coverage
        const mappedControlIds = new Set(mappings.map((m) => m.targetControlId));
        const totalBaseControls = baseControls.length;
        const coveredControls = mappedControlIds.size;

        // Group by mapping type
        const typeBreakdown = {
          EQUIVALENT: 0,
          SUBSET_OF: 0,
          SUPERSET_OF: 0,
          INTERSECTS: 0,
        };
        for (const m of mappings) {
          typeBreakdown[m.mappingType]++;
        }

        // Calculate average confidence
        const avgConfidence =
          mappings.length > 0
            ? Math.round(
                mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
              )
            : 0;

        return {
          totalBaseControls,
          coveredControls,
          uncoveredControls: totalBaseControls - coveredControls,
          coveragePercentage:
            totalBaseControls > 0
              ? Math.round((coveredControls / totalBaseControls) * 100)
              : 0,
          totalMappings: mappings.length,
          typeBreakdown,
          avgConfidence,
        };
      }

      if (org.baseType === BaseType.STANDARD && org.baseStandardId) {
        // Get base standard controls
        const baseControls = await ctx.db.standardControl.findMany({
          where: { standardId: org.baseStandardId },
          select: { id: true },
        });

        const baseControlIds = baseControls.map((c) => c.id);

        // Get all mappings to base controls
        const mappings = await ctx.db.standardControlMapping.findMany({
          where: { standardControlId: { in: baseControlIds } },
          select: {
            standardControlId: true,
            mappingType: true,
          },
        });

        // Calculate coverage
        const mappedControlIds = new Set(mappings.map((m) => m.standardControlId));
        const totalBaseControls = baseControls.length;
        const coveredControls = mappedControlIds.size;

        // Group by mapping type
        const typeBreakdown = {
          EQUIVALENT: 0,
          SUBSET_OF: 0,
          SUPERSET_OF: 0,
          INTERSECTS: 0,
        };
        for (const m of mappings) {
          typeBreakdown[m.mappingType]++;
        }

        return {
          totalBaseControls,
          coveredControls,
          uncoveredControls: totalBaseControls - coveredControls,
          coveragePercentage:
            totalBaseControls > 0
              ? Math.round((coveredControls / totalBaseControls) * 100)
              : 0,
          totalMappings: mappings.length,
          typeBreakdown,
          avgConfidence: 100, // StandardControlMapping doesn't have confidence
        };
      }

      return null;
    }),

  // =========================================================================
  // Export
  // =========================================================================

  /**
   * Export mappings as CSV data
   */
  exportMappings: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .input(exportMappingsSchema)
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true, baseStandardId: true },
      });

      if (!org?.baseType) {
        return { filename: "", content: "", mimeType: "text/csv" };
      }

      if (org.baseType === BaseType.FRAMEWORK && org.baseFrameworkId) {
        const where: { organizationId: string; sourceControlId?: { in: string[] } } = {
          organizationId: ctx.organizationId!,
        };

        if (input.frameworkId) {
          const controls = await ctx.db.control.findMany({
            where: {
              frameworkId: input.frameworkId,
              organizationId: ctx.organizationId!,
            },
            select: { id: true },
          });
          where.sourceControlId = { in: controls.map((c) => c.id) };
        }

        const mappings = await ctx.db.frameworkControlMapping.findMany({
          where,
          include: {
            SourceControl: {
              select: {
                controlId: true,
                title: true,
                Framework: { select: { code: true, name: true } },
              },
            },
            TargetControl: {
              select: {
                controlId: true,
                title: true,
                Framework: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: [
            { SourceControl: { Framework: { code: "asc" } } },
            { SourceControl: { controlId: "asc" } },
          ],
        });

        const headers = [
          "Base Control ID",
          "Base Control Title",
          "Source Framework",
          "Source Control ID",
          "Source Control Title",
          "Mapping Type",
          "Confidence",
          "Notes",
        ];

        const rows = mappings.map((m) => [
          m.TargetControl.controlId,
          m.TargetControl.title,
          m.SourceControl.Framework.code,
          m.SourceControl.controlId,
          m.SourceControl.title,
          m.mappingType,
          m.confidence.toString(),
          m.notes ?? "",
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        return {
          filename: `control-mappings-${new Date().toISOString().split("T")[0]}.csv`,
          content: csvContent,
          mimeType: "text/csv",
        };
      }

      if (org.baseType === BaseType.STANDARD && org.baseStandardId) {
        const mappings = await ctx.db.standardControlMapping.findMany({
          where: {
            StandardControl: { standardId: org.baseStandardId },
          },
          include: {
            StandardControl: {
              select: { code: true, title: true },
            },
            FrameworkControl: {
              select: {
                controlId: true,
                title: true,
                Framework: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: [
            { StandardControl: { code: "asc" } },
          ],
        });

        const headers = [
          "Base Control ID",
          "Base Control Title",
          "Source Framework",
          "Source Control ID",
          "Source Control Title",
          "Mapping Type",
          "Notes",
        ];

        const rows = mappings.map((m) => [
          m.StandardControl.code,
          m.StandardControl.title,
          m.FrameworkControl.Framework.code,
          m.FrameworkControl.controlId,
          m.FrameworkControl.title,
          m.mappingType,
          m.notes ?? "",
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        return {
          filename: `control-mappings-${new Date().toISOString().split("T")[0]}.csv`,
          content: csvContent,
          mimeType: "text/csv",
        };
      }

      return { filename: "", content: "", mimeType: "text/csv" };
    }),

  // =========================================================================
  // Legacy Endpoints (for backward compatibility)
  // =========================================================================

  /**
   * Get current base framework (legacy - redirects to getBase)
   */
  getBaseFramework: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: {
          baseType: true,
          baseFrameworkId: true,
          BaseFramework: {
            select: {
              id: true,
              code: true,
              name: true,
              version: true,
              _count: { select: { Control: true } },
            },
          },
        },
      });

      if (org?.baseType === BaseType.FRAMEWORK && org.BaseFramework) {
        return org.BaseFramework;
      }

      return null;
    }),

  /**
   * Set base framework (legacy)
   */
  setBaseFramework: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .input(z.object({ frameworkId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const framework = await ctx.db.framework.findFirst({
        where: {
          id: input.frameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
      });

      if (!framework) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Framework not found or not active",
        });
      }

      await ctx.db.organization.update({
        where: { id: ctx.organizationId! },
        data: {
          baseType: BaseType.FRAMEWORK,
          baseFrameworkId: input.frameworkId,
          baseStandardId: null,
        },
      });

      return { success: true, frameworkId: input.frameworkId };
    }),

  /**
   * Clear base framework (legacy)
   */
  clearBaseFramework: organizationProcedure
    .use(requireRole(MAPPING_MANAGE_ROLES))
    .mutation(async ({ ctx }) => {
      await ctx.db.organization.update({
        where: { id: ctx.organizationId! },
        data: {
          baseType: null,
          baseFrameworkId: null,
          baseStandardId: null,
        },
      });

      return { success: true };
    }),

  /**
   * Get mapping summary per source framework
   */
  listMappingSummary: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true },
      });

      if (org?.baseType !== BaseType.FRAMEWORK || !org.baseFrameworkId) {
        return { baseFramework: null, frameworks: [] };
      }

      const baseFramework = await ctx.db.framework.findFirst({
        where: { id: org.baseFrameworkId, organizationId: ctx.organizationId! },
        select: {
          id: true,
          code: true,
          name: true,
          _count: { select: { Control: true } },
        },
      });

      const frameworks = await ctx.db.framework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          isActive: true,
          id: { not: org.baseFrameworkId },
        },
        select: {
          id: true,
          code: true,
          name: true,
          version: true,
          _count: { select: { Control: true } },
        },
      });

      const mappingCounts = await ctx.db.frameworkControlMapping.groupBy({
        by: ["sourceControlId"],
        where: { organizationId: ctx.organizationId! },
        _count: { _all: true },
      });

      const sourceControlIds = mappingCounts.map((m) => m.sourceControlId);
      const sourceControls = await ctx.db.control.findMany({
        where: { id: { in: sourceControlIds } },
        select: { id: true, frameworkId: true },
      });

      const controlFrameworkMap = new Map(
        sourceControls.map((c) => [c.id, c.frameworkId])
      );

      const frameworkMappingCounts = new Map<string, number>();
      for (const m of mappingCounts) {
        const fwId = controlFrameworkMap.get(m.sourceControlId);
        if (fwId) {
          frameworkMappingCounts.set(
            fwId,
            (frameworkMappingCounts.get(fwId) ?? 0) + 1
          );
        }
      }

      const result = frameworks.map((fw) => ({
        id: fw.id,
        code: fw.code,
        name: fw.name,
        version: fw.version,
        totalControls: fw._count.Control,
        mappedControls: frameworkMappingCounts.get(fw.id) ?? 0,
        coveragePercentage:
          fw._count.Control > 0
            ? Math.round(
                ((frameworkMappingCounts.get(fw.id) ?? 0) / fw._count.Control) * 100
              )
            : 0,
      }));

      return {
        baseFramework: baseFramework
          ? {
              id: baseFramework.id,
              code: baseFramework.code,
              name: baseFramework.name,
              totalControls: baseFramework._count.Control,
            }
          : null,
        frameworks: result,
      };
    }),

  /**
   * Get unmapped base controls (legacy - gap analysis)
   */
  getUnmappedBaseControls: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true },
      });

      if (org?.baseType !== BaseType.FRAMEWORK || !org.baseFrameworkId) {
        return [];
      }

      // Get all base controls
      const baseControls = await ctx.db.control.findMany({
        where: {
          frameworkId: org.baseFrameworkId,
          organizationId: ctx.organizationId!,
          isActive: true,
        },
        select: {
          id: true,
          controlId: true,
          title: true,
        },
      });

      // Get mapped control IDs
      const mappings = await ctx.db.frameworkControlMapping.findMany({
        where: {
          organizationId: ctx.organizationId!,
        },
        select: { targetControlId: true },
        distinct: ["targetControlId"],
      });

      const mappedIds = new Set(mappings.map((m) => m.targetControlId));

      // Filter to unmapped
      const unmapped = baseControls.filter((c) => !mappedIds.has(c.id));

      return unmapped;
    }),

  /**
   * Get source framework controls with their mapping status (legacy)
   */
  getSourceControlsWithMappingStatus: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .input(z.object({
      frameworkId: z.string().min(1),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { frameworkId, search, page, pageSize } = input;

      const where = {
        frameworkId,
        organizationId: ctx.organizationId!,
        isActive: true,
        ...(search && {
          OR: [
            { controlId: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [controls, total] = await Promise.all([
        ctx.db.control.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { controlId: "asc" },
          select: {
            id: true,
            controlId: true,
            title: true,
            SourceMappings: {
              select: {
                id: true,
                targetControlId: true,
                mappingType: true,
                confidence: true,
                TargetControl: {
                  select: {
                    controlId: true,
                    title: true,
                  },
                },
              },
            },
          },
        }),
        ctx.db.control.count({ where }),
      ]);

      return {
        controls: controls.map((c) => ({
          id: c.id,
          controlId: c.controlId,
          title: c.title,
          isMapped: c.SourceMappings.length > 0,
          mappings: c.SourceMappings,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),

  /**
   * Get base framework controls for mapping target selection (legacy)
   */
  getBaseControls: organizationProcedure
    .use(requireRole(MAPPING_VIEW_ROLES))
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId! },
        select: { baseType: true, baseFrameworkId: true },
      });

      if (org?.baseType !== BaseType.FRAMEWORK || !org.baseFrameworkId) {
        return [];
      }

      const where = {
        frameworkId: org.baseFrameworkId,
        organizationId: ctx.organizationId!,
        isActive: true,
        ...(input.search && {
          OR: [
            { controlId: { contains: input.search, mode: "insensitive" as const } },
            { title: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const controls = await ctx.db.control.findMany({
        where,
        orderBy: { controlId: "asc" },
        select: { id: true, controlId: true, title: true },
        take: 100,
      });

      return controls;
    }),
});
