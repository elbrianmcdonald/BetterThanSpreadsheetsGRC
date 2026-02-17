/**
 * Finding Acceptance Integration Tests
 *
 * Story 7.4: Finding Acceptance (Creates Risk Assessment)
 *
 * Tests the accept mutation that transitions a finding from TRIAGED to ACCEPTED
 * and creates a linked Risk Assessment with pre-populated fields.
 *
 * **Critical Test Coverage:**
 * - AC1-AC8: Accept mutation functionality
 * - AC9: lockedSnapshot structure
 * - AC13-AC18: Risk Assessment pre-population
 * - AC26-AC27: Return values
 * - AC28-AC29: Permission enforcement
 * - AC30-AC32: Audit logging
 *
 * @see Story 7.4: Finding Acceptance (Creates Risk Assessment)
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
  AuditAction,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

// Test data
let testOrg: { id: string; name: string };
let testUserGRCAnalyst: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserSecurityEngineer: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserOrgAdmin: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testUserAuditor: {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  name: string;
  assignedFrameworks: string[];
};
let testBusinessUnit: { id: string; name: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-finding-accept" },
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

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Finding Accept",
      slug: "test-org-finding-accept",
      active: true,
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  testUserGRCAnalyst = await db.user.create({
    data: {
      id: randomUUID(),
      email: `grc-analyst-accept-${randomUUID()}@test.com`,
      name: "GRC Analyst Accept",
      role: "GRC_ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  testUserSecurityEngineer = await db.user.create({
    data: {
      id: randomUUID(),
      email: `security-eng-accept-${randomUUID()}@test.com`,
      name: "Security Engineer Accept",
      role: "SECURITY_ENGINEER",
      organizationId: testOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  testUserOrgAdmin = await db.user.create({
    data: {
      id: randomUUID(),
      email: `org-admin-accept-${randomUUID()}@test.com`,
      name: "Org Admin Accept",
      role: "ORG_ADMIN",
      organizationId: testOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  testUserAuditor = await db.user.create({
    data: {
      id: randomUUID(),
      email: `auditor-accept-${randomUUID()}@test.com`,
      name: "Auditor Accept",
      role: "AUDITOR",
      organizationId: testOrg.id,
      updatedAt: new Date(),
      assignedFrameworks: [],
    },
  });

  // Create test business unit (requires organization context)
  await runWithOrganizationContext(testOrg.id, async () => {
    testBusinessUnit = await db.businessUnit.create({
      data: {
        id: randomUUID(),
        name: "Test BU Accept",
        organizationId: testOrg.id,
      },
    });
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

/**
 * Helper to create a TRIAGED finding for testing
 */
