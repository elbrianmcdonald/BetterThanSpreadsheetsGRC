/**
 * Risk Audit Logging Service
 *
 * Story 4.12: Risk Audit Trail with Timestamps
 *
 * Provides specialized audit logging for risk operations with:
 * - Actor name/role snapshots (AC7)
 * - SYSTEM actor support for automated operations (AC8)
 * - Structured change details for field-level tracking (AC3)
 * - Immutable logging (AC4)
 *
 * @see Story 4.12: Risk Audit Trail with Timestamps
 */

import { randomUUID } from "crypto";
import { db } from "@/server/db";
import type { AuditAction } from "@prisma/client";

/**
 * Change details for audit logging
 * Captures field-level changes with old/new values
 */
export interface RiskChangeDetails {
  [key: string]:
    | {
        oldValue?: unknown;
        newValue?: unknown;
      }
    | unknown;
}

/**
 * Parameters for logging a risk action
 */
export interface LogRiskActionParams {
  /** The action being logged */
  action: AuditAction;
  /** The risk ID */
  riskId: string;
  /** The organization ID */
  organizationId: string;
  /** The actor's user ID (null for SYSTEM actions) */
  actorId: string | null;
  /** The actor's name at time of action (snapshot) */
  actorName: string;
  /** The actor's role at time of action (snapshot) */
  actorRole: string;
  /** Structured change details */
  changeDetails?: RiskChangeDetails;
}

/**
 * Log a risk-related action to the audit trail
 *
 * **IMPORTANT:** Uses fire-and-forget pattern (void return).
 * Audit log failures are logged but don't block the main operation.
 *
 * **Example Usage:**
 * ```typescript
 * await logRiskAction({
 *   action: "ASSIGN_RISK",
 *   riskId: risk.id,
 *   organizationId: ctx.organizationId,
 *   actorId: ctx.session.user.id,
 *   actorName: ctx.session.user.name,
 *   actorRole: ctx.session.user.role,
 *   changeDetails: {
 *     itOwner: { newValue: itOwner.name },
 *     businessOwner: { newValue: businessOwner.name }
 *   }
 * });
 * ```
 *
 * @param params - Log parameters
 */
export async function logRiskAction(
  params: LogRiskActionParams
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId: params.organizationId,
        userId: params.actorId, // Nullable for SYSTEM actions (AC8)
        action: params.action,
        entityType: "RISK",
        entityId: params.riskId,
        changes: params.changeDetails as object,
        timestamp: new Date(),
        // Actor snapshots (AC7)
        actorName: params.actorName,
        actorRole: params.actorRole,
      },
    });
  } catch (error) {
    // Log error but don't throw (fire-and-forget pattern)
    // Don't block risk mutations if audit log fails
    console.error("[RiskAuditLogger] Failed to create audit log:", error);
  }
}

/**
 * Log a SYSTEM action (automated operations like impact calculation)
 *
 * **Example Usage:**
 * ```typescript
 * await logSystemRiskAction({
 *   action: "UPDATE_RISK",
 *   riskId: risk.id,
 *   organizationId: risk.organizationId,
 *   changeDetails: {
 *     impactScore: { oldValue: 50, newValue: 75 },
 *     reason: "Automated recalculation after evidence linked"
 *   }
 * });
 * ```
 *
 * @param params - Log parameters (without actor info)
 */
export async function logSystemRiskAction(params: {
  action: AuditAction;
  riskId: string;
  organizationId: string;
  changeDetails?: RiskChangeDetails;
}): Promise<void> {
  await logRiskAction({
    action: params.action,
    riskId: params.riskId,
    organizationId: params.organizationId,
    actorId: null,
    actorName: "SYSTEM",
    actorRole: "SYSTEM",
    changeDetails: params.changeDetails,
  });
}

/**
 * Helper to create structured change details for risk creation
 */
export function createRiskCreationDetails(risk: {
  title: string;
  severity: string;
  description?: string;
  template?: string;
  assetCriticality?: string;
}): RiskChangeDetails {
  return {
    title: { newValue: risk.title },
    severity: { newValue: risk.severity },
    description: { newValue: risk.description },
    template: risk.template ? { newValue: risk.template } : undefined,
    assetCriticality: risk.assetCriticality
      ? { newValue: risk.assetCriticality }
      : undefined,
  };
}

/**
 * Helper to create structured change details for risk assignment
 */
export function createRiskAssignmentDetails(assignment: {
  itOwnerName?: string | null;
  businessOwnerName?: string | null;
  previousItOwnerName?: string | null;
  previousBusinessOwnerName?: string | null;
}): RiskChangeDetails {
  const details: RiskChangeDetails = {};

  if (
    assignment.itOwnerName !== undefined ||
    assignment.previousItOwnerName !== undefined
  ) {
    details.itOwner = {
      oldValue: assignment.previousItOwnerName ?? null,
      newValue: assignment.itOwnerName ?? null,
    };
  }

  if (
    assignment.businessOwnerName !== undefined ||
    assignment.previousBusinessOwnerName !== undefined
  ) {
    details.businessOwner = {
      oldValue: assignment.previousBusinessOwnerName ?? null,
      newValue: assignment.businessOwnerName ?? null,
    };
  }

  return details;
}

/**
 * Helper to create structured change details for status transitions
 */
export function createStatusChangeDetails(statusChange: {
  oldStatus: string;
  newStatus: string;
  reason?: string;
  verifiedBy?: string;
  verificationComment?: string;
}): RiskChangeDetails {
  return {
    status: {
      oldValue: statusChange.oldStatus,
      newValue: statusChange.newStatus,
    },
    reason: statusChange.reason ? { newValue: statusChange.reason } : undefined,
    verifiedBy: statusChange.verifiedBy
      ? { newValue: statusChange.verifiedBy }
      : undefined,
    verificationComment: statusChange.verificationComment
      ? { newValue: statusChange.verificationComment }
      : undefined,
  };
}

/**
 * Helper to create structured change details for evidence linkage
 */
export function createEvidenceLinkDetails(evidence: {
  evidenceId: string;
  evidenceTitle: string;
  evidenceType: string; // "FINDING" or "REMEDIATION"
  action: "link" | "unlink";
}): RiskChangeDetails {
  return {
    evidenceId: { newValue: evidence.evidenceId },
    evidenceTitle: { newValue: evidence.evidenceTitle },
    evidenceType: { newValue: evidence.evidenceType },
    linkAction: { newValue: evidence.action },
  };
}

/**
 * Helper to create structured change details for remediation options
 */
export function createRemediationOptionDetails(option: {
  optionId: string;
  title: string;
  estimatedCost?: number | null;
  timeline?: string | null;
  action: "add" | "update" | "delete";
}): RiskChangeDetails {
  return {
    optionId: { newValue: option.optionId },
    title: { newValue: option.title },
    estimatedCost: option.estimatedCost
      ? { newValue: option.estimatedCost }
      : undefined,
    timeline: option.timeline ? { newValue: option.timeline } : undefined,
    optionAction: { newValue: option.action },
  };
}

/**
 * Helper to create structured change details for comments
 */
export function createCommentDetails(comment: {
  commentId: string;
  commentType: string;
  content: string;
  action: "add" | "update" | "delete";
}): RiskChangeDetails {
  // Truncate content to first 100 characters for preview
  const preview =
    comment.content.length > 100
      ? comment.content.substring(0, 100) + "..."
      : comment.content;

  return {
    commentId: { newValue: comment.commentId },
    commentType: { newValue: comment.commentType },
    contentPreview: { newValue: preview },
    commentAction: { newValue: comment.action },
  };
}
