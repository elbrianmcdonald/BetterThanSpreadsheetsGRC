/**
 * Epic 1 (Multi-Tenant Company Switching) — Stories 1.1, 1.3, 1.5.
 *
 * Covers the membership model + platform-admin flag (1.1), the server-validated
 * `organization.switch` / `organization.listSwitchable` procedures (1.3), and the
 * cross-tenant isolation gate (1.5): a user may only switch into orgs they can
 * access, and a switched (org-B-scoped) context never returns org-A rows.
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type TestUser = { id: string; email: string; organizationId: string; role: UserRole };

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        name: "T",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkUser(
  orgId: string,
  role: UserRole,
  tag: string,
  platformRole: UserRole | null = null,
): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      email,
      name: tag,
      organizationId: orgId,
      role,
      platformRole,
      updatedAt: new Date(),
    },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

async function mkMembership(userId: string, organizationId: string, role: UserRole) {
  await db.organizationMembership.create({
    data: { id: randomUUID(), userId, organizationId, role },
  });
}

describe("Epic 1 — organization switching + membership isolation", () => {
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let userBoth: TestUser; // member of A (ADMIN) and B (AUDITOR)
  let userAOnly: TestUser; // member of A only
  let platformAdmin: TestUser; // isPlatformAdmin, member of A only
  let aFrameworkId: string;
  let bFrameworkId: string;

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.round(performance.now())}`;
    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `A-Corp ${stamp}`, slug: `a-corp-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `B-Corp ${stamp}`, slug: `b-corp-${stamp}`, updatedAt: new Date() },
    });

    userBoth = await mkUser(orgA.id, UserRole.ADMINISTRATOR, "both");
    await mkMembership(userBoth.id, orgA.id, UserRole.ADMINISTRATOR);
    await mkMembership(userBoth.id, orgB.id, UserRole.BUSINESS_USER);

    userAOnly = await mkUser(orgA.id, UserRole.ADMINISTRATOR, "aonly");
    await mkMembership(userAOnly.id, orgA.id, UserRole.ADMINISTRATOR);

    platformAdmin = await mkUser(orgA.id, UserRole.ADMINISTRATOR, "super", UserRole.ADMINISTRATOR);
    await mkMembership(platformAdmin.id, orgA.id, UserRole.ADMINISTRATOR);

    // One framework in each org to prove isolation across a switch.
    aFrameworkId = randomUUID();
    bFrameworkId = randomUUID();
    await runWithOrganizationContext(orgA.id, async () => {
      await db.framework.create({ data: { id: aFrameworkId, organizationId: orgA.id, name: "A-FW", code: `AFW${stamp}`, version: "1", isActive: true, updatedAt: new Date() } });
    });
    await runWithOrganizationContext(orgB.id, async () => {
      await db.framework.create({ data: { id: bFrameworkId, organizationId: orgB.id, name: "B-FW", code: `BFW${stamp}`, version: "1", isActive: true, updatedAt: new Date() } });
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("listSwitchable returns only the orgs a non-admin user is a member of (FR7)", async () => {
    const orgs = await createCaller(userAOnly).organization.listSwitchable();
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain(orgA.id);
    expect(ids).not.toContain(orgB.id);
  });

  it("listSwitchable returns both membership orgs for a multi-company user (FR1, FR7)", async () => {
    const orgs = await createCaller(userBoth).organization.listSwitchable();
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain(orgA.id);
    expect(ids).toContain(orgB.id);
  });

  it("listSwitchable returns ALL orgs for a platform admin (FR2)", async () => {
    const orgs = await createCaller(platformAdmin).organization.listSwitchable();
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain(orgA.id);
    expect(ids).toContain(orgB.id); // even though not a member of B
  });

  it("switch into a member org returns that org's per-membership role (FR4, FR8)", async () => {
    const res = await createCaller(userBoth).organization.switch({ organizationId: orgB.id });
    expect(res.organizationId).toBe(orgB.id);
    expect(res.role).toBe(UserRole.BUSINESS_USER); // per-membership role in B, not the ADMIN role in A
  });

  it("switch into a non-member org is rejected FORBIDDEN (FR9, NFR5 — isolation gate)", async () => {
    await expect(
      createCaller(userAOnly).organization.switch({ organizationId: orgB.id }),
    ).rejects.toThrow(/FORBIDDEN|access|not a member/i);
  });

  it("platform admin can switch into any org without a membership (FR2)", async () => {
    const res = await createCaller(platformAdmin).organization.switch({ organizationId: orgB.id });
    expect(res.organizationId).toBe(orgB.id);
    expect(res.role).toBe(UserRole.ADMINISTRATOR); // super-admin acts as admin in the target org
  });

  it("a switched (org-B-scoped) context returns zero org-A rows (NFR1)", async () => {
    const frameworksInB = await runWithOrganizationContext(orgB.id, async () => {
      return await db.framework.findMany();
    });
    expect(frameworksInB.length).toBeGreaterThan(0);
    expect(frameworksInB.every((f) => f.organizationId === orgB.id)).toBe(true);
    expect(frameworksInB.some((f) => f.id === aFrameworkId)).toBe(false);
    expect(frameworksInB.some((f) => f.id === bFrameworkId)).toBe(true);
  });
});
