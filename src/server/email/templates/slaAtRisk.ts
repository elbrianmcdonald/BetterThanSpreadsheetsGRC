/**
 * SLA At-Risk Email Template
 *
 * Story 16.8: Treatment SLA Display & Alerts
 *
 * Sent when a treatment SLA is at risk (3 days or less remaining).
 *
 * AC8: "At Risk" notification sent when 3 days remaining
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
 * Variables for SLA at-risk template
 */
export interface SlaAtRiskVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: RiskSeverity | string;
  /** Treatment type */
  treatmentType: string;
  /** Due date */
  dueDate: Date | string;
  /** Number of days remaining */
  daysRemaining: number;
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
 * Warning format for at-risk SLA
 */
export function generateSlaAtRiskSubject(
  riskTitle: string,
  daysRemaining: number
): string {
  const urgency = daysRemaining <= 1 ? "URGENT" : "WARNING";
  const dayText = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;
  return `⚠️ ${urgency}: ${riskTitle} - SLA expires in ${dayText}`;
}

/**
 * Generate HTML content for SLA at-risk email
 */
function generateHtmlContent(variables: SlaAtRiskVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    treatmentType,
    dueDate,
    daysRemaining,
    description,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "sla_at_risk");
  const truncatedDescription = truncateText(description, 200);
  const treatmentLabel = getTreatmentLabel(treatmentType);
  const dayText = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

  return `
    ${generateCallout(`
      <strong style="color: #D97706;">SLA AT RISK</strong>
      <p style="margin: 8px 0 0 0; color: #92400E;">
        The treatment SLA for this risk expires in <strong>${dayText}</strong>.
        Due date: <strong>${formatDate(dueDate)}</strong>
      </p>
    `, "warning")}

    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Severity", formatSeverity(severity), true)}
      ${generateInfoRow("Treatment Type", treatmentLabel)}
      ${generateInfoRow("Due Date", formatDate(dueDate))}
      ${generateInfoRow("Time Remaining", `<span style="color: #D97706; font-weight: bold;">${dayText}</span>`, true)}
    </table>

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Risk Summary</strong>
      <p style="color: #4B5563; margin: 8px 0 0 0; line-height: 1.6;">${sanitizeHtml(truncatedDescription)}</p>
    </div>

    <p style="${emailStyles.paragraph}">
      Please take action soon to ensure this risk treatment is completed before the SLA expires.
      If you need more time, update the treatment plan with a revised timeline and justification.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Risk Details", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: SlaAtRiskVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    treatmentType,
    dueDate,
    daysRemaining,
    description,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "sla_at_risk");
  const truncatedDescription = truncateText(description, 200);
  const unsubscribeUrl = buildUnsubscribeUrl();
  const treatmentLabel = getTreatmentLabel(treatmentType);
  const dayText = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

  return `
⚠️ SLA AT RISK: ${riskTitle}

The treatment SLA for this risk expires in ${dayText}.
Due Date: ${formatDate(dueDate)}

${formatSeverityPlainText(severity)}

DETAILS:
- Treatment Type: ${treatmentLabel}
- Due Date: ${formatDate(dueDate)}
- Time Remaining: ${dayText}

RISK SUMMARY:
${truncatedDescription}

ACTION NEEDED:
Please take action soon to ensure this risk treatment is completed before the SLA expires.
If you need more time, update the treatment plan with a revised timeline and justification.

VIEW RISK DETAILS:
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
 * Render the SLA at-risk email template
 */
export function renderSlaAtRiskEmail(variables: SlaAtRiskVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "SLA At Risk",
    "⚠️",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateSlaAtRiskSubject(variables.riskTitle, variables.daysRemaining);

  return { html, text, subject };
}
