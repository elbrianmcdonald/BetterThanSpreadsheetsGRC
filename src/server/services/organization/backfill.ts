/**
 * Epic 1 — Story 1.2: backfill OrganizationMembership rows from existing users.
 *
 * Every existing user has a single `organizationId` + `role` (the pre-multi-org
 * model). This creates one membership per user mirroring those fields so the
 * switcher and per-org role resolution work for pre-existing accounts. Idempotent
 * via the `(userId, organizationId)` unique constraint + `skipDuplicates`, so it
 * is safe to run on every deploy.
 */

import type { PrismaClient } from "@prisma/client";

export async function backfillMemberships(
  db: PrismaClient,
): Promise<{ created: number }> {
  const users = await db.user.findMany({
    select: { id: true, organizationId: true, role: true },
  });

  if (users.length === 0) return { created: 0 };

  const result = await db.organizationMembership.createMany({
    data: users.map((u) => ({
      userId: u.id,
      organizationId: u.organizationId,
      role: u.role,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}
