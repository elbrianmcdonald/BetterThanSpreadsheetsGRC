/**
 * Create Risk Assessment Page
 *
 * Slim creation form: captures only assessment-container metadata
 * (subject, description, matrix, due date, assignee). On submit, the
 * form redirects to /risk-assessments/{id} where the analyst fills in
 * identified risks via the assessment workspace.
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { CreateAssessmentProjectForm } from "@/components/risk-assessment-project";

export const metadata = {
  title: "Create Risk Assessment | BetterThanSpreadsheetsGRC",
  description: "Create a new risk assessment container",
};

const ASSESSMENT_CREATE_ROLES = [
  UserRole.ANALYST,
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
];

export default async function CreateAssessmentPage() {
  const session = await auth();
  requireRole(session, ASSESSMENT_CREATE_ROLES, "/risk-assessments/new");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Risk Assessments", href: "/risk-assessments" },
        { label: "New" },
      ]}
    >
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Create Risk Assessment
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up the assessment container. You&apos;ll add identified risks on
            the next page.
          </p>
        </div>
        <CreateAssessmentProjectForm />
      </div>
    </AppLayout>
  );
}
