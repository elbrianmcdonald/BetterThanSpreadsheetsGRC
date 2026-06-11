"use client";

/**
 * Strategy Dashboard Client Component
 *
 * Story 5.2: Executive Dashboard Page
 * AC1: Summary cards (Total Strategies, Active, Average Progress, Overdue)
 * AC2: Horizontal bar chart showing strategy progress
 * AC3: Pie/donut chart showing objectives by status
 * AC4: Overdue objectives alert section
 * AC5: Empty state with CTA
 * AC6: Strategy filter dropdown
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
} from "date-fns";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  AlertTriangle,
  Plus,
  Filter,
  ChevronRight,
  Users,
  Calendar,
  Loader2,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  type TooltipProps,
} from "recharts";
import { ObjectiveStatus, StrategyStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/** Date range preset types (AC1) */
type DateRangePreset = "this_month" | "this_quarter" | "this_year" | "all_time" | "custom";

/** Get date range from preset */
function getDateRangeFromPreset(preset: DateRangePreset): { dateFrom?: Date; dateTo?: Date } {
  const today = new Date();

  switch (preset) {
    case "this_month":
      return { dateFrom: startOfMonth(today), dateTo: endOfMonth(today) };
    case "this_quarter":
      return { dateFrom: startOfQuarter(today), dateTo: endOfQuarter(today) };
    case "this_year":
      return { dateFrom: startOfYear(today), dateTo: endOfYear(today) };
    case "all_time":
    default:
      return {};
  }
}

/** Preset labels for display */
const PRESET_LABELS: Record<DateRangePreset, string> = {
  this_month: "This Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  all_time: "All Time",
  custom: "Custom Range",
};

/** Get color based on progress percentage (AC2) */
function getProgressColor(progress: number): string {
  if (progress < 33) return "var(--destructive)"; // brick
  if (progress < 67) return "var(--warning)"; // ochre
  return "var(--success)"; // forest
}

/** Status colors for pie chart (AC3) */
const STATUS_COLORS: Record<ObjectiveStatus, string> = {
  NOT_STARTED: "var(--chart-5)", // faint
  IN_PROGRESS: "var(--primary)", // navy
  AT_RISK: "var(--warning)", // ochre
  COMPLETED: "var(--success)", // forest
};

/** Status labels for display */
const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  AT_RISK: "At Risk",
  COMPLETED: "Completed",
};

/** Custom tooltip for bar chart */
function BarChartTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload as {
    title: string;
    progress: number;
    goalCount: number;
    objectiveCount: number;
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm">
      <p className="mb-1 font-semibold text-foreground">{data.title}</p>
      <div className="space-y-1 text-muted-foreground">
        <p>Progress: <span className="font-mono font-medium text-foreground tnum">{data.progress}%</span></p>
        <p>Goals: <span className="font-mono font-medium text-foreground tnum">{data.goalCount}</span></p>
        <p>Objectives: <span className="font-mono font-medium text-foreground tnum">{data.objectiveCount}</span></p>
      </div>
    </div>
  );
}

/** Custom tooltip for pie chart */
function PieChartTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm">
      <p className="font-medium text-foreground">{data?.name}: <span className="font-mono tnum">{data?.value}</span></p>
    </div>
  );
}

/** Summary Card Component (AC1) */
function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  variant?: "default" | "warning" | "success";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "warning" && "text-warning",
            variant === "success" && "text-success",
            variant === "default" && "text-muted-foreground/70"
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tnum text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Progress Ring for average progress display */
function ProgressRing({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 18; // radius = 18
  const offset = circumference - (progress / 100) * circumference;
  const color = getProgressColor(progress);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          className="text-muted"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r="18"
          cx="24"
          cy="24"
        />
        <circle
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={color}
          fill="transparent"
          r="18"
          cx="24"
          cy="24"
        />
      </svg>
      <span className="absolute font-mono text-xs font-medium tnum text-foreground">{progress}%</span>
    </div>
  );
}

