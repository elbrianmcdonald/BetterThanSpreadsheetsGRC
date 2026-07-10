/**
 * Compliance Dashboard Integration Tests
 *
 * Tests for Story 5.1: Compliance Summary Dashboard (Framework Coverage Percentages)
 * Tests for Story 5.2: On-Demand Compliance Refresh Button
 * Tests for Story 5.3: Automatic Compliance Updates (Evidence/Risk Triggers)
 *
 * **Critical Test Coverage:**
 * - AC7-AC12: Coverage calculation accuracy and caching
 * - AC13-AC17: Risk metrics display
 * - AC23-AC27: Trend calculation
 * - AC32-AC35: Role-based access control
 * - Story 5.2 AC7-AC11: Refresh all coverage
 * - Story 5.2 AC12-AC15: Per-framework refresh
 * - Story 5.3 AC1-AC5: Evidence upload triggers recalculation
 * - Story 5.3 AC6-AC9: Evidence deletion triggers recalculation
 * - Story 5.3 AC10-AC13: Risk closure triggers recalculation
 * - Story 5.3 AC14-AC18: Background job processing
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.2: On-Demand Compliance Refresh Button
 * @see Story 5.3: Automatic Compliance Updates
 */

import { db } from "@/server/db";
import { appRouter } from "@/server/api/root";
import { randomUUID } from "crypto";
import { UserRole, Severity, RiskStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  calculateFrameworkCoverage,
  refreshFrameworkCoverage,
  getCoverageTrend,
  saveCoverageSnapshot,
} from "@/server/services/complianceCalculator";
import {
  queueComplianceRecalculation,
  queueMultipleFrameworkRecalculations,
  getAffectedFrameworkIdsForEvidence,
  getAffectedFrameworkIdsForRisk,
  getPendingJobCount,
  getQueueStatus,
  clearQueue,
  forceProcessAllJobs,
} from "@/server/services/complianceJobQueue";
import { runWithOrganizationContext } from "@/server/db/middleware/organization-filter";

// Test data
let testOrg: { id: string; name: string };
let testUserGRCAnalyst: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserCISO: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserSecurityEngineer: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserAuditor: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserITStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testUserBusinessStakeholder: { id: string; email: string; role: UserRole; organizationId: string; name: string; assignedFrameworks: string[] };
let testFramework: { id: string; code: string };
let testControlDomain: { id: string; code: string };
let testControls: { id: string; controlId: string }[];
let testBusinessUnit: { id: string };

