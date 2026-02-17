"use client";

/**
 * Risk Dashboard Client Component
 *
 * Displays risk metrics, trends, and analytics including:
 * - Risk Trend Chart (30-day open risks with weekly closures)
 * - Risk Severity Heatmap (likelihood vs impact)
 * - Summary Cards (total, high severity, open, remediated)
 * - Remediation Velocity Widget and Trend Chart
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Clock,
  CheckCircle,
  BarChart3,
  ArrowRight,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout";
import { RiskTrendChart } from "@/components/compliance/RiskTrendChart";
import { RiskHeatmap } from "@/components/compliance/RiskHeatmap";
import { VelocityWidget } from "@/components/compliance/VelocityWidget";
import { VelocityTrendChart } from "@/components/compliance/VelocityTrendChart";
import { RiskMetricsWidget } from "@/components/compliance/RiskMetricsWidget";
import { SLAStatusWidget } from "@/components/compliance/SLAStatusWidget";

export function RiskDashboardClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Risk Trend data for chart
  const {
    data: riskTrendData,
    isLoading: isRiskTrendLoading,
  } = api.compliance.getRiskTrend.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Remediation Velocity data
  const {
    data: velocityData,
    isLoading: isVelocityLoading,
  } = api.compliance.getRemediationVelocity.useQuery(
    { timeframeDays: 90 },
    {
      refetchInterval: 60000,
    }
  );

  // Risk Metrics data (open risks, severity distribution, recently closed)
  const {
    data: riskMetricsData,
    isLoading: isRiskMetricsLoading,
  } = api.compliance.getRiskMetrics.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Loading state - include isMounted check to prevent hydration mismatch
  if (!isMounted || sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk Dashboard" }]} fullWidth>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Calculate counts from risk metrics data (more accurate - no discoveryStatus filter)
  const openCount = riskMetricsData?.openRisksCount ?? 0;
  const highSeverityCount = riskMetricsData?.severityDistribution?.HIGH ?? 0;
  const mediumSeverityCount = riskMetricsData?.severityDistribution?.MEDIUM ?? 0;
  const lowSeverityCount = riskMetricsData?.severityDistribution?.LOW ?? 0;
  const totalRisks = openCount + (riskMetricsData?.recentlyClosed?.length ?? 0);
  const remediatedCount = riskMetricsData?.recentlyClosed?.length ?? 0;

  return (
    <AppLayout breadcrumbs={[{ label: "Risk Dashboard" }]} fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Risk Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Monitor risk metrics, trends, and remediation velocity.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button asChild>
              <Link href="/risks">
                <ShieldAlert className="h-4 w-4 mr-2" />
                View Risk Register
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Risks</p>
                  {isRiskMetricsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-semibold">{totalRisks}</p>
                  )}
                </div>
                <ShieldAlert className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">High Severity</p>
                  {isRiskMetricsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-semibold text-red-600">{highSeverityCount}</p>
                  )}
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Open</p>
                  {isRiskMetricsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-semibold text-blue-600">{openCount}</p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Remediated</p>
                  {isRiskMetricsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-semibold text-green-600">{remediatedCount}</p>
                  )}
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Overview - Open Risks & SLA Status */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Risk Overview</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {isRiskMetricsLoading ? (
                <Card>
                  <CardContent className="py-6">
                    <Skeleton className="h-[200px] w-full" />
                  </CardContent>
                </Card>
              ) : riskMetricsData ? (
                <RiskMetricsWidget
                  openRisksCount={riskMetricsData.openRisksCount}
                  severityDistribution={riskMetricsData.severityDistribution}
                  recentlyClosed={riskMetricsData.recentlyClosed}
                />
              ) : null}
            </div>
            <SLAStatusWidget />
          </div>
        </div>

        {/* Risk Severity Heatmap */}
        <RiskHeatmap />

        {/* Remediation Velocity */}
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

        {/* Risk Trend Chart */}
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
      </div>
    </AppLayout>
  );
}
