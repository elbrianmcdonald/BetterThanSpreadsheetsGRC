/**
 * Story 17.5: Action Plan / Roadmap deliverable — integration + unit tests.
 *
 * Covers:
 * - phaseFor heuristic (days/weeks → immediate, 1–2 months → near-term, else structural).
 * - groupActionsByPhase always returns all three buckets.
 * - computeRoadmapTallies + computeRoadmapScorecard against a fixed fixture
 *   (exact numbers/tones, including the quick-wins rule) — the AC20 snapshot guard.
 * - Cross-org isolation on getRoadmapDeliverableData (org B can't see org A's options).
 *
 * Org-scoped creates use runWithOrganizationContext(orgId, async () => { await ... })
 * per project convention; afterAll cleans up via raw SQL deletes.
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import {
  EffortLevel,
  FindingSource,
  RemediationPriority,
  RiskStatus,
  Severity,
} from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  computeRoadmapScorecard,
  computeRoadmapTallies,
  getRoadmapDeliverableData,
  groupActionsByPhase,
  phaseFor,
  type RoadmapAction,
} from "@/server/services/deliverableRoadmapData";

// ---------------------------------------------------------------------------
// Pure helpers — no DB.
// ---------------------------------------------------------------------------

/** A fixed fixture exercising every tally branch deterministically. */
function fixture(): RoadmapAction[] {
  const base = {
    detail: "",
    owner: null,
    costBand: 1 as const,
    phase: "0–30 days" as const,
    breaksToxic: false,
    remediates: [],
  };
  return [
    { ...base, id: "a", title: "A", effort: "S", impact: 5 }, // quick win
    { ...base, id: "b", title: "B", effort: "S", impact: 4 }, // quick win
    { ...base, id: "c", title: "C", effort: "S", impact: 3 }, // NOT (impact < 4)
    { ...base, id: "d", title: "D", effort: "M", impact: 5 }, // NOT (effort != S)
    { ...base, id: "e", title: "E", effort: "L", impact: 2 }, // neither
  ];
}

describe("Story 17.5: phaseFor heuristic", () => {
  it("maps days/weeks to the immediate phase", () => {
    expect(phaseFor("3 days")).toBe("0–30 days");
    expect(phaseFor("2-3 weeks")).toBe("0–30 days");
    expect(phaseFor("1 week")).toBe("0–30 days");
  });

  it("maps 1–2 months to the near-term phase", () => {
    expect(phaseFor("1 month")).toBe("30–90 days");
    expect(phaseFor("2 months")).toBe("30–90 days");
  });

  it("maps longer timelines (3+ months / quarters / unknown) to structural", () => {
    expect(phaseFor("6 months")).toBe("1–2 quarters");
    expect(phaseFor("2 quarters")).toBe("1–2 quarters");
    expect(phaseFor("")).toBe("1–2 quarters");
    expect(phaseFor("ongoing")).toBe("1–2 quarters");
  });
});

describe("Story 17.5: groupActionsByPhase", () => {
  it("always returns all three buckets, even when empty", () => {
    const grouped = groupActionsByPhase([]);
    expect(Object.keys(grouped).sort()).toEqual(
      ["0–30 days", "1–2 quarters", "30–90 days"].sort(),
    );
    expect(grouped["0–30 days"]).toEqual([]);
    expect(grouped["30–90 days"]).toEqual([]);
    expect(grouped["1–2 quarters"]).toEqual([]);
  });

  it("buckets actions by their phase field", () => {
    const actions: RoadmapAction[] = [
      { id: "x", title: "X", detail: "", owner: null, effort: "S", costBand: 1, impact: 3, phase: "30–90 days", breaksToxic: false, remediates: [] },
    ];
    const grouped = groupActionsByPhase(actions);
    expect(grouped["30–90 days"]).toHaveLength(1);
    expect(grouped["0–30 days"]).toHaveLength(0);
  });
});

