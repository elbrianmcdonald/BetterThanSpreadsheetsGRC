/**
 * Risk Registry Page
 *
 * Displays a list of all risks in the organization with filtering,
 * sorting, and navigation to individual risk details.
 *
 * Story 4.1: Risk Creation - Risk Registry list view
 */

import { Suspense } from "react";
import { RiskRegistryClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Risk Registry | BetterThanSpreadsheetsGRC",
  description: "View and manage security risks across your organization",
};

export default function RiskRegistryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <RiskRegistryClient />
    </Suspense>
  );
}
