/**
 * Epic 1 — Story 1.2: migrate existing single-org users to memberships.
 *
 * Role Consolidation Epic 2 removed the stored `User.role` and
 * `OrganizationMembership.role` columns, so there is nothing to backfill FROM:
 * staff carry `platformRole` (all-org, no membership) and Business Users are
 * provisioned with a membership at creation time. `backfillMemberships` is now a
 * retained no-op — these tests assert it stays that way.
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { backfillMemberships } from "@/server/services/organization/backfill";

describe("Epic 1 — Story 1.2 membership backfill (Epic 2: no-op)", () => {
  let org: { id: string };
  const userIds: string[] = [];

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({
      data: { id: randomUUID(), name: `BF ${stamp}`, slug: `bf-${stamp}`, updatedAt: new Date() },
    });

    // Staff user: platformRole set, no membership.
    const staff = await db.user.create({
      data: {
        id: randomUUID(),
        email: `bf-staff-${stamp}@example.com`,
        name: "bf",
        organizationId: org.id,
        platformRole: UserRole.ADMINISTRATOR,
        updatedAt: new Date(),
      },
    });
    userIds.push(staff.id);

    // Business User: platformRole null.
    const business = await db.user.create({
      data: {
        id: randomUUID(),
        email: `bf-business-${stamp}@example.com`,
        name: "bf",
        organizationId: org.id,
        updatedAt: new Date(),
      },
    });
    userIds.push(business.id);
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("is a no-op returning { created: 0 } and creates no memberships (Epic 2)", async () => {
    const result = await backfillMemberships(db);
    expect(result).toEqual({ created: 0 });

    for (const userId of userIds) {
      const memberships = await db.organizationMembership.findMany({ where: { userId } });
      expect(memberships).toHaveLength(0);
    }
  });

  it("remains a no-op on repeated runs (NFR4)", async () => {
    await backfillMemberships(db);
    const result = await backfillMemberships(db);
    expect(result).toEqual({ created: 0 });

    for (const userId of userIds) {
      const memberships = await db.organizationMembership.findMany({ where: { userId } });
      expect(memberships).toHaveLength(0);
    }
  });
});
