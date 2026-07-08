/**
 * Finding SLA Breach Detection Service
 *
 * Story 14.8: SLA Breach Detection Job
 *
 * Scheduled job to detect SLA breaches on findings and send notifications.
 */

import { db } from "@/server/db";
import { FindingStatus, AuditAction } from "@prisma/client";
import { PUBLISHED_FINDINGS_AND } from "@/server/services/findingVisibility";

interface SlaBreachResult {
  processedCount: number;
  breachedCount: number;
  errors: string[];
}

/**
 * Process SLA breaches for all organizations
 *
 * Story 14.8: SLA Breach Detection
 * AC1: Scheduled job runs daily (called by cron)
 * AC2: Queries findings with dueDate < today, slaBreached = false
 * AC3: Updates slaBreached = true for matching findings
 * AC4: Logs breach events for audit
 */
export async function processFindingSlaBreaches(): Promise<SlaBreachResult> {
  const result: SlaBreachResult = {
    processedCount: 0,
    breachedCount: 0,
    errors: [],
  };

  const now = new Date();

  try {
    // Find all open findings that are past due and not yet marked breached.
    // Unpublished assessment findings don't accrue register SLA breaches
    // (2026-07-06) — their clock starts when the assessment is approved.
    const overdueFindings = await db.finding.findMany({
      where: {
        status: {
          in: [
            FindingStatus.NEW,
            FindingStatus.TRIAGED,
            FindingStatus.NEEDS_INFO,
          ],
        },
        dueDate: { lt: now },
        slaBreached: false,
        ...PUBLISHED_FINDINGS_AND,
      },
      select: {
        id: true,
        identifier: true,
        organizationId: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        createdBy: true,
        assignee: { select: { email: true, name: true } },
        creator: { select: { email: true, name: true } },
      },
    });

    result.processedCount = overdueFindings.length;

    if (overdueFindings.length === 0) {
      console.log("[SLA Breach] No overdue findings found");
      return result;
    }

    // Update all overdue findings to mark as breached
    const updateResult = await db.finding.updateMany({
      where: {
        id: { in: overdueFindings.map((f) => f.id) },
      },
      data: { slaBreached: true },
    });

    result.breachedCount = updateResult.count;

    // Log breach events
    for (const finding of overdueFindings) {
      try {
        await db.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: finding.organizationId,
            userId: "system",
            action: AuditAction.FINDING_SLA_BREACHED,
            entityType: "Finding",
            entityId: finding.id,
            changes: {
              identifier: finding.identifier,
              title: finding.title,
              dueDate: finding.dueDate?.toISOString(),
              breachedAt: now.toISOString(),
            },
          },
        });

        // TODO: Story 14.8 AC4 - Send notification to assignee and creator
        // This can be implemented by adding to the email queue
        // if (finding.assignee?.email) {
        //   await queueEmail({ ... });
        // }
      } catch (logError) {
        const errorMsg = `Failed to log breach for ${finding.identifier}: ${logError instanceof Error ? logError.message : "Unknown error"}`;
        console.error(`[SLA Breach] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(
      `[SLA Breach] Processed ${result.processedCount} findings, marked ${result.breachedCount} as breached`
    );

    return result;
  } catch (error) {
    const errorMsg = `SLA breach processing failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error(`[SLA Breach] ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Get SLA breach statistics
 */
export async function getSlaBreachStats() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [breached, atRisk, onTrack] = await Promise.all([
    // Breached: past due or marked breached
    db.finding.count({
      where: {
        status: {
          in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO],
        },
        OR: [{ slaBreached: true }, { dueDate: { lt: now } }],
        ...PUBLISHED_FINDINGS_AND,
      },
    }),
    // At Risk: due within 3 days
    db.finding.count({
      where: {
        status: {
          in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO],
        },
        dueDate: { gte: now, lte: threeDaysFromNow },
        slaBreached: false,
        ...PUBLISHED_FINDINGS_AND,
      },
    }),
    // On Track: due more than 3 days out
    db.finding.count({
      where: {
        status: {
          in: [FindingStatus.NEW, FindingStatus.TRIAGED, FindingStatus.NEEDS_INFO],
        },
        dueDate: { gt: threeDaysFromNow },
        slaBreached: false,
        ...PUBLISHED_FINDINGS_AND,
      },
    }),
  ]);

  return { breached, atRisk, onTrack };
}
