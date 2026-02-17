"use client";

/**
 * Strategy Detail Client Component
 *
 * Displays strategy details with goals in an accordion view.
 *
 * Story 1.5: Strategy Detail Page with Goals
 * AC1: Strategy header with Title, Status badge, Progress bar, Owner, Fiscal Year
 * AC2: Goals in accordion/collapsible cards
 * AC3: Edit Strategy modal
 * AC4: Add Goal modal
 * AC5: Expanded goal details with objectives placeholder
 * AC6: Delete confirmation dialogs
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Edit,
  Flag,
  Loader2,
  MoreVertical,
  Plus,
  Target,
  Trash2,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Clock,
} from "lucide-react";
import { UserRole, StrategyStatus, ObjectiveStatus, KpiType } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ObjectivesTable } from "./ObjectivesTable";
import { HistoryViewer } from "@/components/strategy/HistoryViewer";
import { StrategyCalendarView } from "@/components/strategy/StrategyCalendarView";
import { StrategyTimelineChart } from "@/components/strategy/StrategyTimelineChart";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { List, CalendarDays, GanttChart } from "lucide-react";

/** Roles that can manage strategies (FR58) */
const CAN_MANAGE_STRATEGY_ROLES: UserRole[] = [
  UserRole.CISO,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/** Status badge configuration */
const statusConfig: Record<StrategyStatus, { color: string; label: string }> = {
  DRAFT: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Draft" },
  ACTIVE: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Active" },
  COMPLETED: { color: "bg-green-100 text-green-700 border-green-200", label: "Completed" },
  ARCHIVED: { color: "bg-gray-100 text-gray-500 border-gray-200", label: "Archived" },
};

/** Story 2.5 AC8: Objective status badge configuration */
const objectiveStatusConfig: Record<ObjectiveStatus, { color: string; label: string; icon: typeof Circle }> = {
  NOT_STARTED: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Not Started", icon: Circle },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "In Progress", icon: Clock },
  AT_RISK: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "At Risk", icon: AlertTriangle },
  COMPLETED: { color: "bg-green-100 text-green-700 border-green-200", label: "Completed", icon: CheckCircle2 },
};

