/**
 * User Management Validation Schemas
 *
 * Zod schemas for validating user management operations.
 * All schemas enforce type safety and data validation for tRPC procedures.
 */

import { z } from "zod";
import { UserRole } from "@prisma/client";

/**
 * UserRole enum validation helper
 * Validates that role is one of the 7 defined roles
 */
export const userRoleSchema = z.nativeEnum(UserRole);

/**
 * Create User Schema
 *
 * Validates user creation input.
 * - name: Optional (OAuth users may not have names initially)
 * - email: Required, must be valid email format
 * - role: Required, must be valid UserRole enum value
 * - assignedFrameworks: Optional, required for AUDITOR role
 *
 * organizationId is NOT included - it's automatically set from session context
 *
 * @see Story 3.8: Auditor Framework Assignment (AC7-AC11)
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  email: z.string().email("Invalid email address"),
  role: userRoleSchema.default(UserRole.BUSINESS_USER), // Default to most restrictive role
  // Story 3.8: Framework codes for AUDITOR role access restriction
  assignedFrameworks: z.array(z.string()).optional().default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Update User Schema
 *
 * Validates user update input.
 * All fields except id are optional (partial update supported).
 * - id: Required UUID of user to update
 * - name: Optional update to name
 * - email: Optional update to email (must be valid format)
 * - role: Optional update to role
 * - assignedFrameworks: Optional update to assigned frameworks
 *
 * @see Story 3.8: Auditor Framework Assignment (AC7-AC11)
 */
export const updateUserSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  name: z.string().min(1, "Name cannot be empty").max(255, "Name is too long").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: userRoleSchema.optional(),
  // Story 3.8: Framework codes for AUDITOR role access restriction
  assignedFrameworks: z.array(z.string()).optional(),
  // Story 7.0.4: Business unit assignment
  businessUnitId: z.string().uuid("Invalid business unit ID").nullable().optional(),
  // Admin password change — optional, same complexity rules as resetPasswordSchema
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Update User Role Schema
 *
 * Specialized schema for role-only updates.
 * Used for role management operations that should be tracked separately.
 * - id: Required UUID of user whose role to update
 * - role: Required new role value
 */
export const updateUserRoleSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  role: userRoleSchema,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/**
 * Update Auditor Frameworks Schema
 *
 * Specialized schema for updating auditor framework assignments.
 * Only applicable to users with AUDITOR role.
 * - id: Required UUID of auditor user
 * - assignedFrameworks: Required array of framework codes
 *
 * @see Story 3.8: Auditor Framework Assignment (AC7-AC11)
 */
export const updateAuditorFrameworksSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  assignedFrameworks: z
    .array(z.string().min(1, "Framework code cannot be empty"))
    .min(1, "At least one framework must be assigned"),
});

export type UpdateAuditorFrameworksInput = z.infer<typeof updateAuditorFrameworksSchema>;

/**
 * Delete User Schema
 *
 * Validates user deletion input.
 * - id: Required UUID of user to delete
 */
export const deleteUserSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

/**
 * Get User By ID Schema
 *
 * Validates get user by ID input.
 * - id: Required UUID of user to retrieve
 */
export const getUserByIdSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;

/**
 * List Users Schema
 *
 * Validates pagination parameters for listing users.
 * - skip: Optional offset for pagination (default: 0)
 * - take: Optional limit for pagination (default: 50, max: 100)
 * - businessUnitId: Optional filter by business unit (Story 7.0.4)
 */
export const listUsersSchema = z.object({
  skip: z.number().int().min(0).default(0).optional(),
  take: z.number().int().min(1).max(100).default(50).optional(),
  // Story 7.0.4: Filter by business unit
  businessUnitId: z.string().uuid().nullable().optional(),
  // Special value "unassigned" to filter users without BU
  filterUnassigned: z.boolean().optional(),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

/**
 * Bulk Update Business Unit Schema (Story 7.0.4)
 *
 * Validates bulk business unit assignment input.
 * - userIds: Required array of user IDs to update
 * - businessUnitId: Business unit to assign (null to unassign)
 */
export const bulkUpdateBusinessUnitSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user must be selected"),
  businessUnitId: z.string().uuid("Invalid business unit ID").nullable(),
});

export type BulkUpdateBusinessUnitInput = z.infer<typeof bulkUpdateBusinessUnitSchema>;

/**
 * Request Password Reset Schema
 *
 * Validates password reset request input.
 * - email: Required email address to send reset link
 */
export const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Reset Password Schema
 *
 * Validates password reset input using token.
 * - token: Required reset token from email link
 * - newPassword: Required new password meeting complexity requirements
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Change Password Schema
 *
 * Validates password change input for authenticated users.
 * - currentPassword: Required current password for verification
 * - newPassword: Required new password meeting complexity requirements
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Role Badge Display Schema
 *
 * Maps roles to display properties for UI rendering.
 * Used by RoleBadge component.
 */
export const roleDisplayConfig = {
  [UserRole.ADMINISTRATOR]: {
    label: "Administrator",
    color: "purple" as const,
    description: "Full administrative access across all organizations",
  },
  [UserRole.MANAGER]: {
    label: "Manager",
    color: "violet" as const,
    description: "Performs and approves/assigns/rejects GRC work across all organizations",
  },
  [UserRole.ANALYST]: {
    label: "Analyst",
    color: "blue" as const,
    description: "Performs GRC work across all organizations",
  },
  [UserRole.BUSINESS_USER]: {
    label: "Business User",
    color: "green" as const,
    description: "Read-only view of their assigned organization",
  },
} as const;
