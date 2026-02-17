"use client";

/**
 * Edit Questionnaire Template Client Component
 *
 * Epic 4: Questionnaire System
 * Story 4.3: Edit Questionnaire Templates (FR29)
 *
 * Loads existing template data and renders the builder.
 */

import Link from "next/link";
import {
  AlertTriangle,
  FileQuestion,
  Loader2,
} from "lucide-react";

import { QuestionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { QuestionnaireBuilderClient } from "../../new/client";

interface EditQuestionnaireClientProps {
  templateId: string;
}

export function EditQuestionnaireClient({ templateId }: EditQuestionnaireClientProps) {
  // Fetch template
  const { data: template, isLoading, error } = api.questionnaire.getTemplateById.useQuery(
    { id: templateId },
    { retry: false }
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error || !template) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold">Template not found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "The template you're looking for doesn't exist."}
          </p>
          <Link href="/tprm/questionnaires">
            <Button className="mt-4" variant="outline">
              Back to Templates
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // System templates cannot be edited
  if (template.isSystemTemplate) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileQuestion className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold">System Template</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            System templates cannot be directly edited. Create a copy to customize it.
          </p>
          <Link href={`/tprm/questionnaires/${templateId}`}>
            <Button className="mt-4" variant="outline">
              View Template
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Transform template data to form values with proper defaults
  const defaultValues = {
    name: template.name,
    description: template.description || "",
    sections: template.sections.map((section) => ({
      title: section.title,
      description: section.description || "",
      questions: section.questions.map((question) => ({
        questionText: question.questionText,
        helpText: question.helpText || "",
        questionType: question.questionType as QuestionType,
        isRequired: question.isRequired ?? false,
        isLongText: question.isLongText ?? false,
        choices: question.choices?.map((choice) => ({
          choiceText: choice.choiceText,
          isConcerning: choice.isConcerning ?? false,
        })) || [],
      })),
    })),
  };

  return (
    <QuestionnaireBuilderClient
      mode="edit"
      templateId={templateId}
      defaultValues={defaultValues}
    />
  );
}
