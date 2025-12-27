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
import { LayoutGrid, Settings, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout";
import { ComplianceSummaryWidget } from "@/components/compliance/ComplianceSummaryWidget";
import { FrameworkCoverageCard } from "@/components/compliance/FrameworkCoverageCard";
import { RiskMetricsWidget } from "@/components/compliance/RiskMetricsWidget";
import { RiskTrendChart } from "@/components/compliance/RiskTrendChart";
import { VelocityWidget } from "@/components/compliance/VelocityWidget";
import { VelocityTrendChart } from "@/components/compliance/VelocityTrendChart";

type SortOption = "coverage-desc" | "coverage-asc" | "name-asc" | "name-desc";

/**
 * Story 5.3 AC19-AC22: Polling interval for real-time updates
 * Dashboard polls for coverage updates every 10 seconds
 */
const POLLING_INTERVAL_MS = 10 * 1000;

export function ComplianceDashboardClient() {
  const [sortBy, setSortBy] = useState<SortOption>("coverage-desc");
  // Story 5.2 AC12-AC15: Track which framework is being refreshed
  const [refreshingFrameworkId, setRefreshingFrameworkId] = useState<string | null>(null);
  // Story 5.3 AC21: Track if data is being updated (for shimmer effect)
  const [isPollingUpdate, setIsPollingUpdate] = useState(false);
  // Track previous coverage values to detect changes
  const previousCoverageRef = useRef<Map<string, number>>(new Map());

  // Fetch compliance summary data
  // Story 5.3 AC19-AC22: Dashboard subscribes to compliance coverage changes via polling
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = api.compliance.getComplianceSummary.useQuery(undefined, {
    // AC19/AC20: Poll every 10 seconds for real-time updates
    refetchInterval: POLLING_INTERVAL_MS,
    // Continue polling even when window is not focused
    refetchIntervalInBackground: false,
  });

  // Story 5.4 AC13-AC17: Fetch risk trend data for chart
  const {
    data: riskTrendData,
    isLoading: isRiskTrendLoading,
  } = api.compliance.getRiskTrend.useQuery(undefined, {
    // Poll at same interval for consistency
    refetchInterval: POLLING_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // Story 5.8 AC1-AC6: Fetch remediation velocity data
  const {
    data: velocityData,
    isLoading: isVelocityLoading,
  } = api.compliance.getRemediationVelocity.useQuery(
    { timeframeDays: 90 },
    {
      refetchInterval: POLLING_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }
  );

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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Compliance Dashboard" }]}>
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

  const { summary, frameworks, riskMetrics } = dashboardData;

  // Sort frameworks based on selected option (AC5)
  const sortedFrameworks = [...frameworks].sort((a, b) => {
    switch (sortBy) {
      case "coverage-desc":
        return b.coveragePercentage - a.coveragePercentage;
      case "coverage-asc":
        return a.coveragePercentage - b.coveragePercentage;
      case "name-asc":
        return a.frameworkName.localeCompare(b.frameworkName);
      case "name-desc":
        return b.frameworkName.localeCompare(a.frameworkName);
      default:
        return 0;
    }
  });

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance Dashboard" }]}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor framework coverage and compliance status
          </p>
        </div>
      </div>

      {/* Summary Widget */}
      <ComplianceSummaryWidget
        overallScore={summary.overallScore}
        totalFrameworks={summary.totalFrameworks}
        readyForAudit={summary.readyForAudit}
        needsAttention={summary.needsAttention}
        lastUpdated={summary.lastUpdated}
        isRefreshing={isRefetching || refreshMutation.isPending}
        onRefresh={handleRefresh}
      />

      {/* Framework Coverage Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Framework Coverage</h2>
          </div>

          {/* Sort Dropdown (AC5) */}
          {frameworks.length > 1 && (
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coverage-desc">Coverage (High to Low)</SelectItem>
                <SelectItem value="coverage-asc">Coverage (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Empty State (AC6) */}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedFrameworks.map((framework) => (
              <FrameworkCoverageCard
                key={framework.frameworkId}
                frameworkId={framework.frameworkId}
                frameworkCode={framework.frameworkCode}
                frameworkName={framework.frameworkName}
                frameworkVersion={framework.frameworkVersion}
                coveragePercentage={framework.coveragePercentage}
                satisfiedControlsCount={framework.satisfiedControlsCount}
                totalControlsCount={framework.totalControlsCount}
                lastUpdated={framework.lastUpdated}
                trend={framework.trend}
                coverageLevel={framework.coverageLevel}
                onRefresh={() => handleFrameworkRefresh(framework.frameworkId)}
                isRefreshing={refreshingFrameworkId === framework.frameworkId}
                hasJustUpdated={isPollingUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Risk Metrics Section - Story 5.4 AC1-AC12 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Risk Overview</h2>
        <RiskMetricsWidget
          openRisksCount={riskMetrics.openRisksCount}
          severityDistribution={riskMetrics.severityDistribution}
          recentlyClosed={riskMetrics.recentlyClosed}
        />
      </div>

      {/* Risk Trend Chart - Story 5.4 AC13-AC17 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Risk Trend</h2>
        {isRiskTrendLoading ? (
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        ) : riskTrendData ? (
          <RiskTrendChart
            dailyOpenCounts={riskTrendData.dailyOpenCounts}
            weeklyClosedCounts={riskTrendData.weeklyClosedCounts}
          />
        ) : null}
      </div>

      {/* Remediation Velocity - Story 5.8 AC1-AC6 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Remediation Velocity</h2>
        {isVelocityLoading ? (
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ) : velocityData ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <VelocityWidget
              overall={velocityData.overall}
              bySeverity={velocityData.bySeverity}
              comparison={velocityData.comparison}
              closedRisksCount={velocityData.closedRisksCount}
              timeframeDays={velocityData.timeframeDays}
            />
            <VelocityTrendChart
              data={velocityData.trend}
              showBenchmarks={true}
            />
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

/**
 * Loading skeleton for dashboard
 */
function DashboardSkeleton() {
  return (
    <AppLayout breadcrumbs={[{ label: "Compliance Dashboard" }]}>
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
