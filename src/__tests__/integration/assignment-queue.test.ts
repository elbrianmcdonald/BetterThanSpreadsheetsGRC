/**
 * Assignment Queue Integration Tests (Story 4.13)
 *
 * Tests for the Risk Assignment Queue feature covering:
 * - Queue display for OPEN risks
 * - Quick assign functionality
 * - Bulk assign functionality
 * - Filtering and searching
 * - Metrics calculation
 * - Role-based access control
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, Severity, RiskStatus, RiskFindingSource } from "@prisma/client";

// Test data
let testOrg: { id: string; name: string };
let testRisks: Array<{ id: string; title: string; severity: Severity }>;
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
// Risk owners are Person records (not Users) since the ownership redesign.
let itOwnerPersonId: string;
let bizOwnerPersonId: string;

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-assignment-queue" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "RiskStatusHistory" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Assignment Queue",
      slug: "test-org-assignment-queue",
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

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@assignment-queue.test",
    "ANALYST",
    testOrg.id
  );

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@assignment-queue.test",
    "ANALYST",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@assignment-queue.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@assignment-queue.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@assignment-queue.test",
    "BUSINESS_USER",
    testOrg.id
  );

  // Create Person owner records (risk owners are Persons, not Users).
  itOwnerPersonId = randomUUID();
  bizOwnerPersonId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Person" (id, "organizationId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${itOwnerPersonId}, ${testOrg.id}, 'IT Owner Person', true, NOW(), NOW())
  `;
  await db.$executeRaw`
    INSERT INTO "Person" (id, "organizationId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${bizOwnerPersonId}, ${testOrg.id}, 'Business Owner Person', true, NOW(), NOW())
  `;

  // Create test risks (OPEN status for queue)
  testRisks = [];
  const riskData = [
    { title: "High Impact Vulnerability", severity: Severity.HIGH, impactScore: 85 },
    { title: "Medium Risk Finding", severity: Severity.MEDIUM, impactScore: 50 },
    { title: "Low Priority Issue", severity: Severity.LOW, impactScore: 20 },
    { title: "Critical Security Gap", severity: Severity.HIGH, impactScore: 95 },
    { title: "Configuration Weakness", severity: Severity.MEDIUM, impactScore: 45 },
  ];

  for (const data of riskData) {
    const riskId = randomUUID();
    await db.$executeRaw`
      INSERT INTO "Risk" (id, title, description, severity, status, "impactScore", "organizationId", "createdById", "findingSource", "createdAt", "updatedAt")
      VALUES (${riskId}, ${data.title}, ${'Test description for ' + data.title}, ${data.severity}::"Severity", 'OPEN'::"RiskStatus", ${data.impactScore}, ${testOrg.id}, ${testUserGRCAnalyst.id}, 'VULNERABILITY_SCAN'::"RiskFindingSource", NOW(), NOW())
    `;
    testRisks.push({ id: riskId, title: data.title, severity: data.severity });
  }
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "RiskStatusHistory" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }
});

// Helper to create a caller with a specific user context
const createCaller = (user: typeof testUserGRCAnalyst) => {
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

describe("Story 4.13: Risk Assignment Queue", () => {
  describe("getAssignmentQueue", () => {
    it("AC1-AC2: GRC_ANALYST views queue - sees all OPEN risks", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.getAssignmentQueue({});

      expect(result.risks.length).toBeGreaterThanOrEqual(5);
      expect(result.total).toBeGreaterThanOrEqual(5);
      // All risks should be OPEN
      result.risks.forEach((risk) => {
        expect(risk.status).toBe(RiskStatus.OPEN);
      });
    });

    it("AC3: Queue sorted by impact score (highest first by default)", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.getAssignmentQueue({
        sortBy: "impactScore",
        sortOrder: "desc",
      });

      // Verify descending order by impact score
      for (let i = 1; i < result.risks.length; i++) {
        expect(result.risks[i - 1]!.impactScore).toBeGreaterThanOrEqual(
          result.risks[i]!.impactScore
        );
      }
    });

    it("AC4: Search by keyword returns matching risks", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.getAssignmentQueue({
        search: "Critical",
      });

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks[0]!.title).toContain("Critical");
    });

    it("AC5: Filter by severity HIGH - only HIGH risks shown", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.getAssignmentQueue({
        severity: [Severity.HIGH],
      });

      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach((risk) => {
        expect(risk.severity).toBe(Severity.HIGH);
      });
    });

    it("AC34/AC35: BUSINESS_USER can view the queue (read-only)", async () => {
      // getAssignmentQueue is a read query; the consolidated role model grants
      // read access to all roles including BUSINESS_USER (see AC35). Assignment
      // *actions* remain gated to writers separately.
      const caller = createCaller(testUserITStakeholder);

      const result = await caller.risk.getAssignmentQueue({});
      expect(result.risks.length).toBeGreaterThan(0);
    });

    it("AC35: AUDITOR can view queue (read-only)", async () => {
      const caller = createCaller(testUserAuditor);

      const result = await caller.risk.getAssignmentQueue({});

      expect(result.risks.length).toBeGreaterThan(0);
    });

    it("AC6: Pagination works correctly", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const page1 = await caller.risk.getAssignmentQueue({ limit: 2, offset: 0 });
      const page2 = await caller.risk.getAssignmentQueue({ limit: 2, offset: 2 });

      expect(page1.risks.length).toBeLessThanOrEqual(2);
      expect(page2.risks.length).toBeLessThanOrEqual(2);
      if (page1.risks.length > 0 && page2.risks.length > 0) {
        expect(page1.risks[0]!.id).not.toBe(page2.risks[0]!.id);
      }
    });
  });

  describe("getAssignmentQueueMetrics", () => {
    it("AC8-AC12: Metrics calculate correctly", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const metrics = await caller.risk.getAssignmentQueueMetrics();

      expect(metrics.totalUnassigned).toBeGreaterThanOrEqual(5);
      expect(metrics.highestImpact).toBe(95); // Critical Security Gap has 95
      expect(metrics.severityCounts).toHaveProperty("HIGH");
      expect(metrics.severityCounts).toHaveProperty("MEDIUM");
      expect(metrics.severityCounts).toHaveProperty("LOW");
    });
  });

  describe("assignRisk (Quick Assign)", () => {
    it("AC17: Quick assign risk - status changes to ASSIGNED, disappears from queue", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Get first risk from queue
      const queue = await caller.risk.getAssignmentQueue({ limit: 1 });
      const riskToAssign = queue.risks[0]!;

      // Assign the risk
      const assigned = await caller.risk.assignRisk({
        riskId: riskToAssign.id,
        itOwnerId: itOwnerPersonId,
        businessOwnerId: bizOwnerPersonId,
      });

      expect(assigned.status).toBe(RiskStatus.ASSIGNED);
      expect(assigned.ITOwner?.id).toBe(itOwnerPersonId);
      expect(assigned.BusinessOwner?.id).toBe(bizOwnerPersonId);

      // Verify it's gone from queue
      const updatedQueue = await caller.risk.getAssignmentQueue({});
      expect(updatedQueue.risks.find((r) => r.id === riskToAssign.id)).toBeUndefined();
    });
  });

  describe("bulkAssignRisks", () => {
    it("AC19-AC23: Bulk assign risks - all assigned successfully", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Get risks from queue
      const queue = await caller.risk.getAssignmentQueue({ limit: 2 });
      const riskIds = queue.risks.map((r) => r.id);

      if (riskIds.length < 2) {
        // Skip if not enough OPEN risks
        return;
      }

      const initialTotal = queue.total;

      const result = await caller.risk.bulkAssignRisks({
        riskIds,
        itOwnerId: itOwnerPersonId,
        businessOwnerId: bizOwnerPersonId,
      });

      expect(result.assignedCount).toBe(riskIds.length);

      // Verify all are assigned
      const updatedQueue = await caller.risk.getAssignmentQueue({});
      expect(updatedQueue.total).toBe(initialTotal - riskIds.length);
    });

    it("Bulk assign requires at least one owner", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.risk.bulkAssignRisks({
          riskIds: [testRisks[0]!.id],
          // No owners provided
        })
      ).rejects.toThrow();
    });
  });

  describe("Role-Based Access Control", () => {
    it("AC33: SECURITY_ENGINEER can access queue", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Can view queue
      const queue = await caller.risk.getAssignmentQueue({});
      expect(queue).toHaveProperty("risks");
    });

    it("AC34/AC35: BUSINESS_USER can view queue (read-only)", async () => {
      // Read query — BUSINESS_USER has read access under the consolidated model.
      const caller = createCaller(testUserBusinessStakeholder);

      const result = await caller.risk.getAssignmentQueue({});
      expect(result.risks.length).toBeGreaterThan(0);
    });
  });
});
