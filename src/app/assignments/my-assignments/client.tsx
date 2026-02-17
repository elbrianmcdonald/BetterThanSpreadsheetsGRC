"use client";

/**
 * My Assignments Kanban Client Component
 *
 * Kanban board view of the current user's assigned tasks.
 * Columns: To Do, In Progress, Completed
 *
 * Features:
 * - Drag-and-drop between columns
 * - Quick actions (Start, Complete)
 * - Click to navigate to assessment form
 * - Filter by assessment type
 */

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { AssessmentTaskStatus, UnifiedAssessmentType } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBoard } from "@/components/assignments/KanbanBoard";

/** Assessment type labels for filter */
const assessmentTypeLabels: Record<UnifiedAssessmentType, string> = {
  RISK_DISCOVERY: "Risk Discovery",
  RISK_ASSESSMENT: "Risk Assessment",
  FINDING_CREATION: "Finding Creation",
  VENDOR_ASSESSMENT: "Vendor Assessment",
  BIA_ASSESSMENT: "BIA Assessment",
  COMPLIANCE_ASSESSMENT: "Compliance Assessment",
};

export function MyAssignmentsKanbanClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State
  const [showCompleted, setShowCompleted] = useState(true);
  const [typeFilter, setTypeFilter] = useState<UnifiedAssessmentType | null>(null);

  // Fetch kanban data
  const { data, isLoading, error, refetch } = api.assessmentTask.getMyKanbanAssignments.useQuery(
    {
      includeCompleted: showCompleted,
      completedLimit: 10,
    },
    {
      enabled: isMounted && sessionStatus === "authenticated",
      refetchInterval: 60000, // Refresh every minute
    }
  );

  // Update status mutation
  const updateStatusMutation = api.assessmentTask.updateTaskStatus.useMutation({
    onSuccess: () => {
      toast.success("Task status updated");
      void utils.assessmentTask.getMyKanbanAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update task status");
    },
  });

  // Start task mutation
  const startTaskMutation = api.assessmentTask.startTask.useMutation({
    onSuccess: () => {
      toast.success("Task started");
      void utils.assessmentTask.getMyKanbanAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start task");
    },
  });

  // Complete task mutation
  const completeTaskMutation = api.assessmentTask.completeTask.useMutation({
    onSuccess: () => {
      toast.success("Task completed");
      void utils.assessmentTask.getMyKanbanAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to complete task");
    },
  });

  // Handle status change from drag-drop
  const handleStatusChange = useCallback((taskId: string, newStatus: AssessmentTaskStatus) => {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  }, [updateStatusMutation]);

  // Handle start button
  const handleStart = useCallback((taskId: string) => {
    startTaskMutation.mutate({ id: taskId });
  }, [startTaskMutation]);

  // Handle complete button
  const handleComplete = useCallback((taskId: string) => {
    completeTaskMutation.mutate({ id: taskId, risksIdentified: 0 });
  }, [completeTaskMutation]);

  // Filter tasks by type if filter is set
  type TaskType = NonNullable<typeof data>["todo"][number];
  const filterTasks = useCallback((tasks: TaskType[]) => {
    if (!typeFilter) return tasks;
    return tasks.filter((t) => t.unifiedType === typeFilter);
  }, [typeFilter]);

  // Loading state
  if (!isMounted || sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Assignments", href: "/assignments" }, { label: "My Assignments" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect to login
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const isUpdating = updateStatusMutation.isPending || startTaskMutation.isPending || completeTaskMutation.isPending;

  // Filter tasks
  const filteredTodo = data?.todo ? filterTasks(data.todo) : [];
  const filteredInProgress = data?.inProgress ? filterTasks(data.inProgress) : [];
  const filteredCompleted = data?.completed ? filterTasks(data.completed) : [];

  const totalTasks = (data?.counts?.todo ?? 0) + (data?.counts?.inProgress ?? 0);

  return (
    <AppLayout breadcrumbs={[{ label: "Assignments", href: "/assignments" }, { label: "My Assignments" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <LayoutGrid className="h-6 w-6" />
              My Assignments
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage your assigned assessment tasks. Drag cards between columns to update status.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">Tasks in your queue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">To Do</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-600">{data?.counts?.todo ?? 0}</div>
              <p className="text-xs text-muted-foreground">Waiting to start</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data?.counts?.inProgress ?? 0}</div>
              <p className="text-xs text-muted-foreground">Currently working</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data?.counts?.completed ?? 0}</div>
              <p className="text-xs text-muted-foreground">Recently finished</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              {/* Type Filter */}
              <Select
                value={typeFilter ?? "all"}
                onValueChange={(value) => setTypeFilter(value === "all" ? null : value as UnifiedAssessmentType)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(assessmentTypeLabels).map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Show Completed Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-completed"
                  checked={showCompleted}
                  onCheckedChange={setShowCompleted}
                />
                <Label htmlFor="show-completed" className="text-sm">
                  Show Completed
                </Label>
              </div>

              {/* Filter indicator */}
              {typeFilter && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setTypeFilter(null)}>
                  {assessmentTypeLabels[typeFilter]} &times;
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error.message}</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <KanbanBoard
            todo={filteredTodo}
            inProgress={filteredInProgress}
            completed={showCompleted ? filteredCompleted : []}
            onStatusChange={handleStatusChange}
            onStart={handleStart}
            onComplete={handleComplete}
            isLoading={isUpdating}
          />
        )}

        {/* Empty State */}
        {!isLoading && !error && totalTasks === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments</h3>
              <p className="text-gray-500 mb-4">
                You don&apos;t have any tasks assigned to you yet.
              </p>
              <Button onClick={() => router.push("/assignments/backlog")}>
                View Backlog
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
