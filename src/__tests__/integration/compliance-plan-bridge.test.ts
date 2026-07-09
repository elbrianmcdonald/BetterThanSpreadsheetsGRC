/**
 * Bridge to Compliance Plan — Epic 2, Story 2.1 (+2.5): bridge compliance-assessment
 * gaps into a plan as snapshot items with a back-link, idempotently, with staleness
 * derived on read when the source score later changes.
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

describe("Compliance Plan Bridge — Epic 2 Story 2.1/2.5 (compliance)", () => {
  let org: { id: string };
  let admin: TestUser;
  let planId: string;
  let assessmentId: string;
  let c1: string; // NON_COMPLIANT (gap)
  let c2: string; // PARTIALLY_COMPLIANT (gap)
  let c3: string; // COMPLIANT (not a gap)
  let score1Id: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPB ${s}`, slug: `cpb-${s}`, updatedAt: new Date() } });
    const u = await db.user.create({ data: { id: randomUUID(), email: `cpb-${s}@example.com`, name: "cpbadmin", organizationId: org.id, role: UserRole.ORG_ADMIN, updatedAt: new Date() } });
    admin = { id: u.id, email: u.email!, organizationId: org.id, role: UserRole.ORG_ADMIN };

    await runWithOrganizationContext(org.id, async () => {
      const fw = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "FW", code: `FW${s}`, version: "1", isActive: true, updatedAt: new Date() } });
      const mk = async (cid: string, title: string) => {
        const c = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, controlId: cid, title, description: "d", updatedAt: new Date() } });
        return c.id;
      };
      c1 = await mk("AC-01", "Access Control");
      c2 = await mk("AC-02", "Account Mgmt");
      c3 = await mk("AC-03", "Compliant Ctrl");

      const assessment = await db.complianceAssessment.create({
        data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, identifier: `COMP-2026-${s.slice(-4)}`, name: "SOC2 Assessment", ownerId: u.id, updatedAt: new Date() },
      });
      assessmentId = assessment.id;

      const sc1 = await db.controlAssessmentScore.create({ data: { assessmentId: assessment.id, controlId: c1, status: "NON_COMPLIANT", gapDescription: "No MFA on admins", remediationDueDate: new Date("2026-03-01") } });
      score1Id = sc1.id;
      await db.controlAssessmentScore.create({ data: { assessmentId: assessment.id, controlId: c2, status: "PARTIALLY_COMPLIANT", gapDescription: "Partial logging" } });
      await db.controlAssessmentScore.create({ data: { assessmentId: assessment.id, controlId: c3, status: "COMPLIANT" } });
    });

    const plan = await createCaller(admin).compliancePlan.create({ name: "Bridge Plan" });
    planId = plan.id;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "ControlAssessmentScore" WHERE "assessmentId" = ${assessmentId}`;
    await db.$executeRaw`DELETE FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("bridges only below-target controls, with back-link + pre-fill (FR12, FR14, FR16)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeComplianceAssessment({ planId, assessmentId });
    expect(res.total).toBe(2);
    expect(res.added).toBe(2);
    expect(res.skipped).toBe(0);

    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    const controlIds = plan.items.map((i) => i.controlId).sort();
    expect(controlIds).toEqual([c1, c2].sort());
    expect(plan.items.every((i) => i.controlKind === "FRAMEWORK_CONTROL")).toBe(true);

    const item1 = plan.items.find((i) => i.controlId === c1)!;
    expect(item1.notes).toBe("No MFA on admins"); // gap description pre-filled
    expect(item1.targetDate).not.toBeNull(); // remediation due date pre-filled
    expect(item1.sourceKind).toBe("COMPLIANCE_ASSESSMENT");
    expect(item1.sourceId).toBe(score1Id);
  });

  it("is idempotent — re-bridging adds nothing (FR15)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeComplianceAssessment({ planId, assessmentId });
    expect(res.added).toBe(0);
    expect(res.skipped).toBe(2);
    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    expect(plan.items.length).toBe(2);
  });

  it("flags an item stale when its source score later changes (FR18)", async () => {
    // Re-score c1 to COMPLIANT — the bridged item's tracked fields must not change,
    // but it should be flagged for review.
    await runWithOrganizationContext(org.id, async () => {
      await db.controlAssessmentScore.update({ where: { id: score1Id }, data: { status: "COMPLIANT" } });
    });
    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    const item1 = plan.items.find((i) => i.controlId === c1)!;
    const item2 = plan.items.find((i) => i.controlId === c2)!;
    expect(item1.sourceStale).toBe(true);
    expect(item2.sourceStale).toBe(false);
    expect(item1.notes).toBe("No MFA on admins"); // tracked field untouched
  });

  it("listBridgeSources returns the org's assessments for the bridge picker", async () => {
    const sources = await createCaller(admin).compliancePlan.listBridgeSources();
    const comp = sources.find((s) => s.id === assessmentId);
    expect(comp).toBeDefined();
    expect(comp!.kind).toBe("COMPLIANCE");
    expect(comp!.name).toBe("SOC2 Assessment");
  });
});