describe("Story 17.5: tallies + scorecard (AC20 snapshot)", () => {
  it("computeRoadmapTallies matches the fixture exactly", () => {
    expect(computeRoadmapTallies(fixture())).toEqual({
      initiatives: 5,
      breakPathway: 0, // breaksToxic always false until Epic 19
      quickWins: 2, // only S && impact>=4
    });
  });

  it("computeRoadmapScorecard returns 3 fixed cells with exact tones", () => {
    expect(computeRoadmapScorecard(fixture())).toEqual([
      { label: "Initiatives", value: 5, tone: "brand" },
      { label: "Break pathway", value: 0, tone: "crit" },
      { label: "Quick wins", value: 2, tone: "ok" },
    ]);
  });

  it("handles the empty set", () => {
    expect(computeRoadmapTallies([])).toEqual({
      initiatives: 0,
      breakPathway: 0,
      quickWins: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Live DB — cross-org isolation (AC18).
// ---------------------------------------------------------------------------

describe("Story 17.5: getRoadmapDeliverableData isolation", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };

  beforeAll(async () => {
    const stamp = Date.now();
    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Roadmap Org A ${stamp}`, slug: `roadmap-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Roadmap Org B ${stamp}`, slug: `roadmap-b-${stamp}`, updatedAt: new Date() },
    });
    userA = await db.user.create({
      data: { id: randomUUID(), email: `roadmap-a-${stamp}@example.com`, name: "User A", organizationId: orgA.id, updatedAt: new Date() },
    });
    userB = await db.user.create({
      data: { id: randomUUID(), email: `roadmap-b-${stamp}@example.com`, name: "User B", organizationId: orgB.id, updatedAt: new Date() },
    });

    // Org A: a Risk spawned from a Finding + a RemediationOption against it.
    await runWithOrganizationContext(orgA.id, async () => {
      const finding = await db.finding.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          identifier: "FND-A-0001",
          title: "Exposed admin interface (A)",
          description: "Org A finding",
          source: FindingSource.MANUAL,
          severity: Severity.HIGH,
          createdBy: userA.id,
          updatedAt: new Date(),
        },
      });
      const risk = await db.risk.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          title: "Risk A",
          description: "Org A risk",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          inherentLikelihood: 4,
          inherentImpact: 5,
          inherentScore: 20,
          updatedAt: new Date(),
        },
      });
      // Story 23.3: the source finding attaches via RiskFindingLink.
      await db.riskFindingLink.create({
        data: { riskId: risk.id, findingId: finding.id },
      });
      await db.remediationOption.create({
        data: {
          id: randomUUID(),
          riskId: risk.id,
          organizationId: orgA.id,
          title: "Patch and harden (A)",
          description: "Apply patches and lock down access",
          approach: "Vendor patch + ACL review",
          costEstimate: 5000,
          timelineEstimate: "2 weeks",
          effortLevel: EffortLevel.LOW,
          priority: RemediationPriority.RECOMMENDED,
          createdById: userA.id,
          updatedAt: new Date(),
        },
      });
    });

    // Org B: an unrelated RemediationOption.
    await runWithOrganizationContext(orgB.id, async () => {
      const risk = await db.risk.create({
        data: {
          id: randomUUID(),
          organizationId: orgB.id,
          title: "Risk B",
          description: "Org B risk",
          severity: Severity.MEDIUM,
          status: RiskStatus.OPEN,
          updatedAt: new Date(),
        },
      });
      await db.remediationOption.create({
        data: {
          id: randomUUID(),
          riskId: risk.id,
          organizationId: orgB.id,
          title: "Org B remediation",
          description: "Org B only",
          approach: "B approach",
          costEstimate: 150000,
          timelineEstimate: "2 quarters",
          effortLevel: EffortLevel.HIGH,
          priority: RemediationPriority.ALTERNATIVE,
          createdById: userB.id,
          updatedAt: new Date(),
        },
      });
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "RemediationOption" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("returns only org A's actions for org A, with the mapped derivation", async () => {
    const { actions, scorecard } = await getRoadmapDeliverableData(orgA.id, db);
    expect(actions).toHaveLength(1);
    const a = actions[0]!;
    expect(a.title).toBe("Patch and harden (A)");
    expect(a.effort).toBe("S"); // LOW → S
    expect(a.costBand).toBe(1); // $5,000 < $10,000
    expect(a.phase).toBe("0–30 days"); // "2 weeks"
    expect(a.impact).toBe(5); // inherentScore 20 → 5
    expect(a.breaksToxic).toBe(false);
    // Remediated finding attached as a FindingLike with the Risk's L×I.
    expect(a.remediates).toHaveLength(1);
    expect(a.remediates[0]!.identifier).toBe("FND-A-0001");
    expect(a.remediates[0]!.likelihood).toBe(4);
    expect(a.remediates[0]!.impact).toBe(5);
    // Quick win: S && impact 5.
    expect(scorecard).toEqual([
      { label: "Initiatives", value: 1, tone: "brand" },
      { label: "Break pathway", value: 0, tone: "crit" },
      { label: "Quick wins", value: 1, tone: "ok" },
    ]);
  });

  it("never returns org A's options to org B (cross-org isolation)", async () => {
    const { actions } = await getRoadmapDeliverableData(orgB.id, db);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.title).toBe("Org B remediation");
    expect(actions.some((x) => x.title.includes("(A)"))).toBe(false);
  });
});
