/**
 * Risk Finding Documentation Integration Tests
 *
 * Tests for Story 4.3: Risk Finding Documentation (Description, Systems, Severity)
 *
 * **Critical Test Coverage:**
 * - AC18-AC22: Schema extended with findingSource, cveId, discoveryDate, technicalDetails
 * - AC28-AC32: updateRisk mutation with field-level change tracking
 * - Role-based permissions for risk updates
 * - Audit logging for updates
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, RiskFindingSource } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Test data
let testOrg: { id: string; name: string };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserOrgAdmin: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testRiskId: string;
let testRiskCreated = false;

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-risk-finding-docs" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Risk Finding Docs",
      slug: "test-org-risk-finding-docs",
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
    "security@risk-finding-docs.test",
    "ANALYST",
    testOrg.id
  );

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@risk-finding-docs.test",
    "ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@risk-finding-docs.test",
    "ADMINISTRATOR",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@risk-finding-docs.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@risk-finding-docs.test",
    "BUSINESS_USER",
    testOrg.id
  );
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
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

// Helper to ensure test risk exists for update tests
const ensureTestRiskExists = async () => {
  if (!testRiskCreated) {
    const caller = createCaller(testUserSecurityEngineer);
    const risk = await caller.risk.create({
      title: "Test Risk for Updates",
      description: "This is a test risk for testing update functionality. It has more than 20 characters.",
      severity: Severity.MEDIUM,
    });
    testRiskId = risk.id;
    testRiskCreated = true;
  }
  return testRiskId;
};

describe("Story 4.3: Risk Finding Documentation", () => {
  describe("AC18-AC22: Extended Schema Fields in Create", () => {
    it("AC18: Can create risk with findingSource field", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.create({
        title: "Finding with Source",
        description: "Testing findingSource field - this is a vulnerability scan finding.",
        severity: Severity.HIGH,
        findingSource: RiskFindingSource.VULNERABILITY_SCAN,
      });

      expect(result.findingSource).toBe(RiskFindingSource.VULNERABILITY_SCAN);
    });

    it("AC19: Can create risk with cveId field", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.create({
        title: "CVE Tracked Finding",
        description: "Testing cveId field - this risk is associated with a CVE.",
        severity: Severity.HIGH,
        cveId: "CVE-2024-12345",
        findingSource: RiskFindingSource.VULNERABILITY_SCAN,
      });

      expect(result.cveId).toBe("CVE-2024-12345");
    });

    it("AC20: Can create risk with discoveryDate field", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const discoveryDate = new Date("2024-01-15");

      const result = await caller.risk.create({
        title: "Finding with Discovery Date",
        description: "Testing discoveryDate field - this risk was discovered earlier.",
        severity: Severity.MEDIUM,
        discoveryDate: discoveryDate,
      });

      expect(result.discoveryDate).toEqual(discoveryDate);
    });

    it("AC21: Can create risk with technicalDetails field", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const technicalDetails = `## Technical Analysis

The vulnerability was found in the following code:
\`\`\`
SELECT * FROM users WHERE id = '\${userInput}'
\`\`\`

**Impact:** SQL Injection allowing data extraction.`;

      const result = await caller.risk.create({
        title: "Finding with Technical Details",
        description: "Testing technicalDetails field - includes markdown content.",
        severity: Severity.HIGH,
        technicalDetails: technicalDetails,
      });

      expect(result.technicalDetails).toBe(technicalDetails);
    });

    it("Can create risk with all new fields together", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const discoveryDate = new Date("2024-02-20");

      const result = await caller.risk.create({
        title: "Complete Finding Documentation",
        description: "Testing all Story 4.3 fields together in a single create operation.",
        severity: Severity.HIGH,
        affectedSystems: "web-server-01\napi-gateway\ndatabase-primary",
        findingSource: RiskFindingSource.PENETRATION_TEST,
        cveId: "CVE-2024-99999",
        discoveryDate: discoveryDate,
        technicalDetails: "Detailed technical analysis goes here with **markdown** support.",
      });

      expect(result.findingSource).toBe(RiskFindingSource.PENETRATION_TEST);
      expect(result.cveId).toBe("CVE-2024-99999");
      expect(result.discoveryDate).toEqual(discoveryDate);
      expect(result.technicalDetails).toContain("**markdown**");
    });
  });

  describe("AC28-AC32: Update Risk Mutation", () => {
    // Ensure test risk exists before running update tests
    beforeAll(async () => {
      await ensureTestRiskExists();
    });

    it("AC28: Can update risk with all finding fields", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const discoveryDate = new Date("2024-03-10");

      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        title: "Updated Risk Title",
        description: "Updated description with more than 20 characters for validation.",
        severity: Severity.HIGH,
        findingSource: RiskFindingSource.AUDIT_FINDING,
        cveId: "CVE-2024-00001",
        discoveryDate: discoveryDate,
        technicalDetails: "Updated technical details.",
      });

      expect(result.title).toBe("Updated Risk Title");
      expect(result.severity).toBe(Severity.HIGH);
      expect(result.findingSource).toBe(RiskFindingSource.AUDIT_FINDING);
      expect(result.cveId).toBe("CVE-2024-00001");
      expect(result.discoveryDate).toEqual(discoveryDate);
      expect(result.technicalDetails).toBe("Updated technical details.");
    });

    it("AC29: Security Engineer can update risks", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        title: "Security Engineer Updated",
      });

      expect(result.title).toBe("Security Engineer Updated");
    });

    it("AC29: GRC Analyst can update risks", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        severity: Severity.LOW,
      });

      expect(result.severity).toBe(Severity.LOW);
    });

    it("AC29: Org Admin can update risks", async () => {
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        affectedSystems: "updated-system-1, updated-system-2",
      });

      expect(result.affectedSystems).toBe("updated-system-1, updated-system-2");
    });

    it("AC29: IT Stakeholder cannot update risks", async () => {
      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.risk.updateRisk({
          riskId: testRiskId,
          title: "Unauthorized Update Attempt",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC29: Auditor cannot update risks", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.risk.updateRisk({
          riskId: testRiskId,
          title: "Unauthorized Update Attempt",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC30: Cannot update risk from another organization", async () => {
      // Create another organization and user
      const otherOrg = await db.organization.create({
        data: {
          id: randomUUID(),
          name: "Other Org",
          slug: "other-org-risk-finding-docs",
          updatedAt: new Date(),
        },
      });

      const otherUser = await db.user.create({
        data: {
          id: randomUUID(),
          name: "Other User",
          email: "other@risk-finding-docs.test",
          role: "ANALYST",
          organizationId: otherOrg.id,
          updatedAt: new Date(),
        },
      });

      const caller = createCaller({
        id: otherUser.id,
        email: otherUser.email!,
        role: otherUser.role,
        organizationId: otherUser.organizationId,
        name: otherUser.name!,
        assignedFrameworks: otherUser.assignedFrameworks,
      });

      // Try to update risk from different org
      await expect(
        caller.risk.updateRisk({
          riskId: testRiskId,
          title: "Cross-Org Update Attempt",
        })
      ).rejects.toThrow(TRPCError);

      // Cleanup
      await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${otherOrg.id}`;
      await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${otherOrg.id}`;
    });

    it("AC31: Update changes are logged to audit trail", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      await caller.risk.updateRisk({
        riskId: testRiskId,
        title: "Audit Log Test Update",
        severity: Severity.MEDIUM,
      });

      // Give the async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Risk",
          entityId: testRiskId,
          action: "UPDATE_RISK",
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(testUserSecurityEngineer.id);
      expect(auditLog?.changes).toBeDefined();
    });

    it("AC32: Update returns updated risk with timestamps", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const beforeUpdate = new Date();

      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        cveId: "CVE-2024-TIMESTAMP-TEST",
      });

      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime()
      );
    });

    it("Returns existing risk unchanged when no fields are modified", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Get current state
      const currentRisk = await caller.risk.getById({ id: testRiskId });

      // Update with same values (no actual change)
      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        title: currentRisk!.title,
      });

      // Should return the same risk without triggering audit log
      expect(result.id).toBe(testRiskId);
    });
  });

  describe("Get Risk with Extended Fields", () => {
    it("getById includes all Story 4.3 fields", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const discoveryDate = new Date("2024-05-01");

      // Create a risk with all fields
      const created = await caller.risk.create({
        title: "Complete Risk for GetById Test",
        description: "Testing that getById returns all extended fields properly.",
        severity: Severity.HIGH,
        affectedSystems: "system-1\nsystem-2",
        findingSource: RiskFindingSource.SECURITY_REVIEW,
        cveId: "CVE-2024-GETTEST",
        discoveryDate: discoveryDate,
        technicalDetails: "Technical analysis markdown content.",
      });

      // Fetch it back
      const fetched = await caller.risk.getById({ id: created.id });

      expect(fetched).not.toBeNull();
      expect(fetched!.findingSource).toBe(RiskFindingSource.SECURITY_REVIEW);
      expect(fetched!.cveId).toBe("CVE-2024-GETTEST");
      expect(fetched!.discoveryDate).toEqual(discoveryDate);
      expect(fetched!.technicalDetails).toBe("Technical analysis markdown content.");
    });
  });

  describe("Nullable Field Handling", () => {
    // Ensure test risk exists before running nullable field tests
    beforeAll(async () => {
      await ensureTestRiskExists();
    });

    it("Can set fields to null via update", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // First set all fields
      await caller.risk.updateRisk({
        riskId: testRiskId,
        findingSource: RiskFindingSource.OTHER,
        cveId: "CVE-2024-TONULL",
        technicalDetails: "Details to be cleared.",
      });

      // Now clear them
      const result = await caller.risk.updateRisk({
        riskId: testRiskId,
        findingSource: null,
        cveId: null,
        technicalDetails: null,
      });

      expect(result.findingSource).toBeNull();
      expect(result.cveId).toBeNull();
      expect(result.technicalDetails).toBeNull();
    });
  });
});
