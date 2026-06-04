/**
 * Finding SLA Breach Detection Cron API Route
 *
 * Story 14.8: SLA Breach Detection Job
 *
 * Endpoint to trigger SLA breach detection processing.
 * Should be called by a scheduled job (e.g., daily cron).
 *
 * AC1: Scheduled job runs daily (configurable)
 * AC2: Queries findings with status IN (NEW, TRIAGED), dueDate < today, slaBreached = false
 * AC3: Updates slaBreached = true for matching findings
 * AC4: Logs breach events for audit
 *
 * Security:
 * - Requires CRON_SECRET in Authorization header
 * - Returns 401 if unauthorized
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import {
  processFindingSlaBreaches,
  getSlaBreachStats,
} from "@/server/services/finding-sla-breach.service";

/**
 * POST /api/cron/finding-sla-breach
 *
 * Triggers the SLA breach detection job.
 * Called by external cron scheduler (Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(request: NextRequest) {
  const denied = verifyCronRequest(request);
  if (denied) return denied;

  console.log("[Cron] Starting finding SLA breach detection...");

  try {
    const result = await processFindingSlaBreaches();

    console.log(`[Cron] SLA breach detection complete:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Cron] Error processing SLA breaches:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/finding-sla-breach
 *
 * Health check and stats endpoint for the cron job.
 */
export async function GET() {
  try {
    const stats = await getSlaBreachStats();

    return NextResponse.json({
      status: "ok",
      endpoint: "finding-sla-breach",
      description: "Call POST to process SLA breaches",
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
