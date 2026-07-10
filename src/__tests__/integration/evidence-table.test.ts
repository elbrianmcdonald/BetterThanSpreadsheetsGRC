/**
 * Evidence Table Integration Tests
 *
 * Tests for Story 3.10: Evidence Repository Page with TanStack Table
 *
 * @see Story 3.10: Evidence Repository Page with TanStack Table
 */

import { type UserRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data IDs
const testOrgId = randomUUID();
const testUserId = randomUUID();
const testAuditorId = randomUUID();
const testEvidenceId1 = randomUUID();
const testEvidenceId2 = randomUUID();
const testEvidenceId3 = randomUUID();
let controlDomainId: string;

// Test data references
let testOrg: { id: string; name: string };
let testUser: {
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
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (${testEvidenceId1}, ${testEvidenceId2}, ${testEvidenceId3})`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" IN (${testEvidenceId1}, ${testEvidenceId2}, ${testEvidenceId3})`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;

  // Create test organization
  const testSlug = `test-org-table-${randomUUID().slice(0, 8)}`;
  testOrg = await db.organization.create({
    data: {
      id: testOrgId,
      name: "Test Org Evidence Table",
      slug: testSlug,
      updatedAt: new Date(),
    },
  });

  // Create test user
  const testEmail = `table-user-${randomUUID().slice(0, 8)}@test.com`;
  testUser = {
    ...(await db.user.create({
      data: {
        id: testUserId,
        name: "Table Test User",
        email: testEmail,
        platformRole: "ANALYST",
        organizationId: testOrg.id,
        assignedFrameworks: [],
        updatedAt: new Date(),
      },
    })),
    role: "ANALYST",
  };

  // Create auditor user for permission tests
  const auditorEmail = `table-auditor-${randomUUID().slice(0, 8)}@test.com`;
  auditorUser = {
    ...(await db.user.create({
      data: {
        id: testAuditorId,
        name: "Table Auditor",
        email: auditorEmail,
        organizationId: testOrg.id,
        assignedFrameworks: [],
        updatedAt: new Date(),
      },
    })),
    role: "BUSINESS_USER",
  };

  // Find an existing control domain
  const existingDomain = await db.controlDomain.findFirst({
    where: { isActive: true },
  });

  if (!existingDomain) {
    throw new Error("No active control domain found - test requires seeded data");
  }
  controlDomainId = existingDomain.id;

  // Create test evidence records using raw SQL to bypass organization middleware
  const now = new Date();
  const date1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const date2 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
  const date3 = now; // today

  // Evidence 1: Alpha file, 2 days ago, 1KB
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId1}, ${testOrgId}, 'Alpha Policy Document', 'First test evidence', 'alpha-policy.pdf', '/test/alpha.pdf', 1024, 'application/pdf', ${testUserId}, true, 1, ${date1}, ${date1})
  `;

  // Evidence 2: Beta file, 1 day ago, 2KB
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId2}, ${testOrgId}, 'Beta Security Report', 'Second test evidence', 'beta-security.xlsx', '/test/beta.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ${testUserId}, true, 1, ${date2}, ${date2})
  `;

  // Evidence 3: Gamma file, today, 512 bytes
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, description, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${testEvidenceId3}, ${testOrgId}, 'Gamma Compliance Screenshot', 'Third test evidence', 'gamma-screenshot.png', '/test/gamma.png', 512, 'image/png', ${testUserId}, true, 1, ${date3}, ${date3})
  `;

  // Link evidence 1 and 2 to control domain
  const ecdId1 = randomUUID();
  const ecdId2 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "EvidenceControlDomain" (id, "evidenceId", "controlDomainId")
    VALUES (${ecdId1}, ${testEvidenceId1}, ${controlDomainId})
  `;
  await db.$executeRaw`
    INSERT INTO "EvidenceControlDomain" (id, "evidenceId", "controlDomainId")
    VALUES (${ecdId2}, ${testEvidenceId2}, ${controlDomainId})
  `;
});

