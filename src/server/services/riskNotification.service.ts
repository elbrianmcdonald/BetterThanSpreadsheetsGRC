/**
 * Risk Notification Service (Story 4.16)
 *
 * Provides notification triggers for risk lifecycle events.
 * Uses email templates and the queue service for reliable delivery.
 *
 * AC7-AC40: Various notification types
 * AC41-AC45: Template rendering
 * AC46: Integration with risk mutations
 */

import { db } from "@/server/db";
import { enqueueEmail } from "./emailQueue.service";
import {
  renderRiskAssignedEmail,
  renderStatusChangedEmail,
  renderDecisionRequiredEmail,
  renderRiskClosedEmail,
  renderCommentAddedEmail,
  renderEvidenceRequestEmail,
  type RiskAssignedVariables,
  type StatusChangedVariables,
  type DecisionRequiredVariables,
  type RiskClosedVariables,
  type CommentAddedVariables,
  type EvidenceRequestVariables,
  type RemediationOptionSummary,
} from "@/server/email/templates";
import type { RiskStatus, EmailType } from "@prisma/client";

/**
 * Result of sending a notification
 */
export interface NotificationResult {
  success: boolean;
  queueIds: string[];
  errors: string[];
}

/**
 * Parameters for risk assignment notification
 */
export interface RiskAssignmentNotificationParams {
  riskId: string;
  assignedByUserId: string;
  assignedRole: "IT_OWNER" | "BUSINESS_OWNER";
  organizationId: string;
}

/**
 * Parameters for status change notification
 */
export interface StatusChangeNotificationParams {
  riskId: string;
  oldStatus: RiskStatus;
  newStatus: RiskStatus;
  changedByUserId: string;
  changeReason?: string | null;
  organizationId: string;
}

/**
 * Parameters for decision required notification
 */
export interface DecisionRequiredNotificationParams {
  riskId: string;
  organizationId: string;
}

/**
 * Parameters for risk closed notification
 */
export interface RiskClosedNotificationParams {
  riskId: string;
  closedByUserId: string;
  finalStatus: "CLOSED" | "ACCEPTED";
  remediationSummary?: string | null;
  organizationId: string;
}

/**
 * Parameters for comment added notification
 */
export interface CommentAddedNotificationParams {
  riskId: string;
  commenterId: string;
  commentText: string;
  organizationId: string;
}

/**
 * Parameters for evidence request notification
 */
export interface EvidenceRequestNotificationParams {
  requestId: string;
  recipientEmail: string;
  recipientName: string;
  requestedByUserId: string;
  controlDomain: string;
  frameworkName: string;
  evidenceGuidance?: string | null;
  dueDate?: Date | null;
  organizationId: string;
}

/**
 * Get risk participants (IT Owner, Business Owner) for notifications
 */
async function getRiskParticipants(riskId: string): Promise<
  {
    email: string;
    name: string;
    role: "IT_OWNER" | "BUSINESS_OWNER" | "GRC_ANALYST";
  }[]
> {
  const risk = await db.risk.findUnique({
    where: { id: riskId },
    select: {
      ITOwner: { select: { email: true, name: true } },
      BusinessOwner: { select: { email: true, name: true } },
      CreatedBy: { select: { email: true, name: true } },
    },
  });

  if (!risk) return [];

  const participants: {
    email: string;
    name: string;
    role: "IT_OWNER" | "BUSINESS_OWNER" | "GRC_ANALYST";
  }[] = [];

  if (risk.ITOwner?.email) {
    participants.push({
      email: risk.ITOwner.email,
      name: risk.ITOwner.name ?? "IT Owner",
      role: "IT_OWNER",
    });
  }

  if (risk.BusinessOwner?.email) {
    participants.push({
      email: risk.BusinessOwner.email,
      name: risk.BusinessOwner.name ?? "Business Owner",
      role: "BUSINESS_OWNER",
    });
  }

  // Include creator (GRC Analyst) for some notifications
  if (risk.CreatedBy?.email) {
    participants.push({
      email: risk.CreatedBy.email,
      name: risk.CreatedBy.name ?? "GRC Analyst",
      role: "GRC_ANALYST",
    });
  }

  return participants;
}

/**
 * Get organization info for templates
 */
async function getOrganizationInfo(
  organizationId: string
): Promise<{ name: string; logoUrl?: string }> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return {
    name: org?.name ?? "Your Organization",
  };
}

/**
 * Get user name by ID
 */
async function getUserName(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  return user?.name ?? "Unknown User";
}

/**
 * Send risk assignment notification
 * AC7-AC12: Risk assignment email
 */
