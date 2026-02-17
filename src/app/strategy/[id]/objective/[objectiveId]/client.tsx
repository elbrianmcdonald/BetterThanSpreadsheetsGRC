"use client";

/**
 * Objective Detail Client Component
 *
 * Story 2.5: Objective Detail Page UI
 * AC2: Full objective details page
 * AC3: MANUAL_PERCENTAGE KPI - progress bar, 0-100 input
 * AC4: MANUAL_COUNT KPI - current vs target count display
 * AC5: MANUAL_BOOLEAN KPI - achieved/not achieved toggle
 * AC6: Assignee list with avatars, edit capability
 * AC7: Comments section with add capability
 * AC8: Status dropdown with colored badges
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Edit,
  Loader2,
  Save,
  Target,
  User,
  Users,
  MessageSquare,
  Send,
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Check,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { UserRole, ObjectiveStatus, KpiType } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { EntityLinkingModal } from "./EntityLinkingModal";
import { LinkedEntitiesSection } from "./LinkedEntitiesSection";
import { HistoryViewer } from "@/components/strategy/HistoryViewer";

/** Roles that can manage objectives (FR58) */
const CAN_MANAGE_ROLES: UserRole[] = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/** Roles that can update assigned objectives (FR59) */
const CAN_UPDATE_ROLES: UserRole[] = [
  ...CAN_MANAGE_ROLES,
  UserRole.SECURITY_ENGINEER,
];

/** Story 2.5 AC8: Objective status badge configuration */
const objectiveStatusConfig: Record<ObjectiveStatus, { color: string; label: string; icon: typeof Circle }> = {
  NOT_STARTED: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Not Started", icon: Circle },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "In Progress", icon: Clock },
  AT_RISK: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "At Risk", icon: AlertTriangle },
  COMPLETED: { color: "bg-green-100 text-green-700 border-green-200", label: "Completed", icon: CheckCircle2 },
};

/** KPI type display labels */
const kpiTypeLabels: Record<KpiType, string> = {
  MANUAL_PERCENTAGE: "Percentage",
  MANUAL_COUNT: "Count",
  MANUAL_BOOLEAN: "Yes/No",
  RISK_REMEDIATION_RATE: "Risk Remediation Rate",
  RISK_OPEN_COUNT: "Open Risks Count",
  HIGH_SEVERITY_RISK_COUNT: "High Severity Risks",
  CONTROL_IMPLEMENTATION_RATE: "Control Implementation",
  CONTROL_EFFECTIVENESS_AVG: "Control Effectiveness",
  EVIDENCE_FRESHNESS_RATE: "Evidence Freshness",
  EVIDENCE_COVERAGE: "Evidence Coverage",
};

/** Story 3.5: Auto-calculated KPI types */
const AUTO_KPI_TYPES: KpiType[] = [
  KpiType.RISK_REMEDIATION_RATE,
  KpiType.RISK_OPEN_COUNT,
  KpiType.HIGH_SEVERITY_RISK_COUNT,
  KpiType.CONTROL_IMPLEMENTATION_RATE,
  KpiType.CONTROL_EFFECTIVENESS_AVG,
  KpiType.EVIDENCE_FRESHNESS_RATE,
  KpiType.EVIDENCE_COVERAGE,
];

