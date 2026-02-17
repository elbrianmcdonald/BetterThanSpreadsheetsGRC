/**
 * Questionnaire Responses View Page
 *
 * Epic 4: Questionnaire System
 * Story 4.8: Score Questionnaire Responses (FR34, FR35)
 *
 * Epic 5: Vendor Risk & Finding Integration
 * FR45: Assessor can create a finding directly from a questionnaire response
 * FR50: Finding created from vendor assessment includes source context
 */

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { requireAuth } from "@/lib/auth/route-protection";
import { api } from "@/trpc/server";

import { AppLayout } from "@/components/layout/AppLayout";
import { QuestionnaireResponsesClient } from "./client";

export const metadata = {
  title: "Questionnaire Responses | BetterThanSpreadsheetsGRC",
  description: "View and score questionnaire responses from vendor",
};

interface ResponsesPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionnaireResponsesPage({ params }: ResponsesPageProps) {
  const session = await auth();
  requireAuth(session, `/tprm/assessments`);

  const { id } = await params;

  // Fetch questionnaire details
  let questionnaire;
  try {
    questionnaire = await api.questionnaire.getQuestionnaireWithDetails({ questionnaireId: id });
  } catch {
    notFound();
  }

  const breadcrumbs = [
    { label: "Third Party" },
    { label: "Assessments", href: "/tprm/assessments" },
    { label: questionnaire.assessment.identifier, href: `/tprm/assessments/${questionnaire.assessment.id}` },
    { label: "Questionnaire Responses" },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <QuestionnaireResponsesClient
        questionnaireId={id}
        questionnaire={questionnaire as any}
        userRole={session!.user.role}
      />
    </AppLayout>
  );
}
