/**
 * Assessment Status State Machine Service
 *
 * Story 7.5: Risk Assessment Schema & State Machine
 *
 * Manages valid state transitions for risk assessments and enforces
 * approval gates before DRAFT → APPROVED transitions.
 *
 * State Machine:
 *   DRAFT → APPROVED (requires all approval gates)
 *   DRAFT → REJECTED
 *   APPROVED → (terminal)
 *   REJECTED → (terminal)
 *
 * Approval Gates:
 *   1. Score populated (likelihoodValue AND impactValue set)
 *   2. Scenario defined (at least one)
 *   3. Treatment selected
 *   4. Owner assigned
 */

import { AssessmentStatus } from "@prisma/client";
import type { RiskAssessment } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// =============================================================================
// State Machine (AC20-AC23)
// =============================================================================

/**
 * Valid state transitions for assessments.
 * DRAFT can transition to APPROVED or REJECTED.
 * APPROVED and REJECTED are terminal states.
 */
export const ASSESSMENT_TRANSITIONS: Record<AssessmentStatus, AssessmentStatus[]> = {
  [AssessmentStatus.DRAFT]: [AssessmentStatus.APPROVED, AssessmentStatus.REJECTED],
  [AssessmentStatus.APPROVED]: [], // Terminal
  [AssessmentStatus.REJECTED]: [], // Terminal
};

/**
 * Terminal states that cannot transition to any other state.
 */
export const TERMINAL_ASSESSMENT_STATUSES: AssessmentStatus[] = [
  AssessmentStatus.APPROVED,
  AssessmentStatus.REJECTED,
];

/**
 * Check if a transition from one status to another is valid.
 * AC23: canTransitionAssessment(from, to) function
 *
 * @param from - Current assessment status
 * @param to - Target assessment status
 * @returns true if transition is allowed, false otherwise
 */
export function canTransitionAssessment(
  from: AssessmentStatus,
  to: AssessmentStatus
): boolean {
  return ASSESSMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Assert that a transition is valid, throwing TRPCError if not.
 *
 * @param from - Current assessment status
 * @param to - Target assessment status
 * @throws TRPCError if transition is invalid
 */
export function assertAssessmentTransition(
  from: AssessmentStatus,
  to: AssessmentStatus
): void {
  if (from === to) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Assessment is already in this status",
    });
  }

  if (!canTransitionAssessment(from, to)) {
    const allowed = ASSESSMENT_TRANSITIONS[from];
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot transition from ${from} to ${to}. Allowed: ${allowed?.join(", ") || "none"}`,
    });
  }
}

/**
 * Check if a status is a terminal state.
 *
 * @param status - Assessment status to check
 * @returns true if status is terminal (APPROVED or REJECTED)
 */
export function isTerminalAssessmentStatus(status: AssessmentStatus): boolean {
  return TERMINAL_ASSESSMENT_STATUSES.includes(status);
}

/**
 * Get available transitions from current status.
 *
 * @param currentStatus - Current assessment status
 * @returns Array of valid target statuses
 */
export function getAvailableAssessmentTransitions(
  currentStatus: AssessmentStatus
): AssessmentStatus[] {
  return ASSESSMENT_TRANSITIONS[currentStatus] || [];
}

// =============================================================================
// Approval Gates (AC24-AC29)
// =============================================================================

/**
 * Result of checking approval gates
 * AC24: Returns { canApprove, missingGates }
 */
export interface ApprovalGateResult {
  canApprove: boolean;
  missingGates: string[];
}

/**
 * Assessment type with scenarios for gate checking.
 * Scenarios must be included in the query when checking approval gates.
 */
export type AssessmentWithScenarios = RiskAssessment & {
  scenarios: { id: string }[];
};

/**
 * Check all approval gates for an assessment.
 * Returns which gates are missing (if any).
 * AC24: checkApprovalGates(assessment) function
 *
 * Gates:
 * - AC25: Gate 1 - Score populated (likelihoodValue AND impactValue set)
 * - AC26: Gate 2 - Scenario defined (at least one)
 * - AC27: Gate 3 - Treatment selected
 * - AC28: Gate 4 - Owner assigned
 *
 * @param assessment - Assessment with scenarios to check
 * @returns ApprovalGateResult with canApprove and missingGates
 */
export function checkApprovalGates(
  assessment: AssessmentWithScenarios
): ApprovalGateResult {
  const missingGates: string[] = [];

  // AC25: Gate 1 - Score populated (both likelihood and impact required)
  if (assessment.likelihoodValue === null || assessment.impactValue === null) {
    missingGates.push("Score populated (likelihood and impact values required)");
  }

  // AC26: Gate 2 - At least one scenario defined
  if (!assessment.scenarios || assessment.scenarios.length === 0) {
    missingGates.push("Scenario defined (at least one risk scenario required)");
  }

  // AC27: Gate 3 - Treatment selected
  if (assessment.treatment === null) {
    missingGates.push("Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)");
  }

  // AC28: Gate 4 - Owner assigned
  if (assessment.ownerId === null) {
    missingGates.push("Owner assigned");
  }

  return {
    canApprove: missingGates.length === 0,
    missingGates,
  };
}

/**
 * Assert that all approval gates pass.
 * AC29: Throws TRPCError if any gates are missing.
 *
 * @param assessment - Assessment with scenarios to check
 * @throws TRPCError with BAD_REQUEST code if gates not met
 */
export function assertApprovalGates(
  assessment: AssessmentWithScenarios
): void {
  const result = checkApprovalGates(assessment);

  if (!result.canApprove) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot approve assessment. Missing requirements:\n- ${result.missingGates.join("\n- ")}`,
    });
  }
}

/**
 * Validate an approval transition.
 * Combines state machine validation with approval gate checks.
 *
 * @param assessment - Assessment with scenarios
 * @param targetStatus - Target status to transition to
 * @throws TRPCError if transition invalid or gates not met (for APPROVED)
 */
export function validateApprovalTransition(
  assessment: AssessmentWithScenarios,
  targetStatus: AssessmentStatus
): void {
  // First, validate the state machine transition
  assertAssessmentTransition(assessment.status, targetStatus);

  // If transitioning to APPROVED, also check approval gates
  if (targetStatus === AssessmentStatus.APPROVED) {
    assertApprovalGates(assessment);
  }
}
