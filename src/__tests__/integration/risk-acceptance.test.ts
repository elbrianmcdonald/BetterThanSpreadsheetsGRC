/**
 * Risk-level acceptance (Story 23.1)
 *
 * Acceptance attaches to the RISK, never the finding:
 *  - segregation of duties: the risk's creator cannot ACCEPT it
 *  - a non-creator ACCEPT succeeds and is audited
 *  - accepting a risk leaves linked findings' statuses untouched
 *  - an accepted risk whose effective score RISES is flagged for re-review
 *    (acceptanceReReviewRequired + nextReviewDue pulled to now)
 *  - a fresh treatment decision clears the re-review flag
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  type UserRole,
  Severity,
  FindingSource,
  FindingStatus,
  AuditAction,
} from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

type TestUser = {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};

let testOrg: { id: string };
let creator: TestUser; // creates risks — must NOT be able to accept them
let approver: TestUser; // second analyst — records the acceptance
let defaultVersionId = "";

const SCALES = {
  likelihood: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
  impact: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
};
const THRESHOLDS = [
  { minValue: 0, maxValue: 6, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
  { minValue: 6, maxValue: 12, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
  { minValue: 12, maxValue: 20, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
  { minValue: 20, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
];

const settle = () => new Promise((r) => setTimeout(r, 500));

const createCaller = (user: TestUser) =>
  appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });

async function mkUser(label: string): Promise<TestUser> {
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      name: `Acceptance ${label}`,
      email: `acceptance-${label}-${Date.now()}-${randomUUID().slice(0, 6)}@example.com`,
      platformRole: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  return {
    id: u.id,
    email: u.email!,
    role: u.platformRole!,
    organizationId: u.organizationId,
    name: u.name!,
    assignedFrameworks: u.assignedFrameworks,
  };
}

/** Risk created BY the creator user (createdById matters for segregation). */
async function mkRisk() {
  let id = "";
  await runWithOrganizationContext(testOrg.id, async () => {
    const r = await db.risk.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        title: `Acceptance risk ${randomUUID().slice(0, 8)}`,
        description: "Risk under acceptance-workflow test",
        severity: Severity.MEDIUM,
        createdById: creator.id,
        updatedAt: new Date(),
      },
    });
    id = r.id;
  });
  return id;
}

async function mkScoredFinding(
  caller: ReturnType<typeof createCaller>,
  l: number,
  i: number,
  riskIds: string[] = [],
) {
  return caller.finding.create({
    title: `Acceptance finding L${l}×I${i} ${randomUUID().slice(0, 6)}`,
    description: "Scored finding feeding the acceptance re-review tests.",
    source: FindingSource.AUDIT,
    severity: Severity.MEDIUM,
    likelihood: l,
    impact: i,
    linkedRiskIds: riskIds,
  });
}

async function riskAcceptanceState(riskId: string) {
  const r = await db.risk.findUnique({
    where: { id: riskId },
    select: { acceptanceReReviewRequired: true, nextReviewDue: true, effectiveScore: true },
  });
  return {
    flag: r?.acceptanceReReviewRequired ?? null,
    nextReviewDue: r?.nextReviewDue ?? null,
    effective: r?.effectiveScore ? Number(r.effectiveScore) : null,
  };
}

