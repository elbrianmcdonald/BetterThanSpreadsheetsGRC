/**
 * Edit Assessment Page
 *
 * Epic 3: Assessment Workflow
 * Story 3.4: Assessment Scoring and Recommendation (FR21, FR22)
 * Story 3.5: Assessment Notes and Summary (FR23)
 *
 * AC1: Page accessible at `/tprm/assessments/[id]/edit`
 * AC2: Form for editing vendor assessment details
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { EditAssessmentClient } from "./client";

/**
 * Roles that can edit assessments
 */
const ASSESSMENT_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

export const metadata = {
  title: "Edit Assessment | BetterThanSpreadsheetsGRC",
  description: "Edit vendor assessment details",
};

interface EditAssessmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAssessmentPage({ params }: EditAssessmentPageProps) {
  const { id } = await params;
  const session = await auth();

  // Require authentication and role
  requireRole(session, ASSESSMENT_MANAGE_ROLES, "/tprm/assessments");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Assessments", href: "/tprm/assessments" },
        { label: "Edit" },
      ]}
    >
      <EditAssessmentClient assessmentId={id} />
    </AppLayout>
  );
}
