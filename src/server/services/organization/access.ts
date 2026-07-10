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
 * may not access it.
 *
 * - A member's role comes from their `OrganizationMembership` for that org.
 * - A platform admin may access any existing organization, acting as ORG_ADMIN.
 * - Everyone else gets `null` (no access).
 */
export async function resolveActiveRole(
  db: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<UserRole | null> {
  const membership = await db.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (membership) return membership.role;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (user?.isPlatformAdmin) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (org) return UserRole.ADMINISTRATOR;
  }

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
    select: { isPlatformAdmin: true },
  });

  if (user?.isPlatformAdmin) {
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
