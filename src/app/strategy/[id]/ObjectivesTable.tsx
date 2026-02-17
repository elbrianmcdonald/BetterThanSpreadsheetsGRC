"use client";

/**
 * ObjectivesTable Component
 *
 * Displays objectives within a goal accordion.
 *
 * Story 2.5: Objective Detail Page UI
 * AC1: Objectives display in table with Title, Status badge, Progress bar, Due Date, Assignee avatars
 * AC2: Click navigates to objective detail page
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Plus,
  Target,
  Calendar,
  ChevronRight,
  Loader2,
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ObjectiveStatus } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Story 2.5 AC8: Objective status badge configuration */
const objectiveStatusConfig: Record<ObjectiveStatus, { color: string; label: string; icon: typeof Circle }> = {
  NOT_STARTED: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Not Started", icon: Circle },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "In Progress", icon: Clock },
  AT_RISK: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "At Risk", icon: AlertTriangle },
  COMPLETED: { color: "bg-green-100 text-green-700 border-green-200", label: "Completed", icon: CheckCircle2 },
};

interface ObjectivesTableProps {
  goalId: string;
  strategyId: string;
  canManage: boolean;
}

export function ObjectivesTable({ goalId, strategyId, canManage }: ObjectivesTableProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [addObjectiveOpen, setAddObjectiveOpen] = useState(false);
  const [objectiveForm, setObjectiveForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    percentComplete: 0,
  });

  // Fetch objectives for this goal
  const { data: objectives, isLoading } = api.objective.listByGoal.useQuery(
    { goalId },
    { enabled: !!goalId }
  );

  // Create objective mutation
  const createObjectiveMutation = api.objective.create.useMutation({
    onSuccess: () => {
      toast.success("Objective created successfully");
      setAddObjectiveOpen(false);
      setObjectiveForm({
        title: "",
        description: "",
        dueDate: "",
        percentComplete: 0,
      });
      void utils.objective.listByGoal.invalidate({ goalId });
      void utils.strategy.getById.invalidate({ id: strategyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create objective");
    },
  });

  const handleCreateObjective = () => {
    if (!objectiveForm.title.trim()) {
      toast.error("Title is required");
      return;
    }

    createObjectiveMutation.mutate({
      goalId,
      title: objectiveForm.title.trim(),
      description: objectiveForm.description || undefined,
      dueDate: objectiveForm.dueDate ? new Date(objectiveForm.dueDate) : undefined,
      kpiType: "MANUAL_PERCENTAGE",
      targetValue: 100,
      currentValue: objectiveForm.percentComplete,
    });
  };

  const navigateToObjective = (objectiveId: string) => {
    router.push(`/strategy/${strategyId}/objective/${objectiveId}`);
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Objectives Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Objectives</span>
          <Badge variant="secondary" className="text-xs">
            {objectives?.length || 0}
          </Badge>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddObjectiveOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Objective
          </Button>
        )}
      </div>

      {/* Objectives Table or Empty State */}
      {!objectives || objectives.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">
            No objectives yet. Add objectives to track progress.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead className="w-[15%]">Status</TableHead>
                <TableHead className="w-[15%]">Progress</TableHead>
                <TableHead className="w-[15%]">Due Date</TableHead>
                <TableHead className="w-[15%]">Assignees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objectives.map((objective) => {
                const statusInfo = objectiveStatusConfig[objective.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <TableRow
                    key={objective.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigateToObjective(objective.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{objective.title}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusInfo.color} border`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={objective.progress}
                          className="h-2 w-16"
                        />
                        <span className="text-sm text-muted-foreground">
                          {objective.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {objective.dueDate ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(objective.dueDate), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {objective.assignees && objective.assignees.length > 0 ? (
                        <TooltipProvider>
                          <div className="flex -space-x-2">
                            {objective.assignees.slice(0, 3).map((assignee) => (
                              <Tooltip key={assignee.id}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={assignee.image || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(assignee.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{assignee.name || assignee.email}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {objective.assignees.length > 3 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarFallback className="text-xs bg-muted">
                                      +{objective.assignees.length - 3}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{objective.assignees.length - 3} more assignee(s)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Objective Dialog */}
      <Dialog open={addObjectiveOpen} onOpenChange={setAddObjectiveOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Objective</DialogTitle>
            <DialogDescription>
              Create a new objective to track progress towards this goal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="obj-title">Title *</Label>
              <Input
                id="obj-title"
                placeholder="e.g., Reduce critical vulnerabilities by 50%"
                value={objectiveForm.title}
                onChange={(e) =>
                  setObjectiveForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-description">Description</Label>
              <Textarea
                id="obj-description"
                placeholder="Describe the objective..."
                value={objectiveForm.description}
                onChange={(e) =>
                  setObjectiveForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="obj-percentComplete">% Complete</Label>
                <Input
                  id="obj-percentComplete"
                  type="number"
                  min={0}
                  max={100}
                  value={objectiveForm.percentComplete}
                  onChange={(e) =>
                    setObjectiveForm((prev) => ({
                      ...prev,
                      percentComplete: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="obj-dueDate">Due Date</Label>
                <Input
                  id="obj-dueDate"
                  type="date"
                  value={objectiveForm.dueDate}
                  onChange={(e) =>
                    setObjectiveForm((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddObjectiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateObjective}
              disabled={createObjectiveMutation.isPending}
            >
              {createObjectiveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Objective
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
