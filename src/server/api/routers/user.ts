/**
 * User Management tRPC Router
 *
 * Handles CRUD operations for user accounts within an organization.
 *
 * **Security Features:**
 * - Multi-tenant isolation: All operations filter by organizationId
 * - Role-based access: Only ORG_ADMIN can create/update/delete users
 * - Audit logging: All mutations logged to AuditLog table
 * - Self-delete prevention: Admin cannot delete their own account
 * - Email uniqueness: Enforced within organization (can exist across orgs)
 *
 * **Architecture Compliance:**
 * - Follows Story 1.3 multi-tenant patterns
 * - Explicit organizationId filtering (no Prisma middleware)
 * - Uses organizationProcedure for automatic tenant context
 */

import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

import {
  createTRPCRouter,
  organizationProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import {
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateAuditorFrameworksSchema,
  deleteUserSchema,
  getUserByIdSchema,
  listUsersSchema,
  bulkUpdateBusinessUnitSchema,
} from "@/schemas/user";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { generateSecurePassword, hashPassword } from "@/server/services/auth/passwordService";

export const userRouter = createTRPCRouter({
  /**
   * Create User
   *
   * Creates a new user within the current organization.
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - Email must be unique within organization
   * - Email format validated by Zod schema
   * - Role defaults to AUDITOR (most restrictive)
   *
   * **Audit:** Logs CREATE_USER action
   */
  createUser: adminProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists in this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          email: input.email,
          organizationId: ctx.organizationId!,
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists in your organization",
        });
      }

      // Generate and hash secure password for local authentication
      const generatedPassword = generateSecurePassword();
      const hashedPassword = await hashPassword(generatedPassword);

      // Story 3.8: Create user with organization isolation and framework assignments
      const newUser = await ctx.db.user.create({
        data: {
          id: randomUUID(),
          name: input.name,
          email: input.email,
          role: input.role,
          hashedPassword, // Store hashed password for local auth
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
          // Story 3.8: Assign frameworks for AUDITOR role access restriction
          assignedFrameworks: input.assignedFrameworks ?? [],
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          assignedFrameworks: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Audit log entry (Story 3.8: Include assignedFrameworks)
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "CREATE_USER",
          entityType: "User",
          entityId: newUser.id,
          changes: {
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              assignedFrameworks: newUser.assignedFrameworks,
            },
          },
        },
      });

      // Return user with generated password (one-time display to admin)
      return {
        ...newUser,
        generatedPassword, // IMPORTANT: Only shown once, admin must communicate to user
      };
    }),

  /**
   * List Users
   *
   * Returns paginated list of users in the current organization.
   *
   * **Authorization:** Any authenticated user (view-only for non-admins)
   * **Filtering:** Automatically filtered by organizationId
   * **Pagination:** Supports skip/take parameters (max 100 per page)
   *
   * **Security:** Cannot see users from other organizations
   */
  listUsers: organizationProcedure
    .input(listUsersSchema)
    .query(async ({ ctx, input }) => {
      // All users in org can list users (for assignment dropdowns, etc.)
      // Explicit organizationId filter - CRITICAL for multi-tenant isolation
      // Story 3.8: Include assignedFrameworks for AUDITOR role management
      // Story 7.0.4: Include businessUnit and support BU filtering

      // Build where clause with optional BU filter (AC4, AC5)
      const whereClause: {
        organizationId: string;
        businessUnitId?: string | null | { equals: null };
      } = {
        organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
      };

      // AC5: Filter for unassigned users (businessUnitId is null)
      if (input.filterUnassigned) {
        whereClause.businessUnitId = { equals: null };
      } else if (input.businessUnitId !== undefined) {
        // AC4: Filter by specific business unit
        whereClause.businessUnitId = input.businessUnitId;
      }

      const users = await ctx.db.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          assignedFrameworks: true,
          createdAt: true,
          updatedAt: true,
          // Story 7.0.4: Include business unit with parent for path display (AC1-AC3)
          businessUnitId: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              parentId: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parentId: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      parentId: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          parentId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        skip: input.skip,
        take: input.take,
        orderBy: { createdAt: "desc" },
      });

      // Get total count for pagination with same filter
      const total = await ctx.db.user.count({
        where: whereClause,
      });

      return {
        users,
        total,
        skip: input.skip ?? 0,
        take: input.take ?? 50,
      };
    }),

  /**
   * Get User By ID
   *
   * Returns a single user by ID if they belong to the current organization.
   *
   * **Authorization:** Any authenticated user
   * **Filtering:** Returns user only if in same organization
   *
   * **Security:** Returns null if user is in different organization
   */
  getUserById: organizationProcedure
    .input(getUserByIdSchema)
    .query(async ({ ctx, input }) => {
      // Find user only if in same organization
      // Story 3.8: Include assignedFrameworks for AUDITOR role management
      // Story 7.0.4: Include businessUnit for profile display (AC16-AC18)
      const user = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          assignedFrameworks: true,
          createdAt: true,
          updatedAt: true,
          // Story 7.0.4: Include business unit with hierarchy for path display
          businessUnitId: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              parentId: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parentId: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      parentId: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          parentId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      return user;
    }),

  /**
   * Update User
   *
   * Updates user information (name, email, role).
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - User must exist in current organization
   * - If email changed, must be unique within organization
   *
   * **Audit:** Logs UPDATE_USER action with before/after state
   */
  updateUser: adminProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // If email is being changed, check uniqueness within org
      if (input.email && input.email !== existingUser.email) {
        const emailExists = await ctx.db.user.findFirst({
          where: {
            email: input.email,
            organizationId: ctx.organizationId!,
            NOT: { id: input.id }, // Exclude current user
          },
        });

        if (emailExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this email already exists in your organization",
          });
        }
      }

      // Story 7.0.4: Validate businessUnitId if provided (AC21)
      if (input.businessUnitId !== undefined && input.businessUnitId !== null) {
        const bu = await ctx.db.businessUnit.findFirst({
          where: {
            id: input.businessUnitId,
            organizationId: ctx.organizationId!, // AC9: Only BUs from user's organization
            isActive: true,
          },
        });

        if (!bu) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Business unit not found or not in your organization",
          });
        }
      }

      // Capture before state for audit log (Story 3.8: Include assignedFrameworks, Story 7.0.4: Include businessUnitId)
      const beforeState = {
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        assignedFrameworks: existingUser.assignedFrameworks,
        businessUnitId: existingUser.businessUnitId,
      };

      // Story 3.8: Update user with optional assignedFrameworks
      // Story 7.0.4: Update user with optional businessUnitId (AC10, AC19)
      const updatedUser = await ctx.db.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          ...(input.assignedFrameworks !== undefined
            ? { assignedFrameworks: input.assignedFrameworks }
            : {}),
          ...(input.businessUnitId !== undefined
            ? { businessUnitId: input.businessUnitId }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          assignedFrameworks: true,
          createdAt: true,
          updatedAt: true,
          businessUnitId: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Audit log entry with before/after state (Story 3.8: Include assignedFrameworks, Story 7.0.4: Include businessUnitId - AC22)
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: updatedUser.id,
          changes: {
            before: beforeState,
            after: {
              name: updatedUser.name,
              email: updatedUser.email,
              role: updatedUser.role,
              assignedFrameworks: updatedUser.assignedFrameworks,
              businessUnitId: updatedUser.businessUnitId,
            },
          },
        },
      });

      return updatedUser;
    }),

  /**
   * Update User Role
   *
   * Specialized procedure for role changes.
   * Tracked separately in audit logs for compliance.
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - User must exist in current organization
   * - Cannot change own role (prevents privilege escalation/lockout)
   *
   * **Audit:** Logs UPDATE_USER_ROLE action with old/new role
   */
  updateUserRole: adminProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // Prevent admin from changing their own role (could lock themselves out)
      if (existingUser.id === ctx.session!.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      const oldRole = existingUser.role;

      // Update role
      const updatedUser = await ctx.db.user.update({
        where: { id: input.id },
        data: { role: input.role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Audit log entry for role change
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "UPDATE_USER_ROLE",
          entityType: "User",
          entityId: updatedUser.id,
          changes: {
            userId: updatedUser.id,
            userName: updatedUser.name,
            oldRole,
            newRole: updatedUser.role,
          },
        },
      });

      return updatedUser;
    }),

  /**
   * Delete User
   *
   * Deletes a user from the organization.
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - User must exist in current organization
   * - Cannot delete self (prevents lockout)
   *
   * **Audit:** Logs DELETE_USER action with deleted user data
   *
   * **Note:** This is a hard delete. Cascade rules in schema will handle
   * deletion of related records (sessions, accounts).
   */
  deleteUser: adminProcedure
    .input(deleteUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // Prevent self-delete (would lock admin out)
      if (existingUser.id === ctx.session!.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your own account",
        });
      }

      // Audit log BEFORE deletion (for compliance records)
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "DELETE_USER",
          entityType: "User",
          entityId: existingUser.id,
          changes: {
            deletedUser: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              role: existingUser.role,
            },
          },
        },
      });

      // Delete user (cascade will handle sessions, accounts)
      await ctx.db.user.delete({
        where: { id: input.id },
      });

      return { success: true, deletedUserId: input.id };
    }),

  /**
   * Update Auditor Frameworks
   *
   * Specialized procedure for managing framework assignments for AUDITOR role users.
   * Only applicable to users with AUDITOR role.
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - User must exist in current organization
   * - User must have AUDITOR role
   * - At least one framework must be assigned
   *
   * **Audit:** Logs UPDATE_USER action with framework changes
   *
   * @see Story 3.8: Auditor Framework Assignment (AC7-AC11)
   */
  updateAuditorFrameworks: adminProcedure
    .input(updateAuditorFrameworksSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // Verify user has AUDITOR role
      if (existingUser.role !== UserRole.AUDITOR) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Framework assignments can only be set for AUDITOR role users",
        });
      }

      // Validate that all framework codes exist for this organization
      const validFrameworks = await ctx.db.framework.findMany({
        where: {
          organizationId: ctx.organizationId!,
          code: { in: input.assignedFrameworks },
          isActive: true,
        },
        select: { code: true },
      });

      const validCodes = new Set(validFrameworks.map((f) => f.code));
      const invalidCodes = input.assignedFrameworks.filter(
        (code) => !validCodes.has(code)
      );

      if (invalidCodes.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid or inactive framework codes: ${invalidCodes.join(", ")}`,
        });
      }

      const oldFrameworks = existingUser.assignedFrameworks;

      // Update user's assigned frameworks
      const updatedUser = await ctx.db.user.update({
        where: { id: input.id },
        data: {
          assignedFrameworks: input.assignedFrameworks,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          assignedFrameworks: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Audit log entry for framework assignment change
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: updatedUser.id,
          changes: {
            before: {
              assignedFrameworks: oldFrameworks,
            },
            after: {
              assignedFrameworks: updatedUser.assignedFrameworks,
            },
            context: "auditor_framework_assignment",
          },
        },
      });

      return updatedUser;
    }),

  /**
   * List Users with Workload (Story 4.6: AC32-AC35)
   *
   * Returns users filtered by role with their current workload (assigned risk count).
   * Used in risk assignment dropdowns to help GRC Analysts balance assignments.
   *
   * **Authorization:** Any authenticated user (for assignment dropdowns)
   * **Filtering:** By role (IT_STAKEHOLDER or BUSINESS_STAKEHOLDER)
   *
   * AC32: User dropdown shows assigned risk count next to each user
   * AC33: Workload count includes only OPEN and ASSIGNED risks (excludes CLOSED)
   * AC34: Workload helps GRC Analyst balance assignments across team
   * AC35: Workload updates in real-time after assignment
   *
   * @see Story 4.6: Risk Ownership Assignment (Task 4)
   */
  listUsersWithWorkload: organizationProcedure
    .input(
      z.object({
        role: z.enum(["IT_STAKEHOLDER", "BUSINESS_STAKEHOLDER"]),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build search filter
      const searchFilter = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {};

      // Fetch users with role filter and count their assigned risks
      const users = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
          role: input.role as UserRole,
          ...searchFilter,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        },
        orderBy: { name: "asc" },
      });

      // Ownership moved to Person model — workload counts no longer available on User
      return users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        assignedRiskCount: 0,
      }));
    }),

  /**
   * Bulk Update Business Unit (Story 7.0.4: AC11-AC15, AC20-AC22)
   *
   * Updates the business unit assignment for multiple users at once.
   *
   * **Authorization:** ORG_ADMIN only (enforced by adminProcedure)
   * **Validation:**
   * - All users must exist in current organization
   * - Business unit must be in same organization (if not null)
   *
   * **Audit:** Logs BULK_UPDATE_USER action with all affected users
   */
  bulkUpdateBU: adminProcedure
    .input(bulkUpdateBusinessUnitSchema)
    .mutation(async ({ ctx, input }) => {
      // AC21: Validate BU if provided
      if (input.businessUnitId !== null) {
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
            message: "Business unit not found or not in your organization",
          });
        }
      }

      // Verify all users belong to this organization
      const usersCount = await ctx.db.user.count({
        where: {
          id: { in: input.userIds },
          organizationId: ctx.organizationId!,
        },
      });

      if (usersCount !== input.userIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more users not found in your organization",
        });
      }

      // Get current state for audit
      const usersBeforeUpdate = await ctx.db.user.findMany({
        where: {
          id: { in: input.userIds },
          organizationId: ctx.organizationId!,
        },
        select: {
          id: true,
          name: true,
          businessUnitId: true,
        },
      });

      // AC14: Update all selected users
      const result = await ctx.db.user.updateMany({
        where: {
          id: { in: input.userIds },
          organizationId: ctx.organizationId!,
        },
        data: {
          businessUnitId: input.businessUnitId,
        },
      });

      // AC22: Audit log for bulk BU assignment
      await ctx.db.auditLog.create({
        data: {
          id: randomUUID(),
          organizationId: ctx.organizationId!,
          userId: ctx.session!.user.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: input.userIds.join(","),
          changes: {
            action: "BULK_UPDATE_BUSINESS_UNIT",
            userCount: result.count,
            beforeState: usersBeforeUpdate.map((u) => ({
              id: u.id,
              name: u.name,
              businessUnitId: u.businessUnitId,
            })),
            afterState: {
              businessUnitId: input.businessUnitId,
            },
          },
          actorName: ctx.session!.user.name,
          actorRole: ctx.session!.user.role,
        },
      });

      // AC15: Return count for success toast
      return { updated: result.count };
    }),

  /**
   * List Users for Assignment (Story 7.0.7: AC21-AC24)
   *
   * Returns users with BU-based suggestions for assignment dropdowns.
   * Users from specified BUs (and their descendants) appear in "suggested" section,
   * while remaining users appear in "others" section.
   *
   * **Authorization:** Any authenticated user (for assignment dropdowns)
   * **Features:**
   * - AC21: Returns users with BU info
   * - AC22: Accepts prioritizeBUIds parameter
   * - AC23: Returns suggested users and other users separately
   * - AC24: Respects organization isolation
   *
   * @see Story 7.0.7: Assignee Picker with BU Suggestions
   */
  listForAssignment: organizationProcedure
    .input(
      z.object({
        prioritizeBUIds: z.array(z.string()).optional().default([]),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Import getBUWithDescendants dynamically to get BU hierarchy
      const { getBUWithDescendants } = await import(
        "@/server/services/businessUnitService"
      );

      // Expand BU IDs to include all descendants (AC22)
      let prioritizedBUIds: string[] = [];
      for (const buId of input.prioritizeBUIds) {
        const descendants = await getBUWithDescendants(buId);
        prioritizedBUIds.push(...descendants);
      }
      prioritizedBUIds = [...new Set(prioritizedBUIds)]; // Dedupe

      // Build search filter (AC4: search by name or email)
      const searchFilter = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {};

      // Fetch all matching users with BU info (AC21, AC24)
      const users = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.organizationId!, // CRITICAL: Multi-tenant isolation
          ...searchFilter,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          businessUnitId: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              parentId: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parentId: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      parentId: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          parentId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Split into suggested and others (AC23)
      const suggested: typeof users = [];
      const others: typeof users = [];

      for (const user of users) {
        if (
          user.businessUnitId &&
          prioritizedBUIds.length > 0 &&
          prioritizedBUIds.includes(user.businessUnitId)
        ) {
          suggested.push(user);
        } else {
          others.push(user);
        }
      }

      return { suggested, others };
    }),
});
