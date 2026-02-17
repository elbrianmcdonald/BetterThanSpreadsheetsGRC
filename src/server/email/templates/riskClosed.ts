/**
 * Risk Closed Email Template (Story 4.16)
 *
 * Sent when a risk is verified and closed.
 *
 * AC31: Subject: "Risk Closed: [Risk Title]"
 * AC32: Body includes closure details, velocity metric
 * AC33: Primary CTA: "View Final Risk Report"
 * AC34: Sent to risk participants
 * AC35: Plain text version available
 */

import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatDate,
  formatSeverity,
  formatSeverityPlainText,
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
 * Variables for risk closed template
 */
export interface RiskClosedVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: string;
  /** Name of GRC Analyst who closed the risk */
  closedByName: string;
  /** Date the risk was closed */
  closureDate: Date | string;
  /** Date the risk was created */
  createdDate: Date | string;
  /** Final status (CLOSED or ACCEPTED) */
  finalStatus: "CLOSED" | "ACCEPTED";
  /** Remediation summary (what was done) */
  remediationSummary: string | null;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Calculate days to close
 * AC32: Days to close (velocity metric)
 */
function calculateDaysToClose(createdDate: Date | string, closureDate: Date | string): number {
  const created = typeof createdDate === "string" ? new Date(createdDate) : createdDate;
  const closed = typeof closureDate === "string" ? new Date(closureDate) : closureDate;
  const diffTime = Math.abs(closed.getTime() - created.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generate the subject line
 * AC31: Subject format
 */
export function generateRiskClosedSubject(riskTitle: string): string {
  return `✅ Risk Closed: ${riskTitle}`;
}

/**
 * Get closing message based on status
 */
function getClosingMessage(status: "CLOSED" | "ACCEPTED"): string {
  if (status === "ACCEPTED") {
    return "This risk has been formally accepted by the business. The decision has been documented and the risk will be monitored.";
  }
  return "This risk has been successfully remediated and verified. The vulnerability has been addressed and closed.";
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: RiskClosedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    closedByName,
    closureDate,
    createdDate,
    finalStatus,
    remediationSummary,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "risk_closed");
  const daysToClose = calculateDaysToClose(createdDate, closureDate);
  const closingMessage = getClosingMessage(finalStatus);
  const truncatedSummary = truncateText(remediationSummary, 300);

  return `
    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <!-- Success Banner -->
    <div style="background-color: #ECFDF5; padding: 24px; border-radius: 8px; margin: 16px 0; text-align: center; border: 2px solid #A7F3D0;">
      <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
      <p style="margin: 0; color: #065F46; font-size: 18px; font-weight: 600;">Risk ${finalStatus === "ACCEPTED" ? "Accepted" : "Closed"}</p>
      <p style="margin: 8px 0 0 0; color: #047857; font-size: 14px;">${closingMessage}</p>
    </div>

    <!-- Velocity Metric - AC32 -->
    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">Time to Resolution</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1F2937;">${daysToClose} days</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Severity", formatSeverity(severity), true)}
      ${generateInfoRow("Closed By", closedByName)}
      ${generateInfoRow("Closure Date", formatDate(closureDate))}
      ${generateInfoRow("Final Status", finalStatus)}
    </table>

    ${remediationSummary ? `
      <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #374151;">Remediation Summary</strong>
        <p style="color: #4B5563; margin: 8px 0 0 0; line-height: 1.6;">${sanitizeHtml(truncatedSummary)}</p>
      </div>
    ` : ""}

    ${generateCallout(`
      <p style="margin: 0; color: #1F2937;">This risk has been resolved. You can view the complete history and all associated evidence in the final report.</p>
    `, "success")}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Final Risk Report", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC35: Plain text version
 */
function generatePlainTextContent(variables: RiskClosedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    closedByName,
    closureDate,
    createdDate,
    finalStatus,
    remediationSummary,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "risk_closed");
  const daysToClose = calculateDaysToClose(createdDate, closureDate);
  const closingMessage = getClosingMessage(finalStatus);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
RISK CLOSED: ${riskTitle}

${closingMessage}

TIME TO RESOLUTION: ${daysToClose} days

DETAILS:
- Severity: ${formatSeverityPlainText(severity)}
- Closed By: ${closedByName}
- Closure Date: ${formatDate(closureDate)}
- Final Status: ${finalStatus}

${remediationSummary ? `REMEDIATION SUMMARY:\n${truncateText(remediationSummary, 300)}\n` : ""}

VIEW FINAL RISK REPORT:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the risk closed email template
 */
export function renderRiskClosedEmail(variables: RiskClosedVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Risk Closed",
    "✅",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateRiskClosedSubject(variables.riskTitle);

  return { html, text, subject };
}
