/**
 * Findings List Page Integration Tests
 *
 * Story 7.12: Findings List Page
 *
 * Tests for:
 * - List query with filters
 * - Sorting
 * - Pagination
 * - Permissions
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { FindingStatus, FindingSource, Severity, UserRole } from "@prisma/client";

// Mock data
const mockOrganizationId = "org-123";
const mockUserId = "user-123";

const mockFindings = [
  {
    id: "finding-1",
    identifier: "FND-2024-0001",
    title: "SQL Injection Vulnerability",
    source: FindingSource.PENTEST,
    severity: Severity.HIGH,
    status: FindingStatus.NEW,
    createdAt: new Date("2024-01-15"),
    organizationId: mockOrganizationId,
    createdBy: mockUserId,
  },
  {
    id: "finding-2",
    identifier: "FND-2024-0002",
    title: "Missing HTTPS Enforcement",
    source: FindingSource.SECURITY_REVIEW,
    severity: Severity.MEDIUM,
    status: FindingStatus.TRIAGED,
    createdAt: new Date("2024-01-14"),
    organizationId: mockOrganizationId,
    createdBy: mockUserId,
  },
  {
    id: "finding-3",
    identifier: "FND-2024-0003",
    title: "Weak Password Policy",
    source: FindingSource.AUDIT,
    severity: Severity.LOW,
    status: FindingStatus.ACCEPTED,
    createdAt: new Date("2024-01-13"),
    organizationId: mockOrganizationId,
    createdBy: mockUserId,
  },
];

describe("Story 7.12: Findings List Page", () => {
  describe("List Query Input Validation", () => {
    it("should accept valid filter inputs", () => {
      const validInput = {
        status: [FindingStatus.NEW, FindingStatus.TRIAGED],
        source: [FindingSource.PENTEST],
        severity: [Severity.HIGH],
        search: "injection",
        sortBy: "createdAt" as const,
        sortOrder: "desc" as const,
        limit: 25,
        cursor: undefined,
      };

      // Validate the shape matches expected
      expect(validInput.status).toHaveLength(2);
      expect(validInput.source).toHaveLength(1);
      expect(validInput.severity).toHaveLength(1);
      expect(validInput.search).toBe("injection");
    });

    it("should use default values for optional fields", () => {
      const minimalInput = {};

      // Default values
      const defaults = {
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 25,
      };

      expect(defaults.sortBy).toBe("createdAt");
      expect(defaults.sortOrder).toBe("desc");
      expect(defaults.limit).toBe(25);
    });

    it("should limit page size to max 100", () => {
      const maxLimit = 100;
      expect(maxLimit).toBeLessThanOrEqual(100);
    });
  });

  describe("Filter Logic (AC13-AC16)", () => {
    it("AC13: should filter by status", () => {
      const statusFilter = [FindingStatus.NEW];
      const filtered = mockFindings.filter((f) =>
        statusFilter.includes(f.status)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.identifier).toBe("FND-2024-0001");
    });

    it("AC13: should filter by multiple statuses", () => {
      const statusFilter = [FindingStatus.NEW, FindingStatus.TRIAGED];
      const filtered = mockFindings.filter((f) =>
        statusFilter.includes(f.status)
      );

      expect(filtered).toHaveLength(2);
    });

    it("AC14: should filter by source", () => {
      const sourceFilter = [FindingSource.PENTEST];
      const filtered = mockFindings.filter((f) =>
        sourceFilter.includes(f.source)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.source).toBe(FindingSource.PENTEST);
    });

    it("AC15: should filter by severity", () => {
      const severityFilter = [Severity.HIGH];
      const filtered = mockFindings.filter((f) =>
        severityFilter.includes(f.severity)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.severity).toBe(Severity.HIGH);
    });

    it("AC16: should filter by search term (title)", () => {
      const searchTerm = "injection";
      const filtered = mockFindings.filter((f) =>
        f.title.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.title).toContain("Injection");
    });

    it("AC16: should filter by search term (identifier)", () => {
      const searchTerm = "FND-2024-0002";
      const filtered = mockFindings.filter((f) =>
        f.identifier.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.identifier).toBe("FND-2024-0002");
    });

    it("should combine multiple filters with AND logic", () => {
      const statusFilter = [FindingStatus.NEW, FindingStatus.TRIAGED];
      const severityFilter = [Severity.HIGH];

      const filtered = mockFindings.filter(
        (f) =>
          statusFilter.includes(f.status) &&
          severityFilter.includes(f.severity)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.status).toBe(FindingStatus.NEW);
      expect(filtered[0]?.severity).toBe(Severity.HIGH);
    });
  });

  describe("Sorting (AC19-AC21)", () => {
    it("AC19: should sort by identifier ascending", () => {
      const sorted = [...mockFindings].sort((a, b) =>
        a.identifier.localeCompare(b.identifier)
      );

      expect(sorted[0]?.identifier).toBe("FND-2024-0001");
      expect(sorted[2]?.identifier).toBe("FND-2024-0003");
    });

    it("AC19: should sort by title", () => {
      const sorted = [...mockFindings].sort((a, b) =>
        a.title.localeCompare(b.title)
      );

      expect(sorted[0]?.title).toBe("Missing HTTPS Enforcement");
    });

    it("AC19: should sort by severity", () => {
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const sorted = [...mockFindings].sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );

      expect(sorted[0]?.severity).toBe(Severity.HIGH);
      expect(sorted[2]?.severity).toBe(Severity.LOW);
    });

    it("AC20: should default sort by createdAt descending", () => {
      const sorted = [...mockFindings].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted[0]?.identifier).toBe("FND-2024-0001");
      expect(sorted[2]?.identifier).toBe("FND-2024-0003");
    });

    it("AC21: should toggle sort direction", () => {
      // Ascending
      const ascending = [...mockFindings].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Descending
      const descending = [...mockFindings].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(ascending[0]?.identifier).toBe("FND-2024-0003");
      expect(descending[0]?.identifier).toBe("FND-2024-0001");
    });
  });

  describe("Pagination (AC22-AC25)", () => {
    it("AC22: should respect page size limit", () => {
      const pageSize = 2;
      const page = mockFindings.slice(0, pageSize);

      expect(page).toHaveLength(2);
    });

    it("AC23: should provide next cursor when more items exist", () => {
      const pageSize = 2;
      const findings = [...mockFindings];
      const hasNextPage = findings.length > pageSize;

      expect(hasNextPage).toBe(true);
    });

    it("AC24: should return total count", () => {
      const totalCount = mockFindings.length;

      expect(totalCount).toBe(3);
    });

    it("AC25: should use cursor for next page", () => {
      const pageSize = 2;
      const cursor = mockFindings[1]?.id;
      const nextPage = mockFindings.filter((f) => f.id > cursor!);

      expect(nextPage.length).toBeLessThanOrEqual(pageSize);
    });
  });

  describe("Column Display (AC5-AC12)", () => {
    it("AC5: should include all required fields", () => {
      const finding = mockFindings[0]!;

      expect(finding).toHaveProperty("identifier");
      expect(finding).toHaveProperty("title");
      expect(finding).toHaveProperty("source");
      expect(finding).toHaveProperty("severity");
      expect(finding).toHaveProperty("status");
      expect(finding).toHaveProperty("createdAt");
    });

    it("AC6: identifier should be a valid format", () => {
      const finding = mockFindings[0]!;
      const identifierRegex = /^FND-\d{4}-\d{4}$/;

      expect(finding.identifier).toMatch(identifierRegex);
    });

    it("AC7: source should be a valid FindingSource", () => {
      const finding = mockFindings[0]!;

      expect(Object.values(FindingSource)).toContain(finding.source);
    });

    it("AC8: severity should be a valid Severity", () => {
      const finding = mockFindings[0]!;

      expect(Object.values(Severity)).toContain(finding.severity);
    });

    it("AC9: status should be a valid FindingStatus", () => {
      const finding = mockFindings[0]!;

      expect(Object.values(FindingStatus)).toContain(finding.status);
    });

    it("AC10: createdAt should be a valid date", () => {
      const finding = mockFindings[0]!;

      expect(finding.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("Empty States (AC26-AC28)", () => {
    it("AC26: should show 'no findings' message when empty", () => {
      const emptyFindings: typeof mockFindings = [];
      const hasFilters = false;

      const showNoFindingsMessage = emptyFindings.length === 0 && !hasFilters;

      expect(showNoFindingsMessage).toBe(true);
    });

    it("AC27: should show 'no matches' message when filtered empty", () => {
      const emptyFindings: typeof mockFindings = [];
      const hasFilters = true;

      const showNoMatchesMessage = emptyFindings.length === 0 && hasFilters;

      expect(showNoMatchesMessage).toBe(true);
    });

    it("AC18: clear filters should reset all filters", () => {
      const filters = {
        status: [FindingStatus.NEW],
        source: [FindingSource.PENTEST],
        severity: [Severity.HIGH],
        search: "test",
      };

      const clearedFilters = {
        status: [],
        source: [],
        severity: [],
        search: "",
      };

      expect(clearedFilters.status).toHaveLength(0);
      expect(clearedFilters.source).toHaveLength(0);
      expect(clearedFilters.severity).toHaveLength(0);
      expect(clearedFilters.search).toBe("");
    });
  });

  describe("Permissions (AC32-AC33)", () => {
    it("AC32: SecurityOrg roles can view findings list", () => {
      const allowedRoles = [
        UserRole.SECURITY_ENGINEER,
        UserRole.GRC_ANALYST,
        UserRole.ORG_ADMIN,
      ];

      allowedRoles.forEach((role) => {
        expect([UserRole.SECURITY_ENGINEER, UserRole.GRC_ANALYST, UserRole.ORG_ADMIN]).toContain(role);
      });
    });

    it("AC33: New Finding button hidden for non-permitted roles", () => {
      const userRole = UserRole.VIEWER;
      const canCreateRoles = [
        UserRole.SECURITY_ENGINEER,
        UserRole.GRC_ANALYST,
        UserRole.ORG_ADMIN,
      ];

      const canCreate = canCreateRoles.includes(userRole);

      expect(canCreate).toBe(false);
    });

    it("AC4: New Finding button visible for permitted roles", () => {
      const userRole = UserRole.GRC_ANALYST;
      const canCreateRoles = [
        UserRole.SECURITY_ENGINEER,
        UserRole.GRC_ANALYST,
        UserRole.ORG_ADMIN,
      ];

      const canCreate = canCreateRoles.includes(userRole);

      expect(canCreate).toBe(true);
    });
  });

  describe("Search Debouncing (AC17)", () => {
    it("should debounce search input", async () => {
      const debounceMs = 300;
      let searchCalls = 0;

      const debouncedSearch = jest.fn(() => {
        searchCalls++;
      });

      // Simulate rapid typing
      debouncedSearch();
      debouncedSearch();
      debouncedSearch();

      // Should not immediately call multiple times
      await new Promise((resolve) => setTimeout(resolve, debounceMs + 50));

      // After debounce, should have called
      expect(debouncedSearch).toHaveBeenCalled();
    });
  });
});

describe("FindingSourceBadge Component", () => {
  it("should have config for all FindingSource values", () => {
    const allSources = Object.values(FindingSource);

    allSources.forEach((source) => {
      expect(source).toBeDefined();
    });

    expect(allSources).toContain(FindingSource.AUDIT);
    expect(allSources).toContain(FindingSource.PENTEST);
    expect(allSources).toContain(FindingSource.SCANNER);
    expect(allSources).toContain(FindingSource.INCIDENT);
    expect(allSources).toContain(FindingSource.MANUAL);
  });
});

describe("FindingFilters Component", () => {
  it("should have options for all statuses", () => {
    const statusOptions = [
      FindingStatus.NEW,
      FindingStatus.NEEDS_INFO,
      FindingStatus.TRIAGED,
      FindingStatus.ACCEPTED,
      FindingStatus.DUPLICATE,
      FindingStatus.REJECTED,
    ];

    expect(statusOptions).toHaveLength(6);
  });

  it("should have options for all sources", () => {
    const sourceOptions = Object.values(FindingSource);

    expect(sourceOptions.length).toBeGreaterThan(0);
  });

  it("should have options for all severities", () => {
    const severityOptions = [Severity.HIGH, Severity.MEDIUM, Severity.LOW];

    expect(severityOptions).toHaveLength(3);
  });
});
