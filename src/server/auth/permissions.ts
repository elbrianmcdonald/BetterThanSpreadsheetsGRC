/**
 * Permission Matrix for RBAC (Role-Based Access Control)
 *
 * This file defines all permissions for the GRC application and maps them to user roles.
 * The permission matrix is the single source of truth for authorization decisions.
 *
 * **Architecture Pattern**: Centralized permission definitions prevent scattered authorization
 * logic and make it easy to audit and modify permissions.
 *
 * **Usage**:
 * ```typescript
 * import { hasPermission, Permission } from "@/server/auth/permissions";
 *
 * if (hasPermission(user.role, Permission.RISK_CREATE)) {
 *   // User can create risks
 * }
 * ```
 *
 * @see Story 1.7: RBAC Enforcement at tRPC Procedure Level
 */

import { UserRole } from "@prisma/client";

/**
 * Permission enum - all possible permissions in the application
 *
 * Permission naming convention: RESOURCE_OPERATION
 * - RESOURCE: Evidence, Risk, Framework, User, Dashboard, Export
 * - OPERATION: CREATE, READ, UPDATE, DELETE, MANAGE, or specific actions
 *
 * Special suffixes:
 * - _ALL: Access to all resources of this type
 * - _OWN: Access only to resources owned/assigned to the user
 */
export enum Permission {
  // ========================================
  // Evidence Permissions
  // ========================================

  /**
   * Create evidence (upload files, link to controls)
   * - GRC_ANALYST: Upload evidence for any control/risk
   * - IT_STAKEHOLDER: Upload remediation evidence for assigned risks
   */
  EVIDENCE_CREATE = "evidence.create",

  /**
   * Read evidence metadata and files
   * - Most roles: Read evidence within their scope
   * - AUDITOR: Read-only access, filtered by framework
   */
  EVIDENCE_READ = "evidence.read",

  /**
   * Update evidence metadata (title, description, tags)
   * - GRC_ANALYST: Full update access
   */
  EVIDENCE_UPDATE = "evidence.update",

  /**
   * Delete evidence records
   * - GRC_ANALYST: Can delete evidence (with audit trail)
   */
  EVIDENCE_DELETE = "evidence.delete",

  // ========================================
  // Evidence Request Permissions (Story 3.12)
  // ========================================

  /**
   * Create evidence requests to users for missing control evidence
   * - GRC_ANALYST: Request evidence from users
   * - ORG_ADMIN: Can also create evidence requests
   */
  EVIDENCE_REQUEST_CREATE = "evidence_request.create",

  /**
   * Read evidence requests (sent or received)
   * - All roles with EVIDENCE_READ can see relevant requests
   */
  EVIDENCE_REQUEST_READ = "evidence_request.read",

  /**
   * Fulfill evidence requests (upload evidence for a request)
   * - Any user who receives a request can fulfill it
   */
  EVIDENCE_REQUEST_FULFILL = "evidence_request.fulfill",

  /**
   * Cancel evidence requests
   * - GRC_ANALYST: Cancel requests they created
   * - ORG_ADMIN: Cancel any request
   */
  EVIDENCE_REQUEST_CANCEL = "evidence_request.cancel",

  // ========================================
  // Risk Permissions
  // ========================================

  /**
   * Create new risk records
   * - GRC_ANALYST: Create any risk
   * - SECURITY_ENGINEER: Create risks (becomes owner)
   */
  RISK_CREATE = "risk.create",

  /**
   * Read all risks in the organization
   * - GRC_ANALYST, CISO, ORG_ADMIN, AUDITOR: See all risks
   */
  RISK_READ_ALL = "risk.read.all",

  /**
   * Read only risks owned or assigned to the user
   * - SECURITY_ENGINEER: See risks they created
   * - IT_STAKEHOLDER: See risks assigned to them
   * - BUSINESS_STAKEHOLDER: See risks requiring their decision
   */
  RISK_READ_OWN = "risk.read.own",

  /**
   * Update any risk in the organization
   * - GRC_ANALYST: Full update access for risk management
   */
  RISK_UPDATE = "risk.update",

  /**
   * Update only risks owned or assigned to the user
   * - SECURITY_ENGINEER: Update risks they created
   * - IT_STAKEHOLDER: Update status/evidence for assigned risks
   * - BUSINESS_STAKEHOLDER: Approve/reject remediation for assigned risks
   */
  RISK_UPDATE_OWN = "risk.update.own",

  /**
   * Delete risk records
   * - GRC_ANALYST: Can delete risks (with audit trail)
   */
  RISK_DELETE = "risk.delete",

  /**
   * Assign risks to IT/Business Stakeholders
   * - GRC_ANALYST: Assign risks for remediation
   */
  RISK_ASSIGN = "risk.assign",

  // ========================================
  // Framework Permissions
  // ========================================

