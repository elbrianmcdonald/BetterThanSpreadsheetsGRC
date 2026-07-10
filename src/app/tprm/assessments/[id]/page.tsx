/**
 * Assessment Detail Page
 *
 * Epic 3: Assessment Workflow
 * Story 3.6: Assessment History View (FR24)
 *
 * AC1: Page accessible at `/tprm/assessments/[id]`
 * AC2: Displays assessment details, status, and comments
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { READ_ROLES } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { AssessmentDetailClient } from "./client";

/**
 * Roles that can view assessments
 */
const ASSESSMENT_VIEW_ROLES: UserRole[] = READ_ROLES;

export const metadata = {
  title: "Assessment Details | BetterThanSpreadsheetsGRC",
  description: "View vendor assessment details",
};

interface AssessmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssessmentDetailPage({ params }: AssessmentDetailPageProps) {
  const { id } = await params;
  const session = await auth();

  // Require authentication and role
  requireRole(session, ASSESSMENT_VIEW_ROLES, "/");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Assessments", href: "/tprm/assessments" },
        { label: "Details" },
      ]}
    >
      <AssessmentDetailClient assessmentId={id} />
    </AppLayout>
  );
}
