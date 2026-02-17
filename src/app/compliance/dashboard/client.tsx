"use client";

/**
 * Compliance Dashboard Client Component
 *
 * Story 5.1: Compliance Summary Dashboard (AC1-AC35)
 * Story 5.2: On-Demand Compliance Refresh Button (AC1-AC15)
 * Story 5.3: Automatic Compliance Updates (AC19-AC22)
 * Story 5.4: Open Risk Count and Recently Closed Risks Display (AC1-AC21)
 *
 * Client-side rendering for the compliance dashboard:
 * - Overview by selected compliance assessment/framework
 * - Filter by business unit for drill-down
 * - AC2: Shows framework coverage cards for all active frameworks
 * - AC5: Cards sortable by coverage or name
 * - AC6: Empty state for no active frameworks
 * - 5.2 AC4: Success toast shows "Coverage refreshed successfully" with timestamp
 * - 5.3 AC19-AC22: Dashboard subscribes to compliance coverage changes via polling
 * - 5.4 AC1-AC6: Open risk count with severity breakdown
 * - 5.4 AC7-AC12: Recently closed risks with days-to-close
 * - 5.4 AC13-AC17: Risk trend chart over 30 days
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.2: On-Demand Compliance Refresh Button
 * @see Story 5.3: Automatic Compliance Updates
 * @see Story 5.4: Open Risk Count and Recently Closed Risks Display
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Settings, AlertCircle, Shield, CheckCircle2, AlertTriangle, RefreshCw, FileText, ChevronRight, Clock, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { AppLayout } from "@/components/layout";
import { BusinessUnitSelector } from "@/components/compliance/BusinessUnitSelector";
import { AssessmentCard } from "@/components/compliance/AssessmentCard";
import { cn } from "@/lib/utils";

/**
 * Get color classes for compliance score
 */
function getScoreColorClasses(score: number) {
  if (score >= 90) {
    return {
      bg: "bg-green-100 dark:bg-green-950/50",
      text: "text-green-700 dark:text-green-400",
      ring: "ring-green-500/20",
      progress: "bg-green-500",
    };
  }
  if (score >= 70) {
    return {
      bg: "bg-yellow-100 dark:bg-yellow-950/50",
      text: "text-yellow-700 dark:text-yellow-400",
      ring: "ring-yellow-500/20",
      progress: "bg-yellow-500",
    };
  }
  return {
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500/20",
    progress: "bg-red-500",
  };
}

/**
 * Story 5.3 AC19-AC22: Polling interval for real-time updates
 * Dashboard polls for coverage updates every 10 seconds
 */
const POLLING_INTERVAL_MS = 10 * 1000;

