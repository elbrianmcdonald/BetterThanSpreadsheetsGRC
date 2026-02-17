/**
 * Business Processes Page
 *
 * Epic 10: BIA Core Module
 * Story 10.4: Process List View with Search & Sort
 */

import { Suspense } from "react";
import { BusinessProcessesClient } from "./client";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Business Processes | BetterThanSpreadsheetsGRC",
  description: "Manage business processes for BIA",
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function BusinessProcessesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BusinessProcessesClient />
    </Suspense>
  );
}
