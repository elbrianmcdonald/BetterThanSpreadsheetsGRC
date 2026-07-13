"use client";

/**
 * Framework Detail Client Component
 *
 * Displays framework metadata and control list with search and pagination.
 *
 * @see Story 2.2: OSCAL Catalog Storage and Retrieval
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  Tag,
  Hash,
  ExternalLink,
  RefreshCw,
  BarChart3,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Download,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Lock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ControlDetailModal } from "@/components/frameworks/ControlDetailModal";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
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
import { ControlDomainSelect } from "@/components/taxonomy/ControlDomainSelect";
import { FrameworkNodeTable } from "@/components/frameworks/FrameworkNodeTable";
import { controlsToNodes, type FrameworkNode } from "@/lib/frameworks/framework-node";

/**
 * Return a copy of the tree with `children` attached to the node with `parentId`.
 * Children arrive one level at a time, so this only ever has to recurse.
 */
function graftChildren(
  nodes: FrameworkNode[],
  parentId: string,
  children: FrameworkNode[],
): FrameworkNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: children.map((child) => ({ ...child, depth: node.depth + 1 })),
      };
    }
    if (node.children === null) return node;
    return { ...node, children: graftChildren(node.children, parentId, children) };
  });
}

interface FrameworkDetailClientProps {
  frameworkId: string;
}

