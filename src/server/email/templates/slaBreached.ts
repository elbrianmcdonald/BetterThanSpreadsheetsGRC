/**
 * SLA Breached Email Template
 *
 * Story 16.8: Treatment SLA Display & Alerts
 *
 * Sent when a treatment SLA is breached (past due date).
 *
 * AC9: "Breached" notification sent when due date passes
 * AC10: Notifications go to risk owner and GRC Analyst
 */

import type { Severity as RiskSeverity } from "@prisma/client";
import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatSeverity,
  formatSeverityPlainText,
  formatDate,
  truncateText,
  buildRiskDetailUrl,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for SLA breached template
 */
export interface SlaBreachedVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: RiskSeverity | string;
  /** Treatment type */
  treatmentType: string;
  /** Due date that was missed */
  dueDate: Date | string;
  /** Number of days overdue */
  daysOverdue: number;
  /** Name of the recipient */
  recipientName: string;
  /** Role of the recipient (IT_OWNER, BUSINESS_OWNER, GRC_ANALYST) */
  recipientRole: string;
  /** Risk description/finding summary */
  description: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Generate the subject line
 * Urgent format for breached SLA
 */
export function generateSlaBreachedSubject(
  riskTitle: string,
  daysOverdue: number
): string {
  return `🚨 SLA BREACHED: ${riskTitle} (${daysOverdue} days overdue)`;
}

/**
 * Generate HTML content for SLA breached email
 */
function generateHtmlContent(variables: SlaBreachedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    treatmentType,
    dueDate,
    daysOverdue,
    description,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "sla_breached");
  const truncatedDescription = truncateText(description, 200);
  const treatmentLabel = getTreatmentLabel(treatmentType);

  return `
    ${generateCallout(`
      <strong style="color: #DC2626;">SLA BREACHED</strong>
      <p style="margin: 8px 0 0 0; color: #7F1D1D;">
        The treatment SLA for this risk has been breached.
        The due date was <strong>${formatDate(dueDate)}</strong> and is now <strong>${daysOverdue} days overdue</strong>.
      </p>
    `, "error")}

    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Severity", formatSeverity(severity), true)}
      ${generateInfoRow("Treatment Type", treatmentLabel)}
      ${generateInfoRow("Due Date", formatDate(dueDate))}
      ${generateInfoRow("Days Overdue", `<span style="color: #DC2626; font-weight: bold;">${daysOverdue} days</span>`, true)}
    </table>

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Risk Summary</strong>
      <p style="color: #4B5563; margin: 8px 0 0 0; line-height: 1.6;">${sanitizeHtml(truncatedDescription)}</p>
    </div>

    <p style="${emailStyles.paragraph}">
      <strong>Immediate action is required.</strong> Please address this risk treatment immediately or
      update the treatment plan with a revised due date and justification.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Address Risk Now", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: SlaBreachedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    treatmentType,
    dueDate,
    daysOverdue,
    description,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "sla_breached");
  const truncatedDescription = truncateText(description, 200);
  const unsubscribeUrl = buildUnsubscribeUrl();
  const treatmentLabel = getTreatmentLabel(treatmentType);

  return `
🚨 SLA BREACHED: ${riskTitle}

⚠️ URGENT: The treatment SLA for this risk has been breached.
Due Date: ${formatDate(dueDate)}
Days Overdue: ${daysOverdue} days

${formatSeverityPlainText(severity)}

DETAILS:
- Treatment Type: ${treatmentLabel}
- Due Date: ${formatDate(dueDate)}
- Days Overdue: ${daysOverdue}

RISK SUMMARY:
${truncatedDescription}

IMMEDIATE ACTION REQUIRED:
Please address this risk treatment immediately or update the treatment plan with a revised due date and justification.

ADDRESS RISK NOW:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Get human-readable treatment type label
 */
function getTreatmentLabel(treatmentType: string): string {
  const labels: Record<string, string> = {
    ACCEPT: "Accept Risk",
    REMEDIATE: "Remediate Risk",
    TRANSFER: "Transfer Risk",
    AVOID: "Avoid Risk",
  };
  return labels[treatmentType] ?? treatmentType;
}

/**
 * Render the SLA breached email template
 */
export function renderSlaBreachedEmail(variables: SlaBreachedVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "SLA Breached",
    "🚨",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateSlaBreachedSubject(variables.riskTitle, variables.daysOverdue);

  return { html, text, subject };
}
