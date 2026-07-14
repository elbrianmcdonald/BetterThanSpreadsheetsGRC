"use client";

/**
 * Questionnaire Responses Client Component
 *
 * Epic 4: Questionnaire System
 * Story 4.8: Score Questionnaire Responses (FR34, FR35)
 *
 * Epic 5: Vendor Risk & Finding Integration
 * FR45: Assessor can create a finding directly from a questionnaire response
 * FR50: Finding created from vendor assessment includes source context
 */

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  FileQuestion,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  FileWarning,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
} from "lucide-react";

import { UserRole, ResponseScore, QuestionType } from "@prisma/client";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { CreateFindingDialog } from "@/components/findings/CreateFindingDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/trpc/react";

/**
 * Roles that can create findings from responses
 */
const FINDING_CREATE_ROLES: UserRole[] = WRITE_ROLES;

interface QuestionnaireResponsesClientProps {
  questionnaireId: string;
  questionnaire: {
    id: string;
    status: string;
    assessment: {
      id: string;
      identifier: string;
      title: string;
      vendor: {
        id: string;
        name: string;
        identifier: string;
      };
    };
    template: {
      id: string;
      name: string;
    };
  };
  userRole: UserRole;
}

export function QuestionnaireResponsesClient({
  questionnaireId,
  questionnaire,
  userRole,
}: QuestionnaireResponsesClientProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [createFindingOpen, setCreateFindingOpen] = useState(false);
  // Which response the dialog was spawned from, plus its title/context prefill.
  const [findingContext, setFindingContext] = useState<{
    responseId: string;
    title: string;
    contextLabel: string;
  } | null>(null);

  const canCreateFinding = FINDING_CREATE_ROLES.includes(userRole);

  // Fetch responses
  const { data: responses, isLoading, refetch } = api.questionnaire.getResponses.useQuery({
    questionnaireId,
  });

  const openCreateFindingDialog = (responseId: string, questionText: string) => {
    setFindingContext({
      responseId,
      // Title prefill only — the risk statement is written by the user.
      title: `Concern: ${questionText.substring(0, 100)}${questionText.length > 100 ? "..." : ""}`,
      // Single-line chip, not a document — the old markdown block is dropped.
      contextLabel: `${questionnaire.assessment.vendor.name} — ${questionText}`,
    });
    setCreateFindingOpen(true);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Group responses by section
  const responsesBySection = responses?.reduce((acc, response) => {
    const sectionId = response.question.section.id;
    const sectionTitle = response.question.section.title;
    if (!acc[sectionId]) {
      acc[sectionId] = {
        title: sectionTitle,
        description: response.question.section.description,
        responses: [],
      };
    }
    acc[sectionId].responses.push(response);
    return acc;
  }, {} as Record<string, { title: string; description: string | null; responses: typeof responses }>) ?? {};

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <FileQuestion className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{questionnaire.template.name}</h1>
            <p className="text-sm text-muted-foreground">
              Responses for {questionnaire.assessment.vendor.name}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-muted-foreground">Assessment</p>
          <Link
            href={`/tprm/assessments/${questionnaire.assessment.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {questionnaire.assessment.identifier}
          </Link>
        </div>
      </div>

      {/* Responses by Section */}
      {Object.entries(responsesBySection).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Responses Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The vendor has not submitted any responses yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(responsesBySection).map(([sectionId, section]) => (
            <Card key={sectionId}>
              <Collapsible
                open={expandedSections.has(sectionId) || expandedSections.size === 0}
                onOpenChange={() => toggleSection(sectionId)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        {section.description && (
                          <CardDescription className="mt-1">{section.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {section.responses.length} response{section.responses.length !== 1 ? "s" : ""}
                        </Badge>
                        {expandedSections.has(sectionId) || expandedSections.size === 0 ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-6">
                      {section.responses.map((response, idx) => (
                        <div key={response.id}>
                          {idx > 0 && <Separator className="mb-6" />}
                          <ResponseItem
                            response={response}
                            canCreateFinding={canCreateFinding}
                            onCreateFinding={openCreateFindingDialog}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Create Finding Dialog — modal chrome around the real finding form. */}
      <CreateFindingDialog
        open={createFindingOpen}
        onOpenChange={setCreateFindingOpen}
        initialTitle={findingContext?.title}
        initialSource="MANUAL"
        contextLabel={findingContext?.contextLabel}
        questionnaireResponseId={findingContext?.responseId}
        onCreated={() => {
          // The response row shows a "finding created" state — refetch it.
          void refetch();
        }}
      />
    </div>
  );
}

/**
 * Individual Response Item Component
 */
interface ResponseItemProps {
  response: {
    id: string;
    textResponse: string | null;
    selectedChoiceId: string | null;
    fileUrl: string | null;
    fileName: string | null;
    score: ResponseScore | null;
    scoreComment: string | null;
    scoredAt: Date | null;
    scoredBy: { id: string; name: string | null; email: string | null } | null;
    finding?: { id: string; identifier: string } | null;
    question: {
      id: string;
      questionText: string;
      helpText: string | null;
      questionType: QuestionType;
      isRequired: boolean;
      choices: Array<{
        id: string;
        choiceText: string;
        isConcerning: boolean;
      }>;
    };
  };
  canCreateFinding: boolean;
  onCreateFinding: (responseId: string, questionText: string, responseValue: string) => void;
}

function ResponseItem({ response, canCreateFinding, onCreateFinding }: ResponseItemProps) {
  // Get the display value for the response
  const getResponseValue = () => {
    if (response.question.questionType === "YES_NO") {
      return response.textResponse || "No response";
    }
    if (response.question.questionType === "TEXT") {
      return response.textResponse || "No response";
    }
    if (response.question.questionType === "MULTI_CHOICE" && response.selectedChoiceId) {
      const choice = response.question.choices.find((c) => c.id === response.selectedChoiceId);
      return choice?.choiceText || "Unknown choice";
    }
    if (response.question.questionType === "FILE_UPLOAD" && response.fileName) {
      return `File: ${response.fileName}`;
    }
    return "No response";
  };

  // Check if the selected choice is concerning
  const isConcerning =
    response.question.questionType === "MULTI_CHOICE" &&
    response.selectedChoiceId &&
    response.question.choices.find((c) => c.id === response.selectedChoiceId)?.isConcerning;

  const responseValue = getResponseValue();
  const hasFinding = !!response.finding;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">{response.question.questionText}</p>
          {response.question.helpText && (
            <p className="mt-1 text-sm text-muted-foreground">{response.question.helpText}</p>
          )}
        </div>
        {response.question.isRequired && (
          <Badge variant="outline" className="text-xs">Required</Badge>
        )}
      </div>

      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Response:</p>
            <p className={`mt-1 ${isConcerning ? "text-red-600 font-medium" : ""}`}>
              {responseValue}
              {isConcerning && (
                <Badge variant="destructive" className="ml-2">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Concerning
                </Badge>
              )}
            </p>
          </div>

          {/* Score Badge */}
          {response.score && (
            <ScoreBadge score={response.score} />
          )}
        </div>

        {/* Score Comment */}
        {response.scoreComment && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Assessor Comment:</span> {response.scoreComment}
            </p>
            {response.scoredBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                Scored by {response.scoredBy.name || response.scoredBy.email}
                {response.scoredAt && ` on ${format(new Date(response.scoredAt), "PP")}`}
              </p>
            )}
          </div>
        )}

        {/* Finding Link or Create Button */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          {hasFinding ? (
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-yellow-600" />
              <span className="text-sm">Finding created:</span>
              <Link
                href={`/findings/${response.finding!.id}`}
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                {response.finding!.identifier}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : canCreateFinding ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateFinding(response.id, response.question.questionText, responseValue)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Create Finding
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">No finding created</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Score Badge Component
 */
function ScoreBadge({ score }: { score: ResponseScore }) {
  const config: Record<ResponseScore, { label: string; icon: React.ReactNode; className: string }> = {
    ACCEPTABLE: {
      label: "Acceptable",
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "bg-green-100 text-green-800 border-green-200",
    },
    NEEDS_FOLLOWUP: {
      label: "Needs Follow-up",
      icon: <AlertTriangle className="h-4 w-4" />,
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    UNACCEPTABLE: {
      label: "Unacceptable",
      icon: <XCircle className="h-4 w-4" />,
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const { label, icon, className } = config[score];

  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1`}>
      {icon}
      {label}
    </Badge>
  );
}
