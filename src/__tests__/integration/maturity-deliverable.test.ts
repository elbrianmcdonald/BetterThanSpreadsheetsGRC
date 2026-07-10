/**
 * Story 17.4: Maturity Deliverable — integration tests.
 *
 * Covers:
 * - AC16/AC18: computeMaturityScorecard band logic + below-target count against
 *   a fixed fixture (exact numbers/tones) — the schema-drift snapshot guard.
 * - AC8: levelColor → token mapping.
 * - AC20: cross-org isolation on getMaturityDeliverableData (org B gets null for
 *   org A's assessment).
 *
 * Org-scoped DB creates are wrapped in runWithOrganizationContext(...) with the
 * await INSIDE the callback (project convention). afterAll cleans up via raw SQL
 * deletes to bypass the org-context middleware.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "crypto";

import {
  AssessmentDepth,
  MaturityAssessmentStatus,
  MaturityFrameworkType,
  UserRole,
} from "@prisma/client";

import { db } from "@/server/db";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  computeMaturityScorecard,
  getMaturityDeliverableData,
  levelColor,
  type MaturityDomainRow,
} from "@/server/services/deliverableMaturityData";

// ---------------------------------------------------------------------------
// Pure-function coverage (no DB) — deterministic snapshot guards.
// ---------------------------------------------------------------------------

describe("levelColor (AC8)", () => {
  it("maps each level band to the right token", () => {
    expect(levelColor(1)).toBe("var(--destructive)");
    expect(levelColor(2)).toBe("var(--severity-high)");
    expect(levelColor(3)).toBe("var(--warning)");
    expect(levelColor(4)).toBe("var(--primary)");
    expect(levelColor(5)).toBe("var(--success)");
  });

  it("returns muted for null / 0", () => {
    expect(levelColor(null)).toBe("var(--muted-foreground)");
    expect(levelColor(0)).toBe("var(--muted-foreground)");
  });
});

describe("computeMaturityScorecard (AC16, AC18)", () => {
  const domains: MaturityDomainRow[] = [
    { name: "Govern", currentLevel: 2, targetLevel: 4, isNotApplicable: false }, // below (gap 2)
    { name: "Identify", currentLevel: 3, targetLevel: 3, isNotApplicable: false }, // meets
    { name: "Protect", currentLevel: 1, targetLevel: 3, isNotApplicable: false }, // below (gap 2)
    { name: "Detect", currentLevel: 4, targetLevel: 4, isNotApplicable: false }, // meets
    { name: "Respond", currentLevel: null, targetLevel: 5, isNotApplicable: true }, // NA — excluded
    { name: "Recover", currentLevel: null, targetLevel: 4, isNotApplicable: false }, // unscored — excluded
  ];

  it("produces 3 cells with exact values, suffixes and the below-target count", () => {
    const cells = computeMaturityScorecard({
      overallLevel: 3,
      overallScore: 64,
      targetLevel: 4,
      domains,
    });

    expect(cells).toHaveLength(3);

    expect(cells[0]).toEqual({
      label: "Overall level",
      value: 3,
      suffix: "/ 5",
      tone: "med", // 3 → med band
    });
    expect(cells[1]).toEqual({
      label: "Overall score",
      value: 64,
      suffix: "/ 100",
      tone: "brand",
    });
    expect(cells[2]).toEqual({
      label: "Domains below target",
      value: 2, // Govern + Protect; NA + unscored excluded
      tone: "high",
    });
  });

  it("bands the overall-level tone: >=4 ok, >=3 med, else crit; null → crit", () => {
    const toneFor = (overallLevel: number | null) =>
      computeMaturityScorecard({ overallLevel, overallScore: null, targetLevel: null, domains: [] })[0]!.tone;
    expect(toneFor(5)).toBe("ok");
    expect(toneFor(4)).toBe("ok");
    expect(toneFor(3)).toBe("med");
    expect(toneFor(2)).toBe("crit");
    expect(toneFor(null)).toBe("crit");
  });

  it("renders em-dash placeholders when overall level/score are absent", () => {
    const cells = computeMaturityScorecard({
      overallLevel: null,
      overallScore: null,
      targetLevel: null,
      domains: [],
    });
    expect(cells[0]!.value).toBe("—");
    expect(cells[1]!.value).toBe("—");
    expect(cells[2]!.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Live-DB cross-org isolation (AC20).
// ---------------------------------------------------------------------------

describe("getMaturityDeliverableData cross-org isolation (AC20)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let frameworkId: string;
  let assessmentId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Mat Org A ${stamp}`, slug: `mat-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Mat Org B ${stamp}`, slug: `mat-b-${stamp}`, updatedAt: new Date() },
    });

    const ownerId = randomUUID();
    await db.user.create({
      data: {
        id: ownerId,
        email: `mat-owner-${stamp}@example.com`,
        name: "Mat Owner",
        organizationId: orgA.id,
        platformRole: UserRole.ANALYST,
        updatedAt: new Date(),
      },
    });

    // MaturityFramework is org-template data; create it directly (no org filter
    // on a nullable-org system table — but it has organizationId set to orgA).
    frameworkId = randomUUID();
    await runWithOrganizationContext(orgA.id, async () => {
      await db.maturityFramework.create({
        data: {
          id: frameworkId,
          organizationId: orgA.id,
          type: MaturityFrameworkType.NIST_CSF_2,
          name: "NIST CSF 2.0",
          version: `test-${stamp}`,
          minLevel: 1,
          maxLevel: 5,
          scoringLevels: [],
        },
      });
    });

    const domainGovId = randomUUID();
    const domainIdId = randomUUID();
    await runWithOrganizationContext(orgA.id, async () => {
      await db.maturityDomain.create({
        data: {
          id: domainGovId,
          frameworkId,
          code: "GV",
          name: "Govern",
          level: AssessmentDepth.FUNCTION,
          sortOrder: 0,
        },
      });
      await db.maturityDomain.create({
        data: {
          id: domainIdId,
          frameworkId,
          code: "ID",
          name: "Identify",
          level: AssessmentDepth.FUNCTION,
          sortOrder: 1,
        },
      });
    });

    assessmentId = randomUUID();
    await runWithOrganizationContext(orgA.id, async () => {
      await db.maturityAssessment.create({
        data: {
          id: assessmentId,
          organizationId: orgA.id,
          frameworkId,
          identifier: `MAT-2026-${String(stamp).slice(-4)}`,
          name: "Board Maturity Review",
          assessmentDepth: AssessmentDepth.FUNCTION,
          status: MaturityAssessmentStatus.COMPLETED,
          overallLevel: 3,
          overallScore: 64,
          targetLevel: 4,
          ownerId,
          domainScores: {
            create: [
              { id: randomUUID(), domainId: domainGovId, currentLevel: 2, targetLevel: 4, isNotApplicable: false },
              { id: randomUUID(), domainId: domainIdId, currentLevel: 3, targetLevel: 3, isNotApplicable: false },
            ],
          },
        },
      });
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "MaturityDomainScore" WHERE "assessmentId" IN (SELECT "id" FROM "MaturityAssessment" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "MaturityAssessment" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "MaturityDomain" WHERE "frameworkId" IN (SELECT "id" FROM "MaturityFramework" WHERE "organizationId" = ${org.id})`;
      await db.$executeRaw`DELETE FROM "MaturityFramework" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  it("returns mapped data + computed scorecard for the owning org", async () => {
    const data = await runWithOrganizationContext(orgA.id, () =>
      getMaturityDeliverableData(orgA.id, db, assessmentId),
    );

    expect(data).not.toBeNull();
    expect(data!.title).toBe("Board Maturity Review");
    expect(data!.framework).toBe("NIST CSF 2.0");
    expect(data!.overallLevel).toBe(3);
    expect(data!.targetLevel).toBe(4);

    // Deterministic order by sortOrder.
    expect(data!.domains.map((d) => d.name)).toEqual(["Govern", "Identify"]);

    // Scorecard reflects the stored overall + 1 below-target domain (Govern).
    expect(data!.scorecard[0]).toEqual({ label: "Overall level", value: 3, suffix: "/ 5", tone: "med" });
    expect(data!.scorecard[1]).toEqual({ label: "Overall score", value: 64, suffix: "/ 100", tone: "brand" });
    expect(data!.scorecard[2]).toEqual({ label: "Domains below target", value: 1, tone: "high" });
  });

  it("returns null for another org's assessment (AC20)", async () => {
    const data = await runWithOrganizationContext(orgB.id, () =>
      getMaturityDeliverableData(orgB.id, db, assessmentId),
    );
    expect(data).toBeNull();
  });
});
