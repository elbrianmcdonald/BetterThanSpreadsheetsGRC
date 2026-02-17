/**
 * Email Service (Story 4.14)
 *
 * Provides email notification capabilities for the application.
 * Uses the transport factory to send emails via SendGrid, AWS SES, or console.
 *
 * AC12: EmailService class provides provider-agnostic interface
 * AC13: Service handles both HTML and plain text email content
 * AC14: Service supports single recipient or multiple recipients
 * AC15: Service includes email metadata (Reply-To, headers for tracking)
 * AC16: Service returns delivery result with messageId and status
 * AC17: Service catches and logs email sending errors without crashing app
 *
 * @see Story 3.12: Evidence Request Workflow (original stub implementation)
 * @see Story 4.14: Email Notification Service Integration
 */

import { getEmailTransport, getEmailSender, validateEmailConfig } from "@/server/email";
import type { EmailSendOptions, EmailSendResult as TransportResult } from "@/server/email/types";
import {
  validateEmailAddress,
  validateEmailAddresses,
  sanitizeEmailHtml,
  htmlToPlainText,
} from "@/lib/emailValidator";
import { env } from "@/env";

/**
 * Email send options for the service (simplified interface)
 */
export interface EmailOptions {
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** HTML content */
  html: string;
  /** Plain text content (optional, auto-generated from HTML if not provided) */
  text?: string;
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Reply-To address */
  replyTo?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Parameters for sending an evidence request email (Story 3.12 compatibility)
 */
export interface SendEvidenceRequestParams {
  /** Recipient email address */
  to: string;
  /** Name of the person requesting the evidence */
  requesterName: string;
  /** List of control domain names */
  controlDomains: string[];
  /** Due date for the evidence */
  dueDate: Date;
  /** Instructions for the recipient */
  instructions: string;
  /** Direct URL to the evidence request page */
  requestUrl: string;
  /** Optional framework code for context */
  frameworkCode?: string;
}

/**
 * Parameters for sending an evidence request fulfilled notification
 */
export interface SendEvidenceRequestFulfilledParams {
  /** Recipient email address (original requester) */
  to: string;
  /** Name of the person who fulfilled the request */
  recipientName: string;
  /** URL to view the uploaded evidence */
  evidenceUrl: string;
  /** Control domains that were requested */
  controlDomains: string[];
  /** Original request ID for reference */
  requestId: string;
}

/**
 * Parameters for sending an evidence request cancellation notification
 */
export interface SendEvidenceRequestCancelledParams {
  /** Recipient email address */
  to: string;
  /** Name of the person who cancelled the request */
  cancellerName: string;
  /** Control domains that were requested */
  controlDomains: string[];
  /** Original due date */
  dueDate: Date;
}

/**
 * Parameters for sending an evidence request reminder
 */
export interface SendEvidenceRequestReminderParams {
  /** Recipient email address */
  to: string;
  /** Name of the person requesting the evidence */
  requesterName: string;
  /** List of control domain names */
  controlDomains: string[];
  /** Due date for the evidence */
  dueDate: Date;
  /** Instructions for the recipient */
  instructions: string;
  /** Direct URL to the evidence request page */
  requestUrl: string;
  /** Reminder type: "upcoming" (3 days before) or "overdue" */
  reminderType: "upcoming" | "overdue";
  /** Days until due (negative if overdue) */
  daysUntilDue: number;
}

/**
 * Rate limiting state
 * AC21: Rate limiting: Max 100 emails per minute
 */
interface RateLimitState {
  count: number;
  windowStart: number;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 emails per minute

/**
 * Email Service implementation
 */
class EmailService {
  private rateLimitState: RateLimitState = {
    count: 0,
    windowStart: Date.now(),
  };

  /**
   * Check if email service is configured and enabled
   */
  isEnabled(): boolean {
    const validation = validateEmailConfig();
    return validation.valid;
  }

  /**
   * Get current email provider name
   */
  getProvider(): string {
    return env.EMAIL_PROVIDER;
  }

  /**
   * Check rate limit and throw if exceeded
   * AC21: Rate limiting: Max 100 emails per minute
   */
  private checkRateLimit(): void {
    const now = Date.now();

    // Reset window if expired
    if (now - this.rateLimitState.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimitState = { count: 0, windowStart: now };
    }

    // Check limit
    if (this.rateLimitState.count >= RATE_LIMIT_MAX) {
      throw new Error(
        `Rate limit exceeded: maximum ${RATE_LIMIT_MAX} emails per minute. Please try again later.`
      );
    }

    // Increment counter
    this.rateLimitState.count++;
  }

