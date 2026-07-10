/**
 * Evidence Metadata Tracking and Version History Integration Tests
 *
 * Tests for Story 3.5: Evidence Metadata Tracking and Version History
 *
 * **Critical Test Coverage:**
 * - Evidence metadata capture on upload (AC1-AC5)
 * - Version history creation on file replacement (AC6-AC12)
 * - Version history query ordering (AC11, AC18-AC21)
 * - Metadata and description updates without version creation (AC22, AC26)
 * - Soft delete cascades to versions (AC12)
 *
 * @see Story 3.5: Evidence Metadata Tracking and Version History
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole } from "@prisma/client";

// Test data
let testOrg: { id: string; name: string };
let testUser: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testControlDomain: { id: string; code: string; name: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-evidence-metadata" },
  });
  if (existingOrg) {
    // Use raw SQL to clean up properly
    await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${existingOrg.id})`;
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${existingOrg.id})`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Evidence Metadata",
      slug: "test-org-evidence-metadata",
      updatedAt: new Date(),
    },
  });

  // Create test user
  const createdUser = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User Metadata",
      email: "test-metadata@evidence-test.com",
      role: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUser = {
    id: createdUser.id,
    email: createdUser.email!,
    role: createdUser.role,
    organizationId: createdUser.organizationId,
    name: createdUser.name!,
  };

  // Get or create a control domain for tagging
  const existingDomain = await db.controlDomain.findFirst({
    where: { isActive: true },
  });

  if (existingDomain) {
    testControlDomain = existingDomain;
  } else {
    testControlDomain = await db.controlDomain.create({
      data: {
        id: randomUUID(),
        code: "TEST_DOMAIN",
        name: "Test Domain",
        description: "Test control domain for evidence metadata tests",
        sortOrder: 999,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }
});

afterAll(async () => {
  // Cleanup
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: typeof testUser) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email!,
        role: user.role as UserRole,
        organizationId: user.organizationId,
        name: user.name!,
        image: null,
        assignedFrameworks: [], // Story 3.7
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

/**
 * Create a base64 encoded test file
 */
function createTestFile(content: string = "Test file content"): string {
  return Buffer.from(content).toString("base64");
}