export function StrategyDetailClient() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Modal states
  const [editStrategyOpen, setEditStrategyOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [deleteStrategyOpen, setDeleteStrategyOpen] = useState(false);
  const [deleteGoalOpen, setDeleteGoalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Story 4.5: History pagination state
  const [historyOffset, setHistoryOffset] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  // Form states
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    fiscalYearStart: 2025,
    fiscalYearEnd: 2025,
    status: "DRAFT" as StrategyStatus,
  });

  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    targetDate: "",
  });

  // Check permissions
  const userRole = session?.user?.role as UserRole | undefined;
  const canManage = userRole && CAN_MANAGE_STRATEGY_ROLES.includes(userRole);

  // Fetch strategy with goals
  const { data: strategy, isLoading, error } = api.strategy.getById.useQuery(
    { id: strategyId },
    { enabled: !!strategyId }
  );

  // Story 4.5: Fetch strategy history
  const { data: historyData, isLoading: historyLoading } = api.strategy.getHistory.useQuery(
    { strategyId, limit: HISTORY_PAGE_SIZE, offset: historyOffset },
    { enabled: !!strategyId }
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

  // Initialize edit form when strategy loads
  useEffect(() => {
    if (strategy) {
      setEditForm({
        title: strategy.title,
        description: strategy.description || "",
        fiscalYearStart: strategy.fiscalYearStart,
        fiscalYearEnd: strategy.fiscalYearEnd,
        status: strategy.status,
      });
    }
  }, [strategy]);

  // Mutations
  const updateStrategyMutation = api.strategy.update.useMutation({
    onSuccess: () => {
      toast.success("Strategy updated successfully");
      setEditStrategyOpen(false);
      void utils.strategy.getById.invalidate({ id: strategyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update strategy");
    },
  });

  const deleteStrategyMutation = api.strategy.delete.useMutation({
    onSuccess: () => {
      toast.success("Strategy deleted successfully");
      router.push("/strategy");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete strategy");
    },
  });

  const createGoalMutation = api.goal.create.useMutation({
    onSuccess: () => {
      toast.success("Goal created successfully");
      setAddGoalOpen(false);
      setGoalForm({ title: "", description: "", targetDate: "" });
      void utils.strategy.getById.invalidate({ id: strategyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create goal");
    },
  });

  const updateGoalMutation = api.goal.update.useMutation({
    onSuccess: () => {
      toast.success("Goal updated successfully");
      setEditGoalOpen(false);
      setSelectedGoalId(null);
      void utils.strategy.getById.invalidate({ id: strategyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update goal");
    },
  });

  const deleteGoalMutation = api.goal.delete.useMutation({
    onSuccess: () => {
      toast.success("Goal deleted successfully");
      setDeleteGoalOpen(false);
      setSelectedGoalId(null);
      void utils.strategy.getById.invalidate({ id: strategyId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete goal");
    },
  });

  // Handlers
  const handleEditStrategy = useCallback(() => {
    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    updateStrategyMutation.mutate({
      id: strategyId,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      fiscalYearStart: editForm.fiscalYearStart,
      fiscalYearEnd: editForm.fiscalYearEnd,
      status: editForm.status,
    });
  }, [editForm, strategyId, updateStrategyMutation]);

  const handleDeleteStrategy = useCallback(() => {
    deleteStrategyMutation.mutate({ id: strategyId });
  }, [strategyId, deleteStrategyMutation]);

  const handleAddGoal = useCallback(() => {
    if (!goalForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createGoalMutation.mutate({
      strategyId,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      targetDate: goalForm.targetDate ? new Date(goalForm.targetDate) : null,
    });
  }, [goalForm, strategyId, createGoalMutation]);

  const handleEditGoal = useCallback(() => {
    if (!selectedGoalId || !goalForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    updateGoalMutation.mutate({
      id: selectedGoalId,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      targetDate: goalForm.targetDate ? new Date(goalForm.targetDate) : null,
    });
  }, [goalForm, selectedGoalId, updateGoalMutation]);

  const handleDeleteGoal = useCallback(() => {
    if (!selectedGoalId) return;
    deleteGoalMutation.mutate({ id: selectedGoalId });
  }, [selectedGoalId, deleteGoalMutation]);

  const openEditGoalModal = useCallback((goal: {
    id: string;
    title: string;
    description: string | null;
    targetDate: Date | null;
  }) => {
    setSelectedGoalId(goal.id);
    setGoalForm({
      title: goal.title,
      description: goal.description || "",
      targetDate: goal.targetDate ? format(new Date(goal.targetDate), "yyyy-MM-dd") : "",
    });
    setEditGoalOpen(true);
  }, []);

  const openDeleteGoalDialog = useCallback((goalId: string) => {
    setSelectedGoalId(goalId);
    setDeleteGoalOpen(true);
  }, []);

  // Loading state
  if (!isMounted || sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Strategy", href: "/strategy" },
          { label: "Error" },
        ]}
      >
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error.message}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => router.push("/strategy")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Strategies
                </Button>
                <Button variant="outline" onClick={() => router.refresh()}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!strategy) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Strategy", href: "/strategy" },
          { label: "Not Found" },
        ]}
      >
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The strategy you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/strategy")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Strategies
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const config = statusConfig[strategy.status];
  // Story 4.3: Use calculated progress from API (cascades from objectives → goals → strategy)
  const progress = strategy.progress ?? 0;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Strategy", href: "/strategy" },
        { label: strategy.title },
      ]}
    >
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/strategy")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Strategies
        </Button>

        {/* Strategy Header (AC1) */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">{strategy.title}</CardTitle>
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                </div>
                {strategy.description && (
                  <CardDescription className="mt-2 text-base">
                    {strategy.description}
                  </CardDescription>
                )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditStrategyOpen(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Strategy
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteStrategyOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Strategy
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Progress */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Progress</p>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{progress}%</span>
                </div>
              </div>

              {/* Fiscal Year */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Fiscal Year</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {strategy.fiscalYearStart === strategy.fiscalYearEnd
                      ? `FY${strategy.fiscalYearStart}`
                      : `FY${strategy.fiscalYearStart}-${strategy.fiscalYearEnd}`}
                  </span>
                </div>
              </div>

              {/* Owner */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Owner</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {strategy.owner?.name || strategy.owner?.email || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Goals Count */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Goals</p>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{strategy.goals?.length || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals, Calendar, and Timeline Views */}
        <Tabs defaultValue="goals" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="goals" className="gap-2">
                <List className="h-4 w-4" />
                Goals
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <GanttChart className="h-4 w-4" />
                Timeline
              </TabsTrigger>
            </TabsList>

            {canManage && (
              <Button onClick={() => {
                setGoalForm({ title: "", description: "", targetDate: "" });
                setAddGoalOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            )}
          </div>

          {/* Goals Tab (AC2) */}
          <TabsContent value="goals">
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
                <CardDescription>
                  Strategic goals and objectives for this strategy
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!strategy.goals || strategy.goals.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Goals Yet</h3>
                    <p className="text-muted-foreground mt-1 mb-4">
                      Add goals to track progress towards your strategic objectives.
                    </p>
                    {canManage && (
                      <Button onClick={() => {
                        setGoalForm({ title: "", description: "", targetDate: "" });
                        setAddGoalOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Goal
                      </Button>
                    )}
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {strategy.goals.map((goal) => {
                      // Story 4.3: Use calculated progress from API
                      const goalProgress = goal.progress ?? 0;
                      const objectiveCount = goal._count?.objectives ?? goal.objectives?.length ?? 0;

                      return (
                        <AccordionItem
                          key={goal.id}
                          value={goal.id}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <Flag className="h-5 w-5 text-primary" />
                                <span className="font-medium text-left">{goal.title}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 min-w-[100px]">
                                  <Progress value={goalProgress} className="h-2 w-16" />
                                  <span>{goalProgress}%</span>
                                </div>
                                {goal.targetDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(goal.targetDate), "MMM d, yyyy")}
                                  </div>
                                )}
                                <span className="bg-muted px-2 py-0.5 rounded text-xs">
                                  {objectiveCount} {objectiveCount === 1 ? "objective" : "objectives"}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            {/* Goal Details (AC5) */}
                            <div className="pl-8 space-y-4">
                              {goal.description && (
                                <p className="text-muted-foreground">{goal.description}</p>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Target Date</p>
                                  <p className="font-medium">
                                    {goal.targetDate
                                      ? format(new Date(goal.targetDate), "MMMM d, yyyy")
                                      : "Not set"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Owner</p>
                                  <p className="font-medium">
                                    {goal.owner?.name || goal.owner?.email || "Unassigned"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Sort Order</p>
                                  <p className="font-medium">{goal.sortOrder + 1}</p>
                                </div>
                              </div>

                              {/* Story 2.5 AC1: Objectives Table */}
                              <ObjectivesTable
                                goalId={goal.id}
                                strategyId={strategyId}
                                canManage={canManage ?? false}
                              />

                              {/* Goal Actions */}
                              {canManage && (
                                <div className="flex items-center gap-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditGoalModal(goal)}
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit Goal
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => openDeleteGoalDialog(goal.id)}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <StrategyCalendarView
              strategy={strategy as any}
              onGoalClick={(goalId) => {
                // Scroll to goals tab and expand the goal
                const element = document.getElementById(goalId);
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <StrategyTimelineChart
              strategy={strategy as any}
              onGoalClick={(goalId) => {
                // Scroll to goals tab and expand the goal
                const element = document.getElementById(goalId);
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Story 4.5: History Viewer */}
        <HistoryViewer
          history={accumulatedHistory}
          total={historyData?.total ?? 0}
          hasMore={historyData?.hasMore ?? false}
          isLoading={historyLoading}
          onLoadMore={handleLoadMoreHistory}
          entityType="Strategy"
        />
      </div>

      {/* Edit Strategy Dialog (AC3) */}
      <Dialog open={editStrategyOpen} onOpenChange={setEditStrategyOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Strategy</DialogTitle>
            <DialogDescription>
              Update the strategy details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-fiscalYearStart">Fiscal Year Start</Label>
                <Input
                  id="edit-fiscalYearStart"
                  type="number"
                  min={2000}
                  max={2100}
                  value={editForm.fiscalYearStart}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fiscalYearStart: parseInt(e.target.value) || 2025,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-fiscalYearEnd">Fiscal Year End</Label>
                <Input
                  id="edit-fiscalYearEnd"
                  type="number"
                  min={2000}
                  max={2100}
                  value={editForm.fiscalYearEnd}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fiscalYearEnd: parseInt(e.target.value) || 2025,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, status: value as StrategyStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditStrategyOpen(false)}
              disabled={updateStrategyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditStrategy}
              disabled={updateStrategyMutation.isPending}
            >
              {updateStrategyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Goal Dialog (AC4) */}
      <Dialog open={addGoalOpen} onOpenChange={setAddGoalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
            <DialogDescription>
              Create a new goal for this strategy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="goal-title">Title *</Label>
              <Input
                id="goal-title"
                placeholder="e.g., Implement Zero Trust Architecture"
                value={goalForm.title}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                placeholder="Describe the goal and its key outcomes..."
                value={goalForm.description}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-targetDate">Target Date</Label>
              <Input
                id="goal-targetDate"
                type="date"
                value={goalForm.targetDate}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddGoalOpen(false)}
              disabled={createGoalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddGoal}
              disabled={createGoalMutation.isPending || !goalForm.title.trim()}
            >
              {createGoalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Goal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={editGoalOpen} onOpenChange={setEditGoalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>
              Update the goal details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-title">Title *</Label>
              <Input
                id="edit-goal-title"
                value={goalForm.title}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-description">Description</Label>
              <Textarea
                id="edit-goal-description"
                value={goalForm.description}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-targetDate">Target Date</Label>
              <Input
                id="edit-goal-targetDate"
                type="date"
                value={goalForm.targetDate}
                onChange={(e) =>
                  setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditGoalOpen(false)}
              disabled={updateGoalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditGoal}
              disabled={updateGoalMutation.isPending || !goalForm.title.trim()}
            >
              {updateGoalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Strategy Confirmation (AC6) */}
      <AlertDialog open={deleteStrategyOpen} onOpenChange={setDeleteStrategyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the strategy &quot;{strategy.title}&quot; and all
              of its {strategy.goals?.length || 0} goals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStrategyMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStrategy}
              disabled={deleteStrategyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStrategyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Strategy"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Goal Confirmation (AC6) */}
      <AlertDialog open={deleteGoalOpen} onOpenChange={setDeleteGoalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this goal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGoalMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
              disabled={deleteGoalMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGoalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Goal"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
