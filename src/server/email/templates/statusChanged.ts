/**
 * Status Change Email Template (Story 4.16)
 *
 * Sent when a risk status changes.
 *
 * AC13: Subject: "Risk Status Updated: [Risk Title] - Now [New Status]"
 * AC14: Body includes old/new status, changed by, reason
 * AC15: Primary CTA: "View Risk Details"
 * AC16: Status-specific messaging
 * AC17: Sent to risk participants
 * AC18: Plain text version available
 */

import type { RiskStatus } from "@prisma/client";
import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatStatus,
  formatImpactScore,
  formatDate,
  buildRiskDetailUrl,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for status change template
 */
export interface StatusChangedVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Old status */
  oldStatus: RiskStatus | string;
  /** New status */
  newStatus: RiskStatus | string;
  /** Name of person who changed the status */
  changedByName: string;
  /** Reason for status change (optional) */
  changeReason: string | null;
  /** Updated impact score */
  impactScore: number | null;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Get status-specific messaging
 * AC16: Status-specific messaging
 */
function getStatusMessage(status: RiskStatus | string): string {
  const messages: Record<string, string> = {
    OPEN: "This risk has been opened and requires attention.",
    ASSIGNED: "This risk has been assigned to owners for remediation planning.",
    REMEDIATED: "Remediation evidence has been uploaded and is pending verification by a GRC Analyst.",
    CLOSED: "This risk has been verified and closed. The remediation was successful.",
    ACCEPTED: "This risk has been accepted. The business has decided to accept the associated risk.",
  };

  return messages[status] || "The risk status has been updated.";
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: RiskStatus | string): string {
  const emojis: Record<string, string> = {
    OPEN: "🔴",
    ASSIGNED: "🔵",
    REMEDIATED: "🟡",
    CLOSED: "🟢",
    ACCEPTED: "⚪",
  };

  return emojis[status] || "📊";
}

/**
 * Generate the subject line
 * AC13: Subject format
 */
export function generateStatusChangedSubject(
  riskTitle: string,
  newStatus: RiskStatus | string
): string {
  return `📊 Risk Status Updated: ${riskTitle} - Now ${newStatus}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: StatusChangedVariables): string {
  const {
    riskId,
    riskTitle,
    oldStatus,
    newStatus,
    changedByName,
    changeReason,
    impactScore,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "status_changed");
  const statusMessage = getStatusMessage(newStatus);
  const newStatusEmoji = getStatusEmoji(newStatus);

  return `
    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
      <div style="margin-bottom: 12px;">
        ${formatStatus(String(oldStatus))}
        <span style="margin: 0 12px; color: #9CA3AF; font-size: 20px;">→</span>
        ${formatStatus(String(newStatus))}
      </div>
      <p style="margin: 0; font-size: 24px;">${newStatusEmoji}</p>
    </div>

    ${generateCallout(`
      <p style="margin: 0; color: #1F2937;">${statusMessage}</p>
    `, newStatus === "CLOSED" ? "success" : "info")}

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Changed By", changedByName)}
      ${generateInfoRow("Impact Score", formatImpactScore(impactScore), true)}
    </table>

    ${changeReason ? `
      <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
        <strong style="color: #92400E;">Change Reason</strong>
        <p style="margin: 8px 0 0 0; color: #1F2937;">${sanitizeHtml(changeReason)}</p>
      </div>
    ` : ""}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Risk Details", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC18: Plain text version
 */
function generatePlainTextContent(variables: StatusChangedVariables): string {
  const {
    riskId,
    riskTitle,
    oldStatus,
    newStatus,
    changedByName,
    changeReason,
    impactScore,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "status_changed");
  const statusMessage = getStatusMessage(newStatus);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
RISK STATUS UPDATED: ${riskTitle}

STATUS CHANGE:
${oldStatus} → ${newStatus}

${statusMessage}

DETAILS:
- Changed By: ${changedByName}
- Impact Score: ${impactScore ?? 0}/100

${changeReason ? `CHANGE REASON:\n${changeReason}\n` : ""}

VIEW RISK DETAILS:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the status change email template
 */
export function renderStatusChangedEmail(variables: StatusChangedVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Risk Status Updated",
    "📊",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateStatusChangedSubject(variables.riskTitle, variables.newStatus);

  return { html, text, subject };
}
