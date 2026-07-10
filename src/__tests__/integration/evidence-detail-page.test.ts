/**
 * Evidence Detail Page Integration Tests
 *
 * Tests for Story 3.11: Evidence Detail Page with Framework Mappings
 *
 * @see Story 3.11: Evidence Detail Page with Framework Mappings
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data IDs
const testOrgId = randomUUID();
const testOrgId2 = randomUUID();
const testUserId = randomUUID();
const testUserId2 = randomUUID();
const testAuditorId = randomUUID();
const testEvidenceId = randomUUID();
let controlDomainId: string;

// Test data references
let testOrg: { id: string; name: string };
let testOrg2: { id: string; name: string };
let testUser: {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string;
  name: string | null;
  assignedFrameworks: string[];
};
let testUser2: {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string;
  name: string | null;
  assignedFrameworks: string[];
};
let auditorUser: {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string;
  name: string | null;
  assignedFrameworks: string[];
};

/**
 * Create a tRPC caller with mocked session context
 */
function createCaller(user: {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string;
  name: string | null;
  assignedFrameworks: string[];
}) {
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
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" IN (${testOrgId}, ${testOrgId2})`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" IN (${testOrgId}, ${testOrgId2})`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" IN (${testOrgId}, ${testOrgId2})`;

  // Create test organization 1
  const testSlug1 = `test-org-detail-${randomUUID().slice(0, 8)}`;
  testOrg = await db.organization.create({
    data: {
      id: testOrgId,
      name: "Test Org Evidence Detail",
      slug: testSlug1,
      updatedAt: new Date(),
    },
  });

  // Create test organization 2 (for cross-org testing)
  const testSlug2 = `test-org-other-${randomUUID().slice(0, 8)}`;
  testOrg2 = await db.organization.create({
    data: {
      id: testOrgId2,
      name: "Test Org Other",
      slug: testSlug2,
      updatedAt: new Date(),
    },
  });

  // Create test user (GRC Analyst)
  const testEmail = `detail-user-${randomUUID().slice(0, 8)}@test.com`;
  testUser = await db.user.create({
    data: {
      id: testUserId,
      name: "Detail Test User",
      email: testEmail,
      role: "ANALYST",
      organizationId: testOrg.id,
      assignedFrameworks: [],
      updatedAt: new Date(),
    },
  });

  // Create user in different organization
  const testEmail2 = `other-user-${randomUUID().slice(0, 8)}@test.com`;
  testUser2 = await db.user.create({
    data: {
      id: testUserId2,
      name: "Other Org User",
      email: testEmail2,
      role: "ANALYST",
      organizationId: testOrg2.id,
      assignedFrameworks: [],
      updatedAt: new Date(),
    },
  });

  // Create auditor user
  const auditorEmail = `auditor-detail-${randomUUID().slice(0, 8)}@test.com`;
  auditorUser = await db.user.create({
    data: {
      id: testAuditorId,
      name: "Detail Auditor",
      email: auditorEmail,
      role: "BUSINESS_USER",
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

  // Create test evidence record using raw SQL
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId}, ${testOrgId}, 'Detail Test Evidence', 'Evidence for detail page testing', 'detail-test.pdf', '/test/detail-test.pdf', 2048, 'application/pdf', ${testUserId}, true, 1, ${now}, ${now})
  `;

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
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" IN (${testOrgId}, ${testOrgId2})`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" = ${testEvidenceId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" IN (${testOrgId}, ${testOrgId2})`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" IN (${testOrgId}, ${testOrgId2})`;
});

