/**
 * Evidence Request Reminders Cron API Route
 *
 * Endpoint to trigger evidence request reminder processing.
 * Should be called by a scheduled job (e.g., daily cron).
 *
 * AC35: System sends reminder email 3 days before due date
 * AC36: System sends overdue email 1 day after due date
 *
 * Security:
 * - Requires CRON_SECRET in Authorization header
 * - Returns 401 if unauthorized
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { processEvidenceRequestReminders } from "@/server/services/evidence-request-reminder.service";

/**
 * POST /api/cron/evidence-request-reminders
 *
 * Triggers the reminder processing job.
 * Called by external cron scheduler (Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Skip auth check if no secret configured (development)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Cron] Unauthorized reminder job attempt");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  console.log("[Cron] Starting evidence request reminder processing...");

  try {
    const result = await processEvidenceRequestReminders();

    console.log(`[Cron] Reminder processing complete:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Cron] Error processing reminders:", error);

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
 * GET /api/cron/evidence-request-reminders
 *
 * Health check endpoint for the cron job.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "evidence-request-reminders",
    description: "Call POST to process reminders",
  });
}
