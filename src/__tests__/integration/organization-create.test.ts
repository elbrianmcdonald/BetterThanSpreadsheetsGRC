/**
 * Epic 2 — Story 2.1: create and enter a new empty company.
 *
 * `organization.create` must: create the org (FR10), provision baseline defaults
 * — default risk matrix + assessment type (FR11), grant the creator an ADMIN
 * membership and return the target so the client switches into it (FR12), write a
 * CREATE_ORGANIZATION audit entry (AR1), and be restricted to platform/org admins
 * (FR10, NFR3).
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
      user: { id: user.id, email: user.email, organizationId: user.organizationId, role: user.role, name: "T", image: null, assignedFrameworks: [] },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkUser(orgId: string, role: UserRole, tag: string, isPlatformAdmin = false): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: { id: randomUUID(), email, name: tag, organizationId: orgId, role, isPlatformAdmin, updatedAt: new Date() },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

describe("Epic 2 — Story 2.1 create a new company", () => {
  let homeOrg: { id: string };
  let admin: TestUser;
  let auditor: TestUser;
  let platformAuditor: TestUser; // AUDITOR role but platform admin
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const stamp = `${Date.now()}-${Math.round(performance.now())}`;
    homeOrg = await db.organization.create({ data: { id: randomUUID(), name: `Home ${stamp}`, slug: `home-${stamp}`, updatedAt: new Date() } });
    admin = await mkUser(homeOrg.id, UserRole.ORG_ADMIN, "admin");
    auditor = await mkUser(homeOrg.id, UserRole.AUDITOR, "auditor");
    platformAuditor = await mkUser(homeOrg.id, UserRole.AUDITOR, "platform", true);
  });

  afterAll(async () => {
    for (const orgId of [...createdOrgIds, homeOrg.id]) {
      await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT "id" FROM "RiskMatrixTemplate" WHERE "organizationId" = ${orgId})`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "AssessmentType" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "OrganizationMembership" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${orgId}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${orgId}`;
    }
  });

  it("an org admin creates a company, becomes its ADMIN, and can switch into it (FR10, FR12)", async () => {
    const res = await createCaller(admin).organization.create({ name: "Newco One" });
    createdOrgIds.push(res.organizationId);

    expect(res.organizationId).toBeTruthy();
    expect(res.role).toBe(UserRole.ORG_ADMIN);

    const org = await db.organization.findUnique({ where: { id: res.organizationId } });
    expect(org?.name).toBe("Newco One");

    const membership = await db.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: admin.id, organizationId: res.organizationId } },
    });
    expect(membership?.role).toBe(UserRole.ORG_ADMIN);

    const switchable = await createCaller(admin).organization.listSwitchable();
    expect(switchable.map((o) => o.id)).toContain(res.organizationId);
  });

  it("the new company is provisioned with a default risk matrix + assessment type (FR11)", async () => {
    const res = await createCaller(admin).organization.create({ name: "Newco Two" });
    createdOrgIds.push(res.organizationId);

    const { matrix, assessmentType } = await runWithOrganizationContext(res.organizationId, async () => {
      const matrix = await db.riskMatrixTemplate.findFirst({ where: { isDefault: true } });
      const assessmentType = await db.assessmentType.findFirst({ where: { isDefault: true } });
      return { matrix, assessmentType };
    });
    expect(matrix).not.toBeNull();
    expect(assessmentType).not.toBeNull();
  });

  it("a non-admin, non-platform user is FORBIDDEN from creating a company (FR10, NFR3)", async () => {
    await expect(
      createCaller(auditor).organization.create({ name: "Should Fail" }),
    ).rejects.toThrow(/FORBIDDEN|permission|admin|access/i);
  });

  it("a platform admin can create a company even without an org-admin role (FR10)", async () => {
    const res = await createCaller(platformAuditor).organization.create({ name: "Newco Platform" });
    createdOrgIds.push(res.organizationId);
    expect(res.organizationId).toBeTruthy();
  });

  it("writes a CREATE_ORGANIZATION audit entry (AR1)", async () => {
    const res = await createCaller(admin).organization.create({ name: "Newco Audited" });
    createdOrgIds.push(res.organizationId);
    await new Promise((r) => setTimeout(r, 300));

    const logs = await runWithOrganizationContext(res.organizationId, async () => {
      return await db.auditLog.findMany({
        where: { organizationId: res.organizationId, action: "CREATE_ORGANIZATION" },
      });
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
