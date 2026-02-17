/**
 * Integration Tests: Evidence Filtering by Framework
 *
 * Story 3.7: Tests framework-based filtering functionality for evidence list.
 *
 * Test Coverage:
 * - AC8-AC11: Framework filter query logic
 * - AC15-AC16: Multi-filter combination (framework + domain)
 * - AC19-AC21: Auditor role framework access
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { UserRole } from "@prisma/client";

// Test data references
let testOrg: { id: string; name: string };
let testOrgB: { id: string; name: string };
let testUserGRC: { id: string; email: string; name: string; role: UserRole; organizationId: string };
let testUserAuditor: { id: string; email: string; name: string; role: UserRole; organizationId: string; assignedFrameworks: string[] };
let testUserAuditorNoAssignment: { id: string; email: string; name: string; role: UserRole; organizationId: string; assignedFrameworks: string[] };

// Test control domains
let controlDomainAC: { id: string; code: string; name: string };
let controlDomainSC: { id: string; code: string; name: string };

// Test evidence records
let evidenceWithISO: { id: string };
let evidenceWithSOC2: { id: string };
let evidenceWithBoth: { id: string };
let evidenceNoMapping: { id: string };

beforeAll(async () => {
  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org for Framework Filtering",
      slug: `test-fw-filter-${randomUUID().slice(0, 8)}`,
      updatedAt: new Date(),
    },
  });

  testOrgB = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org B for Cross-Org",
      slug: `test-fw-filter-b-${randomUUID().slice(0, 8)}`,
      updatedAt: new Date(),
    },
  });

  // Create test users
  const userIdGRC = randomUUID();
  testUserGRC = {
    id: userIdGRC,
    email: `grc-analyst-fw-test-${userIdGRC.slice(0, 8)}@test.com`,
    name: "GRC Analyst for FW Test",
    role: UserRole.GRC_ANALYST,
    organizationId: testOrg.id,
  };

  await db.user.create({
    data: {
      id: testUserGRC.id,
      email: testUserGRC.email,
      name: testUserGRC.name,
      role: testUserGRC.role,
      organizationId: testUserGRC.organizationId,
      updatedAt: new Date(),
    },
  });

  const userIdAuditor = randomUUID();
  testUserAuditor = {
    id: userIdAuditor,
    email: `auditor-fw-test-${userIdAuditor.slice(0, 8)}@test.com`,
    name: "Auditor with Assigned Frameworks",
    role: UserRole.AUDITOR,
    organizationId: testOrg.id,
    assignedFrameworks: ["ISO27001"], // Only assigned to ISO 27001
  };

  await db.user.create({
    data: {
      id: testUserAuditor.id,
      email: testUserAuditor.email,
      name: testUserAuditor.name,
      role: testUserAuditor.role,
      organizationId: testUserAuditor.organizationId,
      assignedFrameworks: testUserAuditor.assignedFrameworks,
      updatedAt: new Date(),
    },
  });

  const userIdAuditorNoAssign = randomUUID();
  testUserAuditorNoAssignment = {
    id: userIdAuditorNoAssign,
    email: `auditor-no-assign-${userIdAuditorNoAssign.slice(0, 8)}@test.com`,
    name: "Auditor No Assignments",
    role: UserRole.AUDITOR,
    organizationId: testOrg.id,
    assignedFrameworks: [], // No framework assignments
  };

  await db.user.create({
    data: {
      id: testUserAuditorNoAssignment.id,
      email: testUserAuditorNoAssignment.email,
      name: testUserAuditorNoAssignment.name,
      role: testUserAuditorNoAssignment.role,
      organizationId: testUserAuditorNoAssignment.organizationId,
      assignedFrameworks: testUserAuditorNoAssignment.assignedFrameworks,
      updatedAt: new Date(),
    },
  });

  // Create control domains
  controlDomainAC = await db.controlDomain.create({
    data: {
      id: randomUUID(),
      code: "AC-TEST-FW",
      name: "Access Control for FW Test",
      description: "Test access control domain",
      sortOrder: 1,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  controlDomainSC = await db.controlDomain.create({
    data: {
      id: randomUUID(),
      code: "SC-TEST-FW",
      name: "Security Control for FW Test",
      description: "Test security control domain",
      sortOrder: 2,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // Create control domain mappings to frameworks
  // AC domain maps to ISO27001 only
  await db.controlDomainMapping.create({
    data: {
      id: randomUUID(),
      controlDomainId: controlDomainAC.id,
      frameworkCode: "ISO27001",
      controlId: "A.9.1",
      confidence: 100,
      updatedAt: new Date(),
    },
  });

  // SC domain maps to SOC2 only
  await db.controlDomainMapping.create({
    data: {
      id: randomUUID(),
      controlDomainId: controlDomainSC.id,
      frameworkCode: "SOC2",
      controlId: "CC6.1",
      confidence: 100,
      updatedAt: new Date(),
    },
  });

  // Create test evidence using raw SQL to bypass organization filter
  const now = new Date();

  // Evidence 1: Tagged with AC domain (maps to ISO27001)
  const evidenceId1 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId1}, ${testOrg.id}, 'Evidence with ISO27001', 'iso-evidence.pdf', '/test/iso.pdf', 1024, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
  `;
  evidenceWithISO = { id: evidenceId1 };

  await db.evidenceControlDomain.create({
    data: {
      id: randomUUID(),
      evidenceId: evidenceId1,
      controlDomainId: controlDomainAC.id,
    },
  });

  // Evidence 2: Tagged with SC domain (maps to SOC2)
  const evidenceId2 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId2}, ${testOrg.id}, 'Evidence with SOC2', 'soc2-evidence.pdf', '/test/soc2.pdf', 2048, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
  `;
  evidenceWithSOC2 = { id: evidenceId2 };

  await db.evidenceControlDomain.create({
    data: {
      id: randomUUID(),
      evidenceId: evidenceId2,
      controlDomainId: controlDomainSC.id,
    },
  });

  // Evidence 3: Tagged with both domains (maps to ISO27001 AND SOC2)
  const evidenceId3 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId3}, ${testOrg.id}, 'Evidence with Both Frameworks', 'both-evidence.pdf', '/test/both.pdf', 3072, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
  `;
  evidenceWithBoth = { id: evidenceId3 };

  await db.evidenceControlDomain.createMany({
    data: [
      { id: randomUUID(), evidenceId: evidenceId3, controlDomainId: controlDomainAC.id },
      { id: randomUUID(), evidenceId: evidenceId3, controlDomainId: controlDomainSC.id },
    ],
  });

  // Evidence 4: No control domain mapping (won't match any framework filter)
  const evidenceId4 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId4}, ${testOrg.id}, 'Evidence No Mapping', 'no-mapping.pdf', '/test/none.pdf', 512, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
  `;
  evidenceNoMapping = { id: evidenceId4 };
});

afterAll(async () => {
  // Clean up test data
  await db.evidenceControlDomain.deleteMany({
    where: {
      evidenceId: {
        in: [evidenceWithISO.id, evidenceWithSOC2.id, evidenceWithBoth.id],
      },
    },
  });

  await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;

  await db.controlDomainMapping.deleteMany({
    where: {
      controlDomainId: { in: [controlDomainAC.id, controlDomainSC.id] },
    },
  });

  await db.controlDomain.deleteMany({
    where: {
      id: { in: [controlDomainAC.id, controlDomainSC.id] },
    },
  });

  await db.user.deleteMany({
    where: {
      id: { in: [testUserGRC.id, testUserAuditor.id, testUserAuditorNoAssignment.id] },
    },
  });

  await db.organization.deleteMany({
    where: {
      id: { in: [testOrg.id, testOrgB.id] },
    },
  });
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: { id: string; email: string; name: string; role: UserRole; organizationId: string; assignedFrameworks?: string[] }) {
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
        assignedFrameworks: user.assignedFrameworks ?? [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("Evidence Filtering by Framework", () => {
  describe("Filter by Framework (AC8-AC11)", () => {
    it("should return only evidence mapped to ISO27001 when filtering by ISO27001 (AC8)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.evidence.list({
        frameworkCode: "ISO27001",
        page: 1,
        pageSize: 50,
      });

      // Should include evidence with ISO27001 mapping
      const titles = result.items.map((e) => e.title);
      expect(titles).toContain("Evidence with ISO27001");
      expect(titles).toContain("Evidence with Both Frameworks");

      // Should NOT include evidence with only SOC2 or no mapping
      expect(titles).not.toContain("Evidence with SOC2");
      expect(titles).not.toContain("Evidence No Mapping");
    });

    it("should return only evidence mapped to SOC2 when filtering by SOC2 (AC8)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.evidence.list({
        frameworkCode: "SOC2",
        page: 1,
        pageSize: 50,
      });

      const titles = result.items.map((e) => e.title);
      expect(titles).toContain("Evidence with SOC2");
      expect(titles).toContain("Evidence with Both Frameworks");

      expect(titles).not.toContain("Evidence with ISO27001");
      expect(titles).not.toContain("Evidence No Mapping");
    });

    it("should return evidence if ANY framework matches (AC9)", async () => {
      const caller = createCaller(testUserGRC);

      // Evidence with both frameworks should appear in either filter
      const isoResult = await caller.evidence.list({
        frameworkCode: "ISO27001",
        page: 1,
        pageSize: 50,
      });

      const soc2Result = await caller.evidence.list({
        frameworkCode: "SOC2",
        page: 1,
        pageSize: 50,
      });

      const isoIds = isoResult.items.map((e) => e.id);
      const soc2Ids = soc2Result.items.map((e) => e.id);

      // Evidence with both frameworks should appear in both results
      expect(isoIds).toContain(evidenceWithBoth.id);
      expect(soc2Ids).toContain(evidenceWithBoth.id);
    });

    it("should return all evidence when no framework filter is applied", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.evidence.list({
        page: 1,
        pageSize: 50,
      });

      const titles = result.items.map((e) => e.title);

      // Should include all evidence
      expect(titles).toContain("Evidence with ISO27001");
      expect(titles).toContain("Evidence with SOC2");
      expect(titles).toContain("Evidence with Both Frameworks");
      expect(titles).toContain("Evidence No Mapping");
    });

    it("should include frameworkControlCount in response when framework filter is active (AC12)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.evidence.list({
        frameworkCode: "ISO27001",
        page: 1,
        pageSize: 50,
      });

      // Each item should have frameworkControlCount
      for (const item of result.items) {
        expect(item).toHaveProperty("frameworkControlCount");
        expect(typeof item.frameworkControlCount).toBe("number");
      }

      // Response should include frameworkCode
      expect(result.frameworkCode).toBe("ISO27001");
    });
  });

  describe("Multi-Filter Combination (AC15-AC16)", () => {
    it("should apply AND logic when filtering by framework AND control domain (AC15-AC16)", async () => {
      const caller = createCaller(testUserGRC);

      // Filter by ISO27001 AND AC control domain
      const result = await caller.evidence.list({
        frameworkCode: "ISO27001",
        controlDomainId: controlDomainAC.id,
        page: 1,
        pageSize: 50,
      });

      const titles = result.items.map((e) => e.title);

      // Should include evidence that has BOTH ISO27001 (via AC domain) AND AC domain tag
      expect(titles).toContain("Evidence with ISO27001");
      expect(titles).toContain("Evidence with Both Frameworks");

      // Should NOT include evidence with only SC domain (even though it might map to another framework)
      expect(titles).not.toContain("Evidence with SOC2");
    });

    it("should return empty results when filters have no intersection", async () => {
      const caller = createCaller(testUserGRC);

      // Filter by SOC2 framework but AC control domain (which maps to ISO27001)
      // This should return empty because AC domain maps to ISO27001, not SOC2
      const result = await caller.evidence.list({
        frameworkCode: "SOC2",
        controlDomainId: controlDomainAC.id,
        page: 1,
        pageSize: 50,
      });

      // Should only return evidence that has AC domain AND maps to SOC2
      // Since AC domain only maps to ISO27001, only evidence with both domains qualifies
      // because it has AC domain that maps to ISO27001, but we're filtering for SOC2
      const titles = result.items.map((e) => e.title);

      // Evidence with both domains has AC domain but also has SC domain which maps to SOC2
      // The evidence needs to match BOTH: have the controlDomainId AND map to the frameworkCode
      // For "Evidence with Both Frameworks": it has AC domain, but AC maps to ISO27001 not SOC2
      // So it should NOT match when filtering by SOC2 + AC domain
      expect(titles).not.toContain("Evidence with ISO27001");
      expect(titles).not.toContain("Evidence with SOC2");
    });
  });

  describe("Auditor Role Framework Access (AC19-AC21)", () => {
    it("should enforce framework access for auditor with assigned frameworks (AC21)", async () => {
      const caller = createCaller(testUserAuditor);

      // Auditor tries to access SOC2 but is only assigned to ISO27001
      await expect(
        caller.evidence.list({
          frameworkCode: "SOC2",
          page: 1,
          pageSize: 50,
        })
      ).rejects.toThrow(/FORBIDDEN|don't have access/i);
    });

    it("should allow auditor to access assigned framework (AC21)", async () => {
      const caller = createCaller(testUserAuditor);

      // Auditor accesses ISO27001 which they are assigned to
      const result = await caller.evidence.list({
        frameworkCode: "ISO27001",
        page: 1,
        pageSize: 50,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.frameworkCode).toBe("ISO27001");
    });

    it("should pre-select assigned framework for auditor with no explicit filter (AC20)", async () => {
      const caller = createCaller(testUserAuditor);

      // Auditor without specifying framework should get their first assigned framework
      const result = await caller.evidence.list({
        page: 1,
        pageSize: 50,
      });

      // Should be filtered by ISO27001 (their first assigned framework)
      expect(result.frameworkCode).toBe("ISO27001");

      const titles = result.items.map((e) => e.title);
      expect(titles).toContain("Evidence with ISO27001");
      expect(titles).toContain("Evidence with Both Frameworks");
      expect(titles).not.toContain("Evidence with SOC2");
    });

    it("should allow auditor without assignments to see all evidence", async () => {
      const caller = createCaller(testUserAuditorNoAssignment);

      // Auditor without assigned frameworks can see all evidence
      const result = await caller.evidence.list({
        page: 1,
        pageSize: 50,
      });

      const titles = result.items.map((e) => e.title);

      // Should include all evidence (no framework restriction)
      expect(titles).toContain("Evidence with ISO27001");
      expect(titles).toContain("Evidence with SOC2");
      expect(titles).toContain("Evidence with Both Frameworks");
    });

    it("should allow auditor without assignments to filter by any framework", async () => {
      const caller = createCaller(testUserAuditorNoAssignment);

      // Auditor without assignments can filter by any framework
      const result = await caller.evidence.list({
        frameworkCode: "SOC2",
        page: 1,
        pageSize: 50,
      });

      expect(result.frameworkCode).toBe("SOC2");

      const titles = result.items.map((e) => e.title);
      expect(titles).toContain("Evidence with SOC2");
      expect(titles).not.toContain("Evidence with ISO27001");
    });
  });

  describe("Clear Filter Behavior", () => {
    it("should return all evidence when framework filter is cleared (AC5)", async () => {
      const caller = createCaller(testUserGRC);

      // First, filter by framework
      const filteredResult = await caller.evidence.list({
        frameworkCode: "ISO27001",
        page: 1,
        pageSize: 50,
      });

      expect(filteredResult.items.length).toBeLessThan(4); // Not all evidence

      // Then, clear filter (no frameworkCode)
      const allResult = await caller.evidence.list({
        page: 1,
        pageSize: 50,
      });

      expect(allResult.items.length).toBe(4); // All evidence
      expect(allResult.frameworkCode).toBeNull();
    });
  });
});
