/**
 * Evidence Requests Sent Page
 *
 * Displays evidence requests created by the current GRC Analyst.
 *
 * AC30: GRC Analyst sees "Evidence Requests Sent" page listing all requests they created
 * AC31: List shows: recipient name, control domains, due date, status, days since sent
 * AC32: Analyst can cancel pending request
 * AC34: Clicking fulfilled request links to evidence detail page
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { AppLayout } from "@/components/layout";
import { SentEvidenceRequestsClient } from "./client";

export const metadata = {
  title: "Evidence Requests Sent | BetterThanSpreadsheetsGRC",
  description: "Manage evidence requests you've sent to users",
};

export default function SentEvidenceRequestsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: "Evidence Requests Sent" }]}>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">
            Evidence Requests Sent
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Track and manage evidence requests you've sent to users. Monitor fulfillment status
            and follow up on pending requests.
          </p>
        </div>
      </div>

      <SentEvidenceRequestsClient />
    </AppLayout>
  );
}
