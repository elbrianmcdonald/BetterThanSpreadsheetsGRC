/**
 * Treatment Decision Page
 *
 * Story 16.7: Treatment Decision Page
 *
 * Allows users to make formal treatment decisions for risks.
 * - AC7: Page at /risks/[id]/treatment
 *
 * @see Story 16.7: Treatment Decision Page
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TreatmentDecisionClient } from "./client";

interface TreatmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function TreatmentPage({ params }: TreatmentPageProps) {
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
      <TreatmentDecisionClient riskId={id} />
    </Suspense>
  );
}
