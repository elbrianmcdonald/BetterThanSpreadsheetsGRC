/**
 * Vendor Owner Assigned Email Template (Epic 8, FR63)
 *
 * Sent when an IT Owner or Business Owner is assigned to a vendor.
 * Notifies the newly assigned owner about their responsibilities.
 */

import {
  wrapInBaseTemplate,
  type BaseTemplateVariables,
  emailStyles,
  generatePlainTextFooter,
} from "./base";
import {
  buildUrlWithUTM,
  buildUnsubscribeUrl,
  sanitizeHtml,
  generatePrimaryButton,
  generateInfoRow,
  generateCallout,
  type TemplateOutput,
} from "./renderer";

/**
 * Variables for vendor owner assigned template
 */
export interface VendorOwnerAssignedVariables {
  /** Recipient name (the newly assigned owner) */
  recipientName: string;
  /** Vendor name */
  vendorName: string;
  /** Vendor identifier (e.g., VND-2024-0001) */
  vendorIdentifier: string;
  /** Type of owner role assigned */
  ownerRole: "IT_OWNER" | "BUSINESS_OWNER";
  /** Name of person who made the assignment */
  assignedByName: string;
  /** Vendor ID for link */
  vendorId: string;
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Vendor category */
  vendorCategory?: string;
  /** Active assessment count */
  activeAssessmentCount?: number;
  /** Open finding count */
  openFindingCount?: number;
}

/**
 * Get role-specific messaging
 */
function getRoleMessaging(role: "IT_OWNER" | "BUSINESS_OWNER"): {
  roleTitle: string;
  roleDescription: string;
  responsibilities: string[];
} {
  if (role === "IT_OWNER") {
    return {
      roleTitle: "IT Owner",
      roleDescription: "As the IT Owner, you are responsible for the technical oversight of this vendor relationship.",
      responsibilities: [
        "Review and monitor vendor security assessments",
        "Evaluate technical findings and remediation plans",
        "Ensure vendor meets technical compliance requirements",
        "Coordinate with the vendor on security-related matters",
      ],
    };
  }
  return {
    roleTitle: "Business Owner",
    roleDescription: "As the Business Owner, you are responsible for the business relationship and risk decisions for this vendor.",
    responsibilities: [
      "Approve vendor risk acceptance decisions",
      "Make business decisions on vendor engagement",
      "Review assessment findings from a business perspective",
      "Ensure vendor meets contractual obligations",
    ],
  };
}

/**
 * Build vendor detail URL
 */
function buildVendorUrl(vendorId: string): string {
  return buildUrlWithUTM(`/vendors/${vendorId}`, "vendor_owner_assigned");
}

/**
 * Generate the subject line
 */
export function generateVendorOwnerAssignedSubject(
  vendorName: string,
  ownerRole: "IT_OWNER" | "BUSINESS_OWNER"
): string {
  const roleTitle = ownerRole === "IT_OWNER" ? "IT Owner" : "Business Owner";
  return `You've been assigned as ${roleTitle} for ${vendorName}`;
}

/**
 * Generate HTML content
 */
