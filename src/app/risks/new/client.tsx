"use client";

/**
 * Risk Assessment Creation Client Component
 *
 * Client-side component for creating new risk assessments with multiple identified risks.
 *
 * Features:
 * - Assessment header with title, matrix selection, business context
 * - Multiple risk items with MITRE ATT&CK mapping
 * - Inherent and residual severity calculations
 * - Controls documentation
 * - Treatment selection and SLA tracking
 *
 * Story 2.2: Also supports creating individual risks within assessment context
 * when discoveryProjectId query param is provided.
 *
 * @see Story 4.1: Risk Creation via tRPC Procedures and Web Forms
 * @see Story 2.2: Add Risk to Assessment
 */

import { useRouter, useSearchParams } from "next/navigation";
// Story 22.3: /risks/new is the ER-style aggregate-risk form. The legacy
// multi-risk RiskAssessmentForm flow lives on at /risk-assessments/new
// (assessment-container workspace) until Epic 23 retires it.
import { CreateRiskForm } from "@/components/risk/CreateRiskForm";
import { DiscoveredRiskForm } from "@/components/risk-assessment-project";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";

export function CreateRiskClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Story 2.2: Check for discoveryProjectId in URL params
  const discoveryProjectId = searchParams.get("discoveryProjectId");

  // Fetch assessment details if we have a discoveryProjectId
  const { data: assessment, isLoading: isLoadingAssessment } =
    api.riskAssessmentProject.getById.useQuery(
      { id: discoveryProjectId! },
      { enabled: !!discoveryProjectId }
    );

  // Story 2.2: If creating risk within assessment context, show simplified form
  if (discoveryProjectId) {
    if (isLoadingAssessment) {
      return (
        <AppLayout
          breadcrumbs={[
            { label: "Risk Assessments", href: "/risk-assessments" },
            { label: "Loading..." },
            { label: "Add Risk" },
          ]}
        >
          <div className="container max-w-3xl mx-auto py-6">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96 mb-8" />
            <Skeleton className="h-[400px]" />
          </div>
        </AppLayout>
      );
    }

    return (
      <AppLayout
        breadcrumbs={[
          { label: "Risk Assessments", href: "/risk-assessments" },
          {
            label: assessment?.subject || "Assessment",
            href: `/risk-assessments/${discoveryProjectId}`
          },
          { label: "Add Risk" },
        ]}
      >
        <div className="container max-w-3xl mx-auto py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              Add Discovered Risk
            </h1>
            <p className="text-muted-foreground mt-1">
              Document a risk discovered during your assessment. It will be marked as
              PENDING until the assessment is approved.
            </p>
          </div>
          <DiscoveredRiskForm
            discoveryProjectId={discoveryProjectId}
            assessmentSubject={assessment?.subject}
            onCancel={() => router.push(`/risk-assessments/${discoveryProjectId}`)}
          />
        </div>
      </AppLayout>
    );
  }

  // Default (Story 22.3): ER-style aggregate risk creation. A risk captures
  // identity + review cadence; its score derives from linked findings and/or
  // a manual judgment. Multi-risk assessments live at /risk-assessments/new.
  return (
    <AppLayout
      breadcrumbs={[
        { label: "Risks", href: "/risks" },
        { label: "New Risk" },
      ]}
    >
      <div className="container max-w-3xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Create Risk</h1>
          <p className="text-muted-foreground mt-1">
            Define the risk and how it&apos;s scored — from linked findings, a
            manual judgment, or both.
          </p>
        </div>
        <CreateRiskForm onCancel={() => router.push("/risks")} />
      </div>
    </AppLayout>
  );
}
