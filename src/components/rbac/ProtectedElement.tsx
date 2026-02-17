/**
 * ProtectedElement Component
 *
 * Conditionally renders child components based on user permissions or roles.
 * Provides a declarative way to hide/show UI elements based on RBAC.
 *
 * Usage:
 * ```tsx
 * import { ProtectedElement } from "@/components/rbac/ProtectedElement";
 * import { Permission } from "@/server/auth/permissions";
 * import { UserRole } from "@prisma/client";
 *
 * // Permission-based protection
 * <ProtectedElement permission={Permission.USER_CREATE}>
 *   <button>Create User</button>
 * </ProtectedElement>
 *
 * // Role-based protection
 * <ProtectedElement role={UserRole.ORG_ADMIN}>
 *   <button>Admin Panel</button>
 * </ProtectedElement>
 *
 * // Multiple roles
 * <ProtectedElement roles={[UserRole.ORG_ADMIN, UserRole.GRC_ANALYST]}>
 *   <div>Analyst Features</div>
 * </ProtectedElement>
 *
 * // With fallback
 * <ProtectedElement permission={Permission.USER_CREATE} fallback={<div>Access Denied</div>}>
 *   <button>Create User</button>
 * </ProtectedElement>
 * ```
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 * @see docs/AUTHORIZATION.md for RBAC details
 */

"use client";

import React, { type ReactNode } from "react";
import { type UserRole } from "@prisma/client";
import { usePermission } from "@/hooks/usePermission";
import { useHasRole } from "@/hooks/useHasRole";
import { type Permission } from "@/server/auth/permissions";

export interface ProtectedElementProps {
  /**
   * Child elements to render if user has permission/role
   */
  children: ReactNode;

  /**
   * Permission to check (from Permission enum)
   * Use this for fine-grained permission checks
   */
  permission?: Permission;

  /**
   * Single role to check
   * Use this for simple role checks
   */
  role?: UserRole;

  /**
   * Multiple roles to check (user must have one of them)
   * Use this for allowing multiple roles
   */
  roles?: UserRole[];

  /**
   * Optional element to render when user lacks permission
   * If not provided, nothing is rendered
   */
  fallback?: ReactNode;

  /**
   * If true, requires BOTH permission AND role checks to pass
   * If false (default), requires EITHER permission OR role to pass
   */
  requireBoth?: boolean;
}

/**
 * Component that conditionally renders children based on permissions or roles
 *
 * **Priority:**
 * 1. If `permission` is provided, check permission
 * 2. If `role` is provided, check single role
 * 3. If `roles` is provided, check multiple roles
 * 4. If `requireBoth` is true, both checks must pass
 *
 * **Examples:**
 *
 * Permission-based:
 * ```tsx
 * <ProtectedElement permission={Permission.USER_CREATE}>
 *   <CreateUserButton />
 * </ProtectedElement>
 * ```
 *
 * Role-based:
 * ```tsx
 * <ProtectedElement role={UserRole.ORG_ADMIN}>
 *   <AdminDashboard />
 * </ProtectedElement>
 * ```
 *
 * Multiple roles:
 * ```tsx
 * <ProtectedElement roles={[UserRole.ORG_ADMIN, UserRole.GRC_ANALYST]}>
 *   <RiskManagement />
 * </ProtectedElement>
 * ```
 *
 * With fallback:
 * ```tsx
 * <ProtectedElement
 *   permission={Permission.USER_DELETE}
 *   fallback={<p>You don't have permission to delete users</p>}
 * >
 *   <DeleteUserButton />
 * </ProtectedElement>
 * ```
 *
 * Combined (permission AND role):
 * ```tsx
 * <ProtectedElement
 *   permission={Permission.USER_CREATE}
 *   role={UserRole.ORG_ADMIN}
 *   requireBoth={true}
 * >
 *   <AdvancedUserCreation />
 * </ProtectedElement>
 * ```
 */
export function ProtectedElement({
  children,
  permission,
  role,
  roles,
  fallback = null,
  requireBoth = false,
}: ProtectedElementProps) {
  // Check permission if provided
  const hasPermissionCheck = usePermission(permission ?? ("" as Permission));
  const hasPermissionResult = permission ? hasPermissionCheck : null;

  // Check role if provided
  const hasRoleCheck = useHasRole(
    (role ?? roles ?? "") as UserRole | UserRole[]
  );
  const hasRoleResult = role || roles ? hasRoleCheck : null;

  // Determine if user has access
  let hasAccess = false;

  if (requireBoth) {
    // Both checks must pass
    const permissionPassed = hasPermissionResult ?? true;
    const rolePassed = hasRoleResult ?? true;
    hasAccess = permissionPassed && rolePassed;
  } else {
    // Either check must pass (OR logic)
    if (hasPermissionResult !== null && hasPermissionResult) {
      hasAccess = true;
    } else if (hasRoleResult !== null && hasRoleResult) {
      hasAccess = true;
    }
  }

  // Render children if user has access, otherwise render fallback
  return <>{hasAccess ? children : fallback}</>;
}
