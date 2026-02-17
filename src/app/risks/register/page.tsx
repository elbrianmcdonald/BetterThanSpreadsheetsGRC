/**
 * Risk Register Page
 *
 * Story 16.5: Unified Risk Register Page (AC8)
 *
 * Displays all risk register entries with filtering, sorting, and navigation.
 * Shows summary stats cards and supports status/owner/BU/severity filters.
 *
 * @see Story 16.5: Unified Risk Register Page
 */

import { Suspense } from "react";
import { RiskRegisterClient } from "./client";

export const metadata = {
  title: "Risk Register | BetterThanSpreadsheetsGRC",
  description: "Unified view of organizational risks from assessments",
};

export default function RiskRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <RiskRegisterClient />
    </Suspense>
  );
}
