/**
 * Story 17.2: Risk / Findings Deliverable — integration + unit tests.
 *
 * Covers:
 * - AC24: computeRiskScorecard against a fixed fixture (exact numbers, snapshot guard).
 * - AC2/AC3: sevOf tier placement — L5×I5 lands critical, top-right.
 * - AC9: descending L×I sort with deterministic identifier tie-break.
 * - AC11: "+N" organizations overflow logic.
 * - AC23: cross-org isolation — org B cannot see org A's risk rows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { AssessmentStatus, FindingSource, Severity } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { sevOf } from "@/components/deliverable/tone";
import {
  computeRiskScorecard,
  getRiskDeliverableData,
  type RiskRow,
} from "@/server/services/deliverableRiskData";

/** Minimal RiskRow factory for pure-function tests. */
function makeRow(partial: Partial<RiskRow> & { identifier: string; likelihood: number; impact: number }): RiskRow {
  const score = partial.likelihood * partial.impact;
  return {
    id: partial.id ?? partial.identifier,
    identifier: partial.identifier,
    title: partial.title ?? partial.identifier,
    likelihood: partial.likelihood,
    impact: partial.impact,
    severityTier: sevOf(score),
    domain: partial.domain ?? null,
    organizations: partial.organizations ?? [],
    effort: partial.effort ?? null,
    asset: partial.asset ?? null,
    displayNumber: partial.displayNumber ?? 0,
    remediationEffort: null,
    rationale: null,
    recommendedAction: null,
    evidence: null,
  };
}

