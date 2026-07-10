/**
 * Questionnaire Template Detail Page
 *
 * Epic 4: Questionnaire System
 * Story 4.1: Pre-Built Questionnaire Templates (FR27)
 *
 * AC1: Page accessible at `/tprm/questionnaires/[id]`
 * AC2: Page protected - requires authenticated user
 * AC3: Shows template details with all questions
 */

import { auth } from "@/server/auth";
import { requireRole } from "@/lib/auth/route-protection";
import { READ_ROLES } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { QuestionnaireDetailClient } from "./client";

/**
 * Roles that can view questionnaire templates
 */
const TEMPLATE_VIEW_ROLES: UserRole[] = READ_ROLES;

export const metadata = {
  title: "Questionnaire Template | BetterThanSpreadsheetsGRC",
  description: "View questionnaire template details",
};

interface QuestionnaireDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionnaireDetailPage({ params }: QuestionnaireDetailPageProps) {
  const { id } = await params;
  const session = await auth();

  // Require authentication and role
  requireRole(session, TEMPLATE_VIEW_ROLES, "/tprm/questionnaires");

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Third Party" },
        { label: "Questionnaires", href: "/tprm/questionnaires" },
        { label: "Template Details" },
      ]}
    >
      <QuestionnaireDetailClient templateId={id} />
    </AppLayout>
  );
}
