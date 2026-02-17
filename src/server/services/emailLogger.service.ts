/**
 * Email Logging Service (Story 4.14)
 *
 * Provides audit trail for email operations.
 *
 * AC33: All email sends logged to application logs with: recipient, subject, provider, messageId, timestamp
 * AC34: Failed sends logged with full error details for troubleshooting
 * AC35: Email logs retained for 30 days minimum (via AuditLog retention)
 * AC36: Email logs queryable for audit purposes
 */

import { createAuditLog } from "./audit-log.service";
import type { EmailSendResult } from "./email.service";
import type { EmailSendOptions, EmailProvider } from "@/server/email/types";

/**
 * Parameters for logging an email send attempt
 */
export interface EmailLogParams {
  /** Organization ID for multi-tenant filtering */
  organizationId: string;
  /** User ID of the sender (null for system emails) */
  userId: string | null;
  /** Email send options */
  options: EmailSendOptions;
  /** Email provider used */
  provider: EmailProvider;
  /** Send result */
  result: EmailSendResult;
  /** Email type (e.g., "evidence-request", "reminder", "notification") */
  emailType?: string;
}

/**
 * Log an email send to the audit trail
 *
 * AC33: Logs recipient, subject, provider, messageId, timestamp
 * AC34: Logs error details for failed sends
 */
export async function logEmailSend(params: EmailLogParams): Promise<void> {
  const { organizationId, userId, options, provider, result, emailType } = params;

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const timestamp = new Date().toISOString();

  // Create audit log entry
  await createAuditLog({
    organizationId,
    userId,
    action: result.success ? "SEND_EMAIL" : "EMAIL_SEND_FAILED",
    entityType: "Email",
    entityId: result.messageId ?? `email-${Date.now()}`,
    changes: {
      after: {
        // AC33: Log required fields
        recipients: recipients.join(", "),
        subject: options.subject,
        provider,
        messageId: result.messageId,
        timestamp,
        // Additional context
        emailType: emailType ?? "generic",
        cc: options.cc?.join(", "),
        bcc: options.bcc ? `[${options.bcc.length} recipients]` : undefined,
        replyTo: options.replyTo,
        // AC34: Error details for failed sends
        ...(result.error && {
          error: result.error,
          success: false,
        }),
        ...(result.success && {
          success: true,
        }),
      },
    },
    actorName: userId ? undefined : "SYSTEM",
    actorRole: userId ? undefined : "SYSTEM",
  });

  // Also log to application logs (pino/console)
  if (result.success) {
    console.log(
      `[EmailLogger] Email sent successfully`,
      JSON.stringify({
        messageId: result.messageId,
        provider,
        recipients: recipients.slice(0, 3).join(", ") + (recipients.length > 3 ? ` (+${recipients.length - 3} more)` : ""),
        subject: options.subject.length > 50 ? options.subject.substring(0, 50) + "..." : options.subject,
        emailType: emailType ?? "generic",
        timestamp,
      })
    );
  } else {
    console.error(
      `[EmailLogger] Email send failed`,
      JSON.stringify({
        provider,
        recipients: recipients.slice(0, 3).join(", ") + (recipients.length > 3 ? ` (+${recipients.length - 3} more)` : ""),
        subject: options.subject.length > 50 ? options.subject.substring(0, 50) + "..." : options.subject,
        error: result.error,
        timestamp,
      })
    );
  }
}

/**
 * Query email logs for audit purposes
 *
 * AC36: Email logs queryable for audit purposes (who was emailed when)
 *
 * Note: Uses the existing AuditLog query infrastructure.
 * Email logs can be queried via the audit router using:
 * - entityType: "Email"
 * - action: "SEND_EMAIL" or "EMAIL_SEND_FAILED"
 *
 * Example:
 * ```typescript
 * // Get all emails sent in the last 24 hours
 * const emails = await db.auditLog.findMany({
 *   where: {
 *     organizationId,
 *     entityType: "Email",
 *     action: { in: ["SEND_EMAIL", "EMAIL_SEND_FAILED"] },
 *     timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
 *   },
 *   orderBy: { timestamp: "desc" },
 * });
 * ```
 */
export type EmailLogQuery = {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  recipient?: string;
  emailType?: string;
  success?: boolean;
};
