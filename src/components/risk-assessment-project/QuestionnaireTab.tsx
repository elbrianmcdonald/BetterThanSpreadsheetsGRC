"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { RiskQuestionStatus } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Users,
  X as XIcon,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";
import { AttendeePillsInput } from "@/components/engagement/AttendeePillsInput";
import { cn } from "@/lib/utils";

type Questionnaire = NonNullable<
  RouterOutputs["riskAssessmentQuestionnaire"]["getForProject"]
>;
type Section = Questionnaire["sections"][number];
type Question = Section["questions"][number];

interface Props {
  projectId: string;
  isReadOnly: boolean;
}

const STATUS_OPTIONS: { value: RiskQuestionStatus; label: string; color: string }[] = [
  { value: RiskQuestionStatus.IMPLEMENTED, label: "Implemented", color: "text-green-700" },
  { value: RiskQuestionStatus.PARTIAL, label: "Partial", color: "text-amber-700" },
  { value: RiskQuestionStatus.NOT_IMPLEMENTED, label: "Not Implemented", color: "text-red-700" },
  { value: RiskQuestionStatus.NOT_APPLICABLE, label: "N/A", color: "text-muted-foreground" },
];

export function QuestionnaireTab({ projectId, isReadOnly }: Props) {
  const utils = api.useUtils();
  const { data: questionnaire, isLoading } =
    api.riskAssessmentQuestionnaire.getForProject.useQuery({ projectId });

  // Any change to the questionnaire potentially shifts the completion summary
  // (Submit-for-Approval gate + tab badge) and, for spawns, the project's
  // discoveredRisks list — so invalidate broadly.
  const refresh = () => {
    void utils.riskAssessmentQuestionnaire.getForProject.invalidate({ projectId });
    void utils.riskAssessmentQuestionnaire.getCompletionSummary.invalidate({ projectId });
    void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!questionnaire) {
    return <EmptyState projectId={projectId} isReadOnly={isReadOnly} onAttached={refresh} />;
  }

  return (
    <FilledState
      questionnaire={questionnaire}
      projectId={projectId}
      isReadOnly={isReadOnly}
      refresh={refresh}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state — pick a template
// ---------------------------------------------------------------------------

function EmptyState({
  projectId,
  isReadOnly,
  onAttached,
}: {
  projectId: string;
  isReadOnly: boolean;
  onAttached: () => void;
}) {
  const { data: templates, isLoading } = api.riskAssessmentTemplate.list.useQuery({
    includeInactive: false,
  });
  const [selectedId, setSelectedId] = useState<string>("");

  const attach = api.riskAssessmentQuestionnaire.attachTemplate.useMutation({
    onSuccess: () => {
      onAttached();
      toast.success("Questionnaire attached");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          No questionnaire attached
        </CardTitle>
        <CardDescription>
          Pick a template from your library to seed this assessment with structured
          questions. Each question will become an answerable item linked back to its
          framework reference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No templates yet. Create one before attaching to an assessment.
            </p>
            <Link href="/admin/risk-assessment-templates">
              <Button variant="outline">
                Manage templates <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="template-pick">Template</Label>
              <Select value={selectedId} onValueChange={setSelectedId} disabled={isReadOnly}>
                <SelectTrigger id="template-pick">
                  <SelectValue placeholder="Pick a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.sectionCount} sections · {t.questionCount} questions
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() =>
                selectedId &&
                attach.mutate({ projectId, templateId: selectedId })
              }
              disabled={!selectedId || attach.isPending || isReadOnly}
            >
              {attach.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Attach Questionnaire
            </Button>
            {isReadOnly && (
              <p className="text-xs text-muted-foreground">
                Assessment is not in progress — questionnaire cannot be attached.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Filled state — sections + questions
// ---------------------------------------------------------------------------

/** Prefill for the inline finding form spawned from a question. */
interface AddFindingContext {
  questionId: string;
  title: string;
  description: string;
}

function FilledState({
  questionnaire,
  projectId,
  isReadOnly,
  refresh,
}: {
  questionnaire: Questionnaire;
  projectId: string;
  isReadOnly: boolean;
  refresh: () => void;
}) {
  // Inline finding creation (2026-07-06): the full card form renders in
  // place of the questionnaire so the user never leaves the assessment.
  const [addingFinding, setAddingFinding] = useState<AddFindingContext | null>(null);

  const totals = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const s of questionnaire.sections) {
      for (const q of s.questions) {
        total++;
        if (q.status !== null) answered++;
      }
    }
    return { total, answered, pct: total === 0 ? 0 : Math.round((answered / total) * 100) };
  }, [questionnaire.sections]);

  const [detachOpen, setDetachOpen] = useState(false);
  const detach = api.riskAssessmentQuestionnaire.detach.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Questionnaire detached");
      setDetachOpen(false);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const defaultInterviewees = questionnaire.defaultInterviewees ?? [];
  const setDefaultInterviewees =
    api.riskAssessmentQuestionnaire.setDefaultInterviewees.useMutation({
      onSuccess: () => refresh(),
      onError: (e) => toast.error(`Failed: ${e.message}`),
    });

  if (addingFinding) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Add Finding</h3>
            <p className="text-sm text-muted-foreground">
              Spawned from a questionnaire question. The finding stays pending
              until the assessment is approved, then publishes to the register.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAddingFinding(null)}>
            <XIcon className="h-4 w-4 mr-1" />
            Back to questionnaire
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <CreateFindingForm
              discoveryProjectId={projectId}
              sourceRiskAssessmentQuestionId={addingFinding.questionId}
              defaultTitle={addingFinding.title}
              defaultDescription={addingFinding.description}
              onCreated={() => {
                refresh();
                setAddingFinding(null);
              }}
              onCancel={() => setAddingFinding(null)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{questionnaire.templateName}</span>
                {totals.answered === totals.total && totals.total > 0 ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-400">
                    {totals.answered} / {totals.total} answered
                  </Badge>
                )}
              </div>
              <Progress value={totals.pct} className="h-2" />
            </div>
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetachOpen(true)}
                title="Detach questionnaire"
              >
                <XIcon className="h-4 w-4 mr-1" />
                Detach
              </Button>
            )}
          </div>

          {/* Default interviewed stakeholders — inherited by every question that
              doesn't set its own. */}
          <div className="mt-4 border-t pt-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">Interviewed stakeholders (default)</Label>
            </div>
            {defaultInterviewees.length === 0 && isReadOnly ? (
              <p className="text-xs text-muted-foreground italic">None recorded.</p>
            ) : (
              <AttendeePillsInput
                value={defaultInterviewees}
                disabled={isReadOnly}
                onChange={(next) =>
                  setDefaultInterviewees.mutate({ projectId, interviewees: next })
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {questionnaire.sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          projectId={projectId}
          isReadOnly={isReadOnly}
          defaultInterviewees={defaultInterviewees}
          refresh={refresh}
          onAddFinding={setAddingFinding}
        />
      ))}

      <AlertDialog open={detachOpen} onOpenChange={setDetachOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach questionnaire?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the questionnaire snapshot for this assessment,
              including all answers ({totals.answered} answered), notes, and evidence
              attachments. Spawned findings and risks remain in the assessment but will
              lose their back-link to the source question. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => detach.mutate({ projectId })}
              disabled={detach.isPending}
            >
              {detach.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionCard({
  section,
  projectId,
  isReadOnly,
  defaultInterviewees,
  refresh,
  onAddFinding,
}: {
  section: Section;
  projectId: string;
  isReadOnly: boolean;
  defaultInterviewees: string[];
  refresh: () => void;
  onAddFinding: (ctx: AddFindingContext) => void;
}) {
  const [open, setOpen] = useState(true);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const answered = section.questions.filter((q) => q.status !== null).length;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left hover:bg-muted/40 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                {open ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{section.name}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </div>
                <Badge variant={answered === section.questions.length ? "default" : "outline"}>
                  {answered} / {section.questions.length}
                </Badge>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {section.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No questions in this section.</p>
            ) : (
              section.questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  projectId={projectId}
                  isReadOnly={isReadOnly}
                  defaultInterviewees={defaultInterviewees}
                  refresh={refresh}
                  onAddFinding={onAddFinding}
                />
              ))
            )}
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Question
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      <CustomQuestionDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        sectionId={section.id}
        onCreated={refresh}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Question card with inline status / notes / evidence / spawn UX.
// ---------------------------------------------------------------------------

function QuestionCard({
  question,
  projectId,
  isReadOnly,
  defaultInterviewees,
  onAddFinding,
  refresh,
}: {
  question: Question;
  projectId: string;
  isReadOnly: boolean;
  defaultInterviewees: string[];
  refresh: () => void;
  onAddFinding: (ctx: AddFindingContext) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(question.notes ?? "");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [confirmDeleteCustom, setConfirmDeleteCustom] = useState(false);

  const setStatus = api.riskAssessmentQuestionnaire.setStatus.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const setNotes = api.riskAssessmentQuestionnaire.setNotes.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const setInterviewees = api.riskAssessmentQuestionnaire.setInterviewees.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  // Empty override = inherit the questionnaire default.
  const ownInterviewees = question.interviewees ?? [];
  const inheriting = ownInterviewees.length === 0;
  const shownInterviewees = inheriting ? defaultInterviewees : ownInterviewees;
  const removeCustom = api.riskAssessmentQuestionnaire.removeCustomQuestion.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Question removed");
      setConfirmDeleteCustom(false);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const detachEvidence = api.riskAssessmentQuestionnaire.detachEvidence.useMutation({
    onSuccess: () => refresh(),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const onStatusChange = (value: string) => {
    if (isReadOnly) return;
    setStatus.mutate({
      questionId: question.id,
      status: value as RiskQuestionStatus,
    });
  };

  // Prefill the inline finding form with the question text (title) and notes
  // (body). Add Finding renders the full card form IN PLACE of the
  // questionnaire (2026-07-06) so the user stays on the assessment.
  const spawnDefaultTitle =
    question.text.length > 80 ? `${question.text.slice(0, 77)}...` : question.text;
  const spawnDefaultDescription = question.notes ?? "";

  return (
    <div className="rounded-md border p-3 space-y-3 bg-card">
      {/* Question header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {question.isCustom ? (
              <Badge variant="outline" className="text-xs">✏️ Custom</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">📋 Templated</Badge>
            )}
            {question.number && (
              <Badge variant="outline" className="font-mono text-xs">
                {question.number}
              </Badge>
            )}
            <span className="text-sm font-medium">{question.text}</span>
          </div>
          {(question.standardControl || question.organizationalControl || question.unresolvedReference) && (
            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              <ChevronRight className="h-3 w-3" />
              {question.standardControl && (
                <span>
                  Standard: {question.standardControl.code} — {question.standardControl.title}
                </span>
              )}
              {question.organizationalControl && (
                <span>
                  Org: {question.organizationalControl.localControlId} — {question.organizationalControl.name}
                </span>
              )}
              {question.unresolvedReference && !question.standardControl && !question.organizationalControl && (
                <span className="text-amber-600">Unresolved: {question.unresolvedReference}</span>
              )}
            </div>
          )}
          {question.helpText && (
            <p className="mt-1 text-xs text-muted-foreground italic">{question.helpText}</p>
          )}
        </div>
        {question.isCustom && !isReadOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => setConfirmDeleteCustom(true)}
            title="Remove custom question"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status radios */}
      <RadioGroup
        value={question.status ?? ""}
        onValueChange={onStatusChange}
        disabled={isReadOnly || setStatus.isPending}
        className="flex flex-wrap gap-3"
      >
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} />
            <Label
              htmlFor={`${question.id}-${opt.value}`}
              className={cn("font-normal cursor-pointer text-sm", opt.color)}
            >
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor={`notes-${question.id}`} className="text-xs">
          Notes
        </Label>
        <Textarea
          id={`notes-${question.id}`}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            if (!isReadOnly && notesDraft !== (question.notes ?? "")) {
              setNotes.mutate({
                questionId: question.id,
                notes: notesDraft.trim() || null,
              });
            }
          }}
          rows={2}
          placeholder="Add observations, evidence references, or context..."
          maxLength={5000}
          disabled={isReadOnly}
        />
      </div>

      {/* Interviewed stakeholders (per-question; inherits questionnaire default) */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-muted-foreground" />
          <Label className="text-xs">Interviewed</Label>
          {inheriting && shownInterviewees.length > 0 && (
            <span className="text-[10px] text-muted-foreground italic">
              inherited — edit to override
            </span>
          )}
        </div>
        {isReadOnly && shownInterviewees.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">None recorded.</p>
        ) : (
          <AttendeePillsInput
            value={shownInterviewees}
            disabled={isReadOnly}
            onChange={(next) =>
              setInterviewees.mutate({ questionId: question.id, interviewees: next })
            }
          />
        )}
      </div>

      {/* Evidence */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Evidence ({question.evidenceLinks.length})</Label>
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setEvidenceOpen(true)}
            >
              <Paperclip className="h-3 w-3 mr-1" />
              Attach
            </Button>
          )}
        </div>
        {question.evidenceLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No evidence attached.</p>
        ) : (
          <ul className="space-y-1">
            {question.evidenceLinks.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-muted/50"
              >
                <span className="flex items-center gap-1 min-w-0">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{link.evidence.title}</span>
                  <span className="text-muted-foreground shrink-0">
                    · {link.evidence.originalFileName}
                  </span>
                </span>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() =>
                      detachEvidence.mutate({
                        questionId: question.id,
                        evidenceId: link.evidence.id,
                      })
                    }
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Spawned items + spawn buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {question.spawnedFindings.map((f) => (
          <Link
            key={f.id}
            href={`/findings/${f.id}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-muted/50"
          >
            📌 {f.identifier}
          </Link>
        ))}
        {question.spawnedRisks.map((r) => (
          <Link
            key={r.id}
            href={`/risks/${r.id}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-background hover:bg-muted/50"
          >
            ⚠️ {r.identifier}
          </Link>
        ))}
        {/* Risk Model Cleanup: questions spawn FINDINGS only — risks are
            aggregations built from findings on the register, so the per-
            question "Add Risk" was removed (2026-07-06). */}
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onAddFinding({
                questionId: question.id,
                title: spawnDefaultTitle,
                description: spawnDefaultDescription,
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Finding
          </Button>
        )}
      </div>

      <EvidencePickerDialog
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        questionId={question.id}
        attached={question.evidenceLinks.map((l) => l.evidence.id)}
        onAttached={refresh}
      />

      <AlertDialog open={confirmDeleteCustom} onOpenChange={setConfirmDeleteCustom}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this custom question?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes the question along with its answer, notes, and evidence
              attachments. Spawned findings and risks remain but lose their
              back-link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeCustom.mutate({ questionId: question.id })}
              disabled={removeCustom.isPending}
            >
              {removeCustom.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom-question creation dialog (per section).
// ---------------------------------------------------------------------------

function CustomQuestionDialog({
  open,
  onOpenChange,
  sectionId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ number: "", text: "", helpText: "" });

  const create = api.riskAssessmentQuestionnaire.addCustomQuestion.useMutation({
    onSuccess: () => {
      onCreated();
      toast.success("Custom question added");
      onOpenChange(false);
      setForm({ number: "", text: "", helpText: "" });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Question</DialogTitle>
          <DialogDescription>
            Custom questions live only in this assessment. They do not affect the
            template or other assessments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="cq-number">Number</Label>
              <Input
                id="cq-number"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="e.g., 3.99"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cq-text">Question text *</Label>
              <Textarea
                id="cq-text"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cq-help">Help text</Label>
            <Textarea
              id="cq-help"
              value={form.helpText}
              onChange={(e) => setForm({ ...form, helpText: e.target.value })}
              rows={2}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              create.mutate({
                sectionId,
                number: form.number.trim() || null,
                text: form.text.trim(),
                helpText: form.helpText.trim() || null,
              })
            }
            disabled={!form.text.trim() || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Evidence picker dialog — pick from existing org evidence.
// ---------------------------------------------------------------------------

function EvidencePickerDialog({
  open,
  onOpenChange,
  questionId,
  attached,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  attached: string[];
  onAttached: () => void;
}) {
  const { data: evidence, isLoading } = api.evidence.list.useQuery(
    { search: "", page: 1, pageSize: 50 },
    { enabled: open }
  );

  const attach = api.riskAssessmentQuestionnaire.attachEvidence.useMutation({
    onSuccess: () => {
      onAttached();
      toast.success("Evidence attached");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const list = (evidence as { items?: Array<{ id: string; title: string; originalFileName: string; fileSize: number }> } | undefined)?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach Evidence</DialogTitle>
          <DialogDescription>
            Pick from your existing evidence library. To upload new files, use the{" "}
            <Link href="/admin/evidence" className="underline">
              evidence library
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No evidence in library yet.
            </div>
          ) : (
            <ul className="space-y-1">
              {list.map((ev) => {
                const isAttached = attached.includes(ev.id);
                return (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ev.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ev.originalFileName} · {(ev.fileSize / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <Button
                      variant={isAttached ? "ghost" : "outline"}
                      size="sm"
                      disabled={isAttached || attach.isPending}
                      onClick={() => attach.mutate({ questionId, evidenceId: ev.id })}
                    >
                      {isAttached ? "Attached" : "Attach"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
