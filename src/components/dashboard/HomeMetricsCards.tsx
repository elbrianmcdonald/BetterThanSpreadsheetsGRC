"use client";

/**
 * Home Page Metrics Cards
 *
 * Dashboard metrics component showing key GRC stats:
 * - Open risks count
 * - Open findings count
 * - Framework coverage average
 */

import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeMetricsCards() {
  // Fetch risk stats
  const { data: complianceData, isLoading: isComplianceLoading } =
    api.compliance.getComplianceSummary.useQuery({});

  // Fetch findings stats
  const { data: findingStats, isLoading: isFindingLoading } =
    api.finding.getStats.useQuery();

  const openRisksCount = complianceData?.riskMetrics?.openRisksCount ?? 0;
  const openFindingsCount = findingStats?.openCount ?? 0;
  const avgCoverage =
    complianceData?.frameworks && complianceData.frameworks.length > 0
      ? Math.round(
          complianceData.frameworks.reduce(
            (sum, f) => sum + f.coveragePercentage,
            0
          ) / complianceData.frameworks.length
        )
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Open Risks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Open Risks
          </CardTitle>
          <ShieldAlert className="h-5 w-5 text-red-500" />
        </CardHeader>
        <CardContent>
          {isComplianceLoading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <div className="text-3xl font-bold">{openRisksCount}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Requiring attention
          </p>
          <Link
            href="/risks?status=OPEN,ASSIGNED"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
          >
            View Risks
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </CardContent>
      </Card>

      {/* Open Findings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Open Findings
          </CardTitle>
          <AlertTriangle className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          {isFindingLoading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <div className="text-3xl font-bold">{openFindingsCount}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Awaiting triage
          </p>
          <Link
            href="/findings?status=NEW,NEEDS_INFO,TRIAGED"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
          >
            View Findings
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </CardContent>
      </Card>

      {/* Compliance Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Avg. Compliance
          </CardTitle>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          {isComplianceLoading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <div className="text-3xl font-bold">{avgCoverage}%</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Framework coverage
          </p>
          <Link
            href="/compliance/dashboard"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
          >
            View Dashboard
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
