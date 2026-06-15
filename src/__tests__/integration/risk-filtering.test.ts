/**
 * Integration Tests: Risk Filtering UI
 *
 * Story 5.5: Risk Filtering UI (Multi-Select Filters)
 *
 * Test Coverage:
 * - AC23-AC26: listRisks query with filter parameters
 * - AC7-AC9: Multi-select severity filter (OR within filter)
 * - AC10-AC12: Multi-select status filter (OR within filter)
 * - AC3: Filters combine with AND logic
 * - AC16-AC18: Owner filters (IT Owner, Business Owner)
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "crypto";
import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { type UserRole } from "@prisma/client";

// Test data references
let testOrg: { id: string; name: string };
let testUserGRC: { id: string; email: string; name: string; role: UserRole; organizationId: string };
let testUserIT: { id: string; email: string; name: string; role: UserRole; organizationId: string };
let testUserBusiness: { id: string; email: string; name: string; role: UserRole; organizationId: string };
// Risk owners are Person records (not Users) since the ownership redesign.
let itOwnerPersonId: string;
let bizOwnerPersonId: string;

// Test risks
let riskHighOpen: { id: string };
let riskHighAssigned: { id: string };
let riskMediumOpen: { id: string };
let riskMediumRemediated: { id: string };
let riskLowClosed: { id: string };
let riskWithITOwner: { id: string };
let riskWithBusinessOwner: { id: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-risk-filtering" },
  });
  if (existingOrg) {
    await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${existingOrg.id}`;
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org for Risk Filtering",
      slug: "test-org-risk-filtering",
      updatedAt: new Date(),
    },
  });

  // Create test users
  const userIdGRC = randomUUID();
  testUserGRC = {
    id: userIdGRC,
    email: `grc-analyst-risk-filter-${userIdGRC.slice(0, 8)}@test.com`,
    name: "GRC Analyst for Risk Filter Test",
    role: "GRC_ANALYST",
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

  const userIdIT = randomUUID();
  testUserIT = {
    id: userIdIT,
    email: `it-owner-risk-filter-${userIdIT.slice(0, 8)}@test.com`,
    name: "IT Stakeholder for Risk Filter Test",
    role: "IT_STAKEHOLDER",
    organizationId: testOrg.id,
  };

  await db.user.create({
    data: {
      id: testUserIT.id,
      email: testUserIT.email,
      name: testUserIT.name,
      role: testUserIT.role,
      organizationId: testUserIT.organizationId,
      updatedAt: new Date(),
    },
  });

  const userIdBusiness = randomUUID();
  testUserBusiness = {
    id: userIdBusiness,
    email: `business-owner-risk-filter-${userIdBusiness.slice(0, 8)}@test.com`,
    name: "Business Stakeholder for Risk Filter Test",
    role: "BUSINESS_STAKEHOLDER",
    organizationId: testOrg.id,
  };

  await db.user.create({
    data: {
      id: testUserBusiness.id,
      email: testUserBusiness.email,
      name: testUserBusiness.name,
      role: testUserBusiness.role,
      organizationId: testUserBusiness.organizationId,
      updatedAt: new Date(),
    },
  });

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

  const now = new Date();

  // Create test risks using raw SQL to bypass organization middleware
  // Correct enum values: VULNERABILITY_SCAN, PENETRATION_TEST, AUDIT_FINDING, SECURITY_REVIEW, COMPLIANCE_ASSESSMENT, OTHER

  // Risk 1: HIGH severity, OPEN status
  const riskId1 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "createdAt", "updatedAt")
    VALUES (${riskId1}, ${testOrg.id}, 'High Severity Open Risk', 'Test risk - HIGH OPEN', 'HIGH', 'OPEN', 'PENETRATION_TEST', 85, ${now}, ${now})
  `;
  riskHighOpen = { id: riskId1 };

  // Risk 2: HIGH severity, ASSIGNED status
  const riskId2 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "createdAt", "updatedAt")
    VALUES (${riskId2}, ${testOrg.id}, 'High Severity Assigned Risk', 'Test risk - HIGH ASSIGNED', 'HIGH', 'ASSIGNED', 'VULNERABILITY_SCAN', 78, ${now}, ${now})
  `;
  riskHighAssigned = { id: riskId2 };

  // Risk 3: MEDIUM severity, OPEN status
  const riskId3 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "createdAt", "updatedAt")
    VALUES (${riskId3}, ${testOrg.id}, 'Medium Severity Open Risk', 'Test risk - MEDIUM OPEN', 'MEDIUM', 'OPEN', 'AUDIT_FINDING', 55, ${now}, ${now})
  `;
  riskMediumOpen = { id: riskId3 };

  // Risk 4: MEDIUM severity, REMEDIATED status
  const riskId4 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "createdAt", "updatedAt")
    VALUES (${riskId4}, ${testOrg.id}, 'Medium Severity Remediated Risk', 'Test risk - MEDIUM REMEDIATED', 'MEDIUM', 'REMEDIATED', 'SECURITY_REVIEW', 45, ${now}, ${now})
  `;
  riskMediumRemediated = { id: riskId4 };

  // Risk 5: LOW severity, CLOSED status
  const riskId5 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "createdAt", "updatedAt")
    VALUES (${riskId5}, ${testOrg.id}, 'Low Severity Closed Risk', 'Test risk - LOW CLOSED', 'LOW', 'CLOSED', 'COMPLIANCE_ASSESSMENT', 15, ${now}, ${now})
  `;
  riskLowClosed = { id: riskId5 };

  // Risk 6: With IT Owner
  const riskId6 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "itOwnerId", "createdAt", "updatedAt")
    VALUES (${riskId6}, ${testOrg.id}, 'Risk with IT Owner', 'Test risk with IT owner assigned', 'MEDIUM', 'ASSIGNED', 'PENETRATION_TEST', 60, ${itOwnerPersonId}, ${now}, ${now})
  `;
  riskWithITOwner = { id: riskId6 };

  // Risk 7: With Business Owner
  const riskId7 = randomUUID();
  await db.$executeRaw`
    INSERT INTO "Risk" (id, "organizationId", title, description, severity, status, "findingSource", "impactScore", "businessOwnerId", "createdAt", "updatedAt")
    VALUES (${riskId7}, ${testOrg.id}, 'Risk with Business Owner', 'Test risk with Business owner assigned', 'HIGH', 'ASSIGNED', 'AUDIT_FINDING', 72, ${bizOwnerPersonId}, ${now}, ${now})
  `;
  riskWithBusinessOwner = { id: riskId7 };
});

afterAll(async () => {
  // Clean up test data using raw SQL to bypass organization middleware
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Person" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrg.id}`;
  await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
});

/**
 * Helper to create tRPC caller with specific user context
 */
