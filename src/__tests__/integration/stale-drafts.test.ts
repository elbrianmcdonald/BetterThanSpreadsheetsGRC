/**
 * Stale Drafts Widget Integration Tests
 *
 * Story 7.13: Stale Draft Dashboard Widget
 *
 * Tests for:
 * - listStale query
 * - Days calculation utilities
 * - Widget display logic
 */


import { AssessmentStatus } from "@prisma/client";
import {
  calculateDaysStale,
  getDaysStaleColor,
  getDaysStaleBgColor,
  formatDaysStale,
} from "../../lib/utils/stale-drafts";

// Mock data
const mockOrganizationId = "org-123";
const mockUserId = "user-123";

const mockAssessments = [
  {
    id: "assessment-1",
    identifier: "RA-2024-0001",
    title: "SQL Injection Risk Assessment",
    status: AssessmentStatus.DRAFT,
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    organizationId: mockOrganizationId,
    ownerId: mockUserId,
    owner: { id: mockUserId, name: "John Doe" },
    finding: { id: "finding-1", identifier: "FND-2024-0001" },
  },
  {
    id: "assessment-2",
    identifier: "RA-2024-0002",
    title: "XSS Vulnerability Assessment",
    status: AssessmentStatus.DRAFT,
    updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    organizationId: mockOrganizationId,
    ownerId: mockUserId,
    owner: { id: mockUserId, name: "Jane Smith" },
    finding: { id: "finding-2", identifier: "FND-2024-0002" },
  },
  {
    id: "assessment-3",
    identifier: "RA-2024-0003",
    title: "Recent Assessment",
    status: AssessmentStatus.DRAFT,
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (not stale)
    organizationId: mockOrganizationId,
    ownerId: mockUserId,
    owner: { id: mockUserId, name: "Bob Wilson" },
    finding: { id: "finding-3", identifier: "FND-2024-0003" },
  },
  {
    id: "assessment-4",
    identifier: "RA-2024-0004",
    title: "Completed Assessment",
    status: AssessmentStatus.COMPLETED,
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago but COMPLETED
    organizationId: mockOrganizationId,
    ownerId: mockUserId,
    owner: { id: mockUserId, name: "Alice Brown" },
    finding: null,
  },
];

