"use client";

/**
 * User Permissions Hook
 *
 * Provides role-based permission checks for UI components.
 * Use this hook to conditionally render UI elements based on user role.
 *
 * @see Story 3.8: View-Only Evidence Access for Auditor Role (AC6, AC23)
 */

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { useMemo } from "react";

export interface UserPermissions {
  /** Can upload new evidence */
  canUploadEvidence: boolean;
  /** Can edit evidence metadata */
  canEditEvidence: boolean;
  /** Can delete evidence */
  canDeleteEvidence: boolean;
  /** Can link evidence to risks */
  canLinkEvidence: boolean;
  /** Can tag evidence with control domains */
  canTagEvidence: boolean;
  /** Can replace evidence files */
  canReplaceFile: boolean;
  /** Is the user an auditor */
  isAuditor: boolean;
  /** User's role */
  role: UserRole | null;
  /** Is authenticated */
  isAuthenticated: boolean;
}

/**
 * Hook to get user's evidence-related permissions
 *
 * @example
 * ```tsx
 * function EvidenceActions() {
 *   const { canUploadEvidence, canEditEvidence, isAuditor } = useUserPermissions();
 *
 *   return (
 *     <>
 *       {canUploadEvidence && <UploadButton />}
 *       {canEditEvidence && <EditButton />}
 *       {isAuditor && <AuditorBadge />}
 *     </>
 *   );
 * }
 * ```
 */
export function useUserPermissions(): UserPermissions {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? null;

  return useMemo(() => {
    const isAuthenticated = status === "authenticated" && !!role;
    const isAuditor = role === UserRole.BUSINESS_USER;
    const isBusinessStakeholder = role === UserRole.BUSINESS_USER;

    // Evidence write actions are staff-only (write tier); read-only Business
    // Users are excluded. Single source of truth: @/lib/auth/roles.
    const UPLOAD_ROLES: UserRole[] = [...WRITE_ROLES];
    const EDIT_ROLES: UserRole[] = [...WRITE_ROLES];
    const DELETE_ROLES: UserRole[] = [...WRITE_ROLES];

    // Roles that can upload evidence
    // GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN, IT_STAKEHOLDER can upload
    const canUploadEvidence =
      isAuthenticated &&
      !isAuditor &&
      !isBusinessStakeholder &&
      role !== null &&
      UPLOAD_ROLES.includes(role);

    // Roles that can edit evidence metadata
    // GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN can edit
    const canEditEvidence =
      isAuthenticated &&
      !isAuditor &&
      !isBusinessStakeholder &&
      role !== null &&
      EDIT_ROLES.includes(role);

    // Roles that can delete evidence
    // GRC_ANALYST, ORG_ADMIN can delete
    const canDeleteEvidence =
      isAuthenticated &&
      role !== null &&
      DELETE_ROLES.includes(role);

    // Roles that can link evidence to risks
    // SECURITY_ENGINEER, GRC_ANALYST, ORG_ADMIN, IT_STAKEHOLDER (remediation only) can link
    const canLinkEvidence =
      isAuthenticated &&
      !isAuditor &&
      !isBusinessStakeholder &&
      role !== null &&
      UPLOAD_ROLES.includes(role); // Same as upload roles

    // Roles that can tag evidence with control domains
    // GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN can tag
    const canTagEvidence =
      isAuthenticated &&
      !isAuditor &&
      !isBusinessStakeholder &&
      role !== null &&
      EDIT_ROLES.includes(role);

    // Roles that can replace evidence files
    // GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN can replace
    const canReplaceFile =
      isAuthenticated &&
      !isAuditor &&
      !isBusinessStakeholder &&
      role !== null &&
      EDIT_ROLES.includes(role);

    return {
      canUploadEvidence,
      canEditEvidence,
      canDeleteEvidence,
      canLinkEvidence,
      canTagEvidence,
      canReplaceFile,
      isAuditor,
      role,
      isAuthenticated,
    };
  }, [role, status]);
}
