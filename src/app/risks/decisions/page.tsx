/**
 * Decisions Pending Page (Business Stakeholder View)
 *
 * Displays risks assigned to the current Business Stakeholder for business decisions.
 *
 * Story 4.9: Role-Based Risk Views - Business Stakeholder Risk List (AC7-AC12)
 * AC7: BUSINESS_STAKEHOLDER role can only query risks where businessOwnerId = current user ID
 * AC8: Business Stakeholder risk list shows: risks assigned to them as business owner
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import { Suspense } from "react";
import { DecisionsClient } from "./client";

export const metadata = {
  title: "Risks Pending Decision | BetterThanSpreadsheetsGRC",
  description: "View risks requiring your business decision",
};

export default function DecisionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <DecisionsClient />
    </Suspense>
  );
}
