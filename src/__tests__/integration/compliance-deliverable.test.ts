/**
 * Story 17.3: Compliance Deliverable — integration + unit tests.
 *
 * Covers:
 * - AC15/AC17: computeComplianceScorecard band logic against a fixed fixture
 *   (exact values + tones) — the snapshot/schema-drift guard.
 * - AC8/AC11: gap register filters to PARTIALLY_COMPLIANT + NON_COMPLIANT with NON_COMPLIANT
 *   listed first, then by control ID (numeric-aware).
 * - AC19: cross-org isolation — org B gets null for org A's assessment.
 *
 * Org-scoped DB creates are wrapped in `runWithOrganizationContext(orgId, ...)`
 * with `await` inside the callback (project convention). afterAll cleans up via
 * raw SQL deletes to bypass the org-context middleware.
 */

import { db } from "@/server/db";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  computeComplianceScorecard,
  getComplianceDeliverableData,
} from "@/server/services/deliverableComplianceData";

describe("computeComplianceScorecard (AC15, AC17 — pure)", () => {
  it("maps a high-scoring fixture to exact values + tones (>= 80 => ok)", () => {
    const cells = computeComplianceScorecard({
      complianceScore: 87.5,
      compliantCount: 14,
      partialCount: 3,
      nonCompliantCount: 2,
      totalControls: 20,
    });

    expect(cells).toEqual([
      { label: "Compliance score", value: 87.5, suffix: "/ 100", tone: "ok" },
      { label: "Compliant", value: 14, tone: "ok" },
      { label: "Non-compliant", value: 2, tone: "crit" },
    ]);
  });

  it("uses 'med' tone for the 50–79 band", () => {
    const [score] = computeComplianceScorecard({
      complianceScore: 62,
      compliantCount: 6,
      partialCount: 2,
      nonCompliantCount: 2,
      totalControls: 10,
    });
    expect(score!.value).toBe(62);
    expect(score!.tone).toBe("med");
  });

  it("uses 'crit' tone below 50 and at the exact boundaries", () => {
    expect(
      computeComplianceScorecard({
        complianceScore: 49.99,
        compliantCount: 1,
        partialCount: 1,
        nonCompliantCount: 8,
        totalControls: 10,
      })[0]!.tone,
    ).toBe("crit");

    // Boundary: exactly 50 => med, exactly 80 => ok.
    expect(
      computeComplianceScorecard({
        complianceScore: 50,
        compliantCount: 0,
        partialCount: 0,
        nonCompliantCount: 0,
        totalControls: 0,
      })[0]!.tone,
    ).toBe("med");
    expect(
      computeComplianceScorecard({
        complianceScore: 80,
        compliantCount: 0,
        partialCount: 0,
        nonCompliantCount: 0,
        totalControls: 0,
      })[0]!.tone,
    ).toBe("ok");
  });
});

