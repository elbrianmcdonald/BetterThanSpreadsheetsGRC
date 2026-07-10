/**
 * Bridge to Compliance Plan — Epic 1, Stories 1.3 & 1.4.
 *
 * Control-anchored items: add an item pointing at any of the four control types
 * via a polymorphic reference, resolve the control's identifier/title/description,
 * dedup per plan+control, render a graceful "control removed" state, and move an
 * item through its status lifecycle / edit / remove.
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

describe("Compliance Plan Items — Epic 1 Stories 1.3/1.4", () => {
  let org: { id: string };
  let admin: TestUser;
  let planId: string;
  let frameworkControlId: string;
  let standardControlId: string;
  let orgControlId: string;
  let maturityControlId: string;
  let disposableControlId: string; // deleted mid-test for the "control removed" case
  let lifecycleControlId: string; // dedicated to the status-lifecycle test

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPI ${s}`, slug: `cpi-${s}`, updatedAt: new Date() } });
    const u = await db.user.create({ data: { id: randomUUID(), email: `cpi-${s}@example.com`, name: "cpiadmin", organizationId: org.id, platformRole: UserRole.ADMINISTRATOR, updatedAt: new Date() } });
    admin = { id: u.id, email: u.email!, organizationId: org.id, role: UserRole.ADMINISTRATOR };

    await runWithOrganizationContext(org.id, async () => {
      const fw = await db.framework.create({ data: { id: randomUUID(), organizationId: org.id, name: "FW", code: `FW${s}`, version: "1", isActive: true, updatedAt: new Date() } });
      const c1 = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, controlId: "AC-01", title: "Access Control Policy", description: "Framework control desc", updatedAt: new Date() } });
      frameworkControlId = c1.id;
      const cDisp = await db.control.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: fw.id, controlId: "AC-99", title: "Disposable", description: "to be deleted", updatedAt: new Date() } });
      disposableControlId = cDisp.id;

      const std = await db.standard.create({ data: { id: randomUUID(), organizationId: org.id, title: "Internal Standard", description: "std desc", effectiveDate: new Date(), updatedAt: new Date() } });
      const sc = await db.standardControl.create({ data: { id: randomUUID(), standardId: std.id, code: "ISP-001", title: "Password Policy", description: "Standard control desc" } });
      standardControlId = sc.id;

      const oc = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-0001", name: "MFA Enforcement", description: "Org control desc" } });
      orgControlId = oc.id;
      const ocLife = await db.organizationalControl.create({ data: { id: randomUUID(), organizationId: org.id, localControlId: "OC-0002", name: "Backup Policy", description: "Lifecycle control" } });
      lifecycleControlId = ocLife.id;

      const mfw = await db.maturityFramework.create({ data: { id: randomUUID(), organizationId: org.id, name: "MFW", version: "1", type: "NIST_CSF_2", minLevel: 1, maxLevel: 4, scoringLevels: [{ value: 1, label: "Partial" }], updatedAt: new Date() } });
      const mq = await db.maturityQuestion.create({ data: { id: randomUUID(), frameworkId: mfw.id, practiceCode: "GV-1a", questionText: "Is governance established?", answerType: "SCALE" } });
      maturityControlId = mq.id;
    });

    const plan = await createCaller(admin).compliancePlan.create({ name: "Item Plan" });
    planId = plan.id;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "MaturityQuestion" WHERE "frameworkId" IN (SELECT id FROM "MaturityFramework" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "MaturityFramework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "StandardControl" WHERE "standardId" IN (SELECT id FROM "Standard" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "Standard" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  const getItem = async (itemId: string) => {
    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    return plan.items.find((i) => i.id === itemId)!;
  };

  it("adds a framework-control item and resolves its control (FR5, FR9)", async () => {
    const item = await createCaller(admin).compliancePlan.addItem({
      planId,
      controlKind: "FRAMEWORK_CONTROL",
      controlId: frameworkControlId,
      evidenceNeeded: "Signed policy PDF",
      acceptanceCriteria: "Policy approved and published",
    });
    const fetched = await getItem(item.id);
    expect(fetched.control).not.toBeNull();
    expect(fetched.control!.identifier).toBe("AC-01");
    expect(fetched.control!.title).toBe("Access Control Policy");
    expect(fetched.evidenceNeeded).toBe("Signed policy PDF");
  });

  it("resolves standard, organizational, and maturity controls (FR9)", async () => {
    const sc = await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "STANDARD_CONTROL", controlId: standardControlId });
    const oc = await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "ORGANIZATIONAL_CONTROL", controlId: orgControlId });
    const mc = await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "MATURITY_CONTROL", controlId: maturityControlId });

    expect((await getItem(sc.id)).control!.identifier).toBe("ISP-001");
    expect((await getItem(oc.id)).control!.identifier).toBe("OC-0001");
    expect((await getItem(oc.id)).control!.title).toBe("MFA Enforcement");
    expect((await getItem(mc.id)).control!.identifier).toBe("GV-1a");
  });

  it("prevents adding the same control to a plan twice (FR8)", async () => {
    await expect(
      createCaller(admin).compliancePlan.addItem({ planId, controlKind: "FRAMEWORK_CONTROL", controlId: frameworkControlId }),
    ).rejects.toThrow(/already|exists|duplicate|conflict/i);
  });

  it("renders a graceful 'control removed' state when the control is gone (NFR3)", async () => {
    const item = await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "FRAMEWORK_CONTROL", controlId: disposableControlId });
    await runWithOrganizationContext(org.id, async () => {
      await db.control.delete({ where: { id: disposableControlId } });
    });
    const fetched = await getItem(item.id);
    expect(fetched.control).toBeNull(); // resolved to "removed", not an error
  });

  it("moves an item through its status lifecycle and edits fields, then removes it (FR7, FR11)", async () => {
    const item = await createCaller(admin).compliancePlan.addItem({ planId, controlKind: "ORGANIZATIONAL_CONTROL", controlId: lifecycleControlId, notes: "start" });

    const updated = await createCaller(admin).compliancePlan.updateItem({
      id: item.id,
      status: "IN_PROGRESS",
      notes: "working on it",
      acceptanceCriteria: "Backups verified restorable",
    });
    expect(updated.status).toBe("IN_PROGRESS");
    expect(updated.notes).toBe("working on it");

    await createCaller(admin).compliancePlan.removeItem({ id: item.id });
    const gone = await db.compliancePlanItem.findUnique({ where: { id: item.id } });
    expect(gone).toBeNull();
  });

  it("computes plan progress % on get() (FR21)", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "Progress Plan" });
    const i1 = await createCaller(admin).compliancePlan.addItem({ planId: plan.id, controlKind: "FRAMEWORK_CONTROL", controlId: frameworkControlId });
    await createCaller(admin).compliancePlan.addItem({ planId: plan.id, controlKind: "STANDARD_CONTROL", controlId: standardControlId });
    await createCaller(admin).compliancePlan.updateItem({ id: i1.id, status: "COMPLETE" });
    const got = await createCaller(admin).compliancePlan.get({ id: plan.id });
    expect(got.progressPct).toBe(50); // 1 of 2 closed
    expect(got.overdueCount).toBe(0);
  });

  it("exports a plan as a CSV audit deliverable (FR22)", async () => {
    const plan = await createCaller(admin).compliancePlan.create({ name: "Export Plan" });
    await createCaller(admin).compliancePlan.addItem({
      planId: plan.id,
      controlKind: "FRAMEWORK_CONTROL",
      controlId: frameworkControlId,
      evidenceNeeded: "Signed policy PDF",
      acceptanceCriteria: "Approved and published",
      notes: "=SUM(1+9)*cmd", // CSV formula-injection payload
    });
    const csv = await createCaller(admin).compliancePlan.exportPlan({ id: plan.id });
    expect(csv.filename).toContain("Export Plan");
    expect(csv.content).toContain("Control ID"); // header row
    expect(csv.content).toContain("AC-01");
    expect(csv.content).toContain("Signed policy PDF");
    expect(csv.content).toContain("Approved and published");
    // Formula injection is neutralized (leading '=' prefixed with a single quote).
    expect(csv.content).toContain("'=SUM(1+9)*cmd");
    expect(csv.content).not.toMatch(/(^|,|")=SUM/);
  });

  it("searchControls returns a unified result across control types (FR5 picker)", async () => {
    const byTitle = await createCaller(admin).compliancePlan.searchControls({ query: "Access Control" });
    const fw = byTitle.find((r) => r.controlId === frameworkControlId);
    expect(fw).toBeDefined();
    expect(fw!.kind).toBe("FRAMEWORK_CONTROL");
    expect(fw!.identifier).toBe("AC-01");

    const byIdent = await createCaller(admin).compliancePlan.searchControls({ query: "OC-0001" });
    expect(byIdent.some((r) => r.controlId === orgControlId && r.kind === "ORGANIZATIONAL_CONTROL")).toBe(true);
  });
});