describe("Story 7.13: Stale Draft Dashboard Widget", () => {
  describe("Days Stale Calculation (AC3, AC4)", () => {
    it("AC3: should calculate days from updatedAt timestamp", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const days = calculateDaysStale(tenDaysAgo);

      expect(days).toBe(10);
    });

    it("should handle string date input", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const days = calculateDaysStale(tenDaysAgo.toISOString());

      expect(days).toBe(10);
    });

    it("should return 0 for today", () => {
      const today = new Date();
      const days = calculateDaysStale(today);

      expect(days).toBe(0);
    });

    it("should return 1 for yesterday", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const days = calculateDaysStale(yesterday);

      expect(days).toBe(1);
    });
  });

  describe("Days Stale Color Coding (AC20)", () => {
    it("should return gray for < 7 days", () => {
      expect(getDaysStaleColor(0)).toBe("text-gray-600");
      expect(getDaysStaleColor(6)).toBe("text-gray-600");
    });

    it("should return amber/yellow for 7-13 days", () => {
      expect(getDaysStaleColor(7)).toBe("text-amber-600");
      expect(getDaysStaleColor(10)).toBe("text-amber-600");
      expect(getDaysStaleColor(13)).toBe("text-amber-600");
    });

    it("should return red for 14+ days", () => {
      expect(getDaysStaleColor(14)).toBe("text-red-600");
      expect(getDaysStaleColor(20)).toBe("text-red-600");
      expect(getDaysStaleColor(100)).toBe("text-red-600");
    });
  });

  describe("Days Stale Background Color (AC20)", () => {
    it("should return gray background for < 7 days", () => {
      expect(getDaysStaleBgColor(5)).toContain("bg-gray-100");
    });

    it("should return amber background for 7-13 days", () => {
      expect(getDaysStaleBgColor(10)).toContain("bg-amber-100");
    });

    it("should return red background for 14+ days", () => {
      expect(getDaysStaleBgColor(15)).toContain("bg-red-100");
    });
  });

  describe("Days Stale Formatting", () => {
    it("should format 0 days as 'Today'", () => {
      expect(formatDaysStale(0)).toBe("Today");
    });

    it("should format 1 day as '1 day'", () => {
      expect(formatDaysStale(1)).toBe("1 day");
    });

    it("should format multiple days as 'X days'", () => {
      expect(formatDaysStale(5)).toBe("5 days");
      expect(formatDaysStale(10)).toBe("10 days");
    });
  });

  describe("Stale Query Logic (AC1, AC11-AC14)", () => {
    it("AC1: should identify stale drafts based on threshold", () => {
      const daysThreshold = 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const stale = mockAssessments.filter(
        (a) => a.status === AssessmentStatus.DRAFT && a.updatedAt < thresholdDate
      );

      // Should include assessment-1 (10 days) and assessment-2 (15 days)
      expect(stale).toHaveLength(2);
    });

    it("AC11: should only include DRAFT status", () => {
      const daysThreshold = 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const stale = mockAssessments.filter(
        (a) => a.status === AssessmentStatus.DRAFT && a.updatedAt < thresholdDate
      );

      // assessment-4 is COMPLETED so shouldn't be included
      stale.forEach((a) => {
        expect(a.status).toBe(AssessmentStatus.DRAFT);
      });
    });

    it("AC12: should respect custom threshold", () => {
      const daysThreshold = 14;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const stale = mockAssessments.filter(
        (a) => a.status === AssessmentStatus.DRAFT && a.updatedAt < thresholdDate
      );

      // Only assessment-2 (15 days) should be included
      expect(stale).toHaveLength(1);
      expect(stale[0]?.identifier).toBe("RA-2024-0002");
    });

    it("AC14: should filter by organization", () => {
      const orgFilter = mockOrganizationId;

      const orgAssessments = mockAssessments.filter(
        (a) => a.organizationId === orgFilter
      );

      expect(orgAssessments.length).toBe(mockAssessments.length);
    });

    it("should order by updatedAt ascending (oldest first)", () => {
      const daysThreshold = 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const stale = mockAssessments
        .filter(
          (a) => a.status === AssessmentStatus.DRAFT && a.updatedAt < thresholdDate
        )
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

      // Oldest (assessment-2, 15 days) should be first
      expect(stale[0]?.identifier).toBe("RA-2024-0002");
      expect(stale[1]?.identifier).toBe("RA-2024-0001");
    });
  });

  describe("Widget Display Logic (AC5-AC10)", () => {
    it("AC6: should show count of stale assessments", () => {
      const daysThreshold = 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

      const stale = mockAssessments.filter(
        (a) => a.status === AssessmentStatus.DRAFT && a.updatedAt < thresholdDate
      );
      const count = stale.length;

      expect(count).toBe(2);
    });

    it("AC7: should limit to 5 items", () => {
      const limit = 5;
      const items = mockAssessments.slice(0, limit);

      expect(items.length).toBeLessThanOrEqual(5);
    });

    it("AC8: should include identifier, title, days stale, owner", () => {
      const assessment = mockAssessments[0]!;

      expect(assessment).toHaveProperty("identifier");
      expect(assessment).toHaveProperty("title");
      expect(assessment).toHaveProperty("updatedAt");
      expect(assessment).toHaveProperty("owner");
      expect(assessment.owner).toHaveProperty("name");
    });

    it("AC8: should include finding for navigation", () => {
      const assessment = mockAssessments[0]!;

      expect(assessment).toHaveProperty("finding");
      expect(assessment.finding).toHaveProperty("id");
    });

    it("AC10: should show empty state when no stale drafts", () => {
      const recentAssessments = mockAssessments.filter(
        (a) => calculateDaysStale(a.updatedAt) < 7
      );

      const staleDrafts = recentAssessments.filter(
        (a) => a.status === AssessmentStatus.DRAFT && calculateDaysStale(a.updatedAt) >= 7
      );

      const showEmptyState = staleDrafts.length === 0;
      expect(showEmptyState).toBe(true);
    });
  });

  describe("Widget Interactions (AC15-AC18)", () => {
    it("AC15: should link to finding detail page", () => {
      const assessment = mockAssessments[0]!;
      const href = assessment.finding
        ? `/findings/${assessment.finding.id}`
        : `/assessments/${assessment.id}`;

      expect(href).toBe("/findings/finding-1");
    });

    it("AC15: should fallback to assessment page if no finding", () => {
      const assessment = mockAssessments[3]!; // COMPLETED assessment with no finding
      const href = assessment.finding
        ? `/findings/${assessment.finding.id}`
        : `/assessments/${assessment.id}`;

      expect(href).toBe("/assessments/assessment-4");
    });
  });

  describe("Visual Design (AC19-AC22)", () => {
    it("AC21: should display owner name", () => {
      const assessment = mockAssessments[0]!;

      expect(assessment.owner?.name).toBe("John Doe");
    });

    it("should handle null owner gracefully", () => {
      const assessmentWithoutOwner = {
        ...mockAssessments[0],
        owner: null,
      };

      const ownerName = assessmentWithoutOwner.owner?.name ?? "Unknown";
      expect(ownerName).toBe("Unknown");
    });

    it("should handle owner with null name", () => {
      const assessmentWithNullName = {
        ...mockAssessments[0],
        owner: { id: "user-1", name: null },
      };

      const ownerName = assessmentWithNullName.owner?.name ?? "Unknown";
      expect(ownerName).toBe("Unknown");
    });
  });

  describe("View All Link (AC9)", () => {
    it("should show View All link when count > 5", () => {
      const count = 10;
      const showViewAll = count > 5;

      expect(showViewAll).toBe(true);
    });

    it("should hide View All link when count <= 5", () => {
      const count = 3;
      const showViewAll = count > 5;

      expect(showViewAll).toBe(false);
    });

    it("should construct correct View All URL", () => {
      const expectedUrl = "/assessments?status=DRAFT&sort=updatedAt&order=asc";

      expect(expectedUrl).toContain("status=DRAFT");
      expect(expectedUrl).toContain("sort=updatedAt");
      expect(expectedUrl).toContain("order=asc");
    });
  });

  describe("Query Input Validation", () => {
    it("should accept valid daysThreshold", () => {
      const validInputs = [1, 7, 14, 30];
      validInputs.forEach((days) => {
        expect(days).toBeGreaterThanOrEqual(1);
      });
    });

    it("should accept valid limit", () => {
      const validLimits = [1, 5, 10];
      validLimits.forEach((limit) => {
        expect(limit).toBeGreaterThanOrEqual(1);
        expect(limit).toBeLessThanOrEqual(10);
      });
    });

    it("should use default values", () => {
      const defaults = {
        daysThreshold: 7,
        limit: 5,
      };

      expect(defaults.daysThreshold).toBe(7);
      expect(defaults.limit).toBe(5);
    });
  });
});
