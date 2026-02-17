/**
 * Finding Triage Workflow Integration Tests
 *
 * Tests for Story 7.3: Finding Triage Workflow
 *
 * **Critical Test Coverage:**
 * - AC1-AC6: State machine implementation
 * - AC7-AC12: Transition mutation functionality
 * - AC29-AC30: Role-based permission enforcement
 * - AC31-AC33: Audit logging
 *
 * @see Story 7.3: Finding Triage Workflow
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, FindingStatus, AuditAction } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";
import {
  canTransitionFinding,
  assertFindingTransition,
  isTerminalFindingStatus,
  getAvailableFindingTransitions,
  FINDING_TRANSITIONS,
  TERMINAL_STATUSES,
} from "@/server/services/findingStateMachine";

// Test data
let testOrg: { id: string; name: string };
let testOrg2: { id: string; name: string };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrgAdmin: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrg2: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-finding-triage" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${existingOrg.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  const existingOrg2 = await db.organization.findUnique({
    where: { slug: "test-org-finding-triage-2" },
  });
  if (existingOrg2) {
    await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${existingOrg2.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg2.id}`;
  }

  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Finding Triage",
      slug: "test-org-finding-triage",
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Finding Triage 2",
      slug: "test-org-finding-triage-2",
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  const createUser = async (
    name: string,
    email: string,
    role: UserRole,
    orgId: string
  ) => {
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        role,
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });
    return {
      id: user.id,
      email: user.email!,
      role: user.role,
      organizationId: user.organizationId,
      name: user.name!,
      assignedFrameworks: user.assignedFrameworks,
    };
  };

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@finding-triage.test",
    "SECURITY_ENGINEER",
    testOrg.id
  );

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@finding-triage.test",
    "GRC_ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@finding-triage.test",
    "ORG_ADMIN",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@finding-triage.test",
    "IT_STAKEHOLDER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@finding-triage.test",
    "BUSINESS_STAKEHOLDER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@finding-triage.test",
    "AUDITOR",
    testOrg.id
  );

  testUserOrg2 = await createUser(
    "User Org 2",
    "user@finding-triage-org2.test",
    "SECURITY_ENGINEER",
    testOrg2.id
  );
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
  if (testOrg2) {
    await db.$executeRaw`DELETE FROM "_FindingAffectedBUs" WHERE "A" IN (SELECT id FROM "Finding" WHERE "organizationId" = ${testOrg2.id})`;
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg2.id}`;
  }
});

// Helper to create a caller with a specific user context
const createCaller = (user: typeof testUserSecurityEngineer) => {
  return appRouter.createCaller({
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
};

// Helper to create a finding for testing
const createTestFinding = async (caller: ReturnType<typeof createCaller>, title: string) => {
  return caller.finding.create({
    title,
    description: "This is a test finding for triage workflow testing with sufficient description length.",
    source: FindingSource.PENTEST,
    severity: Severity.HIGH,
  });
};

describe("Story 7.3: Finding Triage Workflow", () => {
  describe("AC1-AC6: State Machine Unit Tests", () => {
    it("AC1: State machine constants are defined", () => {
      expect(FINDING_TRANSITIONS).toBeDefined();
      expect(TERMINAL_STATUSES).toBeDefined();
    });

    it("AC2: NEW can transition to TRIAGED, NEEDS_INFO, DUPLICATE, REJECTED", () => {
      const allowedFromNew = FINDING_TRANSITIONS[FindingStatus.NEW];
      expect(allowedFromNew).toContain(FindingStatus.TRIAGED);
      expect(allowedFromNew).toContain(FindingStatus.NEEDS_INFO);
      expect(allowedFromNew).toContain(FindingStatus.DUPLICATE);
      expect(allowedFromNew).toContain(FindingStatus.REJECTED);
    });

    it("AC3: NEEDS_INFO can transition to TRIAGED", () => {
      const allowedFromNeedsInfo = FINDING_TRANSITIONS[FindingStatus.NEEDS_INFO];
      expect(allowedFromNeedsInfo).toContain(FindingStatus.TRIAGED);
    });

    it("AC4: Terminal states have no valid transitions", () => {
      expect(TERMINAL_STATUSES).toContain(FindingStatus.DUPLICATE);
      expect(TERMINAL_STATUSES).toContain(FindingStatus.REJECTED);
      expect(TERMINAL_STATUSES).toContain(FindingStatus.ACCEPTED);

      expect(FINDING_TRANSITIONS[FindingStatus.DUPLICATE]).toHaveLength(0);
      expect(FINDING_TRANSITIONS[FindingStatus.REJECTED]).toHaveLength(0);
      expect(FINDING_TRANSITIONS[FindingStatus.ACCEPTED]).toHaveLength(0);
    });

    it("AC5: canTransitionFinding returns boolean correctly", () => {
      expect(canTransitionFinding(FindingStatus.NEW, FindingStatus.TRIAGED)).toBe(true);
      expect(canTransitionFinding(FindingStatus.NEW, FindingStatus.NEEDS_INFO)).toBe(true);
      expect(canTransitionFinding(FindingStatus.NEW, FindingStatus.DUPLICATE)).toBe(true);
      expect(canTransitionFinding(FindingStatus.NEW, FindingStatus.REJECTED)).toBe(true);
      expect(canTransitionFinding(FindingStatus.NEW, FindingStatus.ACCEPTED)).toBe(false);
      expect(canTransitionFinding(FindingStatus.REJECTED, FindingStatus.NEW)).toBe(false);
    });

    it("AC6: assertFindingTransition throws TRPCError on invalid transition", () => {
      expect(() => assertFindingTransition(FindingStatus.NEW, FindingStatus.TRIAGED)).not.toThrow();

      expect(() => assertFindingTransition(FindingStatus.REJECTED, FindingStatus.NEW)).toThrow(TRPCError);
      expect(() => assertFindingTransition(FindingStatus.NEW, FindingStatus.NEW)).toThrow(TRPCError);
    });

    it("isTerminalFindingStatus works correctly", () => {
      expect(isTerminalFindingStatus(FindingStatus.DUPLICATE)).toBe(true);
      expect(isTerminalFindingStatus(FindingStatus.REJECTED)).toBe(true);
      expect(isTerminalFindingStatus(FindingStatus.ACCEPTED)).toBe(true);
      expect(isTerminalFindingStatus(FindingStatus.NEW)).toBe(false);
      expect(isTerminalFindingStatus(FindingStatus.TRIAGED)).toBe(false);
    });

    it("getAvailableFindingTransitions returns correct transitions", () => {
      const newTransitions = getAvailableFindingTransitions(FindingStatus.NEW);
      expect(newTransitions).toHaveLength(4);
      expect(newTransitions).toContain(FindingStatus.TRIAGED);

      const rejectedTransitions = getAvailableFindingTransitions(FindingStatus.REJECTED);
      expect(rejectedTransitions).toHaveLength(0);
    });
  });

  describe("AC7-AC12: Transition Mutation", () => {
    it("AC7-AC9: Transitions finding from NEW to TRIAGED", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Transition Test NEW to TRIAGED");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      expect(result.status).toBe(FindingStatus.TRIAGED);
    });

    it("AC10: TRIAGED transition sets triager and triagedAt", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const finding = await createTestFinding(caller, "Triaged By Test");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      // Verify by fetching from DB with triager relation
      const dbFinding = await db.finding.findUnique({
        where: { id: result.id },
        include: { triager: true },
      });

      expect(dbFinding?.triager?.id).toBe(testUserSecurityEngineer.id);
      expect(dbFinding?.triagedAt).toBeDefined();
    });

    it("AC11: DUPLICATE transition requires duplicateOfId", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Duplicate Without ID Test");

      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.DUPLICATE,
        })
      ).rejects.toThrow("duplicateOfId is required");
    });

    it("AC11: DUPLICATE transition links to original finding", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Create original finding
      const originalFinding = await createTestFinding(caller, "Original Finding for Duplicate Test");

      // Create duplicate finding
      const duplicateFinding = await createTestFinding(caller, "Duplicate Finding Test");

      // Transition to DUPLICATE
      const result = await caller.finding.transition({
        findingId: duplicateFinding.id,
        targetStatus: FindingStatus.DUPLICATE,
        duplicateOfId: originalFinding.id,
      });

      expect(result.status).toBe(FindingStatus.DUPLICATE);
      expect(result.duplicateOf?.id).toBe(originalFinding.id);
      expect(result.duplicateOf?.identifier).toBe(originalFinding.identifier);
    });

    it("AC12: Returns updated finding", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Return Test");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.NEEDS_INFO,
      });

      expect(result.id).toBe(finding.id);
      expect(result.identifier).toBe(finding.identifier);
      expect(result.status).toBe(FindingStatus.NEEDS_INFO);
    });

    it("Transitions NEW to NEEDS_INFO to TRIAGED flow", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Multi-Step Transition Test");

      // NEW -> NEEDS_INFO
      const needsInfoResult = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.NEEDS_INFO,
      });
      expect(needsInfoResult.status).toBe(FindingStatus.NEEDS_INFO);

      // NEEDS_INFO -> TRIAGED
      const triagedResult = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });
      expect(triagedResult.status).toBe(FindingStatus.TRIAGED);
    });

    it("Rejects invalid transition from terminal state", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Terminal State Test");

      // Transition to REJECTED (terminal)
      await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.REJECTED,
      });

      // Try to transition from REJECTED -> NEW (should fail)
      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.NEW,
        })
      ).rejects.toThrow("Cannot transition from REJECTED to NEW");
    });

    it("Rejects transition to same status", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Same Status Test");

      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.NEW,
        })
      ).rejects.toThrow("Finding is already in this status");
    });

    it("Prevents self-reference when marking as duplicate", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Self Reference Test");

      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.DUPLICATE,
          duplicateOfId: finding.id,
        })
      ).rejects.toThrow("A finding cannot be a duplicate of itself");
    });

    it("Validates duplicateOfId exists in same organization", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Cross Org Duplicate Test");

      // Create finding in other org
      const callerOrg2 = createCaller(testUserOrg2);
      const findingOrg2 = await createTestFinding(callerOrg2, "Other Org Finding");

      // Try to link to finding in other org
      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.DUPLICATE,
          duplicateOfId: findingOrg2.id,
        })
      ).rejects.toThrow("Original finding not found in organization");
    });
  });

  describe("AC29-AC30: Role-Based Permissions", () => {
    it("AC29: Security Engineer can triage findings", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const finding = await createTestFinding(caller, "Security Engineer Triage Test");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      expect(result.status).toBe(FindingStatus.TRIAGED);
    });

    it("AC29: GRC Analyst can triage findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "GRC Analyst Triage Test");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      expect(result.status).toBe(FindingStatus.TRIAGED);
    });

    it("AC29: Org Admin can triage findings", async () => {
      const caller = createCaller(testUserOrgAdmin);
      const finding = await createTestFinding(caller, "Org Admin Triage Test");

      const result = await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      expect(result.status).toBe(FindingStatus.TRIAGED);
    });

    it("AC30: IT Stakeholder cannot triage findings", async () => {
      // Create finding as admin
      const adminCaller = createCaller(testUserOrgAdmin);
      const finding = await createTestFinding(adminCaller, "IT Stakeholder Triage Attempt");

      // Try to triage as IT Stakeholder
      const caller = createCaller(testUserITStakeholder);
      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.TRIAGED,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC30: Business Stakeholder cannot triage findings", async () => {
      const adminCaller = createCaller(testUserOrgAdmin);
      const finding = await createTestFinding(adminCaller, "Business Stakeholder Triage Attempt");

      const caller = createCaller(testUserBusinessStakeholder);
      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.TRIAGED,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC30: Auditor cannot triage findings", async () => {
      const adminCaller = createCaller(testUserOrgAdmin);
      const finding = await createTestFinding(adminCaller, "Auditor Triage Attempt");

      const caller = createCaller(testUserAuditor);
      await expect(
        caller.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.TRIAGED,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("AC31-AC33: Audit Logging", () => {
    it("AC31-AC32: Transition is logged with FINDING_TRANSITIONED action", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const finding = await createTestFinding(caller, "Audit Log Test");

      await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.TRIAGED,
      });

      // Give async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Finding",
          entityId: finding.id,
          action: AuditAction.FINDING_TRANSITIONED,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(testUserSecurityEngineer.id);
      expect(auditLog?.organizationId).toBe(testOrg.id);

      const changes = auditLog?.changes as { before: { status: string }; after: { status: string } };
      expect(changes.before.status).toBe(FindingStatus.NEW);
      expect(changes.after.status).toBe(FindingStatus.TRIAGED);
    });

    it("AC33: Rejection reason is logged if provided", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(caller, "Rejection Reason Log Test");

      const rejectionReason = "False positive - scanner misconfiguration";

      await caller.finding.transition({
        findingId: finding.id,
        targetStatus: FindingStatus.REJECTED,
        rejectionReason,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Finding",
          entityId: finding.id,
          action: AuditAction.FINDING_TRANSITIONED,
        },
      });

      expect(auditLog).not.toBeNull();
      const changes = auditLog?.changes as { after: { rejectionReason: string } };
      expect(changes.after.rejectionReason).toBe(rejectionReason);
    });

    it("AC32: Duplicate link is logged", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const originalFinding = await createTestFinding(caller, "Original for Audit Test");
      const duplicateFinding = await createTestFinding(caller, "Duplicate for Audit Test");

      await caller.finding.transition({
        findingId: duplicateFinding.id,
        targetStatus: FindingStatus.DUPLICATE,
        duplicateOfId: originalFinding.id,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Finding",
          entityId: duplicateFinding.id,
          action: AuditAction.FINDING_TRANSITIONED,
        },
      });

      expect(auditLog).not.toBeNull();
      const changes = auditLog?.changes as { after: { duplicateOfId: string } };
      expect(changes.after.duplicateOfId).toBe(originalFinding.id);
    });
  });

  describe("Search Query for Duplicate Finder", () => {
    it("Searches by identifier prefix", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const finding = await createTestFinding(caller, "Search Test Finding");
      const identifierPrefix = finding.identifier.substring(0, 8); // e.g., "FND-2025"

      const results = await caller.finding.search({
        query: identifierPrefix,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.identifier === finding.identifier)).toBe(true);
    });

    it("Searches by title (case-insensitive)", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await createTestFinding(caller, "Unique Title for Search Test XYZ123");

      const results = await caller.finding.search({
        query: "unique title for search",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.title.includes("XYZ123"))).toBe(true);
    });

    it("Excludes current finding from results", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const finding = await createTestFinding(caller, "Exclude Self Test Finding");

      const results = await caller.finding.search({
        query: "Exclude Self Test",
        excludeId: finding.id,
      });

      expect(results.some(r => r.id === finding.id)).toBe(false);
    });

    it("Returns correct fields", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await createTestFinding(caller, "Field Check Test Finding");

      const results = await caller.finding.search({
        query: "Field Check",
      });

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("identifier");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("severity");
    });

    it("Returns max 10 results", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Create 15 findings with similar titles
      for (let i = 0; i < 15; i++) {
        await createTestFinding(caller, `Bulk Search Test Finding ${i}`);
      }

      const results = await caller.finding.search({
        query: "Bulk Search Test",
      });

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Cross-Organization Isolation", () => {
    it("Cannot transition finding from another organization", async () => {
      // Create finding in org 1
      const callerOrg1 = createCaller(testUserGRCAnalyst);
      const finding = await createTestFinding(callerOrg1, "Cross Org Transition Test");

      // Try to transition from org 2
      const callerOrg2 = createCaller(testUserOrg2);
      await expect(
        callerOrg2.finding.transition({
          findingId: finding.id,
          targetStatus: FindingStatus.TRIAGED,
        })
      ).rejects.toThrow("Finding not found");
    });

    it("Search does not return findings from other organizations", async () => {
      // Create finding in org 1
      const callerOrg1 = createCaller(testUserGRCAnalyst);
      await createTestFinding(callerOrg1, "Org1 Isolated Search Finding");

      // Search from org 2
      const callerOrg2 = createCaller(testUserOrg2);
      const results = await callerOrg2.finding.search({
        query: "Org1 Isolated Search",
      });

      expect(results.length).toBe(0);
    });
  });
});
