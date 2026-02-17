/**
 * Risk Status State Machine Service
 *
 * Story 4.10: Remediation Workflow State Machine (Open → Remediated → Closed)
 *
 * This service implements the risk workflow state machine that governs
 * valid status transitions and enforces role-based permissions.
 *
 * State Transition Rules (AC6-AC12):
 * - OPEN → ASSIGNED: Allowed when risk owners assigned
 * - ASSIGNED → REMEDIATED: Allowed when IT_STAKEHOLDER marks remediation complete
 * - REMEDIATED → CLOSED: Allowed when GRC_ANALYST verifies remediation
 * - Any status → OPEN: Allowed (reopen risk if remediation failed)
 * - CLOSED → any other status: Requires comment explaining why (audit requirement)
 * - Direct OPEN → CLOSED: NOT allowed (must go through REMEDIATED)
 *
 * @see Story 4.10: Remediation Workflow State Machine
 */

import { RiskStatus, UserRole } from "@prisma/client";

/**
 * Map of allowed state transitions for each status.
 * This defines the valid workflow paths through the risk lifecycle.
 *
 * Assessment Workflow Path:
 * - DRAFT → PENDING_REVIEW (assessor submits for review)
 * - PENDING_REVIEW → OPEN (manager approves, risk enters register)
 * - PENDING_REVIEW → DRAFT (manager rejects, returns to assessor)
 *
 * Standard Remediation Workflow Path:
 * - OPEN → ASSIGNED → REMEDIATED → CLOSED
 */
export const ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  // Assessment workflow statuses
  [RiskStatus.DRAFT]: [RiskStatus.PENDING_REVIEW],
  [RiskStatus.PENDING_REVIEW]: [RiskStatus.OPEN, RiskStatus.DRAFT], // Approve or reject
  // Standard remediation workflow statuses
  [RiskStatus.OPEN]: [RiskStatus.ASSIGNED],
  [RiskStatus.ASSIGNED]: [RiskStatus.REMEDIATED, RiskStatus.OPEN],
  [RiskStatus.REMEDIATED]: [RiskStatus.CLOSED, RiskStatus.OPEN],
  [RiskStatus.CLOSED]: [RiskStatus.OPEN], // Reopen requires reason
};

/**
 * Result of a transition validation check.
 */
export interface TransitionValidationResult {
  /** Whether the transition is allowed */
  allowed: boolean;
  /** Reason why the transition was blocked (if not allowed) */
  reason?: string;
  /** Whether the transition requires a reason comment */
  requiresReason?: boolean;
  /** Whether the transition requires remediation evidence */
  requiresRemediationEvidence?: boolean;
}

/**
 * Validates whether a status transition is allowed based on the state machine
 * rules and the user's role.
 *
 * @param currentStatus - The current risk status
 * @param newStatus - The desired new status
 * @param userRole - The role of the user attempting the transition
 * @param isOwner - Whether the user is the IT owner of the risk
 * @returns Validation result with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * const result = validateTransition(
 *   RiskStatus.ASSIGNED,
 *   RiskStatus.REMEDIATED,
 *   UserRole.IT_STAKEHOLDER,
 *   true // is owner
 * );
 * // { allowed: true, requiresRemediationEvidence: true }
 * ```
 */
