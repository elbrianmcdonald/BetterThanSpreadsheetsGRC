/**
 * Bridge to Compliance Plan — Epic 2, Stories 2.3 (standard exceptions) & 2.4
 * (org deficiencies). Same proven pattern: gap source → snapshot item + back-link,
 * idempotent, staleness derived on read.
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

describe("Compliance Plan Bridge — Epic 2 Stories 2.3/2.4 (standard + org)", () => {
  let org: { id: string };
  let admin: TestUser;
  let personId: string;
  let standardId: string;
  let scGap: string; // standard control with an open exception
  let exceptionId: string;
  let orgControlGap: string; // org control with an open deficiency
  let deficiencyId: string;
  let planStd: string;
  let planOrg: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPBX ${s}`, slug: `cpbx-${s}`, updatedAt: new Date() } });
    const u = await db.user.create({ data: { id: randomUUID(), email: `cpbx-${s}@example.com`, name: "cpbxadmin", organizationId: org.id, platformRole: UserRole.ADMINISTRATOR, updatedAt: new Date() } });
    admin = { id: u.id, email: u.email!, organizationId: org.id, role: UserRole.ADMINISTRATOR };

    await runWithOrganizationContext(org.id, async () => {
      personId = (await db.person.create({ data: { organizationId: org.id, name: "Deficiency Owner" } })).id;

      // Standard + controls + an APPROVED (active) exception on scGap.
      const std = await db.standard.create({ data: { id: randomUUID(), organizationId: org.id, title: "Internal Std", description: "d", effectiveDate: new Date(), updatedAt: new Date() } });
      standardId = std.id;
      scGap = (await db.standardControl.create({ data: { id: randomUUID(), standardId: std.id, code: "ISP-001", title: "Password Policy", description: "d" } })).id;
      await db.standardControl.create({ data: { id: randomUUID(), standardId: std.id, code: "ISP-002", title: "No Exception Ctrl", description: "d" } });
      exceptionId = (await db.controlException.create({ data: { id: randomUUID(), organizationId: org.id, standardControlId: scGap, status: "APPROVED", justification: "Legacy system exception", requestedById: u.id, expiresAt: new Date("2026-12-31") } })).id;

      // Org control + test record + an OPEN deficiency.
      orgControlGap = (await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-0001", name: "MFA Enforcement", description: "d" } })).id;
      const tr = await db.orgControlTestRecord.create({ data: { id: randomUUID(), organizationId: org.id, orgControlId: orgControlGap, testedById: u.id, result: "FAIL" } });
      deficiencyId = (await db.orgControlDeficiency.create({ data: { id: randomUUID(), organizationId: org.id, testRecordId: tr.id, orgControlId: orgControlGap, description: "MFA not enforced for admins", severity: "HIGH", remediationStatus: "OPEN", remediationDueDate: new Date("2026-04-01"), remediationOwnerId: personId } })).id;
    });

    planStd = (await createCaller(admin).compliancePlan.create({ name: "Std Plan" })).id;
    planOrg = (await createCaller(admin).compliancePlan.create({ name: "Org Plan" })).id;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "OrgControlDeficiency" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "OrgControlTestRecord" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "ControlException" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "StandardControl" WHERE "standardId" IN (SELECT id FROM "Standard" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "Standard" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("listBridgeSources includes standards and an org-deficiencies option (initial state)", async () => {
    const sources = await createCaller(admin).compliancePlan.listBridgeSources();
    expect(sources.some((s) => s.kind === "STANDARD" && s.id === standardId)).toBe(true);
    expect(sources.some((s) => s.kind === "ORG_DEFICIENCY")).toBe(true);
  });

  // ---- Story 2.3: standard exceptions ----
  it("bridges standard-control open exceptions (FR14)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeStandardExceptions({ planId: planStd, standardId });
    expect(res.added).toBe(1);
    const plan = await createCaller(admin).compliancePlan.get({ id: planStd });
    expect(plan.items.length).toBe(1);
    const item = plan.items[0]!;
    expect(item.controlKind).toBe("STANDARD_CONTROL");
    expect(item.controlId).toBe(scGap);
    expect(item.sourceKind).toBe("STANDARD_EXCEPTION");
    expect(item.sourceId).toBe(exceptionId);
    expect(item.targetDate).not.toBeNull(); // expiresAt
  });

  it("standard bridge is idempotent + flags stale when exception expires (FR15, FR18)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeStandardExceptions({ planId: planStd, standardId });
    expect(res.added).toBe(0);
    await runWithOrganizationContext(org.id, async () => {
      await db.controlException.update({ where: { id: exceptionId }, data: { status: "EXPIRED" } });
    });
    const plan = await createCaller(admin).compliancePlan.get({ id: planStd });
    expect(plan.items[0]!.sourceStale).toBe(true);
  });

  // ---- Story 2.4: org deficiencies ----
  it("bridges open org-control deficiencies with owner + due date (FR15/2.4)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeOrgDeficiencies({ planId: planOrg });
    expect(res.added).toBe(1);
    const plan = await createCaller(admin).compliancePlan.get({ id: planOrg });
    const item = plan.items[0]!;
    expect(item.controlKind).toBe("ORGANIZATIONAL_CONTROL");
    expect(item.controlId).toBe(orgControlGap);
    expect(item.notes).toBe("MFA not enforced for admins");
    expect(item.ownerId).toBe(personId);
    expect(item.sourceKind).toBe("ORG_DEFICIENCY");
    expect(item.sourceId).toBe(deficiencyId);
  });

  it("org bridge is idempotent + flags stale when deficiency resolved (FR15, FR18)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeOrgDeficiencies({ planId: planOrg });
    expect(res.added).toBe(0);
    await runWithOrganizationContext(org.id, async () => {
      await db.orgControlDeficiency.update({ where: { id: deficiencyId }, data: { remediationStatus: "COMPLETED" } });
    });
    const plan = await createCaller(admin).compliancePlan.get({ id: planOrg });
    expect(plan.items[0]!.sourceStale).toBe(true);
  });
});
