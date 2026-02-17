"use client";

/**
 * Risk Metrics Widget Component
 *
 * Story 5.1: Compliance Summary Dashboard (AC13-AC17)
 * Story 5.4: Open Risk Count and Recently Closed Risks Display (AC1-AC12)
 *
 * Displays risk metrics for the dashboard:
 * - AC1: Dashboard displays total open risks (status OPEN or ASSIGNED)
 * - AC2: Open risks broken down by severity with color-coded badges
 * - AC3: Severity distribution shown as horizontal bar chart
 * - AC4: Clicking open risk count navigates to filtered risk list
 * - AC5: Open risk count updates in real-time when risks created or closed
 * - AC6: Empty state: "No open risks. Excellent work!"
 * - AC7: Dashboard shows last 10 recently closed risks
 * - AC8: Each closed risk displays: title, closed date, days-to-close, closed by
 * - AC9: Days-to-close calculated as: closedAt - createdAt (in days)
 * - AC10: Closed risks ordered by closedAt DESC (newest first)
 * - AC11: Clicking closed risk title navigates to risk detail page
 * - AC12: Empty state: "No recently closed risks"
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.4: Open Risk Count and Recently Closed Risks Display
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle,
  Info,
  User,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isValid } from "date-fns";

/**
 * Safely format a date as relative time
 */
function safeFormatDistanceToNow(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (!isValid(dateObj)) return "Unknown";
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// Severity type for type safety
type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface RiskMetricsWidgetProps {
  openRisksCount: number;
  severityDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  recentlyClosed: Array<{
    id: string;
    title: string;
    severity: Severity; // Story 5.4: Added for display
    closedAt: Date;
    daysToClose: number;
    closedByName: string | null; // Story 5.4 AC8: Who closed the risk
  }>;
}

/**
 * Simple bar chart for severity distribution (AC16)
 */
function SeverityDistributionChart({
  distribution,
}: {
  distribution: { HIGH: number; MEDIUM: number; LOW: number };
}) {
  const total = distribution.HIGH + distribution.MEDIUM + distribution.LOW;

  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No open risks
      </div>
    );
  }

  const percentages = {
    HIGH: Math.round((distribution.HIGH / total) * 100),
    MEDIUM: Math.round((distribution.MEDIUM / total) * 100),
    LOW: Math.round((distribution.LOW / total) * 100),
  };

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-muted">
        {distribution.HIGH > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${percentages.HIGH}%` }}
          />
        )}
        {distribution.MEDIUM > 0 && (
          <div
            className="bg-yellow-500 transition-all"
            style={{ width: `${percentages.MEDIUM}%` }}
          />
        )}
        {distribution.LOW > 0 && (
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${percentages.LOW}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-muted-foreground">High</span>
          <span className="font-medium">{distribution.HIGH}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">Medium</span>
          <span className="font-medium">{distribution.MEDIUM}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Low</span>
          <span className="font-medium">{distribution.LOW}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Severity badge component
 */
function SeverityBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  const variants = {
    HIGH: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
    LOW: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  };

  const icons = {
    HIGH: AlertCircle,
    MEDIUM: AlertTriangle,
    LOW: Info,
  };

  const Icon = icons[severity];

  return (
    <Badge variant="secondary" className={cn("gap-1", variants[severity])}>
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}

export function RiskMetricsWidget({
  openRisksCount,
  severityDistribution,
  recentlyClosed,
}: RiskMetricsWidgetProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Open Risks Card - Story 5.4 AC1-AC6 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">Open Risks</CardTitle>
            </div>
            {/* AC4: Button navigates to filtered risk list */}
            <Button asChild variant="ghost" size="sm">
              <Link href="/risks?status=OPEN,ASSIGNED">
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
          <CardDescription>
            Risks with status Open or Assigned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* AC6: Empty state when no open risks */}
          {openRisksCount === 0 ? (
            <div className="text-center py-6">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-semibold text-green-600">No open risks!</p>
              <p className="text-sm text-muted-foreground mt-1">Excellent work!</p>
            </div>
          ) : (
            <>
              {/* AC4: Clickable count navigates to filtered list */}
              <Link href="/risks?status=OPEN,ASSIGNED" className="block mb-4 group">
                <div className="text-4xl font-bold group-hover:text-primary transition-colors cursor-pointer">
                  {openRisksCount}
                </div>
              </Link>
              {/* AC2, AC3: Severity breakdown with color-coded badges and bar chart */}
              <SeverityDistributionChart distribution={severityDistribution} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Recently Closed Card - Story 5.4 AC7-AC12 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">Recently Closed</CardTitle>
          </div>
          <CardDescription>
            Last 10 resolved risks with resolution time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* AC12: Empty state when no closed risks */}
          {recentlyClosed.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No recently closed risks
            </div>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {/* AC10: Ordered by closedAt DESC (newest first) */}
              {recentlyClosed.map((risk) => (
                /* AC11: Clicking risk title navigates to risk detail page */
                <Link
                  key={risk.id}
                  href={`/risks/${risk.id}`}
                  className="block p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* AC8: Risk title */}
                    <span className="text-sm font-medium line-clamp-1">
                      {risk.title}
                    </span>
                    {/* AC8, AC9: Days-to-close metric */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {risk.daysToClose}d
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    {/* AC8: Closed date as relative time */}
                    <span>
                      {safeFormatDistanceToNow(risk.closedAt)}
                    </span>
                    {/* AC8: Closed by (user name) */}
                    {risk.closedByName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {risk.closedByName}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
