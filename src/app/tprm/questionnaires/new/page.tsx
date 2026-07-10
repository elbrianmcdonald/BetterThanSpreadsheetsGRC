/**
 * Create Questionnaire Template Page
 *
 * Epic 4: Questionnaire System
 * Story 4.2: Custom Questionnaire Builder (FR28)
 *
 * AC1: Page accessible at `/tprm/questionnaires/new`
 * AC2: Page protected - requires GRC_ANALYST or ORG_ADMIN role
 * AC3: Form for creating custom questionnaire templates
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { QuestionnaireBuilderClient } from "./client";

/**
 * Roles that can create questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

export const metadata = {
  title: "Create Questionnaire Template | BetterThanSpreadsheetsGRC",
  description: "Create a new questionnaire template for vendor assessments",
};

export default async function NewQuestionnairePage() {
  const session = await auth();

  // Require authentication and role
  requireRole(session, TEMPLATE_MANAGE_ROLES, "/tprm/questionnaires");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Questionnaires", href: "/tprm/questionnaires" },
        { label: "Create Template" },
      ]}
    >
      <QuestionnaireBuilderClient mode="create" />
    </AppLayout>
  );
}