  /**
   * Send an email using the configured transport
   *
   * AC12: Provider-agnostic interface
   * AC13: Handles both HTML and plain text
   * AC14: Supports single or multiple recipients
   * AC15: Includes metadata (Reply-To, headers)
   * AC16: Returns messageId and status
   * AC17: Catches errors without crashing
   */
  async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    try {
      // Check rate limit (AC21)
      this.checkRateLimit();

      // Validate email addresses (AC18)
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const recipientValidation = validateEmailAddresses(recipients);
      if (!recipientValidation.valid) {
        return { success: false, error: recipientValidation.error };
      }

      // Validate CC addresses if provided
      if (options.cc?.length) {
        const ccValidation = validateEmailAddresses(options.cc);
        if (!ccValidation.valid) {
          return { success: false, error: `CC ${ccValidation.error}` };
        }
      }

      // Validate BCC addresses if provided
      if (options.bcc?.length) {
        const bccValidation = validateEmailAddresses(options.bcc);
        if (!bccValidation.valid) {
          return { success: false, error: `BCC ${bccValidation.error}` };
        }
      }

      // Validate Reply-To if provided
      if (options.replyTo) {
        const replyToValidation = validateEmailAddress(options.replyTo);
        if (!replyToValidation.valid) {
          return { success: false, error: `Reply-To ${replyToValidation.error}` };
        }
      }

      // Sanitize HTML content (AC19)
      const sanitizedHtml = sanitizeEmailHtml(options.html);

      // Generate plain text if not provided (AC13)
      const plainText = options.text ?? htmlToPlainText(sanitizedHtml);

      // Get transport and sender
      const transport = getEmailTransport();
      const sender = getEmailSender();

      // Build send options
      const sendOptions: EmailSendOptions = {
        from: sender,
        to: options.to,
        subject: options.subject,
        html: sanitizedHtml,
        text: plainText,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        headers: options.headers,
      };

      // Send email
      const result: TransportResult = await transport.sendEmail(sendOptions);

      // Log result (AC33)
      if (result.success) {
        console.log(
          `[EmailService] Email sent successfully via ${transport.name}: ${result.messageId}`
        );
      } else {
        console.error(
          `[EmailService] Email send failed via ${transport.name}: ${result.error}`
        );
      }

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      // AC17: Catch errors without crashing
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[EmailService] Email send failed:", errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate HTML for evidence request email
   */
  private generateEvidenceRequestHtml(
    params: SendEvidenceRequestParams
  ): string {
    const { requesterName, controlDomains, dueDate, instructions, requestUrl, frameworkCode } = params;

    const formattedDate = dueDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb; margin-bottom: 24px;">Evidence Request</h1>

  <p>Hello,</p>

  <p><strong>${requesterName}</strong> has requested compliance evidence from you.</p>

  <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Control Domains:</strong></p>
    <ul style="margin: 0; padding-left: 20px;">
      ${controlDomains.map((d) => `<li>${d}</li>`).join("\n      ")}
    </ul>
    ${frameworkCode ? `<p style="margin: 8px 0 0 0;"><strong>Framework:</strong> ${frameworkCode}</p>` : ""}
    <p style="margin: 8px 0 0 0;"><strong>Due Date:</strong> ${formattedDate}</p>
  </div>

  ${instructions ? `
  <div style="margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Instructions:</strong></p>
    <p style="margin: 0; white-space: pre-wrap;">${instructions}</p>
  </div>
  ` : ""}

  <div style="text-align: center; margin: 32px 0;">
    <a href="${requestUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upload Evidence</a>
  </div>

  <p style="color: #6b7280; font-size: 14px;">
    If you have questions about this request, please contact ${requesterName} directly.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    This is an automated message from BetterThanSpreadsheetsGRC.
    <br>
    <a href="${requestUrl}" style="color: #6b7280;">View request details</a>
  </p>
</body>
</html>
    `.trim();
  }

  /**
   * Send an evidence request email to a recipient
   */
  async sendEvidenceRequest(
    params: SendEvidenceRequestParams
  ): Promise<EmailSendResult> {
    const { to, controlDomains, dueDate } = params;

    // Format email subject
    const domainList =
      controlDomains.slice(0, 3).join(", ") +
      (controlDomains.length > 3 ? ` (+${controlDomains.length - 3} more)` : "");
    const formattedDate = dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const subject = `Evidence Request: ${domainList} - Due ${formattedDate}`;

    const html = this.generateEvidenceRequestHtml(params);

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send an evidence request fulfilled notification to the original requester
   */
  async sendEvidenceRequestFulfilled(
    params: SendEvidenceRequestFulfilledParams
  ): Promise<EmailSendResult> {
    const { to, recipientName, evidenceUrl, controlDomains, requestId } = params;

    const domainList = controlDomains.join(", ");
    const subject = `Evidence Submitted: ${domainList}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #16a34a; margin-bottom: 24px;">Evidence Submitted</h1>

  <p>Good news! <strong>${recipientName}</strong> has submitted evidence for your request.</p>

  <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Control Domains:</strong></p>
    <ul style="margin: 0; padding-left: 20px;">
      ${controlDomains.map((d) => `<li>${d}</li>`).join("\n      ")}
    </ul>
    <p style="margin: 8px 0 0 0;"><strong>Request ID:</strong> ${requestId}</p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${evidenceUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Evidence</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    This is an automated message from BetterThanSpreadsheetsGRC.
  </p>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send an evidence request cancellation notification
   */
  async sendEvidenceRequestCancelled(
    params: SendEvidenceRequestCancelledParams
  ): Promise<EmailSendResult> {
    const { to, cancellerName, controlDomains, dueDate } = params;

    const domainList = controlDomains.join(", ");
    const subject = `Evidence Request Cancelled: ${domainList}`;

    const formattedDate = dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #6b7280; margin-bottom: 24px;">Evidence Request Cancelled</h1>

  <p>The following evidence request has been cancelled by <strong>${cancellerName}</strong>.</p>

  <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Control Domains:</strong></p>
    <ul style="margin: 0; padding-left: 20px;">
      ${controlDomains.map((d) => `<li>${d}</li>`).join("\n      ")}
    </ul>
    <p style="margin: 8px 0 0 0;"><strong>Original Due Date:</strong> ${formattedDate}</p>
  </div>

  <p><strong>No action is required on your part.</strong></p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    This is an automated message from BetterThanSpreadsheetsGRC.
  </p>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send an evidence request reminder email
   */
  async sendEvidenceRequestReminder(
    params: SendEvidenceRequestReminderParams
  ): Promise<EmailSendResult> {
    const {
      to,
      requesterName,
      controlDomains,
      dueDate,
      instructions,
      requestUrl,
      reminderType,
      daysUntilDue,
    } = params;

    const domainList =
      controlDomains.slice(0, 3).join(", ") +
      (controlDomains.length > 3 ? ` (+${controlDomains.length - 3} more)` : "");

    const formattedDate = dueDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const subject =
      reminderType === "upcoming"
        ? `Reminder: Evidence Request Due in ${daysUntilDue} Days - ${domainList}`
        : `OVERDUE: Evidence Request - ${domainList} (${Math.abs(daysUntilDue)} days overdue)`;

    const isOverdue = reminderType === "overdue";
    const urgencyColor = isOverdue ? "#dc2626" : "#f59e0b";
    const urgencyMessage = isOverdue
      ? `This evidence request is <strong>${Math.abs(daysUntilDue)} day(s) overdue</strong>. Please submit as soon as possible.`
      : `This evidence request is due in <strong>${daysUntilDue} days</strong>.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: ${urgencyColor}; margin-bottom: 24px;">${isOverdue ? "OVERDUE: " : ""}Evidence Request Reminder</h1>

  <div style="background-color: ${isOverdue ? "#fef2f2" : "#fffbeb"}; border-left: 4px solid ${urgencyColor}; padding: 16px; margin: 0 0 24px 0;">
    <p style="margin: 0; color: ${urgencyColor};">${urgencyMessage}</p>
  </div>

  <p><strong>${requesterName}</strong> has requested compliance evidence from you.</p>

  <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Control Domains:</strong></p>
    <ul style="margin: 0; padding-left: 20px;">
      ${controlDomains.map((d) => `<li>${d}</li>`).join("\n      ")}
    </ul>
    <p style="margin: 8px 0 0 0;"><strong>Due Date:</strong> ${formattedDate}</p>
  </div>

  ${instructions ? `
  <div style="margin: 24px 0;">
    <p style="margin: 0 0 8px 0;"><strong>Instructions:</strong></p>
    <p style="margin: 0; white-space: pre-wrap;">${instructions}</p>
  </div>
  ` : ""}

  <div style="text-align: center; margin: 32px 0;">
    <a href="${requestUrl}" style="display: inline-block; background-color: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Upload Evidence Now</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    This is an automated reminder from BetterThanSpreadsheetsGRC.
    <br>
    <a href="${requestUrl}" style="color: #6b7280;">View request details</a>
  </p>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }
}

/**
 * Singleton email service instance
 */
export const emailService = new EmailService();
