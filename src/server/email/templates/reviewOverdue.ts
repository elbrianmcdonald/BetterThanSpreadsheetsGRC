/**
 * Review Overdue Email Template (Epic 8, FR65)
 *
 * Sent when a vendor's next review date has passed.
 * Critical notification to IT Owner and Business Owner about compliance risk.
 */

import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatDate,
  daysSince,
  buildUrlWithUTM,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateSecondaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for review overdue template
 */
export interface ReviewOverdueVariables {
  /** Recipient name */
  recipientName: string;
  /** Vendor name */
  vendorName: string;
  /** Vendor identifier (e.g., VND-2024-0001) */
  vendorIdentifier: string;
  /** Next review date that has passed */
  nextReviewDate: Date | string;
  /** Days overdue */
  daysOverdue: number;
  /** Vendor ID for link */
  vendorId: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Vendor category */
  vendorCategory?: string;
  /** Last assessment date */
  lastAssessmentDate?: Date | string | null;
  /** Risk tier of the vendor */
  riskTier?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /** Whether this is the first overdue notification or a follow-up */
  isFollowUp?: boolean;
}

/**
 * Get severity color based on days overdue and risk tier
 */
function getOverdueSeverityColor(days: number, riskTier?: string): { color: string; bgColor: string } {
  // Critical/High tier vendors get more urgent coloring
  if (riskTier === "CRITICAL" || riskTier === "HIGH") {
    return { color: "#DC2626", bgColor: "#FEE2E2" };
  }
  if (days >= 30) return { color: "#DC2626", bgColor: "#FEE2E2" };
  if (days >= 14) return { color: "#EA580C", bgColor: "#FFEDD5" };
  return { color: "#F59E0B", bgColor: "#FEF3C7" };
}

/**
 * Get risk tier display
 */
function formatRiskTier(tier: string | undefined): string {
  if (!tier) return "";
  const colors: Record<string, { bg: string; text: string }> = {
    CRITICAL: { bg: "#DC2626", text: "#FFFFFF" },
    HIGH: { bg: "#EF4444", text: "#FFFFFF" },
    MEDIUM: { bg: "#F59E0B", text: "#FFFFFF" },
    LOW: { bg: "#3B82F6", text: "#FFFFFF" },
  };
  const c = colors[tier] || { bg: "#6B7280", text: "#FFFFFF" };
  return `<span style="background-color: ${c.bg}; color: ${c.text}; padding: 4px 12px; border-radius: 4px; font-weight: 500; font-size: 12px;">${tier}</span>`;
}

/**
 * Build vendor detail URL
 */
function buildVendorUrl(vendorId: string): string {
  return buildUrlWithUTM(`/vendors/${vendorId}`, "review_overdue");
}

/**
 * Build create assessment URL
 */
function buildCreateAssessmentUrl(vendorId: string): string {
  return buildUrlWithUTM(`/vendors/${vendorId}?action=new-assessment`, "review_overdue");
}

/**
 * Generate the subject line
 */
