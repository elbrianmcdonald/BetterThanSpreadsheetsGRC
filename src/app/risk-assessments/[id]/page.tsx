/**
 * Assessment Workspace Page
 *
 * Tabbed view of a RiskAssessmentProject. The container itself only
 * carries metadata; risk substance lives on each identified risk inside
 * the Identified Risks tab.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { AssessmentWorkspaceClient } from "./AssessmentWorkspaceClient";

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
        <AssessmentWorkspaceClient projectId={id} />
      </Suspense>
    </AppLayout>
  );
}
