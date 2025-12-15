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
 *
 * organizationId is NOT included - it's automatically set from session context
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  email: z.string().email("Invalid email address"),
  role: userRoleSchema.default(UserRole.AUDITOR), // Default to most restrictive role
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
 */
export const updateUserSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
  name: z.string().min(1, "Name cannot be empty").max(255, "Name is too long").optional(),
  email: z.string().email("Invalid email address").optional(),
  role: userRoleSchema.optional(),
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
 */
export const listUsersSchema = z.object({
  skip: z.number().int().min(0).default(0).optional(),
  take: z.number().int().min(1).max(100).default(50).optional(),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

/**
 * Role Badge Display Schema
 *
 * Maps roles to display properties for UI rendering.
 * Used by RoleBadge component.
 */
export const roleDisplayConfig = {
  [UserRole.ORG_ADMIN]: {
    label: "Org Admin",
    color: "purple" as const,
    description: "Full administrative access",
  },
  [UserRole.GRC_ANALYST]: {
    label: "GRC Analyst",
    color: "blue" as const,
    description: "Full GRC operational access",
  },
  [UserRole.SECURITY_ENGINEER]: {
    label: "Security Engineer",
    color: "cyan" as const,
    description: "Security assessment and risk documentation",
  },
  [UserRole.CISO]: {
    label: "CISO",
    color: "indigo" as const,
    description: "Executive reporting and strategic oversight",
  },
  [UserRole.IT_STAKEHOLDER]: {
    label: "IT Stakeholder",
    color: "green" as const,
    description: "Risk remediation for assigned items",
  },
  [UserRole.BUSINESS_STAKEHOLDER]: {
    label: "Business Stakeholder",
    color: "yellow" as const,
    description: "Risk approval decisions",
  },
  [UserRole.AUDITOR]: {
    label: "Auditor",
    color: "gray" as const,
    description: "Read-only audit access",
  },
} as const;
