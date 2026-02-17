import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MyAssignmentsKanbanClient } from "./client";

/**
 * My Assignments Kanban Page
 *
 * Kanban board view of the current user's assigned tasks.
 * Columns: To Do, In Progress, Completed
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Assignments | BetterThanSpreadsheetsGRC",
  description: "View and manage your assigned assessment tasks",
};

export default function MyAssignmentsKanbanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MyAssignmentsKanbanClient />
    </Suspense>
  );
}