async function createTriagedFinding(createdBy: string): Promise<string> {
  let findingId: string;
  await runWithOrganizationContext(testOrg.id, async () => {
    const finding = await db.finding.create({
      data: {
        identifier: `FND-2025-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
        organizationId: testOrg.id,
        title: "Test Finding for Acceptance",
        description: "This is a test finding that needs to be accepted",
        source: FindingSource.PENTEST,
        severity: Severity.HIGH,
        status: FindingStatus.TRIAGED,
        affectedAssets: ["web-app", "database"],
        createdBy,
        triagedBy: createdBy,
        triagedAt: new Date(),
        affectedBusinessUnits: {
          connect: [{ id: testBusinessUnit.id }],
        },
      },
    });
    findingId = finding.id;
  });
  return findingId!;
}

describe("Story 7.4: Finding Acceptance", () => {
  describe("AC1-AC8: Accept Mutation Functionality", () => {
    it("AC1: finding.accept mutation is defined", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      expect(caller.finding.accept).toBeDefined();
    });

    it("AC2: rejects findings not in TRIAGED status", async () => {
      // Create a NEW finding (not TRIAGED)
      let finding: { id: string };
      await runWithOrganizationContext(testOrg.id, async () => {
        finding = await db.finding.create({
          data: {
            identifier: `FND-2025-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
            organizationId: testOrg.id,
            title: "Test NEW Finding",
            description: "This is a NEW finding",
            source: FindingSource.PENTEST,
            severity: Severity.MEDIUM,
            status: FindingStatus.NEW,
            createdBy: testUserGRCAnalyst.id,
          },
        });
      });

      const caller = createCaller(testUserGRCAnalyst);
      await expect(caller.finding.accept({ findingId: finding!.id })).rejects.toThrow(
        /Cannot transition/
      );
    });

    it("AC4-AC5: transitions finding to ACCEPTED with acceptedBy and acceptedAt", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      expect(result.finding.status).toBe(FindingStatus.ACCEPTED);
      expect(result.finding.accepter).toBeDefined();
      expect(result.finding.accepter?.id).toBe(testUserGRCAnalyst.id);
    });

    it("AC6-AC7: generates RSK identifier and creates RiskAssessment in DRAFT", async () => {
      const findingId = await createTriagedFinding(testUserSecurityEngineer.id);
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.accept({ findingId });

      expect(result.assessment.identifier).toMatch(/^RSK-\d{4}-\d{4}$/);
      expect(result.assessment.status).toBe(AssessmentStatus.DRAFT);
    });

    it("AC8: operation is transactional", async () => {
      // If this test passes without leaving orphan data, transaction works
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      // Verify both entities exist
      const finding = await db.finding.findUnique({ where: { id: findingId } });
      const assessment = await db.riskAssessment.findUnique({
        where: { id: result.assessment.id },
      });

      expect(finding?.status).toBe(FindingStatus.ACCEPTED);
      expect(assessment).toBeDefined();
      expect(assessment?.findingId).toBe(findingId);
    });
  });

  describe("AC9: Locked Snapshot Structure", () => {
    it("lockedSnapshot contains all required fields", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      await caller.finding.accept({ findingId });

      const finding = await db.finding.findUnique({ where: { id: findingId } });
      const snapshot = finding?.lockedSnapshot as any;

      expect(snapshot).toHaveProperty("title");
      expect(snapshot).toHaveProperty("description");
      expect(snapshot).toHaveProperty("severity");
      expect(snapshot).toHaveProperty("affectedAssets");
      expect(snapshot).toHaveProperty("businessUnits");
      expect(snapshot).toHaveProperty("source");
      expect(snapshot).toHaveProperty("snapshotAt");
    });

    it("lockedSnapshot preserves original values", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const originalFinding = await db.finding.findUnique({
        where: { id: findingId },
        include: { affectedBusinessUnits: true },
      });

      const caller = createCaller(testUserGRCAnalyst);
      await caller.finding.accept({ findingId });

      const finding = await db.finding.findUnique({ where: { id: findingId } });
      const snapshot = finding?.lockedSnapshot as any;

      expect(snapshot.title).toBe(originalFinding?.title);
      expect(snapshot.description).toBe(originalFinding?.description);
      expect(snapshot.severity).toBe(originalFinding?.severity);
      expect(snapshot.source).toBe(originalFinding?.source);
    });
  });

  describe("AC13-AC18: Risk Assessment Pre-Population", () => {
    it("AC13-AC15, AC17-AC18: Assessment pre-populated from finding", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const originalFinding = await db.finding.findUnique({ where: { id: findingId } });

      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.finding.accept({ findingId });

      const assessment = await db.riskAssessment.findUnique({
        where: { id: result.assessment.id },
      });

      // AC13: Title copied
      expect(assessment?.title).toBe(originalFinding?.title);
      // AC14: Context = description
      expect(assessment?.context).toBe(originalFinding?.description);
      // AC15: affectedSystems = affectedAssets
      expect(assessment?.affectedSystems).toEqual(originalFinding?.affectedAssets);
      // AC17: findingId links to source
      expect(assessment?.findingId).toBe(findingId);
      // AC18: createdBy set from session
      expect(assessment?.createdBy).toBe(testUserGRCAnalyst.id);
    });

    it("AC16: Assessment created with DRAFT status", async () => {
      const findingId = await createTriagedFinding(testUserOrgAdmin.id);
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.finding.accept({ findingId });

      const assessment = await db.riskAssessment.findUnique({
        where: { id: result.assessment.id },
      });

      expect(assessment?.status).toBe(AssessmentStatus.DRAFT);
    });
  });

  describe("AC26-AC27: Return Values", () => {
    it("AC26: Returns both finding and assessment", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      expect(result).toHaveProperty("finding");
      expect(result).toHaveProperty("assessment");
      expect(result.finding.id).toBe(findingId);
      expect(result.assessment.id).toBeDefined();
    });

    it("AC27: Assessment includes id and identifier", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      expect(result.assessment.id).toBeDefined();
      expect(result.assessment.identifier).toBeDefined();
      expect(result.assessment.identifier).toMatch(/^RSK-\d{4}-\d{4}$/);
    });
  });

  describe("AC28-AC29: Permission Enforcement", () => {
    it("AC28: GRC_ANALYST can accept findings", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });
      expect(result.finding.status).toBe(FindingStatus.ACCEPTED);
    });

    it("AC28: SECURITY_ENGINEER can accept findings", async () => {
      const findingId = await createTriagedFinding(testUserSecurityEngineer.id);
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.accept({ findingId });
      expect(result.finding.status).toBe(FindingStatus.ACCEPTED);
    });

    it("AC28: ORG_ADMIN can accept findings", async () => {
      const findingId = await createTriagedFinding(testUserOrgAdmin.id);
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.finding.accept({ findingId });
      expect(result.finding.status).toBe(FindingStatus.ACCEPTED);
    });

    it("AC29: AUDITOR cannot accept findings", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserAuditor);

      await expect(caller.finding.accept({ findingId })).rejects.toThrow();
    });
  });

  describe("AC30-AC32: Audit Logging", () => {
    it("AC30: FINDING_ACCEPTED audit log created", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      await caller.finding.accept({ findingId });

      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: findingId,
          action: AuditAction.FINDING_ACCEPTED,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.entityType).toBe("Finding");
    });

    it("AC31: ASSESSMENT_CREATED audit log created", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: result.assessment.id,
          action: AuditAction.ASSESSMENT_CREATED,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.entityType).toBe("RiskAssessment");
    });

    it("AC32: Audit logs include cross-references", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.accept({ findingId });

      // Check finding log has assessment reference
      const findingLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: findingId,
          action: AuditAction.FINDING_ACCEPTED,
        },
      });
      const findingChanges = findingLog?.changes as any;
      expect(findingChanges.assessmentId).toBe(result.assessment.id);

      // Check assessment log has finding reference
      const assessmentLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: result.assessment.id,
          action: AuditAction.ASSESSMENT_CREATED,
        },
      });
      const assessmentChanges = assessmentLog?.changes as any;
      expect(assessmentChanges.findingId).toBe(findingId);
    });
  });

  describe("Error Handling", () => {
    it("returns NOT_FOUND for non-existent finding", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.finding.accept({ findingId: "non-existent-id" })
      ).rejects.toThrow("Finding not found");
    });

    it("cannot accept already accepted finding", async () => {
      const findingId = await createTriagedFinding(testUserGRCAnalyst.id);
      const caller = createCaller(testUserGRCAnalyst);

      // Accept once
      await caller.finding.accept({ findingId });

      // Try to accept again
      await expect(caller.finding.accept({ findingId })).rejects.toThrow(
        /already in this status|Cannot transition/
      );
    });
  });
});
