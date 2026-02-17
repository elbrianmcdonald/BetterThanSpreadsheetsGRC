/**
 * Worker Scheduler (Story 4.15 + Story 4.18 Enhancements)
 *
 * Manages background workers for scheduled tasks.
 *
 * Story 4.15:
 * - AC12: Email worker runs every 30 seconds
 *
 * Story 4.18 Enhancements:
 * - AC8: Worker scheduler uses setInterval for job execution
 * - AC9: Worker includes graceful shutdown on SIGTERM/SIGINT
 * - AC10: Worker errors logged to application logs with full context
 * - AC11: Worker startup logged with timestamp and configuration
 * - AC31: Worker configuration via environment variables
 *
 * Usage:
 * - Call startWorkers() on app startup
 * - Call stopWorkers() on graceful shutdown
 */

import { processEmailQueue } from "./emailWorker";
import { processVendorReviewAlerts, resetDailyAlerts } from "./vendorReviewAlertsWorker";
import { workerMetrics } from "./metrics";
import { env } from "@/env.js";

/**
 * Default interval (30 seconds), can be overridden by WORKER_INTERVAL env var
 */
const DEFAULT_INTERVAL_MS = 30 * 1000;

/**
 * Get configured worker interval from env or use default
 */
function getWorkerInterval(): number {
  return env.WORKER_INTERVAL ?? DEFAULT_INTERVAL_MS;
}

/**
 * Default interval for daily workers (24 hours in production, 1 hour for testing)
 */
const DEFAULT_DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Active interval handles
 */
let emailWorkerInterval: NodeJS.Timeout | null = null;
let reviewAlertsWorkerInterval: NodeJS.Timeout | null = null;

/**
 * Flag to prevent concurrent runs
 */
let isProcessingEmails = false;
let isProcessingReviewAlerts = false;

/**
 * Flag for graceful shutdown
 */
let isShuttingDown = false;

/**
 * Promise that resolves when current batch completes (for graceful shutdown)
 */
let currentBatchPromise: Promise<void> | null = null;

/**
 * Start the email queue worker
 *
 * AC8: Uses setInterval for job execution
 * AC11: Logs startup with timestamp and configuration
 * AC31: Uses WORKER_INTERVAL env var
 */
export function startEmailWorker(): void {
  if (emailWorkerInterval) {
    console.log("[Scheduler] Email worker already running");
    return;
  }

  if (isShuttingDown) {
    console.log("[Scheduler] Cannot start email worker during shutdown");
    return;
  }

  const interval = getWorkerInterval();

  // Initialize metrics
  workerMetrics.initializeWorker("email");
  workerMetrics.markStarted("email");

  // Run immediately on startup
  void runEmailWorker();

  // Schedule periodic runs
  emailWorkerInterval = setInterval(() => {
    if (!isShuttingDown) {
      void runEmailWorker();
    }
  }, interval);

  // AC11: Log startup with configuration
  console.log(
    `[Scheduler] Email worker started at ${new Date().toISOString()} (interval: ${interval}ms)`
  );
}

/**
 * Run email worker with concurrency guard and metrics
 *
 * AC4: Logs processing metrics
 * AC10: Logs errors with full context
 */
async function runEmailWorker(): Promise<void> {
  // Prevent concurrent runs
  if (isProcessingEmails) {
    console.log("[Scheduler] Email worker already processing, skipping...");
    return;
  }

  // Don't start new batches during shutdown
  if (isShuttingDown) {
    console.log("[Scheduler] Shutdown in progress, skipping batch...");
    return;
  }

  isProcessingEmails = true;
  workerMetrics.setProcessing("email", true);

  const startTime = Date.now();

  // Track current batch for graceful shutdown
  currentBatchPromise = (async () => {
    try {
      const result = await processEmailQueue();

      // Record metrics
      const durationMs = Date.now() - startTime;
      workerMetrics.recordBatch("email", {
        processed: result.processed,
        succeeded: result.sent,
        failed: result.failed,
        durationMs,
      });
      workerMetrics.clearError("email");

      // AC4: Log processing metrics if any emails were processed
      if (result.processed > 0) {
        const successRate =
          result.processed > 0
            ? Math.round((result.sent / result.processed) * 100)
            : 100;
        console.log(
          `[Scheduler] Email batch completed: ${result.processed} processed, ` +
            `${result.sent} sent (${successRate}% success), ${result.failed} failed, ` +
            `duration: ${durationMs}ms`
        );
      }
    } catch (error) {
      // AC10: Log error with full context
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      console.error("[Scheduler] Email worker error:", {
        error: errorMessage,
        stack,
        timestamp: new Date().toISOString(),
        wasProcessing: isProcessingEmails,
      });

      workerMetrics.recordError("email", errorMessage);
    } finally {
      isProcessingEmails = false;
      workerMetrics.setProcessing("email", false);
      currentBatchPromise = null;
    }
  })();

  await currentBatchPromise;
}

/**
 * Stop the email queue worker
 */
export function stopEmailWorker(): void {
  if (emailWorkerInterval) {
    clearInterval(emailWorkerInterval);
    emailWorkerInterval = null;
    workerMetrics.markStopped("email");
    console.log("[Scheduler] Email worker stopped");
  }
}

/**
 * Start the vendor review alerts worker (FR65)
 *
 * Runs daily to send reminders and overdue alerts for vendor reviews.
 */
