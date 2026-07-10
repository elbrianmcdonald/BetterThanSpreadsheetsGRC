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
import { UserRole } from "@prisma/client";
import { AppLayout } from "@/components/layout";
import { QuestionnaireDetailClient } from "./client";

/**
 * Roles that can view questionnaire templates
 */
const TEMPLATE_VIEW_ROLES = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.ANALYST,
  UserRole.MANAGER,
  UserRole.BUSINESS_USER,
];

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
