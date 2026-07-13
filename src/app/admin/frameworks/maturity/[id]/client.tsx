"use client";

/**
 * Maturity framework detail page.
 *
 * Renders the framework hierarchy (Function → Category → Subcategory, or
 * Domain → Practice) through the shared FrameworkNodeTable, so NIST CSF 2.0,
 * C2M2 and OWASP SAMM read exactly like the compliance framework pages.
 * Test instructions and acceptance criteria are editable inline by ORG_ADMIN
 * so assessors see them read-only during a maturity assessment.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Hash, Layers, Loader2, Search, Shield, Tag } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import { maturityToNodes, type FrameworkNode } from "@/lib/frameworks/framework-node";

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

  // Tree + search state. Expansion is controlled by the page; the table is
  // purely presentational.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  // Debounced like the compliance page: C2M2 is 356 practices and SAMM 90, and
  // every keystroke re-walks the whole tree.
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  // A maturity framework arrives whole from the server (134 domains at most),
  // so the tree is built once and there is nothing to lazy-load.
  // These hooks must sit above the isLoading / error early returns, hence the
  // internal guard on `framework` being undefined.
  const rootNodes = useMemo(
    () =>
      framework
        ? maturityToNodes(framework.domainHierarchy, framework.questions)
        : [],
    [framework],
  );

  // Questions with no domain render outside the tree — maturityToNodes ignores
  // them by design. They are nodes like any other, so they can be searched.
  const frameworkLevelNodes = useMemo(
    (): FrameworkNode[] =>
      (framework?.questions ?? [])
        .filter((q) => q.domainId === null)
        .map((q) => ({
          id: q.id,
          code: q.practiceCode ?? q.id.slice(0, 8),
          title: q.questionText,
          description: null,
          kind: "question" as const,
          levelLabel: q.practiceLevel === null ? null : `MIL ${q.practiceLevel}`,
          depth: 0,
          childCount: 0,
          children: [],
          testInstructions: q.testInstructions,
          acceptanceCriteria: q.acceptanceCriteria,
        })),
    [framework],
  );

  // Search flattens: a hit deep in the tree has no parent row on screen to sit
  // under. Match on code and title, which is what people search by.
  //
  // The framework-level questions are part of the corpus: their own table is
  // hidden while a search is active, so leaving them out of the index would make
  // them unreachable for as long as anything is typed in the box.
  const isSearching = debouncedSearch.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const needle = debouncedSearch.trim().toLowerCase();
    const hits: FrameworkNode[] = [];
    const visit = (node: FrameworkNode) => {
      if (
        node.code.toLowerCase().includes(needle) ||
        node.title.toLowerCase().includes(needle)
      ) {
        hits.push({ ...node, depth: 0 });
      }
      for (const child of node.children ?? []) visit(child);
    };
    for (const root of rootNodes) visit(root);
    for (const node of frameworkLevelNodes) visit(node);
    return hits;
  }, [isSearching, debouncedSearch, rootNodes, frameworkLevelNodes]);

  const openEditor = (target: TestingTarget, focus: "ti" | "ac") => {
    setEditingTarget(target);
    setEditingTI(target.testInstructions ?? "");
    setEditingAC(target.acceptanceCriteria ?? "");
    setEditingFocus(focus);
  };

  // The tree carries both MaturityDomain nodes (CSF subcategories included) and
  // MaturityQuestion leaves. Only "question" nodes may go to the question
  // mutation — everything else is a domain row.
  const openEditorForNode = (node: FrameworkNode, focus: "ti" | "ac") =>
    openEditor(
      {
        kind: node.kind === "question" ? "question" : "domain",
        id: node.id,
        code: node.code,
        name: node.title,
        testInstructions: node.testInstructions,
        acceptanceCriteria: node.acceptanceCriteria,
      },
      focus,
    );

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

  const handleToggleExpand = (node: FrameworkNode) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Tag className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="text-lg font-medium">{framework.version}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Hash className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Domains</p>
                  <p className="text-lg font-medium">{framework.domains.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Layers className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Scoring Levels</p>
                  <p className="text-lg font-medium">
                    {framework.minLevel}–{framework.maxLevel}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Practices</p>
                  <p className="text-lg font-medium">{framework.questions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Domains</CardTitle>
                <CardDescription>
                  {framework.domains.length} domains •{" "}
                  {framework.questions.length > 0
                    ? `${framework.questions.length} practices/questions`
                    : "no questions (subcategories are the controls)"}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search domains and practices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rootNodes.length === 0 && frameworkLevelNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains defined.</p>
            ) : isSearching && searchResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No domains or practices match “{debouncedSearch}”.
              </p>
            ) : (
              <>
                {isSearching && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Showing flat results — {searchResults.length} match
                    {searchResults.length === 1 ? "" : "es"}. Expand is disabled
                    while searching.
                  </p>
                )}
                {(isSearching || rootNodes.length > 0) && (
                  <FrameworkNodeTable
                    nodes={isSearching ? searchResults : rootNodes}
                    columns={{ level: true, testing: true }}
                    expanded={expanded}
                    flat={isSearching}
                    idHeader="Code"
                    onToggleExpand={handleToggleExpand}
                    onEditTesting={openEditorForNode}
                  />
                )}
              </>
            )}

            {/* Questions not bound to any domain sit outside the tree. While a
                search is active they are part of the flat result list above
                instead, so this table stands down rather than duplicating them. */}
            {frameworkLevelNodes.length > 0 && !isSearching && (
              <div className="mt-6 space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Framework-level questions</h3>
                <FrameworkNodeTable
                  nodes={frameworkLevelNodes}
                  columns={{ level: true, testing: true }}
                  expanded={new Set()}
                  flat
                  idHeader="Code"
                  onToggleExpand={() => undefined}
                  onEditTesting={openEditorForNode}
                />
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
