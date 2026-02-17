/**
 * Standard Detail Page
 *
 * Displays a single standard with its controls, framework mappings,
 * and exception management capabilities.
 *
 * Standards Module: Standard Detail UI
 * - Standard header with title, status, owner, dates
 * - Controls list with CRUD operations
 * - Framework mapping matrix
 * - Exception management
 */

import { Suspense } from "react";
import { StandardDetailClient } from "./client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Standard Details | BetterThanSpreadsheetsGRC",
  description: "View and manage organizational standard details",
};

export default function StandardDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <StandardDetailClient />
    </Suspense>
  );
}
