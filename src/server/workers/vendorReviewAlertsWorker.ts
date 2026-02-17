/**
 * Vendor Review Alerts Worker (Epic 8, FR65)
 *
 * Runs daily to send alerts for:
 * - Vendors with reviews due within 7 days (reminder)
 * - Vendors with overdue reviews (critical alert)
 *
 * Notifications are sent to IT Owner and Business Owner.
 */

import { db } from "@/server/db";
import { VendorStatus } from "@prisma/client";
import { enqueueEmail } from "@/server/services/emailQueue.service";
import {
  renderReviewDueReminderEmail,
  renderReviewOverdueEmail,
} from "@/server/email/templates";

/**
 * Result of processing vendor review alerts
 */
export interface ReviewAlertsResult {
  processed: number;
  remindersSent: number;
  overduesSent: number;
  errors: number;
}

/**
 * Track which vendors have already received alerts today
 * to avoid duplicate notifications on multiple runs
 */
const alertsSentToday = new Map<string, { reminder: boolean; overdue: boolean }>();

/**
 * Reset daily tracking (called at midnight or on worker restart)
 */
export function resetDailyAlerts(): void {
  alertsSentToday.clear();
}

/**
 * Process vendor review alerts
 *
 * Finds vendors with upcoming or overdue reviews and sends notifications
 * to their IT Owner and/or Business Owner.
 */
export async function processVendorReviewAlerts(): Promise<ReviewAlertsResult> {
  const result: ReviewAlertsResult = {
    processed: 0,
    remindersSent: 0,
    overduesSent: 0,
    errors: 0,
  };

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  try {
    // Find vendors needing alerts
    // - Active vendors only
    // - With a nextReviewDate set
    // - Where nextReviewDate is within 7 days OR already past
    const vendors = await db.vendor.findMany({
      where: {
        status: VendorStatus.ACTIVE,
        nextReviewDate: {
          not: null,
          lte: sevenDaysFromNow, // Due within 7 days or already overdue
        },
      },
      include: {
        organization: {
          select: { name: true },
        },
        itOwner: {
          select: { id: true, name: true, email: true },
        },
        businessOwner: {
          select: { id: true, name: true, email: true },
        },
        assessments: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    });

    for (const vendor of vendors) {
      if (!vendor.nextReviewDate) continue;

      result.processed++;

      const reviewDate = new Date(vendor.nextReviewDate);
      const isOverdue = reviewDate < now;
      const daysUntilDue = Math.ceil(
        (reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysOverdue = Math.ceil(
        (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if we've already sent alerts for this vendor today
      const todayAlerts = alertsSentToday.get(vendor.id) || { reminder: false, overdue: false };

      // Determine which alert type to send
      const shouldSendReminder = !isOverdue && daysUntilDue <= 7 && !todayAlerts.reminder;
      const shouldSendOverdue = isOverdue && !todayAlerts.overdue;

      // Get last assessment date
      const lastAssessmentDate = vendor.assessments[0]?.completedAt || null;

      // Recipients: IT Owner and/or Business Owner
      const recipients: Array<{ email: string; name: string; role: string }> = [];
      if (vendor.itOwner?.email) {
        recipients.push({
          email: vendor.itOwner.email,
          name: vendor.itOwner.name || "IT Owner",
          role: "IT_OWNER",
        });
      }
      if (vendor.businessOwner?.email) {
        recipients.push({
          email: vendor.businessOwner.email,
          name: vendor.businessOwner.name || "Business Owner",
          role: "BUSINESS_OWNER",
        });
      }

      // No recipients - skip
      if (recipients.length === 0) {
        continue;
      }

      try {
        for (const recipient of recipients) {
          if (shouldSendOverdue) {
            // Send overdue alert
            const emailData = renderReviewOverdueEmail({
              recipientName: recipient.name,
              vendorName: vendor.name,
              vendorIdentifier: vendor.identifier,
              nextReviewDate: vendor.nextReviewDate,
              daysOverdue,
              vendorId: vendor.id,
              organizationName: vendor.organization.name,
              organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
              vendorCategory: vendor.category ?? undefined,
              lastAssessmentDate,
              riskTier: vendor.riskTier ?? undefined,
              isFollowUp: false, // First notification of the day
            });

            await enqueueEmail({
              to: recipient.email,
              subject: emailData.subject,
              htmlContent: emailData.html,
              textContent: emailData.text,
              emailType: "REVIEW_OVERDUE",
              relatedEntityType: "Vendor",
              relatedEntityId: vendor.id,
              organizationId: vendor.organizationId,
            });

            result.overduesSent++;
          } else if (shouldSendReminder) {
            // Send reminder (only 7 days before)
            const emailData = renderReviewDueReminderEmail({
              recipientName: recipient.name,
              vendorName: vendor.name,
              vendorIdentifier: vendor.identifier,
              nextReviewDate: vendor.nextReviewDate,
              daysUntilDue,
              vendorId: vendor.id,
              organizationName: vendor.organization.name,
              organizationLogoUrl: undefined, // Organization model doesn't have logoUrl
              vendorCategory: vendor.category ?? undefined,
              lastAssessmentDate,
              recipientRole: recipient.role as "IT_OWNER" | "BUSINESS_OWNER",
              riskTier: vendor.riskTier ?? undefined,
            });

            await enqueueEmail({
              to: recipient.email,
              subject: emailData.subject,
              htmlContent: emailData.html,
              textContent: emailData.text,
              emailType: "REVIEW_DUE_REMINDER",
              relatedEntityType: "Vendor",
              relatedEntityId: vendor.id,
              organizationId: vendor.organizationId,
            });

            result.remindersSent++;
          }
        }

        // Mark alerts as sent for today
        if (shouldSendReminder || shouldSendOverdue) {
          alertsSentToday.set(vendor.id, {
            reminder: todayAlerts.reminder || shouldSendReminder,
            overdue: todayAlerts.overdue || shouldSendOverdue,
          });
        }
      } catch (error) {
        result.errors++;
        console.error(
          `[VendorReviewAlerts] Error sending alert for vendor ${vendor.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.error(
      "[VendorReviewAlerts] Error processing vendor review alerts:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }

  return result;
}

/**
 * Get count of vendors needing review alerts (for dashboard/monitoring)
 */
export async function getVendorReviewAlertsCounts(): Promise<{
  dueWithin7Days: number;
  overdue: number;
}> {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [dueWithin7Days, overdue] = await Promise.all([
    db.vendor.count({
      where: {
        status: VendorStatus.ACTIVE,
        nextReviewDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    }),
    db.vendor.count({
      where: {
        status: VendorStatus.ACTIVE,
        nextReviewDate: {
          lt: now,
        },
      },
    }),
  ]);

  return { dueWithin7Days, overdue };
}