export function ComplianceDashboardClient() {
  // Story 5.2 AC12-AC15: Track which framework is being refreshed
  const [refreshingFrameworkId, setRefreshingFrameworkId] = useState<string | null>(null);
  // Story 5.3 AC21: Track if data is being updated (for shimmer effect)
  const [isPollingUpdate, setIsPollingUpdate] = useState(false);
  // Track previous coverage values to detect changes
  const previousCoverageRef = useRef<Map<string, number>>(new Map());
  // BU-Scoped Compliance: Selected business unit filter (null = all BUs / org rollup)
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(null);
  // Selected framework for overview (null = show all frameworks summary)
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string | null>(null);
  // Assessment filter: "all" | "completed" | "in-progress"
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");

  // Fetch compliance summary data
  // Story 5.3 AC19-AC22: Dashboard subscribes to compliance coverage changes via polling
  // BU-Scoped Compliance: Pass selected business unit filter
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = api.compliance.getComplianceSummary.useQuery(
    { businessUnitId: selectedBusinessUnitId },
    {
      // AC19/AC20: Poll every 10 seconds for real-time updates
      refetchInterval: POLLING_INTERVAL_MS,
      // Continue polling even when window is not focused
      refetchIntervalInBackground: false,
    }
  );

  // Fetch completed assessments for the main grid
  const {
    data: completedAssessmentsData,
    isLoading: isLoadingCompletedAssessments,
    refetch: refetchCompletedAssessments,
    isRefetching: isRefetchingCompletedAssessments,
  } = api.complianceAssessment.getDashboardAssessments.useQuery({
    businessUnitId: selectedBusinessUnitId,
    limit: 12,
    statuses: ["COMPLETED"],
  });

  // Fetch in-progress assessments (IN_PROGRESS, IN_REVIEW)
  const {
    data: activeAssessmentsData,
    isLoading: isLoadingActiveAssessments,
    refetch: refetchActiveAssessments,
    isRefetching: isRefetchingActiveAssessments,
  } = api.complianceAssessment.getDashboardAssessments.useQuery({
    businessUnitId: selectedBusinessUnitId,
    limit: 12,
    statuses: ["IN_PROGRESS", "IN_REVIEW"],
  });

  // Story 5.3 AC20/AC21: Detect coverage changes and show subtle update effect
  useEffect(() => {
    if (!dashboardData?.frameworks) return;

    let hasChanges = false;
    const newCoverageMap = new Map<string, number>();

    for (const framework of dashboardData.frameworks) {
      const prevCoverage = previousCoverageRef.current.get(framework.frameworkId);
      newCoverageMap.set(framework.frameworkId, framework.coveragePercentage);

      // Detect if coverage changed (after initial load)
      if (
        prevCoverage !== undefined &&
        prevCoverage !== framework.coveragePercentage
      ) {
        hasChanges = true;
      }
    }

    previousCoverageRef.current = newCoverageMap;

    // Show brief shimmer effect when coverage updates
    if (hasChanges) {
      setIsPollingUpdate(true);
      setTimeout(() => setIsPollingUpdate(false), 500);
    }
  }, [dashboardData?.frameworks]);

  // Refresh mutation (Story 5.2: AC2-AC5)
  const refreshMutation = api.compliance.refreshAllCoverage.useMutation({
    onSuccess: (data) => {
      void refetch();
      // AC4: Success toast with timestamp
      const timestamp = new Date().toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      toast.success("Coverage refreshed successfully", {
        description: `${data.refreshedCount} framework(s) updated at ${timestamp}`,
      });
    },
    onError: (error) => {
      toast.error("Failed to refresh coverage", {
        description: error.message,
      });
    },
  });

  // Story 5.2 AC12-AC15: Per-framework refresh mutation
  const refreshFrameworkMutation = api.compliance.refreshFrameworkCoverage.useMutation({
    onSuccess: () => {
      void refetch();
      setRefreshingFrameworkId(null);
      toast.success("Framework coverage refreshed");
    },
    onError: (error) => {
      setRefreshingFrameworkId(null);
      toast.error("Failed to refresh coverage", {
        description: error.message,
      });
    },
  });

  // AC2, AC3: Handle refresh with loading state and disabled button
  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  // Story 5.2 AC12-AC15: Handle per-framework refresh
  const handleFrameworkRefresh = useCallback((frameworkId: string) => {
    setRefreshingFrameworkId(frameworkId);
    refreshFrameworkMutation.mutate({ frameworkId });
  }, [refreshFrameworkMutation]);

  // Auto-select first framework if none selected and frameworks exist
  const frameworks = dashboardData?.frameworks ?? [];
  useEffect(() => {
    if (!selectedFrameworkId && frameworks.length > 0) {
      setSelectedFrameworkId(frameworks[0]?.frameworkId ?? null);
    }
  }, [frameworks, selectedFrameworkId]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Dashboard" }]}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading dashboard</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load compliance data. Please try again."}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { summary } = dashboardData;

  // Get selected framework data
  const selectedFramework = selectedFrameworkId
    ? frameworks.find((f) => f.frameworkId === selectedFrameworkId)
    : null;

  const scoreColors = selectedFramework
    ? getScoreColorClasses(selectedFramework.coveragePercentage)
    : getScoreColorClasses(summary.overallScore);

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Dashboard" }]}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor framework coverage and compliance status
          </p>
        </div>
      </div>

      {/* Framework-Centric Overview Section */}
      {frameworks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No Active Frameworks</CardTitle>
            <CardDescription className="mb-4">
              Configure frameworks in settings to start tracking compliance.
            </CardDescription>
            <Button asChild>
              <Link href="/admin/frameworks/configure">
                Configure Frameworks
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Compliance Overview</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Framework Selector */}
                <Select
                  value={selectedFrameworkId ?? ""}
                  onValueChange={(value) => setSelectedFrameworkId(value)}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select Assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks.map((fw) => (
                      <SelectItem key={fw.frameworkId} value={fw.frameworkId}>
                        {fw.frameworkCode} - {fw.frameworkName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Business Unit Filter */}
                <BusinessUnitSelector
                  value={selectedBusinessUnitId}
                  onChange={setSelectedBusinessUnitId}
                  className="w-[200px]"
                />

                {/* Refresh Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefetching || refreshMutation.isPending}
                  className="gap-1"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", (isRefetching || refreshMutation.isPending) && "animate-spin")}
                  />
                  Refresh
                </Button>
              </div>
            </div>
            <CardDescription>
              Last updated:{" "}
              {new Date(selectedFramework?.lastUpdated ?? summary.lastUpdated).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedFramework ? (
              /* Selected Framework Overview */
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* Compliance Score */}
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center p-6 rounded-lg ring-1",
                      scoreColors.bg,
                      scoreColors.ring
                    )}
                  >
                    <span className={cn("text-5xl font-bold", scoreColors.text)}>
                      {selectedFramework.coveragePercentage.toFixed(1)}%
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      Compliance Score
                    </span>
                  </div>

                  {/* Controls Satisfied */}
                  <div className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-semibold">
                          {selectedFramework.satisfiedControlsCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Controls Satisfied
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Controls */}
                  <div className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-2xl font-semibold">
                          {selectedFramework.totalControlsCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total Controls
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gaps */}
                  <div className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/50">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-semibold">
                          {selectedFramework.totalControlsCount - selectedFramework.satisfiedControlsCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Gaps to Address
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coverage Progress</span>
                    <span className="font-medium">
                      {selectedFramework.satisfiedControlsCount} / {selectedFramework.totalControlsCount} controls
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-500", scoreColors.progress)}
                      style={{ width: `${selectedFramework.coveragePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/frameworks/${selectedFramework.frameworkId}`}>
                      View Framework Details
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/frameworks/${selectedFramework.frameworkId}/gaps`}>
                      View Gaps Analysis
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFrameworkRefresh(selectedFramework.frameworkId)}
                    disabled={refreshingFrameworkId === selectedFramework.frameworkId}
                  >
                    {refreshingFrameworkId === selectedFramework.frameworkId ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      "Refresh Coverage"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* No framework selected - show summary */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-lg ring-1",
                    scoreColors.bg,
                    scoreColors.ring
                  )}
                >
                  <span className={cn("text-5xl font-bold", scoreColors.text)}>
                    {summary.overallScore.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Overall Score
                  </span>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-2xl font-semibold">{summary.totalFrameworks}</div>
                  <div className="text-sm text-muted-foreground">Total Frameworks</div>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-2xl font-semibold text-green-600">{summary.readyForAudit}</div>
                  <div className="text-sm text-muted-foreground">Ready for Audit (≥90%)</div>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-2xl font-semibold text-red-600">{summary.needsAttention}</div>
                  <div className="text-sm text-muted-foreground">Needs Attention (&lt;70%)</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assessments Section with Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Compliance Assessments</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refetchCompletedAssessments();
                void refetchActiveAssessments();
              }}
              disabled={isRefetchingCompletedAssessments || isRefetchingActiveAssessments}
              className="gap-1"
            >
              <RefreshCw
                className={cn("h-4 w-4", (isRefetchingCompletedAssessments || isRefetchingActiveAssessments) && "animate-spin")}
              />
              Refresh
            </Button>
            <Link href="/compliance/assessments">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={assessmentFilter} onValueChange={setAssessmentFilter} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              All
              {completedAssessmentsData?.summary && activeAssessmentsData?.summary && (
                <span className="text-xs text-muted-foreground">
                  ({(completedAssessmentsData.summary.completed || 0) + (activeAssessmentsData.summary.inProgress || 0) + (activeAssessmentsData.summary.inReview || 0)})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="gap-2">
              <Clock className="h-3.5 w-3.5" />
              In Progress
              {activeAssessmentsData?.summary && (
                <span className="text-xs text-muted-foreground">
                  ({(activeAssessmentsData.summary.inProgress || 0) + (activeAssessmentsData.summary.inReview || 0)})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
              {completedAssessmentsData?.summary && (
                <span className="text-xs text-muted-foreground">
                  ({completedAssessmentsData.summary.completed || 0})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* All Assessments Tab */}
          <TabsContent value="all" className="mt-4">
            {isLoadingCompletedAssessments || isLoadingActiveAssessments ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-6">
                      <Skeleton className="h-4 w-32 mb-4" />
                      <Skeleton className="h-10 w-24 mb-4" />
                      <Skeleton className="h-2 w-full rounded-full mb-4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {((activeAssessmentsData?.assessments?.length || 0) + (completedAssessmentsData?.assessments?.length || 0)) > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Show in-progress first, then completed */}
                    {activeAssessmentsData?.assessments?.map((assessment) => (
                      <AssessmentCard
                        key={assessment.id}
                        id={assessment.id}
                        identifier={assessment.identifier}
                        name={assessment.name}
                        status={assessment.status}
                        frameworkName={assessment.framework.name}
                        frameworkCode={assessment.framework.code}
                        businessUnitName={assessment.businessUnit?.name}
                        businessUnitCode={assessment.businessUnit?.code}
                        totalControls={assessment.totalControls}
                        notAssessedCount={assessment.notAssessedCount}
                        compliantCount={assessment.compliantCount}
                        nonCompliantCount={assessment.nonCompliantCount}
                        partialCount={assessment.partialCount}
                        complianceScore={assessment.complianceScore ? Number(assessment.complianceScore) : null}
                        ownerName={assessment.owner.name}
                        createdAt={assessment.createdAt}
                        dueDate={assessment.dueDate}
                      />
                    ))}
                    {completedAssessmentsData?.assessments?.map((assessment) => (
                      <AssessmentCard
                        key={assessment.id}
                        id={assessment.id}
                        identifier={assessment.identifier}
                        name={assessment.name}
                        status={assessment.status}
                        frameworkName={assessment.framework.name}
                        frameworkCode={assessment.framework.code}
                        businessUnitName={assessment.businessUnit?.name}
                        businessUnitCode={assessment.businessUnit?.code}
                        totalControls={assessment.totalControls}
                        notAssessedCount={assessment.notAssessedCount}
                        compliantCount={assessment.compliantCount}
                        nonCompliantCount={assessment.nonCompliantCount}
                        partialCount={assessment.partialCount}
                        complianceScore={assessment.complianceScore ? Number(assessment.complianceScore) : null}
                        ownerName={assessment.owner.name}
                        createdAt={assessment.createdAt}
                        dueDate={assessment.dueDate}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <CardTitle className="mb-2">No Assessments</CardTitle>
                      <CardDescription className="mb-4">
                        Start a compliance assessment to track your progress against a framework.
                      </CardDescription>
                      <Button asChild>
                        <Link href="/compliance/assessments">
                          Create Assessment
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* In Progress Tab */}
          <TabsContent value="in-progress" className="mt-4">
            {isLoadingActiveAssessments ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-6">
                      <Skeleton className="h-4 w-32 mb-4" />
                      <Skeleton className="h-10 w-24 mb-4" />
                      <Skeleton className="h-2 w-full rounded-full mb-4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activeAssessmentsData?.assessments && activeAssessmentsData.assessments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeAssessmentsData.assessments.map((assessment) => (
                  <AssessmentCard
                    key={assessment.id}
                    id={assessment.id}
                    identifier={assessment.identifier}
                    name={assessment.name}
                    status={assessment.status}
                    frameworkName={assessment.framework.name}
                    frameworkCode={assessment.framework.code}
                    businessUnitName={assessment.businessUnit?.name}
                    businessUnitCode={assessment.businessUnit?.code}
                    totalControls={assessment.totalControls}
                    notAssessedCount={assessment.notAssessedCount}
                    compliantCount={assessment.compliantCount}
                    nonCompliantCount={assessment.nonCompliantCount}
                    partialCount={assessment.partialCount}
                    complianceScore={assessment.complianceScore ? Number(assessment.complianceScore) : null}
                    ownerName={assessment.owner.name}
                    createdAt={assessment.createdAt}
                    dueDate={assessment.dueDate}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No In Progress Assessments</CardTitle>
                  <CardDescription className="mb-4">
                    Start a compliance assessment to track your progress against a framework.
                  </CardDescription>
                  <Button asChild>
                    <Link href="/compliance/assessments">
                      Create Assessment
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="mt-4">
            {isLoadingCompletedAssessments ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-6">
                      <Skeleton className="h-4 w-32 mb-4" />
                      <Skeleton className="h-10 w-24 mb-4" />
                      <Skeleton className="h-2 w-full rounded-full mb-4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : completedAssessmentsData?.assessments && completedAssessmentsData.assessments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedAssessmentsData.assessments.map((assessment) => (
                  <AssessmentCard
                    key={assessment.id}
                    id={assessment.id}
                    identifier={assessment.identifier}
                    name={assessment.name}
                    status={assessment.status}
                    frameworkName={assessment.framework.name}
                    frameworkCode={assessment.framework.code}
                    businessUnitName={assessment.businessUnit?.name}
                    businessUnitCode={assessment.businessUnit?.code}
                    totalControls={assessment.totalControls}
                    notAssessedCount={assessment.notAssessedCount}
                    compliantCount={assessment.compliantCount}
                    nonCompliantCount={assessment.nonCompliantCount}
                    partialCount={assessment.partialCount}
                    complianceScore={assessment.complianceScore ? Number(assessment.complianceScore) : null}
                    ownerName={assessment.owner.name}
                    createdAt={assessment.createdAt}
                    dueDate={assessment.dueDate}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Completed Assessments</CardTitle>
                  <CardDescription>
                    Completed compliance assessments will appear here.
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

    </AppLayout>
  );
}

/**
 * Loading skeleton for dashboard
 */
function DashboardSkeleton() {
  return (
    <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Dashboard" }]}>
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <Card>
          <CardContent className="py-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-10 w-24 mb-4" />
                <Skeleton className="h-2 w-full rounded-full mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
