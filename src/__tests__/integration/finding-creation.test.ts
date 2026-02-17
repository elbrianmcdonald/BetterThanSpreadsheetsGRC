/**
 * Finding Creation Integration Tests
 *
 * Tests for Story 7.2: Finding Creation Form
 *
 * **Critical Test Coverage:**
 * - AC23-AC28: Create finding mutation functionality
 * - AC29-AC31: Role-based permission enforcement
 * - AC32-AC33: Audit logging
 *
 * @see Story 7.2: Finding Creation Form
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, Severity, FindingSource, AuditAction } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

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
let testBusinessUnit: { id: string; name: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-finding-creation" },
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
    where: { slug: "test-org-finding-creation-2" },
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
      name: "Test Org Finding Creation",
      slug: "test-org-finding-creation",
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Finding Creation 2",
      slug: "test-org-finding-creation-2",
      updatedAt: new Date(),
    },
  });

  // Create test business unit within organization context
  await runWithOrganizationContext(testOrg.id, async () => {
    testBusinessUnit = await db.businessUnit.create({
      data: {
        id: randomUUID(),
        name: "Test Business Unit",
        code: "TBU",
        organizationId: testOrg.id,
      },
    });
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
    "security@finding-creation.test",
    "SECURITY_ENGINEER",
    testOrg.id
  );

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@finding-creation.test",
    "GRC_ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@finding-creation.test",
    "ORG_ADMIN",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@finding-creation.test",
    "IT_STAKEHOLDER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@finding-creation.test",
    "BUSINESS_STAKEHOLDER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@finding-creation.test",
    "AUDITOR",
    testOrg.id
  );

  testUserOrg2 = await createUser(
    "User Org 2",
    "user@finding-creation-org2.test",
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

describe("Story 7.2: Finding Creation", () => {
  describe("AC23-AC28: Create Finding Mutation", () => {
    it("AC23, AC28: Security Engineer can create finding with all fields", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "SQL Injection Vulnerability in Login Form",
        description: "During penetration testing, a SQL injection vulnerability was discovered in the login form.",
        source: FindingSource.PENTEST,
        severity: Severity.HIGH,
        affectedAssets: ["web-app-prod", "login-service"],
        affectedBusinessUnitIds: [testBusinessUnit.id],
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("identifier");
      expect(result.identifier).toMatch(/^FND-\d{4}-\d+$/);
      expect(result.title).toBe("SQL Injection Vulnerability in Login Form");
      expect(result.source).toBe(FindingSource.PENTEST);
      expect(result.severity).toBe(Severity.HIGH);
      expect(result.status).toBe("NEW");
      expect(result.affectedBusinessUnits).toHaveLength(1);
      expect(result.affectedBusinessUnits[0].id).toBe(testBusinessUnit.id);
    });

    it("AC24: Validation rejects missing required fields", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Missing title
      await expect(
        caller.finding.create({
          title: "",
          description: "This is a valid description with more than 20 characters",
          source: FindingSource.AUDIT,
          severity: Severity.MEDIUM,
        })
      ).rejects.toThrow();

      // Title too short
      await expect(
        caller.finding.create({
          title: "Too",
          description: "This is a valid description with more than 20 characters",
          source: FindingSource.AUDIT,
          severity: Severity.MEDIUM,
        })
      ).rejects.toThrow();

      // Description too short
      await expect(
        caller.finding.create({
          title: "Valid Title Here",
          description: "Too short",
          source: FindingSource.AUDIT,
          severity: Severity.MEDIUM,
        })
      ).rejects.toThrow();
    });

    it("AC22: Finding is created with status NEW", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "Unpatched Server Operating System Finding",
        description: "The production server is running an outdated operating system version.",
        source: FindingSource.SCANNER,
        severity: Severity.MEDIUM,
      });

      expect(result.status).toBe("NEW");
    });

    it("AC25: Identifier is generated via generateIdentifier", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "Test Finding for Identifier Check",
        description: "This finding is created to verify identifier generation.",
        source: FindingSource.MANUAL,
        severity: Severity.LOW,
      });

      expect(result.identifier).toMatch(/^FND-\d{4}-\d+$/);
    });

    it("AC26: createdBy is set from session user", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.create({
        title: "Missing Data Encryption at Rest Finding",
        description: "Customer data stored in the database is not encrypted at rest.",
        source: FindingSource.AUDIT,
        severity: Severity.HIGH,
      });

      expect(result.creator.id).toBe(testUserGRCAnalyst.id);
    });

    it("AC27: organizationId is set from session user", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "Weak Password Policy Finding",
        description: "The current password policy allows weak passwords. Minimum length is only 6 characters.",
        source: FindingSource.INCIDENT,
        severity: Severity.LOW,
      });

      // Verify by fetching the finding directly from DB
      const finding = await db.finding.findUnique({
        where: { id: result.id },
      });
      expect(finding?.organizationId).toBe(testOrg.id);
    });

    it("affectedAssets is optional", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "Outdated SSL Certificate Finding",
        description: "The SSL certificate on the main website is using SHA-1 which is deprecated.",
        source: FindingSource.SCANNER,
        severity: Severity.MEDIUM,
      });

      // Verify by fetching the finding directly from DB
      const finding = await db.finding.findUnique({
        where: { id: result.id },
      });
      expect(finding?.affectedAssets).toEqual([]);
    });

    it("affectedBusinessUnitIds validates BUs are in same organization", async () => {
      const caller = createCaller(testUserOrg2);

      // Try to use a BU from testOrg in testOrg2's finding
      await expect(
        caller.finding.create({
          title: "Cross-Org BU Test Finding",
          description: "This finding attempts to use a BU from another organization.",
          source: FindingSource.MANUAL,
          severity: Severity.LOW,
          affectedBusinessUnitIds: [testBusinessUnit.id], // BU from testOrg
        })
      ).rejects.toThrow("Invalid business unit(s)");
    });

    it("assigneeId validates user is in same organization", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      // Try to assign to a user from testOrg2
      await expect(
        caller.finding.create({
          title: "Cross-Org Assignee Test Finding",
          description: "This finding attempts to assign to a user from another organization.",
          source: FindingSource.MANUAL,
          severity: Severity.LOW,
          assigneeId: testUserOrg2.id, // User from testOrg2
        })
      ).rejects.toThrow("Invalid assignee");
    });
  });

  describe("AC29-AC31: Role-Based Permissions", () => {
    it("AC29: Security Engineer can create findings", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.finding.create({
        title: "Cross-Site Scripting in Search Feature Finding",
        description: "The search feature is vulnerable to reflected XSS attacks.",
        source: FindingSource.PENTEST,
        severity: Severity.HIGH,
      });

      expect(result).toHaveProperty("id");
    });

    it("AC29: GRC Analyst can create findings", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const result = await caller.finding.create({
        title: "Missing Access Control Logs Finding",
        description: "Critical access control events are not being logged.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
      });

      expect(result).toHaveProperty("id");
    });

    it("AC29: Org Admin can create findings", async () => {
      const caller = createCaller(testUserOrgAdmin);

      const result = await caller.finding.create({
        title: "Third-Party Vendor Security Review Finding",
        description: "Annual security review of third-party vendors has not been completed.",
        source: FindingSource.MANUAL,
        severity: Severity.LOW,
      });

      expect(result).toHaveProperty("id");
    });

    it("AC30: IT Stakeholder cannot create findings", async () => {
      const caller = createCaller(testUserITStakeholder);

      await expect(
        caller.finding.create({
          title: "Unauthorized Finding Creation Attempt",
          description: "This should not be allowed for IT Stakeholders.",
          source: FindingSource.MANUAL,
          severity: Severity.LOW,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC30: Business Stakeholder cannot create findings", async () => {
      const caller = createCaller(testUserBusinessStakeholder);

      await expect(
        caller.finding.create({
          title: "Unauthorized Finding Creation Attempt",
          description: "This should not be allowed for Business Stakeholders.",
          source: FindingSource.MANUAL,
          severity: Severity.LOW,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC30: Auditor cannot create findings (view-only)", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.finding.create({
          title: "Unauthorized Finding Creation Attempt",
          description: "This should not be allowed for Auditors.",
          source: FindingSource.MANUAL,
          severity: Severity.LOW,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("Cross-Organization Isolation", () => {
    it("Findings are scoped to the creator's organization", async () => {
      const caller1 = createCaller(testUserSecurityEngineer);
      const caller2 = createCaller(testUserOrg2);

      // Create finding in org 1
      const finding1 = await caller1.finding.create({
        title: "Org 1 Finding",
        description: "This finding belongs to organization 1 and should not be visible to organization 2.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
      });

      // Verify the finding is in org 1
      const dbFinding1 = await db.finding.findUnique({
        where: { id: finding1.id },
      });
      expect(dbFinding1?.organizationId).toBe(testOrg.id);

      // Create finding in org 2
      const finding2 = await caller2.finding.create({
        title: "Org 2 Finding",
        description: "This finding belongs to organization 2 and should not be visible to organization 1.",
        source: FindingSource.SCANNER,
        severity: Severity.LOW,
      });

      // Verify the finding is in org 2
      const dbFinding2 = await db.finding.findUnique({
        where: { id: finding2.id },
      });
      expect(dbFinding2?.organizationId).toBe(testOrg2.id);
    });
  });

  describe("AC32-AC33: Audit Logging", () => {
    it("AC32: Finding creation is logged with action FINDING_CREATED", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const finding = await caller.finding.create({
        title: "Audit Log Test Finding",
        description: "This finding is created to verify audit logging functionality.",
        source: FindingSource.PENTEST,
        severity: Severity.HIGH,
      });

      // Give the async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Finding",
          entityId: finding.id,
          action: AuditAction.FINDING_CREATED,
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(testUserSecurityEngineer.id);
      expect(auditLog?.organizationId).toBe(testOrg.id);
    });

    it("AC33: Audit log includes required fields", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      const finding = await caller.finding.create({
        title: "Audit Log Detail Test Finding",
        description: "This finding is created to verify all required audit log fields.",
        source: FindingSource.AUDIT,
        severity: Severity.MEDIUM,
        affectedBusinessUnitIds: [testBusinessUnit.id],
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: "Finding",
          entityId: finding.id,
          action: AuditAction.FINDING_CREATED,
        },
      });

      expect(auditLog).not.toBeNull();

      const changes = auditLog?.changes as { after: Record<string, unknown> };
      expect(changes.after.identifier).toBe(finding.identifier);
      expect(changes.after.title).toBe("Audit Log Detail Test Finding");
      expect(changes.after.source).toBe("AUDIT");
      expect(changes.after.severity).toBe("MEDIUM");
      expect(changes.after.affectedBusinessUnits).toContain(testBusinessUnit.id);
    });
  });
});
