/**
 * My Assigned Risks Page (IT Stakeholder View)
 *
 * Displays risks assigned to the current IT Stakeholder for remediation.
 *
 * Story 4.9: Role-Based Risk Views - IT Stakeholder Risk List (AC1-AC6)
 * AC1: IT_STAKEHOLDER role can only query risks where itOwnerId = current user ID
 * AC2: IT Stakeholder risk list shows: risks assigned to them as IT owner
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import { Suspense } from "react";
import { MyRisksClient } from "./client";

export const metadata = {
  title: "My Assigned Risks | BetterThanSpreadsheetsGRC",
  description: "View risks assigned to you for remediation",
};

export default function MyRisksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <MyRisksClient />
    </Suspense>
  );
}
