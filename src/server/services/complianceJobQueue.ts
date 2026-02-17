/**
 * Compliance Job Queue Service
 *
 * Story 5.3: Automatic Compliance Updates (Evidence/Risk Triggers)
 *
 * Manages a job queue for compliance recalculation tasks with:
 * - AC5/AC9: Debouncing to batch rapid updates (10 second window)
 * - AC18: Deduplication to prevent duplicate jobs for same framework
 * - AC14: Background job processing
 * - AC16: Retry logic (max 3 attempts)
 * - AC17: Job failures logged but don't block user operations
 *
 * @see Story 5.3: Automatic Compliance Updates
 * @module server/services/complianceJobQueue
 */

import type { PrismaClient } from "@prisma/client";
import { refreshFrameworkCoverage } from "./complianceCalculator";
import { JobType, JobPriority, addJobHistory, type JobHistoryEntry } from "../workers/jobTypes";

/**
 * Compliance recalculation job data
 */
interface ComplianceRecalculationJob {
  frameworkId: string;
  organizationId: string;
  queuedAt: Date;
  retryCount: number;
  triggeredBy: "evidence_upload" | "evidence_delete" | "risk_closure" | "manual";
}

/**
 * Pending jobs map (frameworkId_orgId -> job data)
 * Used for deduplication and debouncing
 */
const pendingJobs = new Map<string, ComplianceRecalculationJob>();

/**
 * Debounce timers (frameworkId_orgId -> timeout handle)
 */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Processing flag to prevent concurrent processing
 */
let isProcessing = false;

/**
 * Debounce window in milliseconds
 * AC5: Debounce job queuing (if same framework queued within 10 seconds, skip)
 */
const DEBOUNCE_WINDOW_MS = 10 * 1000;

/**
 * Maximum retry attempts
 * AC16: Failed recalculations retry up to 3 times
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Queue a compliance recalculation job for a framework
 *
 * AC5/AC9: If same framework queued within debounce window, resets timer
 * AC18: Deduplicates jobs for same framework
 *
 * @param frameworkId - The framework to recalculate
 * @param organizationId - The organization
 * @param triggeredBy - What triggered this recalculation
 */
export function queueComplianceRecalculation(
  frameworkId: string,
  organizationId: string,
  triggeredBy: ComplianceRecalculationJob["triggeredBy"]
): void {
  const jobKey = `${frameworkId}_${organizationId}`;

  // Clear existing debounce timer if any (reset the window)
  const existingTimer = debounceTimers.get(jobKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    console.log(`[ComplianceQueue] Reset debounce timer for framework ${frameworkId}`);
  }

  // AC18: Update or create pending job (deduplication)
  pendingJobs.set(jobKey, {
    frameworkId,
    organizationId,
    queuedAt: new Date(),
    retryCount: 0,
    triggeredBy,
  });

  // Set new debounce timer
  const timer = setTimeout(() => {
    debounceTimers.delete(jobKey);
    console.log(`[ComplianceQueue] Debounce window closed for framework ${frameworkId}, processing...`);
    // Trigger processing
    void processNextJob();
  }, DEBOUNCE_WINDOW_MS);

  debounceTimers.set(jobKey, timer);

  console.log(
    `[ComplianceQueue] Queued recalculation for framework ${frameworkId} ` +
    `(triggered by: ${triggeredBy}, debounce: ${DEBOUNCE_WINDOW_MS}ms)`
  );
}

/**
 * Queue recalculation for multiple frameworks
 *
 * AC3: Only affected frameworks recalculated (not all frameworks)
 *
 * @param frameworkIds - Array of framework IDs to recalculate
 * @param organizationId - The organization
 * @param triggeredBy - What triggered this recalculation
 */
export function queueMultipleFrameworkRecalculations(
  frameworkIds: string[],
  organizationId: string,
  triggeredBy: ComplianceRecalculationJob["triggeredBy"]
): void {
  for (const frameworkId of frameworkIds) {
    queueComplianceRecalculation(frameworkId, organizationId, triggeredBy);
  }
}

/**
 * Process the next pending job
 *
 * AC14: Compliance recalculation runs in background job queue
 * AC15: Job processes within 5 seconds of trigger event
 */
