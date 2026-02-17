/**
 * Objective Detail Page
 *
 * Displays full objective details with KPI visualization, assignees, and comments.
 *
 * Story 2.5: Objective Detail Page UI
 * AC2: Full objective details page
 * AC3-AC5: KPI visualization and editing
 * AC6: Assignee list and management
 * AC7: Comments section
 * AC8: Status dropdown with colored badges
 */

import { Suspense } from "react";
import { ObjectiveDetailClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Objective Details | BetterThanSpreadsheetsGRC",
  description: "View and manage objective details, KPIs, and progress",
};

export default function ObjectiveDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ObjectiveDetailClient />
    </Suspense>
  );
}