function generateHtmlContent(variables: VendorOwnerAssignedVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    ownerRole,
    assignedByName,
    vendorId,
    vendorCategory,
    activeAssessmentCount,
    openFindingCount,
  } = variables;

  const roleMessaging = getRoleMessaging(ownerRole);
  const vendorUrl = buildVendorUrl(vendorId);

  return `
    <p style="${emailStyles.paragraph}">
      Hello ${sanitizeHtml(recipientName)},
    </p>

    <p style="${emailStyles.paragraph}">
      You have been assigned as the <strong>${roleMessaging.roleTitle}</strong> for the following vendor.
    </p>

    <h2 style="${emailStyles.h2}">${sanitizeHtml(vendorName)}</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      ${generateInfoRow("Identifier", vendorIdentifier)}
      ${vendorCategory ? generateInfoRow("Category", vendorCategory) : ""}
      ${generateInfoRow("Assigned By", assignedByName)}
      ${generateInfoRow("Your Role", roleMessaging.roleTitle)}
    </table>

    ${generateCallout(`
      <strong style="color: #1E40AF;">${roleMessaging.roleTitle} Responsibilities</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">${roleMessaging.roleDescription}</p>
    `, "info")}

    <div style="background-color: #F9FAFB; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <strong style="color: #374151;">Your Key Responsibilities:</strong>
      <ul style="color: #4B5563; margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8;">
        ${roleMessaging.responsibilities.map(r => `<li>${r}</li>`).join("\n        ")}
      </ul>
    </div>

    ${(activeAssessmentCount !== undefined && activeAssessmentCount > 0) || (openFindingCount !== undefined && openFindingCount > 0) ? `
    <div style="background-color: #FFFBEB; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #F59E0B;">
      <strong style="color: #B45309;">Attention Required</strong>
      <p style="margin: 8px 0 0 0; color: #1F2937;">
        This vendor has:
        ${activeAssessmentCount && activeAssessmentCount > 0 ? `<br>• ${activeAssessmentCount} active assessment${activeAssessmentCount !== 1 ? "s" : ""}` : ""}
        ${openFindingCount && openFindingCount > 0 ? `<br>• ${openFindingCount} open finding${openFindingCount !== 1 ? "s" : ""} requiring attention` : ""}
      </p>
    </div>
    ` : ""}

    <div style="text-align: center; margin-top: 24px;">
      ${generatePrimaryButton("View Vendor Details", vendorUrl)}
    </div>
  `;
}

/**
 * Generate plain text content
 */
function generatePlainTextContent(variables: VendorOwnerAssignedVariables): string {
  const {
    recipientName,
    vendorName,
    vendorIdentifier,
    ownerRole,
    assignedByName,
    vendorId,
    organizationName,
    vendorCategory,
    activeAssessmentCount,
    openFindingCount,
  } = variables;

  const roleMessaging = getRoleMessaging(ownerRole);
  const vendorUrl = buildVendorUrl(vendorId);
  const unsubscribeUrl = buildUnsubscribeUrl();

  return `
Hello ${recipientName},

You have been assigned as the ${roleMessaging.roleTitle} for the following vendor.

VENDOR: ${vendorName}

DETAILS:
- Identifier: ${vendorIdentifier}
${vendorCategory ? `- Category: ${vendorCategory}\n` : ""}- Assigned By: ${assignedByName}
- Your Role: ${roleMessaging.roleTitle}

${roleMessaging.roleDescription}

YOUR KEY RESPONSIBILITIES:
${roleMessaging.responsibilities.map(r => `• ${r}`).join("\n")}

${(activeAssessmentCount && activeAssessmentCount > 0) || (openFindingCount && openFindingCount > 0) ? `
ATTENTION REQUIRED:
This vendor has:
${activeAssessmentCount && activeAssessmentCount > 0 ? `• ${activeAssessmentCount} active assessment${activeAssessmentCount !== 1 ? "s" : ""}\n` : ""}${openFindingCount && openFindingCount > 0 ? `• ${openFindingCount} open finding${openFindingCount !== 1 ? "s" : ""} requiring attention\n` : ""}` : ""}
VIEW VENDOR DETAILS:
${vendorUrl}

${generatePlainTextFooter(organizationName, unsubscribeUrl)}
  `.trim();
}

/**
 * Render the vendor owner assigned email template
 */
export function renderVendorOwnerAssignedEmail(
  variables: VendorOwnerAssignedVariables
): TemplateOutput {
  const baseVariables: BaseTemplateVariables = {
    organizationName: variables.organizationName,
    organizationLogoUrl: variables.organizationLogoUrl,
    unsubscribeUrl: buildUnsubscribeUrl(),
  };

  const htmlContent = generateHtmlContent(variables);
  const html = wrapInBaseTemplate(
    htmlContent,
    "Vendor Assignment",
    "👤",
    baseVariables
  );

  const text = generatePlainTextContent(variables);
  const subject = generateVendorOwnerAssignedSubject(
    variables.vendorName,
    variables.ownerRole
  );

  return { html, text, subject };
}