async function processNextJob(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  // Find a job that's ready (debounce timer expired)
  const readyJobKey = findReadyJob();
  if (!readyJobKey) {
    return;
  }

  const job = pendingJobs.get(readyJobKey);
  if (!job) {
    return;
  }

  // Remove from pending (we're processing it now)
  pendingJobs.delete(readyJobKey);

  isProcessing = true;
  const startTime = Date.now();

  // Create history entry
  const historyEntry: JobHistoryEntry = {
    id: `compliance_${job.frameworkId}_${Date.now()}`,
    jobType: JobType.COMPLIANCE_REFRESH,
    priority: JobPriority.NORMAL,
    status: "processing",
    createdAt: job.queuedAt,
    startedAt: new Date(),
    completedAt: null,
    result: null,
    retryCount: job.retryCount,
  };

  try {
    // Import db dynamically to avoid circular dependency
    const { db } = await import("@/server/db");

    // AC15: Process job (should complete within 5 seconds per AC15)
    await refreshFrameworkCoverage(job.frameworkId, job.organizationId, db);

    const durationMs = Date.now() - startTime;
    console.log(
      `[ComplianceQueue] ✅ Recalculated coverage for framework ${job.frameworkId} ` +
      `in ${durationMs}ms (triggered by: ${job.triggeredBy})`
    );

    // Update history
    historyEntry.status = "completed";
    historyEntry.completedAt = new Date();
    historyEntry.result = {
      success: true,
      message: `Recalculated in ${durationMs}ms`,
    };
    addJobHistory(historyEntry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // AC17: Job failures logged but don't block user operations
    console.error(
      `[ComplianceQueue] ❌ Failed to recalculate coverage for framework ${job.frameworkId}:`,
      errorMessage
    );

    // AC16: Retry up to 3 times
    if (job.retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(
        `[ComplianceQueue] Scheduling retry ${job.retryCount + 1}/${MAX_RETRY_ATTEMPTS} ` +
        `for framework ${job.frameworkId}`
      );

      // Re-queue with incremented retry count
      pendingJobs.set(readyJobKey, {
        ...job,
        retryCount: job.retryCount + 1,
        queuedAt: new Date(),
      });

      // Schedule retry after short delay
      setTimeout(() => {
        void processNextJob();
      }, 2000); // 2 second delay before retry
    } else {
      console.error(
        `[ComplianceQueue] Max retries (${MAX_RETRY_ATTEMPTS}) exceeded for framework ${job.frameworkId}`
      );

      // Update history with failure
      historyEntry.status = "failed";
      historyEntry.completedAt = new Date();
      historyEntry.result = {
        success: false,
        error: errorMessage,
      };
      addJobHistory(historyEntry);
    }
  } finally {
    isProcessing = false;

    // Process next job if any
    void processNextJob();
  }
}

/**
 * Find a job that's ready to process (debounce timer expired)
 */
function findReadyJob(): string | undefined {
  for (const [jobKey] of pendingJobs) {
    // If there's no active debounce timer, the job is ready
    if (!debounceTimers.has(jobKey)) {
      return jobKey;
    }
  }
  return undefined;
}

/**
 * Get affected framework IDs from evidence control domain mappings
 *
 * AC1/AC6: Extract affected frameworks from evidence control mappings
 *
 * @param evidenceId - The evidence ID
 * @param db - Prisma client
 * @returns Array of framework IDs
 */
export async function getAffectedFrameworkIdsForEvidence(
  evidenceId: string,
  db: PrismaClient
): Promise<string[]> {
  // Get control domain IDs for this evidence
  const evidenceControlDomains = await db.evidenceControlDomain.findMany({
    where: { evidenceId },
    select: { controlDomainId: true },
  });

  if (evidenceControlDomains.length === 0) {
    return [];
  }

  const controlDomainIds = evidenceControlDomains.map((e) => e.controlDomainId);

  // Get framework IDs from control domain mappings
  const mappings = await db.controlDomainMapping.findMany({
    where: {
      controlDomainId: { in: controlDomainIds },
    },
    select: { frameworkCode: true },
    distinct: ["frameworkCode"],
  });

  if (mappings.length === 0) {
    return [];
  }

  const frameworkCodes = mappings.map((m) => m.frameworkCode);

  // Get framework IDs from codes
  const frameworks = await db.framework.findMany({
    where: {
      code: { in: frameworkCodes },
      isActive: true,
    },
    select: { id: true },
  });

  return frameworks.map((f) => f.id);
}

/**
 * Get affected framework IDs from a risk's linked evidence
 *
 * AC10: When risk closed with remediation evidence, linked frameworks' coverage recalculated
 * AC12: Recalculation triggered only if risk has linked evidence
 *
 * @param riskId - The risk ID
 * @param db - Prisma client
 * @returns Array of framework IDs
 */
export async function getAffectedFrameworkIdsForRisk(
  riskId: string,
  db: PrismaClient
): Promise<string[]> {
  // Get evidence IDs linked to this risk
  const riskEvidenceLinks = await db.riskEvidence.findMany({
    where: { riskId },
    select: { evidenceId: true },
  });

  if (riskEvidenceLinks.length === 0) {
    return [];
  }

  // Get all affected frameworks from all linked evidence
  const frameworkIdSets = await Promise.all(
    riskEvidenceLinks.map((link) => getAffectedFrameworkIdsForEvidence(link.evidenceId, db))
  );

  // Combine and deduplicate
  const allFrameworkIds = new Set<string>();
  for (const ids of frameworkIdSets) {
    for (const id of ids) {
      allFrameworkIds.add(id);
    }
  }

  return Array.from(allFrameworkIds);
}

/**
 * Get pending job count (for testing/monitoring)
 */
export function getPendingJobCount(): number {
  return pendingJobs.size;
}

/**
 * Get queue status (for health checks)
 */
export function getQueueStatus(): {
  pendingJobs: number;
  activeDebounceTimers: number;
  isProcessing: boolean;
} {
  return {
    pendingJobs: pendingJobs.size,
    activeDebounceTimers: debounceTimers.size,
    isProcessing,
  };
}

/**
 * Clear all pending jobs and timers (for testing)
 */
export function clearQueue(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  pendingJobs.clear();
  isProcessing = false;
}

/**
 * Force process all pending jobs immediately (for testing)
 */
export async function forceProcessAllJobs(): Promise<void> {
  // Clear all debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();

  // Process all jobs
  while (pendingJobs.size > 0) {
    await processNextJob();
  }
}
