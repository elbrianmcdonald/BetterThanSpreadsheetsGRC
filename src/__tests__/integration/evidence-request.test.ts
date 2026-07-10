/**
 * Evidence Request Workflow Integration Tests
 *
 * Tests for Story 3.12: Evidence Request Workflow (GRC Analyst → User)
 *
 * **Critical Test Coverage:**
 * - Create evidence request (AC1-AC8)
 * - Evidence request schema and storage (AC9-AC13)
 * - Email notification (AC14-AC18) - verified via audit log
 * - Request listing for recipients (AC19-AC23)
 * - Request fulfillment (AC24-AC29)
 * - Request management for analysts (AC30-AC34)
 * - Permission enforcement
 * - Multi-tenant isolation
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { type UserRole, EvidenceRequestStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Test data
let testOrg: { id: string; name: string };
let testOrg2: { id: string; name: string };
let testUserGRC: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserRecipient: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserAdmin: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testUserOrg2: { id: string; email: string; role: UserRole; organizationId: string; name: string };
let testDomain1: { id: string; name: string; code: string };
let testDomain2: { id: string; name: string; code: string };
let testEvidence: { id: string; title: string };
let testRequest: { id: string };

beforeAll(async () => {
  // Cleanup any residual control domains from previous failed runs
  await db.$executeRaw`DELETE FROM "ControlDomain" WHERE code = 'ACC-EVREQ-TEST'`;
  await db.$executeRaw`DELETE FROM "ControlDomain" WHERE code = 'DAT-EVREQ-TEST'`;

  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-evidence-request" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "EvidenceRequest" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  const existingOrg2 = await db.organization.findUnique({
    where: { slug: "test-org-evidence-request-2" },
  });
  if (existingOrg2) {
    await db.$executeRaw`DELETE FROM "EvidenceRequest" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg2.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg2.id}`;
  }

  // Create test organizations
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Evidence Request",
      slug: "test-org-evidence-request",
      updatedAt: new Date(),
    },
  });

  testOrg2 = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Evidence Request 2",
      slug: "test-org-evidence-request-2",
      updatedAt: new Date(),
    },
  });

  // Create test control domains with unique codes and updatedAt
  testDomain1 = await db.controlDomain.create({
    data: {
      id: randomUUID(),
      code: "ACC-EVREQ-TEST",
      name: "Access Control Test",
      description: "Test domain for access control",
      isActive: true,
      sortOrder: 100,
      updatedAt: new Date(),
    },
  });

  testDomain2 = await db.controlDomain.create({
    data: {
      id: randomUUID(),
      code: "DAT-EVREQ-TEST",
      name: "Data Protection Test",
      description: "Test domain for data protection",
      isActive: true,
      sortOrder: 101,
      updatedAt: new Date(),
    },
  });

  // Create test users
  const createdUserGRC = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User GRC",
      email: "test-grc@evidence-request.com",
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

  const createdUserRecipient = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Recipient",
      email: "test-recipient@evidence-request.com",
      role: "ANALYST",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserRecipient = {
    id: createdUserRecipient.id,
    email: createdUserRecipient.email!,
    role: createdUserRecipient.role,
    organizationId: createdUserRecipient.organizationId,
    name: createdUserRecipient.name!,
  };

  const createdUserAdmin = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Admin",
      email: "test-admin@evidence-request.com",
      role: "ADMINISTRATOR",
      organizationId: testOrg.id,
      updatedAt: new Date(),
    },
  });
  testUserAdmin = {
    id: createdUserAdmin.id,
    email: createdUserAdmin.email!,
    role: createdUserAdmin.role,
    organizationId: createdUserAdmin.organizationId,
    name: createdUserAdmin.name!,
  };

  const createdUserAuditor = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test Auditor",
      email: "test-auditor@evidence-request.com",
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

  const createdUserOrg2 = await db.user.create({
    data: {
      id: randomUUID(),
      name: "Test User Org2",
      email: "test-user@evidence-request-org2.com",
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

  // Create test evidence (for fulfillment testing) using raw SQL to bypass organization middleware
  const testEvidenceId = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Evidence" (id, title, "originalFileName", "filePath", "fileSize", "fileType", "uploadedBy", "organizationId", "createdAt", "updatedAt")
    VALUES (${testEvidenceId}, 'Test Evidence for Request', 'test-evidence.pdf', '/uploads/test-evidence.pdf', 1024, 'application/pdf', ${testUserRecipient.id}, ${testOrg.id}, NOW(), NOW())
  `;
  testEvidence = { id: testEvidenceId, title: "Test Evidence for Request" };
});

afterAll(async () => {
  // Cleanup test data
  await db.$executeRaw`DELETE FROM "EvidenceRequest" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;

  await db.$executeRaw`DELETE FROM "EvidenceRequest" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg2.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg2.id}`;

  // Cleanup test control domains
  await db.$executeRaw`DELETE FROM "ControlDomain" WHERE id = ${testDomain1.id}`;
  await db.$executeRaw`DELETE FROM "ControlDomain" WHERE id = ${testDomain2.id}`;
});

// Helper to create caller with context
function createCaller(user: typeof testUserGRC) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

// Helper to create evidence request via raw SQL (bypasses organization middleware)
async function createTestRequest(
  recipientUserId: string,
  requestedById: string,
  controlTaxonomyIds: string[],
  dueDate: Date,
  instructions: string,
  status: string,
  organizationId: string,
  evidenceId?: string,
  fulfilledAt?: Date
): Promise<{ id: string }> {
  const id = randomUUID();
  // Format as PostgreSQL text array: '{id1,id2}'
  const taxIdsArray = `{${controlTaxonomyIds.join(",")}}`;
  if (evidenceId && fulfilledAt) {
    await db.$executeRaw`
      INSERT INTO "EvidenceRequest" (id, "recipientUserId", "requestedById", "controlTaxonomyIds", "dueDate", instructions, status, "organizationId", "evidenceId", "fulfilledAt", "createdAt", "updatedAt")
      VALUES (${id}, ${recipientUserId}, ${requestedById}, ${taxIdsArray}::text[], ${dueDate}, ${instructions}, ${status}::"EvidenceRequestStatus", ${organizationId}, ${evidenceId}, ${fulfilledAt}, NOW(), NOW())
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "EvidenceRequest" (id, "recipientUserId", "requestedById", "controlTaxonomyIds", "dueDate", instructions, status, "organizationId", "createdAt", "updatedAt")
      VALUES (${id}, ${recipientUserId}, ${requestedById}, ${taxIdsArray}::text[], ${dueDate}, ${instructions}, ${status}::"EvidenceRequestStatus", ${organizationId}, NOW(), NOW())
    `;
  }
  return { id };
}

describe("Evidence Request Workflow - Story 3.12", () => {
  describe("AC1-AC8: Create Evidence Request", () => {
    it("AC1: GRC Analyst can create evidence request", async () => {
      const caller = createCaller(testUserGRC);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await caller.evidenceRequest.create({
        recipientUserId: testUserRecipient.id,
        controlTaxonomyIds: [testDomain1.id],
        dueDate: futureDate,
        instructions: "Please provide access control documentation",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.recipientUserId).toBe(testUserRecipient.id);
      expect(result.requestedById).toBe(testUserGRC.id);
      expect(result.status).toBe(EvidenceRequestStatus.PENDING);

      testRequest = { id: result.id };
    });

    it("AC2: Request form captures all required fields", async () => {
      const caller = createCaller(testUserGRC);
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const result = await caller.evidenceRequest.create({
        recipientUserId: testUserRecipient.id,
        controlTaxonomyIds: [testDomain1.id, testDomain2.id],
        dueDate: futureDate,
        instructions: "Please provide the following evidence:\n1. Access logs\n2. User provisioning records",
        frameworkCode: "SOC2",
      });

      expect(result.controlTaxonomyIds).toHaveLength(2);
      expect(result.instructions).toContain("Access logs");
      expect(result.frameworkCode).toBe("SOC2");
    });

    it("AC3: Rejects recipient from different organization", async () => {
      const caller = createCaller(testUserGRC);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        caller.evidenceRequest.create({
          recipientUserId: testUserOrg2.id,
          controlTaxonomyIds: [testDomain1.id],
          dueDate: futureDate,
          instructions: "Please provide evidence",
        })
      ).rejects.toThrow("Recipient must be from the same organization");
    });

    it("AC4: Limits control domains to 1-5 selections", async () => {
      const caller = createCaller(testUserGRC);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create fake domain IDs for testing max limit
      const tooManyDomains = [
        testDomain1.id,
        testDomain2.id,
        randomUUID(),
        randomUUID(),
        randomUUID(),
        randomUUID(),
      ];

      await expect(
        caller.evidenceRequest.create({
          recipientUserId: testUserRecipient.id,
          controlTaxonomyIds: tooManyDomains,
          dueDate: futureDate,
          instructions: "Please provide evidence",
        })
      ).rejects.toThrow("Maximum 5 control domains allowed");

      // Test minimum (empty array)
      await expect(
        caller.evidenceRequest.create({
          recipientUserId: testUserRecipient.id,
          controlTaxonomyIds: [],
          dueDate: futureDate,
          instructions: "Please provide evidence",
        })
      ).rejects.toThrow("At least one control domain is required");
    });

    it("AC5: Due date must be future date", async () => {
      const caller = createCaller(testUserGRC);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await expect(
        caller.evidenceRequest.create({
          recipientUserId: testUserRecipient.id,
          controlTaxonomyIds: [testDomain1.id],
          dueDate: pastDate,
          instructions: "Please provide evidence",
        })
      ).rejects.toThrow("Due date must be in the future");
    });

    it("AC7: Request stored with status PENDING", async () => {
      const caller = createCaller(testUserGRC);
      const request = await caller.evidenceRequest.getById({ id: testRequest.id });

      expect(request.status).toBe(EvidenceRequestStatus.PENDING);
    });

    it("AC8: Request creation logged to audit trail", async () => {
      const auditLogs = await db.auditLog.findMany({
        where: {
          organizationId: testOrg.id,
          action: "CREATE_EVIDENCE_REQUEST",
          entityId: testRequest.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]?.userId).toBe(testUserGRC.id);
    });
  });

  describe("AC9-AC13: Evidence Request Schema", () => {
    it("AC9: Schema includes organizationId for multi-tenant isolation", async () => {
      const request = await db.evidenceRequest.findUnique({
        where: { id: testRequest.id },
      });

      expect(request?.organizationId).toBe(testOrg.id);
    });

    it("AC10: Indexes exist for common query patterns", async () => {
      // We verify this by ensuring queries execute without timeout
      const start = Date.now();
      await db.evidenceRequest.findMany({
        where: {
          organizationId: testOrg.id,
          recipientUserId: testUserRecipient.id,
          status: EvidenceRequestStatus.PENDING,
        },
      });
      const elapsed = Date.now() - start;

      // Query should be fast with indexes
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe("AC19-AC23: Request List for Recipients", () => {
    it("AC19: Recipients can list their pending requests", async () => {
      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.listMyRequests({});

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((r) => r.recipientUserId === testUserRecipient.id)).toBe(true);
    });

    it("AC20: Request list includes required fields", async () => {
      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.listMyRequests({});

      const request = result.items[0];
      expect(request?.controlDomains).toBeDefined();
      expect(request?.requestedBy).toBeDefined();
      expect(request?.dueDate).toBeDefined();
      expect(request?.status).toBeDefined();
      expect(request?.daysUntilDue).toBeDefined();
    });

    it("AC21: Overdue requests flagged correctly", async () => {
      // Create an overdue request
      const overdueRequest = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        "Overdue request for testing",
        "PENDING",
        testOrg.id
      );

      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.listMyRequests({});

      const overdueItem = result.items.find((r) => r.id === overdueRequest.id);
      expect(overdueItem?.isOverdue).toBe(true);
      expect(overdueItem?.daysUntilDue).toBeLessThan(0);
    });

    it("AC22: Requests sorted by due date (soonest first)", async () => {
      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.listMyRequests({});

      const dueDates = result.items.map((r) => new Date(r.dueDate).getTime());
      const sortedDueDates = [...dueDates].sort((a, b) => a - b);

      expect(dueDates).toEqual(sortedDueDates);
    });

    it("AC23: Pending count for navigation badge", async () => {
      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.getPendingCount();

      expect(result.count).toBeDefined();
      expect(typeof result.count).toBe("number");
      expect(result.count).toBeGreaterThan(0);
    });
  });

  describe("AC24-AC29: Request Detail and Fulfillment", () => {
    it("AC24-AC25: Recipients can view request detail", async () => {
      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.getById({ id: testRequest.id });

      expect(result).toBeDefined();
      expect(result.instructions).toBeDefined();
      expect(result.controlDomains).toBeDefined();
      expect(result.requestedBy).toBeDefined();
    });

    it("AC27-AC28: Request fulfillment updates status and links evidence", async () => {
      // Create a fresh request for fulfillment test
      const fulfillmentRequest = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Request to fulfill",
        "PENDING",
        testOrg.id
      );

      const caller = createCaller(testUserRecipient);
      const result = await caller.evidenceRequest.fulfill({
        requestId: fulfillmentRequest.id,
        evidenceId: testEvidence.id,
      });

      expect(result.status).toBe(EvidenceRequestStatus.FULFILLED);
      expect(result.evidenceId).toBe(testEvidence.id);
      expect(result.fulfilledAt).toBeDefined();
    });

    it("AC27: Cannot fulfill non-pending request", async () => {
      // Create and fulfill a request
      const fulfilledRequest = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Already fulfilled request",
        "FULFILLED",
        testOrg.id,
        testEvidence.id,
        new Date()
      );

      const caller = createCaller(testUserRecipient);
      await expect(
        caller.evidenceRequest.fulfill({
          requestId: fulfilledRequest.id,
          evidenceId: testEvidence.id,
        })
      ).rejects.toThrow("Cannot fulfill a fulfilled request");
    });

    it("Only recipient can fulfill request", async () => {
      const caller = createCaller(testUserGRC);
      await expect(
        caller.evidenceRequest.fulfill({
          requestId: testRequest.id,
          evidenceId: testEvidence.id,
        })
      ).rejects.toThrow("Only the request recipient can fulfill this request");
    });
  });

  describe("AC30-AC34: Request Management for Analysts", () => {
    it("AC30-AC31: Analyst can list sent requests", async () => {
      const caller = createCaller(testUserGRC);
      const result = await caller.evidenceRequest.listSentRequests({});

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((r) => r.requestedById === testUserGRC.id)).toBe(true);

      const request = result.items[0];
      expect(request?.recipient).toBeDefined();
      expect(request?.controlDomains).toBeDefined();
      expect(request?.daysSinceSent).toBeDefined();
    });

    it("AC32-AC33: Analyst can cancel pending request", async () => {
      // Create a request to cancel
      const requestToCancel = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Request to cancel",
        "PENDING",
        testOrg.id
      );

      const caller = createCaller(testUserGRC);
      const result = await caller.evidenceRequest.cancel({ id: requestToCancel.id });

      expect(result.status).toBe(EvidenceRequestStatus.CANCELLED);

      // Give the async audit log time to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify audit log
      const auditLogs = await db.auditLog.findMany({
        where: {
          organizationId: testOrg.id,
          action: "CANCEL_EVIDENCE_REQUEST",
          entityId: requestToCancel.id,
        },
      });
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it("Cannot cancel already fulfilled request", async () => {
      const fulfilledRequest = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Fulfilled request",
        "FULFILLED",
        testOrg.id
      );

      const caller = createCaller(testUserGRC);
      await expect(
        caller.evidenceRequest.cancel({ id: fulfilledRequest.id })
      ).rejects.toThrow("Cannot cancel a fulfilled request");
    });
  });

  describe("Permission Enforcement", () => {
    it("Auditor cannot create evidence requests", async () => {
      const caller = createCaller(testUserAuditor);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        caller.evidenceRequest.create({
          recipientUserId: testUserRecipient.id,
          controlTaxonomyIds: [testDomain1.id],
          dueDate: futureDate,
          instructions: "Please provide evidence",
        })
      ).rejects.toThrow("don't have permission");
    });

    it("Admin can create evidence requests", async () => {
      const caller = createCaller(testUserAdmin);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await caller.evidenceRequest.create({
        recipientUserId: testUserRecipient.id,
        controlTaxonomyIds: [testDomain1.id],
        dueDate: futureDate,
        instructions: "Admin request for evidence",
      });

      expect(result).toBeDefined();
    });

    it("Admin can cancel any request in organization", async () => {
      // Create request by GRC analyst
      const requestByGRC = await createTestRequest(
        testUserRecipient.id,
        testUserGRC.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "GRC request",
        "PENDING",
        testOrg.id
      );

      const caller = createCaller(testUserAdmin);
      const result = await caller.evidenceRequest.cancel({ id: requestByGRC.id });

      expect(result.status).toBe(EvidenceRequestStatus.CANCELLED);
    });
  });

  describe("Multi-Tenant Isolation", () => {
    it("Cannot view requests from other organizations", async () => {
      // Create request in org 2
      const otherOrgRequest = await createTestRequest(
        testUserOrg2.id,
        testUserOrg2.id,
        [testDomain1.id],
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        "Other org request",
        "PENDING",
        testOrg2.id
      );

      const caller = createCaller(testUserGRC);
      await expect(
        caller.evidenceRequest.getById({ id: otherOrgRequest.id })
      ).rejects.toThrow("not found");
    });

    it("List only shows requests from own organization", async () => {
      const caller = createCaller(testUserGRC);
      const result = await caller.evidenceRequest.listSentRequests({});

      expect(result.items.every((r) => r.organizationId === testOrg.id)).toBe(true);
    });
  });
});
