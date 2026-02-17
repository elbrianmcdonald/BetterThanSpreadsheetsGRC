/**
 * Assessment Notification Hooks
 *
 * Story 3.4: Assignment Change Triggers Notification Hook
 *
 * This module provides notification hooks for assessment-related events.
 * Currently implements a simple logging mechanism that can be expanded
 * when the notification system (Epic 6) is implemented.
 */

/**
 * Notification event types for assessments
 */
export enum AssessmentNotificationType {
  ASSESSMENT_ASSIGNED = "ASSESSMENT_ASSIGNED",
  ASSESSMENT_REASSIGNED = "ASSESSMENT_REASSIGNED",
  ASSESSMENT_UNASSIGNED = "ASSESSMENT_UNASSIGNED",
  ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED",
  ASSESSMENT_APPROVED = "ASSESSMENT_APPROVED",
  ASSESSMENT_REJECTED = "ASSESSMENT_REJECTED",
}

/**
 * Base notification event structure
 */
interface BaseNotificationEvent {
  type: AssessmentNotificationType;
  timestamp: Date;
  organizationId: string;
}

/**
 * Assessment assignment notification event
 */
export interface AssessmentAssignedEvent extends BaseNotificationEvent {
  type: AssessmentNotificationType.ASSESSMENT_ASSIGNED | AssessmentNotificationType.ASSESSMENT_REASSIGNED;
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  assignedById: string;
  assignedByName: string | null;
  previousAssigneeId: string | null;
  previousAssigneeName: string | null;
}

/**
 * Assessment unassignment notification event
 */
export interface AssessmentUnassignedEvent extends BaseNotificationEvent {
  type: AssessmentNotificationType.ASSESSMENT_UNASSIGNED;
  assessmentId: string;
  assessmentSubject: string;
  previousAssigneeId: string;
  previousAssigneeName: string | null;
  unassignedById: string;
  unassignedByName: string | null;
}

/**
 * Assessment submitted notification event
 */
export interface AssessmentSubmittedEvent extends BaseNotificationEvent {
  type: AssessmentNotificationType.ASSESSMENT_SUBMITTED;
  assessmentId: string;
  assessmentSubject: string;
  submittedById: string;
  submittedByName: string | null;
  riskCount: number;
}

/**
 * Assessment approved notification event
 */
export interface AssessmentApprovedEvent extends BaseNotificationEvent {
  type: AssessmentNotificationType.ASSESSMENT_APPROVED;
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  approvedById: string;
  approvedByName: string | null;
  riskCount: number;
}

/**
 * Assessment rejected notification event
 */
export interface AssessmentRejectedEvent extends BaseNotificationEvent {
  type: AssessmentNotificationType.ASSESSMENT_REJECTED;
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  rejectedById: string;
  rejectedByName: string | null;
  rejectionNotes: string;
}

/**
 * Union type for all assessment notification events
 */
export type AssessmentNotificationEvent =
  | AssessmentAssignedEvent
  | AssessmentUnassignedEvent
  | AssessmentSubmittedEvent
  | AssessmentApprovedEvent
  | AssessmentRejectedEvent;

/**
 * Notification handler function type
 * This can be replaced with actual notification logic in Epic 6
 */
type NotificationHandler = (event: AssessmentNotificationEvent) => Promise<void>;

/**
 * Default notification handler - logs to console
 * Will be replaced with actual notification delivery in Epic 6
 */
const defaultHandler: NotificationHandler = async (event) => {
  // Log notification event for debugging/audit purposes
  console.log(
    `[Notification] ${event.type} at ${event.timestamp.toISOString()}:`,
    JSON.stringify({
      assessmentId: "assessmentId" in event ? event.assessmentId : undefined,
      assigneeId: "assigneeId" in event ? event.assigneeId : undefined,
      organizationId: event.organizationId,
    })
  );
};

// Notification handler registry - allows for future extensibility
let notificationHandler: NotificationHandler = defaultHandler;

/**
 * Set a custom notification handler
 * This allows Epic 6 to inject actual notification logic
 */
export function setNotificationHandler(handler: NotificationHandler): void {
  notificationHandler = handler;
}

/**
 * Reset to default notification handler
 */
export function resetNotificationHandler(): void {
  notificationHandler = defaultHandler;
}

