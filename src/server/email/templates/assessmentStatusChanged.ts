/**
 * Assessment Status Changed Email Template (Epic 8, FR62)
 *
 * Sent when a vendor assessment status changes (e.g., IN_PROGRESS -> REVIEW).
 * Notifies the assessor and relevant stakeholders.
 */

import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatDate,
  buildUrlWithUTM,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Assessment status display labels
 */
const STATUS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { label: "Not Started", color: "#6B7280", bgColor: "#F3F4F6" },
  IN_PROGRESS: { label: "In Progress", color: "#1D4ED8", bgColor: "#DBEAFE" },
  REVIEW: { label: "Under Review", color: "#B45309", bgColor: "#FEF3C7" },
  COMPLETED: { label: "Completed", color: "#059669", bgColor: "#D1FAE5" },
  ON_HOLD: { label: "On Hold", color: "#7C3AED", bgColor: "#EDE9FE" },
};

/**
 * Variables for assessment status changed template
 */
export interface AssessmentStatusChangedVariables {
  /** Recipient name */
  recipientName: string;
  /** Vendor name */
  vendorName: string;
  /** Assessment title */
  assessmentTitle: string;
  /** Previous status */
  previousStatus: string;
  /** New status */
  newStatus: string;
  /** Name of person who changed status */
  changedByName: string;
  /** Assessment ID for link */
  assessmentId: string;
  /** Vendor ID for link */
  vendorId: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Optional notes about the status change */
  notes?: string;
}

/**
 * Format status badge HTML
 */
function formatStatusBadge(status: string): string {
  const config = STATUS_LABELS[status] || { label: status, color: "#6B7280", bgColor: "#F3F4F6" };
  return `<span style="background-color: ${config.bgColor}; color: ${config.color}; padding: 4px 12px; border-radius: 4px; font-weight: 500; font-size: 12px;">${config.label}</span>`;
}

/**
 * Format status for plain text
 */
function formatStatusPlainText(status: string): string {
  const config = STATUS_LABELS[status] || { label: status };
  return config.label;
}

/**
 * Build assessment detail URL
 */
function buildAssessmentUrl(vendorId: string, assessmentId: string): string {
  return buildUrlWithUTM(`/vendors/${vendorId}?tab=assessments&assessment=${assessmentId}`, "assessment_status_changed");
}

/**
 * Generate the subject line
 */
export function generateAssessmentStatusChangedSubject(
  assessmentTitle: string,
  newStatus: string
): string {
  const statusLabel = STATUS_LABELS[newStatus]?.label || newStatus;
  return `Assessment Update: ${assessmentTitle} is now ${statusLabel}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: AssessmentStatusChangedVariables): string {
  const {
    recipientName,
    vendorName,
    assessmentTitle,
    previousStatus,
    newStatus,
    changedByName,
    assessmentId,
    vendorId,
    notes,
  } = variables;

  const assessmentUrl = buildAssessmentUrl(vendorId, assessmentId);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(recipientName)},
    </p>

    <p style="${emailStyles.paragraph}">
      The status of a vendor assessment has been updated.
    </p>

    <h2 style="${emailStyles.h2}">${sanitizeHtml(assessmentTitle)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Vendor", vendorName)}
      ${generateInfoRow("Updated By", changedByName)}
    </table>

    <div style="background-color: #F9FAFB; padding: 20px; border-radius: 6px; margin: 16px 0; text-align: center;">
      <div style="margin-bottom: 8px;">
        ${formatStatusBadge(previousStatus)}
      </div>
      <div style="color: #6B7280; font-size: 20px; margin: 8px 0;">↓</div>
      <div>
        ${formatStatusBadge(newStatus)}
      </div>
    </div>

    ${notes ? `
    ${generateCallout(`
      <strong style="color: #374151;">Notes</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">${sanitizeHtml(notes)}</p>
    `, "info")}
    ` : ""}

    ${newStatus === "REVIEW" ? `
    ${generateCallout(`
      <strong style="color: #B45309;">Review Required</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        This assessment is ready for review. Please review the assessment findings and approve or request changes.
      </p>
    `, "warning")}
    ` : ""}

    ${newStatus === "COMPLETED" ? `
    ${generateCallout(`
      <strong style="color: #059669;">Assessment Completed</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        This assessment has been completed. You can now review the final findings and recommendations.
      </p>
    `, "success")}
    ` : ""}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Assessment", assessmentUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: AssessmentStatusChangedVariables): string {
  const {
    recipientName,
    vendorName,
    assessmentTitle,
    previousStatus,
    newStatus,
    changedByName,
    assessmentId,
    vendorId,
    organizationName,
    notes,
  } = variables;

  const assessmentUrl = buildAssessmentUrl(vendorId, assessmentId);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
Hello ${recipientName},

The status of a vendor assessment has been updated.

ASSESSMENT: ${assessmentTitle}

DETAILS:
- Vendor: ${vendorName}
- Updated By: ${changedByName}

STATUS CHANGE:
${formatStatusPlainText(previousStatus)} → ${formatStatusPlainText(newStatus)}

${notes ? `NOTES:\n${notes}\n` : ""}
${newStatus === "REVIEW" ? "REVIEW REQUIRED:\nThis assessment is ready for review. Please review the assessment findings and approve or request changes.\n" : ""}
${newStatus === "COMPLETED" ? "ASSESSMENT COMPLETED:\nThis assessment has been completed. You can now review the final findings and recommendations.\n" : ""}
VIEW ASSESSMENT:
${assessmentUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the assessment status changed email template
 */
export function renderAssessmentStatusChangedEmail(
  variables: AssessmentStatusChangedVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Assessment Status Update",
    "📊",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateAssessmentStatusChangedSubject(
    variables.assessmentTitle,
    variables.newStatus
  );

  return { html, text, subject };
}
