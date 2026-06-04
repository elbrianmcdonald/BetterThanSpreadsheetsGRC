/**
 * Cron endpoint authentication helper.
 *
 * Centralizes the bearer-token check used by every /api/cron/* route so the
 * three callers cannot drift. Semantics:
 *
 *   - Production, secret missing  -> 503 (fail-closed; ops must configure)
 *   - Production, header mismatch -> 401
 *   - Dev, secret missing         -> allow (preserves local ergonomics)
 *   - Dev, header mismatch        -> 401 (lets devs exercise the prod path)
 *
 * The env.js schema enforces `CRON_SECRET` in production, so the
 * "production + missing" branch should never trigger after a successful
 * build — it's belt-and-suspenders for ad-hoc deployments that bypass env
 * validation via SKIP_ENV_VALIDATION.
 */

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

export function verifyCronRequest(request: NextRequest): NextResponse | null {
  const cronSecret = env.CRON_SECRET;

  if (!cronSecret) {
    if (env.NODE_ENV === "production") {
      console.error("[Cron] CRON_SECRET not configured — refusing to run job");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 503 }
      );
    }
    console.warn("[Cron] CRON_SECRET not set — allowing dev-only bypass");
    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
