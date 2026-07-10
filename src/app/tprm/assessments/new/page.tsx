/**
 * Create New Assessment Page
 *
 * Epic 3: Assessment Workflow
 * Story 3.1: Create Vendor Assessment (FR17)
 *
 * AC1: Page accessible at `/tprm/assessments/new`
 * AC2: Form for creating new vendor assessment
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { NewAssessmentClient } from "./client";

/**
 * Roles that can create assessments
 */
const ASSESSMENT_MANAGE_ROLES = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.ANALYST,
];

export const metadata = {
  title: "New Assessment | BetterThanSpreadsheetsGRC",
  description: "Create a new vendor assessment",
};

interface NewAssessmentPageProps {
  searchParams: Promise<{ vendorId?: string }>;
}

export default async function NewAssessmentPage({ searchParams }: NewAssessmentPageProps) {
  const { vendorId } = await searchParams;
  const session = await auth();

  // Require authentication and role
  requireRole(session, ASSESSMENT_MANAGE_ROLES, "/tprm/assessments");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Assessments", href: "/tprm/assessments" },
        { label: "New Assessment" },
      ]}
    >
      <NewAssessmentClient vendorId={vendorId} />
    </AppLayout>
  );
}