export function FrameworkDetailClient({ frameworkId }: FrameworkDetailClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  // Story 12.3: Health filter (AC11)
  const [healthFilter, setHealthFilter] = useState<"all" | "HEALTHY" | "AT_RISK" | "CRITICAL">("all");
  // Story 12.4: Control CRUD state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    controlId: "",
    title: "",
    description: "",
    guidance: "",
    parentControlId: "",
  });
  const [showDeprecated, setShowDeprecated] = useState(false);
  // Domain tagging state
  const [taggingControlId, setTaggingControlId] = useState<string | null>(null);
  const [taggingControlDomains, setTaggingControlDomains] = useState<string[]>([]);
  // Test instructions / acceptance criteria edit state. We open one dialog
  // for a single control at a time; `editingTestingField` selects which of
  // the two fields the dialog focuses on.
  const [editingTestingControlId, setEditingTestingControlId] = useState<string | null>(null);
  const [editingTestingField, setEditingTestingField] = useState<
    "testInstructions" | "acceptanceCriteria"
  >("testInstructions");
  const [editingTestInstructions, setEditingTestInstructions] = useState("");
  const [editingAcceptanceCriteria, setEditingAcceptanceCriteria] = useState("");
  const pageSize = 50;

  const utils = api.useUtils();

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(0); // Reset to first page on search
    // Simple debounce
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Fetch framework details
  const { data: framework, isLoading: isLoadingFramework, error: frameworkError } =
    api.framework.getById.useQuery({ id: frameworkId });

  const isSearching = debouncedSearch.length > 0;

  // Not searching: load top-level rows only and lazy-expand. Searching: flat
  // results, because a search hit deep in the tree has no meaningful parent row
  // to draw it under.
  const { data: controlsData, isLoading: isLoadingControls } =
    api.framework.getControls.useQuery({
      frameworkId,
      topLevelOnly: !isSearching,
      search: debouncedSearch || undefined,
      page: currentPage,
      pageSize,
    });

  // Story 12.3: Fetch control health data (AC1-AC4, AC25-AC26)
  const { data: healthData, isLoading: isLoadingHealth } =
    api.controlLink.getFrameworkControlHealth.useQuery({ frameworkId });

  // Story 12.4: Control CRUD mutations
  const createControlMutation = api.framework.createControl.useMutation({
    onSuccess: () => {
      toast.success("Control created successfully");
      setShowCreateDialog(false);
      setCreateForm({ controlId: "", title: "", description: "", guidance: "", parentControlId: "" });
      utils.framework.getControls.invalidate({ frameworkId });
      utils.controlLink.getFrameworkControlHealth.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deprecateControlMutation = api.framework.deprecateControl.useMutation({
    onSuccess: () => {
      toast.success("Control deprecated");
      utils.framework.getControls.invalidate({ frameworkId });
      utils.controlLink.getFrameworkControlHealth.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const restoreControlMutation = api.framework.restoreControl.useMutation({
    onSuccess: () => {
      toast.success("Control restored");
      utils.framework.getControls.invalidate({ frameworkId });
      utils.controlLink.getFrameworkControlHealth.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteControlMutation = api.framework.deleteControl.useMutation({
    onSuccess: () => {
      toast.success("Control deleted");
      utils.framework.getControls.invalidate({ frameworkId });
      utils.controlLink.getFrameworkControlHealth.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Test instructions / acceptance criteria mutation. Reuses the existing
  // updateControl endpoint, which now exempts these two fields from the
  // OSCAL-import lock.
  const updateTestingFieldsMutation = api.framework.updateControl.useMutation({
    onSuccess: () => {
      toast.success("Control testing fields updated");
      setEditingTestingControlId(null);
      setEditingTestInstructions("");
      setEditingAcceptanceCriteria("");
      utils.framework.getControls.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Domain tagging mutation
  const setControlDomainsMutation = api.controlDomain.setControlDomains.useMutation({
    onSuccess: () => {
      toast.success("Control domains updated");
      setTaggingControlId(null);
      setTaggingControlDomains([]);
      utils.framework.getControls.invalidate({ frameworkId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // --- Lazy-loaded control tree ---------------------------------------------
  const [rootNodes, setRootNodes] = useState<FrameworkNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingChildIds, setLoadingChildIds] = useState<Set<string>>(new Set());
  const [pendingExpandId, setPendingExpandId] = useState<string | null>(null);

  // Rebuild the tree whenever the server returns a new page / search result.
  // Expansion is reset with it: the old ids are not on screen any more.
  useEffect(() => {
    setRootNodes(controlsToNodes(controlsData?.controls ?? []));
    setExpanded(new Set());
  }, [controlsData]);

  const { data: childControls } = api.framework.getControlChildren.useQuery(
    { parentControlId: pendingExpandId! },
    { enabled: pendingExpandId !== null },
  );

  // Graft fetched children onto the node that asked for them.
  useEffect(() => {
    if (!pendingExpandId || !childControls) return;
    const parentId = pendingExpandId;
    const children = controlsToNodes(childControls);

    setRootNodes((prev) => graftChildren(prev, parentId, children));
    setLoadingChildIds((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    setPendingExpandId(null);
  }, [pendingExpandId, childControls]);

  const handleToggleExpand = (node: FrameworkNode) => {
    const isOpen = expanded.has(node.id);

    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(node.id);
      else next.add(node.id);
      return next;
    });

    // Fetch children the first time this row opens.
    if (!isOpen && node.children === null) {
      setLoadingChildIds((prev) => new Set(prev).add(node.id));
      setPendingExpandId(node.id);
    }
  };

  const handleCreateControl = () => {
    createControlMutation.mutate({
      frameworkId,
      controlId: createForm.controlId,
      title: createForm.title,
      description: createForm.description,
      guidance: createForm.guidance || undefined,
      parentControlId: createForm.parentControlId || undefined,
    });
  };

  const breadcrumbs = [
    { label: "Frameworks", href: "/admin/frameworks" },
    { label: framework?.name || "Loading..." },
  ];

  if (isLoadingFramework) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  if (frameworkError || !framework) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">
            {frameworkError?.message || "Framework not found"}
          </div>
        </div>
      </AppLayout>
    );
  }

  const { pagination } = controlsData ?? { pagination: null };

  // Story 12.3: Health lookup, keyed by control id (AC1-AC4)
  const healthByNodeId = new Map(
    (healthData?.controls ?? []).map((h) => [
      h.id,
      { health: h.health, riskCount: h.riskCount, findingCount: h.findingCount },
    ]),
  );

  // Story 12.3: Apply health filter (AC11). The filter narrows which ROOT rows
  // are shown. Filtering mid-tree would orphan children, so a filtered view is
  // a flat view.
  const isFiltering = healthFilter !== "all";
  const visibleRoots = isFiltering
    ? rootNodes.filter((n) => (healthByNodeId.get(n.id)?.health ?? "HEALTHY") === healthFilter)
    : rootNodes;

  // Story 12.3: Calculate health summary (AC25-AC26)
  const healthSummary = healthData?.summary ?? {
    total: 0,
    healthy: 0,
    atRisk: 0,
    critical: 0,
  };

  // Story 12.3: CSV export function (AC27-AC28)
  const handleExportCSV = () => {
    if (!healthData) return;

    const headers = ["Control ID", "Title", "Health", "Risk Count", "Finding Count"];
    const rows = healthData.controls.map((c) => [
      c.controlId,
      c.title,
      c.health,
      c.riskCount.toString(),
      c.findingCount.toString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${framework?.code ?? "framework"}-control-health.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Framework Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{framework.name}</h1>
            <span className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">
              {framework.code}
            </span>
            {framework.isActive ? (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {framework.description || "No description available"}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Link href={`/admin/frameworks/${frameworkId}/reconciliation`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reconciliation Report
            </Button>
          </Link>
          <Link href={`/admin/frameworks/${frameworkId}/update`}>
            <Button size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Update Framework
            </Button>
          </Link>
        </div>
      </div>

      {/* Framework Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Tag className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Version</p>
                <p className="text-lg font-medium">{framework.version}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Hash className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Total Controls</p>
                <p className="text-lg font-medium">{framework._count?.Control || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Imported</p>
                <p className="text-lg font-medium">
                  {new Date(framework.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {framework.sourceUrl && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <ExternalLink className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <a
                    href={framework.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 truncate max-w-[150px] block"
                  >
                    View Source
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Story 12.3: Control Health Summary Cards (AC25-AC26) */}
      {!isLoadingHealth && healthData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Healthy Controls</p>
                  <p className="text-2xl font-bold text-green-600">{healthSummary.healthy}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Shield className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">At Risk Controls</p>
                  <p className="text-2xl font-bold text-yellow-600">{healthSummary.atRisk}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Critical Controls</p>
                  <p className="text-2xl font-bold text-red-600">{healthSummary.critical}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between h-full">
                <div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                  <p className="text-2xl font-bold">
                    {healthSummary.total > 0
                      ? Math.round((healthSummary.healthy / healthSummary.total) * 100)
                      : 100}%
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Controls
              </CardTitle>
              <CardDescription>
                {/* The true total, from getById. `pagination.totalCount` now
                    counts top-level rows only, so it cannot be used here. */}
                {framework._count?.Control ?? 0} controls in this framework
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Story 12.4: Add Control button (AC1) */}
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Control
              </Button>
              {/* Story 12.3: Health filter (AC11) */}
              <Select
                value={healthFilter}
                onValueChange={(v) => setHealthFilter(v as typeof healthFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Health</SelectItem>
                  <SelectItem value="HEALTHY">Healthy</SelectItem>
                  <SelectItem value="AT_RISK">At Risk</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search controls..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingControls ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : visibleRoots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {debouncedSearch || healthFilter !== "all" ? (
                <>
                  <p>No controls found matching your filters</p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedSearch("");
                      setHealthFilter("all");
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <p>No controls in this framework</p>
              )}
            </div>
          ) : (
            <>
              {(isSearching || isFiltering) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  Showing flat results — expand is disabled while{" "}
                  {isSearching ? "searching" : "filtering"}.
                </p>
              )}

              <FrameworkNodeTable
                nodes={visibleRoots}
                columns={{
                  health: true,
                  domains: true,
                  testing: true,
                  children: true,
                  actions: true,
                }}
                expanded={expanded}
                onToggleExpand={handleToggleExpand}
                loadingChildIds={loadingChildIds}
                healthByNodeId={healthByNodeId}
                flat={isSearching || isFiltering}
                onRowClick={(node) => setSelectedControlId(node.id)}
                onEditTesting={(node, focus) => {
                  setEditingTestingControlId(node.id);
                  setEditingTestingField(focus === "ti" ? "testInstructions" : "acceptanceCriteria");
                  setEditingTestInstructions(node.testInstructions ?? "");
                  setEditingAcceptanceCriteria(node.acceptanceCriteria ?? "");
                }}
                onEditDomains={(node) => {
                  setTaggingControlId(node.id);
                  setTaggingControlDomains((node.domains ?? []).map((d) => d.id));
                }}
                renderActions={(node) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedControlId(node.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {node.isActive ? (
                        <DropdownMenuItem
                          onClick={() => deprecateControlMutation.mutate({ id: node.id })}
                          className="text-amber-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deprecate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => restoreControlMutation.mutate({ id: node.id })}
                          className="text-green-600"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      {(healthByNodeId.get(node.id)?.riskCount ?? 0) === 0 &&
                        (healthByNodeId.get(node.id)?.findingCount ?? 0) === 0 && (
                          <DropdownMenuItem
                            onClick={() => deleteControlMutation.mutate({ id: node.id })}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              />

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <p className="text-sm text-gray-500">
                    Showing {currentPage * pageSize + 1} to{" "}
                    {Math.min((currentPage + 1) * pageSize, pagination.totalCount)} of{" "}
                    {pagination.totalCount}{" "}
                    {isSearching ? "matching controls" : "top-level controls"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={!pagination.hasPreviousPage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {pagination.page + 1} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!pagination.hasNextPage}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Control Detail Modal */}
      {selectedControlId && (
        <ControlDetailModal
          controlId={selectedControlId}
          onClose={() => setSelectedControlId(null)}
        />
      )}

      {/* Story 12.4: Create Control Dialog (AC1-AC10) */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Control</DialogTitle>
            <DialogDescription>
              Create a new control for this framework. Custom controls can be edited later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="controlId">Control ID *</Label>
              <Input
                id="controlId"
                placeholder="e.g., CTRL-1 or AC-2.1"
                value={createForm.controlId}
                onChange={(e) => setCreateForm({ ...createForm, controlId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric with dots and dashes only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Control title"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the control requirements..."
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guidance">Guidance (optional)</Label>
              <Textarea
                id="guidance"
                placeholder="Implementation guidance..."
                rows={2}
                value={createForm.guidance}
                onChange={(e) => setCreateForm({ ...createForm, guidance: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentControlId">Parent Control ID (optional)</Label>
              <Input
                id="parentControlId"
                placeholder="e.g., AC-2 (for creating AC-2.1)"
                value={createForm.parentControlId}
                onChange={(e) => setCreateForm({ ...createForm, parentControlId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateControl}
              disabled={
                !createForm.controlId ||
                !createForm.title ||
                !createForm.description ||
                createControlMutation.isPending
              }
            >
              {createControlMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Control"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Tagging Dialog */}
      <AlertDialog open={!!taggingControlId} onOpenChange={(open) => {
        if (!open) {
          setTaggingControlId(null);
          setTaggingControlDomains([]);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Control Domains</AlertDialogTitle>
            <AlertDialogDescription>
              Assign taxonomy domains to this control for categorization and mapping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <ControlDomainSelect
              mode="multi"
              values={taggingControlDomains}
              onChangeMulti={setTaggingControlDomains}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taggingControlId) {
                  setControlDomainsMutation.mutate({
                    controlId: taggingControlId,
                    domainIds: taggingControlDomains,
                  });
                }
              }}
              disabled={setControlDomainsMutation.isPending}
            >
              {setControlDomainsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Domains"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Instructions / Acceptance Criteria edit dialog. Both fields
          live in one dialog so the user can edit them together; the
          opening trigger autofocuses the field that was clicked. */}
      <Dialog
        open={!!editingTestingControlId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTestingControlId(null);
            setEditingTestInstructions("");
            setEditingAcceptanceCriteria("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit testing fields</DialogTitle>
            <DialogDescription>
              How an assessor verifies this control and what counts as
              evidence of compliance. Visible during compliance assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="testInstructions">Test Instructions</Label>
              <Textarea
                id="testInstructions"
                rows={5}
                autoFocus={editingTestingField === "testInstructions"}
                value={editingTestInstructions}
                onChange={(e) => setEditingTestInstructions(e.target.value)}
                placeholder="e.g., Review password policy doc; sample 10 user accounts and confirm MFA enrollment."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acceptanceCriteria">Acceptance Criteria</Label>
              <Textarea
                id="acceptanceCriteria"
                rows={5}
                autoFocus={editingTestingField === "acceptanceCriteria"}
                value={editingAcceptanceCriteria}
                onChange={(e) => setEditingAcceptanceCriteria(e.target.value)}
                placeholder="e.g., Password complexity ≥ 12 chars, MFA enabled for all users, lockout after 5 failed attempts."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTestingControlId(null)}
              disabled={updateTestingFieldsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingTestingControlId) return;
                updateTestingFieldsMutation.mutate({
                  id: editingTestingControlId,
                  testInstructions: editingTestInstructions.trim() || null,
                  acceptanceCriteria: editingAcceptanceCriteria.trim() || null,
                });
              }}
              disabled={updateTestingFieldsMutation.isPending}
            >
              {updateTestingFieldsMutation.isPending ? (
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
      </div>
    </AppLayout>
  );
}
