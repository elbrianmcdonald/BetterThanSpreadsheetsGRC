/**
 * Risk Detail Page
 *
 * Displays detailed information about a risk finding including
 * description, affected systems, severity, and technical details.
 *
 * Story 4.3: Risk Finding Documentation (AC23-AC27)
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RiskDetailClient } from "./client";

// Force dynamic rendering to ensure proper hydration with session-dependent UI
export const dynamic = "force-dynamic";

interface RiskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RiskDetailPage({ params }: RiskDetailPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <RiskDetailClient riskId={id} />
    </Suspense>
  );
}
