/**
 * Base Email Template (Story 4.16)
 *
 * Provides common HTML structure and styles for all email templates.
 * Includes responsive design for mobile email clients.
 *
 * AC1: Templates support HTML and plain text versions
 * AC3: Templates include organization name and logo
 * AC4: Templates include footer with unsubscribe link and support email
 * AC5: Templates responsive for mobile email clients
 */

/**
 * Variables required for the base template
 */
export interface BaseTemplateVariables {
  /** Organization name */
  organizationName: string;
  /** Organization logo URL (optional) */
  organizationLogoUrl?: string;
  /** Unsubscribe URL */
  unsubscribeUrl: string;
  /** Support email address */
  supportEmail?: string;
}

/**
 * Default support email if not provided
 */
const DEFAULT_SUPPORT_EMAIL = "support@betterthanspreadsheets.com";

/**
 * Common inline styles for email clients (must be inline for compatibility)
 */
export const emailStyles = {
  // Container
  body: `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #1F2937;
    background-color: #F3F4F6;
    margin: 0;
    padding: 0;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  `.trim(),

  container: `
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `.trim(),

  card: `
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin: 20px 0;
    overflow: hidden;
  `.trim(),

  // Typography
  h1: `
    color: #1F2937;
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 16px 0;
    line-height: 1.3;
  `.trim(),

  h2: `
    color: #374151;
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 12px 0;
    line-height: 1.4;
  `.trim(),

  paragraph: `
    color: #4B5563;
    font-size: 16px;
    margin: 0 0 16px 0;
    line-height: 1.6;
  `.trim(),

  label: `
    color: #6B7280;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
    display: block;
  `.trim(),

  value: `
    color: #1F2937;
    font-size: 16px;
    font-weight: 500;
  `.trim(),

  // Buttons
  primaryButton: `
    display: inline-block;
    background-color: #3B82F6;
    color: #FFFFFF;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 16px;
    text-align: center;
  `.trim(),

  secondaryButton: `
    display: inline-block;
    background-color: #E5E7EB;
    color: #374151;
    padding: 10px 20px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 14px;
    text-align: center;
  `.trim(),

  // Badges
  badge: {
    high: `background-color: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;`,
    medium: `background-color: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;`,
    low: `background-color: #DBEAFE; color: #1E40AF; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;`,
    critical: `background-color: #DC2626; color: #FFFFFF; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;`,
  },

  // Callout/Info boxes
  callout: `
    background-color: #F9FAFB;
    border-left: 4px solid #3B82F6;
    padding: 16px;
    margin: 16px 0;
    border-radius: 0 4px 4px 0;
  `.trim(),

  warningCallout: `
    background-color: #FFFBEB;
    border-left: 4px solid #F59E0B;
    padding: 16px;
    margin: 16px 0;
    border-radius: 0 4px 4px 0;
  `.trim(),

  // Footer
  footer: `
    text-align: center;
    color: #9CA3AF;
    font-size: 12px;
    padding: 20px;
    border-top: 1px solid #E5E7EB;
    margin-top: 20px;
  `.trim(),

  footerLink: `
    color: #6B7280;
    text-decoration: underline;
  `.trim(),
};

/**
 * Generate the HTML email header with logo
 */
export function generateEmailHeader(
  title: string,
  emoji: string,
  organizationName: string,
  organizationLogoUrl?: string
): string {
  const logoHtml = organizationLogoUrl
    ? `<img src="${organizationLogoUrl}" alt="${organizationName}" style="max-height: 40px; max-width: 200px; margin-bottom: 16px;" />`
    : `<div style="font-size: 24px; font-weight: bold; color: #1F2937; margin-bottom: 16px;">${organizationName}</div>`;

  return `
    <div style="padding: 24px; text-align: center; background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
      ${logoHtml}
    </div>
    <div style="padding: 24px;">
      <h1 style="${emailStyles.h1}">${emoji} ${title}</h1>
  `.trim();
}

/**
 * Generate the HTML email footer
 */
export function generateEmailFooter(
  organizationName: string,
  unsubscribeUrl: string,
  supportEmail: string = DEFAULT_SUPPORT_EMAIL
): string {
  return `
    </div>
    <div style="${emailStyles.footer}">
      <p style="margin: 0 0 8px 0;">${organizationName}</p>
      <p style="margin: 0 0 8px 0;">
        <a href="mailto:${supportEmail}" style="${emailStyles.footerLink}">Contact Support</a>
        &nbsp;|&nbsp;
        <a href="${unsubscribeUrl}" style="${emailStyles.footerLink}">Unsubscribe</a>
      </p>
      <p style="margin: 0; color: #D1D5DB; font-size: 11px;">
        This is an automated notification. Please do not reply directly to this email.
      </p>
    </div>
  `.trim();
}

/**
 * Wrap email content in the base HTML structure
 */
export function wrapInBaseTemplate(
  content: string,
  title: string,
  emoji: string,
  variables: BaseTemplateVariables
): string {
  const header = generateEmailHeader(
    title,
    emoji,
    variables.organizationName,
    variables.organizationLogoUrl
  );

  const footer = generateEmailFooter(
    variables.organizationName,
    variables.unsubscribeUrl,
    variables.supportEmail
  );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
    .mso-hide {display: none !important;}
  </style>
  <![endif]-->
  <style type="text/css">
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .container { padding: 10px !important; }
      .card { margin: 10px 0 !important; }
      .button { width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="${emailStyles.body}">
  <div class="container" style="${emailStyles.container}">
    <div class="card" style="${emailStyles.card}">
      ${header}
      ${content}
      ${footer}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text footer
 */
export function generatePlainTextFooter(
  organizationName: string,
  unsubscribeUrl: string,
  supportEmail: string = DEFAULT_SUPPORT_EMAIL
): string {
  return `
---
${organizationName}
Support: ${supportEmail}
Unsubscribe: ${unsubscribeUrl}

This is an automated notification. Please do not reply directly to this email.
  `.trim();
}
