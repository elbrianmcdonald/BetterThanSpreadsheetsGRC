"use client";

/**
 * Unified Assignment Backlog Client Component
 *
 * Displays all unassigned assessment tasks across different types.
 * Features:
 * - Filter by assessment type, priority, business unit
 * - Self-assign functionality for GRC users
 * - Admin can assign to any user
 * - Metrics cards showing backlog status
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, isPast } from "date-fns";
import {
  ClipboardList,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  X,
  Users,
  CheckSquare,
  Calendar,
  Building2,
  Target,
  Shield,
  FileText,
  Activity,
  UserPlus,
  Plus,
} from "lucide-react";
import { UserRole, UnifiedAssessmentType } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Roles that can access the backlog */
const BACKLOG_ACCESS_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.MANAGER,
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
];

/** Roles that can self-assign */
const SELF_ASSIGN_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.MANAGER,
  UserRole.ANALYST,
];

/** Roles that can assign to others */
const ADMIN_ASSIGN_ROLES: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.MANAGER,
  UserRole.MANAGER,
  UserRole.ANALYST,
];

/** Assessment type configuration */
const assessmentTypeConfig: Record<UnifiedAssessmentType, { label: string; icon: React.ElementType; color: string }> = {
  RISK_DISCOVERY: { label: "Risk Discovery", icon: Search, color: "border-transparent bg-primary/10 text-primary" },
  RISK_ASSESSMENT: { label: "Risk Assessment", icon: Shield, color: "border-transparent bg-primary/10 text-primary" },
  FINDING_CREATION: { label: "Finding Creation", icon: AlertTriangle, color: "border-transparent bg-warning/10 text-warning" },
  VENDOR_ASSESSMENT: { label: "Vendor Assessment", icon: Building2, color: "border-transparent bg-success/10 text-success" },
  BIA_ASSESSMENT: { label: "BIA Assessment", icon: Activity, color: "border-transparent bg-muted text-secondary-foreground" },
  COMPLIANCE_ASSESSMENT: { label: "Compliance", icon: FileText, color: "border-transparent bg-primary/10 text-primary" },
};

/** Priority badge colors */
const priorityConfig = {
  HIGH: { color: "border-transparent bg-destructive/10 text-destructive", label: "High" },
  MEDIUM: { color: "border-transparent bg-warning/10 text-warning", label: "Medium" },
  LOW: { color: "border-transparent bg-success/10 text-success", label: "Low" },
};

