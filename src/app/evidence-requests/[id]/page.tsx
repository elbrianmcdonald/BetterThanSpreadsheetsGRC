/**
 * Evidence Request Detail Page
 *
 * Displays full details of an evidence request and allows fulfillment.
 *
 * AC24: Recipient can click request to view detail page with full instructions
 * AC25: Detail page displays all request information
 * AC26: "Upload Evidence" button prominently displayed
 * AC27: On evidence upload, request status changes to FULFILLED
 * AC28: Fulfilled request stores evidenceId
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { AppLayout } from "@/components/layout";
import { EvidenceRequestDetailClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Evidence Request Details | BetterThanSpreadsheetsGRC",
  description: "View evidence request details and upload required evidence",
};

export default async function EvidenceRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <AppLayout breadcrumbs={[{ label: "Evidence Requests", href: "/evidence-requests" }, { label: "Request Details" }]}>
      <EvidenceRequestDetailClient requestId={id} />
    </AppLayout>
  );
}
