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
    "ANALYST",
    testOrg.id
  );

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@finding-creation.test",
    "ANALYST",
    testOrg.id
  );

  testUserOrgAdmin = await createUser(
    "Org Admin",
    "admin@finding-creation.test",
    "ADMINISTRATOR",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@finding-creation.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@finding-creation.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@finding-creation.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserOrg2 = await createUser(
    "User Org 2",
    "user@finding-creation-org2.test",
    "ANALYST",
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

/**
 * Story 20.1: Score a Finding at Creation (Risk Model Cleanup Epic 20)
 *
 * AC1: All finding creation entry points persist matrix L×I(×E) scoring with
 *      matrixVersionId locked at create.
 * AC2: Coarse severity is auto-derived from the matrix threshold label.
 */
describe("Story 20.1: Matrix scoring at creation", () => {
  // 5×5 matrix, outputScaleMax 25 → normalizedScore = L×I
  const SCALES = {
    likelihood: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
    impact: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
  };
  const THRESHOLDS = [
    { minValue: 0, maxValue: 6, label: "Low", color: "#22C55E", sortOrder: 0, slaDays: 90 },
    { minValue: 6, maxValue: 12, label: "Medium", color: "#EAB308", sortOrder: 1, slaDays: 30 },
    { minValue: 12, maxValue: 20, label: "High", color: "#F97316", sortOrder: 2, slaDays: 14 },
    { minValue: 20, maxValue: 25.1, label: "Critical", color: "#EF4444", sortOrder: 3, slaDays: 7 },
  ];

  let defaultVersionId: string;
  let secondVersionId: string;
  let questionnaireResponseId: string;

  beforeAll(async () => {
    // Default org matrix (explicit-version-omitted path locks this one)
    const defaultTemplateId = randomUUID();
    defaultVersionId = randomUUID();
    // Second, non-default matrix (explicit matrixVersionId path locks this one)
    const secondTemplateId = randomUUID();
    secondVersionId = randomUUID();

    await runWithOrganizationContext(testOrg.id, async () => {
      await db.riskMatrixTemplate.create({
        data: {
          id: defaultTemplateId,
          organizationId: testOrg.id,
          name: "Story 20.1 Default 5×5",
          dimensionCount: 2,
          gridSize: 5,
          outputScaleMax: 25,
          isActive: true,
          isDefault: true,
          updatedAt: new Date(),
        },
      });
      await db.riskMatrixVersion.create({
        data: {
          id: defaultVersionId,
          templateId: defaultTemplateId,
          versionNumber: 1,
          scales: SCALES as never,
          thresholds: THRESHOLDS as never,
          isActive: true,
          publishedAt: new Date(),
        },
      });
      await db.riskMatrixTemplate.update({
        where: { id: defaultTemplateId },
        data: { currentVersionId: defaultVersionId },
      });

      await db.riskMatrixTemplate.create({
        data: {
          id: secondTemplateId,
          organizationId: testOrg.id,
          name: "Story 20.1 Secondary 5×5",
          dimensionCount: 2,
          gridSize: 5,
          outputScaleMax: 25,
          isActive: true,
          isDefault: false,
          updatedAt: new Date(),
        },
      });
      await db.riskMatrixVersion.create({
        data: {
          id: secondVersionId,
          templateId: secondTemplateId,
          versionNumber: 1,
          scales: SCALES as never,
          thresholds: THRESHOLDS as never,
          isActive: true,
          publishedAt: new Date(),
        },
      });
      await db.riskMatrixTemplate.update({
        where: { id: secondTemplateId },
        data: { currentVersionId: secondVersionId },
      });
    });

    // Vendor questionnaire chain for createFromQuestionnaireResponse (AC1).
    // Org-scoped models must be created inside the org context.
    await runWithOrganizationContext(testOrg.id, async () => {
      const vendor = await db.vendor.create({
        data: {
          id: randomUUID(),
          identifier: "VND-2099-9001",
          organizationId: testOrg.id,
          name: "Story 20.1 Test Vendor",
          updatedAt: new Date(),
        },
      });
      const vendorAssessment = await db.vendorAssessment.create({
        data: {
          id: randomUUID(),
          identifier: "VA-2099-9001",
          organizationId: testOrg.id,
          vendorId: vendor.id,
          title: "Story 20.1 Vendor Assessment",
          updatedAt: new Date(),
        },
      });
      const template = await db.questionnaireTemplate.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          name: "Story 20.1 Questionnaire Template",
          updatedAt: new Date(),
        },
      });
      const section = await db.questionnaireSection.create({
        data: {
          id: randomUUID(),
          templateId: template.id,
          title: "Security",
          updatedAt: new Date(),
        },
      });
      const question = await db.questionnaireQuestion.create({
        data: {
          id: randomUUID(),
          sectionId: section.id,
          questionText: "Do you enforce MFA for all remote access?",
          questionType: "YES_NO",
          updatedAt: new Date(),
        },
      });
      const questionnaire = await db.assessmentQuestionnaire.create({
        data: {
          id: randomUUID(),
          assessmentId: vendorAssessment.id,
          templateId: template.id,
          updatedAt: new Date(),
        },
      });
      const response = await db.questionnaireResponse.create({
        data: {
          id: randomUUID(),
          questionnaireId: questionnaire.id,
          questionId: question.id,
          textResponse: "No",
          updatedAt: new Date(),
        },
      });
      questionnaireResponseId = response.id;
    });
  });

  afterAll(async () => {
    // Findings referencing these fixtures are cleaned by the file-level afterAll;
    // here we tear down the questionnaire chain and matrices (children first).
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id} AND "questionnaireResponseId" IS NOT NULL`;
    await db.$executeRaw`DELETE FROM "QuestionnaireResponse" WHERE "questionnaireId" IN (SELECT aq.id FROM "AssessmentQuestionnaire" aq JOIN "VendorAssessment" va ON aq."assessmentId" = va.id WHERE va."organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "AssessmentQuestionnaire" WHERE "assessmentId" IN (SELECT id FROM "VendorAssessment" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "QuestionnaireTemplate" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "VendorAssessment" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Vendor" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`UPDATE "RiskMatrixTemplate" SET "currentVersionId" = NULL WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "RiskMatrixVersion" WHERE "templateId" IN (SELECT id FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "RiskMatrixTemplate" WHERE "organizationId" = ${testOrg.id}`;
    // Card-parity fixtures: findings cascade their junctions; the global MITRE
    // technique and org control need explicit cleanup (findings deleted by the
    // file-level afterAll, but FKs cascade from these deletes safely).
    await db.$executeRaw`DELETE FROM "Finding" WHERE "organizationId" = ${testOrg.id} AND title LIKE 'Card-parity finding%'`;
    await db.$executeRaw`DELETE FROM "MitreTechnique" WHERE name = 'Story 20.1 Test Technique'`;
    await db.$executeRaw`DELETE FROM "OrganizationalControl" WHERE "organizationId" = ${testOrg.id} AND name = 'Story 20.1 Test Org Control'`;
  });

  it("AC1: finding.create with L×I locks the org default matrix and persists inherent scores", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.create({
      title: "Matrix-scored finding via default matrix",
      description: "Scored L5×I5 against the org default matrix — expect Critical.",
      source: FindingSource.PENTEST,
      severity: Severity.LOW, // deliberately wrong — server must override (AC2)
      likelihood: 5,
      impact: 5,
    });

    expect(result.matrixVersionId).toBe(defaultVersionId);
    expect(Number(result.inherentLikelihood)).toBe(5);
    expect(Number(result.inherentImpact)).toBe(5);
    expect(Number(result.inherentScore)).toBe(25);
    expect(result.severityLabel).toBe("Critical");
    expect(result.severity).toBe(Severity.HIGH); // derived, client LOW overridden
  });

  it("AC1 (NFR3): explicit matrixVersionId is honored and locked", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.create({
      title: "Matrix-scored finding via explicit version",
      description: "Scored against a non-default matrix version to verify locking.",
      source: FindingSource.AUDIT,
      severity: Severity.MEDIUM,
      likelihood: 2,
      impact: 3,
      matrixVersionId: secondVersionId,
    });

    expect(result.matrixVersionId).toBe(secondVersionId);
    expect(Number(result.inherentScore)).toBe(6);
    expect(result.severityLabel).toBe("Medium");
  });

  it("AC2: low matrix score derives severity LOW even when client sends HIGH", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.create({
      title: "Matrix-scored finding derives low severity",
      description: "Scored L1×I1 — the Low threshold label must drive the enum.",
      source: FindingSource.SCANNER,
      severity: Severity.HIGH, // deliberately wrong
      likelihood: 1,
      impact: 1,
    });

    expect(result.severityLabel).toBe("Low");
    expect(result.severity).toBe(Severity.LOW);
  });

  it("AC1: exposure is not stored for a 2D matrix", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.create({
      title: "Exposure ignored on 2D matrix finding",
      description: "Exposure supplied against a 2D matrix must not be persisted.",
      source: FindingSource.MANUAL,
      severity: Severity.MEDIUM,
      likelihood: 3,
      impact: 3,
      exposure: 5,
    });

    expect(result.inherentExposure).toBeNull();
    expect(Number(result.inherentScore)).toBe(9);
  });

  it("Follow-up: finding context fields (cveId, discoveryDate, technicalDetails) persist through create", async () => {
    const caller = createCaller(testUserGRCAnalyst);
    const discoveryDate = new Date("2026-06-15T00:00:00.000Z");

    const result = await caller.finding.create({
      title: "Context-documented finding from risks/new form parity",
      description: "Verifies the finding-context documentation fields ported from the risk form.",
      source: FindingSource.SCANNER,
      severity: Severity.MEDIUM,
      likelihood: 2,
      impact: 2,
      cveId: "CVE-2026-0042",
      discoveryDate,
      technicalDetails: "## Repro\n\n1. Scan host\n2. Observe open port",
    });

    expect(result.cveId).toBe("CVE-2026-0042");
    expect(result.discoveryDate?.toISOString()).toBe(discoveryDate.toISOString());
    expect(result.technicalDetails).toContain("## Repro");
    expect(Number(result.inherentScore)).toBe(4);
  });

  it("Follow-up: identified-risk-card parity — residual scoring, MITRE, control links, remediation options persist", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    // Minimal MITRE + org-control fixtures
    const tacticStamp = Date.now();
    const technique = await db.mitreTechnique.create({
      data: {
        id: randomUUID(),
        externalId: `T9999.${tacticStamp % 100000}`,
        name: "Story 20.1 Test Technique",
        description: "test technique for card-parity finding",
        url: "https://attack.mitre.org/techniques/T9999/",
      },
    });
    let orgControl: { id: string };
    await runWithOrganizationContext(testOrg.id, async () => {
      orgControl = await db.organizationalControl.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          localControlId: `OC-2099-${tacticStamp % 100000}`,
          name: "Story 20.1 Test Org Control",
        },
      });
    });

    const result = await caller.finding.create({
      title: "Card-parity finding with residual + MITRE + controls",
      description: "Verifies the identified-risk-card fields persist on the finding.",
      source: FindingSource.PENTEST,
      severity: Severity.MEDIUM,
      likelihood: 5,
      impact: 4,
      residualLikelihood: 2,
      residualImpact: 2,
      initialAccessVectorId: technique.id,
      threatStepIds: [technique.id],
      threatObjectiveIds: [technique.id],
      mitigatingControlIds: [orgControl!.id],
      controlGapIds: [orgControl!.id], // same id — mitigating role wins, no dup
      remediationOptions: [
        {
          title: "Patch the jump host",
          description: "Apply vendor patches",
          approach: "Patch management cycle",
          costEstimate: 500,
          timelineEstimate: "2 weeks",
          effortLevel: "LOW",
          priority: "RECOMMENDED",
        },
      ],
    });

    expect(Number(result.inherentScore)).toBe(20);
    expect(Number(result.residualScore)).toBe(4);
    expect(result.residualScoreLabel).toBe("Low");
    expect(result.initialAccessVectorId).toBe(technique.id);

    await runWithOrganizationContext(testOrg.id, async () => {
      const steps = await db.findingThreatStep.findMany({ where: { findingId: result.id } });
      const objectives = await db.findingThreatObjective.findMany({ where: { findingId: result.id } });
      const controlLinks = await db.findingOrganizationalControl.findMany({ where: { findingId: result.id } });
      const options = await db.remediationOption.findMany({ where: { findingId: result.id } });

      expect(steps).toHaveLength(1);
      expect(objectives).toHaveLength(1);
      expect(controlLinks).toHaveLength(1); // deduped — IN_PLACE wins
      expect(controlLinks[0]!.role).toBe("IN_PLACE");
      expect(options).toHaveLength(1);
      expect(options[0]!.title).toBe("Patch the jump host");
      expect(options[0]!.riskId).toBeNull();
    });
  });

  it("Follow-up: linkedRiskIds creates RiskFindingLink rows and RISK_ASSESSMENT source is accepted", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    let riskId = "";
    await runWithOrganizationContext(testOrg.id, async () => {
      const risk = await db.risk.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          title: "Story 20.1 linkable register risk",
          description: "Risk to link a finding against",
          severity: Severity.MEDIUM,
          updatedAt: new Date(),
        },
      });
      riskId = risk.id;
    });

    const result = await caller.finding.create({
      title: "Card-parity finding linked to a register risk",
      description: "Verifies linkedRiskIds → RiskFindingLink and the new source value.",
      source: FindingSource.RISK_ASSESSMENT,
      severity: Severity.MEDIUM,
      likelihood: 2,
      impact: 3,
      linkedRiskIds: [riskId],
    });

    expect(result.source).toBe(FindingSource.RISK_ASSESSMENT);

    const links = await db.$queryRaw<Array<{ riskId: string }>>`
      SELECT "riskId" FROM "RiskFindingLink" WHERE "findingId" = ${result.id}
    `;
    expect(links).toHaveLength(1);
    expect(links[0]!.riskId).toBe(riskId);

    await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${riskId}`;
  });

  it("Follow-up: residualEliminated persists the ELIMINATED label with no numeric residual", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.create({
      title: "Card-parity finding with eliminated residual",
      description: "Controls fully remove this finding's residual exposure.",
      source: FindingSource.AUDIT,
      severity: Severity.MEDIUM,
      likelihood: 3,
      impact: 3,
      residualEliminated: true,
    });

    expect(result.residualScoreLabel).toBe("ELIMINATED");
    expect(result.residualScore).toBeNull();
    expect(result.residualEliminated).toBe(true);
  });

  it("AC1: createFromQuestionnaireResponse persists matrix scoring (vendor entry point)", async () => {
    const caller = createCaller(testUserGRCAnalyst);

    const result = await caller.finding.createFromQuestionnaireResponse({
      questionnaireResponseId,
      title: "Vendor lacks MFA on remote access",
      description: "Vendor answered No to MFA enforcement — scored against the org matrix.",
      severity: Severity.LOW, // deliberately wrong — server must override (AC2)
      likelihood: 4,
      impact: 5,
    });

    expect(result.matrixVersionId).toBe(defaultVersionId);
    expect(Number(result.inherentLikelihood)).toBe(4);
    expect(Number(result.inherentImpact)).toBe(5);
    expect(Number(result.inherentScore)).toBe(20);
    expect(result.severityLabel).toBe("Critical");
    expect(result.severity).toBe(Severity.HIGH);
  });
});
