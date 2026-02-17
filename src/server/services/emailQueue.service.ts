/**
 * Email Queue Service (Story 4.15)
 *
 * Provides email queuing with automatic retry logic for reliable delivery.
 *
 * AC7: enqueueEmail function accepts required parameters
 * AC8: Creates EmailQueue record with status PENDING
 * AC9: Returns queueId immediately (non-blocking)
 * AC10: Validates email address before enqueuing
 * AC11: Sets maxRetries based on emailType (critical=5, normal=3)
 */

import { db } from "@/server/db";
import { validateEmailAddress } from "@/lib/emailValidator";
import { htmlToPlainText } from "@/lib/emailValidator";
import type { EmailType } from "@prisma/client";

/**
 * Critical email types that get 5 retries
 */
const CRITICAL_EMAIL_TYPES: EmailType[] = [
  "RISK_ASSIGNED",
  "DECISION_REQUIRED",
  "EVIDENCE_REQUESTED",
  "SLA_BREACHED", // Story 16.8: SLA breach is critical
  "SLA_AT_RISK",  // Story 16.8: SLA at-risk is also critical
  // Epic 8: TPRM Critical Notifications
  "QUESTIONNAIRE_ASSIGNED",  // FR61: Critical - vendor needs to respond
  "QUESTIONNAIRE_RESPONSE",  // FR64: Critical - assessment owner needs to review
  "REVIEW_OVERDUE",          // FR65: Critical - compliance risk
];

/**
 * Normal email types that get 3 retries
 */
const NORMAL_EMAIL_TYPES: EmailType[] = [
  "STATUS_CHANGED",
  "RISK_CLOSED",
  "COMMENT_ADDED",
  // Epic 8: TPRM Normal Notifications
  "ASSESSMENT_STATUS_CHANGED", // FR62: Informational
  "VENDOR_OWNER_ASSIGNED",     // FR63: Informational
  "REVIEW_DUE_REMINDER",       // FR65: Reminder, not urgent
];

/**
 * Options for enqueuing an email
 */
export interface EnqueueEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** HTML content */
  htmlContent: string;
  /** Plain text content (optional, auto-generated from HTML if not provided) */
  textContent?: string;
  /** Type of email for categorization and retry policy */
  emailType: EmailType;
  /** Type of related entity (e.g., "RISK", "EVIDENCE") */
  relatedEntityType?: string;
  /** ID of related entity */
  relatedEntityId?: string;
  /** Organization ID for multi-tenancy */
  organizationId: string;
}

/**
 * Result of enqueuing an email
 */
export interface EnqueueEmailResult {
  success: boolean;
  queueId?: string;
  error?: string;
}

/**
 * Enqueue an email for background processing
 *
 * AC7-AC11: Validates, creates queue record, returns immediately
 *
 * @param options - Email options
 * @returns Queue ID for tracking
 */
export async function enqueueEmail(
  options: EnqueueEmailOptions
): Promise<EnqueueEmailResult> {
  try {
    // AC10: Validate email address before enqueuing
    const validation = validateEmailAddress(options.to);
    if (!validation.valid) {
      console.error(
        `[EmailQueue] Invalid email address: ${options.to} - ${validation.error}`
      );
      return {
        success: false,
        error: `Invalid email address: ${validation.error}`,
      };
    }

    // AC11: Determine maxRetries based on emailType
    const maxRetries = CRITICAL_EMAIL_TYPES.includes(options.emailType) ? 5 : 3;

    // Generate plain text if not provided
    const textContent =
      options.textContent ?? htmlToPlainText(options.htmlContent);

    // AC8: Create EmailQueue record with status PENDING
    const queueRecord = await db.emailQueue.create({
      data: {
        to: options.to,
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent,
        emailType: options.emailType,
        relatedEntityType: options.relatedEntityType,
        relatedEntityId: options.relatedEntityId,
        maxRetries,
        organizationId: options.organizationId,
        // status defaults to PENDING in schema
      },
    });

    console.log(
      `[EmailQueue] Email enqueued: ${options.emailType} "${options.subject}" to ${options.to} (queueId: ${queueRecord.id}, maxRetries: ${maxRetries})`
    );

    // AC9: Return queueId immediately
    return {
      success: true,
      queueId: queueRecord.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[EmailQueue] Failed to enqueue email: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get the count of pending/retrying emails
 */
export async function getPendingEmailCount(
  organizationId?: string
): Promise<number> {
  const where = {
    status: { in: ["PENDING", "RETRYING"] as ("PENDING" | "RETRYING")[] },
    ...(organizationId && { organizationId }),
  };

  return db.emailQueue.count({ where });
}

/**
 * Get email by ID
 */
export async function getEmailById(id: string) {
  return db.emailQueue.findUnique({ where: { id } });
}

/**
 * Check if an email type is critical
 */
export function isCriticalEmailType(emailType: EmailType): boolean {
  return CRITICAL_EMAIL_TYPES.includes(emailType);
}
