/**
 * Epic 19: Pathway router — integration tests.
 *
 * Covers:
 * - create scoped to an assessment (kind + id) → getById returns ordered steps.
 * - addStep with a finding sets Finding.isToxic = true.
 * - addStep with a risk sets Risk.isToxic = true.
 * - a finding in TWO pathways (two steps across two pathway records) — both
 *   exist (many-to-many).
 * - removeStep / remove reset isToxic only when the member is orphaned (still
 *   toxic while referenced by another pathway).
 * - listByAssessment returns multiple pathways for the same assessment.
 * - cross-org isolation: org B cannot getById org A's pathway (NOT_FOUND).
 *
 * The router is exercised via a standalone caller built from the pathwayRouter
 * directly (so the test does not depend on root.ts registration). Org-scoped DB
 * seeds run inside runWithOrganizationContext with the create awaited INSIDE the
 * callback (PrismaPromise is lazy).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import {
  UserRole,
  FindingSource,
  Severity,
  AssessmentKind,
  MaturityFrameworkType,
} from "@prisma/client";
import { createTRPCRouter, createCallerFactory } from "@/server/api/trpc";
import { pathwayRouter } from "@/server/api/routers/pathway";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

const testRouter = createTRPCRouter({ pathway: pathwayRouter });
const createCallerInternal = createCallerFactory(testRouter);

type TestUser = { id: string; email: string | null; organizationId: string; role: UserRole };

const createCaller = (user: TestUser) =>
  createCallerInternal({
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

/**
 * Seed a MATURITY assessment (the lightest assessment to construct: just a
 * framework + owner) to scope pathways against. Returns the assessment id, used
 * as the pathway's polymorphic `assessmentId`.
 */
async function seedMaturityAssessment(orgId: string, ownerId: string, identifier: string) {
  return runWithOrganizationContext(orgId, async () => {
    const framework = await db.maturityFramework.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        type: MaturityFrameworkType.NIST_CSF_2,
        name: `FW ${identifier}`,
        // Version is part of the (organizationId, type, version) unique key, so
        // derive it from the identifier to keep each seeded framework distinct.
        version: `1.0-${identifier}`,
        minLevel: 1,
        maxLevel: 5,
        scoringLevels: [],
      },
    });
    return db.maturityAssessment.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        frameworkId: framework.id,
        identifier,
        name: `Assessment ${identifier}`,
        ownerId,
      },
    });
  });
}

async function seedFinding(orgId: string, userId: string, identifier: string) {
  return runWithOrganizationContext(orgId, async () => {
    return db.finding.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        identifier,
        title: `Finding ${identifier}`,
        description: "desc",
        source: FindingSource.MANUAL,
        severity: Severity.HIGH,
        createdBy: userId,
      },
    });
  });
}

async function seedRisk(orgId: string, userId: string, identifier: string) {
  return runWithOrganizationContext(orgId, async () => {
    return db.risk.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        identifier,
        title: `Risk ${identifier}`,
        description: "desc",
        severity: Severity.HIGH,
        createdById: userId,
      },
    });
  });
}

