/**
 * Evidence Request Reminder Service
 *
 * Handles automated reminder emails for pending evidence requests.
 *
 * AC35: System sends reminder email 3 days before due date
 * AC36: System sends overdue email 1 day after due date
 * AC37: Reminders include same information as original request plus days overdue
 *
 * This service should be called by a scheduled job (cron) daily.
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { db } from "@/server/db";
import { EvidenceRequestStatus } from "@prisma/client";
import { emailService } from "@/server/services/email.service";
import { createAuditLog } from "@/server/services/audit-log.service";
import { env } from "@/env";

/**
 * Result of processing reminders
 */
export interface ReminderProcessingResult {
  upcomingReminders: number;
  overdueReminders: number;
  errors: string[];
}

/**
 * Process all pending evidence requests and send appropriate reminders
 *
 * - Sends "upcoming" reminder 3 days before due date (AC35)
 * - Sends "overdue" reminder 1 day after due date (AC36)
 *
 * @returns Summary of processed reminders
 */
export async function processEvidenceRequestReminders(): Promise<ReminderProcessingResult> {
  const result: ReminderProcessingResult = {
    upcomingReminders: 0,
    overdueReminders: 0,
    errors: [],
  };

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  try {
    // Find requests due in 3 days (AC35)
    const upcomingRequests = await db.evidenceRequest.findMany({
      where: {
        status: EvidenceRequestStatus.PENDING,
        deletedAt: null,
        // Due date is between now and 3 days from now
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true, email: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Find overdue requests (AC36)
    const overdueRequests = await db.evidenceRequest.findMany({
      where: {
        status: EvidenceRequestStatus.PENDING,
        deletedAt: null,
        // Due date is before 1 day ago (more than 1 day overdue)
        dueDate: {
          lt: oneDayAgo,
        },
      },
      include: {
        recipient: {
          select: { id: true, name: true, email: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const appUrl = env.AUTH_URL ?? "http://localhost:3000";

    // Process upcoming reminders
    for (const request of upcomingRequests) {
      try {
        const daysUntilDue = Math.ceil(
          (request.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get control domain names
        const controlDomains = await db.controlDomain.findMany({
          where: { id: { in: request.controlTaxonomyIds } },
          select: { name: true },
        });

        const requestUrl = `${appUrl}/evidence-requests/${request.id}`;
        const requesterName =
          request.requestedBy.name ?? request.requestedBy.email ?? "GRC Analyst";

        await emailService.sendEvidenceRequestReminder({
          to: request.recipient.email ?? "",
          requesterName,
          controlDomains: controlDomains.map((d) => d.name),
          dueDate: request.dueDate,
          instructions: request.instructions,
          requestUrl,
          reminderType: "upcoming",
          daysUntilDue,
        });

        // Log reminder to audit trail
        void createAuditLog({
          organizationId: request.organizationId,
          userId: "system",
          action: "SEND_EVIDENCE_REQUEST_REMINDER",
          entityType: "EvidenceRequest",
          entityId: request.id,
          changes: {
            after: {
              type: "upcoming",
              daysUntilDue,
              recipientEmail: request.recipient.email,
              sentAt: new Date().toISOString(),
            },
          },
        });

        result.upcomingReminders++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to send upcoming reminder for ${request.id}: ${errorMessage}`);
        console.error(`[ReminderService] Error sending upcoming reminder:`, error);
      }
    }

    // Process overdue reminders
    for (const request of overdueRequests) {
      try {
        const daysOverdue = Math.ceil(
          (now.getTime() - request.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get control domain names
        const controlDomains = await db.controlDomain.findMany({
          where: { id: { in: request.controlTaxonomyIds } },
          select: { name: true },
        });

        const requestUrl = `${appUrl}/evidence-requests/${request.id}`;
        const requesterName =
          request.requestedBy.name ?? request.requestedBy.email ?? "GRC Analyst";

        await emailService.sendEvidenceRequestReminder({
          to: request.recipient.email ?? "",
          requesterName,
          controlDomains: controlDomains.map((d) => d.name),
          dueDate: request.dueDate,
          instructions: request.instructions,
          requestUrl,
          reminderType: "overdue",
          daysUntilDue: -daysOverdue, // Negative to indicate overdue
        });

        // Log reminder to audit trail
        void createAuditLog({
          organizationId: request.organizationId,
          userId: "system",
          action: "SEND_EVIDENCE_REQUEST_REMINDER",
          entityType: "EvidenceRequest",
          entityId: request.id,
          changes: {
            after: {
              type: "overdue",
              daysOverdue,
              recipientEmail: request.recipient.email,
              sentAt: new Date().toISOString(),
            },
          },
        });

        result.overdueReminders++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to send overdue reminder for ${request.id}: ${errorMessage}`);
        console.error(`[ReminderService] Error sending overdue reminder:`, error);
      }
    }

    console.log(
      `[ReminderService] Processed ${result.upcomingReminders} upcoming and ${result.overdueReminders} overdue reminders`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to fetch pending requests: ${errorMessage}`);
    console.error(`[ReminderService] Error fetching requests:`, error);
  }

  return result;
}
