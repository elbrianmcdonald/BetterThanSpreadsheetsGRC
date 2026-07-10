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
  _db: PrismaClient,
): Promise<{ created: number }> {
  // Role Consolidation Epic 2: obsolete. There is no stored User.role to backfill
  // from — staff carry platformRole (all-org, no membership) and Business Users are
  // provisioned with a membership directly. Retained as a no-op for callers.
  return { created: 0 };
}
