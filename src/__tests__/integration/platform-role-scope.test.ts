/**
 * Platform Role Scope — Regression Guard (Role Consolidation, Epic 2)
 *
 * Staff carry User.platformRole, which grants that authority across EVERY
 * organization (no per-org membership needed). Org-bound Business Users have a
 * membership in exactly one org and no platformRole. This pins resolveActiveRole:
 *   - platformRole set  -> that role for ANY existing org
 *   - else membership   -> the membership's role for that org only
 *   - else              -> null
 *
 * @see docs/epics-role-consolidation.md (Epic 2)
 */

import { db } from "@/server/db";
import { resolveActiveRole } from "@/server/services/organization/access";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";

let orgA: { id: string };
let orgB: { id: string };
let staffUserId: string;
let businessUserId: string;

const mkOrg = async (slug: string, name: string) =>
  db.organization.create({
    data: { id: randomUUID(), name, slug, updatedAt: new Date() },
  });

beforeAll(async () => {
  for (const slug of ["test-org-plat-scope-a", "test-org-plat-scope-b"]) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (existing) {
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${existing.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existing.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existing.id}`;
    }
  }

  orgA = await mkOrg("test-org-plat-scope-a", "Plat Scope A");
  orgB = await mkOrg("test-org-plat-scope-b", "Plat Scope B");

  // Staff: platformRole = ANALYST, home org A, NO membership in B.
  const staff = await db.user.create({
    data: {
      id: randomUUID(),
      email: "staff@plat-scope.test",
      name: "Staff Analyst",
      role: UserRole.ANALYST,
      platformRole: UserRole.ANALYST,
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });
  staffUserId = staff.id;

  // Business User: no platformRole, membership in A only.
  const biz = await db.user.create({
    data: {
      id: randomUUID(),
      email: "biz@plat-scope.test",
      name: "Business User",
      role: UserRole.BUSINESS_USER,
      organizationId: orgA.id,
      updatedAt: new Date(),
    },
  });
  businessUserId = biz.id;
  await db.organizationMembership.create({
    data: {
      id: randomUUID(),
      userId: biz.id,
      organizationId: orgA.id,
      role: UserRole.BUSINESS_USER,
      updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  for (const org of [orgA, orgB]) {
    if (!org) continue;
    await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${org.id}`;
  }
});

describe("Epic 2 — platformRole grants all-org staff authority", () => {
  it("staff platformRole resolves in their home org", async () => {
    expect(await resolveActiveRole(db, staffUserId, orgA.id)).toBe(UserRole.ANALYST);
  });

  it("staff platformRole resolves in an org they have NO membership in", async () => {
    expect(await resolveActiveRole(db, staffUserId, orgB.id)).toBe(UserRole.ANALYST);
  });
});

describe("Epic 2 — Business Users are org-bound", () => {
  it("Business User resolves BUSINESS_USER in their assigned org", async () => {
    expect(await resolveActiveRole(db, businessUserId, orgA.id)).toBe(UserRole.BUSINESS_USER);
  });

  it("Business User gets NO access to another org", async () => {
    expect(await resolveActiveRole(db, businessUserId, orgB.id)).toBeNull();
  });
});
