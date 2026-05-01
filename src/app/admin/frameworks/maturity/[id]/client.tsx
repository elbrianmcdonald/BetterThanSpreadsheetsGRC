"use client";

/**
 * Maturity framework detail page.
 *
 * Renders the framework hierarchy as a nested tree (Function → Category →
 * Subcategory) and surfaces questions/practices grouped under their domain.
 * Test instructions and acceptance criteria are editable inline by ORG_ADMIN
 * so assessors see them read-only during a maturity assessment.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Shield, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  frameworkId: string;
}

interface ScoringLevel {
  value: number;
  label: string;
  description?: string;
  criteria?: string;
}

type TestingTarget =
  | { kind: "domain"; id: string; code: string; name: string; testInstructions: string | null; acceptanceCriteria: string | null }
  | { kind: "question"; id: string; code: string; name: string; testInstructions: string | null; acceptanceCriteria: string | null };

export function MaturityFrameworkDetailClient({ frameworkId }: Props) {
  const utils = api.useUtils();
  const { data: framework, isLoading, error } = api.maturity.getFramework.useQuery({
    id: frameworkId,
  });

  // Edit-testing-fields dialog state. Used for both domains and questions —
  // the `kind` discriminator on the target tells the save handler which
  // mutation to invoke.
  const [editingTarget, setEditingTarget] = useState<TestingTarget | null>(null);
  const [editingTI, setEditingTI] = useState("");
  const [editingAC, setEditingAC] = useState("");
  const [editingFocus, setEditingFocus] = useState<"ti" | "ac">("ti");

  const updateDomainTesting = api.maturity.updateDomainTestingFields.useMutation({
    onSuccess: () => {
      toast.success("Testing fields updated");
      setEditingTarget(null);
      void utils.maturity.getFramework.invalidate({ id: frameworkId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateQuestionTesting = api.maturity.updateQuestionTestingFields.useMutation({
    onSuccess: () => {
      toast.success("Testing fields updated");
      setEditingTarget(null);
      void utils.maturity.getFramework.invalidate({ id: frameworkId });
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = updateDomainTesting.isPending || updateQuestionTesting.isPending;

  const openEditor = (target: TestingTarget, focus: "ti" | "ac") => {
    setEditingTarget(target);
    setEditingTI(target.testInstructions ?? "");
    setEditingAC(target.acceptanceCriteria ?? "");
    setEditingFocus(focus);
  };

  const handleSave = () => {
    if (!editingTarget) return;
    const payload = {
      id: editingTarget.id,
      testInstructions: editingTI.trim() || null,
      acceptanceCriteria: editingAC.trim() || null,
    };
    if (editingTarget.kind === "domain") {
      updateDomainTesting.mutate(payload);
    } else {
      updateQuestionTesting.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !framework) {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle>Framework not found</CardTitle>
            <CardDescription>
              {error?.message || "Could not load this maturity framework."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/frameworks">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Frameworks
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const scoringLevels = (framework.scoringLevels ?? []) as unknown as ScoringLevel[];
  const questionsByDomain = new Map<string | null, typeof framework.questions>();
  for (const q of framework.questions) {
    const key = q.domainId ?? null;
    if (!questionsByDomain.has(key)) questionsByDomain.set(key, []);
    questionsByDomain.get(key)!.push(q);
  }
  const frameworkLevelQuestions = questionsByDomain.get(null) ?? [];

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/frameworks">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Frameworks
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                    Maturity
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {framework.type}
                  </Badge>
                  <Badge variant="outline">v{framework.version}</Badge>
                  {framework.isSystemTemplate && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                      System Template
                    </Badge>
                  )}
                  {framework.isActive ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">{framework.name}</CardTitle>
                {framework.description && (
                  <CardDescription>{framework.description}</CardDescription>
                )}
              </div>
              <Button variant="outline" asChild>
                <Link href="/maturity/dashboard">
                  <Shield className="h-4 w-4 mr-2" />
                  Maturity Dashboard
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring Levels</CardTitle>
            <CardDescription>
              Levels {framework.minLevel}–{framework.maxLevel} (
              {scoringLevels.length} levels)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scoringLevels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scoring levels defined.
              </p>
            ) : (
              scoringLevels.map((level) => (
                <div
                  key={level.value}
                  className="flex gap-3 p-3 border rounded-lg"
                >
                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                      {level.value}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{level.label}</p>
                    {level.description && (
                      <p className="text-sm text-muted-foreground">
                        {level.description}
                      </p>
                    )}
                    {level.criteria && (
                      <p className="text-xs text-muted-foreground italic">
                        {level.criteria}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Domains</CardTitle>
            <CardDescription>
              {framework.domains.length} domains •{" "}
              {framework.questions.length > 0
                ? `${framework.questions.length} practices/questions`
                : "no questions (subcategories are the controls)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {framework.domainHierarchy.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains defined.</p>
            ) : (
              <div className="space-y-2">
                {framework.domainHierarchy.map((root) => (
                  <DomainNode
                    key={root.id}
                    domain={root}
                    questionsByDomain={questionsByDomain}
                    depth={0}
                    onEditDomain={(d, focus) =>
                      openEditor(
                        {
                          kind: "domain",
                          id: d.id,
                          code: d.code,
                          name: d.name,
                          testInstructions: d.testInstructions,
                          acceptanceCriteria: d.acceptanceCriteria,
                        },
                        focus
                      )
                    }
                    onEditQuestion={(q, focus) =>
                      openEditor(
                        {
                          kind: "question",
                          id: q.id,
                          code: q.practiceCode ?? q.id.slice(0, 8),
                          name: q.questionText.slice(0, 80),
                          testInstructions: q.testInstructions,
                          acceptanceCriteria: q.acceptanceCriteria,
                        },
                        focus
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Framework-level questions (not bound to a domain) */}
            {frameworkLevelQuestions.length > 0 && (
              <div className="mt-6 pt-4 border-t space-y-2">
                <h3 className="text-sm font-medium">Framework-level questions</h3>
                {frameworkLevelQuestions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    onEdit={(focus) =>
                      openEditor(
                        {
                          kind: "question",
                          id: q.id,
                          code: q.practiceCode ?? q.id.slice(0, 8),
                          name: q.questionText.slice(0, 80),
                          testInstructions: q.testInstructions,
                          acceptanceCriteria: q.acceptanceCriteria,
                        },
                        focus
                      )
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Test Instructions / Acceptance Criteria dialog. Used for
          both domains and questions; mutation chosen by `kind` on save. */}
      <Dialog
        open={!!editingTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTarget(null);
            setEditingTI("");
            setEditingAC("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              Edit testing fields {editingTarget && `— ${editingTarget.code}`}
            </DialogTitle>
            <DialogDescription>
              Visible read-only during maturity assessments. Author once here,
              assessors see them while documenting evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ti">Test Instructions</Label>
              <Textarea
                id="ti"
                rows={5}
                autoFocus={editingFocus === "ti"}
                value={editingTI}
                onChange={(e) => setEditingTI(e.target.value)}
                placeholder="How an assessor verifies this is in place..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac">Acceptance Criteria</Label>
              <Textarea
                id="ac"
                rows={5}
                autoFocus={editingFocus === "ac"}
                value={editingAC}
                onChange={(e) => setEditingAC(e.target.value)}
                placeholder="What counts as evidence of meeting this..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// =============================================================================
// Tree node — recursive
// =============================================================================

type DomainNodeShape = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: string;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  children: DomainNodeShape[];
};

type QuestionShape = {
  id: string;
  questionText: string;
  practiceCode: string | null;
  practiceLevel: number | null;
  testInstructions: string | null;
  acceptanceCriteria: string | null;
};

function DomainNode({
  domain,
  questionsByDomain,
  depth,
  onEditDomain,
  onEditQuestion,
}: {
  domain: DomainNodeShape;
  questionsByDomain: Map<string | null, QuestionShape[]>;
  depth: number;
  onEditDomain: (d: DomainNodeShape, focus: "ti" | "ac") => void;
  onEditQuestion: (q: QuestionShape, focus: "ti" | "ac") => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const childQuestions = questionsByDomain.get(domain.id) ?? [];
  const hasChildren = domain.children.length > 0 || childQuestions.length > 0;

  // Color the node based on its level (Function = purple, Category = blue,
  // Subcategory = neutral) so the hierarchy reads at a glance.
  const levelColor =
    domain.level === "FUNCTION"
      ? "bg-purple-50 border-purple-200"
      : domain.level === "CATEGORY"
        ? "bg-blue-50 border-blue-200"
        : "bg-white border-gray-200";

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : "1.25rem" }}>
      <div className={`flex items-start gap-2 p-3 rounded-lg border ${levelColor}`}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
        ) : (
          <span className="shrink-0 w-4" />
        )}
        <Badge variant="outline" className="font-mono shrink-0">
          {domain.code}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{domain.name}</p>
          {domain.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {domain.description}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {domain.level}
        </Badge>
        <TestingBadges
          testInstructions={domain.testInstructions}
          acceptanceCriteria={domain.acceptanceCriteria}
          onEdit={(focus) => onEditDomain(domain, focus)}
        />
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {domain.children.map((child) => (
            <DomainNode
              key={child.id}
              domain={child}
              questionsByDomain={questionsByDomain}
              depth={depth + 1}
              onEditDomain={onEditDomain}
              onEditQuestion={onEditQuestion}
            />
          ))}
          {childQuestions.length > 0 && (
            <div style={{ marginLeft: "1.25rem" }} className="space-y-1.5">
              {childQuestions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  onEdit={(focus) => onEditQuestion(q, focus)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  onEdit,
}: {
  question: QuestionShape;
  onEdit: (focus: "ti" | "ac") => void;
}) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-md border bg-muted/30 text-sm">
      {question.practiceCode && (
        <Badge variant="outline" className="font-mono text-xs shrink-0">
          {question.practiceCode}
        </Badge>
      )}
      {question.practiceLevel !== null && (
        <Badge variant="secondary" className="text-xs shrink-0">
          MIL {question.practiceLevel}
        </Badge>
      )}
      <p className="flex-1 min-w-0">{question.questionText}</p>
      <TestingBadges
        testInstructions={question.testInstructions}
        acceptanceCriteria={question.acceptanceCriteria}
        onEdit={onEdit}
      />
    </div>
  );
}

function TestingBadges({
  testInstructions,
  acceptanceCriteria,
  onEdit,
}: {
  testInstructions: string | null;
  acceptanceCriteria: string | null;
  onEdit: (focus: "ti" | "ac") => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {testInstructions ? (
        <Badge
          variant="secondary"
          className="text-xs bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200"
          title={testInstructions}
          onClick={() => onEdit("ti")}
        >
          TI ✓
        </Badge>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => onEdit("ti")}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          TI
        </Button>
      )}
      {acceptanceCriteria ? (
        <Badge
          variant="secondary"
          className="text-xs bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200"
          title={acceptanceCriteria}
          onClick={() => onEdit("ac")}
        >
          AC ✓
        </Badge>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => onEdit("ac")}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          AC
        </Button>
      )}
    </div>
  );
}