describe("Compliance Deliverable data service (AC8, AC11, AC19)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: { id: string };
  let frameworkA: { id: string };
  let assessmentA: { id: string };

  beforeAll(async () => {
    const stamp = Date.now();

    orgA = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Compliance Deliverable Org A ${stamp}`,
        slug: `comp-deliv-a-${stamp}`,
        updatedAt: new Date(),
      },
    });
    orgB = await db.organization.create({
      data: {
        id: randomUUID(),
        name: `Compliance Deliverable Org B ${stamp}`,
        slug: `comp-deliv-b-${stamp}`,
        updatedAt: new Date(),
      },
    });
    ownerA = await db.user.create({
      data: {
        id: randomUUID(),
        email: `owner-a-${stamp}@example.com`,
        name: "Owner A",
        organizationId: orgA.id,
        platformRole: UserRole.ANALYST,
        updatedAt: new Date(),
      },
    });

    await runWithOrganizationContext(orgA.id, async () => {
      frameworkA = await db.framework.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          code: "TEST-FW-DELIV",
          name: "Deliverable Test Framework",
          version: "1.0",
          description: "Framework for compliance deliverable tests",
          isActive: true,
          activatedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Controls across two families with zero-padded IDs to exercise ordering.
      const controlSpecs = [
        { controlId: "AC-01", title: "Access Control Policy" },
        { controlId: "AC-10", title: "Concurrent Session Control" },
        { controlId: "AC-02", title: "Account Management" },
        { controlId: "SC-07", title: "Boundary Protection" },
      ];
      const controlIds: Record<string, string> = {};
      for (const spec of controlSpecs) {
        const c = await db.control.create({
          data: {
            id: randomUUID(),
            organizationId: orgA.id,
            frameworkId: frameworkA.id,
            controlId: spec.controlId,
            title: spec.title,
            description: `Description for ${spec.controlId}`,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        controlIds[spec.controlId] = c.id;
      }

      assessmentA = await db.complianceAssessment.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          frameworkId: frameworkA.id,
          identifier: `COMP-2026-${stamp.toString().slice(-4)}`,
          name: "Deliverable Test Assessment",
          ownerId: ownerA.id,
          totalControls: 4,
          compliantCount: 1,
          partialCount: 1,
          nonCompliantCount: 2,
          notApplicableCount: 0,
          notAssessedCount: 0,
          complianceScore: 25,
          updatedAt: new Date(),
        },
      });

      // Scores: AC-01 NON_COMPLIANT, AC-02 PARTIALLY_COMPLIANT, AC-10 COMPLIANT, SC-07 NON_COMPLIANT.
      const scoreSpecs: {
        controlId: string;
        status: "NON_COMPLIANT" | "PARTIALLY_COMPLIANT" | "COMPLIANT";
        gap?: string;
        plan?: string;
      }[] = [
        { controlId: "AC-01", status: "NON_COMPLIANT", gap: "No policy", plan: "Author policy" },
        { controlId: "AC-02", status: "PARTIALLY_COMPLIANT", gap: "Partial coverage" },
        { controlId: "AC-10", status: "COMPLIANT" },
        { controlId: "SC-07", status: "NON_COMPLIANT" },
      ];
      for (const s of scoreSpecs) {
        await db.controlAssessmentScore.create({
          data: {
            id: randomUUID(),
            assessmentId: assessmentA.id,
            controlId: controlIds[s.controlId]!,
            status: s.status,
            gapDescription: s.gap ?? null,
            remediationPlan: s.plan ?? null,
            updatedAt: new Date(),
          },
        });
      }
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "ControlAssessmentScore" WHERE "assessmentId" IN (SELECT id FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "ComplianceAssessment" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("returns mapped controls grouped by family with stored headline score (AC16)", async () => {
    const data = await getComplianceDeliverableData(orgA.id, db, assessmentA.id);
    expect(data).not.toBeNull();
    expect(data!.title).toBe("Deliverable Test Assessment");
    expect(data!.framework).toBe("Deliverable Test Framework");
    expect(data!.controls).toHaveLength(4);

    // Headline uses the STORED complianceScore (25), not a recompute.
    expect(data!.scorecard[0]!.value).toBe(25);
    expect(data!.scorecard[0]!.tone).toBe("crit");

    // Families derived from controlId prefix.
    const families = new Set(data!.controls.map((c) => c.family));
    expect(families).toEqual(new Set(["AC", "SC"]));
  });

  it("gap register includes only PARTIALLY_COMPLIANT + NON_COMPLIANT, NON_COMPLIANT first (AC8, AC11)", async () => {
    const data = await getComplianceDeliverableData(orgA.id, db, assessmentA.id);
    const gaps = data!.gaps;

    // COMPLIANT (AC-10) is excluded; 3 gaps remain.
    expect(gaps.map((g) => g.controlId)).toEqual(["AC-01", "SC-07", "AC-02"]);
    expect(gaps.map((g) => g.status)).toEqual([
      "NON_COMPLIANT",
      "NON_COMPLIANT",
      "PARTIALLY_COMPLIANT",
    ]);
    // Empty remediation surfaces as null (component renders "Not documented").
    expect(gaps.find((g) => g.controlId === "AC-02")!.remediationPlan).toBeNull();
  });

  it("isolates orgs — org B gets null for org A's assessment (AC19)", async () => {
    const data = await getComplianceDeliverableData(orgB.id, db, assessmentA.id);
    expect(data).toBeNull();
  });
});