beforeAll(async () => {
  const stamp = Date.now();
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: `Acceptance Org ${stamp}`,
      slug: `acceptance-org-${stamp}`,
      updatedAt: new Date(),
    },
  });
  creator = await mkUser("creator");
  approver = await mkUser("approver");

  // Default 5×5 matrix so finding.create computes inherent scores
  const templateId = randomUUID();
  const versionId = randomUUID();
  defaultVersionId = versionId;
  await runWithOrganizationContext(testOrg.id, async () => {
    await db.riskMatrixTemplate.create({
      data: {
        id: templateId,
        organizationId: testOrg.id,
        name: "Acceptance 5×5",
        dimensionCount: 2,
        gridSize: 5,
        outputScaleMax: 25,
        isActive: true,
        isDefault: true,
        updatedAt: new Date(),
      },
    });
    await db.riskMatrixVersion.create({
      data: {
        id: versionId,
        templateId,
        versionNumber: 1,
        scales: SCALES as never,
        thresholds: THRESHOLDS as never,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    await db.riskMatrixTemplate.update({
      where: { id: templateId },
      data: { currentVersionId: versionId },
    });
  });
});

afterAll(async () => {
  await db.$executeRaw`DELETE FROM "RiskTreatment" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskFindingLink" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskAssessmentProject" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

describe("Story 23.1: risk-level acceptance", () => {
  it("segregation of duties: the risk's creator cannot ACCEPT it", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);

    await expect(
      creatorCaller.risk.createTreatment({
        riskId,
        treatmentType: "ACCEPT",
        justification: "Trying to accept my own risk — must be blocked.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("non-ACCEPT treatments by the creator are still allowed", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);

    const t = await creatorCaller.risk.createTreatment({
      riskId,
      treatmentType: "REMEDIATE",
      justification: "Creator plans remediation — segregation only guards ACCEPT.",
    });
    expect(t.treatmentType).toBe("REMEDIATE");
  });

  it("a non-creator ACCEPT succeeds and is audit-logged", async () => {
    const riskId = await mkRisk();
    const approverCaller = createCaller(approver);

    const t = await approverCaller.risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Exposure within appetite; compensating monitoring in place.",
    });
    expect(t.treatmentType).toBe("ACCEPT");
    expect(t.decidedById).toBe(approver.id);

    await settle();
    const audit = await db.auditLog.findFirst({
      where: {
        organizationId: testOrg.id,
        entityType: "RiskTreatment",
        entityId: t.id,
        action: AuditAction.RISK_TREATMENT_CREATED,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(approver.id);
  });

  it("accepting a risk leaves linked findings' statuses untouched", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);
    const finding = await mkScoredFinding(creatorCaller, 3, 3, [riskId]);
    await settle();

    await createCaller(approver).risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Risk accepted — the observation itself stays open.",
    });
    await settle();

    const f = await db.finding.findUnique({
      where: { id: finding.id },
      select: { status: true },
    });
    expect(f?.status).toBe(FindingStatus.NEW);
  });

  it("effective-score RISE on an accepted risk sets the re-review flag and pulls nextReviewDue", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);
    const finding = await mkScoredFinding(creatorCaller, 2, 2, [riskId]); // 4 Low
    await settle();

    await createCaller(approver).risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Accepted at Low — the rise below must trigger re-review.",
    });
    expect((await riskAcceptanceState(riskId)).flag).toBe(false);

    await creatorCaller.finding.rescore({ findingId: finding.id, likelihood: 4, impact: 4 }); // 16 High
    await settle();

    const state = await riskAcceptanceState(riskId);
    expect(state.effective).toBe(16);
    expect(state.flag).toBe(true);
    expect(state.nextReviewDue).not.toBeNull();
    expect(state.nextReviewDue!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // ...and the recompute audit records the flagging
    const audit = await db.auditLog.findFirst({
      where: {
        organizationId: testOrg.id,
        entityType: "Risk",
        entityId: riskId,
        action: AuditAction.RISK_SCORE_RECALCULATED,
      },
      orderBy: { timestamp: "desc" },
    });
    const changes = audit?.changes as { after: Record<string, unknown> } | undefined;
    expect(changes?.after.acceptanceReReviewFlagged).toBe(true);
  });

  it("a score DROP on an accepted risk does NOT flag re-review", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);
    const finding = await mkScoredFinding(creatorCaller, 4, 4, [riskId]); // 16 High
    await settle();

    await createCaller(approver).risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Accepted at High — a drop should stay quiet.",
    });

    await creatorCaller.finding.rescore({ findingId: finding.id, likelihood: 2, impact: 2 }); // 4 Low
    await settle();

    const state = await riskAcceptanceState(riskId);
    expect(state.effective).toBe(4);
    expect(state.flag).toBe(false);
  });

  it("a rise on a risk WITHOUT an acceptance does not flag re-review", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);
    const finding = await mkScoredFinding(creatorCaller, 2, 2, [riskId]); // 4
    await settle();

    await creatorCaller.finding.rescore({ findingId: finding.id, likelihood: 5, impact: 5 }); // 25
    await settle();

    const state = await riskAcceptanceState(riskId);
    expect(state.effective).toBe(25);
    expect(state.flag).toBe(false);
  });

  it("a fresh treatment decision clears the re-review flag", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);
    const finding = await mkScoredFinding(creatorCaller, 2, 2, [riskId]); // 4
    await settle();

    const approverCaller = createCaller(approver);
    await approverCaller.risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Initial acceptance before the score rises.",
    });
    await creatorCaller.finding.rescore({ findingId: finding.id, likelihood: 4, impact: 5 }); // 20
    await settle();
    expect((await riskAcceptanceState(riskId)).flag).toBe(true);

    await approverCaller.risk.createTreatment({
      riskId,
      treatmentType: "ACCEPT",
      justification: "Re-reviewed at the higher score — still within appetite.",
    });
    await settle();

    expect((await riskAcceptanceState(riskId)).flag).toBe(false);
  });
});

describe("Story 23.5: acceptance bypass paths are closed (review CR-1/CR-2)", () => {
  it("CR-1: createAssessment does NOT mint an ACCEPT treatment for the creator", async () => {
    const caller = createCaller(creator);

    await caller.risk.createAssessment({
      title: "Acceptance bypass check assessment",
      matrixVersionId: defaultVersionId,
      risks: [
        {
          title: "Card risk proposed as ACCEPT",
          riskStatement: "Creator proposes acceptance on the card — must not become a decision.",
          inherentLikelihood: 3,
          inherentImpact: 3,
          treatment: "ACCEPT",
          threatStepIds: [],
          threatObjectiveIds: [],
          mitigatingControlIds: [],
          controlGapIds: [],
          controlLinkIds: [],
          remediationOptions: [],
          evidenceIds: [],
          residualEliminated: false,
        },
      ],
    });

    const risk = await db.risk.findFirst({
      where: { title: "Card risk proposed as ACCEPT", organizationId: testOrg.id },
      select: { id: true },
    });
    expect(risk).not.toBeNull();

    const treatments = await db.riskTreatment.count({ where: { riskId: risk!.id } });
    expect(treatments).toBe(0); // decision must come via the guarded createTreatment

    // ...while REMEDIATE on the card still records a treatment normally.
    await caller.risk.createAssessment({
      title: "Remediate treatment check assessment",
      matrixVersionId: defaultVersionId,
      risks: [
        {
          title: "Card risk proposed as REMEDIATE",
          riskStatement: "Non-ACCEPT treatments are not decision-restricted.",
          inherentLikelihood: 2,
          inherentImpact: 2,
          treatment: "REMEDIATE",
          threatStepIds: [],
          threatObjectiveIds: [],
          mitigatingControlIds: [],
          controlGapIds: [],
          controlLinkIds: [],
          remediationOptions: [],
          evidenceIds: [],
          residualEliminated: false,
        },
      ],
    });
    const remRisk = await db.risk.findFirst({
      where: { title: "Card risk proposed as REMEDIATE", organizationId: testOrg.id },
      select: { id: true },
    });
    expect(await db.riskTreatment.count({ where: { riskId: remRisk!.id } })).toBe(1);
  });

  it("CR-2: updateRisk cannot set the acceptance decision markers", async () => {
    const riskId = await mkRisk();
    const creatorCaller = createCaller(creator);

    // Proposal fields are accepted; decision markers are stripped/ignored.
    await creatorCaller.risk.updateRisk({
      riskId,
      acceptanceJustification: "Proposed acceptance rationale (documentation only).",
      // Simulate a malicious/legacy client still sending decision markers.
      ...({ acceptedById: creator.id, acceptedAt: new Date() } as Record<string, unknown>),
    } as never);

    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: { acceptanceJustification: true, acceptedById: true, acceptedAt: true },
    });
    expect(risk?.acceptanceJustification).toContain("Proposed acceptance");
    expect(risk?.acceptedById).toBeNull();
    expect(risk?.acceptedAt).toBeNull();
  });
});
