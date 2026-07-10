/**
 * Evidence-to-Risk Linkage Integration Tests
 *
 * Tests for Story 3.6: Evidence-to-Risk Linkage
 *
 * **Critical Test Coverage:**
 * - Link evidence to risk (AC19-AC21)
 * - Unlink evidence from risk (AC22)
 * - Cascade delete on risk deletion (AC6)
 * - Cascade delete on evidence deletion (AC5)
 * - Duplicate link prevention (AC21)
 * - Cross-organization linkage prevention (AC20)
 * - Role-based permission enforcement (AC24-AC25)
 * - Audit logging (AC23)
 *
 * @see Story 3.6: Evidence-to-Risk Linkage
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, RiskEvidenceLinkType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Test data
let testOrg: { id: string; name: string };
let testOrg2: { id: string; name: string };
let testUserGRC: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserIT: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserOrg2: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testEvidence: { id: string; title: string };
let testRisk: { id: string; title: string };
let testEvidenceOrg2: { id: string; title: string };
let testRiskOrg2: { id: string; title: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-evidence-risk-link" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${existingOrg.id})`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  const existingOrg2 = await db.organization.findUnique({
    where: { slug: "test-org-evidence-risk-link-2" },
  });
  if (existingOrg2) {
    await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${existingOrg2.id})`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg2.id}`;
  }

  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Evidence Risk Link",
      slug: "test-org-evidence-risk-link",
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Evidence Risk Link 2",
      slug: "test-org-evidence-risk-link-2",
      updatedAt: new Date(),
    },
  });

  // Create test users with different roles
  const createdUserGRC = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User GRC",
      email: "test-grc@evidence-risk-link.com",
      role: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserGRC = {
    id: createdUserGRC.id,
    email: createdUserGRC.email!,
    role: createdUserGRC.role,
    organizationId: createdUserGRC.organizationId,
    name: createdUserGRC.name!,
  };

  const createdUserIT = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User IT",
      email: "test-it@evidence-risk-link.com",
      role: "BUSINESS_USER",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserIT = {
    id: createdUserIT.id,
    email: createdUserIT.email!,
    role: createdUserIT.role,
    organizationId: createdUserIT.organizationId,
    name: createdUserIT.name!,
  };

  const createdUserAuditor = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User Auditor",
      email: "test-auditor@evidence-risk-link.com",
      role: "BUSINESS_USER",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserAuditor = {
    id: createdUserAuditor.id,
    email: createdUserAuditor.email!,
    role: createdUserAuditor.role,
    organizationId: createdUserAuditor.organizationId,
    name: createdUserAuditor.name!,
  };

  const createdUserSE = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User SE",
      email: "test-se@evidence-risk-link.com",
      role: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserSecurityEngineer = {
    id: createdUserSE.id,
    email: createdUserSE.email!,
    role: createdUserSE.role,
    organizationId: createdUserSE.organizationId,
    name: createdUserSE.name!,
  };

  const createdUserOrg2 = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User Org2",
      email: "test-org2@evidence-risk-link.com",
      role: "ANALYST",
      organizationId: testOrg2.id,
      updatedAt: new Date(),
    },
  });
  testUserOrg2 = {
    id: createdUserOrg2.id,
    email: createdUserOrg2.email!,
    role: createdUserOrg2.role,
    organizationId: createdUserOrg2.organizationId,
    name: createdUserOrg2.name!,
  };

  // Create test evidence using raw SQL to bypass organization filter
  const evidenceId = randomUUID();
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId}, ${testOrg.id}, 'Test Evidence for Risk Link', 'test-evidence.pdf', '/test/evidence.pdf', 1024, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
  `;
  testEvidence = { id: evidenceId, title: "Test Evidence for Risk Link" };

  // Create test risk using raw SQL
  const riskId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
    VALUES (${riskId}, ${testOrg.id}, 'Test Risk for Evidence Link', 'Test risk description', 'HIGH', 'OPEN', ${now}, ${now})
  `;
  testRisk = { id: riskId, title: "Test Risk for Evidence Link" };

  // Create evidence and risk for second organization using raw SQL
  const evidenceId2 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
    VALUES (${evidenceId2}, ${testOrg2.id}, 'Test Evidence Org2', 'test-evidence-org2.pdf', '/test/evidence-org2.pdf', 1024, 'application/pdf', ${testUserOrg2.id}, true, 1, ${now}, ${now})
  `;
  testEvidenceOrg2 = { id: evidenceId2, title: "Test Evidence Org2" };

  const riskId2 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
    VALUES (${riskId2}, ${testOrg2.id}, 'Test Risk Org2', 'Test risk description org2', 'MEDIUM', 'OPEN', ${now}, ${now})
  `;
  testRiskOrg2 = { id: riskId2, title: "Test Risk Org2" };
});

afterAll(async () => {
  // Cleanup
  if (testOrg) {
    await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg.id})`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }

  if (testOrg2) {
    await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" IN (SELECT id FROM "Risk" WHERE "organizationId" = ${testOrg2.id})`;
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg2.id}`;
  }
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: typeof testUserGRC) {
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
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("Evidence-to-Risk Linkage", () => {
  describe("linkEvidenceToRisk mutation (AC19-AC21)", () => {
    afterEach(async () => {
      // Clean up any links created during tests
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${testRisk.id}`;
    });

    it("should link evidence to risk as FINDING type (AC19)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      expect(result).toBeDefined();
      expect(result.riskId).toBe(testRisk.id);
      expect(result.evidenceId).toBe(testEvidence.id);
      expect(result.linkType).toBe(RiskEvidenceLinkType.FINDING);

      // Verify in database
      const link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: testRisk.id,
            evidenceId: testEvidence.id,
          },
        },
      });
      expect(link).toBeDefined();
      expect(link!.linkType).toBe("FINDING");
    });

    it("should link evidence to risk as REMEDIATION type (AC19)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.REMEDIATION,
      });

      expect(result).toBeDefined();
      expect(result.linkType).toBe(RiskEvidenceLinkType.REMEDIATION);
    });

    it("should prevent duplicate links (AC21)", async () => {
      const caller = createCaller(testUserGRC);

      // Create first link
      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      // Attempt duplicate link
      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.REMEDIATION,
        })
      ).rejects.toThrow(TRPCError);

      // Verify error code is CONFLICT
      try {
        await caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.REMEDIATION,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("CONFLICT");
      }
    });

    it("should prevent cross-organization linkage (AC20)", async () => {
      const caller = createCaller(testUserGRC);

      // Try to link evidence from org1 to risk from org2
      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRiskOrg2.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.FINDING,
        })
      ).rejects.toThrow(TRPCError);

      // Try to link evidence from org2 to risk from org1
      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidenceOrg2.id,
          linkType: RiskEvidenceLinkType.FINDING,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should create audit log on successful link (AC23)", async () => {
      const caller = createCaller(testUserGRC);

      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      // Wait a brief moment for async audit log
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          action: "LINK_EVIDENCE_TO_RISK",
          userId: testUserGRC.id,
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.entityType).toBe("RiskEvidence");
    });

    it("should not allow linking soft-deleted evidence", async () => {
      // Create soft-deleted evidence using raw SQL
      const deletedEvidenceId = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "deletedAt", "createdAt", "updatedAt")
        VALUES (${deletedEvidenceId}, ${testOrg.id}, 'Deleted Evidence', 'deleted.pdf', '/test/deleted.pdf', 1024, 'application/pdf', ${testUserGRC.id}, false, 1, ${now}, ${now}, ${now})
      `;

      const caller = createCaller(testUserGRC);

      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: deletedEvidenceId,
          linkType: RiskEvidenceLinkType.FINDING,
        })
      ).rejects.toThrow(TRPCError);

      // Cleanup
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${deletedEvidenceId}`;
    });
  });

  describe("unlinkEvidenceFromRisk mutation (AC22)", () => {
    it("should unlink evidence from risk", async () => {
      const caller = createCaller(testUserGRC);

      // First create a link
      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      // Verify link exists
      let link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: testRisk.id,
            evidenceId: testEvidence.id,
          },
        },
      });
      expect(link).toBeDefined();

      // Unlink
      const result = await caller.risk.unlinkEvidenceFromRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
      });

      expect(result.success).toBe(true);

      // Verify link is removed
      link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: testRisk.id,
            evidenceId: testEvidence.id,
          },
        },
      });
      expect(link).toBeNull();
    });

    it("should create audit log on unlink (AC23)", async () => {
      const caller = createCaller(testUserGRC);

      // Create a link
      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      // Unlink
      await caller.risk.unlinkEvidenceFromRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
      });

      // Wait a brief moment for async audit log
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          action: "UNLINK_EVIDENCE_FROM_RISK",
          userId: testUserGRC.id,
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.entityType).toBe("RiskEvidence");
    });

    it("should throw NOT_FOUND when unlinking non-existent link", async () => {
      const caller = createCaller(testUserGRC);

      await expect(
        caller.risk.unlinkEvidenceFromRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.risk.unlinkEvidenceFromRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("Cascade Delete (AC5, AC6)", () => {
    it("should cascade delete RiskEvidence when evidence is deleted (AC5)", async () => {
      // Create temporary evidence for this test using raw SQL
      const tempEvidenceId = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
        VALUES (${tempEvidenceId}, ${testOrg.id}, 'Temp Evidence for Cascade Test', 'temp-evidence.pdf', '/test/temp-evidence.pdf', 1024, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
      `;

      // Link evidence to risk
      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: testRisk.id,
          evidenceId: tempEvidenceId,
          linkType: "FINDING",
          linkedById: testUserGRC.id,
        },
      });

      // Verify link exists
      let link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: testRisk.id,
            evidenceId: tempEvidenceId,
          },
        },
      });
      expect(link).toBeDefined();

      // Delete evidence using raw SQL
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${tempEvidenceId}`;

      // Verify link is cascade deleted
      link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: testRisk.id,
            evidenceId: tempEvidenceId,
          },
        },
      });
      expect(link).toBeNull();
    });

    it("should cascade delete RiskEvidence when risk is deleted (AC6)", async () => {
      // Create temporary risk for this test using raw SQL
      const tempRiskId = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
        VALUES (${tempRiskId}, ${testOrg.id}, 'Temp Risk for Cascade Test', 'Temp risk description', 'LOW', 'OPEN', ${now}, ${now})
      `;

      // Link evidence to risk
      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: tempRiskId,
          evidenceId: testEvidence.id,
          linkType: "REMEDIATION",
          linkedById: testUserGRC.id,
        },
      });

      // Verify link exists
      let link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: tempRiskId,
            evidenceId: testEvidence.id,
          },
        },
      });
      expect(link).toBeDefined();

      // Delete risk using raw SQL
      await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${tempRiskId}`;

      // Verify link is cascade deleted
      link = await db.riskEvidence.findUnique({
        where: {
          riskId_evidenceId: {
            riskId: tempRiskId,
            evidenceId: testEvidence.id,
          },
        },
      });
      expect(link).toBeNull();
    });
  });

  describe("getRiskEvidence query (AC7-AC9)", () => {
    beforeEach(async () => {
      // Clean up any existing links
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${testRisk.id}`;
    });

    it("should return grouped evidence by link type (AC8)", async () => {
      // Create another evidence for multiple links using raw SQL
      const evidence2Id = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
        VALUES (${evidence2Id}, ${testOrg.id}, 'Second Evidence', 'second-evidence.pdf', '/test/second-evidence.pdf', 2048, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
      `;

      // Create links with different types
      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: "FINDING",
          linkedById: testUserGRC.id,
        },
      });

      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: testRisk.id,
          evidenceId: evidence2Id,
          linkType: "REMEDIATION",
          linkedById: testUserGRC.id,
        },
      });

      const caller = createCaller(testUserGRC);
      const result = await caller.risk.getRiskEvidence({ riskId: testRisk.id });

      expect(result.findingEvidence).toHaveLength(1);
      expect(result.findingEvidence[0]!.id).toBe(testEvidence.id);
      expect(result.remediationEvidence).toHaveLength(1);
      expect(result.remediationEvidence[0]!.id).toBe(evidence2Id);
      expect(result.totalCount).toBe(2);

      // Cleanup
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence2Id}`;
    });

    it("should include evidence metadata (AC9)", async () => {
      // Create link
      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: "FINDING",
          linkedById: testUserGRC.id,
        },
      });

      const caller = createCaller(testUserGRC);
      const result = await caller.risk.getRiskEvidence({ riskId: testRisk.id });

      expect(result.findingEvidence[0]).toMatchObject({
        id: testEvidence.id,
        title: testEvidence.title,
        originalFileName: "test-evidence.pdf",
        linkType: "FINDING",
      });
      expect(result.findingEvidence[0]!.linkedBy).toBeDefined();
    });
  });

  describe("getLinkedRisks query (AC15-AC17)", () => {
    beforeEach(async () => {
      // Clean up any existing links
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "evidenceId" = ${testEvidence.id}`;
    });

    it("should return linked risks for evidence", async () => {
      // Create link
      await db.riskEvidence.create({
        data: {
          id: randomUUID(),
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: "FINDING",
          linkedById: testUserGRC.id,
        },
      });

      const caller = createCaller(testUserGRC);
      const result = await caller.evidence.getLinkedRisks({
        evidenceId: testEvidence.id,
      });

      expect(result.linkedRisks).toHaveLength(1);
      expect(result.linkedRisks[0]).toMatchObject({
        id: testRisk.id,
        title: testRisk.title,
        severity: "HIGH",
        status: "OPEN",
        linkType: "FINDING",
      });
      expect(result.totalCount).toBe(1);
    });

    it("should order by severity (HIGH → MEDIUM → LOW) (AC17)", async () => {
      // Create risks with different severities using raw SQL
      const mediumRiskId = randomUUID();
      const lowRiskId = randomUUID();
      const now = new Date();

      await db.$executeRaw`
        INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
        VALUES (${mediumRiskId}, ${testOrg.id}, 'Medium Risk', 'Medium severity', 'MEDIUM', 'OPEN', ${now}, ${now})
      `;

      await db.$executeRaw`
        INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
        VALUES (${lowRiskId}, ${testOrg.id}, 'Low Risk', 'Low severity', 'LOW', 'OPEN', ${now}, ${now})
      `;

      // Link evidence to all risks
      await db.riskEvidence.createMany({
        data: [
          {
            id: randomUUID(),
            riskId: lowRiskId,
            evidenceId: testEvidence.id,
            linkType: "FINDING",
            linkedById: testUserGRC.id,
          },
          {
            id: randomUUID(),
            riskId: testRisk.id,
            evidenceId: testEvidence.id,
            linkType: "FINDING",
            linkedById: testUserGRC.id,
          },
          {
            id: randomUUID(),
            riskId: mediumRiskId,
            evidenceId: testEvidence.id,
            linkType: "FINDING",
            linkedById: testUserGRC.id,
          },
        ],
      });

      const caller = createCaller(testUserGRC);
      const result = await caller.evidence.getLinkedRisks({
        evidenceId: testEvidence.id,
      });

      expect(result.linkedRisks).toHaveLength(3);
      expect(result.linkedRisks[0]!.severity).toBe("HIGH");
      expect(result.linkedRisks[1]!.severity).toBe("MEDIUM");
      expect(result.linkedRisks[2]!.severity).toBe("LOW");

      // Cleanup
      await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${mediumRiskId}`;
      await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${lowRiskId}`;
    });
  });

  describe("Role-Based Permissions (AC24-AC27)", () => {
    beforeEach(async () => {
      // Clean up any existing links before each test
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${testRisk.id}`;
    });

    afterEach(async () => {
      // Clean up any links created during tests
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${testRisk.id}`;
    });

    it("should allow GRC Analyst to link evidence (AC24)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      expect(result).toBeDefined();
    });

    it("should allow Security Engineer to link evidence (AC24)", async () => {
      const caller = createCaller(testUserSecurityEngineer);

      const result = await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      expect(result).toBeDefined();
    });

    it("should allow IT Stakeholder to link REMEDIATION evidence only (AC25)", async () => {
      const caller = createCaller(testUserIT);

      // Should succeed with REMEDIATION type
      const result = await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.REMEDIATION,
      });

      expect(result).toBeDefined();
      expect(result.linkType).toBe("REMEDIATION");
    });

    it("should deny IT Stakeholder from linking FINDING evidence (AC25)", async () => {
      const caller = createCaller(testUserIT);

      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.FINDING,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.FINDING,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    it("should deny Auditor from linking evidence (AC27)", async () => {
      const caller = createCaller(testUserAuditor);

      await expect(
        caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.FINDING,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.risk.linkEvidenceToRisk({
          riskId: testRisk.id,
          evidenceId: testEvidence.id,
          linkType: RiskEvidenceLinkType.FINDING,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    it("should allow Auditor to view linked evidence (AC27)", async () => {
      // First create a link as GRC user
      const grcCaller = createCaller(testUserGRC);
      await grcCaller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      // Auditor should be able to query evidence
      const auditorCaller = createCaller(testUserAuditor);
      const result = await auditorCaller.risk.getRiskEvidence({
        riskId: testRisk.id,
      });

      expect(result.findingEvidence).toHaveLength(1);
    });
  });

  describe("Many-to-Many Relationships (AC3, AC4)", () => {
    afterEach(async () => {
      // Clean up any links and temporary resources
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${testRisk.id}`;
    });

    it("should allow same evidence to be linked to multiple risks (AC3)", async () => {
      // Create second risk using raw SQL
      const risk2Id = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "createdAt", "updatedAt")
        VALUES (${risk2Id}, ${testOrg.id}, 'Second Risk', 'Second risk description', 'MEDIUM', 'OPEN', ${now}, ${now})
      `;

      const caller = createCaller(testUserGRC);

      // Link same evidence to both risks
      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      await caller.risk.linkEvidenceToRisk({
        riskId: risk2Id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.REMEDIATION,
      });

      // Verify evidence is linked to both
      const linkedRisks = await caller.evidence.getLinkedRisks({
        evidenceId: testEvidence.id,
      });

      expect(linkedRisks.totalCount).toBe(2);

      // Cleanup
      await db.$executeRaw`DELETE FROM "RiskEvidence" WHERE "riskId" = ${risk2Id}`;
      await db.$executeRaw`DELETE FROM "Risk" WHERE id = ${risk2Id}`;
    });

    it("should allow same risk to have multiple evidence files linked (AC4)", async () => {
      // Create second evidence using raw SQL
      const evidence2Id = randomUUID();
      const now = new Date();
      await db.$executeRaw`
        INSERT INTO "Evidence" (id, "organizationId", title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "isActive", "currentVersion", "createdAt", "updatedAt")
        VALUES (${evidence2Id}, ${testOrg.id}, 'Second Evidence', 'evidence2.pdf', '/test/evidence2.pdf', 2048, 'application/pdf', ${testUserGRC.id}, true, 1, ${now}, ${now})
      `;

      const caller = createCaller(testUserGRC);

      // Link both evidence files to same risk
      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: testEvidence.id,
        linkType: RiskEvidenceLinkType.FINDING,
      });

      await caller.risk.linkEvidenceToRisk({
        riskId: testRisk.id,
        evidenceId: evidence2Id,
        linkType: RiskEvidenceLinkType.REMEDIATION,
      });

      // Verify both evidence files are linked
      const riskEvidence = await caller.risk.getRiskEvidence({
        riskId: testRisk.id,
      });

      expect(riskEvidence.totalCount).toBe(2);
      expect(riskEvidence.findingEvidence).toHaveLength(1);
      expect(riskEvidence.remediationEvidence).toHaveLength(1);

      // Cleanup
      await db.$executeRaw`DELETE FROM "Evidence" WHERE id = ${evidence2Id}`;
    });
  });
});
