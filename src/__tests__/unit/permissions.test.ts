/**
 * Unit Tests for Permission Matrix
 *
 * Tests the RBAC permission system to ensure each role has correct permissions.
 *
 * **Critical Test Coverage:**
 * - Permission matrix completeness (all roles have permissions)
 * - hasPermission function correctness
 * - canAccessResource function correctness
 * - Helper functions (hasAnyPermission, hasAllPermissions)
 * - Role-specific permission checks
 *
 * @see Story 1.7: RBAC Enforcement at tRPC Procedure Level
 */

import { UserRole } from "@prisma/client";
import {
  Permission,
  PERMISSION_MATRIX,
  hasPermission,
  canAccessResource,
  getPermissionsForRole,
  hasAnyPermission,
  hasAllPermissions,
} from "@/server/auth/permissions";

describe("Permission Matrix", () => {
  describe("PERMISSION_MATRIX completeness", () => {
    it("should define permissions for all roles", () => {
      const allRoles = Object.values(UserRole);

      allRoles.forEach((role) => {
        expect(PERMISSION_MATRIX[role]).toBeDefined();
        expect(Array.isArray(PERMISSION_MATRIX[role])).toBe(true);
      });
    });

    it("should have non-empty permission arrays for each role", () => {
      const allRoles = Object.values(UserRole);

      allRoles.forEach((role) => {
        const permissions = PERMISSION_MATRIX[role];
        expect(permissions!.length).toBeGreaterThan(0);
      });
    });

    it("should only contain valid Permission enum values", () => {
      const validPermissions = new Set(Object.values(Permission));
      const allRoles = Object.values(UserRole);

      allRoles.forEach((role) => {
        const permissions = PERMISSION_MATRIX[role]!;
        permissions.forEach((permission) => {
          expect(validPermissions.has(permission)).toBe(true);
        });
      });
    });
  });

  describe("hasPermission function", () => {
    it("should return true for permissions the role has", () => {
      // GRC_ANALYST should have EVIDENCE_CREATE
      expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_CREATE)).toBe(true);

      // ORG_ADMIN should have USER_CREATE
      expect(hasPermission(UserRole.ADMINISTRATOR, Permission.USER_CREATE)).toBe(true);

      // CISO should have RISK_READ_ALL
      expect(hasPermission(UserRole.MANAGER, Permission.RISK_READ_ALL)).toBe(true);
    });

    it("should return false for permissions the role does not have", () => {
      // AUDITOR should NOT have EVIDENCE_CREATE (read-only)
      expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_CREATE)).toBe(false);

      // GRC_ANALYST should NOT have USER_CREATE (only ORG_ADMIN)
      expect(hasPermission(UserRole.ANALYST, Permission.USER_CREATE)).toBe(false);

      // IT_STAKEHOLDER should NOT have RISK_DELETE
      expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_DELETE)).toBe(false);
    });

    it("should handle invalid/unknown roles gracefully", () => {
      // @ts-expect-error - Testing invalid role
      expect(hasPermission("INVALID_ROLE", Permission.RISK_CREATE)).toBe(false);
    });
  });

  describe("canAccessResource function", () => {
    it("should return true for allowed resource-operation combinations", () => {
      // GRC_ANALYST can create evidence
      expect(canAccessResource(UserRole.ANALYST, "evidence", "create")).toBe(true);

      // ORG_ADMIN can create users
      expect(canAccessResource(UserRole.ADMINISTRATOR, "user", "create")).toBe(true);

      // AUDITOR can read evidence
      expect(canAccessResource(UserRole.BUSINESS_USER, "evidence", "read")).toBe(true);
    });

    it("should return false for disallowed resource-operation combinations", () => {
      // AUDITOR cannot create evidence (read-only)
      expect(canAccessResource(UserRole.BUSINESS_USER, "evidence", "create")).toBe(false);

      // GRC_ANALYST cannot create users (only ORG_ADMIN)
      expect(canAccessResource(UserRole.ANALYST, "user", "create")).toBe(false);

      // IT_STAKEHOLDER cannot delete risks
      expect(canAccessResource(UserRole.BUSINESS_USER, "risk", "delete")).toBe(false);
    });
  });

  describe("getPermissionsForRole function", () => {
    it("should return all permissions for a role", () => {
      const analystPermissions = getPermissionsForRole(UserRole.ANALYST);

      expect(analystPermissions).toContain(Permission.EVIDENCE_CREATE);
      expect(analystPermissions).toContain(Permission.RISK_CREATE);
      expect(analystPermissions).toContain(Permission.RISK_UPDATE);
      // ANALYST performs work but cannot assign (Manager+ only)
      expect(analystPermissions).not.toContain(Permission.RISK_ASSIGN);
      expect(analystPermissions.length).toBeGreaterThan(10); // ANALYST has many permissions
    });

    it("should return empty array for invalid role", () => {
      // @ts-expect-error - Testing invalid role
      const invalidPermissions = getPermissionsForRole("INVALID_ROLE");
      expect(invalidPermissions).toEqual([]);
    });
  });

  describe("hasAnyPermission function", () => {
    it("should return true if role has at least one permission", () => {
      // SECURITY_ENGINEER can create risks but not delete them
      const result = hasAnyPermission(UserRole.ANALYST, [
        Permission.RISK_CREATE,
        Permission.RISK_DELETE,
      ]);
      expect(result).toBe(true);
    });

    it("should return false if role has none of the permissions", () => {
      // AUDITOR has neither create nor delete permissions
      const result = hasAnyPermission(UserRole.BUSINESS_USER, [
        Permission.EVIDENCE_CREATE,
        Permission.RISK_DELETE,
      ]);
      expect(result).toBe(false);
    });

    it("should return false for empty permission array", () => {
      const result = hasAnyPermission(UserRole.ANALYST, []);
      expect(result).toBe(false);
    });
  });

  describe("hasAllPermissions function", () => {
    it("should return true if role has all specified permissions", () => {
      // GRC_ANALYST has both read and create for evidence
      const result = hasAllPermissions(UserRole.ANALYST, [
        Permission.EVIDENCE_READ,
        Permission.EVIDENCE_CREATE,
      ]);
      expect(result).toBe(true);
    });

    it("should return false if role is missing any permission", () => {
      // SECURITY_ENGINEER can create risks but cannot assign them
      const result = hasAllPermissions(UserRole.ANALYST, [
        Permission.RISK_CREATE,
        Permission.RISK_ASSIGN,
      ]);
      expect(result).toBe(false);
    });

    it("should return true for empty permission array", () => {
      const result = hasAllPermissions(UserRole.ANALYST, []);
      expect(result).toBe(true);
    });
  });

  describe("Role-specific permission checks", () => {
    describe("ADMINISTRATOR", () => {
      it("should have full user management permissions", () => {
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.USER_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.USER_READ)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.USER_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.USER_DELETE)).toBe(true);
      });

      it("should have framework management permissions", () => {
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.FRAMEWORK_MANAGE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.FRAMEWORK_READ)).toBe(true);
      });

      it("should have dashboard access", () => {
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.DASHBOARD_COMPLIANCE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.DASHBOARD_RISK)).toBe(true);
      });

      it("should have full CRUD on evidence", () => {
        // Admins operate the whole app — previously this was reserved to
        // GRC_ANALYST/GRC_MANAGER, but that tripped admins trying to upload
        // evidence from control detail pages.
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.EVIDENCE_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.EVIDENCE_DELETE)).toBe(true);
      });

      it("should have risk mutation permissions (superset of MANAGER)", () => {
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.RISK_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.RISK_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.RISK_DELETE)).toBe(true);
        expect(hasPermission(UserRole.ADMINISTRATOR, Permission.RISK_ASSIGN)).toBe(true);
      });
    });

    describe("ANALYST", () => {
      it("should have full CRUD on evidence", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_DELETE)).toBe(true);
      });

      it("should have full CRUD on risks but NOT assign (Manager+ only)", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_DELETE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_ASSIGN)).toBe(false);
      });

      it("should have export permissions", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.EXPORT_CSV)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should NOT have user management permissions", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.USER_CREATE)).toBe(false);
        expect(hasPermission(UserRole.ANALYST, Permission.USER_DELETE)).toBe(false);
      });
    });

    describe("ANALYST (folded-in Security Engineer)", () => {
      it("should have risk creation permission", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_CREATE)).toBe(true);
      });

      it("should have ALL risk permissions (not own-scoped)", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_UPDATE)).toBe(true);
      });

      it("should have evidence read access", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.EVIDENCE_READ)).toBe(true);
      });

      it("should have full CRUD but NOT assign (Manager+ only)", () => {
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_DELETE)).toBe(true);
        expect(hasPermission(UserRole.ANALYST, Permission.RISK_ASSIGN)).toBe(false);
      });
    });

    describe("MANAGER", () => {
      it("should have read-all access to risks and evidence", () => {
        expect(hasPermission(UserRole.MANAGER, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.RISK_READ_ALL)).toBe(true);
      });

      it("should have dashboard access", () => {
        expect(hasPermission(UserRole.MANAGER, Permission.DASHBOARD_COMPLIANCE)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.DASHBOARD_RISK)).toBe(true);
      });

      it("should have export permissions", () => {
        expect(hasPermission(UserRole.MANAGER, Permission.EXPORT_CSV)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should have GRC mutation + assign permissions but NOT user administration", () => {
        expect(hasPermission(UserRole.MANAGER, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.RISK_CREATE)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.RISK_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.RISK_ASSIGN)).toBe(true);
        expect(hasPermission(UserRole.MANAGER, Permission.USER_CREATE)).toBe(false);
      });
    });

    describe("BUSINESS_USER (folded-in IT Stakeholder)", () => {
      it("should have read-only risk and evidence access", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_READ)).toBe(true);
      });

      it("should NOT have evidence write (read-only role)", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_CREATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_UPDATE)).toBe(false);
      });

      it("should NOT have risk write, own-scope, or assign permissions", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_READ_OWN)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_CREATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_ASSIGN)).toBe(false);
      });
    });

    describe("BUSINESS_USER (folded-in Business Stakeholder)", () => {
      it("should have read-all (not own-scoped) risk access", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_READ_OWN)).toBe(false);
      });

      it("should have a read-only permission set (no write)", () => {
        const permissions = getPermissionsForRole(UserRole.BUSINESS_USER);
        // EVIDENCE_READ, EVIDENCE_REQUEST_READ, RISK_READ_ALL, FRAMEWORK_READ,
        // DASHBOARD_COMPLIANCE, DASHBOARD_RISK, EXPORT_CSV, EXPORT_PDF
        expect(permissions.length).toBe(8);
      });

      it("should NOT have create permissions", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_CREATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_CREATE)).toBe(false);
      });
    });

    describe("BUSINESS_USER", () => {
      it("should have read-only access", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.FRAMEWORK_READ)).toBe(true);
      });

      it("should have PDF export permission", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should NOT have any mutation permissions", () => {
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_CREATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_UPDATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.EVIDENCE_DELETE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_CREATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_UPDATE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.RISK_DELETE)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_USER, Permission.USER_CREATE)).toBe(false);
      });
    });
  });

  describe("Permission inheritance patterns", () => {
    it("should allow GRC_ANALYST to perform all SECURITY_ENGINEER actions", () => {
      const engineerPermissions = getPermissionsForRole(UserRole.ANALYST);

      engineerPermissions.forEach((permission) => {
        // GRC_ANALYST should have all SECURITY_ENGINEER permissions (may have more)
        if (permission === Permission.RISK_READ_OWN || permission === Permission.RISK_UPDATE_OWN) {
          // GRC_ANALYST has _ALL variants instead
          expect(
            hasPermission(UserRole.ANALYST, Permission.RISK_READ_ALL) ||
            hasPermission(UserRole.ANALYST, Permission.RISK_UPDATE)
          ).toBe(true);
        } else {
          expect(hasPermission(UserRole.ANALYST, permission)).toBe(true);
        }
      });
    });

    it("should ensure CISO has read access to everything GRC_ANALYST can read", () => {
      // CISO should be able to read everything for oversight
      expect(hasPermission(UserRole.MANAGER, Permission.EVIDENCE_READ)).toBe(true);
      expect(hasPermission(UserRole.MANAGER, Permission.RISK_READ_ALL)).toBe(true);
      expect(hasPermission(UserRole.MANAGER, Permission.FRAMEWORK_READ)).toBe(true);
    });
  });
});
