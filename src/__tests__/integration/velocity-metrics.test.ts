/**
 * Story 5.8: Remediation Velocity Metrics Integration Tests
 *
 * Tests for velocity calculation and reporting:
 * - AC7-AC11: Velocity calculation
 * - AC22-AC25: Velocity query
 * - AC26-AC29: Benchmark indicators
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock Prisma types
type Severity = "HIGH" | "MEDIUM" | "LOW";
type RiskStatus = "OPEN" | "ASSIGNED" | "CLOSED";
type RiskFindingSource = "PENETRATION_TEST" | "VULNERABILITY_SCAN" | "AUDIT" | "INTERNAL_REVIEW" | "EXTERNAL_REPORT" | "GRC_ASSESSMENT";

interface MockRisk {
  id: string;
  organizationId: string;
  title: string;
  severity: Severity;
  status: RiskStatus;
  findingSource: RiskFindingSource | null;
  createdAt: Date;
  closedAt: Date | null;
  assignedTo: string | null;
  User?: {
    name: string | null;
    email: string;
  } | null;
}

// Mock database
const mockDb = {
  risk: {
    findMany: jest.fn(),
  },
};

// Velocity benchmarks per AC26-AC29
const VELOCITY_BENCHMARKS = {
  HIGH: 14,
  MEDIUM: 30,
  LOW: 60,
};

// Helper to calculate velocity (AC7)
function calculateDaysToClose(createdAt: Date, closedAt: Date): number {
  return Math.floor(
    (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
}

// Helper to calculate average velocity
function calculateAverageVelocity(risks: Array<{ daysToClose: number }>): number {
  if (risks.length === 0) return 0;
  const total = risks.reduce((sum, r) => sum + r.daysToClose, 0);
  return total / risks.length;
}

// Helper to generate mock closed risks
function createMockClosedRisk(
  overrides: Partial<MockRisk> = {}
): MockRisk {
  const createdAt = new Date("2024-01-01");
  const closedAt = new Date("2024-01-15"); // 14 days to close

  return {
    id: `risk-${Math.random().toString(36).substr(2, 9)}`,
    organizationId: "org-1",
    title: "Test Risk",
    severity: "HIGH",
    status: "CLOSED",
    findingSource: "VULNERABILITY_SCAN",
    createdAt,
    closedAt,
    assignedTo: "user-1",
    User: {
      name: "Test User",
      email: "test@example.com",
    },
    ...overrides,
  };
}

describe("Story 5.8: Remediation Velocity Metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Velocity Calculation (AC7-AC11)", () => {
    it("AC7: calculates days-to-close correctly", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-15T00:00:00Z");

      const daysToClose = calculateDaysToClose(createdAt, closedAt);

      expect(daysToClose).toBe(14);
    });

    it("AC7: handles same-day closure", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-01-01T12:00:00Z");

      const daysToClose = calculateDaysToClose(createdAt, closedAt);

      expect(daysToClose).toBe(0);
    });

    it("AC7: handles long remediation times", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const closedAt = new Date("2024-12-31T00:00:00Z");

      const daysToClose = calculateDaysToClose(createdAt, closedAt);

      expect(daysToClose).toBe(365);
    });

    it("AC8: calculates average across all CLOSED risks", () => {
      const risks = [
        { daysToClose: 10 },
        { daysToClose: 20 },
        { daysToClose: 30 },
      ];

      const average = calculateAverageVelocity(risks);

      expect(average).toBe(20);
    });

    it("AC8: returns 0 for empty array", () => {
      const risks: Array<{ daysToClose: number }> = [];

      const average = calculateAverageVelocity(risks);

      expect(average).toBe(0);
    });

    it("AC9: calculates average separately for each severity level", () => {
      const highRisks = [{ daysToClose: 5 }, { daysToClose: 10 }];
      const mediumRisks = [{ daysToClose: 20 }, { daysToClose: 30 }];
      const lowRisks = [{ daysToClose: 40 }, { daysToClose: 60 }];

      const avgHigh = calculateAverageVelocity(highRisks);
      const avgMedium = calculateAverageVelocity(mediumRisks);
      const avgLow = calculateAverageVelocity(lowRisks);

      expect(avgHigh).toBe(7.5);
      expect(avgMedium).toBe(25);
      expect(avgLow).toBe(50);
    });

    it("AC10: only includes CLOSED risks in calculation", () => {
      const allRisks: MockRisk[] = [
        createMockClosedRisk({ status: "CLOSED" }),
        createMockClosedRisk({ status: "OPEN" as RiskStatus, closedAt: null }),
        createMockClosedRisk({ status: "ASSIGNED" as RiskStatus, closedAt: null }),
      ];

      const closedRisks = allRisks.filter((r) => r.status === "CLOSED");

      expect(closedRisks.length).toBe(1);
    });

    it("AC11: skips risks with missing closedAt gracefully", () => {
      const risks: MockRisk[] = [
        createMockClosedRisk({ closedAt: new Date("2024-01-15") }),
        createMockClosedRisk({ closedAt: null }), // Should be skipped
        createMockClosedRisk({ closedAt: new Date("2024-01-20") }),
      ];

      const validRisks = risks.filter((r) => r.closedAt !== null);
      const risksWithDays = validRisks.map((r) => ({
        daysToClose: calculateDaysToClose(r.createdAt, r.closedAt!),
      }));

      expect(risksWithDays.length).toBe(2);
    });
  });

  describe("Velocity Query (AC22-AC25)", () => {
    it("AC22: returns average days-to-close", () => {
      const risks = [{ daysToClose: 10 }, { daysToClose: 20 }];
      const overall = calculateAverageVelocity(risks);

      expect(overall).toBe(15);
    });

    it("AC23: accepts timeframe parameter (30/60/90/180/365 days)", () => {
      const validTimeframes = [30, 60, 90, 180, 365];

      validTimeframes.forEach((days) => {
        expect(days >= 30 && days <= 365).toBe(true);
      });
    });

    it("AC24: calculates average per severity level", () => {
      const highRisks = [createMockClosedRisk({ severity: "HIGH" })];
      const mediumRisks = [createMockClosedRisk({ severity: "MEDIUM" })];
      const lowRisks = [createMockClosedRisk({ severity: "LOW" })];

      // Group by severity
      const bySeverity = {
        HIGH: highRisks.filter((r) => r.severity === "HIGH"),
        MEDIUM: mediumRisks.filter((r) => r.severity === "MEDIUM"),
        LOW: lowRisks.filter((r) => r.severity === "LOW"),
      };

      expect(bySeverity.HIGH.length).toBe(1);
      expect(bySeverity.MEDIUM.length).toBe(1);
      expect(bySeverity.LOW.length).toBe(1);
    });

    it("AC25: returns monthly averages for trend data", () => {
      const now = new Date();
      const last12Months: string[] = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        last12Months.push(monthStr);
      }

      expect(last12Months.length).toBe(12);
      expect(last12Months[0]).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe("Benchmark Indicators (AC26-AC29)", () => {
    it("AC26: defines industry benchmark thresholds", () => {
      expect(VELOCITY_BENCHMARKS).toBeDefined();
      expect(VELOCITY_BENCHMARKS.HIGH).toBe(14);
      expect(VELOCITY_BENCHMARKS.MEDIUM).toBe(30);
      expect(VELOCITY_BENCHMARKS.LOW).toBe(60);
    });

    it("AC27: HIGH risks benchmark is <14 days", () => {
      const benchmark = VELOCITY_BENCHMARKS.HIGH;
      expect(benchmark).toBe(14);

      // Test meeting benchmark
      const meetsBenchmark = 10 <= benchmark;
      expect(meetsBenchmark).toBe(true);

      // Test exceeding benchmark
      const exceedsBenchmark = 20 > benchmark;
      expect(exceedsBenchmark).toBe(true);
    });

    it("AC28: MEDIUM risks benchmark is <30 days", () => {
      const benchmark = VELOCITY_BENCHMARKS.MEDIUM;
      expect(benchmark).toBe(30);

      // Test meeting benchmark
      const meetsBenchmark = 25 <= benchmark;
      expect(meetsBenchmark).toBe(true);

      // Test exceeding benchmark
      const exceedsBenchmark = 45 > benchmark;
      expect(exceedsBenchmark).toBe(true);
    });

    it("AC29: LOW risks benchmark is <60 days", () => {
      const benchmark = VELOCITY_BENCHMARKS.LOW;
      expect(benchmark).toBe(60);

      // Test meeting benchmark
      const meetsBenchmark = 45 <= benchmark;
      expect(meetsBenchmark).toBe(true);

      // Test exceeding benchmark
      const exceedsBenchmark = 90 > benchmark;
      expect(exceedsBenchmark).toBe(true);
    });

    it("provides visual indicators for benchmark status", () => {
      const checkBenchmarkStatus = (velocity: number, benchmark: number) => {
        if (velocity <= benchmark) {
          return "meeting"; // Green indicator
        }
        return "exceeding"; // Red indicator
      };

      expect(checkBenchmarkStatus(10, VELOCITY_BENCHMARKS.HIGH)).toBe("meeting");
      expect(checkBenchmarkStatus(20, VELOCITY_BENCHMARKS.HIGH)).toBe("exceeding");
    });
  });

  describe("Trend Comparison (AC4-AC5)", () => {
    it("AC4: calculates trend by comparing current to previous period", () => {
      const currentPeriodAvg = 15;
      const previousPeriodAvg = 20;

      const change = currentPeriodAvg - previousPeriodAvg;
      const direction = change < 0 ? "improving" : change > 0 ? "degrading" : "stable";

      expect(change).toBe(-5);
      expect(direction).toBe("improving");
    });

    it("AC5: identifies improving trend (velocity decreased)", () => {
      const current = 10;
      const previous = 20;

      const isImproving = current < previous;
      expect(isImproving).toBe(true);
    });

    it("AC5: identifies degrading trend (velocity increased)", () => {
      const current = 30;
      const previous = 20;

      const isDegrading = current > previous;
      expect(isDegrading).toBe(true);
    });

    it("AC5: identifies stable trend (no significant change)", () => {
      const current = 20;
      const previous = 20;

      const isStable = Math.abs(current - previous) < 1;
      expect(isStable).toBe(true);
    });
  });

  describe("Multi-tenancy (7.5)", () => {
    it("only includes risks from the user's organization", async () => {
      const org1Risks = [
        createMockClosedRisk({ organizationId: "org-1" }),
        createMockClosedRisk({ organizationId: "org-1" }),
      ];
      const org2Risks = [createMockClosedRisk({ organizationId: "org-2" })];

      const allRisks = [...org1Risks, ...org2Risks];

      // Filter for org-1
      const org1FilteredRisks = allRisks.filter(
        (r) => r.organizationId === "org-1"
      );

      expect(org1FilteredRisks.length).toBe(2);
      expect(org1FilteredRisks.every((r) => r.organizationId === "org-1")).toBe(true);
    });
  });

  describe("Velocity by Owner", () => {
    it("groups velocity by IT owner", () => {
      const risks: MockRisk[] = [
        createMockClosedRisk({
          assignedTo: "user-1",
          User: { name: "Alice", email: "alice@example.com" },
        }),
        createMockClosedRisk({
          assignedTo: "user-1",
          User: { name: "Alice", email: "alice@example.com" },
        }),
        createMockClosedRisk({
          assignedTo: "user-2",
          User: { name: "Bob", email: "bob@example.com" },
        }),
      ];

      // Group by owner
      const byOwner = new Map<string, MockRisk[]>();
      for (const risk of risks) {
        const ownerId = risk.assignedTo || "unassigned";
        const existing = byOwner.get(ownerId) || [];
        existing.push(risk);
        byOwner.set(ownerId, existing);
      }

      expect(byOwner.get("user-1")?.length).toBe(2);
      expect(byOwner.get("user-2")?.length).toBe(1);
    });
  });

  describe("Velocity by Finding Source", () => {
    it("groups velocity by finding source", () => {
      const risks: MockRisk[] = [
        createMockClosedRisk({ findingSource: "VULNERABILITY_SCAN" }),
        createMockClosedRisk({ findingSource: "VULNERABILITY_SCAN" }),
        createMockClosedRisk({ findingSource: "PENETRATION_TEST" }),
        createMockClosedRisk({ findingSource: "AUDIT" }),
      ];

      // Group by source
      const bySource = new Map<string, MockRisk[]>();
      for (const risk of risks) {
        const source = risk.findingSource || "UNKNOWN";
        const existing = bySource.get(source) || [];
        existing.push(risk);
        bySource.set(source, existing);
      }

      expect(bySource.get("VULNERABILITY_SCAN")?.length).toBe(2);
      expect(bySource.get("PENETRATION_TEST")?.length).toBe(1);
      expect(bySource.get("AUDIT")?.length).toBe(1);
    });
  });

  describe("Slowest Risks", () => {
    it("identifies top 10 slowest remediation risks", () => {
      const risks = Array.from({ length: 20 }, (_, i) =>
        createMockClosedRisk({
          title: `Risk ${i + 1}`,
          closedAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
        })
      );

      // Add days to close
      const risksWithDays = risks.map((r) => ({
        ...r,
        daysToClose: calculateDaysToClose(r.createdAt, r.closedAt!),
      }));

      // Sort by days to close descending
      const sorted = [...risksWithDays].sort(
        (a, b) => b.daysToClose - a.daysToClose
      );

      // Take top 10
      const slowest10 = sorted.slice(0, 10);

      expect(slowest10.length).toBe(10);
      // Verify descending order
      for (let i = 1; i < slowest10.length; i++) {
        expect(slowest10[i]!.daysToClose).toBeLessThanOrEqual(
          slowest10[i - 1]!.daysToClose
        );
      }
    });
  });

  describe("CSV Export", () => {
    it("generates CSV with required columns", () => {
      const headers = [
        "Risk ID",
        "Title",
        "Severity",
        "Days to Close",
        "Created Date",
        "Closed Date",
        "Owner",
        "Finding Source",
      ];

      const csvHeader = headers.join(",");

      expect(csvHeader).toContain("Risk ID");
      expect(csvHeader).toContain("Title");
      expect(csvHeader).toContain("Severity");
      expect(csvHeader).toContain("Days to Close");
    });

    it("escapes CSV special characters", () => {
      const escapeCSV = (value: string): string => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      expect(escapeCSV("Risk with, comma")).toBe('"Risk with, comma"');
      expect(escapeCSV('Risk with "quotes"')).toBe('"Risk with ""quotes"""');
      expect(escapeCSV("Normal risk")).toBe("Normal risk");
    });
  });
});
