/**
 * Assessment Workspace Page
 *
 * Story 2.1: Assessment Workspace Page
 *
 * Displays the assessment workspace where analysts can:
 * - View assessment details (subject, status, due date, assignee)
 * - View and edit risks using the full risk assessment form
 * - Submit for review (if IN_PROGRESS and has risks)
 * - Approve/reject (if manager and SUBMITTED)
 *
 * AC1: Page accessible at `/risk-assessments/[id]`
 * AC2: Page protected - requires authenticated user
 * AC3: 404 if assessment not found or wrong organization
 * AC4: Breadcrumb: Risk Assessments > {subject}
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";

// Force dynamic rendering for session-dependent UI
export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectRiskAssessmentForm } from "@/components/risk-assessment-project/ProjectRiskAssessmentForm";

interface AssessmentWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentWorkspacePage({
  params,
}: AssessmentWorkspacePageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Risk Assessments", href: "/risk-assessments" },
        { label: "Assessment" },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        }
      >
        <ProjectRiskAssessmentForm projectId={id} />
      </Suspense>
    </AppLayout>
  );
}
