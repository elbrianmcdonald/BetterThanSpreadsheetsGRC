/**
 * Vendor Assessments List Page
 *
 * Epic 3: Assessment Workflow
 * Story 3.6: Assessment History View (FR24)
 *
 * AC1: Page accessible at `/tprm/assessments`
 * AC2: Page protected - requires authenticated user
 * AC3: Lists all vendor assessments with filtering
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { AssessmentListClient } from "./client";

/**
 * Roles that can view assessments
 */
const ASSESSMENT_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.IT_STAKEHOLDER,
  UserRole.BUSINESS_STAKEHOLDER,
  UserRole.AUDITOR,
];

export const metadata = {
  title: "Vendor Assessments | BetterThanSpreadsheetsGRC",
  description: "Vendor assessment workflow and history",
};

export default async function AssessmentsPage() {
  const session = await auth();

  // Require authentication and role
  requireRole(session, ASSESSMENT_VIEW_ROLES, "/");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Assessments" },
      ]}
    >
      <AssessmentListClient />
    </AppLayout>
  );
}
