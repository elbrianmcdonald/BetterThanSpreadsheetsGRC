/**
 * Epic 1 — Story 1.2: migrate existing single-org users to memberships.
 *
 * The backfill must create exactly one OrganizationMembership per existing user,
 * mirroring their current organizationId + role, and be idempotent (safe to
 * re-run without creating duplicates).
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { backfillMemberships } from "@/server/services/organization/backfill";

describe("Epic 1 — Story 1.2 membership backfill", () => {
  let org: { id: string };
  const userIds: string[] = [];

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({
      data: { id: randomUUID(), name: `BF ${stamp}`, slug: `bf-${stamp}`, updatedAt: new Date() },
    });
    for (const role of [UserRole.ADMINISTRATOR, UserRole.BUSINESS_USER]) {
      const u = await db.user.create({
        data: {
          id: randomUUID(),
          email: `bf-${role}-${stamp}@example.com`,
          name: "bf",
          organizationId: org.id,
          role,
          updatedAt: new Date(),
        },
      });
      userIds.push(u.id);
    }
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("creates exactly one membership per user mirroring org + role (FR3)", async () => {
    await backfillMemberships(db);

    for (const userId of userIds) {
      const memberships = await db.organizationMembership.findMany({ where: { userId } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.organizationId).toBe(org.id);
    }

    // Roles preserved
    for (const userId of userIds) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
      const membership = await db.organizationMembership.findFirst({ where: { userId } });
      expect(membership!.role).toBe(user!.role);
    }
  });

  it("is idempotent — a second run creates no duplicates (NFR4)", async () => {
    await backfillMemberships(db);
    await backfillMemberships(db);

    for (const userId of userIds) {
      const memberships = await db.organizationMembership.findMany({ where: { userId } });
      expect(memberships).toHaveLength(1);
    }
  });
});
