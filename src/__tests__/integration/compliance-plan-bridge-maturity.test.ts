/**
 * Bridge to Compliance Plan — Epic 2, Story 2.2: bridge maturity-assessment gaps.
 *
 * Locked decision: a "maturity control" supports both a practice (MATURITY_CONTROL,
 * manual) and a domain (MATURITY_DOMAIN, bridged). The bridge works at the domain
 * level — every domain scored below its target level becomes a MATURITY_DOMAIN item.
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

describe("Compliance Plan Bridge — Epic 2 Story 2.2 (maturity, domain-level)", () => {
  let org: { id: string };
  let admin: TestUser;
  let planId: string;
  let assessmentId: string;
  let gapDomainId: string; // below target
  let okDomainId: string; // at target
  let gapScoreId: string;

  beforeAll(async () => {
    const s = `${Date.now()}-${Math.round(performance.now())}`;
    org = await db.organization.create({ data: { id: randomUUID(), name: `CPBM ${s}`, slug: `cpbm-${s}`, updatedAt: new Date() } });
    const u = await db.user.create({ data: { id: randomUUID(), email: `cpbm-${s}@example.com`, name: "cpbmadmin", organizationId: org.id, platformRole: UserRole.ADMINISTRATOR, updatedAt: new Date() } });
    admin = { id: u.id, email: u.email!, organizationId: org.id, role: UserRole.ADMINISTRATOR };

    await runWithOrganizationContext(org.id, async () => {
      const mfw = await db.maturityFramework.create({ data: { id: randomUUID(), organizationId: org.id, name: "MFW", version: "1", type: "NIST_CSF_2", minLevel: 1, maxLevel: 4, scoringLevels: [{ value: 1, label: "Partial" }], updatedAt: new Date() } });
      const govern = await db.maturityDomain.create({ data: { id: randomUUID(), frameworkId: mfw.id, code: "GV", name: "Govern", level: "CATEGORY" } });
      const identify = await db.maturityDomain.create({ data: { id: randomUUID(), frameworkId: mfw.id, code: "ID", name: "Identify", level: "CATEGORY" } });
      gapDomainId = govern.id;
      okDomainId = identify.id;

      const assessment = await db.maturityAssessment.create({ data: { id: randomUUID(), organizationId: org.id, frameworkId: mfw.id, identifier: `MAT-2026-${s.slice(-4)}`, name: "CSF Assessment", ownerId: u.id, updatedAt: new Date() } });
      assessmentId = assessment.id;

      const gs = await db.maturityDomainScore.create({ data: { id: randomUUID(), assessmentId: assessment.id, domainId: govern.id, currentLevel: 1, targetLevel: 3 } });
      gapScoreId = gs.id;
      await db.maturityDomainScore.create({ data: { id: randomUUID(), assessmentId: assessment.id, domainId: identify.id, currentLevel: 3, targetLevel: 3 } });
    });

    const plan = await createCaller(admin).compliancePlan.create({ name: "Maturity Bridge Plan" });
    planId = plan.id;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "CompliancePlanItem" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "CompliancePlan" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "MaturityDomainScore" WHERE "assessmentId" = ${assessmentId}`;
    await db.$executeRaw`DELETE FROM "MaturityAssessment" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "MaturityDomain" WHERE "frameworkId" IN (SELECT id FROM "MaturityFramework" WHERE "organizationId" = ${org.id})`;
    await db.$executeRaw`DELETE FROM "MaturityFramework" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
  });

  it("bridges only below-target domains as MATURITY_DOMAIN items (FR13)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeMaturityAssessment({ planId, assessmentId });
    expect(res.total).toBe(1);
    expect(res.added).toBe(1);

    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    expect(plan.items.length).toBe(1);
    const item = plan.items[0]!;
    expect(item.controlKind).toBe("MATURITY_DOMAIN");
    expect(item.controlId).toBe(gapDomainId);
    expect(item.control!.identifier).toBe("GV");
    expect(item.control!.title).toBe("Govern");
    expect(item.sourceKind).toBe("MATURITY_ASSESSMENT");
    expect(item.sourceId).toBe(gapScoreId);
  });

  it("is idempotent (FR15)", async () => {
    const res = await createCaller(admin).compliancePlan.bridgeMaturityAssessment({ planId, assessmentId });
    expect(res.added).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("flags the item stale when the domain is re-scored to target (FR18)", async () => {
    await runWithOrganizationContext(org.id, async () => {
      await db.maturityDomainScore.update({ where: { id: gapScoreId }, data: { currentLevel: 3 } });
    });
    const plan = await createCaller(admin).compliancePlan.get({ id: planId });
    expect(plan.items[0]!.sourceStale).toBe(true);
  });
});
