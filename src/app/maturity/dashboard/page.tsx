/**
 * Maturity Dashboard Page
 *
 * Displays aggregated maturity assessment data with:
 * - Summary statistics across all frameworks
 * - Progress charts (radar, bar, trend)
 * - Framework comparison
 * - Recent assessments
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { MaturityDashboardClient } from "./client";

export const metadata: Metadata = {
  title: "Maturity Dashboard | BetterThanSpreadsheets GRC",
  description: "Overview of organizational maturity across security frameworks",
};

export default function MaturityDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <MaturityDashboardClient />
    </Suspense>
  );
}
