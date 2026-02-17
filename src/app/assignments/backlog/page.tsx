import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BacklogClient } from "./client";

/**
 * Unified Assignment Backlog Page
 *
 * Admin/GRC view to see all unassigned tasks across assessment types.
 * GRC users can self-assign tasks from this page.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Assignment Backlog | BetterThanSpreadsheetsGRC",
  description: "View and assign unassigned assessment tasks",
};

export default function BacklogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <BacklogClient />
    </Suspense>
  );
}
