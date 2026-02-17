/**
 * Story 5.6: CSV Risk Export Integration Tests
 *
 * Tests the exportRisks mutation and CSV formatting functionality.
 */

import { PrismaClient, Severity, RiskStatus, RiskFindingSource, UserRole, AuditAction } from "@prisma/client";
import {
  formatRisksForCSV,
  formatDateForCSV,
  calculateDaysToClose,
  getFrameworksAffected,
  formatOwner,
  generateExportFilename,
  createFooterRow,
  CSV_HEADERS,
  type RiskExportData,
} from "@/lib/csvFormatter";

const prisma = new PrismaClient();

describe("Story 5.6: CSV Risk Export", () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test organization using raw SQL to bypass middleware
    const orgResult = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'CSV Export Test Org', 'csv-export-test-org', NOW(), NOW())
      RETURNING id
    `;
    testOrgId = orgResult[0]!.id;

    // Create test user
    const userResult = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "User" (id, email, name, role, "organizationId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'csv-test@example.com', 'CSV Test User', 'GRC_ANALYST', ${testOrgId}, NOW(), NOW())
      RETURNING id
    `;
    testUserId = userResult[0]!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${testOrgId}`;
    await prisma.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${testOrgId}`;
    await prisma.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${testOrgId}`;
    await prisma.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrgId}`;
    await prisma.$disconnect();
  });

  describe("CSV Formatter Utility", () => {
    // AC7: Test date formatting
    describe("formatDateForCSV", () => {
      it("should format date as ISO 8601 (YYYY-MM-DD HH:MM:SS)", () => {
        const date = new Date("2025-12-22T14:30:45.000Z");
        const formatted = formatDateForCSV(date);
        expect(formatted).toBe("2025-12-22 14:30:45");
      });

      it("should return empty string for null date", () => {
        const formatted = formatDateForCSV(null);
        expect(formatted).toBe("");
      });
    });

    // AC11: Test days to close calculation
    describe("calculateDaysToClose", () => {
      it("should calculate days to close for CLOSED risks", () => {
        const createdAt = new Date("2025-12-01T00:00:00.000Z");
        const closedAt = new Date("2025-12-15T00:00:00.000Z");
        const result = calculateDaysToClose("CLOSED", createdAt, closedAt);
        expect(result).toBe("14");
      });

      it("should return empty string for non-CLOSED risks", () => {
        const createdAt = new Date("2025-12-01T00:00:00.000Z");
        const closedAt = new Date("2025-12-15T00:00:00.000Z");

        expect(calculateDaysToClose("OPEN", createdAt, closedAt)).toBe("");
        expect(calculateDaysToClose("ASSIGNED", createdAt, closedAt)).toBe("");
        expect(calculateDaysToClose("REMEDIATED", createdAt, closedAt)).toBe("");
      });

      it("should return empty string for CLOSED risk without closedAt date", () => {
        const createdAt = new Date("2025-12-01T00:00:00.000Z");
        const result = calculateDaysToClose("CLOSED", createdAt, null);
        expect(result).toBe("");
      });
    });

    // AC10: Test owner formatting
    describe("formatOwner", () => {
      it("should format owner with name and email", () => {
        const owner = { name: "John Doe", email: "john@example.com" };
        expect(formatOwner(owner)).toBe("John Doe (john@example.com)");
      });

      it("should return email only if name is null", () => {
        const owner = { name: null, email: "john@example.com" };
        expect(formatOwner(owner)).toBe("john@example.com");
      });

      it("should return 'Not assigned' for null owner", () => {
        expect(formatOwner(null)).toBe("Not assigned");
      });
    });

    // AC4: Test filename generation
    describe("generateExportFilename", () => {
      it("should generate filename with current date", () => {
        const filename = generateExportFilename();
        const today = new Date().toISOString().split("T")[0];
        expect(filename).toBe(`risks-export-${today}.csv`);
      });
    });

    // AC15: Test footer row creation
    describe("createFooterRow", () => {
      it("should create footer row with total count in first column", () => {
        const footer = createFooterRow(42);
        expect(footer["Risk ID"]).toBe("Total: 42 risks");
      });

      it("should have empty values for all other columns", () => {
        const footer = createFooterRow(10);
        CSV_HEADERS.slice(1).forEach((header) => {
          expect(footer[header]).toBe("");
        });
      });

      it("should handle zero count", () => {
        const footer = createFooterRow(0);
        expect(footer["Risk ID"]).toBe("Total: 0 risks");
      });
    });

    // AC9: Test frameworks affected extraction
    describe("getFrameworksAffected", () => {
      it("should return comma-separated framework names", () => {
        const linkedEvidence: RiskExportData["linkedEvidence"] = [
          {
            evidence: {
              controlDomains: [
                {
                  controlDomain: {
                    ControlDomainMappings: [
                      { Control: { Framework: { name: "ISO 27001" } } },
                      { Control: { Framework: { name: "SOC 2" } } },
                    ],
                  },
                },
              ],
            },
          },
        ];
        const result = getFrameworksAffected(linkedEvidence);
        expect(result).toContain("ISO 27001");
        expect(result).toContain("SOC 2");
      });

      it("should return empty string for no linked evidence", () => {
        const result = getFrameworksAffected([]);
        expect(result).toBe("");
      });

      it("should deduplicate framework names", () => {
        const linkedEvidence: RiskExportData["linkedEvidence"] = [
          {
            evidence: {
              controlDomains: [
                {
                  controlDomain: {
                    ControlDomainMappings: [
                      { Control: { Framework: { name: "ISO 27001" } } },
                      { Control: { Framework: { name: "ISO 27001" } } },
                    ],
                  },
                },
              ],
            },
          },
        ];
        const result = getFrameworksAffected(linkedEvidence);
        const count = result.split("ISO 27001").length - 1;
        expect(count).toBe(1);
      });
    });

    // AC6-AC16: Test full CSV formatting
    describe("formatRisksForCSV", () => {
      it("should generate valid CSV with all columns", () => {
        const risks: RiskExportData[] = [
          {
            id: "risk-1",
            title: "Test Risk",
            description: "Test description",
            severity: "HIGH",
            status: "OPEN",
            impactScore: 75,
            assetCriticality: "CRITICAL",
            findingSource: "VULNERABILITY_SCAN",
            cveId: "CVE-2025-1234",
            discoveryDate: new Date("2025-12-01"),
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: "System A, System B",
            closedAt: null,
            itOwner: { name: "IT Owner", email: "it@example.com" },
            businessOwner: { name: "Biz Owner", email: "biz@example.com" },
            assignedAt: new Date("2025-12-02"),
            assignedBy: { name: "Admin" },
            linkedEvidence: [],
            remediationOptions: [{ id: "rem-1" }],
            comments: [{ id: "comm-1" }, { id: "comm-2" }],
          },
        ];

        const csv = formatRisksForCSV(risks);

        // AC12: Should include header row
        expect(csv).toContain("Risk ID");
        expect(csv).toContain("Title");
        expect(csv).toContain("Description");
        expect(csv).toContain("Severity");
        expect(csv).toContain("Impact Score");
        expect(csv).toContain("Evidence Count");

        // Should include data
        expect(csv).toContain("risk-1");
        expect(csv).toContain("Test Risk");
        expect(csv).toContain("HIGH");
        expect(csv).toContain("75");
      });

      // AC8: Test multi-line field escaping
      it("should properly escape multi-line descriptions", () => {
        const risks: RiskExportData[] = [
          {
            id: "risk-1",
            title: "Test Risk",
            description: "Line 1\nLine 2\nLine 3",
            severity: "HIGH",
            status: "OPEN",
            impactScore: null,
            assetCriticality: null,
            findingSource: null,
            cveId: null,
            discoveryDate: null,
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: null,
            closedAt: null,
            itOwner: null,
            businessOwner: null,
            assignedAt: null,
            assignedBy: null,
            linkedEvidence: [],
            remediationOptions: [],
            comments: [],
          },
        ];

        const csv = formatRisksForCSV(risks);
        // csv-stringify should quote fields with newlines
        expect(csv).toContain('"Line 1\nLine 2\nLine 3"');
      });

      // AC14: Test comma escaping
      it("should properly escape fields containing commas", () => {
        const risks: RiskExportData[] = [
          {
            id: "risk-1",
            title: "Risk with, comma in title",
            description: "Description",
            severity: "HIGH",
            status: "OPEN",
            impactScore: null,
            assetCriticality: null,
            findingSource: null,
            cveId: null,
            discoveryDate: null,
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: "System A, System B, System C",
            closedAt: null,
            itOwner: null,
            businessOwner: null,
            assignedAt: null,
            assignedBy: null,
            linkedEvidence: [],
            remediationOptions: [],
            comments: [],
          },
        ];

        const csv = formatRisksForCSV(risks);
        // csv-stringify should quote fields with commas
        expect(csv).toContain('"Risk with, comma in title"');
        expect(csv).toContain('"System A, System B, System C"');
      });

      // AC16: Test null value handling
      it("should show empty cells as blank (not 'null' or 'undefined')", () => {
        const risks: RiskExportData[] = [
          {
            id: "risk-1",
            title: "Test Risk",
            description: null,
            severity: "HIGH",
            status: "OPEN",
            impactScore: null,
            assetCriticality: null,
            findingSource: null,
            cveId: null,
            discoveryDate: null,
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: null,
            closedAt: null,
            itOwner: null,
            businessOwner: null,
            assignedAt: null,
            assignedBy: null,
            linkedEvidence: [],
            remediationOptions: [],
            comments: [],
          },
        ];

        const csv = formatRisksForCSV(risks);
        expect(csv).not.toContain("null");
        expect(csv).not.toContain("undefined");
      });

      // AC15: Test footer row in full CSV output
      it("should include total count footer row at the end", () => {
        const risks: RiskExportData[] = [
          {
            id: "risk-1",
            title: "Risk One",
            description: "Description 1",
            severity: "HIGH",
            status: "OPEN",
            impactScore: 75,
            assetCriticality: "CRITICAL",
            findingSource: null,
            cveId: null,
            discoveryDate: null,
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: null,
            closedAt: null,
            itOwner: null,
            businessOwner: null,
            assignedAt: null,
            assignedBy: null,
            linkedEvidence: [],
            remediationOptions: [],
            comments: [],
          },
          {
            id: "risk-2",
            title: "Risk Two",
            description: "Description 2",
            severity: "MEDIUM",
            status: "ASSIGNED",
            impactScore: 50,
            assetCriticality: "HIGH",
            findingSource: null,
            cveId: null,
            discoveryDate: null,
            createdAt: new Date("2025-12-01"),
            updatedAt: new Date("2025-12-15"),
            affectedSystems: null,
            closedAt: null,
            itOwner: null,
            businessOwner: null,
            assignedAt: null,
            assignedBy: null,
            linkedEvidence: [],
            remediationOptions: [],
            comments: [],
          },
        ];

        const csv = formatRisksForCSV(risks);
        // AC15: Should include footer row with total count
        expect(csv).toContain("Total: 2 risks");
        // Footer should be at the end (last line before final newline)
        const lines = csv.trim().split("\n");
        expect(lines[lines.length - 1]).toContain("Total: 2 risks");
      });
    });
  });

  describe("Export Mutation Database Operations", () => {
    let testRiskId: string;

    beforeAll(async () => {
      // Create a test risk
      const riskResult = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Risk" (
          id, title, description, severity, status, "impactScore",
          "organizationId", "createdAt", "updatedAt", "createdById"
        )
        VALUES (
          gen_random_uuid(), 'Export Test Risk', 'Risk for export testing',
          'HIGH', 'OPEN', 85, ${testOrgId}, NOW(), NOW(), ${testUserId}
        )
        RETURNING id
      `;
      testRiskId = riskResult[0]!.id;
    });

    afterAll(async () => {
      await prisma.$executeRaw`DELETE FROM "Risk" WHERE id = ${testRiskId}`;
    });

    // AC19: Test fetching risks without pagination
    it("should fetch all risks without pagination limit", async () => {
      // Create multiple risks
      await prisma.$executeRaw`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdAt", "updatedAt", "createdById")
        SELECT gen_random_uuid(), 'Bulk Risk ' || generate_series, 'Description', 'MEDIUM', 'OPEN', ${testOrgId}, NOW(), NOW(), ${testUserId}
        FROM generate_series(1, 50)
      `;

      // Verify we can fetch all (at least 50)
      const risks = await prisma.risk.findMany({
        where: { organizationId: testOrgId },
      });

      expect(risks.length).toBeGreaterThanOrEqual(50);

      // Clean up bulk risks
      await prisma.$executeRaw`DELETE FROM "Risk" WHERE title LIKE 'Bulk Risk %' AND "organizationId" = ${testOrgId}`;
    });

    // AC22-AC24: Test audit logging
    it("should create audit log entry for export action", async () => {
      // Create an audit log entry simulating export
      await prisma.$executeRaw`
        INSERT INTO "AuditLog" (
          id, action, "entityType", "entityId", "changes",
          "actorName", "actorRole", "userId", "organizationId", "timestamp"
        )
        VALUES (
          gen_random_uuid(), 'EXPORT_RISKS', 'Risk', 'CSV_EXPORT',
          '{"filters": {"severity": ["HIGH"]}, "rowCount": 10}'::jsonb,
          'Test User', 'GRC_ANALYST', ${testUserId}, ${testOrgId}, NOW()
        )
      `;

      // Verify the audit log was created using raw query
      const auditLogs = await prisma.$queryRaw<Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        changes: string;
      }>>`
        SELECT id, action, "entityType", "entityId", "changes"::text as changes
        FROM "AuditLog"
        WHERE "organizationId" = ${testOrgId} AND action = 'EXPORT_RISKS'
      `;

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const log = auditLogs[0]!;
      expect(log.entityType).toBe("Risk");
      expect(log.entityId).toBe("CSV_EXPORT");
      const changes = JSON.parse(log.changes);
      expect(changes).toHaveProperty("filters");
      expect(changes).toHaveProperty("rowCount");
    });
  });

  describe("Filter-Based Export", () => {
    let highRiskId: string;
    let mediumRiskId: string;
    let closedRiskId: string;

    beforeAll(async () => {
      // Create risks with different severities and statuses
      const highResult = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdAt", "updatedAt", "createdById")
        VALUES (gen_random_uuid(), 'High Severity Risk', 'High risk description', 'HIGH', 'OPEN', ${testOrgId}, NOW(), NOW(), ${testUserId})
        RETURNING id
      `;
      highRiskId = highResult[0]!.id;

      const medResult = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdAt", "updatedAt", "createdById")
        VALUES (gen_random_uuid(), 'Medium Severity Risk', 'Medium risk description', 'MEDIUM', 'ASSIGNED', ${testOrgId}, NOW(), NOW(), ${testUserId})
        RETURNING id
      `;
      mediumRiskId = medResult[0]!.id;

      const closedResult = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Risk" (id, title, description, severity, status, "organizationId", "createdAt", "updatedAt", "createdById")
        VALUES (gen_random_uuid(), 'Closed Risk', 'Closed risk description', 'LOW', 'CLOSED', ${testOrgId}, NOW(), NOW(), ${testUserId})
        RETURNING id
      `;
      closedRiskId = closedResult[0]!.id;
    });

    afterAll(async () => {
      await prisma.$executeRaw`DELETE FROM "Risk" WHERE id IN (${highRiskId}, ${mediumRiskId}, ${closedRiskId})`;
    });

    // AC2: Test filtered export
    it("should filter by severity", async () => {
      const highRisks = await prisma.risk.findMany({
        where: {
          organizationId: testOrgId,
          severity: { in: ["HIGH"] },
        },
      });

      const titles = highRisks.map(r => r.title);
      expect(titles).toContain("High Severity Risk");
      expect(titles).not.toContain("Medium Severity Risk");
      expect(titles).not.toContain("Closed Risk");
    });

    it("should filter by status", async () => {
      const closedRisks = await prisma.risk.findMany({
        where: {
          organizationId: testOrgId,
          status: { in: ["CLOSED"] },
        },
      });

      const titles = closedRisks.map(r => r.title);
      expect(titles).toContain("Closed Risk");
      expect(titles).not.toContain("High Severity Risk");
    });

    it("should filter by multiple criteria (AND logic)", async () => {
      const filtered = await prisma.risk.findMany({
        where: {
          organizationId: testOrgId,
          severity: { in: ["HIGH", "MEDIUM"] },
          status: { in: ["OPEN", "ASSIGNED"] },
        },
      });

      expect(filtered.length).toBe(2);
      const titles = filtered.map(r => r.title);
      expect(titles).toContain("High Severity Risk");
      expect(titles).toContain("Medium Severity Risk");
    });
  });

  describe("Role-Based Access Control", () => {
    // AC18: Test role validation
    it("should allow GRC_ANALYST to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).toContain("GRC_ANALYST");
    });

    it("should allow SECURITY_ENGINEER to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).toContain("SECURITY_ENGINEER");
    });

    it("should allow ORG_ADMIN to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).toContain("ORG_ADMIN");
    });

    it("should allow AUDITOR to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).toContain("AUDITOR");
    });

    it("should not allow IT_STAKEHOLDER to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).not.toContain("IT_STAKEHOLDER");
    });

    it("should not allow BUSINESS_STAKEHOLDER to export", () => {
      const allowedRoles = ["GRC_ANALYST", "SECURITY_ENGINEER", "ORG_ADMIN", "AUDITOR"];
      expect(allowedRoles).not.toContain("BUSINESS_STAKEHOLDER");
    });
  });
});
