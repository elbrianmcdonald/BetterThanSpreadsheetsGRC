"use client";

/**
 * Risk Assessment Backlog Widget Component (Story 4.13)
 *
 * Dashboard widget showing assignment queue summary for GRC Analysts.
 *
 * AC29: GRC Analyst home dashboard shows "Risk Assessment Backlog" widget
 * AC30: Widget displays: Total unassigned count, Highest impact risk preview, Aging risks count
 * AC31: Widget has "View Queue" button linking to /risks/assignment-queue
 * AC32: Widget updates in real-time (refresh every 60 seconds)
 */

import Link from "next/link";
import { Loader2, ClipboardList, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AssignmentQueueWidget() {
  // Fetch metrics with 60-second refresh (AC32)
  const { data, isLoading, error } = api.risk.getAssignmentQueueMetrics.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Risk Assessment Backlog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Risk Assessment Backlog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Failed to load queue data
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className={data.agingRisks > 0 ? "border-red-200" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Risk Assessment Backlog
          {data.agingRisks > 0 && (
            <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
              Needs Attention
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Unassigned (AC30) */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Unassigned Risks</span>
            <span className="text-2xl font-bold">{data.totalUnassigned}</span>
          </div>

          {/* Highest Impact Risk Preview (AC30) */}
          {data.highestImpactRisk && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <TrendingUp className="h-4 w-4" />
                Highest Impact
              </div>
              <Link
                href={`/risks/${data.highestImpactRisk.id}`}
                className="text-sm font-medium hover:underline line-clamp-1"
              >
                {data.highestImpactRisk.title}
              </Link>
              <div className={`text-lg font-bold mt-1 ${
                data.highestImpact >= 75
                  ? "text-red-600"
                  : data.highestImpact >= 50
                  ? "text-amber-600"
                  : "text-green-600"
              }`}>
                Score: {data.highestImpact}
              </div>
            </div>
          )}

          {/* Aging Risks (AC30) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${
                data.agingRisks > 0 ? "text-red-500" : "text-green-500"
              }`} />
              <span className="text-sm text-gray-500">Aging (&gt;7 days)</span>
            </div>
            <span className={`text-lg font-bold ${
              data.agingRisks > 0 ? "text-red-600" : "text-green-600"
            }`}>
              {data.agingRisks}
            </span>
          </div>

          {/* View Queue Button (AC31) */}
          <Button asChild className="w-full" variant={data.totalUnassigned > 0 ? "default" : "outline"}>
            <Link href="/risks/assignment-queue">
              View Backlog
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
