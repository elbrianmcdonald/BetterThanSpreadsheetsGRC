/**
 * Standards List Page
 *
 * Displays a list of all organizational standards with filtering,
 * sorting, and navigation to individual standard details.
 *
 * Standards Module: Standards List UI
 * - Table/grid of standards with Title, Status, Owner, Controls Count, Effective Date
 * - Status filter dropdown
 * - Create Standard button
 * - Clickable rows to detail page
 */

import { Suspense } from "react";
import { StandardsListClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Standards | BetterThanSpreadsheetsGRC",
  description: "View and manage organizational standards for compliance auditing",
};

export default function StandardsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <StandardsListClient />
    </Suspense>
  );
}
