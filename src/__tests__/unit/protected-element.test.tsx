/**
 * @jest-environment jsdom
 *
 * Unit Tests for ProtectedElement Component
 *
 * Tests the ProtectedElement component for role-based UI rendering.
 *
 * **Critical Test Coverage:**
 * - Permission-based rendering
 * - Role-based rendering
 * - Multiple roles rendering
 * - Fallback rendering
 * - Combined permission + role checks (requireBoth)
 * - Unauthenticated user behavior
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ProtectedElement } from "@/components/rbac/ProtectedElement";
import { Permission } from "@/server/auth/permissions";
import { UserRole } from "@prisma/client";

// Mock the hooks
jest.mock("@/hooks/usePermission");
jest.mock("@/hooks/useHasRole");

import { usePermission } from "@/hooks/usePermission";
import { useHasRole } from "@/hooks/useHasRole";

const mockUsePermission = usePermission as jest.MockedFunction<
  typeof usePermission
>;
const mockUseHasRole = useHasRole as jest.MockedFunction<typeof useHasRole>;

describe("ProtectedElement Component", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Permission-Based Rendering", () => {
    it("should render children when user has permission", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement permission={Permission.USER_CREATE}>
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should not render children when user lacks permission", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement permission={Permission.USER_CREATE}>
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
    });

    it("should render fallback when user lacks permission", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          fallback={<div>Access Denied</div>}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });
  });

  describe("Role-Based Rendering", () => {
    it("should render children when user has the role", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement role={UserRole.ADMINISTRATOR}>
          <button>Admin Panel</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    });

    it("should not render children when user lacks the role", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement role={UserRole.ADMINISTRATOR}>
          <button>Admin Panel</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    });

    it("should render fallback when user lacks the role", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          role={UserRole.ADMINISTRATOR}
          fallback={<div>Admins Only</div>}
        >
          <button>Admin Panel</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
      expect(screen.getByText("Admins Only")).toBeInTheDocument();
    });
  });

  describe("Multiple Roles Rendering", () => {
    it("should render children when user has one of the roles", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement
          roles={[UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.MANAGER]}
        >
          <div>Management Features</div>
        </ProtectedElement>
      );

      expect(screen.getByText("Management Features")).toBeInTheDocument();
    });

    it("should not render children when user has none of the roles", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          roles={[UserRole.ADMINISTRATOR, UserRole.ANALYST, UserRole.MANAGER]}
        >
          <div>Management Features</div>
        </ProtectedElement>
      );

      expect(screen.queryByText("Management Features")).not.toBeInTheDocument();
    });
  });

  describe("Combined Permission and Role (OR Logic)", () => {
    it("should render when user has permission but not role (OR logic)", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should render when user has role but not permission (OR logic)", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should render when user has both permission and role (OR logic)", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should not render when user has neither permission nor role (OR logic)", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
    });
  });

  describe("Combined Permission and Role (AND Logic - requireBoth)", () => {
    it("should render when user has both permission and role (AND logic)", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
          requireBoth={true}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should not render when user has permission but not role (AND logic)", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
          requireBoth={true}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
    });

    it("should not render when user has role but not permission (AND logic)", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
          requireBoth={true}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
    });

    it("should not render when user has neither (AND logic)", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
          requireBoth={true}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
    });

    it("should render fallback when AND logic fails", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement
          permission={Permission.USER_CREATE}
          role={UserRole.ADMINISTRATOR}
          requireBoth={true}
          fallback={<div>Insufficient Permissions</div>}
        >
          <button>Create User</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Create User")).not.toBeInTheDocument();
      expect(screen.getByText("Insufficient Permissions")).toBeInTheDocument();
    });
  });

  describe("Complex Scenarios", () => {
    it("should render nested ProtectedElements correctly", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(true);

      render(
        <ProtectedElement permission={Permission.USER_READ}>
          <div>
            <h1>User List</h1>
            <ProtectedElement permission={Permission.USER_CREATE}>
              <button>Create User</button>
            </ProtectedElement>
          </div>
        </ProtectedElement>
      );

      expect(screen.getByText("User List")).toBeInTheDocument();
      expect(screen.getByText("Create User")).toBeInTheDocument();
    });

    it("should handle multiple children correctly", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement permission={Permission.USER_CREATE}>
          <button>Create User</button>
          <button>Import Users</button>
          <span>Admin Actions</span>
        </ProtectedElement>
      );

      expect(screen.getByText("Create User")).toBeInTheDocument();
      expect(screen.getByText("Import Users")).toBeInTheDocument();
      expect(screen.getByText("Admin Actions")).toBeInTheDocument();
    });

    it("should render nothing when no permission/role is provided", () => {
      mockUsePermission.mockReturnValue(false);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement>
          <button>Should Not Render</button>
        </ProtectedElement>
      );

      expect(screen.queryByText("Should Not Render")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      // Should not throw error when rendering null children
      expect(() => {
        render(
          <ProtectedElement permission={Permission.USER_CREATE}>
            {null}
          </ProtectedElement>
        );
      }).not.toThrow();
    });

    it("should handle complex JSX children", () => {
      mockUsePermission.mockReturnValue(true);
      mockUseHasRole.mockReturnValue(false);

      render(
        <ProtectedElement permission={Permission.USER_CREATE}>
          <div>
            <h1>Complex Component</h1>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </ProtectedElement>
      );

      expect(screen.getByText("Complex Component")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });
  });
});
