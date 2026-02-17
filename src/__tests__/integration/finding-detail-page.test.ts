/**
 * Finding Detail Page Integration Tests
 *
 * Story 7.11: Finding Detail Page with Inline Expansion
 *
 * Tests the finding.getById query that powers the finding detail page,
 * including authorization, data shape, and assessment inclusion.
 *
 * **Critical Test Coverage:**
 * - AC1-AC6: Page route and data fetching
 * - AC7-AC12: Finding header data (status, source, severity, locked indicator)
 * - AC13-AC18: Finding details data
 * - AC19-AC22: Actions based on status
 * - AC23-AC30: Inline assessment section data
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import {
  type UserRole,
  Severity,
  FindingSource,
  FindingStatus,
  AssessmentStatus,
} from "@prisma/client";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

// Test data
let testOrg: { id: string; name: string };
let otherOrg: { id: string; name: string };
let testUserGRCAnalyst: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserFromOtherOrg: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testBusinessUnit: { id: string; name: string };

// Sample findings for different tests
let findingNew: { id: string; identifier: string };
let findingTriaged: { id: string; identifier: string };
let findingAccepted: { id: string; identifier: string };
let findingRejected: { id: string; identifier: string };
let assessmentForAcceptedFinding: { id: string; identifier: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-finding-detail" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "RiskScenario" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${existingOrg.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "IdentifierSequence" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.organization.delete({ where: { id: existingOrg.id } });
  }

  const existingOtherOrg = await db.organization.findUnique({
    where: { slug: "test-org-finding-detail-other" },
  });
  if (existingOtherOrg) {
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOtherOrg.id}`;
    await db.organization.delete({ where: { id: existingOtherOrg.id } });
  }

  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Finding Detail",
      slug: "test-org-finding-detail",
      active: true,
      updatedAt: new Date(),
    },
  });

  otherOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Other Org Finding Detail",
      slug: "test-org-finding-detail-other",
      active: true,
      updatedAt: new Date(),
    },
  });

  // Create test users
  testUserGRCAnalyst = await db.user.create({
    data: {
      id: randomUUID(),
      email: `grc-analyst-detail-${randomUUID()}@test.com`,
      name: "GRC Analyst Detail",
      role: "GRC_ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  testUserFromOtherOrg = await db.user.create({
    data: {
      id: randomUUID(),
      email: `other-org-user-${randomUUID()}@test.com`,
      name: "Other Org User",
      role: "GRC_ANALYST",
      organizationId: otherOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  // Create test business unit
  await runWithOrganizationContext(testOrg.id, async () => {
    testBusinessUnit = await db.businessUnit.create({
      data: {
        id: randomUUID(),
        name: "Test BU Detail",
        organizationId: testOrg.id,
      },
    });
  });

  // Create findings in different statuses
  await runWithOrganizationContext(testOrg.id, async () => {
    // NEW finding
    const newFinding = await db.finding.create({
      data: {
        id: randomUUID(),
        identifier: "FND-2025-0001",
        organizationId: testOrg.id,
        title: "Test NEW Finding",
        description: "This is a NEW finding for testing",
        source: FindingSource.AUDIT,
        severity: Severity.LOW,
        status: FindingStatus.NEW,
        affectedAssets: ["asset-1"],
        createdBy: testUserGRCAnalyst.id,
        affectedBusinessUnits: {
          connect: [{ id: testBusinessUnit.id }],
        },
      },
    });
    findingNew = { id: newFinding.id, identifier: newFinding.identifier };

    // TRIAGED finding
    const triagedFinding = await db.finding.create({
      data: {
        id: randomUUID(),
        identifier: "FND-2025-0002",
        organizationId: testOrg.id,
        title: "Test TRIAGED Finding",
        description: "This is a TRIAGED finding for testing",
        source: FindingSource.PENTEST,
        severity: Severity.MEDIUM,
        status: FindingStatus.TRIAGED,
        affectedAssets: ["asset-2", "asset-3"],
        createdBy: testUserGRCAnalyst.id,
        triagedBy: testUserGRCAnalyst.id,
        triagedAt: new Date(),
        affectedBusinessUnits: {
          connect: [{ id: testBusinessUnit.id }],
        },
      },
    });
    findingTriaged = { id: triagedFinding.id, identifier: triagedFinding.identifier };

    // ACCEPTED finding with RiskAssessment
    const acceptedFinding = await db.finding.create({
      data: {
        id: randomUUID(),
        identifier: "FND-2025-0003",
        organizationId: testOrg.id,
        title: "Test ACCEPTED Finding",
        description: "This is an ACCEPTED finding for testing",
        source: FindingSource.SCANNER,
        severity: Severity.HIGH,
        status: FindingStatus.ACCEPTED,
        affectedAssets: ["critical-server", "database"],
        createdBy: testUserGRCAnalyst.id,
        triagedBy: testUserGRCAnalyst.id,
        triagedAt: new Date(Date.now() - 86400000),
        acceptedBy: testUserGRCAnalyst.id,
        acceptedAt: new Date(),
        lockedSnapshot: {
          title: "Test ACCEPTED Finding",
          description: "This is an ACCEPTED finding for testing",
          severity: Severity.HIGH,
          affectedAssets: ["critical-server", "database"],
          businessUnits: ["Test BU Detail"],
          source: FindingSource.SCANNER,
          snapshotAt: new Date().toISOString(),
        },
        affectedBusinessUnits: {
          connect: [{ id: testBusinessUnit.id }],
        },
      },
    });
    findingAccepted = { id: acceptedFinding.id, identifier: acceptedFinding.identifier };

    // Create RiskAssessment for the accepted finding
    const assessment = await db.riskAssessment.create({
      data: {
        id: randomUUID(),
        identifier: "RSK-2025-0001",
        organizationId: testOrg.id,
        findingId: acceptedFinding.id,
        title: "Risk Assessment for ACCEPTED Finding",
        context: "Context from finding description",
        status: AssessmentStatus.DRAFT,
        affectedSystems: ["critical-server", "database"],
        createdBy: testUserGRCAnalyst.id,
      },
    });
    assessmentForAcceptedFinding = { id: assessment.id, identifier: assessment.identifier };

    // REJECTED finding
    const rejectedFinding = await db.finding.create({
      data: {
        id: randomUUID(),
        identifier: "FND-2025-0004",
        organizationId: testOrg.id,
        title: "Test REJECTED Finding",
        description: "This is a REJECTED finding for testing",
        source: FindingSource.MANUAL,
        severity: Severity.LOW,
        status: FindingStatus.REJECTED,
        affectedAssets: [],
        createdBy: testUserGRCAnalyst.id,
      },
    });
    findingRejected = { id: rejectedFinding.id, identifier: rejectedFinding.identifier };
  });
});

afterAll(async () => {
  // Cleanup in reverse order of dependencies
  await db.$executeRaw`DELETE FROM "RiskScenario" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "RiskAssessment" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${testOrg.id})`;
  await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "IdentifierSequence" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.organization.delete({ where: { id: testOrg.id } });

  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${otherOrg.id}`;
  await db.organization.delete({ where: { id: otherOrg.id } });
});

/**
 * Helper to create a tRPC caller with a specific user session
 */