  /**
   * Read framework catalog and control mappings
   * - All roles: View active frameworks and controls
   */
  FRAMEWORK_READ = "framework.read",

  /**
   * Activate/deactivate frameworks for the organization
   * - ORG_ADMIN: Manage which frameworks are active
   */
  FRAMEWORK_MANAGE = "framework.manage",

  // ========================================
  // User Permissions
  // ========================================

  /**
   * Create new user accounts in the organization
   * - ORG_ADMIN: Full user lifecycle management
   */
  USER_CREATE = "user.create",

  /**
   * Read user profiles and role information
   * - ORG_ADMIN: See all users in organization
   * - All roles: See own profile
   */
  USER_READ = "user.read",

  /**
   * Update user profiles and settings
   * - ORG_ADMIN: Update any user in organization
   */
  USER_UPDATE = "user.update",

  /**
   * Delete user accounts (soft delete with audit trail)
   * - ORG_ADMIN: Remove users from organization
   */
  USER_DELETE = "user.delete",

  // ========================================
  // Dashboard Permissions
  // ========================================

  /**
   * Access compliance dashboard with framework coverage metrics
   * - ORG_ADMIN, GRC_ANALYST, CISO: View compliance status
   */
  DASHBOARD_COMPLIANCE = "dashboard.compliance",

  /**
   * Access risk dashboard with remediation metrics
   * - ORG_ADMIN, GRC_ANALYST, CISO: View risk metrics
   */
  DASHBOARD_RISK = "dashboard.risk",

  // ========================================
  // Export Permissions
  // ========================================

  /**
   * Export data to CSV format
   * - GRC_ANALYST, CISO: Export risk/evidence data
   */
  EXPORT_CSV = "export.csv",

  /**
   * Export evidence packages to PDF
   * - GRC_ANALYST, CISO, AUDITOR: Generate compliance packages
   */
  EXPORT_PDF = "export.pdf",
}

/**
 * Permission Matrix - maps each role to allowed permissions
 *
 * **Role Rationale**:
 *
 * - **ORG_ADMIN**: Organization administration - user management, framework activation
 *   - Cannot directly manage risks/evidence (that's GRC_ANALYST's domain)
 *   - Can view all data for oversight
 *
 * - **GRC_ANALYST**: Primary GRC workflow operator
 *   - Full CRUD on Evidence and Risk (core job function)
 *   - Assigns risks to stakeholders for remediation
 *   - Access to compliance/risk dashboards
 *
 * - **SECURITY_ENGINEER**: Technical risk creator
 *   - Creates risks from security findings (vulnerability scans, pentests)
 *   - Can update risks they created (ownership model)
 *   - Read-only access to evidence
 *
 * - **CISO**: Executive oversight
 *   - Read-only access to all data
 *   - Access to dashboards and reports
 *   - Can export data for board presentations
 *
 * - **IT_STAKEHOLDER**: Remediation executor
 *   - Sees only risks assigned to them
 *   - Updates status and uploads remediation evidence
 *   - Limited scope (only their work items)
 *
 * - **BUSINESS_STAKEHOLDER**: Business decision maker
 *   - Sees only risks requiring their approval
 *   - Approves/rejects remediation plans
 *   - Very limited scope (approval workflow only)
 *
 * - **AUDITOR**: External compliance auditor
 *   - Read-only access to evidence and risks
 *   - Filtered by framework (e.g., only SOC2 evidence)
 *   - Can export evidence packages
 *   - No write access (independence requirement)
 */
