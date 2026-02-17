"use client";

/**
 * Assessment Tasks Section Component
 *
 * Displays assessment tasks that managers can create and assign to analysts
 * for proactive risk discovery.
 */

import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  ClipboardCheck,
  Calendar,
  User,
  AlertCircle,
  Building2,
} from "lucide-react";
import { UserRole, AssessmentTaskStatus } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Roles that can create/manage assessment tasks */
const MANAGER_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.CISO,
  UserRole.GRC_ANALYST,
];

/** Status badge configuration */
const statusConfig: Record<AssessmentTaskStatus, { color: string; label: string }> = {
  PENDING: { color: "bg-amber-100 text-amber-800", label: "Pending" },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-800", label: "In Progress" },
  COMPLETED: { color: "bg-green-100 text-green-800", label: "Completed" },
  CANCELLED: { color: "bg-gray-100 text-gray-800", label: "Cancelled" },
};

/** Priority badge configuration */
const priorityConfig: Record<string, { color: string; label: string }> = {
  HIGH: { color: "bg-red-100 text-red-800", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-800", label: "Medium" },
  LOW: { color: "bg-green-100 text-green-800", label: "Low" },
};

interface AssessmentTasksSectionProps {
  userRole: UserRole;
}

export function AssessmentTasksSection({ userRole }: AssessmentTasksSectionProps) {
  const utils = api.useUtils();
  const canManage = MANAGER_ROLES.includes(userRole);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewBUDialog, setShowNewBUDialog] = useState(false);
  const [newBUName, setNewBUName] = useState("");
  const [isCreatingBU, setIsCreatingBU] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scope: "",
    businessUnitId: "__none__",
    assessmentTypeId: "__none__",
    priority: "MEDIUM",
    dueDate: "",
    assignedToId: "__none__",
  });

  // Queries
  const { data: tasksData, isLoading: tasksLoading } = api.assessmentTask.list.useQuery({
    unassignedOnly: false,
    limit: 10,
  });

  const { data: metrics } = api.assessmentTask.getQueueMetrics.useQuery();

  const { data: assignableUsers } = api.assessmentTask.getAssignableUsers.useQuery(
    undefined,
    { enabled: assignDialogOpen || createDialogOpen }
  );

  const { data: businessUnits } = api.businessUnit.list.useQuery(
    { includeInactive: false },
    { enabled: createDialogOpen }
  );

  const { data: assessmentTypes } = api.assessmentType.getActiveTypes.useQuery(
    undefined,
    { enabled: createDialogOpen }
  );

  // Mutations
  const createMutation = api.assessmentTask.create.useMutation({
    onSuccess: () => {
      toast.success("Assessment task created successfully");
      setCreateDialogOpen(false);
      resetForm();
      void utils.assessmentTask.list.invalidate();
      void utils.assessmentTask.getQueueMetrics.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create assessment task");
    },
  });

  const assignMutation = api.assessmentTask.assign.useMutation({
    onSuccess: () => {
      toast.success("Task assigned successfully");
      setAssignDialogOpen(false);
      setSelectedTaskId(null);
      void utils.assessmentTask.list.invalidate();
      void utils.assessmentTask.getQueueMetrics.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign task");
    },
  });

  const createBUMutation = api.businessUnit.create.useMutation({
    onSuccess: async (newBU) => {
      await utils.businessUnit.list.invalidate();
      setFormData((prev) => ({ ...prev, businessUnitId: newBU.id }));
      setShowNewBUDialog(false);
      setNewBUName("");
      setIsCreatingBU(false);
      toast.success(`Business unit "${newBU.name}" created`);
    },
    onError: (error) => {
      setIsCreatingBU(false);
      toast.error(error.message || "Failed to create business unit");
    },
  });

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      description: "",
      scope: "",
      businessUnitId: "__none__",
      assessmentTypeId: "__none__",
      priority: "MEDIUM",
      dueDate: "",
      assignedToId: "__none__",
    });
  }, []);

  const handleCreateTask = useCallback(() => {
    if (!formData.title.trim() || !formData.scope.trim()) {
      toast.error("Title and scope are required");
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      scope: formData.scope.trim(),
      businessUnitId: formData.businessUnitId === "__none__" ? null : formData.businessUnitId,
      assessmentTypeId: formData.assessmentTypeId === "__none__" ? null : formData.assessmentTypeId,
      priority: formData.priority as "HIGH" | "MEDIUM" | "LOW",
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      assignedToId: formData.assignedToId === "__none__" ? null : formData.assignedToId,
    });
  }, [formData, createMutation]);

  const handleAssignTask = useCallback((assignedToId: string) => {
    if (!selectedTaskId) return;

    assignMutation.mutate({
      id: selectedTaskId,
      assignedToId,
    });
  }, [selectedTaskId, assignMutation]);

  const openAssignDialog = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setAssignDialogOpen(true);
  }, []);

  const handleCreateBU = useCallback(() => {
    if (!newBUName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsCreatingBU(true);
    createBUMutation.mutate({
      name: newBUName.trim(),
    });
  }, [newBUName, createBUMutation]);

  return (
    <>
      {/* Assessment Tasks Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Assessment Tasks
              </CardTitle>
              <CardDescription>
                Proactive risk assessments assigned to analysts
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Quick metrics */}
              {metrics && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-amber-600">{metrics.pending}</span> pending
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-red-600">{metrics.unassigned}</span> unassigned
                  </span>
                </div>
              )}
              {canManage && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tasksData?.tasks.length ? (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assessment tasks yet</p>
              {canManage && (
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Task
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tasksData.tasks
                .filter(task => task.status !== AssessmentTaskStatus.COMPLETED &&
                               task.status !== AssessmentTaskStatus.CANCELLED)
                .slice(0, 5)
                .map((task) => {
                  const statusCfg = statusConfig[task.status];
                  const priorityCfg = priorityConfig[task.priority] ?? { color: "bg-gray-100 text-gray-800", label: task.priority };
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {task.identifier}
                          </span>
                          <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                          <Badge variant="outline" className={priorityCfg.color}>
                            {priorityCfg.label}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium truncate">{task.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {task.businessUnit && (
                            <span>Scope: {task.businessUnit.name}</span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </span>
                          )}
                          {task.assignedTo ? (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assignedTo.name || task.assignedTo.email}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Unassigned</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {canManage && !task.assignedTo && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignDialog(task.id)}
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {tasksData.tasks.filter(t =>
                t.status !== AssessmentTaskStatus.COMPLETED &&
                t.status !== AssessmentTaskStatus.CANCELLED
              ).length > 5 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  + {tasksData.tasks.filter(t =>
                    t.status !== AssessmentTaskStatus.COMPLETED &&
                    t.status !== AssessmentTaskStatus.CANCELLED
                  ).length - 5} more tasks
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Assessment Task</DialogTitle>
            <DialogDescription>
              Create a new risk assessment task to assign to an analyst.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                placeholder="e.g., Q1 2026 IT Infrastructure Risk Assessment"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-scope">Scope *</Label>
              <Textarea
                id="task-scope"
                placeholder="Describe what should be assessed (systems, processes, departments)..."
                rows={3}
                value={formData.scope}
                onChange={(e) => setFormData((prev) => ({ ...prev, scope: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Additional context or instructions..."
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="task-bu">Business Unit</Label>
                <Select
                  value={formData.businessUnitId}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setShowNewBUDialog(true);
                    } else {
                      setFormData((prev) => ({ ...prev, businessUnitId: value }));
                    }
                  }}
                >
                  <SelectTrigger id="task-bu">
                    <SelectValue placeholder="Select BU (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {businessUnits?.flatOptions?.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>
                        {bu.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Add new unit...</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-type">Assessment Type</Label>
                <Select
                  value={formData.assessmentTypeId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, assessmentTypeId: value }))}
                >
                  <SelectTrigger id="task-type">
                    <SelectValue placeholder="Select type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {assessmentTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-due">Due Date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select
                value={formData.assignedToId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, assignedToId: value }))}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Assign later (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Assign later</SelectItem>
                  {assignableUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
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
            <Button onClick={handleCreateTask} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Select an analyst to assign this assessment task to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {assignableUsers?.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleAssignTask(user.id)}
                  disabled={assignMutation.isPending}
                >
                  <User className="h-4 w-4 mr-2" />
                  {user.name || user.email}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {user.role}
                  </span>
                </Button>
              ))}
              {!assignableUsers?.length && (
                <p className="text-center text-muted-foreground py-4">
                  No assignable users found
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Business Unit Dialog */}
      <Dialog open={showNewBUDialog} onOpenChange={setShowNewBUDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Add New Business Unit
            </DialogTitle>
            <DialogDescription>
              Create a new business unit for organizational grouping.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newBUName">Name *</Label>
              <Input
                id="newBUName"
                placeholder="Business unit name"
                value={newBUName}
                onChange={(e) => setNewBUName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewBUDialog(false)}
              disabled={isCreatingBU}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateBU} disabled={isCreatingBU}>
              {isCreatingBU ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Unit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
