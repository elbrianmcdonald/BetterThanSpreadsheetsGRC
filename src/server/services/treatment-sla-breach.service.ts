/**
 * Treatment SLA Breach Detection Service
 *
 * Story 15.9: Risk Treatment SLA Enforcement
 * Story 16.8: Treatment SLA Display & Alerts
 *
 * Scheduled job to detect SLA breaches on risk treatments and send notifications.
 *
 * AC8: "At Risk" notification sent when 3 days remaining
 * AC9: "Breached" notification sent when due date passes
 * AC10: Notifications go to risk owner and GRC Analyst
 */

import { db } from "@/server/db";
import { AuditAction, UserRole } from "@prisma/client";
import { enqueueEmail } from "./emailQueue.service";
import { renderSlaBreachedEmail, renderSlaAtRiskEmail } from "@/server/email/templates";

interface TreatmentSlaBreachResult {
  processedCount: number;
  breachedCount: number;
  errors: string[];
}

/**
 * Process treatment SLA breaches for all organizations
 *
 * Story 15.9: Treatment SLA Enforcement
 * AC1: Daily job checks treatment due dates
 * AC2: Marks slaBreached = true when overdue
 * AC3: Sends notification to risk owners
 * AC4: Logs breach events for audit
 */
export async function processTreatmentSlaBreaches(): Promise<TreatmentSlaBreachResult> {
  const result: TreatmentSlaBreachResult = {
    processedCount: 0,
    breachedCount: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // Find all treatments that are past due and not yet marked breached
    const overdueTreatments = await db.riskTreatment.findMany({
      where: {
        dueDate: { lt: now },
        slaBreached: false,
        completedAt: null, // Not completed
      },
      select: {
        id: true,
        organizationId: true,
        riskId: true,
        treatmentType: true,
        dueDate: true,
        decidedById: true,
        risk: {
          select: {
            title: true,
            itOwnerId: true,
            businessOwnerId: true,
            ITOwner: { select: { email: true, name: true } },
            BusinessOwner: { select: { email: true, name: true } },
          },
        },
      },
    });

    result.processedCount = overdueTreatments.length;

    if (overdueTreatments.length === 0) {
      console.log("[Treatment SLA] No overdue treatments found");
      return result;
    }

    // Update all overdue treatments to mark as breached
    const updateResult = await db.riskTreatment.updateMany({
      where: {
        id: { in: overdueTreatments.map((t) => t.id) },
      },
      data: { slaBreached: true },
    });

    result.breachedCount = updateResult.count;

    // Log breach events
    for (const treatment of overdueTreatments) {
      try {
        await db.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: treatment.organizationId,
            userId: "system",
            action: AuditAction.RISK_TREATMENT_SLA_BREACHED,
            entityType: "RiskTreatment",
            entityId: treatment.id,
            changes: {
              riskId: treatment.riskId,
              riskTitle: treatment.risk.title,
              treatmentType: treatment.treatmentType,
              dueDate: treatment.dueDate?.toISOString(),
              breachedAt: now.toISOString(),
            },
          },
        });

        // Story 16.8 AC9, AC10: Send breach notification to risk owners and GRC Analysts
        await sendSlaBreachedNotifications(treatment, now);
      } catch (logError) {
        const errorMsg = `Failed to log breach for treatment ${treatment.id}: ${logError instanceof Error ? logError.message : "Unknown error"}`;
        console.error(`[Treatment SLA] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(
      `[Treatment SLA] Processed ${result.processedCount} treatments, marked ${result.breachedCount} as breached`
    );

    return result;
  } catch (error) {
    const errorMsg = `Treatment SLA breach processing failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(`[Treatment SLA] ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Get treatment SLA breach statistics
 */
export async function getTreatmentSlaBreachStats() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [breached, atRisk, onTrack] = await Promise.all([
    // Breached: past due or marked breached
    db.riskTreatment.count({
      where: {
        completedAt: null,
        OR: [{ slaBreached: true }, { dueDate: { lt: now } }],
      },
    }),
    // At Risk: due within 3 days
    db.riskTreatment.count({
      where: {
        completedAt: null,
        dueDate: { gte: now, lte: threeDaysFromNow },
        slaBreached: false,
      },
    }),
    // On Track: due more than 3 days out
    db.riskTreatment.count({
      where: {
        completedAt: null,
        dueDate: { gt: threeDaysFromNow },
        slaBreached: false,
      },
    }),
  ]);

  return { breached, atRisk, onTrack };
}

/**
 * Process treatments that are at risk (due within 3 days)
 * Story 16.8 AC8: Send "At Risk" notification when 3 days remaining
 */
export async function processTreatmentSlaAtRisk(): Promise<{
  processedCount: number;
  notifiedCount: number;
  errors: string[];
}> {
  const result = {
    processedCount: 0,
    notifiedCount: 0,
    errors: [] as string[],
  };

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Find treatments due within 3 days that haven't been notified for at-risk
    // We track this by checking if notification was already sent today
    const atRiskTreatments = await db.riskTreatment.findMany({
      where: {
        completedAt: null,
        slaBreached: false,
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
        // Only notify once per treatment (when entering at-risk zone)
        atRiskNotifiedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        riskId: true,
        treatmentType: true,
        dueDate: true,
        risk: {
          select: {
            title: true,
            description: true,
            severity: true,
            itOwnerId: true,
            businessOwnerId: true,
            ITOwner: { select: { id: true, email: true, name: true } },
            BusinessOwner: { select: { id: true, email: true, name: true } },
          },
        },
        organization: {
          select: { name: true },
        },
      },
    });

    result.processedCount = atRiskTreatments.length;

    if (atRiskTreatments.length === 0) {
      console.log("[Treatment SLA] No at-risk treatments found");
      return result;
    }

    for (const treatment of atRiskTreatments) {
      try {
        const daysRemaining = Math.max(
          0,
          Math.floor((treatment.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Send at-risk notifications
        await sendSlaAtRiskNotifications(treatment, daysRemaining);

        // Mark as notified
        await db.riskTreatment.update({
          where: { id: treatment.id },
          data: { atRiskNotifiedAt: now },
        });

        result.notifiedCount++;
      } catch (error) {
        const errorMsg = `Failed to process at-risk treatment ${treatment.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[Treatment SLA] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(
      `[Treatment SLA] Processed ${result.processedCount} at-risk treatments, notified ${result.notifiedCount}`
    );

    return result;
  } catch (error) {
    const errorMsg = `Treatment SLA at-risk processing failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(`[Treatment SLA] ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Send SLA breached notifications to risk owners and GRC analysts
 * Story 16.8 AC9, AC10
 */
async function sendSlaBreachedNotifications(
  treatment: {
    id: string;
    organizationId: string;
    riskId: string;
    treatmentType: string;
    dueDate: Date | null;
    risk: {
      title: string;
      description?: string | null;
      severity?: string | null;
      itOwnerId?: string | null;
      businessOwnerId?: string | null;
      ITOwner?: { email: string | null; name: string | null } | null;
      BusinessOwner?: { email: string | null; name: string | null } | null;
    };
  },
  now: Date
): Promise<void> {
  if (!treatment.dueDate) return;

  const daysOverdue = Math.floor(
    (now.getTime() - treatment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get organization name
  const org = await db.organization.findUnique({
    where: { id: treatment.organizationId },
    select: { name: true },
  });

  // Get GRC Analysts for the organization
  const grcAnalysts = await db.user.findMany({
    where: {
      organizationId: treatment.organizationId,
      platformRole: UserRole.ANALYST,
    },
    select: { id: true, email: true, name: true },
  });

  // Collect recipients (risk owners + GRC analysts)
  const recipients: { email: string; name: string; role: string }[] = [];

  if (treatment.risk.ITOwner?.email) {
    recipients.push({
      email: treatment.risk.ITOwner.email,
      name: treatment.risk.ITOwner.name ?? "IT Owner",
      role: "IT_OWNER",
    });
  }

  if (treatment.risk.BusinessOwner?.email) {
    recipients.push({
      email: treatment.risk.BusinessOwner.email,
      name: treatment.risk.BusinessOwner.name ?? "Business Owner",
      role: "BUSINESS_OWNER",
    });
  }

  for (const analyst of grcAnalysts) {
    if (analyst.email && !recipients.some((r) => r.email === analyst.email)) {
      recipients.push({
        email: analyst.email,
        name: analyst.name ?? "GRC Analyst",
        role: "GRC_ANALYST",
      });
    }
  }

  // Send email to each recipient
  for (const recipient of recipients) {
    try {
      const emailContent = renderSlaBreachedEmail({
        riskId: treatment.riskId,
        riskTitle: treatment.risk.title,
        severity: treatment.risk.severity ?? "Medium",
        treatmentType: treatment.treatmentType,
        dueDate: treatment.dueDate,
        daysOverdue,
        recipientName: recipient.name,
        recipientRole: recipient.role,
        description: treatment.risk.description ?? "",
        organizationName: org?.name ?? "Your Organization",
      });

      await enqueueEmail({
        to: recipient.email,
        subject: emailContent.subject,
        htmlContent: emailContent.html,
        textContent: emailContent.text,
        emailType: "SLA_BREACHED",
        relatedEntityType: "RiskTreatment",
        relatedEntityId: treatment.id,
        organizationId: treatment.organizationId,
      });

      console.log(`[Treatment SLA] Breach notification queued for ${recipient.email}`);
    } catch (error) {
      console.error(
        `[Treatment SLA] Failed to queue breach notification for ${recipient.email}:`,
        error
      );
    }
  }
}

/**
 * Send SLA at-risk notifications to risk owners and GRC analysts
 * Story 16.8 AC8, AC10
 */
async function sendSlaAtRiskNotifications(
  treatment: {
    id: string;
    organizationId: string;
    riskId: string;
    treatmentType: string;
    dueDate: Date | null;
    risk: {
      title: string;
      description?: string | null;
      severity?: string | null;
      itOwnerId?: string | null;
      businessOwnerId?: string | null;
      ITOwner?: { id: string; email: string | null; name: string | null } | null;
      BusinessOwner?: { id: string; email: string | null; name: string | null } | null;
    };
    organization?: { name: string } | null;
  },
  daysRemaining: number
): Promise<void> {
  if (!treatment.dueDate) return;

  const orgName = treatment.organization?.name ?? "Your Organization";

  // Get GRC Analysts for the organization
  const grcAnalysts = await db.user.findMany({
    where: {
      organizationId: treatment.organizationId,
      platformRole: UserRole.ANALYST,
    },
    select: { id: true, email: true, name: true },
  });

  // Collect recipients (risk owners + GRC analysts)
  const recipients: { email: string; name: string; role: string }[] = [];

  if (treatment.risk.ITOwner?.email) {
    recipients.push({
      email: treatment.risk.ITOwner.email,
      name: treatment.risk.ITOwner.name ?? "IT Owner",
      role: "IT_OWNER",
    });
  }

  if (treatment.risk.BusinessOwner?.email) {
    recipients.push({
      email: treatment.risk.BusinessOwner.email,
      name: treatment.risk.BusinessOwner.name ?? "Business Owner",
      role: "BUSINESS_OWNER",
    });
  }

  for (const analyst of grcAnalysts) {
    if (analyst.email && !recipients.some((r) => r.email === analyst.email)) {
      recipients.push({
        email: analyst.email,
        name: analyst.name ?? "GRC Analyst",
        role: "GRC_ANALYST",
      });
    }
  }

  // Send email to each recipient
  for (const recipient of recipients) {
    try {
      const emailContent = renderSlaAtRiskEmail({
        riskId: treatment.riskId,
        riskTitle: treatment.risk.title,
        severity: treatment.risk.severity ?? "Medium",
        treatmentType: treatment.treatmentType,
        dueDate: treatment.dueDate,
        daysRemaining,
        recipientName: recipient.name,
        recipientRole: recipient.role,
        description: treatment.risk.description ?? "",
        organizationName: orgName,
      });

      await enqueueEmail({
        to: recipient.email,
        subject: emailContent.subject,
        htmlContent: emailContent.html,
        textContent: emailContent.text,
        emailType: "SLA_AT_RISK",
        relatedEntityType: "RiskTreatment",
        relatedEntityId: treatment.id,
        organizationId: treatment.organizationId,
      });

      console.log(`[Treatment SLA] At-risk notification queued for ${recipient.email}`);
    } catch (error) {
      console.error(
        `[Treatment SLA] Failed to queue at-risk notification for ${recipient.email}:`,
        error
      );
    }
  }
}