export function generateReviewOverdueSubject(
  vendorName: string,
  daysOverdue: number,
  riskTier?: string
): string {
  const prefix = riskTier === "CRITICAL" || riskTier === "HIGH" ? "🚨 CRITICAL: " : "⚠️ ";
  return `${prefix}Vendor Review Overdue by ${daysOverdue} Days - ${vendorName}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: ReviewOverdueVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    nextReviewDate,
    daysOverdue,
    vendorId,
    vendorCategory,
    lastAssessmentDate,
    riskTier,
    isFollowUp,
  } = variables;

  const severityColors = getOverdueSeverityColor(daysOverdue, riskTier);
  const vendorUrl = buildVendorUrl(vendorId);
  const createAssessmentUrl = buildCreateAssessmentUrl(vendorId);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(recipientName)},
    </p>

    ${isFollowUp ? `
    <p style="${emailStyles.paragraph}; color: #DC2626; font-weight: 600;">
      This is a follow-up reminder. The vendor review remains overdue.
    </p>
    ` : ""}

    ${generateCallout(`
      <strong style="color: #DC2626;">⚠️ Compliance Risk Alert</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        A scheduled vendor review is overdue. This may pose compliance and security risks.
        Immediate action is recommended.
      </p>
    `, "error")}

    <div style="background-color: ${severityColors.bgColor}; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
      <div style="font-size: 48px; font-weight: 700; color: ${severityColors.color};">${daysOverdue}</div>
      <div style="font-size: 14px; color: ${severityColors.color}; font-weight: 600;">DAYS OVERDUE</div>
    </div>

    <h2 style="${emailStyles.h2}">${sanitizeHtml(vendorName)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Identifier", vendorIdentifier)}
      ${vendorCategory ? generateInfoRow("Category", vendorCategory) : ""}
      ${riskTier ? generateInfoRow("Risk Tier", formatRiskTier(riskTier), true) : ""}
      ${generateInfoRow("Review Was Due", formatDate(nextReviewDate))}
      ${lastAssessmentDate ? generateInfoRow("Last Assessment", formatDate(lastAssessmentDate)) : ""}
    </table>

    ${(riskTier === "CRITICAL" || riskTier === "HIGH") ? `
    <div style="background-color: #FEF2F2; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #DC2626;">
      <strong style="color: #DC2626;">High-Risk Vendor</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        This vendor is classified as ${riskTier?.toLowerCase() || "high"} risk.
        Delays in reviewing high-risk vendors may result in increased exposure to security incidents
        and regulatory non-compliance.
      </p>
    </div>
    ` : ""}

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Recommended Actions:</strong>
      <ul style="color: #4B5563; margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8;">
        <li>Start a new vendor assessment immediately</li>
        <li>Review any recent security incidents or changes with the vendor</li>
        <li>Update the vendor's risk profile based on current information</li>
        <li>Document any reasons for delay in completing the review</li>
      </ul>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Start Assessment Now", createAssessmentUrl)}
    </div>
    <div style="text-align: center; margin-top: 12px;">
      ${generateSecondaryButton("View Vendor Details", vendorUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: ReviewOverdueVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    nextReviewDate,
    daysOverdue,
    vendorId,
    organizationName,
    vendorCategory,
    lastAssessmentDate,
    riskTier,
    isFollowUp,
  } = variables;

  const vendorUrl = buildVendorUrl(vendorId);
  const createAssessmentUrl = buildCreateAssessmentUrl(vendorId);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
Hello ${recipientName},

${isFollowUp ? "*** THIS IS A FOLLOW-UP REMINDER. THE VENDOR REVIEW REMAINS OVERDUE. ***\n\n" : ""}*** COMPLIANCE RISK ALERT ***
A scheduled vendor review is overdue. This may pose compliance and security risks.
Immediate action is recommended.

*** ${daysOverdue} DAYS OVERDUE ***

VENDOR: ${vendorName}

DETAILS:
- Identifier: ${vendorIdentifier}
${vendorCategory ? `- Category: ${vendorCategory}\n` : ""}${riskTier ? `- Risk Tier: ${riskTier}\n` : ""}- Review Was Due: ${formatDate(nextReviewDate)}
${lastAssessmentDate ? `- Last Assessment: ${formatDate(lastAssessmentDate)}\n` : ""}
${(riskTier === "CRITICAL" || riskTier === "HIGH") ? `
HIGH-RISK VENDOR:
This vendor is classified as ${riskTier?.toLowerCase() || "high"} risk.
Delays in reviewing high-risk vendors may result in increased exposure to security incidents
and regulatory non-compliance.
` : ""}
RECOMMENDED ACTIONS:
- Start a new vendor assessment immediately
- Review any recent security incidents or changes with the vendor
- Update the vendor's risk profile based on current information
- Document any reasons for delay in completing the review

START ASSESSMENT NOW:
${createAssessmentUrl}

VIEW VENDOR DETAILS:
${vendorUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the review overdue email template
 */
export function renderReviewOverdueEmail(
  variables: ReviewOverdueVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Vendor Review Overdue",
    "🚨",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateReviewOverdueSubject(
    variables.vendorName,
    variables.daysOverdue,
    variables.riskTier
  );

  return { html, text, subject };
}
