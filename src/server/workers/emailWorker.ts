/**
 * Email Processing Worker (Story 4.15)
 *
 * Background worker that processes the email queue with retry logic.
 *
 * AC12: Worker processes queue every 30 seconds
 * AC13: Fetches PENDING or RETRYING emails (oldest first)
 * AC14: Processes max 10 emails per batch
 * AC15: Calls emailService.sendEmail() for each
 * AC16: On success, updates status to SENT
 * AC17: On failure, implements retry logic (AC18-AC23)
 *
 * Retry Logic (AC18-AC23):
 * AC18: On failure, increment retryCount
 * AC19: If retryCount < maxRetries, status → RETRYING, schedule next retry
 * AC20: Exponential backoff: 2^retryCount minutes (1→2min, 2→4min, 3→8min)
 * AC21: If retryCount >= maxRetries, status → FAILED
 * AC22: Failed emails logged to application logs and audit trail
 * AC23: Failed emails visible in admin dashboard
 */

import { db } from "@/server/db";
import { emailService } from "@/server/services/email.service";
import { createAuditLog } from "@/server/services/audit-log.service";

/**
 * Maximum emails to process per batch (AC14)
 */
const BATCH_SIZE = 10;

/**
 * Process pending emails in the queue
 *
 * AC12-AC17: Fetches and processes pending/retrying emails
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    // AC13: Fetch emails with status PENDING or (RETRYING AND ready for retry)
    const emails = await db.emailQueue.findMany({
      where: {
        OR: [
          { status: "PENDING" },
          {
            status: "RETRYING",
            lastRetryAt: { lt: now }, // Ready for retry (lastRetryAt is the scheduled retry time)
          },
        ],
      },
      orderBy: { createdAt: "asc" }, // Oldest first (FIFO)
      take: BATCH_SIZE, // AC14: Max 10 per batch
    });

    if (emails.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    console.log(`[EmailWorker] Processing ${emails.length} emails...`);

    // Process each email
    for (const email of emails) {
      processed++;

      try {
        // AC15: Call emailService.sendEmail()
        const result = await emailService.sendEmail({
          to: email.to,
          subject: email.subject,
          html: email.htmlContent,
          text: email.textContent ?? undefined,
        });

        if (result.success) {
          // AC16: Update status to SENT
          await db.emailQueue.update({
            where: { id: email.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              error: null, // Clear any previous error
            },
          });

          console.log(
            `[EmailWorker] ✓ Sent: ${email.emailType} "${email.subject}" to ${email.to} (messageId: ${result.messageId})`
          );
          sent++;
        } else {
          // AC17: Handle failure with retry logic
          await handleEmailFailure(email.id, result.error ?? "Unknown error");
          failed++;
        }
      } catch (error) {
        // AC17: Handle exception with retry logic
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await handleEmailFailure(email.id, errorMessage);
        failed++;
      }
    }

    console.log(
      `[EmailWorker] Batch complete: ${sent} sent, ${failed} failed, ${processed} processed`
    );
  } catch (error) {
    console.error("[EmailWorker] Queue processing error:", error);
  }

  return { processed, sent, failed };
}

/**
 * Handle email send failure with retry logic
 *
 * AC18-AC22: Implements exponential backoff retry
 *
 * @param emailId - ID of the failed email
 * @param errorMessage - Error message from send attempt
 */
async function handleEmailFailure(
  emailId: string,
  errorMessage: string
): Promise<void> {
  const email = await db.emailQueue.findUnique({ where: { id: emailId } });
  if (!email) {
    console.error(`[EmailWorker] Email not found: ${emailId}`);
    return;
  }

  // AC18: Increment retryCount
  const newRetryCount = email.retryCount + 1;

  if (newRetryCount < email.maxRetries) {
    // AC19-AC20: Schedule retry with exponential backoff
    // Backoff: 2^retryCount minutes (1st: 2min, 2nd: 4min, 3rd: 8min, 4th: 16min, 5th: 32min)
    const backoffMinutes = Math.pow(2, newRetryCount);
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db.emailQueue.update({
      where: { id: emailId },
      data: {
        status: "RETRYING",
        retryCount: newRetryCount,
        lastRetryAt: nextRetryAt,
        error: errorMessage,
      },
    });

    console.log(
      `[EmailWorker] ⟳ Retry scheduled: ${email.emailType} "${email.subject}" (attempt ${newRetryCount}/${email.maxRetries}, next retry in ${backoffMinutes} min)`
    );
  } else {
    // AC21: Max retries exceeded, mark as FAILED
    await db.emailQueue.update({
      where: { id: emailId },
      data: {
        status: "FAILED",
        retryCount: newRetryCount,
        error: errorMessage,
      },
    });

    console.error(
      `[EmailWorker] ✗ Failed permanently: ${email.emailType} "${email.subject}" to ${email.to} (after ${newRetryCount} attempts)`
    );

    // AC22: Log to audit trail
    try {
      await createAuditLog({
        organizationId: email.organizationId,
        userId: null, // System action
        action: "EMAIL_SEND_FAILED",
        entityType: "EmailQueue",
        entityId: email.id,
        changes: {
          after: {
            to: email.to,
            subject: email.subject,
            emailType: email.emailType,
            retryCount: newRetryCount,
            maxRetries: email.maxRetries,
            error: errorMessage,
            relatedEntityType: email.relatedEntityType,
            relatedEntityId: email.relatedEntityId,
          },
        },
        actorName: "SYSTEM",
        actorRole: "SYSTEM",
      });
    } catch (auditError) {
      console.error("[EmailWorker] Failed to log to audit trail:", auditError);
    }
  }
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<{
  pending: number;
  retrying: number;
  sent24h: number;
  failed24h: number;
}> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pending, retrying, sent24h, failed24h] = await Promise.all([
    db.emailQueue.count({ where: { status: "PENDING" } }),
    db.emailQueue.count({ where: { status: "RETRYING" } }),
    db.emailQueue.count({
      where: { status: "SENT", sentAt: { gte: yesterday } },
    }),
    db.emailQueue.count({
      where: { status: "FAILED", updatedAt: { gte: yesterday } },
    }),
  ]);

  return { pending, retrying, sent24h, failed24h };
}
