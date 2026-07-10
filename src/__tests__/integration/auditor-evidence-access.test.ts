/**
 * Auditor Evidence Access Integration Tests
 *
 * Tests for Story 3.8: View-Only Evidence Access for Auditor Role
 *
 * **Critical Test Coverage:**
 * - AC1-AC5: Auditors can only VIEW evidence, not modify
 * - AC6: UI elements hidden for auditors (tested indirectly via API)
 * - AC23: Audit logging for auditor evidence access
 *
 * @see Story 3.8: View-Only Evidence Access for Auditor Role
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data IDs (used for cleanup)
const testOrgId = randomUUID();
const auditorUserId = randomUUID();
const analystUserId = randomUUID();
const testEvidenceId = randomUUID();
let controlDomainId: string;

// Test data references
let testOrg: { id: string; name: string };
let auditorUser: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null; assignedFrameworks: string[] };
let analystUser: { id: string; email: string | null; role: UserRole; organizationId: string; name: string | null; assignedFrameworks: string[] };
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
  // Use raw SQL to clean up any existing test data first
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: testOrgId,
      name: "Test Org Auditor Evidence",
      slug: `test-org-auditor-evidence-${randomUUID().slice(0, 8)}`,
      updatedAt: new Date(),
    },
  });

  // Create auditor user (no assigned frameworks = can see all evidence)
  auditorUser = await db.user.create({
    data: {
      id: auditorUserId,
      name: "Test Auditor",
      email: `auditor-${randomUUID().slice(0, 8)}@test.com`,
      role: "BUSINESS_USER",
      organizationId: testOrg.id,
      assignedFrameworks: [], // Empty = access to all frameworks
      updatedAt: new Date(),
    },
  });

  // Create analyst user (can modify evidence)
  analystUser = await db.user.create({
    data: {
      id: analystUserId,
      name: "Test Analyst",
      email: `analyst-${randomUUID().slice(0, 8)}@test.com`,
      role: "ANALYST",
      organizationId: testOrg.id,
      assignedFrameworks: [],
      updatedAt: new Date(),
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

  // Create test evidence using raw SQL to bypass middleware
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId}, ${testOrg.id}, 'Test Evidence for Auditor Access', 'Test description', 'test.pdf', '/test/auditor.pdf', 1024, 'application/pdf', ${analystUser.id}, true, 1, ${now}, ${now})
  `;
  testEvidence = { id: testEvidenceId, title: "Test Evidence for Auditor Access" };

  // Link evidence to control domain
  await db.evidenceControlDomain.create({
    data: {
      id: randomUUID(),
      evidenceId: testEvidenceId,
      controlDomainId: controlDomainId,
    },
  });
});

afterAll(async () => {
  // Clean up test data using raw SQL to bypass middleware
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;
});

describe("Story 3.8: View-Only Evidence Access for Auditor Role", () => {
  describe("AC1-AC6: Auditor Read-Only Access", () => {
    it("Auditor CAN view evidence list (AC1)", async () => {
      const caller = createCaller(auditorUser);
      const result = await caller.evidence.list({ page: 1, pageSize: 10 });

      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    });

    it("Auditor receives FORBIDDEN error for write operations (AC5-AC6)", async () => {
      const caller = createCaller(auditorUser);

      // Attempt to create evidence should fail with FORBIDDEN
      await expect(
        caller.evidence.upload({
          title: "Auditor Upload Attempt",
          fileName: "test.pdf",
          fileContent: "dGVzdA==", // base64 encoded "test"
          mimeType: "application/pdf",
          controlDomainIds: [],
        })
      ).rejects.toThrow(TRPCError);
    });

    it("Auditor CAN view evidence details (AC2)", async () => {
      const caller = createCaller(auditorUser);
      const result = await caller.evidence.getById({ id: testEvidence.id });

      expect(result).toBeDefined();
      expect(result.id).toBe(testEvidence.id);
      expect(result.title).toBe(testEvidence.title);
    });

    it("Auditor CANNOT update evidence (AC3)", async () => {
      const caller = createCaller(auditorUser);

      await expect(
        caller.evidence.update({
          id: testEvidence.id,
          description: "Auditor tried to update",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("Auditor CANNOT delete evidence (AC4)", async () => {
      const caller = createCaller(auditorUser);

      await expect(
        caller.evidence.delete({ id: testEvidence.id })
      ).rejects.toThrow(TRPCError);
    });

    it("Auditor CANNOT update evidence tags (AC5)", async () => {
      const caller = createCaller(auditorUser);

      await expect(
        caller.evidence.updateTags({
          id: testEvidence.id,
          controlDomainIds: [],
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("AC23: Audit Logging for Auditor Access", () => {
    it("VIEW_EVIDENCE action is logged when auditor views evidence", async () => {
      const caller = createCaller(auditorUser);

      // Clear existing VIEW_EVIDENCE audit logs for this evidence
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidence.id} AND "action" = 'VIEW_EVIDENCE'`;

      // View the evidence
      await caller.evidence.getById({ id: testEvidence.id });

      // Wait a moment for async audit log
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check audit log was created
      const auditLog = await db.auditLog.findFirst({
        where: {
          entityId: testEvidence.id,
          action: "VIEW_EVIDENCE",
          userId: auditorUser.id,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.entityType).toBe("Evidence");
      expect(auditLog?.organizationId).toBe(testOrg.id);
    });
  });

  describe("GRC Analyst Permissions (Comparison)", () => {
    it("Analyst CAN update evidence", async () => {
      const caller = createCaller(analystUser);

      const result = await caller.evidence.update({
        id: testEvidence.id,
        description: "Updated by analyst",
      });

      expect(result).toBeDefined();
      expect(result.description).toBe("Updated by analyst");

      // Restore original description
      await caller.evidence.update({
        id: testEvidence.id,
        description: "Test description",
      });
    });

    it("Analyst CAN update evidence tags", async () => {
      const caller = createCaller(analystUser);

      const result = await caller.evidence.updateTags({
        id: testEvidence.id,
        controlDomainIds: [controlDomainId],
      });

      expect(result).toBeDefined();
    });
  });

  describe("AC24-AC27: Audit Log Details for Auditor Access", () => {
    it("Audit log includes user role and isAuditor flag (AC24-AC25)", async () => {
      const caller = createCaller(auditorUser);

      // Clear existing VIEW_EVIDENCE audit logs for this evidence
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidence.id} AND "action" = 'VIEW_EVIDENCE'`;

      // View the evidence
      await caller.evidence.getById({ id: testEvidence.id });

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check audit log was created with expected details
      const auditLog = await db.auditLog.findFirst({
        where: {
          entityId: testEvidence.id,
          action: "VIEW_EVIDENCE",
          userId: auditorUser.id,
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.changes).toBeDefined();

      // Parse changes if stored as JSON
      const changes = typeof auditLog?.changes === "string"
        ? JSON.parse(auditLog.changes)
        : auditLog?.changes;

      // Verify role info is captured
      expect(changes?.after?.userRole).toBe("BUSINESS_USER");
      expect(changes?.after?.isAuditor).toBe(true);
      expect(changes?.after?.timestamp).toBeDefined();
    });

    it("Audit log tracks evidence title viewed (AC26-AC27)", async () => {
      const caller = createCaller(auditorUser);

      // Clear existing VIEW_EVIDENCE audit logs
      await db.$executeRaw`DELETE FROM "AuditLog" WHERE "entityId" = ${testEvidence.id} AND "action" = 'VIEW_EVIDENCE'`;

      // View the evidence
      await caller.evidence.getById({ id: testEvidence.id });

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 300));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityId: testEvidence.id,
          action: "VIEW_EVIDENCE",
          userId: auditorUser.id,
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLog).toBeDefined();

      const changes = typeof auditLog?.changes === "string"
        ? JSON.parse(auditLog.changes)
        : auditLog?.changes;

      // Verify evidence title is captured
      expect(changes?.after?.evidenceTitle).toBe(testEvidence.title);
      expect(changes?.after?.viewedBy).toBe(auditorUser.email);
    });
  });
});
