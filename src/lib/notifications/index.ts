/**
 * Notifications Module
 *
 * Exports notification hooks and utilities for the application.
 * Currently implements basic logging; will be expanded in Epic 6.
 */

export {
  AssessmentNotificationType,
  emitAssignmentNotification,
  emitUnassignmentNotification,
  emitSubmittedNotification,
  emitApprovedNotification,
  emitRejectedNotification,
  setNotificationHandler,
  resetNotificationHandler,
  type AssessmentAssignedEvent,
  type AssessmentUnassignedEvent,
  type AssessmentSubmittedEvent,
  type AssessmentApprovedEvent,
  type AssessmentRejectedEvent,
  type AssessmentNotificationEvent,
} from "./assessment-notifications";
