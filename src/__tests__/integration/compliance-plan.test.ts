/**
 * Bridge to Compliance Plan — Epic 1, Stories 1.1 & 1.2.
 *
 * Named, owned compliance plans: create/update/archive (1.1), and list with
 * owner + progress + overdue counts (1.2). Role-gated to compliance-capable roles.
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

async function mkUser(orgId: string, role: UserRole, tag: string): Promise<TestUser> {
  const email = `${tag}-${Date.now()}-${Math.round(performance.now())}@example.com`;
  const u = await db.user.create({
    data: { id: randomUUID(), email, name: tag, organizationId: orgId, role, updatedAt: new Date() },
  });
  return { id: u.id, email, organizationId: orgId, role };
}

describe("Compliance Plan — Epic 1 Stories 1.1/1.2", () => {
  let org: { id: string };
  let admin: TestUser;
  let auditor: TestUser;
  let ownerPersonId: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CP ${s}`, slug: `cp-${s}`, updatedAt: new Date() } });
    admin = await mkUser(org.id, UserRole.ORG_ADMIN, "cpadmin");
    auditor = await mkUser(org.id, UserRole.AUDITOR, "cpauditor");
    ownerPersonId = await runWithOrganizationContext(org.id, async () => {
      const p = await db.person.create({ data: { organizationId: org.id, name: "Plan Owner" } });
      return p.id;
    });
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("creates a named plan with an owner, defaulting to DRAFT (FR1)", async () => {
    const plan = await createCaller(admin).compliancePlan.create({
      name: "SOC 2 Readiness",
      description: "Close SOC 2 gaps",
      ownerId: ownerPersonId,
    });
    expect(plan.name).toBe("SOC 2 Readiness");
    expect(plan.status).toBe("DRAFT");
    expect(plan.ownerId).toBe(ownerPersonId);
  });

  it("updates a plan's name and status (FR2, FR4)", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "NIST CSF Uplift" });
    const updated = await createCaller(admin).compliancePlan.update({ id: plan.id, name: "NIST CSF Uplift 2026", status: "ACTIVE" });
    expect(updated.name).toBe("NIST CSF Uplift 2026");
    expect(updated.status).toBe("ACTIVE");
  });

  it("archives a plan (FR4)", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "To Archive" });
    await createCaller(admin).compliancePlan.archive({ id: plan.id });
    const row = await db.compliancePlan.findUnique({ where: { id: plan.id }, select: { status: true } });
    expect(row?.status).toBe("ARCHIVED");
  });

  it("denies plan creation to a non-compliance role (NFR2)", async () => {
    await expect(
      createCaller(auditor).compliancePlan.create({ name: "Nope" }),
    ).rejects.toThrow(/FORBIDDEN|role|permission/i);
  });

  it("lists plans with owner, item count, and progress (FR3, FR18)", async () => {
    const created = await createCaller(admin).compliancePlan.create({ name: "Listable", ownerId: ownerPersonId });
    const plans = await createCaller(admin).compliancePlan.list();
    const found = plans.find((p) => p.id === created.id);
    expect(found).toBeDefined();
    expect(found!.owner?.id).toBe(ownerPersonId);
    expect(found!.itemCount).toBe(0);
    expect(found!.progressPct).toBe(0);
    expect(found!.overdueCount).toBe(0);
  });
});
