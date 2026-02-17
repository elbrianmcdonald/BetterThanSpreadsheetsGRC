/**
 * Strategy Detail Page
 *
 * Displays a single strategy with its goals in an accordion view.
 *
 * Story 1.5: Strategy Detail Page with Goals
 * AC1: Strategy header with Title, Status, Progress, Owner, Fiscal Year
 * AC2: Goals in accordion/collapsible cards
 * AC3: Edit Strategy button
 * AC4: Add Goal button
 * AC5: Expanded goal details with objectives placeholder
 * AC6: Delete confirmation dialogs
 */

import { Suspense } from "react";
import { StrategyDetailClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy Details | BetterThanSpreadsheetsGRC",
  description: "View and manage strategy details and goals",
};

export default function StrategyDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <StrategyDetailClient />
    </Suspense>
  );
}
