/**
 * Compliance Plan detail page (Bridge to Compliance Plan — Epic 1).
 */

import { CompliancePlanDetailClient } from "./client";

export default async function CompliancePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompliancePlanDetailClient planId={id} />;
}