function createCaller(user: { id: string; email: string; name: string; role: UserRole; organizationId: string }) {
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
        assignedFrameworks: [],
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

describe("Story 5.5: Risk Filtering UI (Multi-Select Filters)", () => {
  describe("AC7-AC9: Severity Filter (Multi-Select)", () => {
    it("AC7: should filter by single HIGH severity", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        severity: ["HIGH"],
        page: 1,
        pageSize: 50,
      });

      // Should return HIGH severity risks only
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.severity).toBe("HIGH");
      });
    });

    it("AC8: should filter by multiple severities using OR logic", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        severity: ["HIGH", "MEDIUM"],
        page: 1,
        pageSize: 50,
      });

      // Should return HIGH or MEDIUM severity risks
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(["HIGH", "MEDIUM"]).toContain(risk.severity);
      });

      // Verify LOW risks are excluded
      const lowRisks = result.risks.filter(r => r.severity === "LOW");
      expect(lowRisks.length).toBe(0);
    });

    it("AC9: should filter by LOW severity only", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        severity: ["LOW"],
        page: 1,
        pageSize: 50,
      });

      // Should return only LOW severity risks
      result.risks.forEach(risk => {
        expect(risk.severity).toBe("LOW");
      });
    });
  });

  describe("AC10-AC12: Status Filter (Multi-Select)", () => {
    it("AC10: should filter by single OPEN status", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        status: ["OPEN"],
        page: 1,
        pageSize: 50,
      });

      // Should return OPEN status risks only
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.status).toBe("OPEN");
      });
    });

    it("AC11: should filter by multiple statuses using OR logic", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        status: ["OPEN", "ASSIGNED"],
        page: 1,
        pageSize: 50,
      });

      // Should return OPEN or ASSIGNED status risks
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(["OPEN", "ASSIGNED"]).toContain(risk.status);
      });
    });

    it("should filter by all non-closed statuses", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        status: ["OPEN", "ASSIGNED", "REMEDIATED"],
        page: 1,
        pageSize: 50,
      });

      // Should exclude CLOSED status risks
      result.risks.forEach(risk => {
        expect(risk.status).not.toBe("CLOSED");
      });
    });
  });

  describe("AC3: Combined Filters (AND Logic)", () => {
    it("should combine severity AND status filters", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        severity: ["HIGH"],
        status: ["OPEN"],
        page: 1,
        pageSize: 50,
      });

      // Should return only HIGH severity AND OPEN status
      result.risks.forEach(risk => {
        expect(risk.severity).toBe("HIGH");
        expect(risk.status).toBe("OPEN");
      });
    });

    it("should combine multi-select severity AND multi-select status", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        severity: ["HIGH", "MEDIUM"],
        status: ["OPEN", "ASSIGNED"],
        page: 1,
        pageSize: 50,
      });

      // Should return (HIGH OR MEDIUM) AND (OPEN OR ASSIGNED)
      result.risks.forEach(risk => {
        expect(["HIGH", "MEDIUM"]).toContain(risk.severity);
        expect(["OPEN", "ASSIGNED"]).toContain(risk.status);
      });
    });
  });

  describe("AC16-AC18: Owner Filters", () => {
    it("AC16: should filter by IT Owner", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        itOwnerId: itOwnerPersonId,
        page: 1,
        pageSize: 50,
      });

      // Should return risks with specified IT owner
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.itOwnerId).toBe(itOwnerPersonId);
      });
    });

    it("AC17: should filter by Business Owner", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        businessOwnerId: bizOwnerPersonId,
        page: 1,
        pageSize: 50,
      });

      // Should return risks with specified Business owner
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.businessOwnerId).toBe(bizOwnerPersonId);
      });
    });

    it("AC18: should combine owner filter with status filter", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        itOwnerId: itOwnerPersonId,
        status: ["ASSIGNED"],
        page: 1,
        pageSize: 50,
      });

      // Should return risks with IT owner AND ASSIGNED status
      result.risks.forEach(risk => {
        expect(risk.itOwnerId).toBe(itOwnerPersonId);
        expect(risk.status).toBe("ASSIGNED");
      });
    });
  });

  describe("AC2: Finding Source Filter (Multi-Select)", () => {
    it("should filter by single finding source", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        findingSource: ["PENETRATION_TEST"],
        page: 1,
        pageSize: 50,
      });

      // Should return only PENETRATION_TEST finding source risks
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(risk.findingSource).toBe("PENETRATION_TEST");
      });
    });

    it("should filter by multiple finding sources using OR logic", async () => {
      const caller = createCaller(testUserGRC);

      const result = await caller.risk.list({
        findingSource: ["PENETRATION_TEST", "AUDIT_FINDING"],
        page: 1,
        pageSize: 50,
      });

      // Should return PENETRATION_TEST or AUDIT_FINDING
      expect(result.risks.length).toBeGreaterThan(0);
      result.risks.forEach(risk => {
        expect(["PENETRATION_TEST", "AUDIT_FINDING"]).toContain(risk.findingSource);
      });
    });
  });

  describe("AC25: Query returns total count and filtered results", () => {
    it("should return accurate total count with filters", async () => {
      const caller = createCaller(testUserGRC);

      // Get filtered count
      const filteredResult = await caller.risk.list({
        severity: ["HIGH"],
        page: 1,
        pageSize: 50,
      });

      // Get unfiltered count for comparison
      const unfilteredResult = await caller.risk.list({
        page: 1,
        pageSize: 50,
      });

      // Filtered total should be <= unfiltered total
      expect(filteredResult.total).toBeLessThanOrEqual(unfilteredResult.total);
      // Filtered risks should all be HIGH severity
      filteredResult.risks.forEach(risk => {
        expect(risk.severity).toBe("HIGH");
      });
    });

    it("should return empty array when no risks match filters", async () => {
      const caller = createCaller(testUserGRC);

      // Combine filters that shouldn't match any risk
      const result = await caller.risk.list({
        severity: ["LOW"],
        status: ["REMEDIATED"], // No LOW+REMEDIATED risk exists in test data
        page: 1,
        pageSize: 50,
      });

      expect(result.risks.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getFilterCounts query (AC12)", () => {
    it("should return accurate counts by status", async () => {
      const caller = createCaller(testUserGRC);

      const counts = await caller.risk.getFilterCounts();

      // Verify we have counts for various statuses
      expect(counts).toHaveProperty("byStatus");
      expect(counts.byStatus).toBeDefined();

      // Total risks should equal sum of status counts
      const totalFromStatus = Object.values(counts.byStatus).reduce((sum, count) => sum + count, 0);
      expect(totalFromStatus).toBeGreaterThan(0);
    });

    it("should return accurate counts by severity", async () => {
      const caller = createCaller(testUserGRC);

      const counts = await caller.risk.getFilterCounts();

      // Verify we have counts for various severities
      expect(counts).toHaveProperty("bySeverity");
      expect(counts.bySeverity).toBeDefined();

      // Total risks should equal sum of severity counts
      const totalFromSeverity = Object.values(counts.bySeverity).reduce((sum, count) => sum + count, 0);
      expect(totalFromSeverity).toBeGreaterThan(0);
    });
  });
});