/**
 * Story 3.4: Emit assignment notification
 *
 * Called when an assessment is assigned or reassigned to a user.
 * This function is safe to call even if notifications aren't fully implemented.
 *
 * @param params - The assignment notification parameters
 */
export async function emitAssignmentNotification(params: {
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  assignedById: string;
  assignedByName: string | null;
  previousAssigneeId: string | null;
  previousAssigneeName?: string | null;
  organizationId: string;
}): Promise<void> {
  const {
    assessmentId,
    assessmentSubject,
    assigneeId,
    assigneeName,
    assignedById,
    assignedByName,
    previousAssigneeId,
    previousAssigneeName,
    organizationId,
  } = params;

  const isReassignment = previousAssigneeId !== null;

  const event: AssessmentAssignedEvent = {
    type: isReassignment
      ? AssessmentNotificationType.ASSESSMENT_REASSIGNED
      : AssessmentNotificationType.ASSESSMENT_ASSIGNED,
    timestamp: new Date(),
    organizationId,
    assessmentId,
    assessmentSubject,
    assigneeId,
    assigneeName,
    assignedById,
    assignedByName,
    previousAssigneeId,
    previousAssigneeName: previousAssigneeName ?? null,
  };

  try {
    await notificationHandler(event);
  } catch (error) {
    // Log error but don't fail the assignment operation
    console.error("[Notification] Failed to emit assignment notification:", error);
  }
}

/**
 * Emit unassignment notification
 *
 * Called when an assessment is unassigned from a user.
 * Currently a no-op but available for future use.
 */
export async function emitUnassignmentNotification(params: {
  assessmentId: string;
  assessmentSubject: string;
  previousAssigneeId: string;
  previousAssigneeName: string | null;
  unassignedById: string;
  unassignedByName: string | null;
  organizationId: string;
}): Promise<void> {
  const event: AssessmentUnassignedEvent = {
    type: AssessmentNotificationType.ASSESSMENT_UNASSIGNED,
    timestamp: new Date(),
    ...params,
  };

  try {
    await notificationHandler(event);
  } catch (error) {
    console.error("[Notification] Failed to emit unassignment notification:", error);
  }
}

/**
 * Story 6.1: Emit submitted notification
 *
 * Called when an assessment is submitted for review.
 * Targets all managers in the organization.
 */
export async function emitSubmittedNotification(params: {
  assessmentId: string;
  assessmentSubject: string;
  submittedById: string;
  submittedByName: string | null;
  riskCount: number;
  organizationId: string;
}): Promise<void> {
  const event: AssessmentSubmittedEvent = {
    type: AssessmentNotificationType.ASSESSMENT_SUBMITTED,
    timestamp: new Date(),
    ...params,
  };

  try {
    await notificationHandler(event);
  } catch (error) {
    console.error("[Notification] Failed to emit submitted notification:", error);
  }
}

/**
 * Story 6.1: Emit approved notification
 *
 * Called when an assessment is approved.
 * Targets the assessment assignee.
 */
export async function emitApprovedNotification(params: {
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  approvedById: string;
  approvedByName: string | null;
  riskCount: number;
  organizationId: string;
}): Promise<void> {
  const event: AssessmentApprovedEvent = {
    type: AssessmentNotificationType.ASSESSMENT_APPROVED,
    timestamp: new Date(),
    ...params,
  };

  try {
    await notificationHandler(event);
  } catch (error) {
    console.error("[Notification] Failed to emit approved notification:", error);
  }
}

/**
 * Story 6.1: Emit rejected notification
 *
 * Called when an assessment is rejected.
 * Targets the assessment assignee.
 */
export async function emitRejectedNotification(params: {
  assessmentId: string;
  assessmentSubject: string;
  assigneeId: string;
  assigneeName: string | null;
  rejectedById: string;
  rejectedByName: string | null;
  rejectionNotes: string;
  organizationId: string;
}): Promise<void> {
  const event: AssessmentRejectedEvent = {
    type: AssessmentNotificationType.ASSESSMENT_REJECTED,
    timestamp: new Date(),
    ...params,
  };

  try {
    await notificationHandler(event);
  } catch (error) {
    console.error("[Notification] Failed to emit rejected notification:", error);
  }
}