export async function sendRiskAssignmentNotification(
  params: RiskAssignmentNotificationParams
): Promise<NotificationResult> {
  const { riskId, assignedByUserId, assignedRole, organizationId } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    // Get risk details
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      include: {
        ITOwner: { select: { email: true, name: true } },
        BusinessOwner: { select: { email: true, name: true } },
      },
    });

    if (!risk) {
      result.success = false;
      result.errors.push(`Risk not found: ${riskId}`);
      return result;
    }

    // Determine recipient based on assigned role
    const recipient =
      assignedRole === "IT_OWNER" ? risk.ITOwner : risk.BusinessOwner;

    if (!recipient?.email) {
      result.success = false;
      result.errors.push(`No ${assignedRole} assigned to risk`);
      return result;
    }

    const [assignedByName, orgInfo] = await Promise.all([
      getUserName(assignedByUserId),
      getOrganizationInfo(organizationId),
    ]);

    const variables: RiskAssignedVariables = {
      riskId,
      riskTitle: risk.title,
      severity: risk.severity,
      impactScore: risk.impactScore,
      assignedByName,
      assignedRole,
      description: risk.description ?? "No description provided.",
      discoveryDate: risk.discoveryDate,
      findingSource: risk.findingSource,
      frameworksAffectedCount: 0, // Frameworks not linked to individual risks
      organizationName: orgInfo.name,
      organizationLogoUrl: orgInfo.logoUrl,
    };

    const { html, text, subject } = renderRiskAssignedEmail(variables);

    const queueResult = await enqueueEmail({
      to: recipient.email,
      subject,
      htmlContent: html,
      textContent: text,
      emailType: "RISK_ASSIGNED" as EmailType,
      relatedEntityType: "RISK",
      relatedEntityId: riskId,
      organizationId,
    });

    if (queueResult.success && queueResult.queueId) {
      result.queueIds.push(queueResult.queueId);
    } else {
      result.errors.push(queueResult.error ?? "Failed to queue email");
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Send status change notification
 * AC13-AC18: Status change email
 */
export async function sendStatusChangeNotification(
  params: StatusChangeNotificationParams
): Promise<NotificationResult> {
  const { riskId, oldStatus, newStatus, changedByUserId, changeReason, organizationId } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: { title: true, impactScore: true },
    });

    if (!risk) {
      result.success = false;
      result.errors.push(`Risk not found: ${riskId}`);
      return result;
    }

    const participants = await getRiskParticipants(riskId);
    const [changedByName, orgInfo] = await Promise.all([
      getUserName(changedByUserId),
      getOrganizationInfo(organizationId),
    ]);

    // Send to all participants (AC17)
    for (const participant of participants) {
      // Skip sending to the person who made the change
      if (participant.email === (await getUserEmail(changedByUserId))) {
        continue;
      }

      const variables: StatusChangedVariables = {
        riskId,
        riskTitle: risk.title,
        oldStatus,
        newStatus,
        changedByName,
        changeReason: changeReason ?? null,
        impactScore: risk.impactScore,
        organizationName: orgInfo.name,
        organizationLogoUrl: orgInfo.logoUrl,
      };

      const { html, text, subject } = renderStatusChangedEmail(variables);

      const queueResult = await enqueueEmail({
        to: participant.email,
        subject,
        htmlContent: html,
        textContent: text,
        emailType: "STATUS_CHANGED" as EmailType,
        relatedEntityType: "RISK",
        relatedEntityId: riskId,
        organizationId,
      });

      if (queueResult.success && queueResult.queueId) {
        result.queueIds.push(queueResult.queueId);
      } else {
        result.errors.push(
          `Failed to queue for ${participant.email}: ${queueResult.error}`
        );
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Send decision required notification
 * AC19-AC24: Decision required email (Business Owner only - AC23)
 */
export async function sendDecisionRequiredNotification(
  params: DecisionRequiredNotificationParams
): Promise<NotificationResult> {
  const { riskId, organizationId } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      include: {
        BusinessOwner: { select: { email: true } },
        RemediationOptions: {
          select: {
            title: true,
            costEstimate: true,
            priority: true,
          },
        },
      },
    });

    if (!risk) {
      result.success = false;
      result.errors.push(`Risk not found: ${riskId}`);
      return result;
    }

    // AC23: Send to Business Owner only
    if (!risk.BusinessOwner?.email) {
      result.success = false;
      result.errors.push("No business owner assigned to risk");
      return result;
    }

    const orgInfo = await getOrganizationInfo(organizationId);

    const remediationOptions: RemediationOptionSummary[] = risk.RemediationOptions.map(
      (opt) => ({
        title: opt.title,
        estimatedCost: opt.costEstimate?.toNumber() ?? null,
        priority: opt.priority as "HIGH" | "MEDIUM" | "LOW",
      })
    );

    const variables: DecisionRequiredVariables = {
      riskId,
      riskTitle: risk.title,
      severity: risk.severity,
      impactScore: risk.impactScore,
      businessImpactStatement: risk.businessImpactStatement,
      remediationOptions,
      assignedDate: risk.updatedAt,
      organizationName: orgInfo.name,
      organizationLogoUrl: orgInfo.logoUrl,
    };

    const { html, text, subject } = renderDecisionRequiredEmail(variables);

    const queueResult = await enqueueEmail({
      to: risk.BusinessOwner.email,
      subject,
      htmlContent: html,
      textContent: text,
      emailType: "DECISION_REQUIRED" as EmailType,
      relatedEntityType: "RISK",
      relatedEntityId: riskId,
      organizationId,
    });

    if (queueResult.success && queueResult.queueId) {
      result.queueIds.push(queueResult.queueId);
    } else {
      result.errors.push(queueResult.error ?? "Failed to queue email");
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Send risk closed notification
 * AC31-AC35: Risk closed email
 */
export async function sendRiskClosedNotification(
  params: RiskClosedNotificationParams
): Promise<NotificationResult> {
  const { riskId, closedByUserId, finalStatus, remediationSummary, organizationId } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: {
        title: true,
        severity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!risk) {
      result.success = false;
      result.errors.push(`Risk not found: ${riskId}`);
      return result;
    }

    const participants = await getRiskParticipants(riskId);
    const [closedByName, orgInfo] = await Promise.all([
      getUserName(closedByUserId),
      getOrganizationInfo(organizationId),
    ]);

    // Send to all participants (AC34)
    for (const participant of participants) {
      const variables: RiskClosedVariables = {
        riskId,
        riskTitle: risk.title,
        severity: risk.severity,
        closedByName,
        closureDate: risk.updatedAt,
        createdDate: risk.createdAt,
        finalStatus,
        remediationSummary: remediationSummary ?? null,
        organizationName: orgInfo.name,
        organizationLogoUrl: orgInfo.logoUrl,
      };

      const { html, text, subject } = renderRiskClosedEmail(variables);

      const queueResult = await enqueueEmail({
        to: participant.email,
        subject,
        htmlContent: html,
        textContent: text,
        emailType: "RISK_CLOSED" as EmailType,
        relatedEntityType: "RISK",
        relatedEntityId: riskId,
        organizationId,
      });

      if (queueResult.success && queueResult.queueId) {
        result.queueIds.push(queueResult.queueId);
      } else {
        result.errors.push(
          `Failed to queue for ${participant.email}: ${queueResult.error}`
        );
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Send comment added notification
 * AC36-AC40: Comment notification email
 */
export async function sendCommentAddedNotification(
  params: CommentAddedNotificationParams
): Promise<NotificationResult> {
  const { riskId, commenterId, commentText, organizationId } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      select: {
        title: true,
        severity: true,
        _count: { select: { Comments: true } },
      },
    });

    if (!risk) {
      result.success = false;
      result.errors.push(`Risk not found: ${riskId}`);
      return result;
    }

    const participants = await getRiskParticipants(riskId);
    const commenterEmail = await getUserEmail(commenterId);
    const [commenterName, orgInfo] = await Promise.all([
      getUserName(commenterId),
      getOrganizationInfo(organizationId),
    ]);

    // Send to all participants except commenter (AC39)
    for (const participant of participants) {
      if (participant.email === commenterEmail) {
        continue;
      }

      const variables: CommentAddedVariables = {
        riskId,
        riskTitle: risk.title,
        severity: risk.severity,
        commenterName,
        commentText,
        commentedAt: new Date(),
        totalComments: risk._count.Comments,
        organizationName: orgInfo.name,
        organizationLogoUrl: orgInfo.logoUrl,
      };

      const { html, text, subject } = renderCommentAddedEmail(variables);

      const queueResult = await enqueueEmail({
        to: participant.email,
        subject,
        htmlContent: html,
        textContent: text,
        emailType: "COMMENT_ADDED" as EmailType,
        relatedEntityType: "RISK",
        relatedEntityId: riskId,
        organizationId,
      });

      if (queueResult.success && queueResult.queueId) {
        result.queueIds.push(queueResult.queueId);
      } else {
        result.errors.push(
          `Failed to queue for ${participant.email}: ${queueResult.error}`
        );
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Send evidence request notification
 * AC25-AC30: Evidence request email
 */
export async function sendEvidenceRequestNotification(
  params: EvidenceRequestNotificationParams
): Promise<NotificationResult> {
  const {
    requestId,
    recipientEmail,
    requestedByUserId,
    controlDomain,
    frameworkName,
    evidenceGuidance,
    dueDate,
    organizationId,
  } = params;
  const result: NotificationResult = { success: true, queueIds: [], errors: [] };

  try {
    const [requestedByName, orgInfo] = await Promise.all([
      getUserName(requestedByUserId),
      getOrganizationInfo(organizationId),
    ]);

    const variables: EvidenceRequestVariables = {
      requestId,
      requestedByName,
      controlDomain,
      frameworkName,
      evidenceGuidance: evidenceGuidance ?? null,
      dueDate: dueDate ?? null,
      organizationName: orgInfo.name,
      organizationLogoUrl: orgInfo.logoUrl,
    };

    const { html, text, subject } = renderEvidenceRequestEmail(variables);

    const queueResult = await enqueueEmail({
      to: recipientEmail,
      subject,
      htmlContent: html,
      textContent: text,
      emailType: "EVIDENCE_REQUESTED" as EmailType,
      relatedEntityType: "EVIDENCE_REQUEST",
      relatedEntityId: requestId,
      organizationId,
    });

    if (queueResult.success && queueResult.queueId) {
      result.queueIds.push(queueResult.queueId);
    } else {
      result.errors.push(queueResult.error ?? "Failed to queue email");
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

/**
 * Helper to get user email by ID
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return user?.email ?? null;
}
