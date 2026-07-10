/**
 * Person Management tRPC Router
 *
 * Handles CRUD operations for Person entities used for accountability tracking
 * across risk assessments and treatment actions.
 *
 * **Key Difference from User:**
 * - User = system account with login credentials
 * - Person = stakeholder for accountability (may or may not have system access)
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN can manage
 */

import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
} from "@/server/api/trpc";
import { AuditAction, UserRole } from "@prisma/client";
import { WRITE_ROLES } from "@/lib/auth/roles";

// Zod schemas for input validation
const createPersonSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
});

const updatePersonSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(200).optional(),
  email: z.string().email().optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const searchPersonSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
  includeInactive: z.boolean().default(false),
});

const listPersonSchema = z.object({
  includeInactive: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(50),
});

// Allowed roles for person management (write tier)
const PERSON_MANAGEMENT_ROLES: UserRole[] = [...WRITE_ROLES];

export const personRouter = createTRPCRouter({
  /**
   * List all persons with pagination
   *
   * Returns active persons by default, with optional filtering
   */
  list: organizationProcedure
    .input(listPersonSchema)
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const where = {
        organizationId: ctx.organizationId!,
        ...(input.includeInactive ? {} : { isActive: true }),
        ...(input.businessUnitId ? { businessUnitId: input.businessUnitId } : {}),
      };

      const [persons, total] = await Promise.all([
        ctx.db.person.findMany({
          where,
          include: {
            businessUnit: {
              select: { id: true, name: true },
            },
            _count: {
              select: {
                treatmentAssignments: true,
                riskAssessmentOwner: true,
              },
            },
          },
          orderBy: { name: "asc" },
          skip,
          take: input.limit,
        }),
        ctx.db.person.count({ where }),
      ]);

      return {
        items: persons,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /**
   * Get all active persons (simple list for dropdowns)
   *
   * Returns minimal data for performance
   */
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.person.findMany({
      where: {
        organizationId: ctx.organizationId!,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        businessUnitId: true,
        businessUnit: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  /**
   * Get single person by ID
   */
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const person = await ctx.db.person.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
        include: {
          businessUnit: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              treatmentAssignments: true,
              riskAssessmentOwner: true,
            },
          },
        },
      });

      if (!person) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found",
        });
      }

      return person;
    }),

  /**
   * Search persons by name or email
   *
   * Used for typeahead/autocomplete in forms
   */
  search: organizationProcedure
    .input(searchPersonSchema)
    .query(async ({ ctx, input }) => {
      return ctx.db.person.findMany({
        where: {
          organizationId: ctx.organizationId!,
          ...(input.includeInactive ? {} : { isActive: true }),
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          businessUnitId: true,
          businessUnit: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  /**
   * Create a new person
   *
   * Restricted to GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN
   */
  create: organizationProcedure
    .input(createPersonSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!PERSON_MANAGEMENT_ROLES.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create persons",
        });
      }

      // Validate business unit if provided
      if (input.businessUnitId) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId: ctx.organizationId!,
            isActive: true,
          },
        });
        if (!bu) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit",
          });
        }
      }

      // Check for duplicate email within organization
      if (input.email) {
        const existing = await ctx.db.person.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            email: input.email,
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A person with this email already exists",
          });
        }
      }

      const newPerson = await ctx.db.person.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          email: input.email ?? null,
          jobTitle: input.jobTitle ?? null,
          businessUnitId: input.businessUnitId ?? null,
          isActive: true,
        },
        include: {
          businessUnit: {
            select: { id: true, name: true },
          },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "Person",
          entityId: newPerson.id,
          changes: {
            action: "CREATE",
            name: input.name,
            email: input.email,
            jobTitle: input.jobTitle,
            businessUnitId: input.businessUnitId,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return newPerson;
    }),

  /**
   * Quick create person inline
   *
   * Used for inline creation in forms (PersonPicker component).
   * Returns existing person if email matches.
   */
  quickCreate: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(200),
        email: z.string().email().optional(),
        jobTitle: z.string().max(100).optional(),
        businessUnitId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!PERSON_MANAGEMENT_ROLES.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create persons",
        });
      }

      // If email provided, check for existing
      if (input.email) {
        const existing = await ctx.db.person.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            email: input.email,
          },
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
            businessUnitId: true,
            isActive: true,
          },
        });

        if (existing) {
          return { ...existing, created: false };
        }
      }

      // Create new person
      const newPerson = await ctx.db.person.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          name: input.name,
          email: input.email ?? null,
          jobTitle: input.jobTitle ?? null,
          businessUnitId: input.businessUnitId ?? null,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          businessUnitId: true,
          isActive: true,
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "Person",
          entityId: newPerson.id,
          changes: {
            action: "QUICK_CREATE",
            name: input.name,
            email: input.email,
            source: "inline_form",
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { ...newPerson, created: true };
    }),

  /**
   * Update person
   *
   * Restricted to GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN
   */
  update: organizationProcedure
    .input(updatePersonSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!PERSON_MANAGEMENT_ROLES.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update persons",
        });
      }

      // Verify person exists
      const existing = await ctx.db.person.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found",
        });
      }

      // Validate business unit if changing
      if (input.businessUnitId !== undefined && input.businessUnitId !== null) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId: ctx.organizationId!,
            isActive: true,
          },
        });
        if (!bu) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid business unit",
          });
        }
      }

      // Check email uniqueness if changing
      if (input.email && input.email !== existing.email) {
        const emailConflict = await ctx.db.person.findFirst({
          where: {
            organizationId: ctx.organizationId!,
            email: input.email,
            id: { not: input.id },
          },
        });
        if (emailConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A person with this email already exists",
          });
        }
      }

      const updatedPerson = await ctx.db.person.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle }),
          ...(input.businessUnitId !== undefined && { businessUnitId: input.businessUnitId }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          businessUnit: {
            select: { id: true, name: true },
          },
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "Person",
          entityId: input.id,
          changes: {
            action: "UPDATE",
            before: {
              name: existing.name,
              email: existing.email,
              jobTitle: existing.jobTitle,
              businessUnitId: existing.businessUnitId,
              isActive: existing.isActive,
            },
            after: {
              name: updatedPerson.name,
              email: updatedPerson.email,
              jobTitle: updatedPerson.jobTitle,
              businessUnitId: updatedPerson.businessUnitId,
              isActive: updatedPerson.isActive,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return updatedPerson;
    }),

  /**
   * Soft delete person
   *
   * Sets isActive = false. Person data retained for audit trail.
   */
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!PERSON_MANAGEMENT_ROLES.includes(ctx.session!.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete persons",
        });
      }

      // Verify person exists
      const existing = await ctx.db.person.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Person not found",
        });
      }

      // Soft delete
      await ctx.db.person.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: AuditAction.SYSTEM_CONFIGURATION_CHANGED,
          entityType: "Person",
          entityId: input.id,
          changes: {
            action: "DELETE",
            name: existing.name,
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      return { success: true };
    }),
});
