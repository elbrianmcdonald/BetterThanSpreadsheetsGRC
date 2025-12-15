/**
 * Route Protection Utilities
 *
 * Server-side route protection helpers for Next.js pages.
 * Validates user authentication and role requirements.
 */

import { redirect } from "next/navigation";
import { type Session } from "next-auth";
import { UserRole } from "@prisma/client";

/**
 * Require Role
 *
 * Server-side helper to enforce role requirements on pages.
 * Redirects unauthenticated users to sign-in and unauthorized users to home.
 *
 * @param session - NextAuth session from auth()
 * @param allowedRoles - Array of roles that can access the page
 * @param callbackUrl - URL to redirect to after sign-in (optional)
 */
export function requireRole(
  session: Session | null,
  allowedRoles: UserRole[],
  callbackUrl?: string
): void {
  // Check authentication
  if (!session || !session.user) {
    const redirectUrl = callbackUrl
      ? `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/api/auth/signin";
    redirect(redirectUrl);
  }

  // Check authorization
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/?error=unauthorized");
  }
}

/**
 * Require Organization Admin
 *
 * Convenience helper for ORG_ADMIN-only pages.
 *
 * @param session - NextAuth session from auth()
 * @param callbackUrl - URL to redirect to after sign-in (optional)
 */
export function requireOrgAdmin(
  session: Session | null,
  callbackUrl?: string
): void {
  requireRole(session, [UserRole.ORG_ADMIN], callbackUrl);
}

/**
 * Require Authentication
 *
 * Basic authentication check without role requirements.
 *
 * @param session - NextAuth session from auth()
 * @param callbackUrl - URL to redirect to after sign-in (optional)
 */
export function requireAuth(
  session: Session | null,
  callbackUrl?: string
): void {
  if (!session || !session.user) {
    const redirectUrl = callbackUrl
      ? `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/api/auth/signin";
    redirect(redirectUrl);
  }
}

/**
 * Check Role
 *
 * Non-redirecting role check - returns boolean.
 * Useful for conditional rendering or authorization checks.
 *
 * @param session - NextAuth session from auth()
 * @param allowedRoles - Array of roles to check against
 * @returns true if user has one of the allowed roles
 */
export function checkRole(
  session: Session | null,
  allowedRoles: UserRole[]
): boolean {
  if (!session?.user) return false;
  return allowedRoles.includes(session.user.role);
}
