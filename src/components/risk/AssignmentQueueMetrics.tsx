"use client";

/**
 * Assignment Queue Metrics Component (Story 4.13)
 *
 * Displays summary metrics for the assignment queue including:
 * - Total unassigned count
 * - Highest impact score
 * - Average days unassigned
 * - Count by severity
 * - Aging risks indicator
 *
 * AC8: Queue page shows summary metrics at top
 * AC9: Metrics include all specified data points
 * AC10: Metrics update in real-time when risks assigned
 * AC11: Metrics highlight risks >7 days unassigned
 * AC12: Metrics color-coded (red >7 days, yellow >3 days, green <3 days)
 */

import { Loader2, AlertTriangle, TrendingUp, Clock, Target, AlertCircle } from "lucide-react";
import Link from "next/link";

import { api } from "@/trpc/react";
import { Card, CardContent } from "@/components/ui/card";

export function AssignmentQueueMetrics() {
  const { data, isLoading, error } = api.risk.getAssignmentQueueMetrics.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60 seconds (AC10)
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Failed to load metrics
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
      {/* Total Unassigned (AC9) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unassigned</p>
              <p className="text-2xl font-semibold">{data.totalUnassigned}</p>
            </div>
            <Target className="h-8 w-8 text-blue-400" />
          </div>
        </CardContent>
      </Card>

      {/* Highest Impact (AC9) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Highest Impact</p>
              <p className={`text-2xl font-semibold ${
                data.highestImpact >= 75
                  ? "text-red-600"
                  : data.highestImpact >= 50
                  ? "text-amber-600"
                  : data.highestImpact >= 25
                  ? "text-yellow-600"
                  : "text-green-600"
              }`}>
                {data.highestImpact}
              </p>
              {data.highestImpactRisk && (
                <Link
                  href={`/risks/${data.highestImpactRisk.id}`}
                  className="text-xs text-gray-400 hover:text-gray-600 truncate block max-w-[120px]"
                  title={data.highestImpactRisk.title}
                >
                  {data.highestImpactRisk.title}
                </Link>
              )}
            </div>
            <TrendingUp className="h-8 w-8 text-amber-400" />
          </div>
        </CardContent>
      </Card>

      {/* Average Days Unassigned (AC9) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Days Open</p>
              <p className="text-2xl font-semibold">
                {data.avgDaysUnassigned.toFixed(1)}
              </p>
            </div>
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Severity Breakdown (AC9) */}
      <Card>
        <CardContent className="pt-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">By Severity</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-medium">{data.severityCounts.HIGH}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-medium">{data.severityCounts.MEDIUM}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium">{data.severityCounts.LOW}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aging Risks (AC11, AC12) */}
      <Card className={data.agingRisks > 0 ? "border-red-200 bg-red-50" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Aging (&gt;7 days)</p>
              <p className={`text-2xl font-semibold ${
                data.agingRisks > 0 ? "text-red-600" : "text-green-600"
              }`}>
                {data.agingRisks}
              </p>
              {/* Color breakdown (AC12) */}
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="text-red-600" title=">7 days">
                  {data.agingRisks}
                </span>
                <span className="text-gray-300">/</span>
                <span className="text-amber-600" title="3-7 days">
                  {data.risksOver3Days}
                </span>
                <span className="text-gray-300">/</span>
                <span className="text-green-600" title="<3 days">
                  {data.risksUnder3Days}
                </span>
              </div>
            </div>
            <AlertCircle className={`h-8 w-8 ${
              data.agingRisks > 0 ? "text-red-400" : "text-green-400"
            }`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
