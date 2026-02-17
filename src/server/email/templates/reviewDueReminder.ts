/**
 * Review Due Reminder Email Template (Epic 8, FR65)
 *
 * Sent when a vendor's next review date is approaching (7 days before).
 * Notifies IT Owner and Business Owner to start planning the review.
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
  generateSecondaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for review due reminder template
 */
export interface ReviewDueReminderVariables {
  /** Recipient name */
  recipientName: string;
  /** Vendor name */
  vendorName: string;
  /** Vendor identifier (e.g., VND-2024-0001) */
  vendorIdentifier: string;
  /** Next review date */
  nextReviewDate: Date | string;
  /** Days until review is due */
  daysUntilDue: number;
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
  /** Recipient's role (IT Owner or Business Owner) */
  recipientRole?: "IT_OWNER" | "BUSINESS_OWNER";
  /** Risk tier of the vendor */
  riskTier?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Get urgency color based on days until due
 */
function getUrgencyColor(days: number): { color: string; bgColor: string } {
  if (days <= 3) return { color: "#DC2626", bgColor: "#FEE2E2" };
  if (days <= 7) return { color: "#F59E0B", bgColor: "#FEF3C7" };
  return { color: "#3B82F6", bgColor: "#DBEAFE" };
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
  return buildUrlWithUTM(`/vendors/${vendorId}`, "review_due_reminder");
}

/**
 * Build create assessment URL
 */
function buildCreateAssessmentUrl(vendorId: string): string {
  return buildUrlWithUTM(`/vendors/${vendorId}?action=new-assessment`, "review_due_reminder");
}

/**
 * Generate the subject line
 */
export function generateReviewDueReminderSubject(
  vendorName: string,
  daysUntilDue: number
): string {
  if (daysUntilDue <= 3) {
    return `Urgent: Vendor Review Due in ${daysUntilDue} Days - ${vendorName}`;
  }
  return `Reminder: Vendor Review Due in ${daysUntilDue} Days - ${vendorName}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: ReviewDueReminderVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    nextReviewDate,
    daysUntilDue,
    vendorId,
    vendorCategory,
    lastAssessmentDate,
    riskTier,
  } = variables;

  const urgencyColors = getUrgencyColor(daysUntilDue);
  const vendorUrl = buildVendorUrl(vendorId);
  const createAssessmentUrl = buildCreateAssessmentUrl(vendorId);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(recipientName)},
    </p>

    <p style="${emailStyles.paragraph}">
      This is a reminder that a scheduled vendor review is approaching.
    </p>

    <div style="background-color: ${urgencyColors.bgColor}; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
      <div style="font-size: 48px; font-weight: 700; color: ${urgencyColors.color};">${daysUntilDue}</div>
      <div style="font-size: 14px; color: ${urgencyColors.color}; font-weight: 600;">DAYS UNTIL REVIEW DUE</div>
    </div>

    <h2 style="${emailStyles.h2}">${sanitizeHtml(vendorName)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Identifier", vendorIdentifier)}
      ${vendorCategory ? generateInfoRow("Category", vendorCategory) : ""}
      ${riskTier ? generateInfoRow("Risk Tier", formatRiskTier(riskTier), true) : ""}
      ${generateInfoRow("Review Due Date", formatDate(nextReviewDate))}
      ${lastAssessmentDate ? generateInfoRow("Last Assessment", formatDate(lastAssessmentDate)) : ""}
    </table>

    ${generateCallout(`
      <strong style="color: #1E40AF;">Action Required</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        Please review the vendor's current status and determine if a new assessment is needed.
        Consider factors such as:
      </p>
      <ul style="margin: 8px 0 0 0; color: #4B5563; padding-left: 20px;">
        <li>Changes in the vendor's service delivery</li>
        <li>New security incidents or concerns</li>
        <li>Contract renewals or expansions</li>
        <li>Regulatory compliance requirements</li>
      </ul>
    `, "info")}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Vendor", vendorUrl)}
    </div>
    <div style="text-align: center; margin-top: 12px;">
      ${generateSecondaryButton("Start New Assessment", createAssessmentUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: ReviewDueReminderVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    nextReviewDate,
    daysUntilDue,
    vendorId,
    organizationName,
    vendorCategory,
    lastAssessmentDate,
    riskTier,
  } = variables;

  const vendorUrl = buildVendorUrl(vendorId);
  const createAssessmentUrl = buildCreateAssessmentUrl(vendorId);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
Hello ${recipientName},

This is a reminder that a scheduled vendor review is approaching.

*** ${daysUntilDue} DAYS UNTIL REVIEW DUE ***

VENDOR: ${vendorName}

DETAILS:
- Identifier: ${vendorIdentifier}
${vendorCategory ? `- Category: ${vendorCategory}\n` : ""}${riskTier ? `- Risk Tier: ${riskTier}\n` : ""}- Review Due Date: ${formatDate(nextReviewDate)}
${lastAssessmentDate ? `- Last Assessment: ${formatDate(lastAssessmentDate)}\n` : ""}
ACTION REQUIRED:
Please review the vendor's current status and determine if a new assessment is needed.
Consider factors such as:
- Changes in the vendor's service delivery
- New security incidents or concerns
- Contract renewals or expansions
- Regulatory compliance requirements

VIEW VENDOR:
${vendorUrl}

START NEW ASSESSMENT:
${createAssessmentUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the review due reminder email template
 */
export function renderReviewDueReminderEmail(
  variables: ReviewDueReminderVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Vendor Review Reminder",
    "📅",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateReviewDueReminderSubject(
    variables.vendorName,
    variables.daysUntilDue
  );

  return { html, text, subject };
}
