/**
 * Risk Assignment Email Template (Story 4.16)
 *
 * Sent when a risk is assigned to an IT Owner or Business Owner.
 *
 * AC7: Subject: "Risk Assigned: [Risk Title] ([Severity])"
 * AC8: Body includes all required fields
 * AC9: Primary CTA: "View Risk Details"
 * AC10: Secondary information included
 * AC11: Differentiates IT Owner vs Business Owner messaging
 * AC12: Plain text version available
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
  formatImpactScore,
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
 * Variables for risk assignment template
 */
export interface RiskAssignedVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: RiskSeverity | string;
  /** Impact score (0-100) */
  impactScore: number | null;
  /** Name of person who assigned the risk */
  assignedByName: string;
  /** Role being assigned (IT Owner or Business Owner) */
  assignedRole: "IT_OWNER" | "BUSINESS_OWNER";
  /** Risk description/finding summary */
  description: string;
  /** Discovery date */
  discoveryDate: Date | string | null;
  /** Finding source */
  findingSource: string | null;
  /** Count of frameworks affected */
  frameworksAffectedCount: number;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Get role-specific messaging
 */
function getRoleMessaging(role: "IT_OWNER" | "BUSINESS_OWNER"): {
  roleTitle: string;
  roleDescription: string;
  actionText: string;
} {
  if (role === "IT_OWNER") {
    return {
      roleTitle: "IT Owner",
      roleDescription: "You are responsible for implementing the technical remediation for this risk.",
      actionText: "Please review the risk details and begin planning the remediation approach.",
    };
  }
  return {
    roleTitle: "Business Owner",
    roleDescription: "You are responsible for approving the remediation approach and making business decisions.",
    actionText: "Please review the risk details and remediation options to make an informed decision.",
  };
}

/**
 * Generate the subject line
 * AC7: Subject format
 */
export function generateRiskAssignedSubject(
  riskTitle: string,
  severity: RiskSeverity | string
): string {
  return `🔔 Risk Assigned: ${riskTitle} (${severity})`;
}

/**
 * Generate HTML content for risk assignment email
 */
function generateHtmlContent(variables: RiskAssignedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    impactScore,
    assignedByName,
    assignedRole,
    description,
    discoveryDate,
    findingSource,
    frameworksAffectedCount,
  } = variables;

  const roleMessaging = getRoleMessaging(assignedRole);
  const riskDetailUrl = buildRiskDetailUrl(riskId, "risk_assigned");
  const truncatedDescription = truncateText(description, 200);

  return `
    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Severity", formatSeverity(severity), true)}
      ${generateInfoRow("Impact Score", formatImpactScore(impactScore), true)}
      ${generateInfoRow("Assigned By", assignedByName)}
      ${generateInfoRow("Your Role", roleMessaging.roleTitle)}
    </table>

    ${generateCallout(`
      <strong style="color: #1E40AF;">Your Assignment</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">${roleMessaging.roleDescription}</p>
    `, "info")}

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Finding Summary</strong>
      <p style="color: #4B5563; margin: 8px 0 0 0; line-height: 1.6;">${sanitizeHtml(truncatedDescription)}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Discovery Date", formatDate(discoveryDate))}
      ${generateInfoRow("Finding Source", findingSource || "Not specified")}
      ${generateInfoRow("Frameworks Affected", String(frameworksAffectedCount))}
    </table>

    <p style="${emailStyles.paragraph}">${roleMessaging.actionText}</p>

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Risk Details", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC12: Plain text version
 */
function generatePlainTextContent(variables: RiskAssignedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    impactScore,
    assignedByName,
    assignedRole,
    description,
    discoveryDate,
    findingSource,
    frameworksAffectedCount,
    organizationName,
  } = variables;

  const roleMessaging = getRoleMessaging(assignedRole);
  const riskDetailUrl = buildRiskDetailUrl(riskId, "risk_assigned");
  const truncatedDescription = truncateText(description, 200);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
RISK ASSIGNED: ${riskTitle}

${formatSeverityPlainText(severity)} | Impact Score: ${impactScore ?? 0}/100

Your Role: ${roleMessaging.roleTitle}
${roleMessaging.roleDescription}

ASSIGNED BY: ${assignedByName}

FINDING SUMMARY:
${truncatedDescription}

DETAILS:
- Discovery Date: ${formatDate(discoveryDate)}
- Finding Source: ${findingSource || "Not specified"}
- Frameworks Affected: ${frameworksAffectedCount}

${roleMessaging.actionText}

VIEW RISK DETAILS:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the risk assignment email template
 */
export function renderRiskAssignedEmail(variables: RiskAssignedVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Risk Assigned",
    "🔔",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateRiskAssignedSubject(variables.riskTitle, variables.severity);

  return { html, text, subject };
}
