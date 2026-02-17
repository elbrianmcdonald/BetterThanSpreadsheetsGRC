/**
 * usePermission Hook
 *
 * Client-side permission checking hook for role-based UI rendering.
 * Uses the session from NextAuth to determine user permissions.
 *
 * Usage:
 * ```tsx
 * import { usePermission } from "@/hooks/usePermission";
 * import { Permission } from "@/server/auth/permissions";
 *
 * function MyComponent() {
 *   const canCreateUser = usePermission(Permission.USER_CREATE);
 *
 *   return (
 *     <>
 *       {canCreateUser && <button>Create User</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 * @see docs/AUTHORIZATION.md for permission details
 */

import { useSession } from "next-auth/react";
import { hasPermission, Permission } from "@/server/auth/permissions";

/**
 * Hook to check if the current user has a specific permission
 *
 * @param permission - The permission to check (from Permission enum)
 * @returns true if the user has the permission, false otherwise
 *
 * @example
 * const canCreateUser = usePermission(Permission.USER_CREATE);
 * if (canCreateUser) {
 *   // Show create user button
 * }
 */
export function usePermission(permission: Permission): boolean {
  const { data: session, status } = useSession();

  // If not authenticated, no permissions
  if (status !== "authenticated" || !session?.user?.role) {
    return false;
  }

  // Use the centralized permission checking from Story 1.7
  return hasPermission(session.user.role, permission);
}
