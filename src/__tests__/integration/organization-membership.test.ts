/**
 * Epic 3 — membership management (Stories 3.1, 3.2) + platform admin (3.3).
 *
 * 3.1 addMember: an org admin attaches an existing user to the active company.
 * 3.2 updateMemberRole / removeMember: change or revoke a member (scoped to the
 *     active company only — a membership in another company is untouched).
 * 3.3 setPlatformAdmin / listPlatformAdmins: platform-admin-only management.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";

type TestUser = { id: string; email: string; organizationId: string; role: UserRole };

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: { id: user.id, email: user.email, organizationId: user.organizationId, role: user.role, name: "T", image: null, assignedFrameworks: [] },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkUser(orgId: string, role: UserRole, tag: string, platformRole: UserRole | null = null): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: { id: randomUUID(), email, name: tag, organizationId: orgId, role, platformRole, updatedAt: new Date() },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

async function mkMembership(userId: string, organizationId: string, role: UserRole) {
  await db.organizationMembership.create({ data: { id: randomUUID(), userId, organizationId, role } });
}

describe("Epic 3 — membership management + platform admin", () => {
  let orgHome: { id: string };
  let orgOther: { id: string };
  let admin: TestUser;
  let auditor: TestUser;
  let platformAdmin: TestUser;
  let t1: TestUser; // add happy path
  let t2: TestUser; // update role (pre-added)
  let t3: TestUser; // remove (pre-added)
  let t4: TestUser; // remove isolation (member of home + other)

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    orgHome = await db.organization.create({ data: { id: randomUUID(), name: `Home ${s}`, slug: `home-${s}`, updatedAt: new Date() } });
    orgOther = await db.organization.create({ data: { id: randomUUID(), name: `Other ${s}`, slug: `other-${s}`, updatedAt: new Date() } });

    admin = await mkUser(orgHome.id, UserRole.ADMINISTRATOR, "admin");
    await mkMembership(admin.id, orgHome.id, UserRole.ADMINISTRATOR);
    auditor = await mkUser(orgHome.id, UserRole.BUSINESS_USER, "auditor");
    platformAdmin = await mkUser(orgHome.id, UserRole.ADMINISTRATOR, "platform", UserRole.ADMINISTRATOR);

    t1 = await mkUser(orgOther.id, UserRole.BUSINESS_USER, "t1");
    t2 = await mkUser(orgOther.id, UserRole.BUSINESS_USER, "t2");
    await mkMembership(t2.id, orgHome.id, UserRole.BUSINESS_USER);
    t3 = await mkUser(orgOther.id, UserRole.BUSINESS_USER, "t3");
    await mkMembership(t3.id, orgHome.id, UserRole.BUSINESS_USER);
    t4 = await mkUser(orgOther.id, UserRole.BUSINESS_USER, "t4");
    await mkMembership(t4.id, orgHome.id, UserRole.BUSINESS_USER);
    await mkMembership(t4.id, orgOther.id, UserRole.BUSINESS_USER);
  });

  afterAll(async () => {
    for (const org of [orgHome, orgOther]) {
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  // ---- Story 3.1 ----
  it("an admin attaches an existing user to the active company (FR13)", async () => {
    await createCaller(admin).organization.addMember({ email: t1.email, role: UserRole.ANALYST });

    const membership = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: t1.id, organizationId: orgHome.id } },
    });
    expect(membership?.role).toBe(UserRole.ANALYST);

    const members = await createCaller(admin).organization.listMembers();
    expect(members.map((m) => m.userId)).toContain(t1.id);
  });

  it("attaching a non-existent email returns NOT_FOUND", async () => {
    await expect(
      createCaller(admin).organization.addMember({ email: "nobody@nowhere.test", role: UserRole.BUSINESS_USER }),
    ).rejects.toThrow(/not found|no user/i);
  });

  it("attaching a user who is already a member is rejected", async () => {
    await expect(
      createCaller(admin).organization.addMember({ email: t2.email, role: UserRole.BUSINESS_USER }),
    ).rejects.toThrow(/already|member|exists|conflict/i);
  });

  it("a non-admin cannot add members (NFR3)", async () => {
    await expect(
      createCaller(auditor).organization.addMember({ email: t1.email, role: UserRole.BUSINESS_USER }),
    ).rejects.toThrow(/FORBIDDEN|role|permission/i);
  });

  // ---- Story 3.2 ----
  it("an admin changes a member's role (FR14)", async () => {
    await createCaller(admin).organization.updateMemberRole({ userId: t2.id, role: UserRole.MANAGER });
    const membership = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: t2.id, organizationId: orgHome.id } },
    });
    expect(membership?.role).toBe(UserRole.MANAGER);
  });

  it("an admin removes a member (FR14)", async () => {
    await createCaller(admin).organization.removeMember({ userId: t3.id });
    const membership = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: t3.id, organizationId: orgHome.id } },
    });
    expect(membership).toBeNull();
  });

  it("removing a member only affects the active company, not other memberships (isolation)", async () => {
    await createCaller(admin).organization.removeMember({ userId: t4.id });
    const home = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: t4.id, organizationId: orgHome.id } },
    });
    const other = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: t4.id, organizationId: orgOther.id } },
    });
    expect(home).toBeNull();
    expect(other).not.toBeNull(); // untouched
  });

  // ---- Story 3.3 ----
  it("a platform admin grants platform-admin to another user by email (FR16)", async () => {
    await createCaller(platformAdmin).organization.setPlatformAdmin({ email: t1.email, isPlatformAdmin: true });
    const u = await db.user.findUnique({ where: { id: t1.id }, select: { platformRole: true } });
    expect(u?.platformRole).toBe(UserRole.ADMINISTRATOR);

    const admins = await createCaller(platformAdmin).organization.listPlatformAdmins();
    expect(admins.map((a) => a.id)).toContain(t1.id);
  });

  it("setting platform-admin for a non-existent email returns NOT_FOUND", async () => {
    await expect(
      createCaller(platformAdmin).organization.setPlatformAdmin({ email: "ghost@nowhere.test", isPlatformAdmin: true }),
    ).rejects.toThrow(/not found|no user/i);
  });

  it("a non-platform-admin cannot manage platform admins (NFR3, NFR5)", async () => {
    await expect(
      createCaller(admin).organization.listPlatformAdmins(),
    ).rejects.toThrow(/FORBIDDEN|platform|permission|Administrator|access required/i);
    await expect(
      createCaller(admin).organization.setPlatformAdmin({ email: t1.email, isPlatformAdmin: false }),
    ).rejects.toThrow(/FORBIDDEN|platform|permission|Administrator|access required/i);
  });
});