/** Overdue Objective Item (AC4) */
function OverdueObjectiveItem({
  objective,
}: {
  objective: {
    id: string;
    title: string;
    dueDate: Date | null;
    daysOverdue: number;
    goalTitle: string;
    strategyId: string;
    strategyTitle: string;
    assignees: Array<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    }>;
  };
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/strategy/${objective.strategyId}/objective/${objective.id}`)}
      className="w-full text-left p-3 rounded-md border border-destructive/20 bg-destructive/10 hover:bg-destructive/15 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground">{objective.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {objective.strategyTitle} &rarr; {objective.goalTitle}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Assignee avatars */}
          {objective.assignees.length > 0 && (
            <div className="flex -space-x-2">
              {objective.assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={assignee.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {assignee.name?.charAt(0) ?? assignee.email?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {objective.assignees.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
                  +{objective.assignees.length - 3}
                </div>
              )}
            </div>
          )}
          <Badge variant="critical" className="font-mono text-xs">
            {objective.daysOverdue}d overdue
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
        </div>
      </div>
    </button>
  );
}

/** Empty State Component (AC5) */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Target className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">No strategies yet</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Create your first security strategy to start tracking goals and objectives
        for your organization.
      </p>
      <Link href="/strategy">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create your first strategy
        </Button>
      </Link>
    </div>
  );
}

/** Main Dashboard Component */
export function StrategyDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Story 5.4 AC5: Initialize state from URL query params
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | undefined>(
    searchParams.get("strategyId") ?? undefined
  );
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    (searchParams.get("range") as DateRangePreset) || "all_time"
  );
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(
    searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined
  );
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(
    searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined
  );

  // Calculate effective date range
  const effectiveDateRange = dateRangePreset === "custom"
    ? { dateFrom: customDateFrom, dateTo: customDateTo }
    : getDateRangeFromPreset(dateRangePreset);

  // Story 5.4 AC5: Update URL when filters change
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedStrategyId) params.set("strategyId", selectedStrategyId);
    if (dateRangePreset !== "all_time") params.set("range", dateRangePreset);
    if (dateRangePreset === "custom" && customDateFrom) {
      params.set("dateFrom", customDateFrom.toISOString().split("T")[0]!);
    }
    if (dateRangePreset === "custom" && customDateTo) {
      params.set("dateTo", customDateTo.toISOString().split("T")[0]!);
    }

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : "/strategy/dashboard", { scroll: false });
  }, [selectedStrategyId, dateRangePreset, customDateFrom, customDateTo, router]);

  // Update URL when filters change
  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  // Fetch strategies for filter dropdown
  const { data: strategiesData } = api.strategy.list.useQuery({
    pageSize: 100,
  });

  // Fetch dashboard data
  const { data: summaryData, isLoading: summaryLoading } = api.strategyDashboard.getSummary.useQuery(
    selectedStrategyId ? { strategyId: selectedStrategyId } : undefined
  );

  const { data: progressData, isLoading: progressLoading } = api.strategyDashboard.getProgressChart.useQuery({
    statusFilter: StrategyStatus.ACTIVE,
  });

  const { data: statusData, isLoading: statusLoading } = api.strategyDashboard.getStatusBreakdown.useQuery(
    selectedStrategyId ? { strategyId: selectedStrategyId } : undefined
  );

  // Story 5.4 AC2/AC4: Combine strategy and date range filters for overdue objectives
  const overdueQueryInput = {
    limit: 10,
    ...(selectedStrategyId && { strategyId: selectedStrategyId }),
    ...(effectiveDateRange.dateFrom && { dateFrom: effectiveDateRange.dateFrom }),
    ...(effectiveDateRange.dateTo && { dateTo: effectiveDateRange.dateTo }),
  };

  const { data: overdueData, isLoading: overdueLoading } = api.strategyDashboard.getOverdue.useQuery(
    overdueQueryInput
  );

  const isLoading = summaryLoading || progressLoading || statusLoading || overdueLoading;

  // Prepare pie chart data (AC3)
  const pieChartData = statusData
    ? Object.entries(statusData.objectives).map(([status, count]) => ({
        name: STATUS_LABELS[status as ObjectiveStatus],
        value: count,
        color: STATUS_COLORS[status as ObjectiveStatus],
      }))
    : [];

  // Check for empty state (AC5)
  if (!isLoading && summaryData?.totalStrategies === 0) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Strategy", href: "/strategy" },
          { label: "Dashboard" },
        ]}
      >
        <div className="container mx-auto py-8">
          <PageHeader
            eyebrow="STRATEGY"
            title="Strategy Dashboard"
            icon={<LayoutDashboard />}
            description="Executive overview of security strategy progress"
          />
          <EmptyState />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Strategy", href: "/strategy" },
        { label: "Dashboard" },
      ]}
    >
      <div className="container mx-auto py-8 space-y-6">
      {/* Header with filter (AC6) */}
      <PageHeader
        eyebrow="STRATEGY"
        title="Strategy Dashboard"
        icon={<LayoutDashboard />}
        description="Executive overview of security strategy progress"
        actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Strategy Filter (AC6 from Story 5.2) */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground/70" />
            <Select
              value={selectedStrategyId ?? "all"}
              onValueChange={(value) => setSelectedStrategyId(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Strategies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                {strategiesData?.strategies.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Selector (Story 5.4 AC1) */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
            <Select
              value={dateRangePreset}
              onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range Pickers (Story 5.4 AC3) */}
          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {customDateFrom ? format(customDateFrom, "MMM d, yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customDateFrom}
                    onSelect={setCustomDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {customDateTo ? format(customDateTo, "MMM d, yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customDateTo}
                    onSelect={setCustomDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        }
      />

      {/* Summary Cards (AC1) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-8 bg-muted rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Strategies"
            value={summaryData?.totalStrategies ?? 0}
            icon={Target}
            description="All security strategies"
          />
          <SummaryCard
            title="Active Strategies"
            value={summaryData?.activeStrategyCount ?? 0}
            icon={TrendingUp}
            description="Currently in progress"
            variant="success"
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <ProgressRing progress={summaryData?.averageProgress ?? 0} />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Across {summaryData?.activeStrategyCount ?? 0} active strategies
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <SummaryCard
            title="Overdue Objectives"
            value={overdueData?.total ?? 0}
            icon={AlertTriangle}
            description={overdueData?.total ? "Require attention" : "All on track"}
            variant={overdueData?.total ? "warning" : "default"}
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Bar Chart (AC2) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-[17px] w-[17px] text-primary" />
              Strategy Progress
            </CardTitle>
            <CardDescription>
              Progress of active strategies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {progressLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : progressData?.strategies.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No active strategies to display
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={progressData?.strategies}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={150}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      tickFormatter={(value: string) =>
                        value.length > 20 ? `${value.substring(0, 20)}...` : value
                      }
                    />
                    <Tooltip content={<BarChartTooltip />} />
                    <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                      {progressData?.strategies.map((entry, index) => (
                        <Cell key={index} fill={getProgressColor(entry.progress)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Pie Chart (AC3) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-[17px] w-[17px] text-primary" />
              Objectives by Status
            </CardTitle>
            <CardDescription>
              Distribution of objectives across statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : pieChartData.every((d) => d.value === 0) ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No objectives to display
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieChartData
                        .filter((d) => d.value > 0)
                        .map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<PieChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry) => (
                        <span className="text-sm text-muted-foreground">
                          {value} (<span className="font-mono tnum">{(entry.payload as { value: number }).value}</span>)
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Objectives Section (AC4) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-[17px] w-[17px] text-warning" />
                Overdue Objectives
              </CardTitle>
              <CardDescription>
                Objectives past their due date that need attention
              </CardDescription>
            </div>
            {overdueData && overdueData.total > 10 && (
              <Link href="/strategy">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {overdueLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : overdueData?.objectives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/70" />
              <p>No overdue objectives</p>
              <p className="text-sm">All objectives are on track!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueData?.objectives.map((objective) => (
                <OverdueObjectiveItem key={objective.id} objective={objective} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground/70" />
              <span className="text-sm text-muted-foreground">Total Goals</span>
            </div>
            <p className="text-2xl font-bold tnum text-foreground">{summaryData?.totalGoals ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground/70" />
              <span className="text-sm text-muted-foreground">Total Objectives</span>
            </div>
            <p className="text-2xl font-bold tnum text-foreground">{summaryData?.totalObjectives ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold tnum text-foreground">{statusData?.objectives.COMPLETED ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning" />
              <span className="text-sm text-muted-foreground">At Risk</span>
            </div>
            <p className="text-2xl font-bold tnum text-foreground">{statusData?.objectives.AT_RISK ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </AppLayout>
  );
}
