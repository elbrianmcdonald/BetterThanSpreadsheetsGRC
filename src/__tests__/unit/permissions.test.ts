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
      expect(hasPermission(UserRole.GRC_ANALYST, Permission.EVIDENCE_CREATE)).toBe(true);

      // ORG_ADMIN should have USER_CREATE
      expect(hasPermission(UserRole.ORG_ADMIN, Permission.USER_CREATE)).toBe(true);

      // CISO should have RISK_READ_ALL
      expect(hasPermission(UserRole.CISO, Permission.RISK_READ_ALL)).toBe(true);
    });

    it("should return false for permissions the role does not have", () => {
      // AUDITOR should NOT have EVIDENCE_CREATE (read-only)
      expect(hasPermission(UserRole.AUDITOR, Permission.EVIDENCE_CREATE)).toBe(false);

      // GRC_ANALYST should NOT have USER_CREATE (only ORG_ADMIN)
      expect(hasPermission(UserRole.GRC_ANALYST, Permission.USER_CREATE)).toBe(false);

      // IT_STAKEHOLDER should NOT have RISK_DELETE
      expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_DELETE)).toBe(false);
    });

    it("should handle invalid/unknown roles gracefully", () => {
      // @ts-expect-error - Testing invalid role
      expect(hasPermission("INVALID_ROLE", Permission.RISK_CREATE)).toBe(false);
    });
  });

  describe("canAccessResource function", () => {
    it("should return true for allowed resource-operation combinations", () => {
      // GRC_ANALYST can create evidence
      expect(canAccessResource(UserRole.GRC_ANALYST, "evidence", "create")).toBe(true);

      // ORG_ADMIN can create users
      expect(canAccessResource(UserRole.ORG_ADMIN, "user", "create")).toBe(true);

      // AUDITOR can read evidence
      expect(canAccessResource(UserRole.AUDITOR, "evidence", "read")).toBe(true);
    });

    it("should return false for disallowed resource-operation combinations", () => {
      // AUDITOR cannot create evidence (read-only)
      expect(canAccessResource(UserRole.AUDITOR, "evidence", "create")).toBe(false);

      // GRC_ANALYST cannot create users (only ORG_ADMIN)
      expect(canAccessResource(UserRole.GRC_ANALYST, "user", "create")).toBe(false);

      // IT_STAKEHOLDER cannot delete risks
      expect(canAccessResource(UserRole.IT_STAKEHOLDER, "risk", "delete")).toBe(false);
    });
  });

  describe("getPermissionsForRole function", () => {
    it("should return all permissions for a role", () => {
      const analystPermissions = getPermissionsForRole(UserRole.GRC_ANALYST);

      expect(analystPermissions).toContain(Permission.EVIDENCE_CREATE);
      expect(analystPermissions).toContain(Permission.RISK_CREATE);
      expect(analystPermissions).toContain(Permission.RISK_ASSIGN);
      expect(analystPermissions.length).toBeGreaterThan(10); // GRC_ANALYST has many permissions
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
      const result = hasAnyPermission(UserRole.SECURITY_ENGINEER, [
        Permission.RISK_CREATE,
        Permission.RISK_DELETE,
      ]);
      expect(result).toBe(true);
    });

    it("should return false if role has none of the permissions", () => {
      // AUDITOR has neither create nor delete permissions
      const result = hasAnyPermission(UserRole.AUDITOR, [
        Permission.EVIDENCE_CREATE,
        Permission.RISK_DELETE,
      ]);
      expect(result).toBe(false);
    });

    it("should return false for empty permission array", () => {
      const result = hasAnyPermission(UserRole.GRC_ANALYST, []);
      expect(result).toBe(false);
    });
  });

  describe("hasAllPermissions function", () => {
    it("should return true if role has all specified permissions", () => {
      // GRC_ANALYST has both read and create for evidence
      const result = hasAllPermissions(UserRole.GRC_ANALYST, [
        Permission.EVIDENCE_READ,
        Permission.EVIDENCE_CREATE,
      ]);
      expect(result).toBe(true);
    });

    it("should return false if role is missing any permission", () => {
      // SECURITY_ENGINEER can create risks but cannot assign them
      const result = hasAllPermissions(UserRole.SECURITY_ENGINEER, [
        Permission.RISK_CREATE,
        Permission.RISK_ASSIGN,
      ]);
      expect(result).toBe(false);
    });

    it("should return true for empty permission array", () => {
      const result = hasAllPermissions(UserRole.GRC_ANALYST, []);
      expect(result).toBe(true);
    });
  });

  describe("Role-specific permission checks", () => {
    describe("ORG_ADMIN", () => {
      it("should have full user management permissions", () => {
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.USER_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.USER_READ)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.USER_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.USER_DELETE)).toBe(true);
      });

      it("should have framework management permissions", () => {
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.FRAMEWORK_MANAGE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.FRAMEWORK_READ)).toBe(true);
      });

      it("should have dashboard access", () => {
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.DASHBOARD_COMPLIANCE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.DASHBOARD_RISK)).toBe(true);
      });

      it("should have full CRUD on evidence", () => {
        // Admins operate the whole app — previously this was reserved to
        // GRC_ANALYST/GRC_MANAGER, but that tripped admins trying to upload
        // evidence from control detail pages.
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.EVIDENCE_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.EVIDENCE_DELETE)).toBe(true);
      });

      it("should NOT have risk mutation permissions (still scoped to GRC/Security roles)", () => {
        expect(hasPermission(UserRole.ORG_ADMIN, Permission.RISK_CREATE)).toBe(false);
      });
    });

    describe("GRC_ANALYST", () => {
      it("should have full CRUD on evidence", () => {
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EVIDENCE_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EVIDENCE_DELETE)).toBe(true);
      });

      it("should have full CRUD on risks", () => {
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.RISK_CREATE)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.RISK_UPDATE)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.RISK_DELETE)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.RISK_ASSIGN)).toBe(true);
      });

      it("should have export permissions", () => {
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EXPORT_CSV)).toBe(true);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should NOT have user management permissions", () => {
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.USER_CREATE)).toBe(false);
        expect(hasPermission(UserRole.GRC_ANALYST, Permission.USER_DELETE)).toBe(false);
      });
    });

    describe("SECURITY_ENGINEER", () => {
      it("should have risk creation permission", () => {
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_CREATE)).toBe(true);
      });

      it("should have OWN risk permissions", () => {
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_READ_OWN)).toBe(true);
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_UPDATE_OWN)).toBe(true);
      });

      it("should have evidence read access", () => {
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.EVIDENCE_READ)).toBe(true);
      });

      it("should NOT have ALL risk permissions", () => {
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_READ_ALL)).toBe(false);
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_DELETE)).toBe(false);
        expect(hasPermission(UserRole.SECURITY_ENGINEER, Permission.RISK_ASSIGN)).toBe(false);
      });
    });

    describe("CISO", () => {
      it("should have read-all access to risks and evidence", () => {
        expect(hasPermission(UserRole.CISO, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.CISO, Permission.RISK_READ_ALL)).toBe(true);
      });

      it("should have dashboard access", () => {
        expect(hasPermission(UserRole.CISO, Permission.DASHBOARD_COMPLIANCE)).toBe(true);
        expect(hasPermission(UserRole.CISO, Permission.DASHBOARD_RISK)).toBe(true);
      });

      it("should have export permissions", () => {
        expect(hasPermission(UserRole.CISO, Permission.EXPORT_CSV)).toBe(true);
        expect(hasPermission(UserRole.CISO, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should NOT have mutation permissions", () => {
        expect(hasPermission(UserRole.CISO, Permission.EVIDENCE_CREATE)).toBe(false);
        expect(hasPermission(UserRole.CISO, Permission.RISK_CREATE)).toBe(false);
        expect(hasPermission(UserRole.CISO, Permission.RISK_UPDATE)).toBe(false);
        expect(hasPermission(UserRole.CISO, Permission.USER_CREATE)).toBe(false);
      });
    });

    describe("IT_STAKEHOLDER", () => {
      it("should have OWN risk permissions", () => {
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_READ_OWN)).toBe(true);
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_UPDATE_OWN)).toBe(true);
      });

      it("should have evidence create and read (for remediation)", () => {
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.EVIDENCE_CREATE)).toBe(true);
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.EVIDENCE_READ)).toBe(true);
      });

      it("should NOT have permissions beyond assigned risks", () => {
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_READ_ALL)).toBe(false);
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_CREATE)).toBe(false);
        expect(hasPermission(UserRole.IT_STAKEHOLDER, Permission.RISK_ASSIGN)).toBe(false);
      });
    });

    describe("BUSINESS_STAKEHOLDER", () => {
      it("should have OWN risk permissions", () => {
        expect(hasPermission(UserRole.BUSINESS_STAKEHOLDER, Permission.RISK_READ_OWN)).toBe(true);
        expect(hasPermission(UserRole.BUSINESS_STAKEHOLDER, Permission.RISK_UPDATE_OWN)).toBe(true);
      });

      it("should have very limited permissions (approval workflow only)", () => {
        const permissions = getPermissionsForRole(UserRole.BUSINESS_STAKEHOLDER);
        expect(permissions.length).toBe(4); // RISK_READ_OWN, RISK_UPDATE_OWN, EVIDENCE_REQUEST_READ, EVIDENCE_REQUEST_FULFILL
      });

      it("should NOT have evidence or other permissions", () => {
        expect(hasPermission(UserRole.BUSINESS_STAKEHOLDER, Permission.EVIDENCE_READ)).toBe(false);
        expect(hasPermission(UserRole.BUSINESS_STAKEHOLDER, Permission.RISK_CREATE)).toBe(false);
      });
    });

    describe("AUDITOR", () => {
      it("should have read-only access", () => {
        expect(hasPermission(UserRole.AUDITOR, Permission.EVIDENCE_READ)).toBe(true);
        expect(hasPermission(UserRole.AUDITOR, Permission.RISK_READ_ALL)).toBe(true);
        expect(hasPermission(UserRole.AUDITOR, Permission.FRAMEWORK_READ)).toBe(true);
      });

      it("should have PDF export permission", () => {
        expect(hasPermission(UserRole.AUDITOR, Permission.EXPORT_PDF)).toBe(true);
      });

      it("should NOT have any mutation permissions", () => {
        expect(hasPermission(UserRole.AUDITOR, Permission.EVIDENCE_CREATE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.EVIDENCE_UPDATE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.EVIDENCE_DELETE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.RISK_CREATE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.RISK_UPDATE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.RISK_DELETE)).toBe(false);
        expect(hasPermission(UserRole.AUDITOR, Permission.USER_CREATE)).toBe(false);
      });
    });
  });

  describe("Permission inheritance patterns", () => {
    it("should allow GRC_ANALYST to perform all SECURITY_ENGINEER actions", () => {
      const engineerPermissions = getPermissionsForRole(UserRole.SECURITY_ENGINEER);

      engineerPermissions.forEach((permission) => {
        // GRC_ANALYST should have all SECURITY_ENGINEER permissions (may have more)
        if (permission === Permission.RISK_READ_OWN || permission === Permission.RISK_UPDATE_OWN) {
          // GRC_ANALYST has _ALL variants instead
          expect(
            hasPermission(UserRole.GRC_ANALYST, Permission.RISK_READ_ALL) ||
            hasPermission(UserRole.GRC_ANALYST, Permission.RISK_UPDATE)
          ).toBe(true);
        } else {
          expect(hasPermission(UserRole.GRC_ANALYST, permission)).toBe(true);
        }
      });
    });

    it("should ensure CISO has read access to everything GRC_ANALYST can read", () => {
      // CISO should be able to read everything for oversight
      expect(hasPermission(UserRole.CISO, Permission.EVIDENCE_READ)).toBe(true);
      expect(hasPermission(UserRole.CISO, Permission.RISK_READ_ALL)).toBe(true);
      expect(hasPermission(UserRole.CISO, Permission.FRAMEWORK_READ)).toBe(true);
    });
  });
});
