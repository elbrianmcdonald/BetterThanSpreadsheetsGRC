/**
 * Evidence Request Email Template (Story 4.16)
 *
 * Sent when a GRC Analyst requests evidence from a user.
 *
 * AC25: Subject: "Evidence Request: [Control Domain] for [Framework]"
 * AC26: Body includes requester, domain, framework, guidance
 * AC27: Primary CTA: "Upload Evidence"
 * AC28: Includes examples of acceptable evidence types
 * AC29: Sent to assigned user(s)
 * AC30: Plain text version available
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
 * Variables for evidence request template
 */
export interface EvidenceRequestVariables {
  /** Evidence request ID */
  requestId: string;
  /** Name of GRC Analyst requesting evidence */
  requestedByName: string;
  /** Control domain name */
  controlDomain: string;
  /** Framework name (e.g., "ISO 27001", "SOC 2") */
  frameworkName: string;
  /** Evidence guidance text */
  evidenceGuidance: string | null;
  /** Due date (optional) */
  dueDate: Date | string | null;
  /** Examples of acceptable evidence */
  evidenceExamples?: string[];
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
}

/**
 * Default evidence examples by domain
 */
const DEFAULT_EVIDENCE_EXAMPLES: Record<string, string[]> = {
  "Access Control": [
    "User access review reports",
    "Role-based access control (RBAC) documentation",
    "Privileged access management logs",
  ],
  "Authentication": [
    "Multi-factor authentication (MFA) configuration",
    "Password policy documentation",
    "Single sign-on (SSO) setup evidence",
  ],
  "Data Protection": [
    "Data classification policy",
    "Encryption configuration screenshots",
    "Data backup verification reports",
  ],
  "default": [
    "Policy documents",
    "Configuration screenshots",
    "Audit reports or logs",
    "Training completion records",
  ],
};

/**
 * Get evidence examples for a domain
 */
function getEvidenceExamples(domain: string, customExamples?: string[]): string[] {
  if (customExamples && customExamples.length > 0) {
    return customExamples;
  }
  return DEFAULT_EVIDENCE_EXAMPLES[domain] ?? DEFAULT_EVIDENCE_EXAMPLES["default"]!;
}

/**
 * Generate the subject line
 * AC25: Subject format
 */
export function generateEvidenceRequestSubject(
  controlDomain: string,
  frameworkName: string
): string {
  return `📋 Evidence Request: ${controlDomain} for ${frameworkName}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: EvidenceRequestVariables): string {
  const {
    requestId,
    requestedByName,
    controlDomain,
    frameworkName,
    evidenceGuidance,
    dueDate,
    evidenceExamples,
  } = variables;

  const uploadUrl = buildUrlWithUTM(`/evidence-requests/${requestId}`, "evidence_request");
  const examples = getEvidenceExamples(controlDomain, evidenceExamples);

  return `
    <h2 style="${emailStyles.h2}">Evidence Request</h2>

    <p style="${emailStyles.paragraph}">
      ${sanitizeHtml(requestedByName)} has requested evidence for compliance verification.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Control Domain", controlDomain)}
      ${generateInfoRow("Framework", frameworkName)}
      ${generateInfoRow("Requested By", requestedByName)}
      ${dueDate ? generateInfoRow("Due Date", formatDate(dueDate)) : ""}
    </table>

    ${evidenceGuidance ? `
      <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
        <strong style="color: #1E40AF;">Guidance</strong>
        <p style="margin: 8px 0 0 0; color: #1F2937;">${sanitizeHtml(evidenceGuidance)}</p>
      </div>
    ` : ""}

    <!-- Evidence Examples - AC28 -->
    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Acceptable Evidence Types</strong>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #4B5563;">
        ${examples.map(ex => `<li style="margin-bottom: 8px;">${sanitizeHtml(ex)}</li>`).join("")}
      </ul>
    </div>

    ${dueDate ? generateCallout(`
      <strong style="color: #92400E;">Due Date: ${formatDate(dueDate)}</strong>
      <p style="margin: 4px 0 0 0; color: #1F2937;">Please upload the requested evidence before the due date.</p>
    `, "warning") : ""}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("Upload Evidence", uploadUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 * AC30: Plain text version
 */
function generatePlainTextContent(variables: EvidenceRequestVariables): string {
  const {
    requestId,
    requestedByName,
    controlDomain,
    frameworkName,
    evidenceGuidance,
    dueDate,
    evidenceExamples,
    organizationName,
  } = variables;

  const uploadUrl = buildUrlWithUTM(`/evidence-requests/${requestId}`, "evidence_request");
  const examples = getEvidenceExamples(controlDomain, evidenceExamples);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
EVIDENCE REQUEST

${requestedByName} has requested evidence for compliance verification.

DETAILS:
- Control Domain: ${controlDomain}
- Framework: ${frameworkName}
- Requested By: ${requestedByName}
${dueDate ? `- Due Date: ${formatDate(dueDate)}` : ""}

${evidenceGuidance ? `GUIDANCE:\n${evidenceGuidance}\n` : ""}

ACCEPTABLE EVIDENCE TYPES:
${examples.map(ex => `  - ${ex}`).join("\n")}

${dueDate ? `IMPORTANT: Please upload the requested evidence before ${formatDate(dueDate)}.\n` : ""}

UPLOAD EVIDENCE:
${uploadUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the evidence request email template
 */
export function renderEvidenceRequestEmail(variables: EvidenceRequestVariables): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Evidence Request",
    "📋",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateEvidenceRequestSubject(variables.controlDomain, variables.frameworkName);

  return { html, text, subject };
}
