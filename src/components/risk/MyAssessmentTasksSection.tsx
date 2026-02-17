"use client";

/**
 * My Assessment Tasks Section
 *
 * Shows the current user's assigned assessment tasks.
 * Allows analysts to view, start, and complete their tasks.
 *
 * Features:
 * - List of tasks assigned to current user
 * - Start task action (PENDING → IN_PROGRESS)
 * - Complete task action with summary (IN_PROGRESS → COMPLETED)
 * - Priority and due date indicators
 *
 * @see Assessment Task Management
 */

import { useState, useCallback } from "react";
import { format, isPast, formatDistanceToNow } from "date-fns";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Loader2,
  Building2,
  Target,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Priority badge colors
function getPriorityBadge(priority: string) {
  switch (priority) {
    case "HIGH":
      return (
        <Badge variant="destructive" className="text-xs">
          High
        </Badge>
      );
    case "MEDIUM":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
          Medium
        </Badge>
      );
    case "LOW":
      return (
        <Badge variant="secondary" className="text-xs">
          Low
        </Badge>
      );
    default:
      return null;
  }
}

// Status badge colors
function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="secondary" className="text-xs">
          Pending
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
          In Progress
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
          Completed
        </Badge>
      );
    default:
      return null;
  }
}

export function MyAssessmentTasksSection() {
  const [isOpen, setIsOpen] = useState(true);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [completeSummary, setCompleteSummary] = useState("");
  const [risksIdentified, setRisksIdentified] = useState(0);

  const utils = api.useUtils();

  // Fetch my tasks
  const { data: tasks, isLoading, error } = api.assessmentTask.getMyTasks.useQuery({});

  // Start task mutation
  const startMutation = api.assessmentTask.startTask.useMutation({
    onSuccess: () => {
      toast.success("Task started");
      setStartDialogOpen(false);
      setSelectedTaskId(null);
      void utils.assessmentTask.getMyTasks.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start task");
    },
  });

  // Complete task mutation
  const completeMutation = api.assessmentTask.completeTask.useMutation({
    onSuccess: () => {
      toast.success("Task completed");
      setCompleteDialogOpen(false);
      setSelectedTaskId(null);
      setCompleteSummary("");
      setRisksIdentified(0);
      void utils.assessmentTask.getMyTasks.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to complete task");
    },
  });

  const handleStartClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setStartDialogOpen(true);
  }, []);

  const handleCompleteClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setCompleteDialogOpen(true);
  }, []);

  const confirmStart = useCallback(() => {
    if (selectedTaskId) {
      startMutation.mutate({ id: selectedTaskId });
    }
  }, [selectedTaskId, startMutation]);

  const confirmComplete = useCallback(() => {
    if (selectedTaskId) {
      completeMutation.mutate({
        id: selectedTaskId,
        summary: completeSummary || undefined,
        risksIdentified,
      });
    }
  }, [selectedTaskId, completeSummary, risksIdentified, completeMutation]);

  // Get selected task for dialogs
  const selectedTask = tasks?.find((t) => t.id === selectedTaskId);

  // Count stats
  const pendingCount = tasks?.filter((t) => t.status === "PENDING").length ?? 0;
  const inProgressCount = tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0;
  const overdueCount = tasks?.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate))
  ).length ?? 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Assessment Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Assessment Tasks
                  </CardTitle>
                  {tasks && tasks.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.length}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CollapsibleTrigger>
            <CardDescription>
              Proactive risk assessment tasks assigned to you
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Stats */}
              {tasks && tasks.length > 0 && (
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{pendingCount} pending</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="h-4 w-4 text-blue-500" />
                    <span>{inProgressCount} in progress</span>
                  </div>
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{overdueCount} overdue</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Table */}
              {!tasks || tasks.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Tasks</h3>
                  <p className="text-muted-foreground">
                    You don&apos;t have any assessment tasks assigned to you.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
                      const isPending = task.status === "PENDING";
                      const isInProgress = task.status === "IN_PROGRESS";

                      return (
                        <TableRow
                          key={task.id}
                          className={isOverdue ? "bg-destructive/5" : ""}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {task.identifier}
                                </span>
                              </div>
                              <span className="font-medium">{task.title}</span>
                              {task.businessUnit && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Building2 className="h-3 w-3" />
                                  {task.businessUnit.name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm max-w-[200px]">
                              <Target className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{task.scope}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.dueDate ? (
                              <div className="flex items-center gap-2">
                                <Clock
                                  className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                                />
                                <div className="flex flex-col">
                                  <span
                                    className={`text-sm ${isOverdue ? "text-destructive font-medium" : ""}`}
                                  >
                                    {format(new Date(task.dueDate), "MMM d, yyyy")}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {isOverdue
                                      ? `Overdue by ${formatDistanceToNow(new Date(task.dueDate))}`
                                      : `Due in ${formatDistanceToNow(new Date(task.dueDate))}`}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No due date</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPending && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStartClick(task.id)}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Start
                                </Button>
                              )}
                              {isInProgress && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                  onClick={() => handleCompleteClick(task.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Start Task Confirmation Dialog */}
      <AlertDialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Task?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTask && (
                <>
                  <strong>{selectedTask.identifier}:</strong> {selectedTask.title}
                  <br />
                  <br />
                  <strong>Scope:</strong> {selectedTask.scope}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={startMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStart}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Task
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Task Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              {selectedTask && (
                <>
                  <strong>{selectedTask.identifier}:</strong> {selectedTask.title}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="risksIdentified">Risks Identified</Label>
              <Input
                id="risksIdentified"
                type="number"
                min={0}
                value={risksIdentified}
                onChange={(e) => setRisksIdentified(parseInt(e.target.value) || 0)}
                placeholder="Number of risks found"
              />
              <p className="text-xs text-muted-foreground">
                How many risks did you discover during this assessment?
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Summary (Optional)</Label>
              <Textarea
                id="summary"
                value={completeSummary}
                onChange={(e) => setCompleteSummary(e.target.value)}
                placeholder="Describe your findings and assessment results..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Provide a brief summary of your assessment findings.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              disabled={completeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmComplete}
              disabled={completeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
