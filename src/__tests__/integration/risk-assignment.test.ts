/**
 * Risk Assignment Integration Tests
 *
 * Tests for Story 4.6: Risk Ownership Assignment
 *
 * **Critical Test Coverage:**
 * - AC7-AC13: assignRisk mutation functionality
 * - AC14-AC18: reassignRisk mutation functionality
 * - AC32-AC35: listUsersWithWorkload query
 * - Role-based permission enforcement
 * - Multi-tenant isolation
 *
 * @see Story 4.6: Risk Ownership Assignment
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, RiskStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

// Test data
let testOrg: { id: string; name: string };
let testOrg2: { id: string; name: string };
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrgAdmin: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder2: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder2: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrg2IT: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testRisk: { id: string };
let testRiskAssigned: { id: string };
// Risk owners are Person records (not Users) since the ownership redesign.
// Users above are still used for caller sessions + listUsersWithWorkload.
let itPerson1: { id: string; name: string };
let itPerson2: { id: string; name: string };
let bizPerson1: { id: string; name: string };
let bizPerson2: { id: string; name: string };
let org2Person: { id: string; name: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-risk-assignment" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  const existingOrg2 = await db.organization.findUnique({
    where: { slug: "test-org-risk-assignment-2" },
  });
  if (existingOrg2) {
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg2.id}`;
  }

  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Risk Assignment",
      slug: "test-org-risk-assignment",
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Risk Assignment 2",
      slug: "test-org-risk-assignment-2",
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
    "grc@risk-assignment.test",
    "GRC_ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@risk-assignment.test",
    "ORG_ADMIN",
    testOrg.id
  );

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@risk-assignment.test",
    "SECURITY_ENGINEER",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder 1",
    "it1@risk-assignment.test",
    "IT_STAKEHOLDER",
    testOrg.id
  );

  testUserITStakeholder2 = await createUser(
    "IT Stakeholder 2",
    "it2@risk-assignment.test",
    "IT_STAKEHOLDER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder 1",
    "biz1@risk-assignment.test",
    "BUSINESS_STAKEHOLDER",
    testOrg.id
  );

  testUserBusinessStakeholder2 = await createUser(
    "Business Stakeholder 2",
    "biz2@risk-assignment.test",
    "BUSINESS_STAKEHOLDER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@risk-assignment.test",
    "AUDITOR",
    testOrg.id
  );

  testUserOrg2IT = await createUser(
    "IT Stakeholder Org2",
    "it@risk-assignment-org2.test",
    "IT_STAKEHOLDER",
    testOrg2.id
  );

  // Create Person owner records (risk owners are Persons, not Users).
  await runWithOrganizationContext(testOrg.id, async () => {
    const mkPerson = async (name: string) =>
      db.person.create({
        data: { id: randomUUID(), organizationId: testOrg.id, name, updatedAt: new Date() },
        select: { id: true, name: true },
      });
    itPerson1 = await mkPerson("IT Stakeholder 1");
    itPerson2 = await mkPerson("IT Stakeholder 2");
    bizPerson1 = await mkPerson("Business Stakeholder 1");
    bizPerson2 = await mkPerson("Business Stakeholder 2");
  });
  await runWithOrganizationContext(testOrg2.id, async () => {
    org2Person = await db.person.create({
      data: { id: randomUUID(), organizationId: testOrg2.id, name: "IT Person Org2", updatedAt: new Date() },
      select: { id: true, name: true },
    });
  });

  // Create test risks (wrapped in org context for middleware)
  await runWithOrganizationContext(testOrg.id, async () => {
    testRisk = await db.risk.create({
      data: {
        id: randomUUID(),
        title: "Unassigned Test Risk",
        description: "This is a test risk for assignment testing with adequate description length.",
        severity: Severity.HIGH,
        status: RiskStatus.OPEN,
        organizationId: testOrg.id,
        createdById: testUserGRCAnalyst.id,
      },
    });

    testRiskAssigned = await db.risk.create({
      data: {
        id: randomUUID(),
        title: "Already Assigned Test Risk",
        description: "This is a test risk that is already assigned for reassignment testing.",
        severity: Severity.MEDIUM,
        status: RiskStatus.ASSIGNED,
        organizationId: testOrg.id,
        createdById: testUserGRCAnalyst.id,
        itOwnerId: itPerson1.id,
        businessOwnerId: bizPerson1.id,
        assignedAt: new Date(),
        assignedById: testUserGRCAnalyst.id,
      },
    });
  });
});

afterAll(async () => {
  // Cleanup test data
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;

  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg2.id}`;
});

// Helper to create caller with session
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

// Helper to create a risk within org context (must await inside run() for PrismaPromise)
const createRiskInOrg = (orgId: string, args: Parameters<typeof db.risk.create>[0]) => {
  return runWithOrganizationContext(orgId, async () => {
    return await db.risk.create(args);
  });
};

describe("Story 4.6: Risk Assignment", () => {
  describe("assignRisk mutation", () => {
    it("AC7-AC12: should assign IT owner to a risk", async () => {
      // Create a new unassigned risk for this test
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for IT Assignment",
          description: "This is a test risk for IT owner assignment testing only.",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.assignRisk({
        riskId: newRisk.id,
        itOwnerId: itPerson1.id,
      });

      expect(result.itOwnerId).toBe(itPerson1.id);
      expect(result.ITOwner?.id).toBe(itPerson1.id);
      expect(result.ITOwner?.name).toBe("IT Stakeholder 1");
      expect(result.businessOwnerId).toBeNull();
      expect(result.assignedAt).toBeDefined();
      expect(result.assignedById).toBe(testUserGRCAnalyst.id);
    });

    it("AC7-AC12: should assign Business owner to a risk", async () => {
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for Business Assignment",
          description: "This is a test risk for Business owner assignment testing only.",
          severity: Severity.MEDIUM,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.assignRisk({
        riskId: newRisk.id,
        businessOwnerId: bizPerson1.id,
      });

      expect(result.businessOwnerId).toBe(bizPerson1.id);
      expect(result.BusinessOwner?.id).toBe(bizPerson1.id);
      expect(result.itOwnerId).toBeNull();
      expect(result.assignedAt).toBeDefined();
    });

    it("AC13: should change risk status from OPEN to ASSIGNED", async () => {
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for Status Change Test",
          description: "This is a test risk for status change verification testing.",
          severity: Severity.LOW,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.assignRisk({
        riskId: newRisk.id,
        itOwnerId: itPerson1.id,
      });

      expect(result.status).toBe(RiskStatus.ASSIGNED);
    });

    it("AC8: should allow SECURITY_ENGINEER to assign risks", async () => {
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for Security Engineer Assignment",
          description: "This is a test risk for Security Engineer assignment testing.",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.assignRisk({
        riskId: newRisk.id,
        itOwnerId: itPerson1.id,
      });

      expect(result.itOwnerId).toBe(itPerson1.id);
    });

    it("AC8: should allow ORG_ADMIN to assign risks", async () => {
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for Org Admin Assignment",
          description: "This is a test risk for Org Admin assignment testing only.",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.assignRisk({
        riskId: newRisk.id,
        businessOwnerId: bizPerson1.id,
      });

      expect(result.businessOwnerId).toBe(bizPerson1.id);
    });

    it("AC8: should deny IT_STAKEHOLDER from assigning risks", async () => {
      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.risk.assignRisk({
          riskId: testRisk.id,
          itOwnerId: itPerson2.id,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC8: should deny AUDITOR from assigning risks", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.risk.assignRisk({
          riskId: testRisk.id,
          itOwnerId: itPerson1.id,
        })
      ).rejects.toThrow(TRPCError);
    });

    // NOTE: The former AC10/AC11 tests ("reject owner without IT_/BUSINESS_STAKEHOLDER
    // role") were removed: risk owners are now Person records, which have no auth
    // role, and assignRisk no longer performs owner-role validation. Cross-org and
    // non-existent owners are still rejected (see "owner from different organization").

    it("should reject assignment if risk is already assigned", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.risk.assignRisk({
          riskId: testRiskAssigned.id,
          itOwnerId: itPerson2.id,
        })
      ).rejects.toThrow("already assigned");
    });

    it("AC9: should reject assignment of risk from different organization", async () => {
      // Create risk in org2
      const org2Risk = await createRiskInOrg(testOrg2.id, {
        data: {
          id: randomUUID(),
          title: "Org2 Risk for Cross-Org Test",
          description: "This is a test risk in org2 for cross-org assignment testing.",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          organizationId: testOrg2.id,
          createdById: testUserOrg2IT.id,
        },
      });

      const caller = createCaller(testUserGRCAnalyst); // From testOrg

      await expect(
        caller.risk.assignRisk({
          riskId: org2Risk.id,
          itOwnerId: itPerson1.id,
        })
      ).rejects.toThrow("Risk not found");
    });

    it("should reject assigning owner from different organization", async () => {
      const newRisk = await createRiskInOrg(testOrg.id, {
        data: {
          id: randomUUID(),
          title: "Risk for Cross-Org Owner Test",
          description: "This is a test risk for cross-org owner assignment testing.",
          severity: Severity.HIGH,
          status: RiskStatus.OPEN,
          organizationId: testOrg.id,
          createdById: testUserGRCAnalyst.id,
        },
      });

      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.risk.assignRisk({
          riskId: newRisk.id,
          itOwnerId: org2Person.id, // Person from different org!
        })
      ).rejects.toThrow("IT Owner not found in your organization");
    });

    it("should require at least one owner", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.risk.assignRisk({
          riskId: testRisk.id,
        })
      ).rejects.toThrow("At least one owner");
    });
  });

  describe("reassignRisk mutation", () => {
    it("AC14: should allow reassigning IT owner", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.reassignRisk({
        riskId: testRiskAssigned.id,
        itOwnerId: itPerson2.id,
      });

      expect(result.itOwnerId).toBe(itPerson2.id);
      expect(result.ITOwner?.name).toBe("IT Stakeholder 2");
      // Business owner should remain unchanged
      expect(result.businessOwnerId).toBe(bizPerson1.id);
    });

    it("AC14: should allow reassigning Business owner", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.reassignRisk({
        riskId: testRiskAssigned.id,
        businessOwnerId: bizPerson2.id,
      });

      expect(result.businessOwnerId).toBe(bizPerson2.id);
      expect(result.BusinessOwner?.name).toBe("Business Stakeholder 2");
    });

    it("AC14: should allow clearing an owner by setting to null", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.reassignRisk({
        riskId: testRiskAssigned.id,
        itOwnerId: null,
      });

      expect(result.itOwnerId).toBeNull();
      expect(result.ITOwner).toBeNull();
    });

    it("AC15: should deny SECURITY_ENGINEER from reassigning", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      await expect(
        caller.risk.reassignRisk({
          riskId: testRiskAssigned.id,
          itOwnerId: itPerson2.id,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC15: should allow ORG_ADMIN to reassign", async () => {
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.reassignRisk({
        riskId: testRiskAssigned.id,
        itOwnerId: itPerson1.id,
      });

      expect(result.itOwnerId).toBe(itPerson1.id);
    });
  });

  describe("listUsersWithWorkload query", () => {
    it("AC32-AC34: should return IT_STAKEHOLDER users with workload", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.user.listUsersWithWorkload({
        role: "IT_STAKEHOLDER",
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("assignedRiskCount");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("email");
      expect(result[0]).toHaveProperty("id");

      // Should only include IT_STAKEHOLDER users
      result.forEach((user) => {
        expect(user.role).toBe("IT_STAKEHOLDER");
      });
    });

    it("AC32-AC34: should return BUSINESS_STAKEHOLDER users with workload", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.user.listUsersWithWorkload({
        role: "BUSINESS_STAKEHOLDER",
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("assignedRiskCount");

      // Should only include BUSINESS_STAKEHOLDER users
      result.forEach((user) => {
        expect(user.role).toBe("BUSINESS_STAKEHOLDER");
      });
    });

    it("AC34: should sort users by workload (ascending)", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.user.listUsersWithWorkload({
        role: "IT_STAKEHOLDER",
      });

      // Verify ascending order by workload
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.assignedRiskCount).toBeGreaterThanOrEqual(
          result[i - 1]!.assignedRiskCount
        );
      }
    });

    it("should only return users from the caller's organization", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.user.listUsersWithWorkload({
        role: "IT_STAKEHOLDER",
      });

      // testUserOrg2IT should not be in results
      const org2User = result.find((u) => u.id === testUserOrg2IT.id);
      expect(org2User).toBeUndefined();
    });
  });
});
