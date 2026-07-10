/**
 * @jest-environment jsdom
 *
 * Unit Tests for RBAC Hooks
 *
 * Tests the usePermission and useHasRole hooks for role-based UI rendering.
 *
 * **Critical Test Coverage:**
 * - usePermission hook with various permissions and roles
 * - useHasRole hook with single and multiple roles
 * - Unauthenticated user behavior
 * - Session state changes
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 */

import { renderHook } from "@testing-library/react";
import { usePermission } from "@/hooks/usePermission";
import { useHasRole } from "@/hooks/useHasRole";
import { Permission } from "@/server/auth/permissions";
import { UserRole } from "@prisma/client";

// Mock next-auth/react
jest.mock("next-auth/react");

// Import the mocked module
import { useSession } from "next-auth/react";

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe("usePermission Hook", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Authenticated Users", () => {
    it("should return true when user has the permission (ORG_ADMIN - USER_CREATE)", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-admin",
            email: "admin@test.com",
            role: UserRole.ADMINISTRATOR,
            organizationId: "org-1",
            name: "Test Admin",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => usePermission(Permission.USER_CREATE));

      expect(result.current).toBe(true);
    });

    it("should return false when user lacks the permission (AUDITOR - USER_CREATE)", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-auditor",
            email: "auditor@test.com",
            role: UserRole.BUSINESS_USER,
            organizationId: "org-1",
            name: "Test Auditor",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => usePermission(Permission.USER_CREATE));

      expect(result.current).toBe(false);
    });

    it("should return true for GRC_ANALYST with EVIDENCE_CREATE permission", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-analyst",
            email: "analyst@test.com",
            role: UserRole.ANALYST,
            organizationId: "org-1",
            name: "Test Analyst",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() =>
        usePermission(Permission.EVIDENCE_CREATE)
      );

      expect(result.current).toBe(true);
    });

    it("should return true for CISO with RISK_READ_ALL permission", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-ciso",
            email: "ciso@test.com",
            role: UserRole.MANAGER,
            organizationId: "org-1",
            name: "Test CISO",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() =>
        usePermission(Permission.RISK_READ_ALL)
      );

      expect(result.current).toBe(true);
    });
  });

  describe("Unauthenticated Users", () => {
    it("should return false when user is not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => usePermission(Permission.USER_CREATE));

      expect(result.current).toBe(false);
    });

    it("should return false when session is loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
        update: jest.fn(),
      });

      const { result } = renderHook(() => usePermission(Permission.USER_CREATE));

      expect(result.current).toBe(false);
    });

    it("should return false when user role is missing", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user",
            email: "user@test.com",
            role: undefined as unknown as UserRole,
            organizationId: "org-1",
            name: "Test User",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => usePermission(Permission.USER_CREATE));

      expect(result.current).toBe(false);
    });
  });

  describe("Multiple Permissions", () => {
    it("should correctly check different permissions for same user", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-analyst",
            email: "analyst@test.com",
            role: UserRole.ANALYST,
            organizationId: "org-1",
            name: "Test Analyst",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      // GRC_ANALYST has these permissions
      const { result: evidenceCreate } = renderHook(() =>
        usePermission(Permission.EVIDENCE_CREATE)
      );
      const { result: riskCreate } = renderHook(() =>
        usePermission(Permission.RISK_CREATE)
      );

      // GRC_ANALYST does NOT have these permissions
      const { result: userCreate } = renderHook(() =>
        usePermission(Permission.USER_CREATE)
      );
      const { result: userDelete } = renderHook(() =>
        usePermission(Permission.USER_DELETE)
      );

      expect(evidenceCreate.current).toBe(true);
      expect(riskCreate.current).toBe(true);
      expect(userCreate.current).toBe(false);
      expect(userDelete.current).toBe(false);
    });
  });
});

describe("useHasRole Hook", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Single Role Checks", () => {
    it("should return true when user has the exact role (ORG_ADMIN)", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-admin",
            email: "admin@test.com",
            role: UserRole.ADMINISTRATOR,
            organizationId: "org-1",
            name: "Test Admin",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(UserRole.ADMINISTRATOR));

      expect(result.current).toBe(true);
    });

    it("should return false when user has different role", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-analyst",
            email: "analyst@test.com",
            role: UserRole.ANALYST,
            organizationId: "org-1",
            name: "Test Analyst",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(UserRole.ADMINISTRATOR));

      expect(result.current).toBe(false);
    });
  });

  describe("Multiple Roles Checks", () => {
    it("should return true when user has one of the allowed roles", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-analyst",
            email: "analyst@test.com",
            role: UserRole.ANALYST,
            organizationId: "org-1",
            name: "Test Analyst",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() =>
        useHasRole([UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.MANAGER])
      );

      expect(result.current).toBe(true);
    });

    it("should return false when user does not have any of the allowed roles", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-auditor",
            email: "auditor@test.com",
            role: UserRole.BUSINESS_USER,
            organizationId: "org-1",
            name: "Test Auditor",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() =>
        useHasRole([UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.MANAGER])
      );

      expect(result.current).toBe(false);
    });
  });

  describe("Unauthenticated Users", () => {
    it("should return false when user is not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(UserRole.ADMINISTRATOR));

      expect(result.current).toBe(false);
    });

    it("should return false when session is loading", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(UserRole.ADMINISTRATOR));

      expect(result.current).toBe(false);
    });

    it("should return false when user role is missing", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user",
            email: "user@test.com",
            role: undefined as unknown as UserRole,
            organizationId: "org-1",
            name: "Test User",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(UserRole.ADMINISTRATOR));

      expect(result.current).toBe(false);
    });
  });

  describe("All Roles", () => {
    it.each([
      UserRole.ADMINISTRATOR,
      UserRole.ANALYST,
      UserRole.ANALYST,
      UserRole.MANAGER,
      UserRole.BUSINESS_USER,
      UserRole.BUSINESS_USER,
      UserRole.BUSINESS_USER,
    ])("should correctly identify user with role: %s", (role) => {
      // Clear mocks before each iteration
      jest.clearAllMocks();

      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "test-user",
            email: "user@test.com",
            role,
            organizationId: "org-1",
            name: "Test User",
            image: null,
            assignedFrameworks: [],
          },
          expires: "2099-01-01",
        },
        status: "authenticated",
        update: jest.fn(),
      });

      const { result } = renderHook(() => useHasRole(role));

      expect(result.current).toBe(true);
    });
  });
});
