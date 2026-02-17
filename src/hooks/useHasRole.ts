/**
 * useHasRole Hook
 *
 * Client-side role checking hook for role-based UI rendering.
 * Uses the session from NextAuth to determine user role.
 *
 * Usage:
 * ```tsx
 * import { useHasRole } from "@/hooks/useHasRole";
 * import { UserRole } from "@prisma/client";
 *
 * function MyComponent() {
 *   const isAdmin = useHasRole(UserRole.ORG_ADMIN);
 *   const isAnalystOrHigher = useHasRole([UserRole.ORG_ADMIN, UserRole.GRC_ANALYST]);
 *
 *   return (
 *     <>
 *       {isAdmin && <button>Admin Panel</button>}
 *       {isAnalystOrHigher && <div>Analyst Features</div>}
 *     </>
 *   );
 * }
 * ```
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 * @see docs/AUTHORIZATION.md for role details
 */

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

/**
 * Hook to check if the current user has one or more specific roles
 *
 * @param allowedRoles - Single role or array of roles to check against
 * @returns true if the user has one of the allowed roles, false otherwise
 *
 * @example
 * // Check single role
 * const isAdmin = useHasRole(UserRole.ORG_ADMIN);
 *
 * @example
 * // Check multiple roles
 * const canManageRisks = useHasRole([
 *   UserRole.ORG_ADMIN,
 *   UserRole.GRC_ANALYST,
 *   UserRole.SECURITY_ENGINEER
 * ]);
 */
export function useHasRole(
  allowedRoles: UserRole | UserRole[]
): boolean {
  const { data: session, status } = useSession();

  // If not authenticated, no role access
  if (status !== "authenticated" || !session?.user?.role) {
    return false;
  }

  const userRole = session.user.role;

  // Handle both single role and array of roles
  if (Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }

  return userRole === allowedRoles;
}
