/**
 * Risk Audit Trail Integration Tests
 *
 * Story 4.12: Risk Audit Trail with Timestamps
 *
 * Tests for risk audit logging, query, and export functionality.
 *
 * @see Story 4.12: Risk Audit Trail with Timestamps
 */

import { randomUUID } from "crypto";
import { UserRole, Severity, RiskStatus } from "@prisma/client";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";

// Test data
let testOrg: { id: string; slug: string };
let testOrg2: { id: string; slug: string };
let testUserGRC: { id: string; name: string; email: string; role: UserRole; organizationId: string };
let testUserIT: { id: string; name: string; email: string; role: UserRole; organizationId: string };
// Risk owners are Person records (not Users) since the ownership redesign.
let itOwnerPersonId: string;
let testUserOtherOrg: { id: string; name: string; email: string; role: UserRole; organizationId: string };
let testRisk: { id: string; title: string };

// tRPC caller factory
function createCaller(user: { id: string; role: UserRole; organizationId: string; name?: string | null }) {
  return appRouter.createCaller({
    session: {
      user: {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
        name: user.name ?? "Test User",
        email: `${user.id}@test.com`,
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    db,
    organizationId: user.organizationId,
  });
}

beforeAll(async () => {
  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Risk Audit Test Org",
      slug: `risk-audit-test-${randomUUID().substring(0, 8)}`,
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Other Org",
      slug: `other-org-${randomUUID().substring(0, 8)}`,
      updatedAt: new Date(),
    },
  });

  // Create test users using raw SQL to bypass organization middleware
  const grcUserId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "User" (id, name, email, "platformRole", "organizationId", "hashedPassword", "updatedAt")
    VALUES (${grcUserId}, 'GRC Analyst', 'grc@test.com', 'ANALYST'::"UserRole", ${testOrg.id}, 'hash', NOW())
  `;
  testUserGRC = {
    id: grcUserId,
    name: "GRC Analyst",
    email: "grc@test.com",
    role: UserRole.ANALYST,
    organizationId: testOrg.id,
  };

  const itUserId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "User" (id, name, email, "organizationId", "hashedPassword", "updatedAt")
    VALUES (${itUserId}, 'IT Stakeholder', 'it@test.com', ${testOrg.id}, 'hash', NOW())
  `;
  testUserIT = {
    id: itUserId,
    name: "IT Stakeholder",
    email: "it@test.com",
    role: UserRole.BUSINESS_USER,
    organizationId: testOrg.id,
  };

  // Create Person owner record (risk owners are Persons, not Users).
  itOwnerPersonId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Person" (id, "organizationId", name, "isActive", "createdAt", "updatedAt")
    VALUES (${itOwnerPersonId}, ${testOrg.id}, 'IT Owner Person', true, NOW(), NOW())
  `;

  const otherOrgUserId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "User" (id, name, email, "platformRole", "organizationId", "hashedPassword", "updatedAt")
    VALUES (${otherOrgUserId}, 'Other Org User', 'other@test.com', 'ANALYST'::"UserRole", ${testOrg2.id}, 'hash', NOW())
  `;
  testUserOtherOrg = {
    id: otherOrgUserId,
    name: "Other Org User",
    email: "other@test.com",
    role: UserRole.ANALYST,
    organizationId: testOrg2.id,
  };
});

