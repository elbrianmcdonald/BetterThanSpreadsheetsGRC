"use client";

/**
 * Framework/Standard Control Library Client Component
 *
 * Story 12.8: Control Search & Browse UI
 *
 * Provides cross-framework control browsing with:
 * - Summary statistics cards (AC5)
 * - Global search and filtering (AC9-AC18)
 * - Control table with health indicators (AC6-AC7, AC19-AC25)
 * - Create, edit, retire/restore, delete controls
 */

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ControlDetailModal } from "@/components/frameworks/ControlDetailModal";
import {
  Shield,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Download,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  Eye,
  Archive,
} from "lucide-react";
import { toast } from "sonner";

export function ControlLibraryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state from URL (AC16)
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(
    searchParams.get("frameworks")?.split(",").filter(Boolean) ?? []
  );
  const [hasRisks, setHasRisks] = useState(searchParams.get("hasRisks") === "true");
  const [hasFindings, setHasFindings] = useState(searchParams.get("hasFindings") === "true");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "0", 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get("pageSize") ?? "50", 10));
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    frameworkId: "",
    controlId: "",
    title: "",
    description: "",
    guidance: "",
    parentControlId: "",
  });
  const [editControl, setEditControl] = useState<{
    id: string;
    title: string;
    description: string;
    guidance: string;
  } | null>(null);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [deleteControlId, setDeleteControlId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"retire" | "restore" | "delete" | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useMemo(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Fetch summary stats (AC5)
  const { data: summary, isLoading: summaryLoading } = api.framework.getControlLibrarySummary.useQuery();

  // Fetch frameworks for filter (AC11)
  const { data: frameworks } = api.framework.list.useQuery({});

  // Derive isActive from statusFilter
  const isActiveFilter = statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;

  // Fetch controls with filters (AC9-AC15)
  const { data: controlsData, isLoading: controlsLoading } = api.framework.browseControls.useQuery({
    search: debouncedSearch || undefined,
    frameworkIds: selectedFrameworks.length > 0 ? selectedFrameworks : undefined,
    isActive: isActiveFilter,
    hasRisks: hasRisks || undefined,
    hasFindings: hasFindings || undefined,
    page,
    pageSize,
  });

  // Mutations
  const createControlMutation = api.framework.createControl.useMutation({
    onSuccess: () => {
      toast.success("Control created successfully");
      setShowCreateDialog(false);
      setCreateForm({ frameworkId: "", controlId: "", title: "", description: "", guidance: "", parentControlId: "" });
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create control");
    },
  });

  const updateControlMutation = api.framework.updateControl.useMutation({
    onSuccess: () => {
      toast.success("Control updated successfully");
      setEditControl(null);
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update control");
    },
  });

  const deprecateControlMutation = api.framework.deprecateControl.useMutation({
    onSuccess: () => {
      toast.success("Control retired successfully");
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to retire control");
    },
  });

  const restoreControlMutation = api.framework.restoreControl.useMutation({
    onSuccess: () => {
      toast.success("Control restored successfully");
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to restore control");
    },
  });

  const deleteControlMutation = api.framework.deleteControl.useMutation({
    onSuccess: () => {
      toast.success("Control deleted successfully");
      setDeleteControlId(null);
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete control");
    },
  });

  // Bulk mutations
  const bulkDeprecateMutation = api.framework.bulkDeprecateControls.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deprecatedCount} control(s) retired`);
      setSelectedIds(new Set());
      setBulkAction(null);
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to retire controls");
    },
  });

  const bulkRestoreMutation = api.framework.bulkRestoreControls.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.restoredCount} control(s) restored`);
      setSelectedIds(new Set());
      setBulkAction(null);
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to restore controls");
    },
  });

  const bulkDeleteMutation = api.framework.bulkDeleteControls.useMutation({
    onSuccess: (data) => {
      const msg = data.skippedCount > 0
        ? `${data.deletedCount} deleted, ${data.skippedCount} skipped (have linked risks/findings/children)`
        : `${data.deletedCount} control(s) deleted`;
      toast.success(msg);
      setSelectedIds(new Set());
      setBulkAction(null);
      void utils.framework.browseControls.invalidate();
      void utils.framework.getControlLibrarySummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete controls");
    },
  });

  const isBulkPending = bulkDeprecateMutation.isPending || bulkRestoreMutation.isPending || bulkDeleteMutation.isPending;

  // Bulk selection helpers
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!controlsData?.controls) return;
    const pageIds = controlsData.controls.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBulkConfirm = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (bulkAction === "retire") bulkDeprecateMutation.mutate({ controlIds: ids });
    else if (bulkAction === "restore") bulkRestoreMutation.mutate({ controlIds: ids });
    else if (bulkAction === "delete") bulkDeleteMutation.mutate({ controlIds: ids });
  };

  // Check if any filters are active (AC17)
  const hasActiveFilters =
    search ||
    selectedFrameworks.length > 0 ||
    hasRisks ||
    hasFindings ||
    statusFilter !== "active";

  // Clear all filters (AC17)
  const clearFilters = () => {
    setSearch("");
    setSelectedFrameworks([]);
    setHasRisks(false);
    setHasFindings(false);
    setStatusFilter("active");
    setPage(0);
  };

  // Toggle framework selection (AC11)
  const toggleFramework = (frameworkId: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(frameworkId)
        ? prev.filter((id) => id !== frameworkId)
        : [...prev, frameworkId]
    );
    setPage(0);
  };

  // Export to CSV (AC25)
  const handleExport = () => {
    if (!controlsData?.controls) return;

    const headers = ["Control ID", "Title", "Framework", "Status", "Custom", "Risks", "Findings"];
    const rows = controlsData.controls.map((c) => [
      c.controlId,
      c.title,
      c.framework?.name ?? "",
      c.isActive ? "Active" : "Inactive",
      c.isCustom ? "Yes" : "No",
      c.riskCount.toString(),
      c.findingCount.toString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-library-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  // Handle create form submission
  const handleCreate = () => {
    if (!createForm.frameworkId || !createForm.controlId || !createForm.title || !createForm.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    createControlMutation.mutate({
      frameworkId: createForm.frameworkId,
      controlId: createForm.controlId,
      title: createForm.title,
      description: createForm.description,
      guidance: createForm.guidance || undefined,
      parentControlId: createForm.parentControlId || undefined,
    });
  };

  // Handle edit form submission
  const handleEdit = () => {
    if (!editControl) return;
    updateControlMutation.mutate({
      id: editControl.id,
      title: editControl.title,
      description: editControl.description,
      guidance: editControl.guidance || undefined,
    });
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Framework/Standard Control Library" }]}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Page Header (AC4) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Framework/Standard Control Library</h1>
            <p className="text-sm text-muted-foreground">
              {summary ? `${summary.totalControls} controls across all frameworks and standards` : "Browse controls across all frameworks and standards"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Control
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!controlsData?.controls?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards (AC5) — clickable to filter */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            statusFilter === "all" && !hasRisks ? "border-primary ring-1 ring-primary/20" : ""
          }`}
          onClick={() => {
            setStatusFilter("all");
            setHasRisks(false);
            setHasFindings(false);
            setPage(0);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Total Controls</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalControls ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            statusFilter === "active" && !hasRisks ? "border-primary ring-1 ring-primary/20" : ""
          }`}
          onClick={() => {
            setStatusFilter("active");
            setHasRisks(false);
            setHasFindings(false);
            setPage(0);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Active Controls</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{summary?.activeControls ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            hasRisks ? "border-primary ring-1 ring-primary/20" : ""
          }`}
          onClick={() => {
            setStatusFilter("active");
            setHasRisks(true);
            setHasFindings(false);
            setPage(0);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>At-Risk Controls</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-amber-600">{summary?.controlsAtRisk ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors hover:border-primary/50 ${
            statusFilter === "inactive" && !hasRisks ? "border-primary ring-1 ring-primary/20" : ""
          }`}
          onClick={() => {
            setStatusFilter("inactive");
            setHasRisks(false);
            setHasFindings(false);
            setPage(0);
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription>Inactive Controls</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary?.inactiveControls ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters (AC9-AC17) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search (AC9, AC10) */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by control ID, title, or description..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
              {search && debouncedSearch !== search && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as "active" | "inactive" | "all");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            {/* Framework Filter (AC11) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  Frameworks
                  {selectedFrameworks.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedFrameworks.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]">
                <DropdownMenuLabel>Filter by Framework</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {frameworks?.map((fw) => (
                  <DropdownMenuCheckboxItem
                    key={fw.id}
                    checked={selectedFrameworks.includes(fw.id)}
                    onCheckedChange={() => toggleFramework(fw.id)}
                  >
                    {fw.name} ({fw.code})
                  </DropdownMenuCheckboxItem>
                ))}
                {(!frameworks || frameworks.length === 0) && (
                  <div className="p-2 text-sm text-muted-foreground">No frameworks available</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More Filters (AC14, AC15) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="p-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasRisks"
                      checked={hasRisks}
                      onCheckedChange={(checked) => {
                        setHasRisks(checked === true);
                        setPage(0);
                      }}
                    />
                    <Label htmlFor="hasRisks" className="text-sm">Has linked risks</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasFindings"
                      checked={hasFindings}
                      onCheckedChange={(checked) => {
                        setHasFindings(checked === true);
                        setPage(0);
                      }}
                    />
                    <Label htmlFor="hasFindings" className="text-sm">Has linked findings</Label>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters (AC17) */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filter badges (AC18) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearch("")}
                  />
                </Badge>
              )}
              {statusFilter !== "active" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter === "inactive" ? "Inactive" : "All"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setStatusFilter("active")}
                  />
                </Badge>
              )}
              {selectedFrameworks.map((id) => {
                const fw = frameworks?.find((f) => f.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {fw?.code ?? id}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => toggleFramework(id)}
                    />
                  </Badge>
                );
              })}
              {hasRisks && (
                <Badge variant="secondary" className="gap-1">
                  Has Risks
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setHasRisks(false)}
                  />
                </Badge>
              )}
              {hasFindings && (
                <Badge variant="secondary" className="gap-1">
                  Has Findings
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setHasFindings(false)}
                  />
                </Badge>
              )}
              <span className="text-sm text-muted-foreground ml-2">
                {controlsData?.total ?? 0} results
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {statusFilter !== "inactive" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction("retire")}
                disabled={isBulkPending}
              >
                <Archive className="h-4 w-4 mr-1" />
                Retire
              </Button>
            )}
            {statusFilter !== "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction("restore")}
                disabled={isBulkPending}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Restore
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-600"
              onClick={() => setBulkAction("delete")}
              disabled={isBulkPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBulkPending}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Controls Table (AC6, AC7) */}
      <Card>
        <CardContent className="p-0">
          {controlsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !controlsData?.controls || controlsData.controls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No Controls Found</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasActiveFilters
                  ? "No controls match your filters. Try adjusting your search criteria."
                  : "No controls have been added to your frameworks yet."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] px-2">
                      <Checkbox
                        checked={
                          controlsData.controls.length > 0 &&
                          controlsData.controls.every((c) => selectedIds.has(c.id))
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[120px]">Control ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[140px]">Framework</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px] text-center">Risks</TableHead>
                    <TableHead className="w-[80px] text-center">Findings</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controlsData.controls.map((control) => (
                    <TableRow
                      key={control.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedControlId(control.id)}
                    >
                      <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(control.id)}
                          onCheckedChange={() => toggleSelectId(control.id)}
                          aria-label={`Select ${control.controlId}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          {control.controlId}
                          {control.isCustom && (
                            <Badge variant="outline" className="text-xs px-1 py-0">Custom</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={control.title}>
                        {control.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{control.framework?.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {control.isActive ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {control.riskCount > 0 ? (
                          <Badge variant="secondary">{control.riskCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {control.findingCount > 0 ? (
                          <Badge variant="secondary">{control.findingCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setSelectedControlId(control.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {!control.isOscalImported && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setEditControl({
                                    id: control.id,
                                    title: control.title,
                                    description: control.description,
                                    guidance: control.guidance ?? "",
                                  })
                                }
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {control.isActive ? (
                              <DropdownMenuItem
                                onClick={() => deprecateControlMutation.mutate({ id: control.id })}
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Retire
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => restoreControlMutation.mutate({ id: control.id })}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </DropdownMenuItem>
                            )}
                            {control.riskCount === 0 && control.findingCount === 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => setDeleteControlId(control.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination (AC24) */}
          {controlsData && controlsData.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, controlsData.total)} of {controlsData.total}
                </span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => {
                    setPageSize(parseInt(v, 10));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {Math.ceil(controlsData.total / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!controlsData.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Control Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Control</DialogTitle>
            <DialogDescription>
              Add a custom control to a framework. Custom controls can be edited and managed independently.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-framework">Framework *</Label>
              <Select
                value={createForm.frameworkId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, frameworkId: v }))}
              >
                <SelectTrigger id="create-framework">
                  <SelectValue placeholder="Select a framework" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks?.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.name} ({fw.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-controlId">Control ID *</Label>
              <Input
                id="create-controlId"
                placeholder="e.g., CUST-01"
                value={createForm.controlId}
                onChange={(e) => setCreateForm((f) => ({ ...f, controlId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Alphanumeric with dots and dashes only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                placeholder="Control title"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description *</Label>
              <Textarea
                id="create-description"
                placeholder="Describe the control..."
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-guidance">Guidance</Label>
              <Textarea
                id="create-guidance"
                placeholder="Optional implementation guidance..."
                value={createForm.guidance}
                onChange={(e) => setCreateForm((f) => ({ ...f, guidance: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-parent">Parent Control ID</Label>
              <Input
                id="create-parent"
                placeholder="e.g., AC-01 (optional)"
                value={createForm.parentControlId}
                onChange={(e) => setCreateForm((f) => ({ ...f, parentControlId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">The control ID of the parent (must exist in the same framework)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createControlMutation.isPending}>
              {createControlMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Control
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Control Dialog */}
      <Dialog open={!!editControl} onOpenChange={(open) => !open && setEditControl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Control</DialogTitle>
            <DialogDescription>
              Update the control details.
            </DialogDescription>
          </DialogHeader>
          {editControl && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editControl.title}
                  onChange={(e) => setEditControl((c) => c ? { ...c, title: e.target.value } : c)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editControl.description}
                  onChange={(e) => setEditControl((c) => c ? { ...c, description: e.target.value } : c)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-guidance">Guidance</Label>
                <Textarea
                  id="edit-guidance"
                  value={editControl.guidance}
                  onChange={(e) => setEditControl((c) => c ? { ...c, guidance: e.target.value } : c)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditControl(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateControlMutation.isPending}>
              {updateControlMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteControlId} onOpenChange={(open) => !open && setDeleteControlId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Control</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this control? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteControlId) {
                  deleteControlMutation.mutate({ id: deleteControlId });
                }
              }}
            >
              {deleteControlMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "retire" && `Retire ${selectedIds.size} Control(s)`}
              {bulkAction === "restore" && `Restore ${selectedIds.size} Control(s)`}
              {bulkAction === "delete" && `Delete ${selectedIds.size} Control(s)`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "retire" && `Are you sure you want to retire ${selectedIds.size} selected control(s)? They will be marked as inactive.`}
              {bulkAction === "restore" && `Are you sure you want to restore ${selectedIds.size} selected control(s)? They will be marked as active.`}
              {bulkAction === "delete" && `Are you sure you want to permanently delete ${selectedIds.size} selected control(s)? Controls with linked risks, findings, or children will be skipped. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={bulkAction === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={handleBulkConfirm}
              disabled={isBulkPending}
            >
              {isBulkPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {bulkAction === "retire" && "Retire All"}
              {bulkAction === "restore" && "Restore All"}
              {bulkAction === "delete" && "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Control Detail Modal */}
      {selectedControlId && (
        <ControlDetailModal
          controlId={selectedControlId}
          onClose={() => setSelectedControlId(null)}
        />
      )}
    </AppLayout>
  );
}