export const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  // ============================================================
  // Consolidated four-role model (Role Consolidation — Epic 1).
  // Coarse tiers live in src/lib/auth/roles.ts; this fine-grained
  // matrix is the per-resource projection of those tiers.
  // ============================================================

  /**
   * ADMINISTRATOR (staff): everything Manager can do + all administration.
   * Superset of every permission.
   */
  [UserRole.ADMINISTRATOR]: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.FRAMEWORK_MANAGE,
    Permission.FRAMEWORK_READ,
    Permission.EVIDENCE_CREATE,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_UPDATE,
    Permission.EVIDENCE_DELETE,
    Permission.EVIDENCE_REQUEST_CREATE,
    Permission.EVIDENCE_REQUEST_READ,
    Permission.EVIDENCE_REQUEST_FULFILL,
    Permission.EVIDENCE_REQUEST_CANCEL,
    Permission.RISK_CREATE,
    Permission.RISK_READ_ALL,
    Permission.RISK_UPDATE,
    Permission.RISK_DELETE,
    Permission.RISK_ASSIGN,
    Permission.DASHBOARD_COMPLIANCE,
    Permission.DASHBOARD_RISK,
    Permission.EXPORT_CSV,
    Permission.EXPORT_PDF,
  ],

  /**
   * MANAGER (staff): full GRC workflow + approve/assign/reject. No user/framework admin.
   */
  [UserRole.MANAGER]: [
    Permission.EVIDENCE_CREATE,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_UPDATE,
    Permission.EVIDENCE_DELETE,
    Permission.EVIDENCE_REQUEST_CREATE,
    Permission.EVIDENCE_REQUEST_READ,
    Permission.EVIDENCE_REQUEST_FULFILL,
    Permission.EVIDENCE_REQUEST_CANCEL,
    Permission.RISK_CREATE,
    Permission.RISK_READ_ALL,
    Permission.RISK_UPDATE,
    Permission.RISK_DELETE,
    Permission.RISK_ASSIGN,
    Permission.FRAMEWORK_READ,
    Permission.DASHBOARD_COMPLIANCE,
    Permission.DASHBOARD_RISK,
    Permission.EXPORT_CSV,
    Permission.EXPORT_PDF,
  ],

  /**
   * ANALYST (staff): performs work (full CRUD on evidence & risk) but cannot
   * approve/assign/reject (RISK_ASSIGN is a Manager+ capability) or administer.
   */
  [UserRole.ANALYST]: [
    Permission.EVIDENCE_CREATE,
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_UPDATE,
    Permission.EVIDENCE_DELETE,
    Permission.EVIDENCE_REQUEST_CREATE,
    Permission.EVIDENCE_REQUEST_READ,
    Permission.EVIDENCE_REQUEST_FULFILL,
    Permission.EVIDENCE_REQUEST_CANCEL,
    Permission.RISK_CREATE,
    Permission.RISK_READ_ALL,
    Permission.RISK_UPDATE,
    Permission.RISK_DELETE,
    Permission.FRAMEWORK_READ,
    Permission.DASHBOARD_COMPLIANCE,
    Permission.DASHBOARD_RISK,
    Permission.EXPORT_CSV,
    Permission.EXPORT_PDF,
  ],

  /**
   * BUSINESS_USER (org-bound): read-only view of their assigned organization.
   * No write, approve, or administer.
   */
  [UserRole.BUSINESS_USER]: [
    Permission.EVIDENCE_READ,
    Permission.EVIDENCE_REQUEST_READ,
    Permission.RISK_READ_ALL,
    Permission.FRAMEWORK_READ,
    Permission.DASHBOARD_COMPLIANCE,
    Permission.DASHBOARD_RISK,
    // Exports are read-only data extractions of what they can already view
    // (preserves the folded-in Auditor's export capability).
    Permission.EXPORT_CSV,
    Permission.EXPORT_PDF,
  ],
};

/**
 * Check if a user role has a specific permission
 *
 * @param role - User's role from session
 * @param permission - Permission to check
 * @returns true if role has permission, false otherwise
 *
 * @example
 * ```typescript
 * if (hasPermission(session.user.role, Permission.RISK_CREATE)) {
 *   // User can create risks
 * }
 * ```
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/**
 * Check if a user role can access a resource with a specific operation
 *
 * This is a convenience wrapper around `hasPermission` that constructs
 * the permission string from resource and operation.
 *
 * @param role - User's role from session
 * @param resource - Resource type (e.g., "risk", "evidence")
 * @param operation - Operation type ("create", "read", "update", "delete")
 * @returns true if role can perform operation on resource
 *
 * @example
 * ```typescript
 * if (canAccessResource(session.user.role, "risk", "create")) {
 *   // User can create risks
 * }
 * ```
 */
export function canAccessResource(
  role: UserRole,
  resource: string,
  operation: "create" | "read" | "update" | "delete",
): boolean {
  const permission = `${resource}.${operation}` as Permission;
  return hasPermission(role, permission);
}

/**
 * Get all permissions for a specific role
 *
 * Useful for debugging and testing permission configurations.
 *
 * @param role - User's role
 * @returns Array of permissions for the role
 *
 * @example
 * ```typescript
 * const permissions = getPermissionsForRole(UserRole.ANALYST);
 * console.log(`GRC_ANALYST has ${permissions.length} permissions`);
 * ```
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return PERMISSION_MATRIX[role] ?? [];
}

/**
 * Check if a role has any of the specified permissions (OR logic)
 *
 * @param role - User's role
 * @param permissions - Array of permissions to check
 * @returns true if role has at least one of the permissions
 *
 * @example
 * ```typescript
 * if (hasAnyPermission(role, [Permission.RISK_UPDATE, Permission.RISK_UPDATE_OWN])) {
 *   // User can update risks (either all or own)
 * }
 * ```
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions (AND logic)
 *
 * @param role - User's role
 * @param permissions - Array of permissions to check
 * @returns true if role has all of the permissions
 *
 * @example
 * ```typescript
 * if (hasAllPermissions(role, [Permission.RISK_CREATE, Permission.RISK_ASSIGN])) {
 *   // User can both create and assign risks
 * }
 * ```
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
