/**
 * Multi-Tenancy — delete companies + platform companies listing.
 *
 * `organization.delete` (platform admin only) removes a company and all its data
 * (cascade), refusing to delete the caller's currently-active company. `listCompanies`
 * (platform admin only) powers the companies management page.
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

describe("Multi-Tenancy — delete company + listCompanies", () => {
  let homeOrg: { id: string };
  let victimOrg: { id: string };
  let platformAdmin: TestUser;
  let orgAdmin: TestUser;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    homeOrg = await db.organization.create({ data: { id: randomUUID(), name: `DelHome ${s}`, slug: `delhome-${s}`, updatedAt: new Date() } });
    victimOrg = await db.organization.create({ data: { id: randomUUID(), name: `DelVictim ${s}`, slug: `delvictim-${s}`, updatedAt: new Date() } });
    platformAdmin = await mkUser(homeOrg.id, UserRole.ADMINISTRATOR, "pa", UserRole.ADMINISTRATOR);
    orgAdmin = await mkUser(homeOrg.id, UserRole.ADMINISTRATOR, "oa");
    // A user + membership inside the victim org, to prove cascade removal.
    const victimUser = await mkUser(victimOrg.id, UserRole.BUSINESS_USER, "victim");
    await db.organizationMembership.create({ data: { id: randomUUID(), userId: victimUser.id, organizationId: victimOrg.id, role: UserRole.BUSINESS_USER } });
  });

  afterAll(async () => {
    for (const orgId of [homeOrg.id, victimOrg.id]) {
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${orgId}`;
    }
  });

  it("listCompanies returns companies with member counts for a platform admin", async () => {
    const companies = await createCaller(platformAdmin).organization.listCompanies();
    const victim = companies.find((c) => c.id === victimOrg.id);
    expect(victim).toBeDefined();
    expect(victim!.memberCount).toBe(1);
  });

  it("a non-platform-admin cannot list companies or delete (NFR3)", async () => {
    await expect(createCaller(orgAdmin).organization.listCompanies()).rejects.toThrow(/FORBIDDEN|platform|Administrator|access required/i);
    await expect(
      createCaller(orgAdmin).organization.delete({ organizationId: victimOrg.id }),
    ).rejects.toThrow(/FORBIDDEN|platform|Administrator|access required/i);
  });

  it("refuses to delete the caller's currently-active company", async () => {
    await expect(
      createCaller(platformAdmin).organization.delete({ organizationId: homeOrg.id }),
    ).rejects.toThrow(/active|current|switch/i);
    const stillThere = await db.organization.findUnique({ where: { id: homeOrg.id } });
    expect(stillThere).not.toBeNull();
  });

  it("a platform admin deletes another company and its data cascades away", async () => {
    const res = await createCaller(platformAdmin).organization.delete({ organizationId: victimOrg.id });
    expect(res.organizationId).toBe(victimOrg.id);

    const org = await db.organization.findUnique({ where: { id: victimOrg.id } });
    expect(org).toBeNull();
    const memberships = await db.organizationMembership.findMany({ where: { organizationId: victimOrg.id } });
    expect(memberships).toHaveLength(0);
    const users = await db.user.findMany({ where: { organizationId: victimOrg.id } });
    expect(users).toHaveLength(0);
  });
});
