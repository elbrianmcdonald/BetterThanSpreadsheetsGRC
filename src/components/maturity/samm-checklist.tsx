"use client";

/**
 * OWASP SAMM Assessment Checklist Component
 *
 * Interview-style assessment UI organized by:
 * Business Function > Security Practice > Activity Stream > Maturity Level Questions
 *
 * Each question has a 4-option weighted answer dropdown.
 * Scores roll up: Stream (SUM) > Practice (AVG) > Function (AVG)
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  HelpCircle,
  User,
} from "lucide-react";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

// =============================================================================
// Types
// =============================================================================

interface SammChecklistProps {
  assessmentId: string;
  domain: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  targetLevel?: number | null;
  onTargetLevelChange?: (targetLevel: number | null) => void;
  isSavingTarget?: boolean;
}

// =============================================================================
// Score Display Helper
// =============================================================================

function ScoreBadge({ score, maxScore = 3 }: { score: number | null; maxScore?: number }) {
  if (score === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Assessed
      </Badge>
    );
  }

  const ratio = score / maxScore;
  const colorClass =
    ratio >= 0.75
      ? "bg-green-100 text-green-700 border-green-200"
      : ratio >= 0.5
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : ratio >= 0.25
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : "bg-red-100 text-red-700 border-red-200";

  return (
    <Badge variant="outline" className={colorClass}>
      {score.toFixed(2)} / {maxScore}
    </Badge>
  );
}

// =============================================================================
// Answer Weight Badge
// =============================================================================

function WeightBadge({ weight }: { weight: number }) {
  const colorClass =
    weight === 1
      ? "bg-green-100 text-green-700"
      : weight >= 0.5
        ? "bg-blue-100 text-blue-700"
        : weight >= 0.25
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-500";

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 text-xs font-mono rounded", colorClass)}>
      {weight.toFixed(2)}
    </span>
  );
}

// =============================================================================
// Practice Section Component (one per security practice)
// =============================================================================

function PracticeSection({
  assessmentId,
  practice,
  isExpanded,
  onToggle,
}: {
  assessmentId: string;
  practice: { id: string; code: string; name: string };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [editingInterviewee, setEditingInterviewee] = useState<string | null>(null);
  const [intervieweeValue, setIntervieweeValue] = useState("");
  const utils = api.useUtils();

  const { data, isLoading } = api.maturity.getSammQuestionsForPractice.useQuery(
    { assessmentId, practiceId: practice.id },
    { enabled: isExpanded }
  );

  const saveMutation = api.maturity.saveSammQuestionResponse.useMutation({
    onSuccess: () => {
      void utils.maturity.getSammQuestionsForPractice.invalidate({
        assessmentId,
        practiceId: practice.id,
      });
      void utils.maturity.getById.invalidate({ id: assessmentId });
      void utils.maturity.getSammScoreBreakdown.invalidate({ assessmentId });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleAnswer = (questionId: string, answerIndex: number, notes?: string | null, interviewee?: string | null) => {
    saveMutation.mutate({ assessmentId, questionId, answerIndex, notes, interviewee });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle()}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Badge variant="outline" className="font-mono text-xs">
            {practice.code}
          </Badge>
          <span className="font-medium text-sm">{practice.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.answeredQuestions}/{data.totalQuestions} answered
            </span>
          )}
          <ScoreBadge score={data?.practiceScore ?? null} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-3 pl-4">
        {isLoading && (
          <div className="flex items-center gap-2 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading questions...
          </div>
        )}

        {data?.streams.map((stream) => (
          <div key={stream.id} className="border rounded-lg">
            {/* Stream Header */}
            <button
              className="flex w-full items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              onClick={() =>
                setExpandedStream(expandedStream === stream.id ? null : stream.id)
              }
            >
              <div className="flex items-center gap-2">
                {expandedStream === stream.id ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Badge variant="secondary" className="font-mono text-xs">
                  {stream.code}
                </Badge>
                <span className="text-sm">{stream.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {stream.answeredCount}/{stream.totalQuestions}
                </span>
                <ScoreBadge score={stream.streamScore} />
              </div>
            </button>

            {/* Stream Questions */}
            {expandedStream === stream.id && (
              <div className="border-t px-3 pb-3 space-y-4">
                {stream.questions.map((question) => {
                  const answerOptions = question.answerOptions ?? [];

                  return (
                    <div key={question.id} className="pt-3 space-y-2">
                      {/* Maturity Level Badge + Question */}
                      <div className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 mt-0.5 text-xs font-mono",
                            question.level === 3
                              ? "border-green-300 text-green-700"
                              : question.level === 2
                                ? "border-blue-300 text-blue-700"
                                : "border-gray-300 text-gray-700"
                          )}
                        >
                          L{question.level}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium leading-snug">
                            {question.questionText}
                          </p>
                        </div>
                        {/* Guidance Tooltip */}
                        {question.guidanceText && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                className="max-w-sm whitespace-pre-line"
                              >
                                <p className="text-xs font-medium mb-1">Quality Criteria:</p>
                                <p className="text-xs">{question.guidanceText}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {/* Answer Selector */}
                      <div className="flex items-center gap-2 ml-8">
                        <Select
                          value={
                            question.answerIndex !== null
                              ? question.answerIndex.toString()
                              : undefined
                          }
                          onValueChange={(val) => {
                            const idx = parseInt(val, 10);
                            handleAnswer(question.id, idx, question.notes, question.interviewee);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select answer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {answerOptions.map((opt: { value: number; label: string; weight: number }) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value.toString()}
                              >
                                <div className="flex items-center gap-2">
                                  <WeightBadge weight={opt.weight} />
                                  <span>{opt.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Current weight display */}
                        {question.answerWeight !== null && (
                          <span className="text-xs text-muted-foreground">
                            = {question.answerWeight.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Interviewee + Notes row */}
                      <div className="ml-8 flex items-start gap-4">
                        {/* Interviewee */}
                        <div className="shrink-0">
                          {editingInterviewee === question.id ? (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                className="h-7 text-xs w-[200px]"
                                placeholder="Who was interviewed?"
                                value={intervieweeValue}
                                onChange={(e) => setIntervieweeValue(e.target.value)}
                                onBlur={() => {
                                  if (question.answerIndex !== null) {
                                    handleAnswer(
                                      question.id,
                                      question.answerIndex,
                                      question.notes,
                                      intervieweeValue || null
                                    );
                                  }
                                  setEditingInterviewee(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                setEditingInterviewee(question.id);
                                setIntervieweeValue(question.interviewee ?? "");
                              }}
                            >
                              <User className="h-3.5 w-3.5" />
                              {question.interviewee ? (
                                <span>{question.interviewee}</span>
                              ) : (
                                <span>+ Interviewee</span>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Notes */}
                        <div className="flex-1">
                          {editingNotes === question.id ? (
                            <div className="space-y-1">
                              <Textarea
                                className="text-xs min-h-[60px]"
                                placeholder="Interview notes..."
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                onBlur={() => {
                                  if (question.answerIndex !== null) {
                                    handleAnswer(
                                      question.id,
                                      question.answerIndex,
                                      notesValue || null,
                                      question.interviewee
                                    );
                                  }
                                  setEditingNotes(null);
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                setEditingNotes(question.id);
                                setNotesValue(question.notes ?? "");
                              }}
                            >
                              {question.notes ? (
                                <span className="italic">Notes: {question.notes.slice(0, 80)}...</span>
                              ) : (
                                "+ Add notes"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// Main SAMM Checklist Component
// =============================================================================

export function SammChecklist({
  assessmentId,
  domain,
  isExpanded,
  onToggle,
  targetLevel = null,
  onTargetLevelChange,
  isSavingTarget = false,
}: SammChecklistProps) {
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null);

  // Get child practices (CATEGORY domains)
  const { data: practicesData } = api.maturity.getFramework.useQuery(
    { id: "" }, // We'll use the score breakdown instead
    { enabled: false }
  );

  // Get score breakdown for this function's practices
  const { data: scoreData } = api.maturity.getSammScoreBreakdown.useQuery(
    { assessmentId },
    { enabled: isExpanded }
  );

  // Get child practices from the getById response
  const { data: assessmentData } = api.maturity.getById.useQuery(
    { id: assessmentId },
    { enabled: isExpanded }
  );

  // Find practices that belong to this business function
  const practices = assessmentData?.framework?.domains
    ?.filter((d) => d.level === "CATEGORY" && d.parentId === domain.id)
    ?.sort((a, b) => a.sortOrder - b.sortOrder) ?? [];

  // Get function score from score breakdown
  const functionScore = scoreData?.functions?.find((f) => f.code === domain.code)?.score ?? null;

  // Calculate completion stats
  const totalQuestions = scoreData?.totalQuestions ?? 90;
  const answeredQuestions = scoreData?.answeredQuestions ?? 0;
  const completionPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-2 ring-primary shadow-md",
        functionScore !== null && !isExpanded && "border-l-4 border-l-emerald-500"
      )}
    >
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <Badge variant="outline" className="font-mono">
              {domain.code}
            </Badge>
            <span className="font-medium">{domain.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {targetLevel !== null && targetLevel !== undefined && functionScore !== null && functionScore < targetLevel && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Gap: {(targetLevel - functionScore).toFixed(1)}
              </Badge>
            )}
            <ScoreBadge score={functionScore} />
          </div>
        </div>
        {!isExpanded && domain.description && (
          <p className="text-sm text-muted-foreground ml-11 line-clamp-1">
            {domain.description}
          </p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {domain.description && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{domain.description}</p>
              </div>
            </div>
          )}

          {/* Current Score & Target Level */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Function Score</p>
                  <p className="text-xs text-muted-foreground">Average of practice scores</p>
                </div>
                <ScoreBadge score={functionScore} />
              </div>
            </div>

            {/* Target Level Selector */}
            <div className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Target Level</p>
                  <p className="text-xs text-muted-foreground">Set your target maturity level</p>
                </div>
                <Select
                  value={targetLevel !== null && targetLevel !== undefined ? String(targetLevel) : "none"}
                  onValueChange={(value) => {
                    onTargetLevelChange?.(value === "none" ? null : parseInt(value));
                  }}
                  disabled={isSavingTarget}
                >
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Set</SelectItem>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Practice sections */}
          <div className="space-y-2">
            {practices.map((practice) => (
              <PracticeSection
                key={practice.id}
                assessmentId={assessmentId}
                practice={{
                  id: practice.id,
                  code: practice.code,
                  name: practice.name,
                }}
                isExpanded={expandedPractice === practice.id}
                onToggle={() =>
                  setExpandedPractice(
                    expandedPractice === practice.id ? null : practice.id
                  )
                }
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