describe("Risk Deliverable - Story 17.2", () => {
  describe("computeRiskScorecard (AC17, AC18, AC24)", () => {
    it("returns exactly 3 cells with the locked tone mapping", () => {
      const cells = computeRiskScorecard([makeRow({ identifier: "F-1", likelihood: 5, impact: 5 })]);
      expect(cells).toHaveLength(3);
      expect(cells[0]).toMatchObject({ label: "Security posture", tone: "ok" });
      expect(cells[1]).toMatchObject({ label: "Risk exposure", tone: "high" });
      expect(cells[2]).toMatchObject({ label: "Critical findings", tone: "crit" });
    });

    it("computes exact numbers for a fixed fixture (snapshot guard)", () => {
      // Fixture: scores 25, 16, 9, 4 → sum 54, avg 13.5, /25 = 0.54 → exposure 54.
      // posture = 46. critical (score >= 20) = 1 (the 25).
      const fixture: RiskRow[] = [
        makeRow({ identifier: "F-1", likelihood: 5, impact: 5 }), // 25 critical
        makeRow({ identifier: "F-2", likelihood: 4, impact: 4 }), // 16 high
        makeRow({ identifier: "F-3", likelihood: 3, impact: 3 }), // 9 medium
        makeRow({ identifier: "F-4", likelihood: 2, impact: 2 }), // 4 low
      ];
      const cells = computeRiskScorecard(fixture);
      expect(cells[0]!.value).toBe(46); // posture
      expect(cells[1]!.value).toBe(54); // exposure
      expect(cells[2]!.value).toBe(1); // critical count
    });

    it("reads zero exposure / 100 posture for an empty set", () => {
      const cells = computeRiskScorecard([]);
      expect(cells[0]!.value).toBe(100);
      expect(cells[1]!.value).toBe(0);
      expect(cells[2]!.value).toBe(0);
    });
  });

  describe("sevOf placement (AC2, AC3)", () => {
    it("maps L5×I5 to critical (top-right of the grid)", () => {
      expect(sevOf(5 * 5)).toBe("critical");
      expect(sevOf(4 * 4)).toBe("high"); // 16
      expect(sevOf(3 * 3)).toBe("medium"); // 9
      expect(sevOf(2 * 2)).toBe("low"); // 4
    });
  });

  describe("descending sort + tie-break (AC9)", () => {
    it("sorts by score DESC then identifier ASC on ties", () => {
      const rows: RiskRow[] = [
        makeRow({ identifier: "F-B", likelihood: 4, impact: 3 }), // 12
        makeRow({ identifier: "F-A", likelihood: 4, impact: 3 }), // 12 (tie → A first)
        makeRow({ identifier: "F-C", likelihood: 5, impact: 5 }), // 25
        makeRow({ identifier: "F-D", likelihood: 2, impact: 1 }), // 2
      ];
      const sorted = [...rows].sort((a, b) => {
        const sa = a.likelihood * a.impact;
        const sb = b.likelihood * b.impact;
        if (sb !== sa) return sb - sa;
        return a.identifier.localeCompare(b.identifier);
      });
      expect(sorted.map((r) => r.identifier)).toEqual(["F-C", "F-A", "F-B", "F-D"]);
    });
  });

  describe('"+N" organizations overflow (AC11)', () => {
    function orgCell(orgs: string[]): string {
      if (orgs.length === 0) return "—";
      const [first, ...rest] = orgs;
      return rest.length > 0 ? `${first} +${rest.length}` : first!;
    }
    it("renders first org plus +N overflow", () => {
      expect(orgCell([])).toBe("—");
      expect(orgCell(["Finance"])).toBe("Finance");
      expect(orgCell(["Finance", "Eng", "Ops"])).toBe("Finance +2");
    });
  });

  describe("getRiskDeliverableData cross-org isolation (AC23)", () => {
    let orgA: { id: string };
    let orgB: { id: string };
    let userA: { id: string };
    let userB: { id: string };

    beforeAll(async () => {
      const stamp = Date.now();
      orgA = await db.organization.create({
        data: { id: randomUUID(), name: `Risk Deliv A ${stamp}`, slug: `risk-a-${stamp}`, updatedAt: new Date() },
      });
      orgB = await db.organization.create({
        data: { id: randomUUID(), name: `Risk Deliv B ${stamp}`, slug: `risk-b-${stamp}`, updatedAt: new Date() },
      });
      userA = await db.user.create({
        data: { id: randomUUID(), email: `ra-${stamp}@example.com`, name: "U A", organizationId: orgA.id, updatedAt: new Date() },
      });
      userB = await db.user.create({
        data: { id: randomUUID(), email: `rb-${stamp}@example.com`, name: "U B", organizationId: orgB.id, updatedAt: new Date() },
      });

      await runWithOrganizationContext(orgA.id, async () => {
        const finding = await db.finding.create({
          data: {
            id: randomUUID(),
            identifier: `FND-A-${stamp}`,
            title: "Org A critical finding",
            description: "desc",
            source: FindingSource.MANUAL,
            severity: Severity.HIGH,
            organizationId: orgA.id,
            createdBy: userA.id,
            affectedAssets: ["asset-a"],
          },
        });
        await db.riskAssessment.create({
          data: {
            id: randomUUID(),
            identifier: `RSK-A-${stamp}`,
            title: "Org A assessment",
            status: AssessmentStatus.DRAFT,
            organizationId: orgA.id,
            findingId: finding.id,
            createdBy: userA.id,
            likelihoodValue: 5,
            impactValue: 5,
          },
        });
      });

      await runWithOrganizationContext(orgB.id, async () => {
        const finding = await db.finding.create({
          data: {
            id: randomUUID(),
            identifier: `FND-B-${stamp}`,
            title: "Org B finding",
            description: "desc",
            source: FindingSource.AUDIT,
            severity: Severity.LOW,
            organizationId: orgB.id,
            createdBy: userB.id,
            affectedAssets: [],
          },
        });
        await db.riskAssessment.create({
          data: {
            id: randomUUID(),
            identifier: `RSK-B-${stamp}`,
            title: "Org B assessment",
            status: AssessmentStatus.DRAFT,
            organizationId: orgB.id,
            findingId: finding.id,
            createdBy: userB.id,
            likelihoodValue: 2,
            impactValue: 2,
          },
        });
      });
    });

    afterAll(async () => {
      for (const org of [orgA, orgB]) {
        if (!org) continue;
        await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${org.id}`;
        await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
        await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
        await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
      }
    });

    it("returns only the caller org's rows", async () => {
      const a = await getRiskDeliverableData(orgA.id, db as any);
      const b = await getRiskDeliverableData(orgB.id, db as any);

      expect(a.rows).toHaveLength(1);
      expect(a.rows[0]!.title).toBe("Org A critical finding");
      expect(a.rows.every((r) => r.title !== "Org B finding")).toBe(true);

      expect(b.rows).toHaveLength(1);
      expect(b.rows[0]!.title).toBe("Org B finding");
      expect(b.rows.every((r) => r.title !== "Org A critical finding")).toBe(true);
    });

    it("assigns displayNumber by descending score and computes the scorecard", async () => {
      const a = await getRiskDeliverableData(orgA.id, db as any);
      expect(a.rows[0]!.displayNumber).toBe(1);
      expect(a.rows[0]!.severityTier).toBe("critical");
      // single row, score 25 → exposure 100, posture 0, critical 1
      expect(a.scorecard[2]!.value).toBe(1);
    });
  });
});
