/**
 * Strategy Dashboard Page
 *
 * Executive dashboard showing strategy progress at a glance.
 *
 * Story 5.2: Executive Dashboard Page
 * AC1: Summary cards (Total/Active/Progress/Overdue)
 * AC2: Horizontal bar chart for strategy progress
 * AC3: Pie chart for objectives by status
 * AC4: Overdue objectives alert section
 * AC5: Empty state with CTA
 * AC6: Strategy filter dropdown
 */

import { Suspense } from "react";
import { StrategyDashboardClient } from "./client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy Dashboard | BetterThanSpreadsheetsGRC",
  description: "Executive dashboard for security strategy progress and metrics",
};

export default function StrategyDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <StrategyDashboardClient />
    </Suspense>
  );
}
