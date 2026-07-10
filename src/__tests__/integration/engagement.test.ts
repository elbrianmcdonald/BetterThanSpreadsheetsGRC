/**
 * Engagement Router — polymorphic wrapper integration tests.
 *
 * The engagement WRAPS an already-existing assessment (it never creates one).
 * Covers:
 * - create wraps an existing ComplianceAssessment (links assessmentKind=COMPLIANCE
 *   + assessmentId) and generates an ENG-YYYY-NNNN identifier.
 * - create rejects a second engagement for the same assessment (unique index).
 * - create rejects wrapping a non-existent / cross-org assessment (NOT_FOUND).
 * - getById returns child collections + a resolved linkedAssessment with the
 *   right href.
 * - getByAssessment finds the wrapping engagement.
 * - list / cross-org isolation.
 * - session / stakeholder / evidence CRUD + cycleStatus + seedRecommended.
 * - markDelivered sets status DELIVERED.
 *
 * Follows the `deliverable-shell.test.ts` pattern: raw caller via appRouter,
 * org-scoped writes inside `runWithOrganizationContext`, raw-SQL cleanup.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, MaturityFrameworkType } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type TestUser = {
  id: string;
  email: string | null;
  organizationId: string;
  role: UserRole;
};

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        name: "Test Assessor",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  } as any);

describe("Engagement Router - Polymorphic Wrapper", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let analystA: TestUser;
  let analystB: TestUser;

  // Seeded assessments
  let frameworkAId: string;
  let complianceAId: string; // org A compliance assessment (primary wrap target)
  let maturityAId: string; // org A maturity assessment
  let complianceBId: string; // org B compliance assessment (cross-org guard)

  beforeAll(async () => {
    const stamp = Date.now();

    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Eng Org A ${stamp}`, slug: `eng-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Eng Org B ${stamp}`, slug: `eng-b-${stamp}`, updatedAt: new Date() },
    });
    analystA = {
      ...(await db.user.create({
        data: { id: randomUUID(), email: `eng-a-${stamp}@example.com`, name: "Analyst A", organizationId: orgA.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
      })),
      role: UserRole.ANALYST,
    };
    analystB = {
      ...(await db.user.create({
        data: { id: randomUUID(), email: `eng-b-${stamp}@example.com`, name: "Analyst B", organizationId: orgB.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
      })),
      role: UserRole.ANALYST,
    };

    // Org A: Framework + ComplianceAssessment (the primary wrap target).
    await runWithOrganizationContext(orgA.id, async () => {
      const fw = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          code: `ENGFW-${stamp}`,
          name: `Eng FW ${stamp}`,
          version: "1.0",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      frameworkAId = fw.id;

      const comp = await db.complianceAssessment.create({
        data: {
          organizationId: orgA.id,
          frameworkId: fw.id,
          identifier: `COMP-${stamp}-0001`,
          name: "Acme Controls Assessment",
          ownerId: analystA.id,
        },
      });
      complianceAId = comp.id;
    });

    // Org A: MaturityFramework + MaturityAssessment.
    await runWithOrganizationContext(orgA.id, async () => {
      const mf = await db.maturityFramework.create({
        data: {
          organizationId: orgA.id,
          type: MaturityFrameworkType.NIST_CSF_2,
          name: `Eng MF ${stamp}`,
          version: `v-${stamp}`,
          minLevel: 1,
          maxLevel: 5,
          scoringLevels: [{ value: 1, label: "Initial" }],
          isActive: true,
        },
      });
      const mat = await db.maturityAssessment.create({
        data: {
          organizationId: orgA.id,
          frameworkId: mf.id,
          identifier: `MAT-${stamp}-0001`,
          name: "Acme Maturity Assessment",
          ownerId: analystA.id,
        },
      });
      maturityAId = mat.id;
    });

    // Org B: Framework + ComplianceAssessment (cross-org isolation guard).
    await runWithOrganizationContext(orgB.id, async () => {
      const fwB = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: orgB.id,
          code: `ENGFWB-${stamp}`,
          name: `Eng FW B ${stamp}`,
          version: "1.0",
          isActive: true,
          updatedAt: new Date(),
        },
      });
      const compB = await db.complianceAssessment.create({
        data: {
          organizationId: orgB.id,
          frameworkId: fwB.id,
          identifier: `COMP-${stamp}-B001`,
          name: "Org B Controls Assessment",
          ownerId: analystB.id,
        },
      });
      complianceBId = compB.id;
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "EngagementSession" WHERE "engagementId" IN (SELECT "id" FROM "Engagement" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "EngagementStakeholder" WHERE "engagementId" IN (SELECT "id" FROM "Engagement" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "EngagementEvidenceRequest" WHERE "engagementId" IN (SELECT "id" FROM "Engagement" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "Engagement" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "MaturityDomainScore" WHERE "assessmentId" IN (SELECT "id" FROM "MaturityAssessment" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "MaturityAssessment" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "MaturityDomain" WHERE "frameworkId" IN (SELECT "id" FROM "MaturityFramework" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "MaturityFramework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "ControlAssessmentScore" WHERE "assessmentId" IN (SELECT "id" FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "IdentifierSequence" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  describe("create", () => {
    it("wraps an existing ComplianceAssessment and generates an ENG identifier", async () => {
      const caller = createCaller(analystA);
      const eng = await caller.engagement.create({
        assessmentKind: "COMPLIANCE",
        assessmentId: complianceAId,
        clientName: "Acme Inc",
        sector: "Manufacturing",
      });

      expect(eng.identifier).toMatch(/^ENG-\d{4}-\d{4}$/);
      expect(eng.assessmentKind).toBe("COMPLIANCE");
      expect(eng.assessmentId).toBe(complianceAId);
      expect(eng.status).toBe("SCOPING");
      expect(eng.phase).toBe("setup");
      expect(eng.analystId).toBe(analystA.id);
      expect(eng.createdById).toBe(analystA.id);
    });

    it("rejects a second engagement for the same assessment (unique)", async () => {
      const caller = createCaller(analystA);
      await expect(
        caller.engagement.create({
          assessmentKind: "COMPLIANCE",
          assessmentId: complianceAId,
          clientName: "Acme Duplicate",
        }),
      ).rejects.toThrow();
    });

    it("rejects wrapping a non-existent assessment", async () => {
      const caller = createCaller(analystA);
      await expect(
        caller.engagement.create({
          assessmentKind: "COMPLIANCE",
          assessmentId: "does-not-exist",
          clientName: "Ghost Co",
        }),
      ).rejects.toThrow();
    });

    it("rejects wrapping a cross-org assessment", async () => {
      const caller = createCaller(analystA);
      // complianceBId belongs to org B — analyst A must not be able to wrap it.
      await expect(
        caller.engagement.create({
          assessmentKind: "COMPLIANCE",
          assessmentId: complianceBId,
          clientName: "Cross Org Co",
        }),
      ).rejects.toThrow();
    });
  });

  describe("getById / getByAssessment / list / isolation", () => {
    it("getById returns child collections + linkedAssessment with the right href", async () => {
      const caller = createCaller(analystA);
      const created = await caller.engagement.create({
        assessmentKind: "MATURITY",
        assessmentId: maturityAId,
        clientName: "GetById Co",
      });

      const got = await caller.engagement.getById({ id: created.id });
      expect(got.id).toBe(created.id);
      expect(Array.isArray(got.sessions)).toBe(true);
      expect(Array.isArray(got.stakeholders)).toBe(true);
      expect(Array.isArray(got.evidenceRequests)).toBe(true);
      expect(got.linkedAssessment?.kind).toBe("MATURITY");
      expect(got.linkedAssessment?.id).toBe(maturityAId);
      expect(got.linkedAssessment?.href).toBe(`/maturity/${maturityAId}`);
      expect(got.linkedAssessment?.name).toBe("Acme Maturity Assessment");
    });

    it("getByAssessment finds the wrapping engagement", async () => {
      const caller = createCaller(analystA);
      const found = await caller.engagement.getByAssessment({
        assessmentKind: "COMPLIANCE",
        assessmentId: complianceAId,
      });
      expect(found).not.toBeNull();
      expect(found?.assessmentId).toBe(complianceAId);

      const none = await caller.engagement.getByAssessment({
        assessmentKind: "COMPLIANCE",
        assessmentId: "no-such-assessment",
      });
      expect(none).toBeNull();
    });

    it("lists only the caller org's engagements, newest first", async () => {
      const caller = createCaller(analystA);
      const list = await caller.engagement.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
      const times = list.map((e) => new Date(e.createdAt).getTime());
      const sorted = [...times].sort((a, b) => b - a);
      expect(times).toEqual(sorted);
    });

    it("org B cannot getById org A's engagement", async () => {
      const callerA = createCaller(analystA);
      const created = await callerA.engagement.getByAssessment({
        assessmentKind: "COMPLIANCE",
        assessmentId: complianceAId,
      });
      const callerB = createCaller(analystB);
      await expect(callerB.engagement.getById({ id: created!.id })).rejects.toThrow();
    });
  });

  describe("session CRUD + seedRecommended", () => {
    it("creates, updates, lists, removes, and idempotently seeds sessions", async () => {
      const caller = createCaller(analystA);
      const eng = await caller.engagement.getByAssessment({
        assessmentKind: "MATURITY",
        assessmentId: maturityAId,
      });

      const s = await caller.engagement.session.create({
        engagementId: eng!.id,
        name: "Kickoff",
        week: "Week 1",
      });
      expect(s.name).toBe("Kickoff");

      const updated = await caller.engagement.session.update({ id: s.id, duration: "60 min" });
      expect(updated.duration).toBe("60 min");

      const seed1 = await caller.engagement.session.seedRecommended({ engagementId: eng!.id });
      expect(seed1.inserted).toBeGreaterThan(0);
      const seed2 = await caller.engagement.session.seedRecommended({ engagementId: eng!.id });
      expect(seed2.inserted).toBe(0); // idempotent

      const listed = await caller.engagement.session.list({ engagementId: eng!.id });
      expect(listed.length).toBeGreaterThan(1);

      await caller.engagement.session.remove({ id: s.id });
      const after = await caller.engagement.session.list({ engagementId: eng!.id });
      expect(after.find((x) => x.id === s.id)).toBeUndefined();
    });
  });

  describe("stakeholder CRUD", () => {
    it("creates, updates, removes stakeholders", async () => {
      const caller = createCaller(analystA);
      const eng = await caller.engagement.getByAssessment({
        assessmentKind: "MATURITY",
        assessmentId: maturityAId,
      });

      const sh = await caller.engagement.stakeholder.create({
        engagementId: eng!.id,
        name: "Jane Doe",
        role: "MANAGER",
        raci: "A",
        isApprover: true,
      });
      expect(sh.raci).toBe("A");
      expect(sh.isApprover).toBe(true);

      const updated = await caller.engagement.stakeholder.update({ id: sh.id, domain: "gov" });
      expect(updated.domain).toBe("gov");

      await caller.engagement.stakeholder.remove({ id: sh.id });
      const list = await caller.engagement.stakeholder.list({ engagementId: eng!.id });
      expect(list.find((x) => x.id === sh.id)).toBeUndefined();
    });
  });

  describe("evidence CRUD + cycleStatus + seedRecommended", () => {
    it("cycles status REQUESTED → PARTIAL → RECEIVED → REQUESTED", async () => {
      const caller = createCaller(analystA);
      const eng = await caller.engagement.getByAssessment({
        assessmentKind: "COMPLIANCE",
        assessmentId: complianceAId,
      });

      const ev = await caller.engagement.evidence.create({
        engagementId: eng!.id,
        item: "Policy set",
      });
      expect(ev.status).toBe("REQUESTED");

      const c1 = await caller.engagement.evidence.cycleStatus({ id: ev.id });
      expect(c1.status).toBe("PARTIAL");
      const c2 = await caller.engagement.evidence.cycleStatus({ id: ev.id });
      expect(c2.status).toBe("RECEIVED");
      const c3 = await caller.engagement.evidence.cycleStatus({ id: ev.id });
      expect(c3.status).toBe("REQUESTED");

      const seed1 = await caller.engagement.evidence.seedRecommended({ engagementId: eng!.id });
      expect(seed1.inserted).toBeGreaterThan(0);
      const seed2 = await caller.engagement.evidence.seedRecommended({ engagementId: eng!.id });
      expect(seed2.inserted).toBe(0);

      await caller.engagement.evidence.remove({ id: ev.id });
      const list = await caller.engagement.evidence.list({ engagementId: eng!.id });
      expect(list.find((x) => x.id === ev.id)).toBeUndefined();
    });
  });

  describe("markDelivered", () => {
    it("sets status DELIVERED + phase review + deliveredAt", async () => {
      const caller = createCaller(analystA);
      const eng = await caller.engagement.getByAssessment({
        assessmentKind: "MATURITY",
        assessmentId: maturityAId,
      });
      const delivered = await caller.engagement.markDelivered({ id: eng!.id });
      expect(delivered.status).toBe("DELIVERED");
      expect(delivered.phase).toBe("review");
      expect(delivered.deliveredAt).toBeTruthy();
    });
  });
});
