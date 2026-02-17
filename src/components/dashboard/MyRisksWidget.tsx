"use client";

/**
 * My Assigned Risks Dashboard Widget (IT Stakeholder)
 *
 * Displays a summary of risks assigned to the current IT Stakeholder.
 *
 * Story 4.9: Role-Based Risk Views - Dashboard Widgets (AC29-AC33)
 * AC29: IT_STAKEHOLDER sees "My Assigned Risks" dashboard widget on home page
 * AC30: Widget shows count of open risks, average impact score, oldest assigned risk
 * AC33: Clicking widget navigates to filtered risk list
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  Clock,
  Gauge,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

/** Impact score color based on value */
function getImpactScoreColor(score: number): string {
  if (score >= 75) return "text-red-600";
  if (score >= 50) return "text-amber-600";
  if (score >= 25) return "text-yellow-600";
  return "text-green-600";
}

interface MyRisksWidgetProps {
  className?: string;
}

/**
 * Dashboard widget for IT Stakeholders showing their assigned risks summary.
 *
 * @example
 * ```tsx
 * <MyRisksWidget />
 * ```
 */
export function MyRisksWidget({ className }: MyRisksWidgetProps) {
  const { data, isLoading, error } = api.risk.getMyRisksSummary.useQuery();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            My Assigned Risks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            My Assigned Risks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm text-muted-foreground">
            Unable to load risk summary
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasRisks = data && data.totalAssigned > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          My Assigned Risks
        </CardTitle>
        <CardDescription>
          Risks assigned to you for technical remediation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasRisks ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Total Assigned */}
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {data.totalAssigned}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Assigned Risks
              </div>
            </div>

            {/* Average Impact Score */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${getImpactScoreColor(data.avgImpactScore)}`}>
                {Math.round(data.avgImpactScore)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Gauge className="h-3 w-3" />
                Avg Impact
              </div>
            </div>

            {/* Oldest Risk */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${data.oldestRiskDays > 30 ? "text-red-600" : data.oldestRiskDays > 14 ? "text-amber-600" : "text-green-600"}`}>
                {data.oldestRiskDays}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Days Oldest
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <ShieldAlert className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No risks currently assigned to you
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link href="/risks/my-risks">
            {hasRisks ? "View All Assigned Risks" : "View Risk Queue"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
