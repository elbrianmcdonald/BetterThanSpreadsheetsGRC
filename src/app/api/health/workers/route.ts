/**
 * Workers Health Check API Route
 *
 * Story 4.18: Background Job Processing for Email Sending
 *
 * AC24: Worker health check endpoint: GET /api/health/workers
 * AC25: Health check returns: status (running/stopped), lastProcessedAt,
 *       jobsProcessedLast24h, errorCount
 *
 * @see Story 4.18: Background Job Processing
 */

import { NextResponse } from "next/server";
import { getWorkerStatus } from "@/server/workers/scheduler";
import { workerMetrics } from "@/server/workers/metrics";

/**
 * Worker health response structure
 */
interface WorkerHealthResponse {
  healthy: boolean;
  timestamp: string;
  workers: {
    email: {
      status: "running" | "stopped" | "error";
      isProcessing: boolean;
      lastProcessedAt: string | null;
      jobsProcessedLast24h: number;
      jobsSucceededLast24h: number;
      jobsFailedLast24h: number;
      errorCount: number;
      lastError: string | null;
      lastErrorAt: string | null;
      avgProcessingDurationMs: number;
    };
  };
  config: {
    enabled: boolean;
    intervalMs: number;
  };
  shuttingDown: boolean;
}

/**
 * GET /api/health/workers
 *
 * Returns worker health status for monitoring and diagnostics.
 *
 * AC24: Endpoint exists at /api/health/workers
 * AC25: Returns status, lastProcessedAt, jobsProcessedLast24h, errorCount
 */
export async function GET(): Promise<NextResponse<WorkerHealthResponse>> {
  try {
    const status = getWorkerStatus();
    const emailMetrics = workerMetrics.getMetrics("email");

    // Determine overall health
    // Healthy if: workers enabled AND running AND no recent errors
    const isHealthy =
      status.config.enabled &&
      status.emailWorker.running &&
      (emailMetrics?.status !== "error" || false);

    const response: WorkerHealthResponse = {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      workers: {
        email: {
          status: emailMetrics?.status ?? "stopped",
          isProcessing: emailMetrics?.isProcessing ?? false,
          lastProcessedAt: emailMetrics?.lastProcessedAt?.toISOString() ?? null,
          jobsProcessedLast24h: emailMetrics?.jobsProcessedLast24h ?? 0,
          jobsSucceededLast24h: emailMetrics?.jobsSucceededLast24h ?? 0,
          jobsFailedLast24h: emailMetrics?.jobsFailedLast24h ?? 0,
          errorCount: emailMetrics?.errorCount ?? 0,
          lastError: emailMetrics?.lastError ?? null,
          lastErrorAt: emailMetrics?.lastErrorAt?.toISOString() ?? null,
          avgProcessingDurationMs: emailMetrics?.avgProcessingDurationMs ?? 0,
        },
      },
      config: {
        enabled: status.config.enabled,
        intervalMs: status.config.interval,
      },
      shuttingDown: status.shuttingDown,
    };

    // Return 503 if unhealthy (workers not running when they should be)
    const httpStatus = isHealthy || !status.config.enabled ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error("[Health/Workers] Check failed:", error);

    const errorResponse: WorkerHealthResponse = {
      healthy: false,
      timestamp: new Date().toISOString(),
      workers: {
        email: {
          status: "error",
          isProcessing: false,
          lastProcessedAt: null,
          jobsProcessedLast24h: 0,
          jobsSucceededLast24h: 0,
          jobsFailedLast24h: 0,
          errorCount: 1,
          lastError: error instanceof Error ? error.message : "Unknown error",
          lastErrorAt: new Date().toISOString(),
          avgProcessingDurationMs: 0,
        },
      },
      config: {
        enabled: false,
        intervalMs: 30000,
      },
      shuttingDown: false,
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}
