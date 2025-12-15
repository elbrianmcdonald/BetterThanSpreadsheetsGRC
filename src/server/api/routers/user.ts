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
import { UserRole } from "@prisma/client";

import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import {
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  deleteUserSchema,
  getUserByIdSchema,
  listUsersSchema,
} from "@/schemas/user";

/**
 * Middleware: Require ORG_ADMIN role
 *
 * Enforces that only Organization Administrators can perform user management operations.
 * Throws FORBIDDEN error for users with other roles.
 */
const requireOrgAdmin = organizationProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== UserRole.ORG_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Organization Administrators can manage users",
    });
  }
  return next({ ctx });
});

export const userRouter = createTRPCRouter({
  /**
   * Create User
   *
   * Creates a new user within the current organization.
   *
   * **Authorization:** ORG_ADMIN only
   * **Validation:**
   * - Email must be unique within organization
   * - Email format validated by Zod schema
   * - Role defaults to AUDITOR (most restrictive)
   *
   * **Audit:** Logs CREATE_USER action
   */
  createUser: requireOrgAdmin
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists in this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          email: input.email,
          organizationId: ctx.organizationId,
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists in your organization",
        });
      }

      // Create user with organization isolation
      const newUser = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
        },
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

      // Audit log entry
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: "CREATE_USER",
          entityType: "User",
          entityId: newUser.id,
          changes: {
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
            },
          },
        },
      });

      return newUser;
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
      const users = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: input.skip,
        take: input.take,
        orderBy: { createdAt: "desc" },
      });

      // Get total count for pagination
      const total = await ctx.db.user.count({
        where: {
          organizationId: ctx.organizationId,
        },
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
      const user = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
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
   * **Authorization:** ORG_ADMIN only
   * **Validation:**
   * - User must exist in current organization
   * - If email changed, must be unique within organization
   *
   * **Audit:** Logs UPDATE_USER action with before/after state
   */
  updateUser: requireOrgAdmin
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
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
            organizationId: ctx.organizationId,
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

      // Capture before state for audit log
      const beforeState = {
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
      };

      // Update user
      const updatedUser = await ctx.db.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
        },
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

      // Audit log entry with before/after state
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: "UPDATE_USER",
          entityType: "User",
          entityId: updatedUser.id,
          changes: {
            before: beforeState,
            after: {
              name: updatedUser.name,
              email: updatedUser.email,
              role: updatedUser.role,
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
   * **Authorization:** ORG_ADMIN only
   * **Validation:**
   * - User must exist in current organization
   * - Cannot change own role (prevents privilege escalation/lockout)
   *
   * **Audit:** Logs UPDATE_USER_ROLE action with old/new role
   */
  updateUserRole: requireOrgAdmin
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // Prevent admin from changing their own role (could lock themselves out)
      if (existingUser.id === ctx.session.user.id) {
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
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
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
   * **Authorization:** ORG_ADMIN only
   * **Validation:**
   * - User must exist in current organization
   * - Cannot delete self (prevents lockout)
   *
   * **Audit:** Logs DELETE_USER action with deleted user data
   *
   * **Note:** This is a hard delete. Cascade rules in schema will handle
   * deletion of related records (sessions, accounts).
   */
  deleteUser: requireOrgAdmin
    .input(deleteUserSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists and belongs to this organization
      const existingUser = await ctx.db.user.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId, // CRITICAL: Multi-tenant isolation
        },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in your organization",
        });
      }

      // Prevent self-delete (would lock admin out)
      if (existingUser.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your own account",
        });
      }

      // Audit log BEFORE deletion (for compliance records)
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
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
});
