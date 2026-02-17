/**
 * Comment Added Email Template (Story 4.16)
 *
 * Sent when a comment is added to a risk.
 *
 * AC36: Subject: "New Comment on Risk: [Risk Title]"
 * AC37: Body includes commenter, preview, timestamp
 * AC38: Primary CTA: "View Conversation"
 * AC39: Sent to risk participants
 * AC40: Plain text version available
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
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for comment added template
 */
export interface CommentAddedVariables {
  /** Risk ID */
  riskId: string;
  /** Risk title */
  riskTitle: string;
  /** Risk severity */
  severity: string;
  /** Name of person who added the comment */
  commenterName: string;
  /** Comment text preview */
  commentText: string;
  /** Timestamp when comment was added */
  commentedAt: Date | string;
  /** Total comment count on the risk */
  totalComments: number;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Generate the subject line
 * AC36: Subject format
 */
export function generateCommentAddedSubject(riskTitle: string): string {
  return `💬 New Comment on Risk: ${riskTitle}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: CommentAddedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    commenterName,
    commentText,
    commentedAt,
    totalComments,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "comment_added");
  const truncatedComment = truncateText(commentText, 500);

  return `
    <h2 style="${emailStyles.h2}">${sanitizeHtml(riskTitle)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Severity", formatSeverity(severity), true)}
      ${generateInfoRow("Total Comments", String(totalComments))}
    </table>

    <!-- Comment Preview - AC37 -->
    <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3B82F6;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="width: 40px; height: 40px; background-color: #3B82F6; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px; color: white; font-weight: 600; margin-right: 12px;">
          ${commenterName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p style="margin: 0; font-weight: 600; color: #1F2937;">${sanitizeHtml(commenterName)}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #6B7280;">${formatDate(commentedAt)}</p>
        </div>
      </div>
      <div style="background-color: white; padding: 16px; border-radius: 6px; margin-top: 12px;">
        <p style="margin: 0; color: #374151; line-height: 1.6; white-space: pre-wrap;">${sanitizeHtml(truncatedComment)}</p>
      </div>
    </div>

    <p style="${emailStyles.paragraph}">
      View the full conversation and add your response by clicking below.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Conversation", riskDetailUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC40: Plain text version
 */
function generatePlainTextContent(variables: CommentAddedVariables): string {
  const {
    riskId,
    riskTitle,
    severity,
    commenterName,
    commentText,
    commentedAt,
    totalComments,
    organizationName,
  } = variables;

  const riskDetailUrl = buildRiskDetailUrl(riskId, "comment_added");
  const truncatedComment = truncateText(commentText, 500);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
NEW COMMENT ON RISK: ${riskTitle}

SEVERITY: ${formatSeverityPlainText(severity)}
TOTAL COMMENTS: ${totalComments}

COMMENT FROM ${commenterName.toUpperCase()}
${formatDate(commentedAt)}

"${truncatedComment}"

VIEW CONVERSATION:
${riskDetailUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the comment added email template
 */
export function renderCommentAddedEmail(variables: CommentAddedVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "New Comment",
    "💬",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateCommentAddedSubject(variables.riskTitle);

  return { html, text, subject };
}
