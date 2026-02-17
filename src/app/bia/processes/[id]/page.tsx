/**
 * Business Process Detail Page
 *
 * Epic 10: BIA Core Module
 * Story 10.5: Process Detail Page
 * Story 10.6: Process Status & Workaround Management
 */

import { ProcessDetailClient } from "./client";

export const metadata = {
  title: "Business Process | BetterThanSpreadsheetsGRC",
  description: "View business process details",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProcessDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ProcessDetailClient processId={id} />;
}