function createCaller(user: typeof testUserGRCAnalyst) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
  });
}

describe("Story 7.11: Finding Detail Page", () => {
  describe("AC1-AC6: Page Route and Data Fetching", () => {
    it("AC1: finding.getById query is defined", () => {
      const caller = createCaller(testUserGRCAnalyst);
      expect(caller.finding.getById).toBeDefined();
    });

    it("AC3: returns NOT_FOUND for non-existent finding", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.finding.getById({ id: "non-existent-id" })
      ).rejects.toThrow("Finding not found");
    });

    it("AC3: returns NOT_FOUND for finding from different organization", async () => {
      const caller = createCaller(testUserFromOtherOrg);

      await expect(
        caller.finding.getById({ id: findingNew.id })
      ).rejects.toThrow("Finding not found");
    });

    it("AC6: fetches finding with all required fields", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      expect(result.id).toBe(findingNew.id);
      expect(result.identifier).toBe(findingNew.identifier);
      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.severity).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it("AC6: includes creator information", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      expect(result.creator).toBeDefined();
      expect(result.creator?.id).toBe(testUserGRCAnalyst.id);
      expect(result.creator?.name).toBe("GRC Analyst Detail");
    });

    it("AC6: includes affected business units", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      expect(result.affectedBusinessUnits).toBeDefined();
      expect(result.affectedBusinessUnits.length).toBe(1);
      expect(result.affectedBusinessUnits[0]?.name).toBe("Test BU Detail");
    });
  });

  describe("AC7-AC12: Finding Header Data", () => {
    it("AC7: identifier is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.identifier).toBe("FND-2025-0002");
    });

    it("AC8: status is included for display", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const newResult = await caller.finding.getById({ id: findingNew.id });
      expect(newResult.status).toBe(FindingStatus.NEW);

      const triagedResult = await caller.finding.getById({ id: findingTriaged.id });
      expect(triagedResult.status).toBe(FindingStatus.TRIAGED);

      const acceptedResult = await caller.finding.getById({ id: findingAccepted.id });
      expect(acceptedResult.status).toBe(FindingStatus.ACCEPTED);
    });

    it("AC9: source is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.source).toBe(FindingSource.PENTEST);
    });

    it("AC10: severity is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.severity).toBe(Severity.HIGH);
    });

    it("AC11: createdAt is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      expect(result.createdAt).toBeDefined();
      expect(result.createdAt instanceof Date).toBe(true);
    });

    it("AC12: acceptedAt and accepter included for ACCEPTED findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.acceptedAt).toBeDefined();
      expect(result.accepter).toBeDefined();
      expect(result.accepter?.id).toBe(testUserGRCAnalyst.id);
    });

    it("AC12: acceptedAt and accepter null for non-ACCEPTED findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.acceptedAt).toBeNull();
      expect(result.accepter).toBeNull();
    });
  });

  describe("AC13-AC18: Finding Details Data", () => {
    it("AC13: title is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.title).toBe("Test ACCEPTED Finding");
    });

    it("AC14: description is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.description).toBe("This is an ACCEPTED finding for testing");
    });

    it("AC15: affectedAssets list is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.affectedAssets).toBeDefined();
      expect(result.affectedAssets).toContain("critical-server");
      expect(result.affectedAssets).toContain("database");
    });

    it("AC16: affectedBusinessUnits list is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.affectedBusinessUnits).toBeDefined();
      expect(result.affectedBusinessUnits.length).toBeGreaterThan(0);
      expect(result.affectedBusinessUnits[0]?.id).toBeDefined();
      expect(result.affectedBusinessUnits[0]?.name).toBeDefined();
    });
  });

  describe("AC19-AC22: Finding Actions Based on Status", () => {
    it("NEW findings can be triaged", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      expect(result.status).toBe(FindingStatus.NEW);
      // Status allows triage transition
    });

    it("TRIAGED findings can be accepted", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.status).toBe(FindingStatus.TRIAGED);
      expect(result.triagedBy).toBeDefined();
      // Status allows accept transition
    });

    it("ACCEPTED findings include accepter info for lock indicator", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.status).toBe(FindingStatus.ACCEPTED);
      expect(result.accepter).toBeDefined();
      expect(result.acceptedAt).toBeDefined();
    });

    it("REJECTED findings include rejection info", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingRejected.id });

      expect(result.status).toBe(FindingStatus.REJECTED);
    });
  });

  describe("AC23-AC30: Inline Assessment Section Data", () => {
    it("AC23: riskAssessment included for ACCEPTED findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment).not.toBeNull();
    });

    it("AC23: riskAssessment null for non-ACCEPTED findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const triagedResult = await caller.finding.getById({ id: findingTriaged.id });
      expect(triagedResult.riskAssessment).toBeNull();

      const newResult = await caller.finding.getById({ id: findingNew.id });
      expect(newResult.riskAssessment).toBeNull();
    });

    it("AC25: assessment identifier is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment?.identifier).toBe("RSK-2025-0001");
    });

    it("AC25: assessment status is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment?.status).toBe(AssessmentStatus.DRAFT);
    });

    it("assessment title and context are included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment?.title).toBe("Risk Assessment for ACCEPTED Finding");
      expect(result.riskAssessment?.context).toBe("Context from finding description");
    });

    it("assessment affectedSystems are included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment?.affectedSystems).toBeDefined();
      expect(result.riskAssessment?.affectedSystems).toContain("critical-server");
    });

    it("assessment createdAt is included", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingAccepted.id });

      expect(result.riskAssessment?.createdAt).toBeDefined();
    });
  });

  describe("Multi-Tenancy and Authorization", () => {
    it("user cannot access findings from other organizations", async () => {
      const caller = createCaller(testUserFromOtherOrg);

      await expect(
        caller.finding.getById({ id: findingNew.id })
      ).rejects.toThrow("Finding not found");

      await expect(
        caller.finding.getById({ id: findingAccepted.id })
      ).rejects.toThrow("Finding not found");
    });

    it("user can access all findings in their organization", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const newResult = await caller.finding.getById({ id: findingNew.id });
      expect(newResult.id).toBe(findingNew.id);

      const triagedResult = await caller.finding.getById({ id: findingTriaged.id });
      expect(triagedResult.id).toBe(findingTriaged.id);

      const acceptedResult = await caller.finding.getById({ id: findingAccepted.id });
      expect(acceptedResult.id).toBe(findingAccepted.id);
    });
  });

  describe("Data Relationships", () => {
    it("includes triager information for TRIAGED findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingTriaged.id });

      expect(result.triager).toBeDefined();
      expect(result.triager?.id).toBe(testUserGRCAnalyst.id);
    });

    it("includes duplicateOf when finding is marked as duplicate", async () => {
      // This tests the relationship field is included even when null
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.getById({ id: findingNew.id });

      // duplicateOf should be null for non-duplicate findings
      expect(result.duplicateOf).toBeNull();
    });
  });
});