export function ObjectiveDetailClient() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;
  const objectiveId = params.objectiveId as string;
  const { data: session } = useSession();
  const utils = api.useUtils();

  // State
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [linkingModalOpen, setLinkingModalOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Story 4.5: History pagination state
  const [historyOffset, setHistoryOffset] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "NOT_STARTED" as ObjectiveStatus,
    dueDate: "",
    currentValue: 0,
    targetValue: 100,
  });

  // Check permissions
  const userRole = session?.user?.role as UserRole | undefined;
  const canManage = userRole && CAN_MANAGE_ROLES.includes(userRole);

  // Fetch objective
  const { data: objective, isLoading, error } = api.objective.getById.useQuery(
    { id: objectiveId },
    { enabled: !!objectiveId }
  );

  // Check if user can update (manager or assigned SECURITY_ENGINEER)
  const isAssigned = objective?.assignees?.some(a => a.id === session?.user?.id);
  const canUpdate = canManage || (userRole === UserRole.SECURITY_ENGINEER && isAssigned);

  // Fetch organization users for assignee selection
  const { data: orgUsers } = api.user.listUsers.useQuery(
    { take: 100 },
    { enabled: assigneeDialogOpen }
  );

  // Story 4.5: Fetch objective history
  const { data: historyData, isLoading: historyLoading } = api.objective.getHistory.useQuery(
    { objectiveId, limit: HISTORY_PAGE_SIZE, offset: historyOffset },
    { enabled: !!objectiveId }
  );

  // Accumulate history entries for load more - using explicit type
  const [accumulatedHistory, setAccumulatedHistory] = useState<NonNullable<typeof historyData>["history"]>([]);

  // Update accumulated history when new data arrives
  useEffect(() => {
    if (historyData?.history) {
      if (historyOffset === 0) {
        setAccumulatedHistory(historyData.history);
      } else {
        setAccumulatedHistory(prev => [...prev, ...historyData.history]);
      }
    }
  }, [historyData, historyOffset]);

  const handleLoadMoreHistory = () => {
    setHistoryOffset(prev => prev + HISTORY_PAGE_SIZE);
  };

  // Initialize edit form when objective loads
  useEffect(() => {
    if (objective) {
      setEditForm({
        title: objective.title,
        description: objective.description || "",
        status: objective.status,
        dueDate: objective.dueDate
          ? format(new Date(objective.dueDate), "yyyy-MM-dd")
          : "",
        currentValue: objective.currentValue ?? 0,
        targetValue: objective.targetValue ?? 100,
      });
    }
  }, [objective]);

  // Mutations
  // Story 4.4 AC1-AC2: Invalidate objective, goal, and strategy for real-time progress updates
  const updateMutation = api.objective.update.useMutation({
    onSuccess: () => {
      toast.success("Objective updated");
      setEditMode(false);
      // Invalidate objective
      void utils.objective.getById.invalidate({ id: objectiveId });
      // Invalidate parent goal for progress recalculation
      if (objective?.goal?.id) {
        void utils.goal.getById.invalidate({ id: objective.goal.id });
        void utils.goal.listByStrategy.invalidate({ strategyId });
      }
      // Invalidate strategy for cascading progress updates
      void utils.strategy.getById.invalidate({ id: strategyId });
      void utils.strategy.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update objective");
    },
  });

  const deleteMutation = api.objective.delete.useMutation({
    onSuccess: () => {
      toast.success("Objective deleted");
      router.push(`/strategy/${strategyId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete objective");
    },
  });

  const addCommentMutation = api.objective.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment added");
      setCommentText("");
      void utils.objective.getById.invalidate({ id: objectiveId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // Story 3.5 AC9: KPI recalculation
  // Story 4.4 AC5: Cascade progress updates when KPI is recalculated
  const calculateKpiMutation = api.objective.calculateKpi.useMutation({
    onSuccess: (data) => {
      toast.success(`KPI recalculated: ${data.previousValue} → ${data.currentValue}`);
      // Invalidate objective
      void utils.objective.getById.invalidate({ id: objectiveId });
      // Invalidate parent goal and strategy for cascading progress updates
      if (objective?.goal?.id) {
        void utils.goal.getById.invalidate({ id: objective.goal.id });
        void utils.goal.listByStrategy.invalidate({ strategyId });
      }
      void utils.strategy.getById.invalidate({ id: strategyId });
      void utils.strategy.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to calculate KPI");
    },
  });

  // Handlers
  const handleSave = () => {
    updateMutation.mutate({
      id: objectiveId,
      title: editForm.title,
      description: editForm.description || null,
      status: editForm.status,
      dueDate: editForm.dueDate ? new Date(editForm.dueDate) : null,
      currentValue: editForm.currentValue,
      targetValue: editForm.targetValue,
    });
  };

  const handleStatusChange = (status: ObjectiveStatus) => {
    updateMutation.mutate({
      id: objectiveId,
      status,
    });
  };

  const handleKpiValueChange = (value: number) => {
    setEditForm(prev => ({ ...prev, currentValue: value }));
  };

  const handleSaveKpiValue = () => {
    updateMutation.mutate({
      id: objectiveId,
      currentValue: editForm.currentValue,
    });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate({
      objectiveId,
      content: commentText.trim(),
    });
  };

  const handleUpdateAssignees = (userIds: string[]) => {
    updateMutation.mutate({
      id: objectiveId,
      assigneeIds: userIds,
    });
    setAssigneeDialogOpen(false);
  };

  // Helper functions
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !objective) {
    return (
      <AppLayout>
        <div className="container py-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold">Objective not found</h2>
            <p className="text-muted-foreground mt-2">
              The objective you're looking for doesn't exist or you don't have access.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/strategy/${strategyId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategy
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = objectiveStatusConfig[objective.status];
  const StatusIcon = statusInfo.icon;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Strategy", href: "/strategy" },
        { label: objective.goal?.strategy?.title ?? "Strategy", href: `/strategy/${strategyId}` },
        { label: objective.goal?.title ?? "Goal" },
        { label: objective.title },
      ]}
    >
      <div className="container py-6 space-y-6 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/strategy/${strategyId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Strategy
        </Button>

        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                {editMode ? (
                  <Input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm(prev => ({ ...prev, title: e.target.value }))
                    }
                    className="text-2xl font-bold h-auto py-1"
                  />
                ) : (
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <Target className="h-6 w-6 text-primary" />
                    {objective.title}
                  </CardTitle>
                )}

                {/* Story 2.5 AC8: Status Dropdown */}
                <div className="flex items-center gap-3">
                  {canUpdate ? (
                    <Select
                      value={objective.status}
                      onValueChange={(value: ObjectiveStatus) => handleStatusChange(value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue>
                          <Badge
                            variant="outline"
                            className={`${statusInfo.color} border`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(objectiveStatusConfig).map(([status, config]) => {
                          const Icon = config.icon;
                          return (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`${statusInfo.color} border`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  )}

                  <Badge variant="secondary">
                    {kpiTypeLabels[objective.kpiType]}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {canUpdate && (
                  <>
                    {editMode ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditMode(false)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMode(true)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </>
                )}
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Objective
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <Label className="text-muted-foreground text-sm">Description</Label>
              {editMode ? (
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm(prev => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="mt-1"
                />
              ) : (
                <p className="mt-1">
                  {objective.description || "No description provided."}
                </p>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="text-muted-foreground text-sm">Due Date</Label>
                {editMode ? (
                  <Input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) =>
                      setEditForm(prev => ({ ...prev, dueDate: e.target.value }))
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {objective.dueDate
                        ? format(new Date(objective.dueDate), "MMMM d, yyyy")
                        : "Not set"}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Created By</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{objective.createdBy?.name || objective.createdBy?.email || "Unknown"}</span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Created</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(objective.createdAt), "MMMM d, yyyy")}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Progress Card (AC3-AC5) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
            <CardDescription>
              Track progress using {kpiTypeLabels[objective.kpiType]} KPI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* AC3: MANUAL_PERCENTAGE KPI */}
            {objective.kpiType === "MANUAL_PERCENTAGE" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Progress
                    value={objective.progress}
                    className="h-4 flex-1"
                  />
                  <span className="text-2xl font-bold w-20 text-right">
                    {objective.progress}%
                  </span>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Current Value:</Label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editForm.currentValue}
                      onChange={(e) => handleKpiValueChange(parseFloat(e.target.value) || 0)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editForm.currentValue}
                      onChange={(e) => handleKpiValueChange(parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveKpiValue}
                      disabled={updateMutation.isPending || editForm.currentValue === objective.currentValue}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* AC4: MANUAL_COUNT KPI */}
            {objective.kpiType === "MANUAL_COUNT" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    {objective.currentValue ?? 0}
                  </div>
                  <span className="text-2xl text-muted-foreground">
                    / {objective.targetValue ?? 0}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    ({objective.progress}%)
                  </span>
                </div>
                <Progress value={objective.progress} className="h-2" />
                {canUpdate && (
                  <div className="flex items-center gap-4">
                    <Label className="w-32">Current Count:</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.currentValue}
                      onChange={(e) => handleKpiValueChange(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveKpiValue}
                      disabled={updateMutation.isPending || editForm.currentValue === objective.currentValue}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* AC5: MANUAL_BOOLEAN KPI */}
            {objective.kpiType === "MANUAL_BOOLEAN" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {objective.currentValue === 1 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-8 w-8" />
                      <span className="text-2xl font-bold">Achieved</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Circle className="h-8 w-8" />
                      <span className="text-2xl font-bold">Not Achieved</span>
                    </div>
                  )}
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-4">
                    <Label>Mark as Achieved:</Label>
                    <Switch
                      checked={editForm.currentValue === 1}
                      onCheckedChange={(checked) => {
                        const newValue = checked ? 1 : 0;
                        setEditForm(prev => ({ ...prev, currentValue: newValue }));
                        updateMutation.mutate({
                          id: objectiveId,
                          currentValue: newValue,
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Story 3.5: Auto-calculated KPIs */}
            {AUTO_KPI_TYPES.includes(objective.kpiType) && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Progress
                    value={objective.progress}
                    className="h-4 flex-1"
                  />
                  <span className="text-2xl font-bold w-20 text-right">
                    {objective.progress}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span>Current: </span>
                    <span className="font-medium text-foreground">
                      {objective.currentValue ?? 0}
                      {objective.kpiType.includes("RATE") || objective.kpiType.includes("COVERAGE") ? "%" : ""}
                    </span>
                    {objective.targetValue && (
                      <>
                        <span> / Target: </span>
                        <span className="font-medium text-foreground">
                          {objective.targetValue}
                          {objective.kpiType.includes("RATE") || objective.kpiType.includes("COVERAGE") ? "%" : ""}
                        </span>
                      </>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => calculateKpiMutation.mutate({ objectiveId })}
                      disabled={calculateKpiMutation.isPending}
                    >
                      {calculateKpiMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Target className="h-4 w-4 mr-1" />
                      )}
                      Recalculate
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  This KPI is automatically calculated from linked entities.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Story 3.5: Linked Entities Section */}
        {/* Story 4.4 AC5: Pass strategyId and goalId for cascade progress invalidation */}
        <LinkedEntitiesSection
          objectiveId={objectiveId}
          strategyId={strategyId}
          goalId={objective.goal?.id || ""}
          linkedRisks={objective.linkedRisks || []}
          linkedControls={objective.linkedControls || []}
          linkedEvidence={objective.linkedEvidence || []}
          canManage={canManage ?? false}
          kpiType={objective.kpiType}
          onLinkClick={() => setLinkingModalOpen(true)}
        />

        {/* Assignees Card (AC6) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Assignees</CardTitle>
                <CardDescription>
                  Team members responsible for this objective
                </CardDescription>
              </div>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigneeDialogOpen(true)}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {objective.assignees && objective.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {objective.assignees.map((assignee) => (
                  <div
                    key={assignee.id}
                    className="flex items-center gap-2 bg-muted rounded-full py-1 px-3"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={assignee.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{assignee.name || assignee.email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No assignees yet. Add team members to track responsibility.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Comments Card (AC7) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comments
              {objective.comments && objective.comments.length > 0 && (
                <Badge variant="secondary">{objective.comments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Comment */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim() || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Separator />

            {/* Comments List */}
            {objective.comments && objective.comments.length > 0 ? (
              <div className="space-y-4">
                {objective.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author?.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.author?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.author?.name || comment.author?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                No comments yet. Be the first to add one!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Story 4.5: History Viewer */}
        <HistoryViewer
          history={accumulatedHistory}
          total={historyData?.total ?? 0}
          hasMore={historyData?.hasMore ?? false}
          isLoading={historyLoading}
          onLoadMore={handleLoadMoreHistory}
          entityType="Objective"
        />
      </div>

      {/* Assignee Selection Dialog */}
      <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Assignees</DialogTitle>
            <DialogDescription>
              Select team members to assign to this objective.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {orgUsers?.users?.map((user) => {
              const isSelected = objective.assignees?.some(a => a.id === user.id);
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted ${
                    isSelected ? "bg-muted" : ""
                  }`}
                  onClick={() => {
                    const currentIds = objective.assignees?.map(a => a.id) || [];
                    const newIds = isSelected
                      ? currentIds.filter(id => id !== user.id)
                      : [...currentIds, user.id];
                    handleUpdateAssignees(newIds);
                  }}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Objective?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{objective.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: objectiveId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Story 3.5: Entity Linking Modal */}
      {/* Story 4.4 AC5: Pass strategyId and goalId for cascade progress invalidation */}
      <EntityLinkingModal
        open={linkingModalOpen}
        onOpenChange={setLinkingModalOpen}
        objectiveId={objectiveId}
        strategyId={strategyId}
        goalId={objective.goal?.id || ""}
        isAutoKpi={AUTO_KPI_TYPES.includes(objective.kpiType)}
        onLinked={() => void utils.objective.getById.invalidate({ id: objectiveId })}
      />
    </AppLayout>
  );
}
