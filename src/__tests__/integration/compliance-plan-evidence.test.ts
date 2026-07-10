/**
 * Bridge to Compliance Plan — Epic 3, Story 3.1: evidence (FR19 link + FR20 request).
 * Locked: evidence linked via an id array; Evidence Requests go to an explicitly
 * chosen User (item owner is a Person, so the recipient is separate).
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
  const isStaff = role !== UserRole.BUSINESS_USER;
  const u = await db.user.create({ data: { id: randomUUID(), email, name: tag, organizationId: orgId, platformRole: isStaff ? role : null, updatedAt: new Date() } });
  if (!isStaff) {
    // Business user derives role from org membership existence
    await db.organizationMembership.create({ data: { id: randomUUID(), userId: u.id, organizationId: orgId, updatedAt: new Date() } });
  }
  return { id: u.id, email, organizationId: orgId, role };
}

describe("Compliance Plan Evidence — Epic 3 Story 3.1 (FR19/FR20)", () => {
  let org: { id: string };
  let admin: TestUser;
  let recipient: TestUser;
  let controlId: string;
  let evidenceId: string;
  let planId: string;
  let itemId: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPE ${s}`, slug: `cpe-${s}`, updatedAt: new Date() } });
    admin = await mkUser(org.id, UserRole.ADMINISTRATOR, "cpeadmin");
    recipient = await mkUser(org.id, UserRole.ANALYST, "cperecipient");

    await runWithOrganizationContext(org.id, async () => {
      const fw = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "FW", code: `FW${s}`, version: "1", isActive: true, updatedAt: new Date() } });
      controlId = (await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, controlId: "AC-01", title: "AC", description: "d", updatedAt: new Date() } })).id;
      evidenceId = (await db.evidence.create({ data: { id: randomUUID(), organizationId: org.id, title: "MFA Config Screenshot", originalFileName: "mfa.png", filePath: "/x/mfa.png", fileSize: 1024, fileType: "image/png", uploadedBy: admin.id, updatedAt: new Date() } })).id;
    });

    planId = (await createCaller(admin).compliancePlan.create({ name: "Evidence Plan" })).id;
    itemId = (await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "FRAMEWORK_CONTROL", controlId })).id;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "EvidenceRequest" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("links evidence to an item and resolves it on get() (FR19)", async () => {
    await createCaller(admin).compliancePlan.updateItem({ id: itemId, evidenceLinks: [evidenceId] });
    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    const item = plan.items.find((i) => i.id === itemId)!;
    expect(item.evidenceLinks).toContain(evidenceId);
    expect(item.linkedEvidence).toEqual([{ id: evidenceId, title: "MFA Config Screenshot" }]);
  });

  it("lists org users for the request recipient picker", async () => {
    const users = await createCaller(admin).compliancePlan.listOrgUsers();
    expect(users.some((u) => u.id === recipient.id)).toBe(true);
  });

  it("raises an Evidence Request to a chosen user (FR20)", async () => {
    await createCaller(admin).compliancePlan.raiseEvidenceRequest({
      itemId,
      recipientUserId: recipient.id,
      dueDate: new Date("2026-05-01"),
      instructions: "Please upload the MFA configuration export",
    });
    const reqs = await runWithOrganizationContext(org.id, async () =>
      db.evidenceRequest.findMany({ where: { organizationId: org.id, recipientUserId: recipient.id } }),
    );
    expect(reqs.length).toBe(1);
    expect(reqs[0]!.requestedById).toBe(admin.id);
    expect(reqs[0]!.instructions).toContain("MFA configuration");
  });
});