describe("Evidence Metadata Tracking", () => {
  describe("AC1-AC5: Evidence Metadata Capture on Upload", () => {
    it("should capture all metadata fields on upload", async () => {
      const caller = createCaller(testUser);
      const fileContent = createTestFile("Test metadata capture");
      const fileName = "test-metadata.txt";

      const evidence = await caller.evidence.upload({
        fileContent,
        fileName,
        mimeType: "text/plain",
        title: "Test Metadata Evidence",
        description: "Testing metadata capture",
        controlDomainIds: [testControlDomain.id],
      });

      // AC1: Evidence record stores filename, fileSize, mimeType, storagePath
      expect(evidence).toBeDefined();
      expect(evidence!.originalFileName).toBe(fileName);
      expect(evidence!.fileSize).toBe(Buffer.from(fileContent, "base64").length);
      expect(evidence!.fileType).toBe("text/plain");
      expect(evidence!.filePath).toBeTruthy();

      // AC2: Evidence record stores uploadedById, uploadedAt (createdAt)
      expect(evidence!.uploadedBy).toBe(testUser.id);
      expect(evidence!.createdAt).toBeInstanceOf(Date);

      // AC3: Evidence record stores description
      expect(evidence!.description).toBe("Testing metadata capture");

      // AC4: Evidence record stores tags (control domains)
      expect(evidence!.EvidenceControlDomain).toHaveLength(1);
      expect(evidence!.EvidenceControlDomain![0]!.ControlDomain.id).toBe(testControlDomain.id);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });

    it("should set currentVersion to 1 on initial upload", async () => {
      const caller = createCaller(testUser);

      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "version-test.txt",
        mimeType: "text/plain",
        title: "Version Test Evidence",
        controlDomainIds: [testControlDomain.id],
      });

      expect(evidence!.currentVersion).toBe(1);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });

    it("should handle optional description (null)", async () => {
      const caller = createCaller(testUser);

      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "no-description.txt",
        mimeType: "text/plain",
        title: "No Description Evidence",
        controlDomainIds: [testControlDomain.id],
      });

      expect(evidence!.description).toBeNull();

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });
  });

  describe("AC6-AC11: Version History on File Replacement", () => {
    let evidenceId: string;

    beforeEach(async () => {
      // Create evidence for replacement tests
      const caller = createCaller(testUser);
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile("Original content"),
        fileName: "original.txt",
        mimeType: "text/plain",
        title: "Evidence for Version Test",
        description: "Original description",
        controlDomainIds: [testControlDomain.id],
      });
      evidenceId = evidence!.id;
    });

    afterEach(async () => {
      // Cleanup
      if (evidenceId) {
        await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" = ${evidenceId}`;
        await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidenceId}`;
        await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidenceId}`;
      }
    });

    it("AC6-AC8: should create version record when file is replaced", async () => {
      const caller = createCaller(testUser);

      // Replace file
      const updated = await caller.evidence.replaceFile({
        evidenceId,
        fileContent: createTestFile("Updated content"),
        fileName: "updated.txt",
        mimeType: "text/plain",
        changeReason: "Updated to newer version with corrections",
      });

      // AC6: Replacing evidence file creates new EvidenceVersion record
      const versions = await db.evidenceVersion.findMany({
        where: { evidenceId },
        orderBy: { versionNumber: "asc" },
      });

      expect(versions).toHaveLength(1);

      // AC7: EvidenceVersion stores version details
      const version = versions[0]!;
      expect(version.versionNumber).toBe(1);
      expect(version.filename).toBe("original.txt");
      expect(version.storagePath).toBeTruthy();
      expect(version.uploadedById).toBe(testUser.id);
      expect(version.uploadedAt).toBeInstanceOf(Date);

      // AC8: Original preserved as version 1
      expect(version.versionNumber).toBe(1);

      // AC9: Current evidence points to latest version
      expect(updated.currentVersion).toBe(2);
      expect(updated.originalFileName).toBe("updated.txt");
    });

    it("AC10-AC11: should return version history in correct order (newest first)", async () => {
      const caller = createCaller(testUser);

      // Replace file twice to create multiple versions
      await caller.evidence.replaceFile({
        evidenceId,
        fileContent: createTestFile("Version 2 content"),
        fileName: "version2.txt",
        mimeType: "text/plain",
        changeReason: "First replacement - version 2",
      });

      await caller.evidence.replaceFile({
        evidenceId,
        fileContent: createTestFile("Version 3 content"),
        fileName: "version3.txt",
        mimeType: "text/plain",
        changeReason: "Second replacement - version 3",
      });

      // Get version history
      const history = await caller.evidence.getVersionHistory({ evidenceId });

      // AC11: Version history displayed in chronological order (newest first)
      expect(history.totalVersions).toBe(3);
      expect(history.currentVersion.versionNumber).toBe(3);
      expect(history.currentVersion.isCurrent).toBe(true);

      // Previous versions should be in descending order
      expect(history.versions).toHaveLength(2);
      expect(history.versions[0]!.versionNumber).toBe(2);
      expect(history.versions[1]!.versionNumber).toBe(1);
    });

    it("should store change reason in version record", async () => {
      const caller = createCaller(testUser);
      const changeReason = "Updated file with quarterly compliance data";

      await caller.evidence.replaceFile({
        evidenceId,
        fileContent: createTestFile("New content"),
        fileName: "new.txt",
        mimeType: "text/plain",
        changeReason,
      });

      // The change reason for version 1 should be "Initial version"
      const version = await db.evidenceVersion.findFirst({
        where: { evidenceId, versionNumber: 1 },
      });

      expect(version).toBeDefined();
      expect(version!.changeReason).toBe("Initial version");
    });
  });

  describe("AC12: Soft Delete Cascades to Versions", () => {
    it("should soft-delete all versions when evidence is soft-deleted", async () => {
      const caller = createCaller(testUser);

      // Create evidence
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile("Original"),
        fileName: "delete-test.txt",
        mimeType: "text/plain",
        title: "Soft Delete Test",
        controlDomainIds: [testControlDomain.id],
      });

      // Replace to create a version
      await caller.evidence.replaceFile({
        evidenceId: evidence!.id,
        fileContent: createTestFile("Updated"),
        fileName: "delete-test-v2.txt",
        mimeType: "text/plain",
        changeReason: "Creating version for delete test",
      });

      // Verify version exists
      const versionsBefore = await db.evidenceVersion.findMany({
        where: { evidenceId: evidence!.id },
      });
      expect(versionsBefore).toHaveLength(1);
      expect(versionsBefore[0]!.deletedAt).toBeNull();

      // Soft delete evidence
      await caller.evidence.delete({ id: evidence!.id });

      // Verify evidence is soft-deleted
      const deletedEvidence = await db.evidence.findUnique({
        where: { id: evidence!.id },
      });
      expect(deletedEvidence!.deletedAt).not.toBeNull();
      expect(deletedEvidence!.isActive).toBe(false);

      // AC12: All versions also soft-deleted
      const versionsAfter = await db.evidenceVersion.findMany({
        where: { evidenceId: evidence!.id },
      });
      expect(versionsAfter).toHaveLength(1);
      expect(versionsAfter[0]!.deletedAt).not.toBeNull();

      // Cleanup (hard delete)
      await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });
  });

  describe("AC22, AC26: Update Description Without Version Creation", () => {
    it("should update description without creating new version", async () => {
      const caller = createCaller(testUser);

      // Create evidence
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "description-test.txt",
        mimeType: "text/plain",
        title: "Description Update Test",
        description: "Original description",
        controlDomainIds: [testControlDomain.id],
      });

      // Update description
      await caller.evidence.update({
        id: evidence!.id,
        description: "Updated description",
      });

      // Verify description updated
      const updated = await db.evidence.findUnique({
        where: { id: evidence!.id },
      });
      expect(updated!.description).toBe("Updated description");

      // Verify no version was created (AC26)
      const versions = await db.evidenceVersion.findMany({
        where: { evidenceId: evidence!.id },
      });
      expect(versions).toHaveLength(0);

      // Version should still be 1
      expect(updated!.currentVersion).toBe(1);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });

    it("should update tags without creating new version", async () => {
      const caller = createCaller(testUser);

      // Create evidence
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "tags-test.txt",
        mimeType: "text/plain",
        title: "Tags Update Test",
        controlDomainIds: [testControlDomain.id],
      });

      // Get another domain if available
      const anotherDomain = await db.controlDomain.findFirst({
        where: {
          isActive: true,
          id: { not: testControlDomain.id },
        },
      });

      if (anotherDomain) {
        // Update tags
        await caller.evidence.updateTags({
          id: evidence!.id,
          controlDomainIds: [testControlDomain.id, anotherDomain.id],
        });

        // Verify tags updated
        const updatedTags = await db.evidenceControlDomain.findMany({
          where: { evidenceId: evidence!.id },
        });
        expect(updatedTags).toHaveLength(2);

        // Verify no version was created (AC26)
        const versions = await db.evidenceVersion.findMany({
          where: { evidenceId: evidence!.id },
        });
        expect(versions).toHaveLength(0);
      }

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });
  });

  describe("Restore Soft-Deleted Evidence", () => {
    it("should restore evidence and all versions", async () => {
      const caller = createCaller(testUser);

      // Create evidence with version
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile("Original"),
        fileName: "restore-test.txt",
        mimeType: "text/plain",
        title: "Restore Test",
        controlDomainIds: [testControlDomain.id],
      });

      await caller.evidence.replaceFile({
        evidenceId: evidence!.id,
        fileContent: createTestFile("Updated"),
        fileName: "restore-test-v2.txt",
        mimeType: "text/plain",
        changeReason: "Creating version for restore test",
      });

      // Soft delete
      await caller.evidence.delete({ id: evidence!.id });

      // Verify soft-deleted
      let deletedEvidence = await db.evidence.findUnique({
        where: { id: evidence!.id },
      });
      expect(deletedEvidence!.deletedAt).not.toBeNull();

      // Restore
      await caller.evidence.restore({ id: evidence!.id });

      // Verify restored
      const restoredEvidence = await db.evidence.findUnique({
        where: { id: evidence!.id },
      });
      expect(restoredEvidence!.deletedAt).toBeNull();
      expect(restoredEvidence!.isActive).toBe(true);

      // Verify versions restored
      const versions = await db.evidenceVersion.findMany({
        where: { evidenceId: evidence!.id },
      });
      expect(versions).toHaveLength(1);
      expect(versions[0]!.deletedAt).toBeNull();

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });
  });

  describe("Version History Query", () => {
    it("should include uploader information in version history", async () => {
      const caller = createCaller(testUser);

      // Create evidence
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "uploader-test.txt",
        mimeType: "text/plain",
        title: "Uploader Test",
        controlDomainIds: [testControlDomain.id],
      });

      // Replace to create version
      await caller.evidence.replaceFile({
        evidenceId: evidence!.id,
        fileContent: createTestFile("New"),
        fileName: "uploader-test-v2.txt",
        mimeType: "text/plain",
        changeReason: "Testing uploader info in history",
      });

      // Get version history
      const history = await caller.evidence.getVersionHistory({
        evidenceId: evidence!.id,
      });

      // Current version should have uploader info
      expect(history.currentVersion.uploader).toBeDefined();
      expect(history.currentVersion.uploader!.id).toBe(testUser.id);
      expect(history.currentVersion.uploader!.name).toBe(testUser.name);

      // Previous version should also have uploader info
      expect(history.versions[0]!.uploader).toBeDefined();
      expect(history.versions[0]!.uploader!.id).toBe(testUser.id);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });

    it("should return correct total version count", async () => {
      const caller = createCaller(testUser);

      // Create evidence
      const evidence = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "count-test.txt",
        mimeType: "text/plain",
        title: "Count Test",
        controlDomainIds: [testControlDomain.id],
      });

      // Initially should have 1 version (current only)
      let history = await caller.evidence.getVersionHistory({
        evidenceId: evidence!.id,
      });
      expect(history.totalVersions).toBe(1);

      // Replace twice
      await caller.evidence.replaceFile({
        evidenceId: evidence!.id,
        fileContent: createTestFile("V2"),
        fileName: "count-test-v2.txt",
        mimeType: "text/plain",
        changeReason: "First replacement",
      });

      await caller.evidence.replaceFile({
        evidenceId: evidence!.id,
        fileContent: createTestFile("V3"),
        fileName: "count-test-v3.txt",
        mimeType: "text/plain",
        changeReason: "Second replacement",
      });

      // Should have 3 versions total
      history = await caller.evidence.getVersionHistory({
        evidenceId: evidence!.id,
      });
      expect(history.totalVersions).toBe(3);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceVersion" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" = ${evidence!.id}`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence!.id}`;
    });
  });

  describe("Evidence List Excludes Soft-Deleted", () => {
    it("should not include soft-deleted evidence in list", async () => {
      const caller = createCaller(testUser);

      // Create two evidence items
      const evidence1 = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "active.txt",
        mimeType: "text/plain",
        title: "Active Evidence",
        controlDomainIds: [testControlDomain.id],
      });

      const evidence2 = await caller.evidence.upload({
        fileContent: createTestFile(),
        fileName: "deleted.txt",
        mimeType: "text/plain",
        title: "To Be Deleted Evidence",
        controlDomainIds: [testControlDomain.id],
      });

      // Soft delete one
      await caller.evidence.delete({ id: evidence2!.id });

      // List should only show active evidence
      const list = await caller.evidence.list({ page: 1, pageSize: 100 });

      const activeIds = list.items.map((e) => e.id);
      expect(activeIds).toContain(evidence1!.id);
      expect(activeIds).not.toContain(evidence2!.id);

      // Cleanup
      await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (${evidence1!.id}, ${evidence2!.id})`;
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id IN (${evidence1!.id}, ${evidence2!.id})`;
    });
  });
});
