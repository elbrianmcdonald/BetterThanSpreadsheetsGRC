/**
 * Edit Questionnaire Template Page
 *
 * Epic 4: Questionnaire System
 * Story 4.3: Edit Questionnaire Templates (FR29)
 *
 * AC1: Page accessible at `/tprm/questionnaires/[id]/edit`
 * AC2: Page protected - requires GRC_ANALYST or ORG_ADMIN role
 * AC3: Form for editing custom questionnaire templates
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { EditQuestionnaireClient } from "./client";

/**
 * Roles that can edit questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

export const metadata = {
  title: "Edit Questionnaire Template | BetterThanSpreadsheetsGRC",
  description: "Edit a questionnaire template for vendor assessments",
};

interface EditQuestionnairePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuestionnairePage({ params }: EditQuestionnairePageProps) {
  const { id } = await params;
  const session = await auth();

  // Require authentication and role
  requireRole(session, TEMPLATE_MANAGE_ROLES, "/tprm/questionnaires");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Questionnaires", href: "/tprm/questionnaires" },
        { label: "Edit Template" },
      ]}
    >
      <EditQuestionnaireClient templateId={id} />
    </AppLayout>
  );
}
