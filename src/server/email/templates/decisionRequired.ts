/**
 * Decision Required Email Template (Story 4.16)
 *
 * Sent to Business Owners when a decision is required.
 *
 * AC19: Subject: "Decision Required: [Risk Title] ([Impact Score]/100)"
 * AC20: Body includes business impact, remediation options
 * AC21: Primary CTA: "Review & Decide"
 * AC22: Highlights risk impact prominently
 * AC23: Sent to Business Owner only
 * AC24: Plain text version available
 */

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
  formatCurrency,
  formatUrgency,
  daysSince,
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
 * Remediation option summary
 */
export interface RemediationOptionSummary {
  title: string;
  estimatedCost: number | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Variables for decision required template
 */
export interface DecisionRequiredVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: string;
  /** Impact score (0-100) */
  impactScore: number | null;
  /** Business impact statement (preview) */
  businessImpactStatement: string | null;
  /** Remediation options summary */
  remediationOptions: RemediationOptionSummary[];
  /** Date the risk was assigned */
  assignedDate: Date | string | null;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Generate the subject line
 * AC19: Subject format
 */
export function generateDecisionRequiredSubject(
  riskTitle: string,
  impactScore: number | null
): string {
  return `⚠️ Decision Required: ${riskTitle} (${impactScore ?? 0}/100)`;
}

/**
 * Generate remediation options HTML
 */
function generateRemediationOptionsHtml(options: RemediationOptionSummary[]): string {
  if (options.length === 0) {
    return `
      <p style="color: #6B7280; font-style: italic;">No remediation options have been proposed yet.</p>
    `;
  }

  const optionRows = options.map((option, index) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
        <strong style="color: #1F2937;">${index + 1}. ${sanitizeHtml(option.title)}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">
        ${formatCurrency(option.estimatedCost)}
      </td>
    </tr>
  `).join("");

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #F9FAFB; border-radius: 6px;">
      <thead>
        <tr style="background-color: #E5E7EB;">
          <th style="padding: 12px; text-align: left; color: #374151; font-size: 14px;">Remediation Option</th>
          <th style="padding: 12px; text-align: right; color: #374151; font-size: 14px;">Est. Cost</th>
        </tr>
      </thead>
      <tbody>
        ${optionRows}
      </tbody>
    </table>
  `;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: DecisionRequiredVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    impactScore,
    businessImpactStatement,
    remediationOptions,
    assignedDate,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "decision_required");
  const daysPending = daysSince(assignedDate);
  const truncatedImpact = truncateText(businessImpactStatement, 300);

  return `
    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <!-- Impact Score Highlight - AC22 -->
    <div style="background-color: #FEF2F2; padding: 24px; border-radius: 8px; margin: 16px 0; text-align: center; border: 2px solid #FECACA;">
      <p style="margin: 0 0 8px 0; color: #991B1B; font-size: 14px; font-weight: 600;">IMPACT SCORE</p>
      <div style="font-size: 48px; font-weight: 700; color: #DC2626; line-height: 1;">
        ${impactScore ?? 0}<span style="font-size: 24px; color: #9CA3AF;">/100</span>
      </div>
      <p style="margin: 12px 0 0 0;">${formatSeverity(severity)}</p>
    </div>

    ${generateCallout(`
      <p style="margin: 0; color: #92400E; font-weight: 600;">Your decision is required</p>
      <p style="margin: 8px 0 0 0; color: #1F2937;">As the Business Owner, you need to review the remediation options and approve an approach.</p>
    `, "warning")}

    <!-- Urgency Indicator -->
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Time Pending", formatUrgency(daysPending), true)}
      ${generateInfoRow("Options Available", String(remediationOptions.length))}
    </table>

    <!-- Business Impact Statement -->
    ${businessImpactStatement ? `
      <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #374151;">Business Impact</strong>
        <p style="color: #4B5563; margin: 8px 0 0 0; line-height: 1.6;">${sanitizeHtml(truncatedImpact)}</p>
      </div>
    ` : ""}

    <!-- Remediation Options Summary -->
    <h3 style="color: #374151; font-size: 16px; margin: 24px 0 12px 0;">Remediation Options</h3>
    ${generateRemediationOptionsHtml(remediationOptions)}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Review & Decide", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC24: Plain text version
 */
function generatePlainTextContent(variables: DecisionRequiredVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    impactScore,
    businessImpactStatement,
    remediationOptions,
    assignedDate,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "decision_required");
  const daysPending = daysSince(assignedDate);
  const unsubscribeUrl = buildUnsubscribeUrl();

  const optionsList = remediationOptions.length > 0
    ? remediationOptions.map((opt, i) =>
        `  ${i + 1}. ${opt.title} - ${formatCurrency(opt.estimatedCost)}`
      ).join("\n")
    : "  No remediation options proposed yet.";

  return `
DECISION REQUIRED: ${riskTitle}

IMPACT SCORE: ${impactScore ?? 0}/100
SEVERITY: ${formatSeverityPlainText(severity)}

Your decision is required as the Business Owner.

TIME PENDING: ${daysPending} days
OPTIONS AVAILABLE: ${remediationOptions.length}

${businessImpactStatement ? `BUSINESS IMPACT:\n${truncateText(businessImpactStatement, 300)}\n` : ""}

REMEDIATION OPTIONS:
${optionsList}

REVIEW & DECIDE:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the decision required email template
 */
export function renderDecisionRequiredEmail(variables: DecisionRequiredVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Decision Required",
    "⚠️",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateDecisionRequiredSubject(variables.riskTitle, variables.impactScore);

  return { html, text, subject };
}
