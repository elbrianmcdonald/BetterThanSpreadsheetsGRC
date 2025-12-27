/**
 * My Evidence Requests Page
 *
 * Displays evidence requests assigned to the current user.
 *
 * AC19: Recipients see "My Evidence Requests" page listing all pending requests
 * AC20: Request list shows: control domains, requester, due date, status, days until due
 * AC21: Overdue requests highlighted
 * AC22: Requests sortable by due date (soonest first)
 * AC23: Request count badge displayed in navigation menu
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { AppLayout } from "@/components/layout";
import { MyEvidenceRequestsClient } from "./client";

export const metadata = {
  title: "My Evidence Requests | BetterThanSpreadsheetsGRC",
  description: "View and respond to evidence requests assigned to you",
};

export default function MyEvidenceRequestsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: "Evidence Requests" }]}>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">
            My Evidence Requests
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Evidence requests assigned to you. Upload required evidence before the due date
            to support compliance activities.
          </p>
        </div>
      </div>

      <MyEvidenceRequestsClient />
    </AppLayout>
  );
}
