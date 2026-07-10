/**
 * Multi-Tenancy Epic 1 — organization access authority.
 *
 * Single source of truth for "may this user act in this organization, and as
 * what role?" Used by both the `organization.switch` tRPC mutation and the
 * NextAuth JWT `update` callback so the server-side access check can never be
 * bypassed by the client (NFR3, NFR5).
 */

import { UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

/**
 * Resolve the role a user would have in a given organization, or `null` if they
 * may not access it. (Role Consolidation Epic 2 — two axes.)
 *
 * - Staff carry `User.platformRole` (ANALYST/MANAGER/ADMINISTRATOR) which applies
 *   across EVERY existing organization. `isPlatformAdmin` is the legacy equivalent
 *   (→ ADMINISTRATOR) honored until the data migration populates platformRole.
 * - Otherwise the user is an org-bound Business User: a membership for that org
 *   grants access (its role during migration; BUSINESS_USER once the column drops).
 * - Everyone else gets `null` (no access).
 */
export async function resolveActiveRole(
  db: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<UserRole | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, isPlatformAdmin: true },
  });

  // Staff (platform-scoped) authority applies to every existing organization.
  const staffRole =
    user?.platformRole ?? (user?.isPlatformAdmin ? UserRole.ADMINISTRATOR : null);
  if (staffRole) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    return org ? staffRole : null;
  }

  // Org-bound Business User: a membership for this org grants access.
  const membership = await db.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (membership) return membership.role;

  return null;
}

/**
 * List the organizations a user may switch into: their membership orgs, or every
 * active organization if they are a platform admin. Sorted by name.
 */
export async function listAccessibleOrganizations(
  db: PrismaClient,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, isPlatformAdmin: true },
  });

  // Staff (platformRole) — and legacy platform admins — reach every active org.
  if (user?.platformRole || user?.isPlatformAdmin) {
    return db.organization.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  const memberships = await db.organizationMembership.findMany({
    where: { userId },
    select: { Organization: { select: { id: true, name: true } } },
    orderBy: { Organization: { name: "asc" } },
  });
  return memberships.map((m) => m.Organization);
}
