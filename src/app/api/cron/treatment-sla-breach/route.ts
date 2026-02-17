/**
 * Treatment SLA Breach Detection Cron API Route
 *
 * Story 15.9: Risk Treatment SLA Enforcement
 *
 * Endpoint to trigger treatment SLA breach detection processing.
 * Should be called by a scheduled job (e.g., daily cron).
 *
 * AC1: Scheduled job runs daily (configurable)
 * AC2: Queries treatments with dueDate < today, slaBreached = false, completedAt = null
 * AC3: Updates slaBreached = true for matching treatments
 * AC4: Logs breach events for audit
 *
 * Security:
 * - Requires CRON_SECRET in Authorization header
 * - Returns 401 if unauthorized
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processTreatmentSlaBreaches,
  getTreatmentSlaBreachStats,
} from "@/server/services/treatment-sla-breach.service";

/**
 * POST /api/cron/treatment-sla-breach
 *
 * Triggers the treatment SLA breach detection job.
 * Called by external cron scheduler (Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Skip auth check if no secret configured (development)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized treatment SLA breach job attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Starting treatment SLA breach detection...");

  try {
    const result = await processTreatmentSlaBreaches();

    console.log(`[Cron] Treatment SLA breach detection complete:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Cron] Error processing treatment SLA breaches:", error);

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
 * GET /api/cron/treatment-sla-breach
 *
 * Health check and stats endpoint for the cron job.
 */
export async function GET() {
  try {
    const stats = await getTreatmentSlaBreachStats();

    return NextResponse.json({
      status: "ok",
      endpoint: "treatment-sla-breach",
      description: "Call POST to process treatment SLA breaches",
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