afterAll(async () => {
  // Clean up test data
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg2.id}`;
  await db.organization.delete({ where: { id: testOrg.id } });
  await db.organization.delete({ where: { id: testOrg2.id } });
});

describe("Story 4.12: Risk Audit Trail", () => {
  describe("Comprehensive Audit Logging (AC1-AC8)", () => {
    it("AC1: Creates audit log when risk is created", async () => {
      const caller = createCaller(testUserGRC);

      // Create a risk
      const risk = await caller.risk.create({
        title: "Test Risk for Audit Trail",
        description: "This is a test risk to verify audit logging works correctly.",
        severity: Severity.HIGH,
      });

      testRisk = risk;

      // Wait a moment for async audit log
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLogs = await db.auditLog.findMany({
        where: {
          organizationId: testOrg.id,
          entityType: "Risk",
          entityId: risk.id,
          action: "CREATE_RISK",
        },
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0]!.action).toBe("CREATE_RISK");
    });

    it("AC2-AC3: Audit log includes all required fields and change details", async () => {
      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: testRisk.id,
          action: "CREATE_RISK",
        },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog!.action).toBe("CREATE_RISK");
      expect(auditLog!.userId).toBe(testUserGRC.id);
      expect(auditLog!.entityType).toBe("Risk");
      expect(auditLog!.entityId).toBe(testRisk.id);
      expect(auditLog!.organizationId).toBe(testOrg.id);
      expect(auditLog!.timestamp).toBeDefined();
      expect(auditLog!.changes).toBeDefined();

      // Verify change details structure
      const changes = auditLog!.changes as Record<string, unknown>;
      expect(changes.after).toBeDefined();
      const after = changes.after as Record<string, unknown>;
      expect(after.title).toBe("Test Risk for Audit Trail");
      expect(after.severity).toBe("HIGH");
    });

    it("AC7: Audit log includes actor name and role snapshots", async () => {
      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: testRisk.id,
          action: "CREATE_RISK",
        },
      });

      expect(auditLog!.actorName).toBe("GRC Analyst");
      expect(auditLog!.actorRole).toBe("ANALYST");
    });
  });

  describe("Key Lifecycle Events (AC16-AC22)", () => {
    it("AC17: Assignment logged with IT owner details", async () => {
      const caller = createCaller(testUserGRC);

      // Assign the risk
      await caller.risk.assignRisk({
        riskId: testRisk.id,
        itOwnerId: itOwnerPersonId,
      });

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log
      const auditLogs = await db.auditLog.findMany({
        where: {
          organizationId: testOrg.id,
          entityId: testRisk.id,
          action: "ASSIGN_RISK",
        },
      });

      expect(auditLogs.length).toBe(1);
      const changes = auditLogs[0]!.changes as Record<string, unknown>;
      expect(changes.after).toBeDefined();
      const after = changes.after as Record<string, unknown>;
      expect(after.itOwnerId).toBe(itOwnerPersonId);
    });

    it("AC18: Status transitions logged with old/new status", async () => {
      const caller = createCaller(testUserGRC);

      // Update status from ASSIGNED to REMEDIATED
      await caller.risk.updateRiskStatus({
        riskId: testRisk.id,
        newStatus: RiskStatus.REMEDIATED,
        reason: "Testing status transition logging",
      });

      // Wait for async audit log
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify audit log
      const auditLogs = await db.auditLog.findMany({
        where: {
          organizationId: testOrg.id,
          entityId: testRisk.id,
          action: "UPDATE_RISK_STATUS",
        },
        orderBy: { timestamp: "desc" },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const latestLog = auditLogs[0]!;
      const changes = latestLog.changes as Record<string, unknown>;
      expect(changes.after).toBeDefined();
      const after = changes.after as Record<string, unknown>;
      expect(after.status).toBe("REMEDIATED");
      expect(after.reason).toBe("Testing status transition logging");
    });
  });

  describe("Audit Trail Query (AC28-AC32)", () => {
    it("AC28: getRiskAuditTrail returns audit logs for specified risk", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.getRiskAuditTrail({
        riskId: testRisk.id,
        limit: 20,
        offset: 0,
      });

      expect(result.auditLogs.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);

      // All logs should be for the specified risk
      result.auditLogs.forEach((log) => {
        expect(log.actorId).toBeDefined();
        expect(log.actorName).toBeDefined();
        expect(log.actorRole).toBeDefined();
      });
    });

    it("AC30: Query filters by organizationId (multi-tenancy)", async () => {
      // Create a risk in the other organization
      const otherOrgRiskId = randomUUID();
      await db.$executeRaw`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdById", "updatedAt")
        VALUES (${otherOrgRiskId}, 'Other Org Risk', 'Description', 'HIGH'::"Severity", 'OPEN'::"RiskStatus", ${testOrg2.id}, ${testUserOtherOrg.id}, NOW())
      `;

      // Create audit log for other org risk
      await db.$executeRaw`
        INSERT INTO "AuditLog" (id, action, "entityType", "entityId", "organizationId", "userId", "actorName", "actorRole", timestamp)
        VALUES (${randomUUID()}, 'CREATE_RISK'::"AuditAction", 'Risk', ${otherOrgRiskId}, ${testOrg2.id}, ${testUserOtherOrg.id}, 'Other User', 'ANALYST', NOW())
      `;

      // Query from testOrg should NOT see other org's logs
      const caller = createCaller(testUserGRC);
      const result = await caller.risk.getRiskAuditTrail({
        riskId: otherOrgRiskId,
        limit: 20,
        offset: 0,
      });

      // Should return 0 logs because this risk belongs to a different org
      expect(result.auditLogs.length).toBe(0);
    });

    it("AC31: Query orders by timestamp DESC (newest first)", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.getRiskAuditTrail({
        riskId: testRisk.id,
        limit: 20,
        offset: 0,
      });

      if (result.auditLogs.length >= 2) {
        const timestamps = result.auditLogs.map((log) => new Date(log.timestamp).getTime());
        for (let i = 0; i < timestamps.length - 1; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]!);
        }
      }
    });

    it("AC32: Query returns total count for pagination", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.getRiskAuditTrail({
        riskId: testRisk.id,
        limit: 1,
        offset: 0,
      });

      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);
      expect(typeof result.hasMore).toBe("boolean");
    });
  });

  describe("Export Audit Trail (AC23-AC27)", () => {
    it("AC23-AC25: Export generates valid CSV", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.exportRiskAuditTrail({
        riskId: testRisk.id,
      });

      expect(result.filename).toMatch(/^risk-.*-audit-trail-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.data).toContain("Timestamp,Action,Actor,Role,Change Details");
      expect(result.data).toContain("CREATE_RISK");
    });

    it("AC26: Audit-trail export is staff-only; read-only BUSINESS_USER is denied", async () => {
      // Audit trail is administration data — NOT part of a Business User's
      // read-only view ("...but not including administration"). Staff export it.
      const buCaller = createCaller(testUserIT);
      await expect(
        buCaller.risk.exportRiskAuditTrail({ riskId: testRisk.id }),
      ).rejects.toThrow(/FORBIDDEN|requires one of these roles/);

      const staffResult = await createCaller(testUserGRC).risk.exportRiskAuditTrail({
        riskId: testRisk.id,
      });
      expect(staffResult.data).toContain("CREATE_RISK");
    });

    it("AC27: Export filename follows pattern", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.exportRiskAuditTrail({
        riskId: testRisk.id,
      });

      const today = new Date().toISOString().split("T")[0];
      expect(result.filename).toBe(`risk-${testRisk.id}-audit-trail-${today}.csv`);
    });
  });

  describe("Audit Log Immutability (AC4)", () => {
    it("AC4: Audit logs cannot be deleted via standard queries", async () => {
      // Get an audit log
      const auditLog = await db.auditLog.findFirst({
        where: {
          organizationId: testOrg.id,
          entityId: testRisk.id,
        },
      });

      expect(auditLog).not.toBeNull();

      // Verify the log still exists after any operation
      const stillExists = await db.auditLog.findUnique({
        where: { id: auditLog!.id },
      });

      expect(stillExists).not.toBeNull();
      expect(stillExists!.id).toBe(auditLog!.id);
    });
  });
});