export function startReviewAlertsWorker(): void {
  if (reviewAlertsWorkerInterval) {
    console.log("[Scheduler] Review alerts worker already running");
    return;
  }

  if (isShuttingDown) {
    console.log("[Scheduler] Cannot start review alerts worker during shutdown");
    return;
  }

  // Initialize metrics
  workerMetrics.initializeWorker("reviewAlerts");
  workerMetrics.markStarted("reviewAlerts");

  // Reset daily tracking
  resetDailyAlerts();

  // Run immediately on startup
  void runReviewAlertsWorker();

  // Schedule daily runs (24 hours)
  reviewAlertsWorkerInterval = setInterval(() => {
    if (!isShuttingDown) {
      // Reset daily tracking at the start of each day
      resetDailyAlerts();
      void runReviewAlertsWorker();
    }
  }, DEFAULT_DAILY_INTERVAL_MS);

  console.log(
    `[Scheduler] Review alerts worker started at ${new Date().toISOString()} (interval: daily)`
  );
}

/**
 * Run review alerts worker with concurrency guard and metrics
 */
async function runReviewAlertsWorker(): Promise<void> {
  // Prevent concurrent runs
  if (isProcessingReviewAlerts) {
    console.log("[Scheduler] Review alerts worker already processing, skipping...");
    return;
  }

  if (isShuttingDown) {
    console.log("[Scheduler] Shutdown in progress, skipping review alerts batch...");
    return;
  }

  isProcessingReviewAlerts = true;
  workerMetrics.setProcessing("reviewAlerts", true);

  const startTime = Date.now();

  try {
    const result = await processVendorReviewAlerts();

    // Record metrics
    const durationMs = Date.now() - startTime;
    workerMetrics.recordBatch("reviewAlerts", {
      processed: result.processed,
      succeeded: result.remindersSent + result.overduesSent,
      failed: result.errors,
      durationMs,
    });
    workerMetrics.clearError("reviewAlerts");

    // Log results
    if (result.processed > 0) {
      console.log(
        `[Scheduler] Review alerts batch completed: ${result.processed} vendors processed, ` +
          `${result.remindersSent} reminders, ${result.overduesSent} overdue alerts, ` +
          `${result.errors} errors, duration: ${durationMs}ms`
      );
    } else {
      console.log(`[Scheduler] Review alerts batch completed: no vendors requiring alerts`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[Scheduler] Review alerts worker error:", {
      error: errorMessage,
      stack,
      timestamp: new Date().toISOString(),
    });

    workerMetrics.recordError("reviewAlerts", errorMessage);
  } finally {
    isProcessingReviewAlerts = false;
    workerMetrics.setProcessing("reviewAlerts", false);
  }
}

/**
 * Stop the review alerts worker
 */
export function stopReviewAlertsWorker(): void {
  if (reviewAlertsWorkerInterval) {
    clearInterval(reviewAlertsWorkerInterval);
    reviewAlertsWorkerInterval = null;
    workerMetrics.markStopped("reviewAlerts");
    console.log("[Scheduler] Review alerts worker stopped");
  }
}

/**
 * Start all workers
 *
 * AC30: Worker starts automatically when app starts
 * AC31: Respects WORKER_ENABLED env var
 */
export function startWorkers(): void {
  // AC31: Check if workers are enabled
  if (!env.WORKER_ENABLED) {
    console.log("[Scheduler] Workers disabled via WORKER_ENABLED=false");
    return;
  }

  console.log("[Scheduler] Starting background workers...");
  startEmailWorker();
  startReviewAlertsWorker(); // FR65: Vendor review alerts
  console.log("[Scheduler] All workers started");
}

/**
 * Stop all workers with graceful shutdown
 *
 * AC9: Graceful shutdown - finish current batch before exit
 *
 * @param timeout - Maximum time to wait for current batch (default: 10000ms)
 */
export async function stopWorkers(timeout = 10000): Promise<void> {
  if (isShuttingDown) {
    console.log("[Scheduler] Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  console.log("[Scheduler] Stopping background workers gracefully...");

  // Stop scheduling new batches
  stopEmailWorker();
  stopReviewAlertsWorker(); // FR65: Vendor review alerts

  // AC9: Wait for current batch to complete (with timeout)
  if (currentBatchPromise) {
    console.log("[Scheduler] Waiting for current batch to complete...");

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log("[Scheduler] Shutdown timeout reached, forcing exit");
        resolve();
      }, timeout);
    });

    await Promise.race([currentBatchPromise, timeoutPromise]);
  }

  console.log("[Scheduler] All workers stopped");
}

/**
 * Check if email worker is running
 */
export function isEmailWorkerRunning(): boolean {
  return emailWorkerInterval !== null;
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Get worker status (for health checks)
 */
export function getWorkerStatus(): {
  emailWorker: { running: boolean; processing: boolean };
  reviewAlertsWorker: { running: boolean; processing: boolean };
  shuttingDown: boolean;
  config: { interval: number; enabled: boolean };
} {
  return {
    emailWorker: {
      running: emailWorkerInterval !== null,
      processing: isProcessingEmails,
    },
    reviewAlertsWorker: {
      running: reviewAlertsWorkerInterval !== null,
      processing: isProcessingReviewAlerts,
    },
    shuttingDown: isShuttingDown,
    config: {
      interval: getWorkerInterval(),
      enabled: env.WORKER_ENABLED ?? true,
    },
  };
}

/**
 * Reset shutdown state (for testing)
 */
export function resetShutdownState(): void {
  isShuttingDown = false;
}
