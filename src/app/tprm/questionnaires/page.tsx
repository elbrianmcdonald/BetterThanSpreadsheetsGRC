/**
 * Questionnaire Templates List Page
 *
 * Epic 4: Questionnaire System
 * Story 4.1: Pre-Built Questionnaire Templates (FR27)
 * Story 4.2: Custom Questionnaire Builder (FR28)
 *
 * AC1: Page accessible at `/tprm/questionnaires`
 * AC2: Page protected - requires authenticated user
 * AC3: Lists pre-built and custom questionnaire templates
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { QuestionnaireListClient } from "./client";

/**
 * Roles that can view questionnaire templates
 */
const TEMPLATE_VIEW_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.CISO,
  UserRole.AUDITOR,
];

export const metadata = {
  title: "Questionnaire Templates | BetterThanSpreadsheetsGRC",
  description: "Manage questionnaire templates for vendor assessments",
};

export default async function QuestionnairesPage() {
  const session = await auth();

  // Require authentication and role
  requireRole(session, TEMPLATE_VIEW_ROLES, "/tprm");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Questionnaires" },
      ]}
    >
      <QuestionnaireListClient />
    </AppLayout>
  );
}