describe("Pathway router - Epic 19", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: TestUser;
  let userB: TestUser;
  let assessmentA: { id: string };
  let assessmentB: { id: string };

  beforeAll(async () => {
    const stamp = Date.now();
    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Pathway Org A ${stamp}`, slug: `pw-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Pathway Org B ${stamp}`, slug: `pw-b-${stamp}`, updatedAt: new Date() },
    });
    const uA = await db.user.create({
      data: { id: randomUUID(), email: `pwa-${stamp}@example.com`, name: "PW A", organizationId: orgA.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
    });
    const uB = await db.user.create({
      data: { id: randomUUID(), email: `pwb-${stamp}@example.com`, name: "PW B", organizationId: orgB.id, platformRole: UserRole.ANALYST, updatedAt: new Date() },
    });
    userA = { id: uA.id, email: uA.email, organizationId: orgA.id, role: UserRole.ANALYST };
    userB = { id: uB.id, email: uB.email, organizationId: orgB.id, role: UserRole.ANALYST };

    assessmentA = await seedMaturityAssessment(orgA.id, userA.id, `MAT-PW-A-${stamp}`);
    assessmentB = await seedMaturityAssessment(orgB.id, userB.id, `MAT-PW-B-${stamp}`);
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      // PathwayStep cascades from Pathway; delete steps first, then pathways, etc.
      await db.$executeRaw`DELETE FROM "PathwayStep" WHERE "pathwayId" IN (SELECT "id" FROM "Pathway" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "Pathway" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${org.id}`;
      // MaturityAssessment cascades from MaturityFramework; delete assessments
      // first, then their frameworks.
      await db.$executeRaw`DELETE FROM "MaturityAssessment" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "MaturityFramework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("create scoped to an assessment + addStep auto-orders; getById returns ordered steps", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Acme kill chain",
      verdict: "Full domain compromise in under an hour.",
      blastRadius: "Entire production AD forest.",
    });

    const ordFinding = await seedFinding(orgA.id, userA.id, `FND-ORD-${Date.now()}`);
    await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Initial Access", technique: "Phishing", mitreTid: "T1566", findingId: ordFinding.id });
    await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Credential Access", technique: "Brute Force", mitreTid: "T1110", findingId: ordFinding.id });

    const loaded = await caller.pathway.getById({ id: pathway.id });
    expect(loaded.steps).toHaveLength(2);
    expect(loaded.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(loaded.steps[0]!.technique).toBe("Phishing");
  });

  it("rejects create for an assessment that does not exist in the org", async () => {
    const caller = createCaller(userA);
    await expect(
      caller.pathway.create({
        assessmentKind: AssessmentKind.MATURITY,
        assessmentId: "does-not-exist",
        name: "Orphan pathway",
      }),
    ).rejects.toThrow();
  });

  // --- Master library (org-level pathways + M2M links) ---

  it("create without an assessment yields a master-library pathway that list() returns", async () => {
    const caller = createCaller(userA);
    const p = await caller.pathway.create({ name: "Master-only pathway" });
    expect(p.assessmentId).toBeNull();
    const list = await caller.pathway.list();
    expect(list.some((x) => x.id === p.id)).toBe(true);
  });

  it("create with an assessment links it; unlinkFromAssessment removes it from the tab but keeps it in the library", async () => {
    const caller = createCaller(userA);
    const p = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Linked-on-create pathway",
    });
    let inTab = await caller.pathway.listByAssessment({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
    });
    expect(inTab.some((x) => x.id === p.id)).toBe(true);

    await caller.pathway.unlinkFromAssessment({
      pathwayId: p.id,
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
    });
    inTab = await caller.pathway.listByAssessment({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
    });
    expect(inTab.some((x) => x.id === p.id)).toBe(false);

    // Still in the master library after unlinking.
    expect((await caller.pathway.list()).some((x) => x.id === p.id)).toBe(true);
  });

  it("linkToAssessment attaches an existing master pathway to an assessment", async () => {
    const caller = createCaller(userA);
    const p = await caller.pathway.create({ name: "To be linked" });
    expect(
      (
        await caller.pathway.listByAssessment({
          assessmentKind: AssessmentKind.MATURITY,
          assessmentId: assessmentA.id,
        })
      ).some((x) => x.id === p.id),
    ).toBe(false);

    await caller.pathway.linkToAssessment({
      pathwayId: p.id,
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
    });
    expect(
      (
        await caller.pathway.listByAssessment({
          assessmentKind: AssessmentKind.MATURITY,
          assessmentId: assessmentA.id,
        })
      ).some((x) => x.id === p.id),
    ).toBe(true);
  });

  it("pathway-level linkFinding / linkRisk are reflected in list() counts", async () => {
    const caller = createCaller(userA);
    const p = await caller.pathway.create({ name: "Tag targets" });
    const finding = await seedFinding(orgA.id, userA.id, `FND-TAG-${Date.now()}`);
    const risk = await seedRisk(orgA.id, userA.id, `RSK-TAG-${Date.now()}`);

    await caller.pathway.linkFinding({ pathwayId: p.id, findingId: finding.id });
    await caller.pathway.linkRisk({ pathwayId: p.id, riskId: risk.id });

    const row = (await caller.pathway.list()).find((x) => x.id === p.id);
    expect(row?.findingCount).toBe(1);
    expect(row?.riskCount).toBe(1);

    await caller.pathway.unlinkFinding({ pathwayId: p.id, findingId: finding.id });
    expect((await caller.pathway.list()).find((x) => x.id === p.id)?.findingCount).toBe(0);
  });

  it("cross-org: userB cannot link userA's pathway to its own assessment", async () => {
    const p = await createCaller(userA).pathway.create({ name: "Org A private" });
    await expect(
      createCaller(userB).pathway.linkToAssessment({
        pathwayId: p.id,
        assessmentKind: AssessmentKind.MATURITY,
        assessmentId: assessmentB.id,
      }),
    ).rejects.toThrow();
  });

  it("addStep with a finding sets Finding.isToxic = true", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Finding pathway",
    });
    const finding = await seedFinding(orgA.id, userA.id, `FND-ADD-${Date.now()}`);

    const step = await caller.pathway.addStep({
      pathwayId: pathway.id,
      tactic: "Impact",
      technique: "Data Encrypted",
      findingId: finding.id,
    });

    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(true);

    const loaded = await caller.pathway.getById({ id: pathway.id });
    expect(loaded.steps[0]!.id).toBe(step.id);
    expect(loaded.steps[0]!.finding?.id).toBe(finding.id);
    expect(loaded.steps[0]!.risk).toBeNull();
  });

  it("addStep with a risk sets Risk.isToxic = true", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Risk pathway",
    });
    const risk = await seedRisk(orgA.id, userA.id, `RSK-ADD-${Date.now()}`);

    await caller.pathway.addStep({
      pathwayId: pathway.id,
      tactic: "Impact",
      technique: "Service Stop",
      riskId: risk.id,
    });

    expect((await db.risk.findUnique({ where: { id: risk.id } }))?.isToxic).toBe(true);

    const loaded = await caller.pathway.getById({ id: pathway.id });
    expect(loaded.steps[0]!.risk?.id).toBe(risk.id);
    expect(loaded.steps[0]!.finding).toBeNull();
  });

  it("allows a step to reference both findings and risks (multi-member)", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Both pathway",
    });
    const finding = await seedFinding(orgA.id, userA.id, `FND-BOTH-${Date.now()}`);
    const risk = await seedRisk(orgA.id, userA.id, `RSK-BOTH-${Date.now()}`);

    await caller.pathway.addStep({
      pathwayId: pathway.id,
      tactic: "Impact",
      technique: "X",
      findingId: finding.id,
      riskId: risk.id,
    });

    // Both members are flagged toxic and surfaced on the step's members join.
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(true);
    expect((await db.risk.findUnique({ where: { id: risk.id } }))?.isToxic).toBe(true);

    const loaded = await caller.pathway.getById({ id: pathway.id });
    const kinds = (loaded.steps[0]!.members ?? [])
      .map((m) => m.kind)
      .sort();
    expect(kinds).toEqual(["finding", "risk"]);
  });

  it("a finding in two pathways: both steps exist (many-to-many) and isToxic survives removing one", async () => {
    const caller = createCaller(userA);
    const finding = await seedFinding(orgA.id, userA.id, `FND-M2M-${Date.now()}`);

    const p1 = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "M2M pathway 1",
    });
    const p2 = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "M2M pathway 2",
    });

    const s1 = await caller.pathway.addStep({ pathwayId: p1.id, tactic: "Initial Access", technique: "Phish", findingId: finding.id });
    await caller.pathway.addStep({ pathwayId: p2.id, tactic: "Impact", technique: "Exfil", findingId: finding.id });

    // Both pathways reference the same finding.
    expect((await caller.pathway.getById({ id: p1.id })).steps[0]!.finding?.id).toBe(finding.id);
    expect((await caller.pathway.getById({ id: p2.id })).steps[0]!.finding?.id).toBe(finding.id);
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(true);

    // Removing the step in p1 leaves it toxic (still referenced by p2).
    await caller.pathway.removeStep({ id: s1.id });
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(true);

    // Deleting p2 finally orphans the finding → isToxic reset.
    await caller.pathway.remove({ id: p2.id });
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(false);
  });

  it("removeStep re-sequences order and resets isToxic on the released finding", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Resequence pathway",
    });
    const fA = await seedFinding(orgA.id, userA.id, `FND-RA-${Date.now()}`);
    const s1 = await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Initial Access", technique: "Phish", findingId: fA.id });
    const finding = await seedFinding(orgA.id, userA.id, `FND-RM-${Date.now()}`);
    const s2 = await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Impact", technique: "Exfil", findingId: finding.id });
    const fB = await seedFinding(orgA.id, userA.id, `FND-RB-${Date.now()}`);
    await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Lateral Movement", technique: "RDP", findingId: fB.id });

    await caller.pathway.removeStep({ id: s2.id });

    const loaded = await caller.pathway.getById({ id: pathway.id });
    expect(loaded.steps).toHaveLength(2);
    // Contiguous re-sequence: 1, 2 (no gap left by removing the middle step).
    expect(loaded.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(loaded.steps[0]!.id).toBe(s1.id);
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(false);
  });

  it("remove deletes the pathway (cascade steps) and resets isToxic on finding + risk", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Delete pathway",
    });
    const finding = await seedFinding(orgA.id, userA.id, `FND-DEL-${Date.now()}`);
    const risk = await seedRisk(orgA.id, userA.id, `RSK-DEL-${Date.now()}`);
    await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Impact", technique: "Wipe", findingId: finding.id });
    await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Impact", technique: "Stop", riskId: risk.id });

    await caller.pathway.remove({ id: pathway.id });

    const steps = await db.pathwayStep.findMany({ where: { pathwayId: pathway.id } });
    expect(steps).toHaveLength(0);
    expect((await db.finding.findUnique({ where: { id: finding.id } }))?.isToxic).toBe(false);
    expect((await db.risk.findUnique({ where: { id: risk.id } }))?.isToxic).toBe(false);
  });

  it("linkMember / unlinkMember manage a step's member + isToxic", async () => {
    const caller = createCaller(userA);
    const pathway = await caller.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Link pathway",
    });
    const baseFinding = await seedFinding(orgA.id, userA.id, `FND-LINKBASE-${Date.now()}`);
    const step = await caller.pathway.addStep({ pathwayId: pathway.id, tactic: "Impact", technique: "Ransom", findingId: baseFinding.id });
    const risk = await seedRisk(orgA.id, userA.id, `RSK-LINK-${Date.now()}`);

    await caller.pathway.linkMember({ stepId: step.id, riskId: risk.id });
    expect((await db.risk.findUnique({ where: { id: risk.id } }))?.isToxic).toBe(true);

    await caller.pathway.unlinkMember({ stepId: step.id });
    expect((await db.risk.findUnique({ where: { id: risk.id } }))?.isToxic).toBe(false);
  });

  it("listByAssessment returns multiple pathways for the same assessment", async () => {
    const caller = createCaller(userA);
    const stamp = Date.now();
    const local = await seedMaturityAssessment(orgA.id, userA.id, `MAT-LIST-${stamp}`);
    const p1 = await caller.pathway.create({ assessmentKind: AssessmentKind.MATURITY, assessmentId: local.id, name: "List 1" });
    const p2 = await caller.pathway.create({ assessmentKind: AssessmentKind.MATURITY, assessmentId: local.id, name: "List 2" });

    const list = await caller.pathway.listByAssessment({ assessmentKind: AssessmentKind.MATURITY, assessmentId: local.id });
    const ids = list.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([p1.id, p2.id]));
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("isolates orgs — org B cannot getById org A's pathway", async () => {
    const callerA = createCaller(userA);
    const pathwayA = await callerA.pathway.create({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentA.id,
      name: "Org A only",
    });

    const callerB = createCaller(userB);
    await expect(callerB.pathway.getById({ id: pathwayA.id })).rejects.toThrow();

    // And it never appears in org B's listByAssessment for org B's own assessment.
    const listB = await callerB.pathway.listByAssessment({
      assessmentKind: AssessmentKind.MATURITY,
      assessmentId: assessmentB.id,
    });
    expect(listB.find((p) => p.id === pathwayA.id)).toBeUndefined();
  });
});
