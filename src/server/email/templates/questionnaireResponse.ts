/**
 * Questionnaire Response Submitted Email Template (Epic 8, FR64)
 *
 * Sent when a vendor submits their questionnaire responses.
 * Notifies the assessment owner/assessor that the questionnaire is ready for review.
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
 * Variables for questionnaire response template
 */
export interface QuestionnaireResponseVariables {
  /** Recipient name (assessor/owner) */
  recipientName: string;
  /** Vendor name */
  vendorName: string;
  /** Questionnaire template name */
  questionnaireName: string;
  /** Assessment title */
  assessmentTitle: string;
  /** When the questionnaire was completed */
  completedAt: Date | string;
  /** Total questions answered */
  totalQuestionsAnswered: number;
  /** Total questions in questionnaire */
  totalQuestions: number;
  /** Vendor ID for link */
  vendorId: string;
  /** Assessment ID for link */
  assessmentId: string;
  /** Questionnaire ID for link */
  questionnaireId: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Count of pre-filled responses that were modified */
  modifiedPrefilledCount?: number;
}

/**
 * Build questionnaire review URL
 */
function buildQuestionnaireUrl(vendorId: string, assessmentId: string, questionnaireId: string): string {
  return buildUrlWithUTM(
    `/vendors/${vendorId}?tab=assessments&assessment=${assessmentId}&questionnaire=${questionnaireId}`,
    "questionnaire_response"
  );
}

/**
 * Generate the subject line
 */
export function generateQuestionnaireResponseSubject(
  vendorName: string,
  questionnaireName: string
): string {
  return `Questionnaire Submitted: ${questionnaireName} from ${vendorName}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: QuestionnaireResponseVariables): string {
  const {
    recipientName,
    vendorName,
    questionnaireName,
    assessmentTitle,
    completedAt,
    totalQuestionsAnswered,
    totalQuestions,
    vendorId,
    assessmentId,
    questionnaireId,
    modifiedPrefilledCount,
  } = variables;

  const questionnaireUrl = buildQuestionnaireUrl(vendorId, assessmentId, questionnaireId);
  const completionRate = Math.round((totalQuestionsAnswered / totalQuestions) * 100);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(recipientName)},
    </p>

    <p style="${emailStyles.paragraph}">
      <strong>${sanitizeHtml(vendorName)}</strong> has submitted their responses to a security questionnaire.
      The questionnaire is now ready for your review.
    </p>

    ${generateCallout(`
      <strong style="color: #059669;">Questionnaire Completed</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        The vendor has successfully submitted their responses. Please review the answers and update the assessment accordingly.
      </p>
    `, "success")}

    <h2 style="${emailStyles.h2}">${sanitizeHtml(questionnaireName)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Vendor", vendorName)}
      ${generateInfoRow("Assessment", assessmentTitle)}
      ${generateInfoRow("Submitted At", formatDate(completedAt))}
    </table>

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Completion Summary</strong>
      <div style="display: flex; align-items: center; margin-top: 12px;">
        <div style="flex: 1;">
          <div style="height: 8px; background-color: #E5E7EB; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${completionRate}%; background-color: #10B981;"></div>
          </div>
        </div>
        <span style="margin-left: 12px; font-weight: 600; color: #374151;">${totalQuestionsAnswered}/${totalQuestions}</span>
      </div>
      <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 14px;">
        ${completionRate}% of questions answered
      </p>
    </div>

    ${modifiedPrefilledCount && modifiedPrefilledCount > 0 ? `
    <div style="background-color: #FEF3C7; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #F59E0B;">
      <strong style="color: #B45309;">Pre-filled Responses Modified</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        The vendor modified ${modifiedPrefilledCount} response${modifiedPrefilledCount !== 1 ? "s" : ""} that ${modifiedPrefilledCount !== 1 ? "were" : "was"} pre-filled from their previous submission.
        You may want to review these changes.
      </p>
    </div>
    ` : ""}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Review Responses", questionnaireUrl)}
    </div>

    <p style="${emailStyles.paragraph}; margin-top: 24px; font-size: 14px; color: #6B7280;">
      After reviewing the responses, you can incorporate the findings into the vendor assessment.
    </p>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: QuestionnaireResponseVariables): string {
  const {
    recipientName,
    vendorName,
    questionnaireName,
    assessmentTitle,
    completedAt,
    totalQuestionsAnswered,
    totalQuestions,
    vendorId,
    assessmentId,
    questionnaireId,
    organizationName,
    modifiedPrefilledCount,
  } = variables;

  const questionnaireUrl = buildQuestionnaireUrl(vendorId, assessmentId, questionnaireId);
  const unsubscribeUrl = buildUnsubscribeUrl();
  const completionRate = Math.round((totalQuestionsAnswered / totalQuestions) * 100);

  return `
Hello ${recipientName},

${vendorName} has submitted their responses to a security questionnaire.
The questionnaire is now ready for your review.

QUESTIONNAIRE COMPLETED
The vendor has successfully submitted their responses. Please review the answers and update the assessment accordingly.

QUESTIONNAIRE: ${questionnaireName}

DETAILS:
- Vendor: ${vendorName}
- Assessment: ${assessmentTitle}
- Submitted At: ${formatDate(completedAt)}

COMPLETION SUMMARY:
${totalQuestionsAnswered}/${totalQuestions} questions answered (${completionRate}%)

${modifiedPrefilledCount && modifiedPrefilledCount > 0 ? `
PRE-FILLED RESPONSES MODIFIED:
The vendor modified ${modifiedPrefilledCount} response${modifiedPrefilledCount !== 1 ? "s" : ""} that ${modifiedPrefilledCount !== 1 ? "were" : "was"} pre-filled from their previous submission.
You may want to review these changes.
` : ""}
REVIEW RESPONSES:
${questionnaireUrl}

After reviewing the responses, you can incorporate the findings into the vendor assessment.

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the questionnaire response email template
 */
export function renderQuestionnaireResponseEmail(
  variables: QuestionnaireResponseVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Questionnaire Response",
    "✅",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateQuestionnaireResponseSubject(
    variables.vendorName,
    variables.questionnaireName
  );

  return { html, text, subject };
}