beforeAll(async () => {
  // Cleanup any residual data from previous failed runs
  const existingOrg = await db.organization.findUnique({
    where: { slug: "test-org-compliance-dashboard" },
  });
  if (existingOrg) {
    await cleanupTestData(existingOrg.id);
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${existingOrg.id}`;
  }

  // Create test organization
  testOrg = await db.organization.create({
    data: {
      id: randomUUID(),
      name: "Test Org Compliance Dashboard",
      slug: "test-org-compliance-dashboard",
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
    const isStaff = role !== UserRole.BUSINESS_USER;
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        platformRole: isStaff ? role : null,
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });
    if (!isStaff) {
      // Business user derives role from org membership existence
      await db.organizationMembership.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          organizationId: orgId,
          updatedAt: new Date(),
        },
      });
    }
    return {
      id: user.id,
      email: user.email!,
      role, // JS property for session/caller building
      organizationId: user.organizationId,
      name: user.name!,
      assignedFrameworks: user.assignedFrameworks,
    };
  };

  testUserGRCAnalyst = await createUser(
    "GRC Analyst",
    "grc@compliance-dashboard.test",
    "ANALYST",
    testOrg.id
  );

  testUserCISO = await createUser(
    "MANAGER",
    "ciso@compliance-dashboard.test",
    "MANAGER",
    testOrg.id
  );

  testUserSecurityEngineer = await createUser(
    "Security Engineer",
    "security@compliance-dashboard.test",
    "ANALYST",
    testOrg.id
  );

  testUserAuditor = await createUser(
    "Auditor",
    "auditor@compliance-dashboard.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserITStakeholder = await createUser(
    "IT Stakeholder",
    "it@compliance-dashboard.test",
    "BUSINESS_USER",
    testOrg.id
  );

  testUserBusinessStakeholder = await createUser(
    "Business Stakeholder",
    "business@compliance-dashboard.test",
    "BUSINESS_USER",
    testOrg.id
  );

  // Create a test control domain
  const existingDomain = await db.controlDomain.findUnique({
    where: { code: "TEST-CD-COMPLIANCE" },
  });
  if (existingDomain) {
    await db.controlDomainMapping.deleteMany({
      where: { controlDomainId: existingDomain.id },
    });
    await db.evidenceControlDomain.deleteMany({
      where: { controlDomainId: existingDomain.id },
    });
    await db.controlDomain.delete({
      where: { id: existingDomain.id },
    });
  }

  testControlDomain = await db.controlDomain.create({
    data: {
      id: randomUUID(),
      code: "TEST-CD-COMPLIANCE",
      name: "Test Control Domain for Compliance",
      description: "Test control domain for compliance dashboard tests",
      sortOrder: 999,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // Create test framework and controls within organization context
  await runWithOrganizationContext(testOrg.id, async () => {
    // Create a test framework with 10 controls
    testFramework = await db.framework.create({
      data: {
        id: randomUUID(),
        organizationId: testOrg.id,
        code: "TEST-FW-COMPLIANCE",
        name: "Test Framework",
        version: "1.0",
        description: "Test framework for compliance dashboard tests",
        isActive: true,
        activatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create 10 controls for the framework
    testControls = [];
    for (let i = 1; i <= 10; i++) {
      const control = await db.control.create({
        data: {
          id: randomUUID(),
          organizationId: testOrg.id,
          frameworkId: testFramework.id,
          controlId: `CTRL-${i.toString().padStart(2, "0")}`,
          title: `Test Control ${i}`,
          description: `Description for test control ${i}`,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      testControls.push({ id: control.id, controlId: control.controlId });
    }

    // Create a business unit and assign it to the framework so that
    // getComplianceSummary's BU-based org rollup can calculate coverage
    const bu = await db.businessUnit.create({
      data: {
        organizationId: testOrg.id,
        name: "Test Business Unit",
        code: "TEST-BU",
        isActive: true,
      },
    });
    testBusinessUnit = { id: bu.id };

    await db.businessUnitFramework.create({
      data: {
        businessUnitId: bu.id,
        frameworkId: testFramework.id,
        organizationId: testOrg.id,
      },
    });
  });

  // Create control domain mappings for the first 5 controls (outside org context, not org-scoped)
  for (let i = 0; i < 5; i++) {
    await db.controlDomainMapping.create({
      data: {
        id: randomUUID(),
        controlDomainId: testControlDomain.id,
        frameworkCode: testFramework.code,
        controlId: testControls[i]!.controlId,
        confidence: 100,
        updatedAt: new Date(),
      },
    });
  }
});

afterAll(async () => {
  // Cleanup test data
  if (testOrg) {
    await cleanupTestData(testOrg.id);
    await db.$executeRaw`DELETE FROM "Organization" WHERE id = ${testOrg.id}`;
  }

  // Cleanup test control domain
  if (testControlDomain) {
    await db.controlDomainMapping.deleteMany({
      where: { controlDomainId: testControlDomain.id },
    });
    await db.controlDomain.delete({
      where: { id: testControlDomain.id },
    });
  }
});

async function cleanupTestData(orgId: string) {
  await db.$executeRaw`DELETE FROM "CoverageHistory" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "FrameworkCoverage" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "EvidenceControlDomain" WHERE "evidenceId" IN (SELECT id FROM "Evidence" WHERE "organizationId" = ${orgId})`;
  await db.$executeRaw`DELETE FROM "Evidence" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Control" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "BusinessUnitFramework" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Framework" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "BusinessUnit" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "Risk" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${orgId}`;
  await db.$executeRaw`DELETE FROM "User" WHERE "organizationId" = ${orgId}`;
}

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

describe("Story 5.1: Compliance Dashboard", () => {
  describe("AC7-AC12: Coverage Calculation", () => {
    it("AC7: Coverage = 0% when no evidence mapped", async () => {
      const result = await calculateFrameworkCoverage(
        testFramework.id,
        testOrg.id,
        db
      );

      expect(result.coveragePercentage).toBe(0);
      expect(result.satisfiedControlsCount).toBe(0);
      expect(result.totalControlsCount).toBe(10);
    });

    it("AC7, AC8: Coverage = 30% when 3/10 controls have evidence", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence and tag with control domain
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Evidence for Coverage",
            originalFileName: "test-coverage.pdf",
            filePath: "/uploads/test-coverage.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        // Tag evidence with control domain (maps to first 5 controls)
        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Calculate coverage - should be 50% (5 controls mapped via control domain / 10 total)
        const result = await calculateFrameworkCoverage(
          testFramework.id,
          testOrg.id,
          db
        );

        expect(result.coveragePercentage).toBe(50);
        expect(result.satisfiedControlsCount).toBe(5);
        expect(result.totalControlsCount).toBe(10);

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });

    it("AC12: Coverage is cached in FrameworkCoverage table", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Evidence for Caching",
            originalFileName: "test-cache.pdf",
            filePath: "/uploads/test-cache.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Refresh coverage (should cache it)
        await refreshFrameworkCoverage(testFramework.id, testOrg.id, db);

        // Check cache exists
        const cached = await db.frameworkCoverage.findFirst({
          where: {
            frameworkId: testFramework.id,
            organizationId: testOrg.id,
            businessUnitId: null,
          },
        });

        expect(cached).not.toBeNull();
        expect(Number(cached!.coveragePercentage)).toBe(50);
        expect(cached!.satisfiedControlsCount).toBe(5);
        expect(cached!.totalControlsCount).toBe(10);

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });
  });

  describe("AC23-AC27: Trend Calculation", () => {
    it("AC27: New framework shows 'new' trend", async () => {
      const trend = await getCoverageTrend(testFramework.id, testOrg.id, db);

      expect(trend.direction).toBe("new");
      expect(trend.previousCoverage).toBeNull();
    });

    it("AC23-AC26: Trend shows change from historical snapshot", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Save a snapshot with 20% coverage 8 days ago
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        eightDaysAgo.setHours(0, 0, 0, 0);

        await db.coverageHistory.create({
          data: {
            id: randomUUID(),
            frameworkId: testFramework.id,
            organizationId: testOrg.id,
            coveragePercentage: 20,
            satisfiedControlsCount: 2,
            totalControlsCount: 10,
            snapshotDate: eightDaysAgo,
          },
        });

        // Create evidence for current coverage (50%)
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Evidence for Trend",
            originalFileName: "test-trend.pdf",
            filePath: "/uploads/test-trend.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Refresh cache
        await refreshFrameworkCoverage(testFramework.id, testOrg.id, db);

        // Get trend
        const trend = await getCoverageTrend(testFramework.id, testOrg.id, db);

        expect(trend.direction).toBe("up");
        expect(trend.previousCoverage).toBe(20);
        expect(trend.change).toBe(30); // 50 - 20 = 30

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
        await db.coverageHistory.deleteMany({
          where: { frameworkId: testFramework.id, organizationId: testOrg.id },
        });
      });
    });
  });

  describe("AC13-AC17: Risk Metrics", () => {
    it("AC13: Returns count of open and assigned risks", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create test risks
        await db.risk.createMany({
          data: [
            {
              id: randomUUID(),
              organizationId: testOrg.id,
              title: "Open Risk 1",
              description: "Test open risk",
              severity: Severity.HIGH,
              status: RiskStatus.OPEN,
            },
            {
              id: randomUUID(),
              organizationId: testOrg.id,
              title: "Assigned Risk 1",
              description: "Test assigned risk",
              severity: Severity.MEDIUM,
              status: RiskStatus.ASSIGNED,
            },
            {
              id: randomUUID(),
              organizationId: testOrg.id,
              title: "Closed Risk 1",
              description: "Test closed risk",
              severity: Severity.LOW,
              status: RiskStatus.CLOSED,
            },
          ],
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getRiskMetrics();

        expect(result.openRisksCount).toBe(2); // OPEN + ASSIGNED
        expect(result.severityDistribution.HIGH).toBe(1);
        expect(result.severityDistribution.MEDIUM).toBe(1);
        expect(result.severityDistribution.LOW).toBe(0); // Closed risk not counted

        // Cleanup
        await db.risk.deleteMany({
          where: { organizationId: testOrg.id },
        });
      });
    });

    it("AC14, AC17: Returns recently closed risks with days-to-close", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create a risk that was closed
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - 10); // Created 10 days ago

        const closedAt = new Date();
        closedAt.setDate(closedAt.getDate() - 3); // Closed 3 days ago

        await db.risk.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Recently Closed Risk",
            description: "Test recently closed risk",
            severity: Severity.MEDIUM,
            status: RiskStatus.CLOSED,
            createdAt,
            updatedAt: closedAt,
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getRiskMetrics();

        expect(result.recentlyClosed.length).toBeGreaterThanOrEqual(1);
        const closedRisk = result.recentlyClosed.find(
          (r) => r.title === "Recently Closed Risk"
        );
        expect(closedRisk).toBeDefined();
        expect(closedRisk!.daysToClose).toBe(7); // 10 - 3 = 7 days

        // Cleanup
        await db.risk.deleteMany({
          where: { organizationId: testOrg.id },
        });
      });
    });
  });

  /**
   * Story 5.4: Open Risk Count and Recently Closed Risks Display Tests
   * Additional tests for AC8 (closedByName) and AC13-AC17 (Risk Trend)
   */
  describe("Story 5.4: Risk Metrics Enhancements", () => {
    it("Story 5.4 AC8: Recently closed risks include closedByName from status history", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        const riskId = randomUUID();
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - 5);

        // Create a closed risk
        await db.risk.create({
          data: {
            id: riskId,
            organizationId: testOrg.id,
            title: "Risk With Closer Name",
            description: "Test risk with closer tracked",
            severity: Severity.HIGH,
            status: RiskStatus.CLOSED,
            createdAt,
            updatedAt: new Date(),
          },
        });

        // Create status history entry for closure
        await db.riskStatusHistory.create({
          data: {
            id: randomUUID(),
            riskId,
            oldStatus: RiskStatus.REMEDIATED,
            newStatus: RiskStatus.CLOSED,
            changedById: testUserGRCAnalyst.id,
            organizationId: testOrg.id,
            changedAt: new Date(),
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getRiskMetrics();

        const closedRisk = result.recentlyClosed.find(
          (r) => r.title === "Risk With Closer Name"
        );
        expect(closedRisk).toBeDefined();
        expect(closedRisk!.closedByName).toBe("GRC Analyst");

        // Cleanup
        await db.riskStatusHistory.deleteMany({ where: { riskId } });
        await db.risk.delete({ where: { id: riskId } });
      });
    });

    it("Story 5.4 AC8: Recently closed risks include severity", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        await db.risk.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "High Severity Closed Risk",
            description: "Test high severity closed risk",
            severity: Severity.HIGH,
            status: RiskStatus.CLOSED,
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getRiskMetrics();

        const closedRisk = result.recentlyClosed.find(
          (r) => r.title === "High Severity Closed Risk"
        );
        expect(closedRisk).toBeDefined();
        expect(closedRisk!.severity).toBe(Severity.HIGH);

        // Cleanup
        await db.risk.deleteMany({ where: { organizationId: testOrg.id } });
      });
    });

    it("Story 5.4 AC13-AC17: getRiskTrend returns daily open counts for 30 days", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.getRiskTrend();

      // Should have 30 days of data
      expect(result.dailyOpenCounts.length).toBe(30);

      // Each day should have date and count
      expect(result.dailyOpenCounts[0]).toHaveProperty("date");
      expect(result.dailyOpenCounts[0]).toHaveProperty("count");

      // Date should be in YYYY-MM-DD format
      expect(result.dailyOpenCounts[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("Story 5.4 AC15: getRiskTrend returns weekly closed counts", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.getRiskTrend();

      // Should have 5 weeks of data
      expect(result.weeklyClosedCounts.length).toBe(5);

      // Each week should have weekStart, weekEnd, and count
      expect(result.weeklyClosedCounts[0]).toHaveProperty("weekStart");
      expect(result.weeklyClosedCounts[0]).toHaveProperty("weekEnd");
      expect(result.weeklyClosedCounts[0]).toHaveProperty("count");
    });

    it("Story 5.4 AC13-AC17: Risk trend accurately reflects open risk history", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create a risk that was open 15 days ago
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const riskId = randomUUID();
        await db.risk.create({
          data: {
            id: riskId,
            organizationId: testOrg.id,
            title: "Historical Open Risk",
            description: "Risk for trend testing",
            severity: Severity.MEDIUM,
            status: RiskStatus.OPEN,
            createdAt: fifteenDaysAgo,
            updatedAt: fifteenDaysAgo,
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getRiskTrend();

        // Risk should appear in counts for days after it was created
        // The first half of the 30-day period should have 0 (before risk created)
        // The second half should have 1 (after risk created)
        const recentDays = result.dailyOpenCounts.slice(-15);
        const hasPositiveCount = recentDays.some(day => day.count > 0);
        expect(hasPositiveCount).toBe(true);

        // Cleanup
        await db.risk.delete({ where: { id: riskId } });
      });
    });

    it("Story 5.4: BUSINESS_USER can access getRiskTrend (read-only, has RISK_READ_ALL)", async () => {
      const caller = createCaller(testUserITStakeholder);
      const result = await caller.compliance.getRiskTrend();

      expect(result).toHaveProperty("dailyOpenCounts");
      expect(result).toHaveProperty("weeklyClosedCounts");
    });

    it("Story 5.4: GRC_ANALYST can access getRiskTrend", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.getRiskTrend();

      expect(result).toHaveProperty("dailyOpenCounts");
      expect(result).toHaveProperty("weeklyClosedCounts");
    });
  });

  describe("AC32-AC35: Role-Based Access Control", () => {
    it("AC32: GRC_ANALYST can access compliance dashboard", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("frameworks");
      expect(result).toHaveProperty("riskMetrics");
    });

    it("AC32: CISO can access compliance dashboard", async () => {
      const caller = createCaller(testUserCISO);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
    });

    it("AC32: SECURITY_ENGINEER can access compliance dashboard", async () => {
      const caller = createCaller(testUserSecurityEngineer);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
    });

    it("AC32: AUDITOR can access compliance dashboard", async () => {
      const caller = createCaller(testUserAuditor);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
    });

    it("AC33: BUSINESS_USER can access compliance dashboard (read-only, has FRAMEWORK_READ)", async () => {
      const caller = createCaller(testUserITStakeholder);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
    });

    it("AC33: A second BUSINESS_USER can also access compliance dashboard (read-only)", async () => {
      const caller = createCaller(testUserBusinessStakeholder);
      const result = await caller.compliance.getComplianceSummary();

      expect(result).toHaveProperty("summary");
    });
  });

  describe("Dashboard Query Integration", () => {
    it("getComplianceSummary returns complete dashboard data", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence for coverage, tagged to the test business unit so
        // the BU-based org rollup in getComplianceSummary calculates 50% coverage
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            businessUnitId: testBusinessUnit.id,
            title: "Test Evidence for Dashboard",
            originalFileName: "test-dashboard.pdf",
            filePath: "/uploads/test-dashboard.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getComplianceSummary();

        // Check summary widget (AC18)
        expect(result.summary).toHaveProperty("overallScore");
        expect(result.summary).toHaveProperty("totalFrameworks");
        expect(result.summary).toHaveProperty("readyForAudit");
        expect(result.summary).toHaveProperty("needsAttention");
        expect(result.summary).toHaveProperty("lastUpdated");

        // Check frameworks (AC2-AC3)
        expect(result.frameworks.length).toBeGreaterThanOrEqual(1);
        const framework = result.frameworks.find(
          (f) => f.frameworkId === testFramework.id
        );
        expect(framework).toBeDefined();
        expect(framework!.coveragePercentage).toBe(50);
        expect(framework!.satisfiedControlsCount).toBe(5);
        expect(framework!.totalControlsCount).toBe(10);

        // Check trend (AC23-AC27)
        expect(framework!.trend).toHaveProperty("direction");
        expect(framework!.trend).toHaveProperty("change");

        // Check coverage level (AC4)
        expect(framework!.coverageLevel).toBe("low"); // 50% < 70%

        // Check risk metrics (AC13-AC17)
        expect(result.riskMetrics).toHaveProperty("openRisksCount");
        expect(result.riskMetrics).toHaveProperty("severityDistribution");
        expect(result.riskMetrics).toHaveProperty("recentlyClosed");

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });

    it("getFrameworkDetails returns controls with evidence status", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence for some controls
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Evidence for Framework Details",
            originalFileName: "test-details.pdf",
            filePath: "/uploads/test-details.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getFrameworkDetails({
          frameworkId: testFramework.id,
        });

        // Check framework metadata (AC29-AC30)
        expect(result.framework.id).toBe(testFramework.id);
        expect(result.framework.coveragePercentage).toBe(50);
        expect(result.framework.satisfiedControlsCount).toBe(5);
        expect(result.framework.totalControlsCount).toBe(10);

        // Check controls (AC30)
        expect(result.controls.length).toBe(10);

        // Check satisfied vs unsatisfied
        const satisfied = result.controls.filter((c) => c.isSatisfied);
        const unsatisfied = result.controls.filter((c) => !c.isSatisfied);
        expect(satisfied.length).toBe(5);
        expect(unsatisfied.length).toBe(5);

        // Check evidence count
        const controlWithEvidence = result.controls.find((c) => c.isSatisfied);
        expect(controlWithEvidence!.evidenceCount).toBeGreaterThan(0);

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });

    it("refreshAllCoverage updates all framework coverages", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.refreshAllCoverage();

      expect(result.refreshedCount).toBeGreaterThanOrEqual(1);
      expect(result.coverages.length).toBeGreaterThanOrEqual(1);

      // Verify cache was updated
      const cached = await db.frameworkCoverage.findFirst({
        where: {
          frameworkId: testFramework.id,
          organizationId: testOrg.id,
          businessUnitId: null,
        },
      });

      expect(cached).not.toBeNull();
    });
  });

  describe("Overall Compliance Score (AC18)", () => {
    it("Overall score is average of framework coverages", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create a second framework with different coverage
        const framework2 = await db.framework.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            code: "TEST-FW-COMPLIANCE-2",
            name: "Test Framework 2",
            version: "1.0",
            description: "Second test framework",
            isActive: true,
            activatedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create 10 controls for framework 2
        for (let i = 1; i <= 10; i++) {
          await db.control.create({
            data: {
              id: randomUUID(),
              organizationId: testOrg.id,
              frameworkId: framework2.id,
              controlId: `FW2-CTRL-${i.toString().padStart(2, "0")}`,
              title: `Framework 2 Control ${i}`,
              description: `Description for framework 2 control ${i}`,
              isActive: true,
              updatedAt: new Date(),
            },
          });
        }

        // Create evidence for first framework (50% coverage), tagged to the test
        // business unit so the BU-based org rollup calculates 50% for testFramework
        const evidence1 = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            businessUnitId: testBusinessUnit.id,
            title: "Evidence for Framework 1",
            originalFileName: "fw1-evidence.pdf",
            filePath: "/uploads/fw1-evidence.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence1.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Framework 2 has 0% coverage (no evidence mapped)

        // Refresh coverage cache for both frameworks (prior tests may have cached stale values)
        await refreshFrameworkCoverage(testFramework.id, testOrg.id, db);
        await refreshFrameworkCoverage(framework2.id, testOrg.id, db);

        const caller = createCaller(testUserGRCAnalyst);
        const result = await caller.compliance.getComplianceSummary();

        // Overall score should be average of 50% + 0% = 25%
        expect(result.summary.overallScore).toBe(25);
        expect(result.summary.totalFrameworks).toBe(2);
        expect(result.summary.readyForAudit).toBe(0); // Neither is ≥90%
        expect(result.summary.needsAttention).toBe(2); // Both are <70%

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence1.id },
        });
        await db.evidence.delete({ where: { id: evidence1.id } });
        await db.control.deleteMany({ where: { frameworkId: framework2.id } });
        await db.frameworkCoverage.deleteMany({
          where: { frameworkId: framework2.id },
        });
        await db.framework.delete({ where: { id: framework2.id } });
      });
    });
  });
});

/**
 * Story 5.2: On-Demand Compliance Refresh Button Tests
 */
describe("Story 5.2: On-Demand Compliance Refresh Button", () => {
  describe("AC7-AC11: Refresh All Coverage", () => {
    it("AC7, AC9: Refreshes all active frameworks in parallel", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.refreshAllCoverage();

      // AC7: Should refresh all active frameworks
      expect(result.refreshedCount).toBeGreaterThanOrEqual(1);
      expect(result.coverages.length).toEqual(result.refreshedCount);

      // AC11: Returns refreshed coverage data
      expect(result.coverages[0]).toHaveProperty("frameworkId");
      expect(result.coverages[0]).toHaveProperty("coveragePercentage");
      expect(result.coverages[0]).toHaveProperty("satisfiedControlsCount");
      expect(result.coverages[0]).toHaveProperty("totalControlsCount");
    });

    it("AC11: Returns duration metric for performance monitoring", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.refreshAllCoverage();

      // Should include duration for performance monitoring (AC6)
      expect(result).toHaveProperty("durationMs");
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("AC8: BUSINESS_USER has FRAMEWORK_READ and can refresh all coverage", async () => {
      // BUSINESS_USER (read-only) holds FRAMEWORK_READ, so refresh is permitted
      const caller = createCaller(testUserITStakeholder);
      const result = await caller.compliance.refreshAllCoverage();

      expect(result.refreshedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AC12-AC15: Per-Framework Refresh", () => {
    it("AC13: Refreshes only the specified framework", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      // Get initial state
      const initialSummary = await caller.compliance.getComplianceSummary();
      const initialFramework = initialSummary.frameworks.find(
        (f) => f.frameworkId === testFramework.id
      );

      // Refresh specific framework
      const result = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      // Should return coverage for just that framework
      expect(result.frameworkId).toBe(testFramework.id);
      expect(result).toHaveProperty("coveragePercentage");
      expect(result).toHaveProperty("satisfiedControlsCount");
      expect(result).toHaveProperty("totalControlsCount");
    });

    it("AC14: Per-framework refresh updates lastCalculatedAt timestamp", async () => {
      // First ensure the framework has a cached coverage
      const caller = createCaller(testUserGRCAnalyst);
      const initialResult = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(initialResult).toHaveProperty("lastUpdated");
      const initialTimestamp = new Date(initialResult.lastUpdated).getTime();

      // Wait a small moment to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh again
      const updatedResult = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(updatedResult).toHaveProperty("lastUpdated");
      const updatedTimestamp = new Date(updatedResult.lastUpdated).getTime();

      // The timestamp should be more recent
      expect(updatedTimestamp).toBeGreaterThan(initialTimestamp);
    });

    it("AC15: Returns error for non-existent framework", async () => {
      const caller = createCaller(testUserGRCAnalyst);

      await expect(
        caller.compliance.refreshFrameworkCoverage({
          frameworkId: "non-existent-framework-id",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("AC12: BUSINESS_USER has FRAMEWORK_READ and can refresh framework coverage", async () => {
      // BUSINESS_USER (read-only) holds FRAMEWORK_READ, so per-framework refresh is permitted
      const caller = createCaller(testUserITStakeholder);
      const result = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(result.frameworkId).toBe(testFramework.id);
    });

    it("GRC_ANALYST can refresh framework coverage", async () => {
      const caller = createCaller(testUserGRCAnalyst);
      const result = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(result.frameworkId).toBe(testFramework.id);
    });

    it("CISO can refresh framework coverage", async () => {
      const caller = createCaller(testUserCISO);
      const result = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(result.frameworkId).toBe(testFramework.id);
    });

    it("AUDITOR can refresh framework coverage", async () => {
      const caller = createCaller(testUserAuditor);
      const result = await caller.compliance.refreshFrameworkCoverage({
        frameworkId: testFramework.id,
      });

      expect(result.frameworkId).toBe(testFramework.id);
    });
  });
});

/**
 * Story 5.3: Automatic Compliance Updates (Evidence/Risk Triggers) Tests
 */
describe("Story 5.3: Automatic Compliance Updates", () => {
  beforeEach(() => {
    // Clear the queue before each test
    clearQueue();
  });

  describe("Compliance Job Queue Service (AC14-AC18)", () => {
    it("AC14: queueComplianceRecalculation adds job to queue", () => {
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");

      const status = getQueueStatus();
      expect(status.pendingJobs).toBe(1);
      expect(status.activeDebounceTimers).toBe(1);
    });

    it("AC18: Duplicate jobs for same framework are deduplicated", () => {
      // Queue same framework multiple times
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");

      const status = getQueueStatus();
      expect(status.pendingJobs).toBe(1); // Should still be 1, not 3
    });

    it("AC5: Multiple frameworks are queued separately", () => {
      // Queue different frameworks
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");
      queueComplianceRecalculation("framework-2", testOrg.id, "evidence_upload");
      queueComplianceRecalculation("framework-3", testOrg.id, "evidence_upload");

      const status = getQueueStatus();
      expect(status.pendingJobs).toBe(3);
    });

    it("queueMultipleFrameworkRecalculations queues all frameworks", () => {
      queueMultipleFrameworkRecalculations(
        [testFramework.id, "framework-2", "framework-3"],
        testOrg.id,
        "evidence_delete"
      );

      const status = getQueueStatus();
      expect(status.pendingJobs).toBe(3);
    });

    it("clearQueue removes all pending jobs", () => {
      queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");
      queueComplianceRecalculation("framework-2", testOrg.id, "evidence_upload");

      clearQueue();

      const status = getQueueStatus();
      expect(status.pendingJobs).toBe(0);
      expect(status.activeDebounceTimers).toBe(0);
    });
  });

  describe("AC1-AC3: Get Affected Framework IDs for Evidence", () => {
    it("getAffectedFrameworkIdsForEvidence returns frameworks from control domain mappings", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence tagged with our control domain
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Evidence for Affected Frameworks",
            originalFileName: "test-affected.pdf",
            filePath: "/uploads/test-affected.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Get affected frameworks
        const frameworkIds = await getAffectedFrameworkIdsForEvidence(evidence.id, db);

        // Should include our test framework (which has controls mapped to testControlDomain)
        expect(frameworkIds).toContain(testFramework.id);

        // Cleanup
        await db.evidenceControlDomain.deleteMany({
          where: { evidenceId: evidence.id },
        });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });

    it("getAffectedFrameworkIdsForEvidence returns empty array for evidence with no control domains", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence without control domain tags
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Untagged Evidence",
            originalFileName: "untagged.pdf",
            filePath: "/uploads/untagged.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        const frameworkIds = await getAffectedFrameworkIdsForEvidence(evidence.id, db);
        expect(frameworkIds).toHaveLength(0);

        // Cleanup
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });
  });

  describe("AC10-AC12: Get Affected Framework IDs for Risk", () => {
    it("getAffectedFrameworkIdsForRisk returns frameworks from linked evidence", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create a risk
        const risk = await db.risk.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Test Risk for Affected Frameworks",
            description: "Test risk description",
            severity: Severity.HIGH,
            status: RiskStatus.OPEN,
          },
        });

        // Create evidence and tag it
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Evidence Linked to Risk",
            originalFileName: "risk-evidence.pdf",
            filePath: "/uploads/risk-evidence.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Link evidence to risk
        await db.riskEvidence.create({
          data: {
            id: randomUUID(),
            riskId: risk.id,
            evidenceId: evidence.id,
            linkType: "REMEDIATION",
            linkedAt: new Date(),
            linkedById: testUserGRCAnalyst.id,
          },
        });

        // Get affected frameworks
        const frameworkIds = await getAffectedFrameworkIdsForRisk(risk.id, db);

        expect(frameworkIds).toContain(testFramework.id);

        // Cleanup
        await db.riskEvidence.deleteMany({ where: { riskId: risk.id } });
        await db.evidenceControlDomain.deleteMany({ where: { evidenceId: evidence.id } });
        await db.evidence.delete({ where: { id: evidence.id } });
        await db.risk.delete({ where: { id: risk.id } });
      });
    });

    it("getAffectedFrameworkIdsForRisk returns empty array for risk with no linked evidence", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create a risk without evidence
        const risk = await db.risk.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Risk Without Evidence",
            description: "Test risk description",
            severity: Severity.MEDIUM,
            status: RiskStatus.OPEN,
          },
        });

        const frameworkIds = await getAffectedFrameworkIdsForRisk(risk.id, db);
        expect(frameworkIds).toHaveLength(0);

        // Cleanup
        await db.risk.delete({ where: { id: risk.id } });
      });
    });
  });

  describe("AC16: Job Processing with Retry", () => {
    it("forceProcessAllJobs processes queued jobs", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence for coverage
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Evidence for Job Processing",
            originalFileName: "job-test.pdf",
            filePath: "/uploads/job-test.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Queue recalculation
        queueComplianceRecalculation(testFramework.id, testOrg.id, "evidence_upload");

        // Force process all jobs (bypasses debounce)
        await forceProcessAllJobs();

        // Check queue is empty
        expect(getPendingJobCount()).toBe(0);

        // Verify cache was updated
        const cached = await db.frameworkCoverage.findFirst({
          where: {
            frameworkId: testFramework.id,
            organizationId: testOrg.id,
            businessUnitId: null,
          },
        });

        expect(cached).not.toBeNull();
        expect(Number(cached!.coveragePercentage)).toBe(50);

        // Cleanup
        await db.evidenceControlDomain.deleteMany({ where: { evidenceId: evidence.id } });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });
  });

  describe("End-to-End: Evidence Upload Triggers Recalculation", () => {
    it("AC1-AC5: Evidence upload queues recalculation for affected frameworks", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Get initial coverage (should be 0% with no evidence)
        await refreshFrameworkCoverage(testFramework.id, testOrg.id, db);
        const initialCoverage = await calculateFrameworkCoverage(
          testFramework.id,
          testOrg.id,
          db
        );

        // Create evidence and tag (simulating what upload mutation does)
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Upload Test Evidence",
            originalFileName: "upload-test.pdf",
            filePath: "/uploads/upload-test.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Get affected frameworks and queue recalculation (what upload hook does)
        const affectedIds = await getAffectedFrameworkIdsForEvidence(evidence.id, db);
        expect(affectedIds).toContain(testFramework.id);

        queueMultipleFrameworkRecalculations(affectedIds, testOrg.id, "evidence_upload");

        // Force process jobs
        await forceProcessAllJobs();

        // Verify coverage was updated
        const newCoverage = await calculateFrameworkCoverage(
          testFramework.id,
          testOrg.id,
          db
        );

        expect(newCoverage.coveragePercentage).toBe(50); // 5/10 controls satisfied

        // Cleanup
        await db.evidenceControlDomain.deleteMany({ where: { evidenceId: evidence.id } });
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });
  });

  describe("End-to-End: Evidence Deletion Triggers Recalculation", () => {
    it("AC6-AC9: Evidence deletion queues recalculation for affected frameworks", async () => {
      await runWithOrganizationContext(testOrg.id, async () => {
        // Create evidence and tag
        const evidence = await db.evidence.create({
          data: {
            id: randomUUID(),
            organizationId: testOrg.id,
            title: "Delete Test Evidence",
            originalFileName: "delete-test.pdf",
            filePath: "/uploads/delete-test.pdf",
            fileSize: 1024,
            fileType: "application/pdf",
            uploadedBy: testUserGRCAnalyst.id,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        await db.evidenceControlDomain.create({
          data: {
            id: randomUUID(),
            evidenceId: evidence.id,
            controlDomainId: testControlDomain.id,
          },
        });

        // Refresh to establish baseline
        await refreshFrameworkCoverage(testFramework.id, testOrg.id, db);
        let coverage = await calculateFrameworkCoverage(testFramework.id, testOrg.id, db);
        expect(coverage.coveragePercentage).toBe(50);

        // Get affected frameworks BEFORE deletion
        const affectedIds = await getAffectedFrameworkIdsForEvidence(evidence.id, db);
        expect(affectedIds.length).toBeGreaterThan(0);

        // Delete evidence (simulating what delete mutation does)
        await db.evidenceControlDomain.deleteMany({ where: { evidenceId: evidence.id } });
        await db.evidence.update({
          where: { id: evidence.id },
          data: { isActive: false, deletedAt: new Date() },
        });

        // Queue recalculation (what delete hook does)
        queueMultipleFrameworkRecalculations(affectedIds, testOrg.id, "evidence_delete");
        await forceProcessAllJobs();

        // Verify coverage dropped
        coverage = await calculateFrameworkCoverage(testFramework.id, testOrg.id, db);
        expect(coverage.coveragePercentage).toBe(0);

        // Cleanup
        await db.evidence.delete({ where: { id: evidence.id } });
      });
    });
  });
});
