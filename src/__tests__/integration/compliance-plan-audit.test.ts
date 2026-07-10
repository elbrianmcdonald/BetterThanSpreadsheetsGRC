/**
 * Bridge to Compliance Plan — NFR5: creating a plan, bridging gaps, and changing
 * an item's status each emit an AuditLog entry.
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

const auditCount = (orgId: string, action: string, entityId?: string) =>
  runWithOrganizationContext(orgId, async () =>
    db.auditLog.count({ where: { organizationId: orgId, action: action as never, ...(entityId ? { entityId } : {}) } }),
  );

describe("Compliance Plan — audit (NFR5)", () => {
  let org: { id: string };
  let admin: TestUser;
  let assessmentId: string;
  let controlId: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPA ${s}`, slug: `cpa-${s}`, updatedAt: new Date() } });
    const u = await db.user.create({ data: { id: randomUUID(), email: `cpa-${s}@example.com`, name: "cpaadmin", organizationId: org.id, role: UserRole.ADMINISTRATOR, updatedAt: new Date() } });
    admin = { id: u.id, email: u.email!, organizationId: org.id, role: UserRole.ADMINISTRATOR };
    await runWithOrganizationContext(org.id, async () => {
      const fw = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "FW", code: `FW${s}`, version: "1", isActive: true, updatedAt: new Date() } });
      controlId = (await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, controlId: "AC-01", title: "AC", description: "d", updatedAt: new Date() } })).id;
      const a = await db.complianceAssessment.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, identifier: `COMP-2026-${s.slice(-4)}`, name: "A", ownerId: u.id, updatedAt: new Date() } });
      assessmentId = a.id;
      await db.controlAssessmentScore.create({ data: { assessmentId: a.id, controlId, status: "NON_COMPLIANT", gapDescription: "gap" } });
    });
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "ControlAssessmentScore" WHERE "assessmentId" = ${assessmentId}`;
    await db.$executeRaw`DELETE FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("creating a plan writes CREATE_COMPLIANCE_PLAN", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "Audited Plan" });
    await new Promise((r) => setTimeout(r, 300));
    expect(await auditCount(org.id, "CREATE_COMPLIANCE_PLAN", plan.id)).toBeGreaterThanOrEqual(1);
  });

  it("bridging writes BRIDGE_COMPLIANCE_PLAN", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "Bridge Audited" });
    await createCaller(admin).compliancePlan.bridgeComplianceAssessment({ planId: plan.id, assessmentId });
    await new Promise((r) => setTimeout(r, 300));
    expect(await auditCount(org.id, "BRIDGE_COMPLIANCE_PLAN", plan.id)).toBeGreaterThanOrEqual(1);
  });

  it("changing an item's status writes UPDATE_COMPLIANCE_PLAN_ITEM", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "Status Audited" });
    const item = await createCaller(admin).compliancePlan.addItem({ planId: plan.id, controlKind: "FRAMEWORK_CONTROL", controlId });
    await createCaller(admin).compliancePlan.updateItem({ id: item.id, status: "IN_PROGRESS" });
    await new Promise((r) => setTimeout(r, 300));
    expect(await auditCount(org.id, "UPDATE_COMPLIANCE_PLAN_ITEM", item.id)).toBeGreaterThanOrEqual(1);
  });
});
