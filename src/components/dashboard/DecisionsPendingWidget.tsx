"use client";

/**
 * Decisions Pending Dashboard Widget (Business Stakeholder)
 *
 * Displays a summary of risks requiring business decisions.
 *
 * Story 4.9: Role-Based Risk Views - Dashboard Widgets (AC29-AC33)
 * AC31: BUSINESS_STAKEHOLDER sees "Risks Requiring Decision" dashboard widget
 * AC32: Widget shows count of pending decisions, highest impact risk, overdue decisions
 * AC33: Clicking widget navigates to filtered risk list
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import Link from "next/link";
import {
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Gauge,
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
import { Badge } from "@/components/ui/badge";

/** Impact score color based on value */
function getImpactScoreColor(score: number): string {
  if (score >= 75) return "text-red-600";
  if (score >= 50) return "text-amber-600";
  if (score >= 25) return "text-yellow-600";
  return "text-green-600";
}

interface DecisionsPendingWidgetProps {
  className?: string;
}

/**
 * Dashboard widget for Business Stakeholders showing risks pending their decision.
 *
 * @example
 * ```tsx
 * <DecisionsPendingWidget />
 * ```
 */
export function DecisionsPendingWidget({ className }: DecisionsPendingWidgetProps) {
  const { data, isLoading, error } = api.risk.getDecisionsSummary.useQuery();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Decisions Pending
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
            <FileText className="h-5 w-5" />
            Decisions Pending
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm text-muted-foreground">
            Unable to load decisions summary
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasDecisions = data && data.totalPending > 0;
  const hasOverdue = data && data.overdueCount > 0;

  return (
    <Card className={`${className} ${hasOverdue ? "border-amber-200" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Decisions Pending
          </CardTitle>
          {hasOverdue && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              {data.overdueCount} Overdue
            </Badge>
          )}
        </div>
        <CardDescription>
          Risks requiring your business decision
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasDecisions ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Total Pending */}
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {data.totalPending}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pending Decisions
              </div>
            </div>

            {/* Highest Impact */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${getImpactScoreColor(data.highestImpactScore)}`}>
                {data.highestImpactScore}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Gauge className="h-3 w-3" />
                Highest Impact
              </div>
            </div>

            {/* Overdue */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${data.overdueCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {data.overdueCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Overdue
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No decisions pending
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link href="/risks/decisions">
            {hasDecisions ? "Review Pending Decisions" : "View Decision History"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