export function BacklogClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<UnifiedAssessmentType | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selection for bulk operations
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Dialog states
  const [selfAssignTaskId, setSelfAssignTaskId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  // Create task dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskScope, setNewTaskScope] = useState("");
  const [newTaskType, setNewTaskType] = useState<UnifiedAssessmentType>(UnifiedAssessmentType.RISK_DISCOVERY);
  const [newTaskPriority, setNewTaskPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null);
  const [newTaskBusinessUnit, setNewTaskBusinessUnit] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Check role
  const userRole = session?.user?.role as UserRole | undefined;
  const canAccessBacklog = userRole && BACKLOG_ACCESS_ROLES.includes(userRole);
  const canSelfAssign = userRole && SELF_ASSIGN_ROLES.includes(userRole);
  const canAssignOthers = userRole && ADMIN_ASSIGN_ROLES.includes(userRole);
  const canCreateTask = userRole && ([UserRole.ADMINISTRATOR, UserRole.MANAGER, UserRole.MANAGER, UserRole.ANALYST] as UserRole[]).includes(userRole);

  // Fetch backlog data
  const { data, isLoading, error } = api.assessmentTask.getUnifiedBacklog.useQuery(
    {
      unifiedType: typeFilter ?? undefined,
      priority: (priorityFilter ?? undefined) as "HIGH" | "MEDIUM" | "LOW" | undefined,
      businessUnitId: businessUnitFilter ?? undefined,
      search: debouncedSearch || undefined,
      sortBy: "priority",
      sortOrder: "asc",
      limit: pageSize,
      offset: page * pageSize,
    },
    {
      enabled: isMounted && sessionStatus === "authenticated" && canAccessBacklog,
      refetchInterval: 60000,
    }
  );

  // Fetch metrics
  const { data: metrics } = api.assessmentTask.getBacklogMetrics.useQuery(undefined, {
    enabled: isMounted && sessionStatus === "authenticated" && canAccessBacklog,
  });

  // Fetch assignable users
  const { data: assignableUsers } = api.assessmentTask.getAssignableUsers.useQuery(undefined, {
    enabled: isMounted && sessionStatus === "authenticated" && canAssignOthers,
  });

  // Fetch business units for filter
  const { data: businessUnitsData } = api.businessUnit.list.useQuery(
    { includeInactive: false },
    {
      enabled: isMounted && sessionStatus === "authenticated",
    }
  );
  const businessUnits = businessUnitsData?.flatOptions ?? [];

  // Self-assign mutation
  const selfAssignMutation = api.assessmentTask.selfAssign.useMutation({
    onSuccess: () => {
      toast.success("Task assigned to you successfully");
      setSelfAssignTaskId(null);
      void utils.assessmentTask.getUnifiedBacklog.invalidate();
      void utils.assessmentTask.getBacklogMetrics.invalidate();
      void utils.assessmentTask.getMyKanbanAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to self-assign task");
    },
  });

  // Admin assign mutation
  const assignMutation = api.assessmentTask.assign.useMutation({
    onSuccess: () => {
      toast.success("Task assigned successfully");
      setAssignDialogOpen(false);
      setSelectedAssignee(null);
      setSelectedTaskIds([]);
      void utils.assessmentTask.getUnifiedBacklog.invalidate();
      void utils.assessmentTask.getBacklogMetrics.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign task");
    },
  });

  // Create task mutation
  const createTaskMutation = api.assessmentTask.createUnifiedTask.useMutation({
    onSuccess: () => {
      toast.success("Task created successfully");
      setCreateDialogOpen(false);
      // Reset form
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskScope("");
      setNewTaskType(UnifiedAssessmentType.RISK_DISCOVERY);
      setNewTaskPriority("MEDIUM");
      setNewTaskDueDate("");
      setNewTaskAssignee(null);
      setNewTaskBusinessUnit(null);
      void utils.assessmentTask.getUnifiedBacklog.invalidate();
      void utils.assessmentTask.getBacklogMetrics.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create task");
    },
  });

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!data?.tasks) return;
    if (selectedTaskIds.length === data.tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(data.tasks.map((t) => t.id));
    }
  }, [data?.tasks, selectedTaskIds.length]);

  // Handle individual selection
  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setTypeFilter(null);
    setPriorityFilter(null);
    setBusinessUnitFilter(null);
    setPage(0);
  }, []);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (typeFilter) count++;
    if (priorityFilter) count++;
    if (businessUnitFilter) count++;
    return count;
  }, [debouncedSearch, typeFilter, priorityFilter, businessUnitFilter]);

  // Handle self-assign confirm
  const handleSelfAssignConfirm = useCallback(() => {
    if (selfAssignTaskId) {
      selfAssignMutation.mutate({ id: selfAssignTaskId });
    }
  }, [selfAssignTaskId, selfAssignMutation]);

  // Handle admin assign
  const handleAdminAssign = useCallback(() => {
    const firstTaskId = selectedTaskIds[0];
    if (firstTaskId && selectedAssignee) {
      // Assign first selected task (bulk assign would need separate endpoint)
      assignMutation.mutate({ id: firstTaskId, assignedToId: selectedAssignee });
    }
  }, [selectedTaskIds, selectedAssignee, assignMutation]);

  // Handle create task
  const handleCreateTask = useCallback(() => {
    if (!newTaskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (!newTaskScope.trim()) {
      toast.error("Assessment scope is required");
      return;
    }

    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      scope: newTaskScope.trim(),
      unifiedType: newTaskType,
      priority: newTaskPriority,
      dueDate: newTaskDueDate ? new Date(newTaskDueDate) : undefined,
      assignedToId: newTaskAssignee ?? undefined,
      businessUnitId: newTaskBusinessUnit ?? undefined,
    });
  }, [
    newTaskTitle,
    newTaskDescription,
    newTaskScope,
    newTaskType,
    newTaskPriority,
    newTaskDueDate,
    newTaskAssignee,
    newTaskBusinessUnit,
    createTaskMutation,
  ]);

  // Loading state
  if (!isMounted || sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Assignments" }, { label: "Backlog" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect if not authorized
  if (sessionStatus === "authenticated" && !canAccessBacklog) {
    router.push("/");
    return null;
  }

  // Redirect to login
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Assignments", href: "/assignments" }, { label: "Backlog" }]}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="ASSIGNMENTS"
          title="Assignment Backlog"
          icon={<ClipboardList />}
          description="View and assign unassigned assessment tasks across all modules."
          actions={
            canCreateTask ? (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            ) : undefined
          }
        />

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatTile
            label="Total Unassigned"
            value={metrics?.total ?? 0}
            sub="Tasks awaiting assignment"
            icon={<ClipboardList />}
            tone="primary"
          />

          <StatTile
            label="Overdue"
            value={metrics?.overdue ?? 0}
            sub="Past due date"
            icon={<AlertTriangle />}
            tone={metrics?.overdue && metrics.overdue > 0 ? "critical" : "default"}
          />

          <StatTile
            label="High Priority"
            value={metrics?.byPriority?.HIGH ?? 0}
            sub="Require immediate attention"
            icon={<Target />}
            tone="critical"
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="eyebrow">By Type</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground/70" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(metrics?.byType ?? {}).map(([type, count]) => (
                  <Badge key={type} variant="code">
                    {assessmentTypeConfig[type as UnifiedAssessmentType]?.label.split(" ")[0]}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedTaskIds.length > 0 && canAssignOthers && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">
                    {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTaskIds([])}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign to User
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Filter className="h-[17px] w-[17px] text-primary" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    placeholder="Search by title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Type Filter */}
                <Select
                  value={typeFilter ?? "all"}
                  onValueChange={(value) => {
                    setTypeFilter(value === "all" ? null : value as UnifiedAssessmentType);
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(assessmentTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Priority Filter */}
                <Select
                  value={priorityFilter ?? "all"}
                  onValueChange={(value) => {
                    setPriorityFilter(value === "all" ? null : value);
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>

                {/* Business Unit Filter */}
                <Select
                  value={businessUnitFilter ?? "all"}
                  onValueChange={(value) => {
                    setBusinessUnitFilter(value === "all" ? null : value);
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by business unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Business Units</SelectItem>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>
                        {bu.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px] font-bold">Unassigned Tasks</CardTitle>
            <CardDescription>
              {data?.total ?? 0} unassigned task{(data?.total ?? 0) !== 1 ? "s" : ""} in the backlog
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{error.message}</p>
              </div>
            ) : data?.tasks.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No unassigned tasks
                </h3>
                <p className="text-muted-foreground">
                  All tasks have been assigned. Great job!
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canAssignOthers && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                data?.tasks &&
                                data.tasks.length > 0 &&
                                selectedTaskIds.length === data.tasks.length
                              }
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all"
                            />
                          </TableHead>
                        )}
                        <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Task</TableHead>
                        <TableHead className="w-[140px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Type</TableHead>
                        <TableHead className="w-[100px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Priority</TableHead>
                        <TableHead className="w-[130px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Business Unit</TableHead>
                        <TableHead className="w-[120px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Due Date</TableHead>
                        <TableHead className="w-[130px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Created By</TableHead>
                        <TableHead className="w-[120px] text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.tasks.map((task) => {
                        const typeConfig = assessmentTypeConfig[task.unifiedType];
                        const priorityStyle = priorityConfig[task.priority as keyof typeof priorityConfig];
                        const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
                        const isSelected = selectedTaskIds.includes(task.id);
                        const TypeIcon = typeConfig?.icon || FileText;

                        return (
                          <TableRow
                            key={task.id}
                            className={isSelected ? "bg-primary/5" : isOverdue ? "bg-destructive/5" : "hover:bg-secondary"}
                          >
                            {canAssignOthers && (
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectTask(task.id)}
                                  aria-label={`Select ${task.title}`}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-[0.04em]">
                                  {task.identifier}
                                </span>
                                <span className="font-semibold text-foreground">{task.title}</span>
                                {task.description && (
                                  <span className="text-xs text-muted-foreground line-clamp-1">
                                    {task.description}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="neutral" className={typeConfig?.color}>
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {typeConfig?.label.split(" ")[0]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="neutral" className={priorityStyle?.color}>
                                {priorityStyle?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {task.businessUnit ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Building2 className="h-3 w-3 text-muted-foreground/70" />
                                  {task.businessUnit.name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {task.dueDate ? (
                                <div className="flex items-center gap-1">
                                  <Calendar className={`h-3 w-3 ${isOverdue ? "text-destructive" : "text-muted-foreground/70"}`} />
                                  <span className={`font-mono text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                    {format(new Date(task.dueDate), "MMM d, yyyy")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {task.assignedBy?.name ?? task.assignedBy?.email ?? "Unknown"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canSelfAssign && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelfAssignTaskId(task.id)}
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Assign to Me
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {page * pageSize + 1} to{" "}
                      {Math.min((page + 1) * pageSize, data.total)} of {data.total} tasks
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!data.hasMore}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Self-Assign Confirmation Dialog */}
      <AlertDialog open={!!selfAssignTaskId} onOpenChange={() => setSelfAssignTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Task to Yourself?</AlertDialogTitle>
            <AlertDialogDescription>
              This task will be assigned to you and will appear in your My Assignments Kanban board.
              You can start working on it immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={selfAssignMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSelfAssignConfirm}
              disabled={selfAssignMutation.isPending}
            >
              {selfAssignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign to Me
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task to User</DialogTitle>
            <DialogDescription>
              Select a user to assign the selected task{selectedTaskIds.length > 1 ? "s" : ""} to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedAssignee ?? ""}
              onValueChange={setSelectedAssignee}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? user.email} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdminAssign}
              disabled={!selectedAssignee || assignMutation.isPending}
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Assessment Task</DialogTitle>
            <DialogDescription>
              Create a new assessment task. You can optionally assign it to a user immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                placeholder="Enter task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Enter task description (optional)"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label htmlFor="task-scope">Assessment Scope *</Label>
              <Textarea
                id="task-scope"
                placeholder="Describe the scope of the assessment (what to assess)"
                value={newTaskScope}
                onChange={(e) => setNewTaskScope(e.target.value)}
                rows={2}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="task-type">Assessment Type</Label>
              <Select
                value={newTaskType}
                onValueChange={(value) => setNewTaskType(value as UnifiedAssessmentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(assessmentTypeConfig).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={newTaskPriority}
                onValueChange={(value) => setNewTaskPriority(value as "HIGH" | "MEDIUM" | "LOW")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
              />
            </div>

            {/* Business Unit */}
            <div className="space-y-2">
              <Label htmlFor="task-business-unit">Business Unit</Label>
              <Select
                value={newTaskBusinessUnit ?? "none"}
                onValueChange={(value) => setNewTaskBusinessUnit(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business unit (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Business Unit</SelectItem>
                  {businessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign To */}
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select
                value={newTaskAssignee ?? "unassigned"}
                onValueChange={(value) => setNewTaskAssignee(value === "unassigned" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Leave Unassigned</SelectItem>
                  {assignableUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name ?? user.email} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createTaskMutation.isPending || !newTaskTitle.trim() || !newTaskScope.trim()}
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
