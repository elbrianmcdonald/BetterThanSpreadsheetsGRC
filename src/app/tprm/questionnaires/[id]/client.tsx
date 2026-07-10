"use client";

/**
 * Questionnaire Template Detail Client Component
 *
 * Epic 4: Questionnaire System
 * Story 4.1: Pre-Built Questionnaire Templates (FR27)
 *
 * Shows template details with all sections and questions.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileQuestion,
  Edit,
  Copy,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  FileText,
  ToggleLeft,
  List,
  Upload,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { QuestionType, UserRole } from "@prisma/client";
import { WRITE_ROLES } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";

/**
 * Roles that can manage questionnaire templates
 */
const TEMPLATE_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

interface QuestionnaireDetailClientProps {
  templateId: string;
}

/**
 * Question type icon mapping
 */
const QUESTION_TYPE_ICON: Record<QuestionType, React.ReactNode> = {
  TEXT: <FileText className="h-4 w-4 text-blue-500" />,
  YES_NO: <ToggleLeft className="h-4 w-4 text-green-500" />,
  MULTI_CHOICE: <List className="h-4 w-4 text-purple-500" />,
  FILE_UPLOAD: <Upload className="h-4 w-4 text-orange-500" />,
};

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  TEXT: "Text",
  YES_NO: "Yes/No",
  MULTI_CHOICE: "Multiple Choice",
  FILE_UPLOAD: "File Upload",
};

export function QuestionnaireDetailClient({ templateId }: QuestionnaireDetailClientProps) {
  const router = useRouter();
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Role checks
  const canManageTemplates = useHasRole(TEMPLATE_MANAGE_ROLES);

  // Fetch template
  const { data: template, isLoading, error } = api.questionnaire.getTemplateById.useQuery(
    { id: templateId },
    { retry: false }
  );

  // Delete mutation
  const deleteMutation = api.questionnaire.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      router.push("/tprm/questionnaires");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });

  // Copy mutation
  const copyMutation = api.questionnaire.copyTemplate.useMutation({
    onSuccess: (newTemplate) => {
      toast.success("Template copied successfully");
      setCopyDialogOpen(false);
      router.push(`/tprm/questionnaires/${newTemplate.id}/edit`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to copy template");
    },
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (template) {
      setExpandedSections(new Set(template.sections.map((s) => s.id)));
    }
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const handleCopy = () => {
    if (!template) return;
    setCopyName(`${template.name} (Copy)`);
    setCopyDialogOpen(true);
  };

  const submitCopy = () => {
    if (!copyName.trim()) return;
    copyMutation.mutate({
      templateId,
      newName: copyName.trim(),
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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

  const totalQuestions = template.sections.reduce(
    (acc, s) => acc + s.questions.length,
    0
  );
  const requiredQuestions = template.sections.reduce(
    (acc, s) => acc + s.questions.filter((q) => q.isRequired).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FileQuestion className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{template.name}</h1>
              {template.isSystemTemplate && (
                <Badge variant="secondary">System Template</Badge>
              )}
            </div>
            {template.description && (
              <p className="mt-1 text-muted-foreground">{template.description}</p>
            )}
            <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
              <span>{template.sections.length} sections</span>
              <span>{totalQuestions} questions</span>
              <span>{requiredQuestions} required</span>
              <span>v{template.version}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          {canManageTemplates && !template.isSystemTemplate && (
            <>
              <Link href={`/tprm/questionnaires/${templateId}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the template from your organization. Existing
                      questionnaires using this template will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: templateId })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sections</CardDescription>
            <CardTitle className="text-2xl">{template.sections.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Questions</CardDescription>
            <CardTitle className="text-2xl">{totalQuestions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Required</CardDescription>
            <CardTitle className="text-2xl">{requiredQuestions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Optional</CardDescription>
            <CardTitle className="text-2xl">{totalQuestions - requiredQuestions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Sections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Preview all sections and questions in this template
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.sections.map((section, sIdx) => (
            <Collapsible
              key={section.id}
              open={expandedSections.has(section.id)}
              onOpenChange={() => toggleSection(section.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <div>
                      <div className="font-medium">
                        Section {sIdx + 1}: {section.title}
                      </div>
                      {section.description && (
                        <div className="text-sm text-muted-foreground">
                          {section.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {section.questions.length} questions
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-8 mt-2 space-y-3 border-l pl-4">
                  {section.questions.map((question, qIdx) => (
                    <div
                      key={question.id}
                      className="p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Q{sIdx + 1}.{qIdx + 1}
                            </span>
                            {question.isRequired && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 font-medium">
                            {question.questionText}
                          </div>
                          {question.helpText && (
                            <div className="mt-1 text-sm text-muted-foreground">
                              {question.helpText}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {QUESTION_TYPE_ICON[question.questionType]}
                          <span className="text-sm text-muted-foreground">
                            {QUESTION_TYPE_LABEL[question.questionType]}
                          </span>
                        </div>
                      </div>
                      {/* Show choices for multi-choice questions */}
                      {question.questionType === QuestionType.MULTI_CHOICE &&
                        question.choices &&
                        question.choices.length > 0 && (
                          <div className="mt-3 ml-4 space-y-1">
                            {question.choices.map((choice) => (
                              <div
                                key={choice.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <div className="w-4 h-4 border rounded-full" />
                                <span>{choice.choiceText}</span>
                                {choice.isConcerning && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-orange-500 border-orange-500"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Concerning
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Copy Template Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Template</DialogTitle>
            <DialogDescription>
              Create a new custom template based on "{template.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">New Template Name</label>
            <Input
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              placeholder="Enter template name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitCopy}
              disabled={!copyName.trim() || copyMutation.isPending}
            >
              {copyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying...
                </>
              ) : (
                "Copy & Edit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