export function validateTransition(
  currentStatus: RiskStatus,
  newStatus: RiskStatus,
  userRole: UserRole,
  isOwner: boolean = false
): TransitionValidationResult {
  // Same status - no change needed
  if (currentStatus === newStatus) {
    return {
      allowed: false,
      reason: "Risk is already in this status",
    };
  }

  // Check if transition exists in state machine (AC3)
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowedNext.includes(newStatus)) {
    // AC11: Direct OPEN → CLOSED not allowed
    if (currentStatus === RiskStatus.OPEN && newStatus === RiskStatus.CLOSED) {
      return {
        allowed: false,
        reason:
          "Cannot close a risk directly from OPEN status. Risk must go through ASSIGNED and REMEDIATED stages first.",
      };
    }

    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedNext.join(", ") || "none"}`,
    };
  }

  // Check role permissions (AC19-AC24)
  // AC22, AC23: BUSINESS_STAKEHOLDER and AUDITOR cannot change status
  if (
    userRole === UserRole.BUSINESS_STAKEHOLDER ||
    userRole === UserRole.AUDITOR
  ) {
    return {
      allowed: false,
      reason: "Your role does not have permission to change risk status",
    };
  }

  // AC19: GRC_ANALYST and ORG_ADMIN can perform any valid transition
  if (userRole === UserRole.GRC_ANALYST || userRole === UserRole.ORG_ADMIN) {
    return buildSuccessResult(currentStatus, newStatus);
  }

  // AC20: SECURITY_ENGINEER can transition OPEN → ASSIGNED
  if (
    userRole === UserRole.SECURITY_ENGINEER &&
    currentStatus === RiskStatus.OPEN &&
    newStatus === RiskStatus.ASSIGNED
  ) {
    return { allowed: true };
  }

  // AC21: IT_STAKEHOLDER can transition ASSIGNED → REMEDIATED (for assigned risks only)
  if (
    userRole === UserRole.IT_STAKEHOLDER &&
    currentStatus === RiskStatus.ASSIGNED &&
    newStatus === RiskStatus.REMEDIATED
  ) {
    if (!isOwner) {
      return {
        allowed: false,
        reason:
          "You can only mark risks as remediated if you are assigned as the IT owner",
      };
    }
    return {
      allowed: true,
      requiresRemediationEvidence: true,
    };
  }

  // AC24: Unauthorized transitions return FORBIDDEN error
  return {
    allowed: false,
    reason: "Insufficient permissions for this status transition",
  };
}

/**
 * Builds a success result with any additional requirements based on the transition.
 */
function buildSuccessResult(
  currentStatus: RiskStatus,
  newStatus: RiskStatus
): TransitionValidationResult {
  const result: TransitionValidationResult = { allowed: true };

  // AC10: CLOSED → any other status requires comment
  if (currentStatus === RiskStatus.CLOSED) {
    result.requiresReason = true;
  }

  // AC36: ASSIGNED → REMEDIATED requires evidence
  if (
    currentStatus === RiskStatus.ASSIGNED &&
    newStatus === RiskStatus.REMEDIATED
  ) {
    result.requiresRemediationEvidence = true;
  }

  return result;
}

/**
 * Returns the list of available status transitions for the current state and user role.
 *
 * @param currentStatus - The current risk status
 * @param userRole - The role of the user
 * @param isOwner - Whether the user is the IT owner of the risk
 * @returns Array of valid next statuses
 *
 * @example
 * ```typescript
 * const available = getAvailableTransitions(
 *   RiskStatus.ASSIGNED,
 *   UserRole.IT_STAKEHOLDER,
 *   true
 * );
 * // [RiskStatus.REMEDIATED]
 * ```
 */
export function getAvailableTransitions(
  currentStatus: RiskStatus,
  userRole: UserRole,
  isOwner: boolean = false
): RiskStatus[] {
  const allTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];

  return allTransitions.filter((newStatus) => {
    const { allowed } = validateTransition(
      currentStatus,
      newStatus,
      userRole,
      isOwner
    );
    return allowed;
  });
}

/**
 * Status display configuration for UI components.
 */
export interface StatusDisplayConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
}

/**
 * Returns display configuration for a given status.
 * Used by StatusBadge component for consistent styling.
 *
 * AC5: Status displayed with color-coded badges
 * - OPEN = gray
 * - ASSIGNED = blue
 * - REMEDIATED = yellow
 * - CLOSED = green
 */
export function getStatusDisplayConfig(
  status: RiskStatus
): StatusDisplayConfig {
  const configs: Record<RiskStatus, StatusDisplayConfig> = {
    // Assessment workflow statuses
    [RiskStatus.DRAFT]: {
      label: "Draft",
      color: "text-slate-700",
      bgColor: "bg-slate-100",
      borderColor: "border-slate-300",
      icon: "circle-dashed",
      description: "Assessment in progress by assignee",
    },
    [RiskStatus.PENDING_REVIEW]: {
      label: "Pending Review",
      color: "text-purple-700",
      bgColor: "bg-purple-100",
      borderColor: "border-purple-300",
      icon: "clock",
      description: "Submitted for manager review",
    },
    // Standard remediation workflow statuses
    [RiskStatus.OPEN]: {
      label: "Open",
      color: "text-gray-700",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
      icon: "circle",
      description: "Risk identified, awaiting assignment",
    },
    [RiskStatus.ASSIGNED]: {
      label: "Assigned",
      color: "text-blue-700",
      bgColor: "bg-blue-100",
      borderColor: "border-blue-300",
      icon: "user",
      description: "Assigned to stakeholder for remediation",
    },
    [RiskStatus.REMEDIATED]: {
      label: "Remediated",
      color: "text-yellow-700",
      bgColor: "bg-yellow-100",
      borderColor: "border-yellow-300",
      icon: "check-circle",
      description: "Remediation complete, awaiting verification",
    },
    [RiskStatus.CLOSED]: {
      label: "Closed",
      color: "text-green-700",
      bgColor: "bg-green-100",
      borderColor: "border-green-300",
      icon: "check-circle-2",
      description: "Verified and closed",
    },
  };

  return configs[status];
}

/**
 * Check if a status transition from CLOSED requires a reason.
 */
export function transitionRequiresReason(
  currentStatus: RiskStatus,
  newStatus: RiskStatus
): boolean {
  // AC10: CLOSED → any other status requires comment
  return currentStatus === RiskStatus.CLOSED && newStatus !== RiskStatus.CLOSED;
}

/**
 * Check if a status transition requires remediation evidence.
 */
export function transitionRequiresEvidence(
  currentStatus: RiskStatus,
  newStatus: RiskStatus
): boolean {
  // AC36: When transitioning to REMEDIATED, require evidence
  return (
    currentStatus === RiskStatus.ASSIGNED && newStatus === RiskStatus.REMEDIATED
  );
}
