/**
 * Email Templates Index (Story 4.16)
 *
 * Central export for all email templates.
 */

// Base template
export {
  wrapInBaseTemplate,
  emailStyles,
  generatePlainTextFooter,
  type BaseTemplateVariables,
} from "./base";

// Renderer utilities
export {
  sanitizeHtml,
  buildRiskDetailUrl,
  buildUrlWithUTM,
  buildUnsubscribeUrl,
  formatSeverity,
  formatSeverityPlainText,
  formatStatus,
  formatImpactScore,
  formatDate,
  formatCurrency,
  formatUrgency,
  daysSince,
  truncateText,
  generatePrimaryButton,
  generateSecondaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

// Risk Assigned Template (AC7-AC12)
export {
  renderRiskAssignedEmail,
  generateRiskAssignedSubject,
  type RiskAssignedVariables,
} from "./riskAssigned";

// Status Changed Template (AC13-AC18)
export {
  renderStatusChangedEmail,
  generateStatusChangedSubject,
  type StatusChangedVariables,
} from "./statusChanged";

// Decision Required Template (AC19-AC24)
export {
  renderDecisionRequiredEmail,
  generateDecisionRequiredSubject,
  type DecisionRequiredVariables,
  type RemediationOptionSummary,
} from "./decisionRequired";

// Evidence Request Template (AC25-AC30)
export {
  renderEvidenceRequestEmail,
  generateEvidenceRequestSubject,
  type EvidenceRequestVariables,
} from "./evidenceRequest";

// Risk Closed Template (AC31-AC35)
export {
  renderRiskClosedEmail,
  generateRiskClosedSubject,
  type RiskClosedVariables,
} from "./riskClosed";

// Comment Added Template (AC36-AC40)
export {
  renderCommentAddedEmail,
  generateCommentAddedSubject,
  type CommentAddedVariables,
} from "./commentAdded";

// Story 16.8: SLA At-Risk Template (AC8)
export {
  renderSlaAtRiskEmail,
  generateSlaAtRiskSubject,
  type SlaAtRiskVariables,
} from "./slaAtRisk";

// Story 16.8: SLA Breached Template (AC9)
export {
  renderSlaBreachedEmail,
  generateSlaBreachedSubject,
  type SlaBreachedVariables,
} from "./slaBreached";

// Epic 8: TPRM Notifications

// FR61: Questionnaire Assigned Template
export {
  renderQuestionnaireAssignedEmail,
  generateQuestionnaireAssignedSubject,
  type QuestionnaireAssignedVariables,
} from "./questionnaireAssigned";

// FR62: Assessment Status Changed Template
export {
  renderAssessmentStatusChangedEmail,
  generateAssessmentStatusChangedSubject,
  type AssessmentStatusChangedVariables,
} from "./assessmentStatusChanged";

// FR63: Vendor Owner Assigned Template
export {
  renderVendorOwnerAssignedEmail,
  generateVendorOwnerAssignedSubject,
  type VendorOwnerAssignedVariables,
} from "./vendorOwnerAssigned";

// FR64: Questionnaire Response Submitted Template
export {
  renderQuestionnaireResponseEmail,
  generateQuestionnaireResponseSubject,
  type QuestionnaireResponseVariables,
} from "./questionnaireResponse";

// FR65: Review Due Reminder Template
export {
  renderReviewDueReminderEmail,
  generateReviewDueReminderSubject,
  type ReviewDueReminderVariables,
} from "./reviewDueReminder";

// FR65: Review Overdue Template
export {
  renderReviewOverdueEmail,
  generateReviewOverdueSubject,
  type ReviewOverdueVariables,
} from "./reviewOverdue";