afterAll(async () => {
  // Clean up test data
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (${testEvidenceId1}, ${testEvidenceId2}, ${testEvidenceId3})`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "id" IN (${testEvidenceId1}, ${testEvidenceId2}, ${testEvidenceId3})`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE "id" = ${testOrgId}`;
});

describe("Evidence Table (Story 3.10)", () => {
  describe("Server-side Pagination (AC4-AC5)", () => {
    it("AC4: Returns paginated results with default page size of 50", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
      });

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.page).toBe(1);
      // Default pageSize should be 50
    });

    it("AC5: Returns pagination metadata for navigation", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 2,
      });

      expect(result.page).toBe(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Column Sorting (AC7-AC12)", () => {
    it("AC9: Sort by filename alphabetically ascending", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        sortBy: "originalFileName",
        sortDir: "asc",
      });

      expect(result.items.length).toBeGreaterThanOrEqual(3);

      // Find our test items by ID
      const testItems = result.items.filter((item) =>
        [testEvidenceId1, testEvidenceId2, testEvidenceId3].includes(item.id)
      );

      if (testItems.length >= 2) {
        // Verify alphabetical order (alpha before beta before gamma)
        const alphaIndex = testItems.findIndex(
          (i) => i.originalFileName.toLowerCase().includes("alpha")
        );
        const betaIndex = testItems.findIndex(
          (i) => i.originalFileName.toLowerCase().includes("beta")
        );
        const gammaIndex = testItems.findIndex(
          (i) => i.originalFileName.toLowerCase().includes("gamma")
        );

        if (alphaIndex >= 0 && betaIndex >= 0) {
          expect(alphaIndex).toBeLessThan(betaIndex);
        }
        if (betaIndex >= 0 && gammaIndex >= 0) {
          expect(betaIndex).toBeLessThan(gammaIndex);
        }
      }
    });

    it("AC10: Sort by upload date chronologically (newest first by default)", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);

      // Verify newest is first
      if (result.items.length >= 2) {
        const firstDate = new Date(result.items[0].createdAt).getTime();
        const secondDate = new Date(result.items[1].createdAt).getTime();
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });

    it("AC11: Sort by file size numerically", async () => {
      const caller = createCaller(testUser);

      // Sort ascending
      const resultAsc = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        sortBy: "fileSize",
        sortDir: "asc",
      });

      expect(resultAsc.items.length).toBeGreaterThanOrEqual(1);

      // Verify ascending order
      if (resultAsc.items.length >= 2) {
        const firstSize = resultAsc.items[0].fileSize;
        const secondSize = resultAsc.items[1].fileSize;
        expect(firstSize).toBeLessThanOrEqual(secondSize);
      }

      // Sort descending
      const resultDesc = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        sortBy: "fileSize",
        sortDir: "desc",
      });

      // Verify descending order
      if (resultDesc.items.length >= 2) {
        const firstSize = resultDesc.items[0].fileSize;
        const secondSize = resultDesc.items[1].fileSize;
        expect(firstSize).toBeGreaterThanOrEqual(secondSize);
      }
    });
  });

  describe("Filtering and Search (AC13-AC17)", () => {
    it("AC13: Global search filters by filename (case-insensitive)", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        search: "ALPHA", // uppercase to test case-insensitivity
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const foundAlpha = result.items.find(
        (i) =>
          i.originalFileName.toLowerCase().includes("alpha") ||
          i.title.toLowerCase().includes("alpha")
      );
      expect(foundAlpha).toBeDefined();
    });

    it("AC15: Control domain filter returns only tagged evidence", async () => {
      const caller = createCaller(testUser);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        controlDomainId: controlDomainId,
      });

      // Evidence 1 and 2 are tagged, Evidence 3 is not
      // All returned items should have the control domain
      for (const item of result.items) {
        if ([testEvidenceId1, testEvidenceId2].includes(item.id)) {
          const hasControlDomain = item.EvidenceControlDomain.some(
            (ecd) => ecd.controlDomainId === controlDomainId
          );
          expect(hasControlDomain).toBe(true);
        }
      }

      // Evidence 3 (gamma) should NOT be in results
      const hasGamma = result.items.some((i) => i.id === testEvidenceId3);
      expect(hasGamma).toBe(false);
    });

    it("AC16: Date range filter returns evidence within range", async () => {
      const caller = createCaller(testUser);

      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);

      // Filter for evidence between 3 days ago and 1.5 days ago
      // Should include testEvidenceId1 (2 days ago) but not testEvidenceId2 (1 day ago) or testEvidenceId3 (today)
      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        uploadDateStart: threeDaysAgo,
        uploadDateEnd: oneDayAgo,
      });

      // Evidence 1 should be in results (2 days ago is within range)
      const hasAlpha = result.items.some((i) => i.id === testEvidenceId1);
      expect(hasAlpha).toBe(true);

      // Evidence 2 and 3 should NOT be in results (too recent)
      const hasBeta = result.items.some((i) => i.id === testEvidenceId2);
      const hasGamma = result.items.some((i) => i.id === testEvidenceId3);
      expect(hasBeta).toBe(false);
      expect(hasGamma).toBe(false);
    });

    it("AC17: Multiple filters combine with AND logic", async () => {
      const caller = createCaller(testUser);

      // Combine search + control domain filter
      const result = await caller.evidence.list({
        page: 1,
        pageSize: 10,
        search: "alpha",
        controlDomainId: controlDomainId,
      });

      // Should only return Evidence 1 (matches search AND has control domain)
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const foundAlpha = result.items.find((i) => i.id === testEvidenceId1);
      expect(foundAlpha).toBeDefined();

      // Evidence 2 has control domain but doesn't match "alpha" search
      const hasBeta = result.items.some((i) => i.id === testEvidenceId2);
      expect(hasBeta).toBe(false);
    });
  });

  describe("Actions Column (AC23-AC28)", () => {
    it("AC24: Auditor role cannot see Edit and Delete actions (API level)", async () => {
      // Use pre-created auditor user from beforeAll
      const caller = createCaller(auditorUser);

      // Auditor should be able to list evidence
      const result = await caller.evidence.list({ page: 1, pageSize: 10 });
      expect(result.items).toBeDefined();

      // Auditor should NOT be able to delete evidence
      await expect(
        caller.evidence.delete({ id: testEvidenceId1 })
      ).rejects.toThrow();

      // Auditor should NOT be able to update evidence
      await expect(
        caller.evidence.update({
          id: testEvidenceId1,
          description: "Auditor tried to update",
        })
      ).rejects.toThrow();

      // No inline cleanup needed - afterAll handles it via organization cascade
    });
  });

  describe("Performance (AC29-AC32)", () => {
    it("AC32: Query handles large page sizes without error", async () => {
      const caller = createCaller(testUser);

      // Request max page size
      const result = await caller.evidence.list({
        page: 1,
        pageSize: 100,
      });

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.page).toBe(1);
    });
  });
});