describe("Evidence Detail Page (Story 3.11)", () => {
  describe("Load Evidence by ID (AC1, AC3, AC6-AC9)", () => {
    it("AC1, AC6-AC9: Returns complete evidence data with metadata", async () => {
      const caller = createCaller(testUser);

      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence).toBeDefined();
      expect(evidence.id).toBe(testEvidenceId);
      expect(evidence.title).toBe("Detail Test Evidence");
      expect(evidence.description).toBe("Evidence for detail page testing");
      expect(evidence.originalFileName).toBe("detail-test.pdf");
      expect(evidence.fileSize).toBe(2048);
      expect(evidence.fileType).toBe("application/pdf");
      expect(evidence.filePath).toBe("/test/detail-test.pdf");
      expect(evidence.isActive).toBe(true);
      expect(evidence.currentVersion).toBe(1);
    });

    it("AC9: Returns control domain tags", async () => {
      const caller = createCaller(testUser);

      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence.EvidenceControlDomain).toBeDefined();
      expect(evidence.EvidenceControlDomain.length).toBeGreaterThanOrEqual(1);

      const hasControlDomain = evidence.EvidenceControlDomain.some(
        (ecd) => ecd.controlDomainId === controlDomainId
      );
      expect(hasControlDomain).toBe(true);
    });

    it("AC7: Returns uploader information", async () => {
      const caller = createCaller(testUser);

      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence.User).toBeDefined();
      expect(evidence.User?.id).toBe(testUserId);
      expect(evidence.User?.name).toBe("Detail Test User");
    });
  });

  describe("Evidence Not Found (AC6: 404 handling)", () => {
    it("Returns NOT_FOUND error for non-existent evidence ID", async () => {
      const caller = createCaller(testUser);
      const nonExistentId = randomUUID();

      await expect(caller.evidence.getById({ id: nonExistentId })).rejects.toThrow(
        "Evidence not found"
      );
    });
  });

  describe("Cross-Organization Access (Security)", () => {
    it("Returns NOT_FOUND for evidence from different organization", async () => {
      // User from org2 tries to access evidence from org1
      const caller = createCaller(testUser2);

      await expect(
        caller.evidence.getById({ id: testEvidenceId })
      ).rejects.toThrow("Evidence not found");
    });
  });

  describe("Role-Based Permissions (AC12, AC34)", () => {
    it("AC12, AC34: AUDITOR role can view evidence but cannot edit", async () => {
      const caller = createCaller(auditorUser);

      // Auditor should be able to view evidence
      const evidence = await caller.evidence.getById({ id: testEvidenceId });
      expect(evidence).toBeDefined();
      expect(evidence.id).toBe(testEvidenceId);

      // Auditor should NOT be able to update evidence
      await expect(
        caller.evidence.update({
          id: testEvidenceId,
          description: "Auditor tried to update",
        })
      ).rejects.toThrow();
    });

    it("AC34: AUDITOR role cannot delete evidence", async () => {
      const caller = createCaller(auditorUser);

      await expect(
        caller.evidence.delete({ id: testEvidenceId })
      ).rejects.toThrow();
    });

    it("GRC_ANALYST role can update evidence", async () => {
      const caller = createCaller(testUser);

      // Should be able to update
      const updated = await caller.evidence.update({
        id: testEvidenceId,
        description: "Updated by analyst",
      });

      expect(updated).toBeDefined();
      expect(updated.description).toBe("Updated by analyst");

      // Restore original description
      await caller.evidence.update({
        id: testEvidenceId,
        description: "Evidence for detail page testing",
      });
    });
  });

  describe("Evidence Download Access (AC11, AC35)", () => {
    it("AC11: All authorized users can access evidence for download", async () => {
      // Test that getById returns filePath for download URL construction
      const caller = createCaller(testUser);
      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence.filePath).toBeDefined();
      expect(evidence.filePath).toBe("/test/detail-test.pdf");
    });

    it("AC35: Auditor can access evidence download", async () => {
      const caller = createCaller(auditorUser);
      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence.filePath).toBeDefined();
      expect(evidence.filePath).toBe("/test/detail-test.pdf");
    });
  });

  describe("Framework Mappings Access (AC13-AC17)", () => {
    it("AC13-AC14: Returns control domain data for framework mapping display", async () => {
      const caller = createCaller(testUser);
      const evidence = await caller.evidence.getById({ id: testEvidenceId });

      expect(evidence.EvidenceControlDomain).toBeDefined();
      expect(Array.isArray(evidence.EvidenceControlDomain)).toBe(true);

      // Each mapping should include the control domain details
      for (const mapping of evidence.EvidenceControlDomain) {
        expect(mapping.controlDomainId).toBeDefined();
        expect(mapping.ControlDomain).toBeDefined();
        expect(mapping.ControlDomain.code).toBeDefined();
        expect(mapping.ControlDomain.name).toBeDefined();
      }
    });
  });

  describe("Soft Delete Evidence (AC33)", () => {
    it("AC33: GRC_ANALYST can soft delete evidence", async () => {
      const caller = createCaller(testUser);

      // Delete (soft delete)
      await caller.evidence.delete({ id: testEvidenceId });

      // Verify it's soft deleted
      const deletedEvidence = await db.evidence.findUnique({
        where: { id: testEvidenceId },
      });
      expect(deletedEvidence?.isActive).toBe(false);
      expect(deletedEvidence?.deletedAt).toBeDefined();

      // Restore for other tests
      await db.$executeRaw`
        UPDATE "Evidence" SET "isActive" = true, "deletedAt" = NULL WHERE "id" = ${testEvidenceId}
      `;
    });
  });

  describe("Deleted Evidence Access", () => {
    it("Soft deleted evidence is not returned in normal queries", async () => {
      const caller = createCaller(testUser);

      // Soft delete
      await caller.evidence.delete({ id: testEvidenceId });

      // Try to get by ID - should not find soft deleted evidence
      await expect(
        caller.evidence.getById({ id: testEvidenceId })
      ).rejects.toThrow("Evidence not found");

      // Restore for other tests
      await db.$executeRaw`
        UPDATE "Evidence" SET "isActive" = true, "deletedAt" = NULL WHERE "id" = ${testEvidenceId}
      `;
    });
  });
});
