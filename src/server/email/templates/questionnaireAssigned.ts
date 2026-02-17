/**
 * Questionnaire Assigned Email Template (Epic 8, FR61)
 *
 * Sent when a questionnaire is assigned to a vendor contact.
 * This is the external email sent to vendors via their portal access link.
 */

import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  formatDate,
  truncateText,
  buildUrlWithUTM,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for questionnaire assigned template
 */
export interface QuestionnaireAssignedVariables {
  /** Vendor name */
  vendorName: string;
  /** Vendor contact name (recipient) */
  contactName: string;
  /** Questionnaire template name */
  questionnaireName: string;
  /** Questionnaire description */
  questionnaireDescription: string | null;
  /** Due date for completion */
  dueDate: Date | string | null;
  /** Organization requesting the questionnaire */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Portal access token URL */
  portalAccessUrl: string;
  /** Assessment title/name */
  assessmentTitle: string | null;
}

/**
 * Build portal access URL with UTM parameters
 */
function buildPortalUrl(portalAccessUrl: string): string {
  // Portal URL already includes the token, just add UTM params
  try {
    const url = new URL(portalAccessUrl);
    url.searchParams.set("utm_source", "email");
    url.searchParams.set("utm_medium", "notification");
    url.searchParams.set("utm_campaign", "questionnaire_assigned");
    return url.toString();
  } catch {
    return portalAccessUrl;
  }
}

/**
 * Generate the subject line
 */
export function generateQuestionnaireAssignedSubject(
  questionnaireName: string,
  organizationName: string
): string {
  return `Action Required: ${questionnaireName} from ${organizationName}`;
}

/**
 * Generate HTML content for questionnaire assigned email
 */
function generateHtmlContent(variables: QuestionnaireAssignedVariables): string {
  const {
    vendorName,
    contactName,
    questionnaireName,
    questionnaireDescription,
    dueDate,
    organizationName,
    portalAccessUrl,
    assessmentTitle,
  } = variables;

  const portalUrl = buildPortalUrl(portalAccessUrl);
  const truncatedDescription = truncateText(questionnaireDescription, 300);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(contactName)},
    </p>

    <p style="${emailStyles.paragraph}">
      ${sanitizeHtml(organizationName)} has requested that <strong>${sanitizeHtml(vendorName)}</strong>
      complete a security questionnaire as part of their vendor risk assessment process.
    </p>

    <h2 style="${emailStyles.h2}">${sanitizeHtml(questionnaireName)}</h2>

    ${truncatedDescription ? `
    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="color: #4B5563; margin: 0; line-height: 1.6;">${sanitizeHtml(truncatedDescription)}</p>
    </div>
    ` : ""}

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Requested By", organizationName)}
      ${generateInfoRow("Vendor", vendorName)}
      ${assessmentTitle ? generateInfoRow("Assessment", assessmentTitle) : ""}
      ${dueDate ? generateInfoRow("Due Date", formatDate(dueDate)) : ""}
    </table>

    ${generateCallout(`
      <strong style="color: #1E40AF;">Secure Access Link</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        Click the button below to access the vendor portal and complete your questionnaire.
        No account or password is required - your access is secured via this unique link.
      </p>
    `, "info")}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Complete Questionnaire", portalUrl)}
    </div>

    <p style="${emailStyles.paragraph}; margin-top: 24px; font-size: 14px; color: #6B7280;">
      Your progress will be automatically saved as you fill out the questionnaire.
      You can close the page and return later using this same link.
    </p>

    ${dueDate ? `
    <p style="${emailStyles.paragraph}; font-size: 14px; color: #6B7280;">
      Please complete this questionnaire by <strong>${formatDate(dueDate)}</strong>.
    </p>
    ` : ""}
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: QuestionnaireAssignedVariables): string {
  const {
    vendorName,
    contactName,
    questionnaireName,
    questionnaireDescription,
    dueDate,
    organizationName,
    portalAccessUrl,
    assessmentTitle,
  } = variables;

  const portalUrl = buildPortalUrl(portalAccessUrl);
  const truncatedDescription = truncateText(questionnaireDescription, 300);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
Hello ${contactName},

${organizationName} has requested that ${vendorName} complete a security questionnaire as part of their vendor risk assessment process.

QUESTIONNAIRE: ${questionnaireName}
${truncatedDescription ? `\n${truncatedDescription}\n` : ""}
DETAILS:
- Requested By: ${organizationName}
- Vendor: ${vendorName}
${assessmentTitle ? `- Assessment: ${assessmentTitle}\n` : ""}${dueDate ? `- Due Date: ${formatDate(dueDate)}\n` : ""}
SECURE ACCESS LINK:
Click the link below to access the vendor portal and complete your questionnaire.
No account or password is required - your access is secured via this unique link.

${portalUrl}

Your progress will be automatically saved as you fill out the questionnaire.
You can close the page and return later using this same link.

${dueDate ? `Please complete this questionnaire by ${formatDate(dueDate)}.\n` : ""}
${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the questionnaire assigned email template
 */
export function renderQuestionnaireAssignedEmail(
  variables: QuestionnaireAssignedVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Questionnaire Request",
    "📋",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateQuestionnaireAssignedSubject(
    variables.questionnaireName,
    variables.organizationName
  );

  return { html, text, subject };
}
