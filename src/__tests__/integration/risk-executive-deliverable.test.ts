/**
 * Risk Executive Summary deliverable — integration tests.
 *
 * Covers the per-assessment executive summary, severity driven by the
 * assessment's configured risk matrix:
 * - getRiskExecutiveData: discovered findings → rows with matrix score + band
 *   label + band color (scored vs categorical-only fallback), discovered risks →
 *   compact rows, matrix descriptor + matrix-aware scorecard.
 * - Cross-org isolation: a project id from another org resolves to null.
 * - deliverable.getRiskExecBody canEdit: true for assignee / ORG_ADMIN, false
 *   for a non-assignee analyst; matrix is returned.
 * - riskAssessmentProject.updateExecutiveStatement gating.
 *
 * Follows the `risk-deliverable.test.ts` / `engagement.test.ts` patterns.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  UserRole,
  FindingSource,
  Severity,
  RiskDiscoveryStatus,
} from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import { getRiskExecutiveData } from "@/server/services/deliverableRiskExecData";

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
        name: "Test User",
        image: null,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  } as any);

// A 5×5 matrix (outputScaleMax 25) with four bands.
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

describe("Risk Executive Summary Deliverable (matrix-driven)", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let assignee: TestUser;
  let otherAnalyst: TestUser;
  let admin: TestUser;
  let analystB: TestUser;
  let projectId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    orgA = await db.organization.create({
      data: { id: randomUUID(), name: `Exec A ${stamp}`, slug: `exec-a-${stamp}`, updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { id: randomUUID(), name: `Exec B ${stamp}`, slug: `exec-b-${stamp}`, updatedAt: new Date() },
    });
    assignee = await db.user.create({
      data: { id: randomUUID(), email: `exec-assignee-${stamp}@example.com`, name: "Assignee", organizationId: orgA.id, role: UserRole.GRC_ANALYST, updatedAt: new Date() },
    });
    otherAnalyst = await db.user.create({
      data: { id: randomUUID(), email: `exec-other-${stamp}@example.com`, name: "Other", organizationId: orgA.id, role: UserRole.GRC_ANALYST, updatedAt: new Date() },
    });
    admin = await db.user.create({
      data: { id: randomUUID(), email: `exec-admin-${stamp}@example.com`, name: "Admin", organizationId: orgA.id, role: UserRole.ORG_ADMIN, updatedAt: new Date() },
    });
    analystB = await db.user.create({
      data: { id: randomUUID(), email: `exec-b-${stamp}@example.com`, name: "Analyst B", organizationId: orgB.id, role: UserRole.GRC_ANALYST, updatedAt: new Date() },
    });

    const matrixVersionId = randomUUID();
    const templateId = randomUUID();

    await runWithOrganizationContext(orgA.id, async () => {
      await db.riskMatrixTemplate.create({
        data: {
          id: templateId,
          organizationId: orgA.id,
          name: "Test 5×5 Matrix",
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
          id: matrixVersionId,
          templateId,
          versionNumber: 1,
          scales: SCALES as any,
          thresholds: THRESHOLDS as any,
          isActive: true,
          publishedAt: new Date(),
        },
      });
      await db.riskMatrixTemplate.update({
        where: { id: templateId },
        data: { currentVersionId: matrixVersionId },
      });

      const project = await db.riskAssessmentProject.create({
        data: {
          id: randomUUID(),
          organizationId: orgA.id,
          subject: "AWS Migration Assessment",
          executiveStatement: "Initial statement",
          assigneeId: assignee.id,
          createdById: assignee.id,
          matrixVersionId,
          dueDate: new Date(Date.now() + 7 * 86400000),
        },
      });
      projectId = project.id;

      // 5×5 → score 25 → Critical.
      await db.finding.create({
        data: {
          id: randomUUID(),
          identifier: `FND-CRIT-${stamp}`,
          title: "Internet-exposed admin interface",
          description: "desc",
          source: FindingSource.PENTEST,
          severity: Severity.HIGH,
          organizationId: orgA.id,
          createdBy: assignee.id,
          affectedAssets: ["bastion-1"],
          inherentLikelihood: 5,
          inherentImpact: 5,
          discoveryProjectId: project.id,
          discoveryStatus: RiskDiscoveryStatus.PUBLISHED,
        },
      });
      // 3×3 → score 9 → Medium.
      await db.finding.create({
        data: {
          id: randomUUID(),
          identifier: `FND-MED-${stamp}`,
          title: "Weak TLS configuration",
          description: "desc",
          source: FindingSource.SCANNER,
          severity: Severity.MEDIUM,
          organizationId: orgA.id,
          createdBy: assignee.id,
          affectedAssets: [],
          inherentLikelihood: 3,
          inherentImpact: 3,
          discoveryProjectId: project.id,
          discoveryStatus: RiskDiscoveryStatus.PUBLISHED,
        },
      });
      // Categorical-only (no L×I) → unscored.
      await db.finding.create({
        data: {
          id: randomUUID(),
          identifier: `FND-CAT-${stamp}`,
          title: "Missing security awareness training",
          description: "desc",
          source: FindingSource.AUDIT,
          severity: Severity.LOW,
          organizationId: orgA.id,
          createdBy: assignee.id,
          affectedAssets: [],
          discoveryProjectId: project.id,
          discoveryStatus: RiskDiscoveryStatus.PUBLISHED,
        },
      });

      await db.risk.create({
        data: {
          id: randomUUID(),
          identifier: `RISK-${stamp}`,
          title: "Lateral movement risk",
          description: "desc",
          severity: Severity.HIGH,
          organizationId: orgA.id,
          createdById: assignee.id,
          inherentLikelihood: 4,
          inherentImpact: 4,
          inherentScore: 16,
          inherentScoreLabel: "High",
          discoveryProjectId: project.id,
          discoveryStatus: RiskDiscoveryStatus.PUBLISHED,
        },
      });
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      if (!org) continue;
      await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "RiskAssessmentProject" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${org.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${org.id}`;
    }
  });

  describe("getRiskExecutiveData shaping (matrix-driven)", () => {
    it("returns the matrix descriptor for the assessment", async () => {
      const data = await getRiskExecutiveData(orgA.id, db as any, projectId);
      expect(data).not.toBeNull();
      expect(data!.matrix).not.toBeNull();
      expect(data!.matrix!.name).toBe("Test 5×5 Matrix");
      expect(data!.matrix!.dimensionCount).toBe(2);
      expect(data!.matrix!.outputScaleMax).toBe(25);
      expect(data!.matrix!.thresholds).toHaveLength(4);
    });

    it("scores findings against the matrix bands (label + color)", async () => {
      const data = await getRiskExecutiveData(orgA.id, db as any, projectId);
      const crit = data!.rows.find((r) => r.title === "Internet-exposed admin interface")!;
      expect(crit.scored).toBe(true);
      expect(crit.score).toBe(25);
      expect(crit.severityLabel).toBe("Critical");
      expect(crit.severityColor).toBe("#EF4444");
      expect(crit.displayNumber).toBe(1); // highest score ranks first

      const med = data!.rows.find((r) => r.title === "Weak TLS configuration")!;
      expect(med.score).toBe(9);
      expect(med.severityLabel).toBe("Medium");
      expect(med.severityColor).toBe("#EAB308");

      // Categorical-only finding: not placed on the matrix.
      const cat = data!.rows.find((r) => r.title === "Missing security awareness training")!;
      expect(cat.scored).toBe(false);
      expect(cat.score).toBeNull();
    });

    it("rolls up a matrix-aware scorecard (exposure + top-band count)", async () => {
      const data = await getRiskExecutiveData(orgA.id, db as any, projectId);
      // scored avg = (25 + 9) / 2 = 17 → exposure round(17/25*100) = 68, posture 32.
      expect(data!.scorecard[0]).toMatchObject({ label: "Security posture", value: 32 });
      expect(data!.scorecard[1]).toMatchObject({ label: "Risk exposure", value: 68 });
      expect(data!.scorecard[2]).toMatchObject({ label: "Critical findings", value: 1 });
    });

    it("maps discovered risks with matrix band label + color", async () => {
      const data = await getRiskExecutiveData(orgA.id, db as any, projectId);
      expect(data!.risks).toHaveLength(1);
      const risk = data!.risks[0]!;
      expect(risk.score).toBe(16);
      expect(risk.severityLabel).toBe("High");
      expect(risk.severityColor).toBe("#F97316");
      expect(risk.treatment).toBeNull();
    });

    it("returns null for a project id outside the caller org (cross-org isolation)", async () => {
      const data = await getRiskExecutiveData(orgB.id, db as any, projectId);
      expect(data).toBeNull();
    });
  });

  describe("deliverable.getRiskExecBody", () => {
    it("returns the matrix and canEdit per role", async () => {
      const asAssignee = await createCaller(assignee).deliverable.getRiskExecBody({ id: projectId });
      expect(asAssignee.canEdit).toBe(true);
      expect(asAssignee.matrix?.name).toBe("Test 5×5 Matrix");

      const asAdmin = await createCaller(admin).deliverable.getRiskExecBody({ id: projectId });
      expect(asAdmin.canEdit).toBe(true);

      const asOther = await createCaller(otherAnalyst).deliverable.getRiskExecBody({ id: projectId });
      expect(asOther.canEdit).toBe(false);
    });
  });

  describe("executive-summary section layout", () => {
    it("defaults to all sections enabled in canonical order", async () => {
      const data = await getRiskExecutiveData(orgA.id, db as any, projectId);
      expect(data!.layout).toHaveLength(7);
      expect(data!.layout.every((l) => l.enabled)).toBe(true);
      expect(data!.layout[0]!.key).toBe("statement");
    });

    it("persists a reordered/hidden layout via updateExecSummaryLayout (assignee)", async () => {
      const res = await createCaller(assignee).riskAssessmentProject.updateExecSummaryLayout({
        id: projectId,
        layout: [
          { key: "findings", enabled: true },
          { key: "statement", enabled: false },
        ],
      });
      // Normalized: saved keys first, missing appended; all 7 present.
      expect(res.layout).toHaveLength(7);
      expect(res.layout[0]!.key).toBe("findings");
      expect(res.layout.find((l) => l.key === "statement")!.enabled).toBe(false);

      // Reflected in the deliverable body payload.
      const body = await createCaller(assignee).deliverable.getRiskExecBody({ id: projectId });
      expect(body.layout[0]!.key).toBe("findings");
      expect(body.layout.find((l) => l.key === "statement")!.enabled).toBe(false);

      // Restore default for any later assertions in this suite.
      await createCaller(assignee).riskAssessmentProject.updateExecSummaryLayout({
        id: projectId,
        layout: [{ key: "statement", enabled: true }],
      });
    });

    it("forbids a non-assignee analyst and 404s cross-org", async () => {
      await expect(
        createCaller(otherAnalyst).riskAssessmentProject.updateExecSummaryLayout({
          id: projectId,
          layout: [{ key: "risks", enabled: true }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        createCaller(analystB).riskAssessmentProject.updateExecSummaryLayout({
          id: projectId,
          layout: [{ key: "risks", enabled: true }],
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("riskAssessmentProject.updateExecutiveStatement gating", () => {
    it("lets the assignee edit the statement", async () => {
      const res = await createCaller(assignee).riskAssessmentProject.updateExecutiveStatement({
        id: projectId,
        executiveStatement: "Updated by assignee",
      });
      expect(res.executiveStatement).toBe("Updated by assignee");
    });

    it("forbids a non-assignee, non-admin analyst", async () => {
      await expect(
        createCaller(otherAnalyst).riskAssessmentProject.updateExecutiveStatement({
          id: projectId,
          executiveStatement: "nope",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("returns NOT_FOUND for a cross-org caller", async () => {
      await expect(
        createCaller(analystB).riskAssessmentProject.updateExecutiveStatement({
          id: projectId,
          executiveStatement: "nope",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
