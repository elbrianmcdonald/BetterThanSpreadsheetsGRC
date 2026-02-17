/**
 * Finding Status State Machine Service
 *
 * Story 7.3: Finding Triage Workflow
 *
 * This service implements the finding workflow state machine that governs
 * valid status transitions for the triage process.
 *
 * State Transition Rules (AC1-AC6):
 * - NEW → TRIAGED: Mark as triaged after review
 * - NEW → NEEDS_INFO: Request more information
 * - NEW → DUPLICATE: Mark as duplicate of existing finding
 * - NEW → REJECTED: Reject invalid finding
 * - NEEDS_INFO → TRIAGED: Resume triage after info provided
 * - TRIAGED → ACCEPTED: Accept finding (creates Risk Assessment) - Story 7.4
 * - DUPLICATE, REJECTED, ACCEPTED: Terminal states (no transitions out)
 *
 * @see Story 7.3: Finding Triage Workflow
 */

import { FindingStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * Map of allowed state transitions for each status.
 * This defines the valid workflow paths through the finding lifecycle.
 *
 * AC2: Valid transitions defined: NEW → TRIAGED, NEW → NEEDS_INFO, NEW → DUPLICATE, NEW → REJECTED
 * AC3: NEEDS_INFO → TRIAGED transition supported
 */
export const FINDING_TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  [FindingStatus.NEW]: [
    FindingStatus.NEEDS_INFO,
    FindingStatus.TRIAGED,
    FindingStatus.DUPLICATE,
    FindingStatus.REJECTED,
  ],
  [FindingStatus.NEEDS_INFO]: [FindingStatus.TRIAGED],
  [FindingStatus.TRIAGED]: [FindingStatus.ACCEPTED],
  [FindingStatus.DUPLICATE]: [], // Terminal - AC4
  [FindingStatus.REJECTED]: [], // Terminal - AC4
  [FindingStatus.ACCEPTED]: [], // Terminal - AC4, handled by Story 7.4
};

/**
 * Terminal states that cannot transition further.
 * AC4: Terminal states identified: DUPLICATE, REJECTED, ACCEPTED
 */
export const TERMINAL_STATUSES: FindingStatus[] = [
  FindingStatus.DUPLICATE,
  FindingStatus.REJECTED,
  FindingStatus.ACCEPTED,
];

/**
 * Checks if a status transition is allowed.
 *
 * AC5: `canTransitionFinding(from, to)` function returns boolean
 *
 * @param from - The current finding status
 * @param to - The desired new status
 * @returns true if the transition is allowed, false otherwise
 *
 * @example
 * ```typescript
 * canTransitionFinding(FindingStatus.NEW, FindingStatus.TRIAGED) // true
 * canTransitionFinding(FindingStatus.REJECTED, FindingStatus.NEW) // false (terminal)
 * ```
 */
