import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { UnifiedAssignmentsClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Assignments | BetterThanSpreadsheets GRC",
  description: "View and manage all your work assignments across the platform",
};

export default function MyAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <UnifiedAssignmentsClient />
    </Suspense>
  );
}
