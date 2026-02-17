/**
 * Compliance Assessment Detail Page
 *
 * Server component that wraps the client component for assessment details.
 * Displays assessment information and allows control scoring.
 */

import { ComplianceAssessmentDetailClient } from "./client";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ComplianceAssessmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ComplianceAssessmentDetailClient assessmentId={id} />;
}
