/**
 * Evidence Audit Trail Integration Tests
 *
 * Tests for Story 3.9: Evidence Audit Trail (Who, When, What Changed)
 *
 * AC1: Evidence upload logged to audit trail
 * AC2: Evidence update logged with before/after values
 * AC3: Evidence version replacement logged
 * AC4: Evidence deletion logged with reason
 * AC5: Evidence download logged
 * AC6: Evidence view logged
 * AC7: Evidence-to-risk linkage logged
 * AC8: All logs include timestamp, user, and organization
 * AC20-AC24: Audit trail query and access control
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data IDs (used for cleanup)
const testOrgId = randomUUID();
const testUserId = randomUUID();
const testEvidenceId = randomUUID();
let controlDomainId: string;

// Test data references
let testOrg: { id: string; name: string };
let testUser: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null; assignedFrameworks: string[] };
let testEvidence: { id: string; title: string };

/**
 * Create a tRPC caller with mocked session context
 */
function createCaller(user: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null; assignedFrameworks: string[] }) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email ?? undefined,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name ?? undefined,
        image: null,
        assignedFrameworks: user.assignedFrameworks,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

beforeAll(async () => {
  // Clean up any existing test data first
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;

  // Create test organization
  const testSlug = `test-org-audit-trail-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  testOrg = await db.organization.create({
    data: {
      id: testOrgId,
      name: "Test Org Audit Trail",
      slug: testSlug,
      updatedAt: now,
    },
  });

  // Create test user
  const testEmail = `user-${randomUUID().slice(0, 8)}@test.com`;
  testUser = await db.user.create({
    data: {
      id: testUserId,
      name: "Test User",
      email: testEmail,
      role: "GRC_ANALYST",
      organizationId: testOrg.id,
      assignedFrameworks: [],
      updatedAt: now,
    },
  });

  // Find an existing control domain
  const existingDomain = await db.controlDomain.findFirst({
    where: { isActive: true },
  });

  if (!existingDomain) {
    throw new Error("No active control domain found - test requires seeded data");
  }
  controlDomainId = existingDomain.id;

  // Create test evidence using raw SQL to bypass organization middleware
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId}, ${testOrgId}, 'Audit Trail Test Evidence', 'Test description for audit trail', 'audit-test.pdf', '/test/audit-trail-test.pdf', 1024, 'application/pdf', ${testUserId}, true, 1, ${now}, ${now})
  `;
  testEvidence = { id: testEvidenceId, title: "Audit Trail Test Evidence" };

  // Link evidence to control domain
  const ecdId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "EvidenceControlDomain" (id, "evidenceId", "controlDomainId")
    VALUES (${ecdId}, ${testEvidenceId}, ${controlDomainId})
  `;
});

afterAll(async () => {
  // Clean up test data
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;
});

describe("Evidence Audit Trail (Story 3.9)", () => {
  describe("getEvidenceAuditLog query (AC20-AC24)", () => {
    beforeEach(async () => {
      // Clear existing audit logs for this evidence before each test using raw SQL
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
    });

    it("AC20: Returns audit trail for specific evidence", async () => {
      const caller = createCaller(testUser);

      // Create some audit log entries using raw SQL to bypass organization middleware
      const log1Id = randomUUID();
      const log2Id = randomUUID();
      const changes1 = JSON.stringify({ after: { title: "Test Evidence", fileName: "test.pdf" } });
      const changes2 = JSON.stringify({ after: { viewedBy: "test@test.com" } });

      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${log1Id}, 'UPLOAD_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes1}::jsonb, NOW())
      `;
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${log2Id}, 'VIEW_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes2}::jsonb, NOW())
      `;

      const result = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
        page: 1,
        pageSize: 10,
      });

      expect(result).toBeDefined();
      expect(result.logs.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("AC21: Audit log entries include user information", async () => {
      const caller = createCaller(testUser);

      // Create an audit log entry using raw SQL
      const logId = randomUUID();
      const changes = JSON.stringify({ before: { description: "old" }, after: { description: "new" } });
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${logId}, 'UPDATE_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes}::jsonb, NOW())
      `;

      const result = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
      });

      expect(result.logs.length).toBe(1);
      const entry = result.logs[0];
      expect(entry.User).toBeDefined();
      expect(entry.User?.name).toBe("Test User");
      expect(entry.User?.email).toContain("@test.com");
    });

    it("AC22: Audit log entries ordered by timestamp descending (newest first)", async () => {
      const caller = createCaller(testUser);

      const now = new Date();
      const log1Id = randomUUID();
      const log2Id = randomUUID();
      const log3Id = randomUUID();
      const changes1 = JSON.stringify({ after: { order: 1 } });
      const changes2 = JSON.stringify({ after: { order: 2 } });
      const changes3 = JSON.stringify({ after: { order: 3 } });
      const ts1 = new Date(now.getTime() - 3000).toISOString(); // oldest
      const ts2 = new Date(now.getTime() - 2000).toISOString();
      const ts3 = now.toISOString(); // newest

      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${log1Id}, 'UPLOAD_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes1}::jsonb, ${ts1}::timestamp)
      `;
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${log2Id}, 'VIEW_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes2}::jsonb, ${ts2}::timestamp)
      `;
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${log3Id}, 'UPDATE_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes3}::jsonb, ${ts3}::timestamp)
      `;

      const result = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
      });

      expect(result.logs.length).toBe(3);

      // Verify newest is first (UPDATE_EVIDENCE with order: 3)
      const firstChange = result.logs[0].changes as { after: { order: number } };
      expect(firstChange.after.order).toBe(3);

      // Verify oldest is last (UPLOAD_EVIDENCE with order: 1)
      const lastChange = result.logs[2].changes as { after: { order: number } };
      expect(lastChange.after.order).toBe(1);
    });

    it("AC23: Audit log entries only visible for evidence in same organization", async () => {
      // Create another organization and user
      const otherOrgId = randomUUID();
      const otherUserId = randomUUID();

      await db.organization.create({
        data: {
          id: otherOrgId,
          name: "Other Org",
          slug: `other-org-${randomUUID().slice(0, 8)}`,
          updatedAt: new Date(),
        },
      });

      await db.user.create({
        data: {
          id: otherUserId,
          email: `other-${randomUUID().slice(0, 8)}@test.com`,
          name: "Other User",
          role: "GRC_ANALYST",
          organizationId: otherOrgId,
          assignedFrameworks: [],
          updatedAt: new Date(),
        },
      });

      const otherUser = {
        id: otherUserId,
        email: "other@test.com",
        name: "Other User",
        role: "GRC_ANALYST" as UserRole,
        organizationId: otherOrgId,
        assignedFrameworks: [],
      };

      const otherCaller = createCaller(otherUser);

      // Try to access audit log from another organization
      await expect(
        otherCaller.audit.getEvidenceAuditLog({
          evidenceId: testEvidenceId,
        })
      ).rejects.toThrow("Evidence not found");

      // Cleanup
      await db.$executeRaw`DELETE FROM "User" WHERE "id" = ${otherUserId}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${otherOrgId}`;
    });

    it("AC24: Supports pagination", async () => {
      const caller = createCaller(testUser);

      // Create 15 audit log entries using raw SQL
      for (let i = 0; i < 15; i++) {
        const logId = randomUUID();
        const changes = JSON.stringify({ after: { viewNumber: i + 1 } });
        const ts = new Date(Date.now() - i * 1000).toISOString();
        await db.$executeRaw`
          INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
          VALUES (${logId}, 'VIEW_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes}::jsonb, ${ts}::timestamp)
        `;
      }

      // Get first page
      const page1 = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
        page: 1,
        pageSize: 10,
      });

      expect(page1.logs.length).toBe(10);
      expect(page1.total).toBe(15);
      expect(page1.totalPages).toBe(2);
      expect(page1.page).toBe(1);

      // Get second page
      const page2 = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
        page: 2,
        pageSize: 10,
      });

      expect(page2.logs.length).toBe(5);
      expect(page2.page).toBe(2);
    });
  });

  describe("Evidence operations create audit log entries (AC1-AC8)", () => {
    beforeEach(async () => {
      // Clear existing audit logs before each test using raw SQL
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
    });

    it("AC6: Viewing evidence creates audit log entry", async () => {
      const caller = createCaller(testUser);

      // View the evidence
      await caller.evidence.getById({ id: testEvidenceId });

      // Wait a moment for async audit log
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check audit log was created
      const auditLogs = await db.auditLog.findMany({
        where: {
          entityId: testEvidenceId,
          action: "VIEW_EVIDENCE",
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const viewLog = auditLogs[0];
      expect(viewLog).toBeDefined();
      expect(viewLog?.userId).toBe(testUserId);
      expect(viewLog?.organizationId).toBe(testOrgId);
      expect(viewLog?.changes).toBeDefined();
    });

    it("AC2: Updating evidence metadata creates audit log with before/after values", async () => {
      const caller = createCaller(testUser);

      // Update the evidence
      await caller.evidence.update({
        id: testEvidenceId,
        description: "Updated description for audit test",
      });

      // Check audit log was created
      const auditLogs = await db.auditLog.findMany({
        where: {
          entityId: testEvidenceId,
          action: "UPDATE_EVIDENCE",
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const updateLog = auditLogs[0];
      expect(updateLog).toBeDefined();
      expect(updateLog?.changes).toBeDefined();

      const changes = updateLog?.changes as { before?: unknown; after?: unknown };
      expect(changes.before).toBeDefined();
      expect(changes.after).toBeDefined();
    });

    it("AC4: Deleting evidence creates audit log", async () => {
      const caller = createCaller(testUser);

      // Delete the evidence (soft delete)
      await caller.evidence.delete({ id: testEvidenceId });

      // Check audit log was created
      const auditLogs = await db.auditLog.findMany({
        where: {
          entityId: testEvidenceId,
          action: "DELETE_EVIDENCE",
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const deleteLog = auditLogs[0];
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.userId).toBe(testUserId);

      const changes = deleteLog?.changes as { after?: { isActive: boolean } };
      expect(changes.after?.isActive).toBe(false);

      // Restore for other tests using raw SQL to bypass organization middleware
      await db.$executeRaw`
        UPDATE "Evidence"
        SET "isActive" = true, "deletedAt" = NULL
        WHERE "id" = ${testEvidenceId}
      `;
    });

    it("AC8: All audit logs include timestamp, user, and organization", async () => {
      const caller = createCaller(testUser);

      // Create an operation
      await caller.evidence.getById({ id: testEvidenceId });

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check all audit logs have required fields
      const auditLogs = await db.auditLog.findMany({
        where: { entityId: testEvidenceId },
      });

      for (const log of auditLogs) {
        expect(log.timestamp).toBeDefined();
        expect(log.timestamp).toBeInstanceOf(Date);
        expect(log.userId).toBeDefined();
        expect(log.organizationId).toBe(testOrgId);
        expect(log.entityType).toBe("Evidence");
        expect(log.entityId).toBe(testEvidenceId);
      }
    });
  });

  describe("Permission checks", () => {
    it("Users with EVIDENCE_READ permission can view audit trail", async () => {
      // Create an IT_STAKEHOLDER user (has EVIDENCE_READ)
      const itStakeholderId = randomUUID();
      await db.user.create({
        data: {
          id: itStakeholderId,
          email: `it-stake-${randomUUID().slice(0, 8)}@test.com`,
          name: "IT Stakeholder",
          role: "IT_STAKEHOLDER",
          organizationId: testOrgId,
          assignedFrameworks: [],
          updatedAt: new Date(),
        },
      });

      const itUser = {
        id: itStakeholderId,
        email: "it@test.com",
        name: "IT Stakeholder",
        role: "IT_STAKEHOLDER" as UserRole,
        organizationId: testOrgId,
        assignedFrameworks: [],
      };

      const caller = createCaller(itUser);

      // Create an audit log entry using raw SQL
      const logId = randomUUID();
      const changes = JSON.stringify({ after: { test: true } });
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${logId}, 'VIEW_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes}::jsonb, NOW())
      `;

      // Should be able to view audit trail
      const result = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
      });

      expect(result).toBeDefined();
      expect(result.logs.length).toBeGreaterThanOrEqual(1);

      // Cleanup
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "id" = ${itStakeholderId}`;
    });

    it("Auditor can view audit trail for evidence in assigned frameworks", async () => {
      // Create an AUDITOR user
      const auditorId = randomUUID();
      await db.user.create({
        data: {
          id: auditorId,
          email: `auditor-${randomUUID().slice(0, 8)}@test.com`,
          name: "Test Auditor",
          role: "AUDITOR",
          organizationId: testOrgId,
          assignedFrameworks: [], // Empty = access all frameworks
          updatedAt: new Date(),
        },
      });

      const auditorUser = {
        id: auditorId,
        email: "auditor@test.com",
        name: "Test Auditor",
        role: "AUDITOR" as UserRole,
        organizationId: testOrgId,
        assignedFrameworks: [],
      };

      // Create audit log entry using raw SQL
      const logId = randomUUID();
      const changes = JSON.stringify({ after: { test: true } });
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "userId", "organizationId", changes, timestamp)
        VALUES (${logId}, 'VIEW_EVIDENCE', 'Evidence', ${testEvidenceId}, ${testUserId}, ${testOrgId}, ${changes}::jsonb, NOW())
      `;

      const caller = createCaller(auditorUser);

      // Should be able to view audit trail
      const result = await caller.audit.getEvidenceAuditLog({
        evidenceId: testEvidenceId,
      });

      expect(result).toBeDefined();
      expect(result.logs.length).toBeGreaterThanOrEqual(1);

      // Cleanup
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidenceId}`;
      await db.$executeRaw`DELETE FROM "User" WHERE "id" = ${auditorId}`;
    });
  });
});