export function canTransitionFinding(
  from: FindingStatus,
  to: FindingStatus
): boolean {
  return FINDING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Asserts that a status transition is valid, throws TRPCError if not.
 *
 * AC6: `assertFindingTransition(from, to)` throws TRPCError on invalid transition
 *
 * @param from - The current finding status
 * @param to - The desired new status
 * @throws TRPCError with code BAD_REQUEST if transition is not allowed
 *
 * @example
 * ```typescript
 * assertFindingTransition(FindingStatus.NEW, FindingStatus.TRIAGED) // OK
 * assertFindingTransition(FindingStatus.REJECTED, FindingStatus.NEW) // throws
 * ```
 */
export function assertFindingTransition(
  from: FindingStatus,
  to: FindingStatus
): void {
  if (from === to) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Finding is already in this status",
    });
  }

  if (!canTransitionFinding(from, to)) {
    const allowed = FINDING_TRANSITIONS[from];
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot transition from ${from} to ${to}. Allowed transitions: ${allowed.join(", ") || "none"}`,
    });
  }
}

/**
 * Returns true if the status is a terminal state.
 *
 * @param status - The finding status to check
 * @returns true if the status is terminal (DUPLICATE, REJECTED, or ACCEPTED)
 *
 * @example
 * ```typescript
 * isTerminalFindingStatus(FindingStatus.REJECTED) // true
 * isTerminalFindingStatus(FindingStatus.NEW) // false
 * ```
 */
export function isTerminalFindingStatus(status: FindingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Returns list of available transitions from current status.
 *
 * @param currentStatus - The current finding status
 * @returns Array of valid next statuses
 *
 * @example
 * ```typescript
 * getAvailableFindingTransitions(FindingStatus.NEW)
 * // [FindingStatus.NEEDS_INFO, FindingStatus.TRIAGED, FindingStatus.DUPLICATE, FindingStatus.REJECTED]
 * getAvailableFindingTransitions(FindingStatus.REJECTED) // []
 * ```
 */
export function getAvailableFindingTransitions(
  currentStatus: FindingStatus
): FindingStatus[] {
  return FINDING_TRANSITIONS[currentStatus] || [];
}

/**
 * Status display configuration for UI components.
 */
export interface FindingStatusDisplayConfig {
  /** Human-readable label */
  label: string;
  /** Text color class (Tailwind) */
  color: string;
  /** Background color class (Tailwind) */
  bgColor: string;
  /** Lucide icon name */
  icon: string;
  /** Description of the status */
  description: string;
}

/**
 * Returns display configuration for a given finding status.
 * Used by FindingStatusBadge component for consistent styling.
 *
 * AC18: Status badge displays current state with appropriate color
 *
 * @param status - The finding status
 * @returns Display configuration for the status
 */
export function getFindingStatusDisplayConfig(
  status: FindingStatus
): FindingStatusDisplayConfig {
  const configs: Record<FindingStatus, FindingStatusDisplayConfig> = {
    [FindingStatus.NEW]: {
      label: "New",
      color: "text-blue-700",
      bgColor: "bg-blue-100",
      icon: "circle",
      description: "Newly created finding awaiting triage",
    },
    [FindingStatus.NEEDS_INFO]: {
      label: "Needs Info",
      color: "text-yellow-700",
      bgColor: "bg-yellow-100",
      icon: "alert-circle",
      description: "Additional information required before triage",
    },
    [FindingStatus.TRIAGED]: {
      label: "Triaged",
      color: "text-green-700",
      bgColor: "bg-green-100",
      icon: "check-circle",
      description: "Reviewed and ready for acceptance decision",
    },
    [FindingStatus.DUPLICATE]: {
      label: "Duplicate",
      color: "text-gray-700",
      bgColor: "bg-gray-100",
      icon: "copy",
      description: "Duplicate of another finding",
    },
    [FindingStatus.REJECTED]: {
      label: "Rejected",
      color: "text-red-700",
      bgColor: "bg-red-100",
      icon: "x-circle",
      description: "Not a valid security finding",
    },
    [FindingStatus.ACCEPTED]: {
      label: "Accepted",
      color: "text-purple-700",
      bgColor: "bg-purple-100",
      icon: "check-circle-2",
      description: "Accepted - Risk Assessment created",
    },
  };

  return configs[status];
}

/**
 * Maps FindingStatus to button configuration for the UI.
 * Used by FindingActions component to render appropriate action buttons.
 */
export interface FindingActionConfig {
  /** Target status for this action */
  targetStatus: FindingStatus;
  /** Button label */
  label: string;
  /** Button variant (for styling) */
  variant: "default" | "secondary" | "destructive" | "outline";
  /** Whether this action requires a modal/dialog */
  requiresModal: boolean;
  /** Modal type if required */
  modalType?: "duplicate" | "rejection" | null;
}

/**
 * Returns action configurations for a given status.
 *
 * AC14: NEW status shows: "Mark Triaged", "Needs Info", "Mark Duplicate", "Reject"
 * AC15: NEEDS_INFO status shows: "Mark Triaged"
 * AC16: TRIAGED status shows: "Accept Finding" (Story 7.4)
 * AC17: Terminal states show no transition buttons
 *
 * @param currentStatus - The current finding status
 * @returns Array of action configurations for available transitions
 */
export function getFindingActionConfigs(
  currentStatus: FindingStatus
): FindingActionConfig[] {
  const actionMap: Record<FindingStatus, FindingActionConfig[]> = {
    [FindingStatus.NEW]: [
      {
        targetStatus: FindingStatus.TRIAGED,
        label: "Mark Triaged",
        variant: "default",
        requiresModal: false,
      },
      {
        targetStatus: FindingStatus.NEEDS_INFO,
        label: "Needs Info",
        variant: "secondary",
        requiresModal: false,
      },
      {
        targetStatus: FindingStatus.DUPLICATE,
        label: "Mark Duplicate",
        variant: "outline",
        requiresModal: true,
        modalType: "duplicate",
      },
      {
        targetStatus: FindingStatus.REJECTED,
        label: "Reject",
        variant: "destructive",
        requiresModal: true,
        modalType: "rejection",
      },
    ],
    [FindingStatus.NEEDS_INFO]: [
      {
        targetStatus: FindingStatus.TRIAGED,
        label: "Mark Triaged",
        variant: "default",
        requiresModal: false,
      },
    ],
    [FindingStatus.TRIAGED]: [
      {
        targetStatus: FindingStatus.ACCEPTED,
        label: "Accept Finding",
        variant: "default",
        requiresModal: false,
      },
    ],
    // Terminal states - no actions available (AC17)
    [FindingStatus.DUPLICATE]: [],
    [FindingStatus.REJECTED]: [],
    [FindingStatus.ACCEPTED]: [],
  };

  return actionMap[currentStatus] || [];
}
