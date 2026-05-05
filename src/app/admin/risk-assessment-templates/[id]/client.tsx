"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { FrameworkReferencePicker, type FrameworkRef } from "./framework-reference-picker";

interface Props {
  templateId: string;
}

export function TemplateEditorClient({ templateId }: Props) {
  const utils = api.useUtils();
  const { data: template, isLoading, error } =
    api.riskAssessmentTemplate.getById.useQuery({ id: templateId });

  // Section dialog state
  const [sectionDialog, setSectionDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; id: string; title: string; description: string | null }
    | null
  >(null);
  const [sectionForm, setSectionForm] = useState({ title: "", description: "" });

  // Question dialog state
  const [questionDialog, setQuestionDialog] = useState<
    | { mode: "create"; sectionId: string }
    | {
        mode: "edit";
        id: string;
        number: string | null;
        questionText: string;
        helpText: string | null;
        ref: FrameworkRef;
      }
    | null
  >(null);
  const [questionForm, setQuestionForm] = useState<{
    number: string;
    questionText: string;
    helpText: string;
    ref: FrameworkRef;
  }>({ number: "", questionText: "", helpText: "", ref: { kind: "none" } });

  // Delete confirmations
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ id: string; title: string } | null>(
    null
  );
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<{ id: string } | null>(null);

  // Resolve wizard
  const [resolveOpen, setResolveOpen] = useState(false);

  const refresh = () => utils.riskAssessmentTemplate.getById.invalidate({ id: templateId });

  const createSection = api.riskAssessmentTemplate.createSection.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Section added");
      setSectionDialog(null);
      setSectionForm({ title: "", description: "" });
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const updateSection = api.riskAssessmentTemplate.updateSection.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Section updated");
      setSectionDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const deleteSection = api.riskAssessmentTemplate.deleteSection.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Section deleted");
      setDeleteSectionTarget(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const createQuestion = api.riskAssessmentTemplate.createQuestion.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Question added");
      setQuestionDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const updateQuestion = api.riskAssessmentTemplate.updateQuestion.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Question updated");
      setQuestionDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const deleteQuestion = api.riskAssessmentTemplate.deleteQuestion.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Question deleted");
      setDeleteQuestionTarget(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const resolveReference = api.riskAssessmentTemplate.resolveReference.useMutation({
    onSuccess: () => {
      void refresh();
      toast.success("Reference resolved");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "RA Templates" }]}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-destructive">Error: {error.message}</div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !template) {
    return (
      <AppLayout breadcrumbs={[{ label: "Administration" }, { label: "RA Templates" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const unresolvedQuestions = template.sections.flatMap((s) =>
    s.questions
      .filter(
        (q) => q.unresolvedReference && !q.standardControl && !q.organizationalControl
      )
      .map((q) => ({ ...q, sectionTitle: s.title }))
  );

  const refToInput = (ref: FrameworkRef) => ({
    standardControlId: ref.kind === "standard" ? ref.id : null,
    organizationalControlId: ref.kind === "org" ? ref.id : null,
    unresolvedReference: ref.kind === "unresolved" ? ref.value : null,
  });

  const handleSectionSubmit = () => {
    if (!sectionForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (sectionDialog?.mode === "create") {
      createSection.mutate({
        templateId,
        title: sectionForm.title.trim(),
        description: sectionForm.description.trim() || null,
      });
    } else if (sectionDialog?.mode === "edit") {
      updateSection.mutate({
        id: sectionDialog.id,
        title: sectionForm.title.trim(),
        description: sectionForm.description.trim() || null,
      });
    }
  };

  const handleQuestionSubmit = () => {
    if (!questionForm.questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    const refInput = refToInput(questionForm.ref);
    if (questionDialog?.mode === "create") {
      createQuestion.mutate({
        sectionId: questionDialog.sectionId,
        number: questionForm.number.trim() || null,
        questionText: questionForm.questionText.trim(),
        helpText: questionForm.helpText.trim() || null,
        ...refInput,
      });
    } else if (questionDialog?.mode === "edit") {
      updateQuestion.mutate({
        id: questionDialog.id,
        number: questionForm.number.trim() || null,
        questionText: questionForm.questionText.trim(),
        helpText: questionForm.helpText.trim() || null,
        ...refInput,
      });
    }
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Administration" },
        { label: "RA Templates", href: "/admin/risk-assessment-templates" },
        { label: template.name },
      ]}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/admin/risk-assessment-templates"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to templates
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
            {template.description && (
              <CardDescription>{template.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{template.sections.length} sections</Badge>
              <Badge variant="secondary">
                {template.sections.reduce((acc, s) => acc + s.questions.length, 0)} questions
              </Badge>
              {!template.isActive && <Badge variant="outline">Inactive</Badge>}
            </div>
          </CardContent>
        </Card>

        {unresolvedQuestions.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  {unresolvedQuestions.length} reference
                  {unresolvedQuestions.length === 1 ? "" : "s"} unresolved
                </span>
                <span className="ml-1 text-amber-800/80 dark:text-amber-300/80">
                  — these questions have raw <code className="text-xs">framework_ref</code> values from CSV import that didn&apos;t match a known control.
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              onClick={() => setResolveOpen(true)}
            >
              Resolve Now
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {template.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    {section.description && (
                      <CardDescription>{section.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSectionDialog({
                          mode: "edit",
                          id: section.id,
                          title: section.title,
                          description: section.description,
                        });
                        setSectionForm({
                          title: section.title,
                          description: section.description ?? "",
                        });
                      }}
                      title="Edit section"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        setDeleteSectionTarget({ id: section.id, title: section.title })
                      }
                      title="Delete section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {section.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic mb-4">
                    No questions yet.
                  </p>
                ) : (
                  <ul className="space-y-2 mb-4">
                    {section.questions.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-start justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {q.number && (
                              <Badge variant="outline" className="font-mono">
                                {q.number}
                              </Badge>
                            )}
                            <span className="text-sm">{q.questionText}</span>
                          </div>
                          {(q.standardControl || q.organizationalControl || q.unresolvedReference) && (
                            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                              <ChevronRight className="h-3 w-3" />
                              {q.standardControl && (
                                <span>
                                  Standard: {q.standardControl.code} — {q.standardControl.title}
                                </span>
                              )}
                              {q.organizationalControl && (
                                <span>
                                  Org: {q.organizationalControl.localControlId} —{" "}
                                  {q.organizationalControl.name}
                                </span>
                              )}
                              {q.unresolvedReference && !q.standardControl && !q.organizationalControl && (
                                <span className="text-amber-600">
                                  Unresolved: {q.unresolvedReference}
                                </span>
                              )}
                            </div>
                          )}
                          {q.helpText && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {q.helpText}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              const ref: FrameworkRef = q.standardControl
                                ? {
                                    kind: "standard",
                                    id: q.standardControl.id,
                                    label: `${q.standardControl.code} — ${q.standardControl.title}`,
                                  }
                                : q.organizationalControl
                                  ? {
                                      kind: "org",
                                      id: q.organizationalControl.id,
                                      label: `${q.organizationalControl.localControlId} — ${q.organizationalControl.name}`,
                                    }
                                  : q.unresolvedReference
                                    ? { kind: "unresolved", value: q.unresolvedReference }
                                    : { kind: "none" };
                              setQuestionDialog({
                                mode: "edit",
                                id: q.id,
                                number: q.number,
                                questionText: q.questionText,
                                helpText: q.helpText,
                                ref,
                              });
                              setQuestionForm({
                                number: q.number ?? "",
                                questionText: q.questionText,
                                helpText: q.helpText ?? "",
                                ref,
                              });
                            }}
                            title="Edit question"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteQuestionTarget({ id: q.id })}
                            title="Delete question"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuestionDialog({ mode: "create", sectionId: section.id });
                    setQuestionForm({
                      number: "",
                      questionText: "",
                      helpText: "",
                      ref: { kind: "none" },
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSectionDialog({ mode: "create" });
              setSectionForm({ title: "", description: "" });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        {/* Section dialog */}
        <Dialog
          open={sectionDialog !== null}
          onOpenChange={(open) => !open && setSectionDialog(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {sectionDialog?.mode === "edit" ? "Edit Section" : "New Section"}
              </DialogTitle>
              <DialogDescription>
                Sections group related questions together.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="section-title">Title *</Label>
                <Input
                  id="section-title"
                  value={sectionForm.title}
                  onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                  placeholder="e.g., Access Control"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={sectionForm.description}
                  onChange={(e) =>
                    setSectionForm({ ...sectionForm, description: e.target.value })
                  }
                  rows={2}
                  maxLength={1000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSectionDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSectionSubmit}
                disabled={
                  !sectionForm.title.trim() ||
                  createSection.isPending ||
                  updateSection.isPending
                }
              >
                {(createSection.isPending || updateSection.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {sectionDialog?.mode === "edit" ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Question dialog */}
        <Dialog
          open={questionDialog !== null}
          onOpenChange={(open) => !open && setQuestionDialog(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {questionDialog?.mode === "edit" ? "Edit Question" : "New Question"}
              </DialogTitle>
              <DialogDescription>
                Questions render as a status / notes / evidence form during assessment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="q-number">Number</Label>
                  <Input
                    id="q-number"
                    value={questionForm.number}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, number: e.target.value })
                    }
                    placeholder="3.2"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-text">Question text *</Label>
                  <Textarea
                    id="q-text"
                    value={questionForm.questionText}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, questionText: e.target.value })
                    }
                    rows={2}
                    maxLength={2000}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-help">Help text</Label>
                <Textarea
                  id="q-help"
                  value={questionForm.helpText}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, helpText: e.target.value })
                  }
                  rows={2}
                  maxLength={1000}
                  placeholder="Optional guidance shown below the question"
                />
              </div>
              <div className="space-y-2">
                <Label>Framework Reference</Label>
                <FrameworkReferencePicker
                  value={questionForm.ref}
                  onChange={(ref) => setQuestionForm({ ...questionForm, ref })}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Link this question to a control from a framework or your
                  internal control library.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuestionDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleQuestionSubmit}
                disabled={
                  !questionForm.questionText.trim() ||
                  createQuestion.isPending ||
                  updateQuestion.isPending
                }
              >
                {(createQuestion.isPending || updateQuestion.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {questionDialog?.mode === "edit" ? "Save Changes" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteSectionTarget !== null}
          onOpenChange={(open) => !open && setDeleteSectionTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete section &quot;{deleteSectionTarget?.title}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                All questions in this section will also be deleted. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteSectionTarget && deleteSection.mutate({ id: deleteSectionTarget.id })
                }
                disabled={deleteSection.isPending}
              >
                {deleteSection.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={deleteQuestionTarget !== null}
          onOpenChange={(open) => !open && setDeleteQuestionTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this question?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Existing assessment instances keep their
                snapshot of this question.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteQuestionTarget && deleteQuestion.mutate({ id: deleteQuestionTarget.id })
                }
                disabled={deleteQuestion.isPending}
              >
                {deleteQuestion.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resolve Unresolved References</DialogTitle>
              <DialogDescription>
                For each question below, pick the matching control from your
                framework library or organizational controls. The raw value
                from the CSV is shown for context.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {unresolvedQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  All references resolved. 🎉
                </p>
              ) : (
                unresolvedQuestions.map((q) => (
                  <div key={q.id} className="rounded-md border p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {q.sectionTitle} {q.number ? `· ${q.number}` : ""}
                    </div>
                    <div className="text-sm">{q.questionText}</div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Raw value: </span>
                      <code className="font-mono text-amber-600">
                        {q.unresolvedReference}
                      </code>
                    </div>
                    <FrameworkReferencePicker
                      value={{ kind: "none" }}
                      onChange={(ref) => {
                        if (ref.kind === "standard") {
                          resolveReference.mutate({
                            questionId: q.id,
                            resolution: { kind: "standard", id: ref.id },
                          });
                        } else if (ref.kind === "org") {
                          resolveReference.mutate({
                            questionId: q.id,
                            resolution: { kind: "org", id: ref.id },
                          });
                        } else if (ref.kind === "none") {
                          resolveReference.mutate({
                            questionId: q.id,
                            resolution: { kind: "clear" },
                          });
                        }
                        // unresolved kind: leave as-is, no-op
                      }}
                    />
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
