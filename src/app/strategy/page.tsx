/**
 * Strategy List Page
 *
 * Displays a list of all security strategies in the organization
 * with filtering, sorting, and navigation to individual strategy details.
 *
 * Story 1.4: Strategy List Page UI
 * AC1: Table/grid of strategies with Title, Status, Fiscal Year, Progress %, Owner, Updated Date
 * AC2: Status filter dropdown
 * AC3: Create Strategy button
 * AC4: Clickable rows to detail page
 * AC5: Strategy appears in top-level navigation
 */

import { Suspense } from "react";
import { StrategyListClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Strategy | BetterThanSpreadsheetsGRC",
  description: "View and manage security strategies across your organization",
};

export default function StrategyListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <StrategyListClient />
    </Suspense>
  );
}
