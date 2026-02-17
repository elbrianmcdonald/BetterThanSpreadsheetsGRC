"use client";

/**
 * Remediation Velocity Widget Component
 *
 * Story 5.8: Remediation Velocity Metrics (Average Days-to-Close)
 *
 * Displays velocity metrics for the dashboard:
 * - AC1: Compliance dashboard includes "Remediation Velocity" widget
 * - AC2: Widget shows average days-to-close for all closed risks (last 90 days)
 * - AC3: Widget breaks down average days by severity (HIGH, MEDIUM, LOW)
 * - AC4: Widget displays trend indicator (↑/↓/→) comparing to previous 90-day period
 * - AC5: Widget color-codes velocity: Green (improving), Yellow (stable), Red (degrading)
 * - AC6: Widget includes tooltip explaining calculation
 * - AC26-AC29: Benchmark indicators showing performance vs industry standards
 *
 * @see Story 5.8: Remediation Velocity Metrics
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Velocity benchmarks per severity (AC26-AC29)
const VELOCITY_BENCHMARKS = {
  HIGH: 14, // AC27: <14 days
  MEDIUM: 30, // AC28: <30 days
  LOW: 60, // AC29: <60 days
};

// Severity type for type safety
type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface VelocityWidgetProps {
  overall: number;
  bySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  comparison: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    direction: "improving" | "stable" | "degrading";
  };
  closedRisksCount: number;
  timeframeDays: number;
}

/**
 * AC4, AC5: Trend indicator component
 */
function TrendIndicator({
  direction,
  change,
}: {
  direction: "improving" | "stable" | "degrading";
  change: number;
}) {
  const absChange = Math.abs(change);

  if (direction === "improving") {
    return (
      <div className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
        <TrendingDown className="h-4 w-4" />
        <span>-{absChange.toFixed(1)}d</span>
      </div>
    );
  }

  if (direction === "degrading") {
    return (
      <div className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
        <TrendingUp className="h-4 w-4" />
        <span>+{absChange.toFixed(1)}d</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
      <Minus className="h-4 w-4" />
      <span>Stable</span>
    </div>
  );
}

/**
 * AC26-AC29: Benchmark indicator for individual severity
 */
function BenchmarkIndicator({
  velocity,
  benchmark,
}: {
  velocity: number;
  benchmark: number;
}) {
  const meetsBenchmark = velocity <= benchmark;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            {meetsBenchmark ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Target: &lt;{benchmark} days
            {meetsBenchmark ? " (Meeting target)" : " (Exceeding target)"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Severity velocity card component
 */
function SeverityVelocityCard({
  severity,
  velocity,
  count,
}: {
  severity: Severity;
  velocity: number;
  count: number;
}) {
  const config = {
    HIGH: {
      icon: AlertCircle,
      label: "High",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-950",
      borderColor: "border-red-200 dark:border-red-900",
    },
    MEDIUM: {
      icon: AlertTriangle,
      label: "Medium",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
      borderColor: "border-yellow-200 dark:border-yellow-900",
    },
    LOW: {
      icon: Info,
      label: "Low",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-blue-200 dark:border-blue-900",
    },
  };

  const { icon: Icon, label, color, bgColor, borderColor } = config[severity];
  const benchmark = VELOCITY_BENCHMARKS[severity];
  const meetsBenchmark = velocity <= benchmark || count === 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex flex-col",
        bgColor,
        borderColor
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {count > 0 && (
          <BenchmarkIndicator velocity={velocity} benchmark={benchmark} />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-bold", color)}>
          {count > 0 ? velocity.toFixed(1) : "—"}
        </span>
        <span className="text-sm text-muted-foreground">days</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {count} risk{count !== 1 ? "s" : ""} closed
      </div>
      <div className="text-xs text-muted-foreground opacity-75">
        Target: &lt;{benchmark}d
      </div>
    </div>
  );
}

/**
 * Story 5.8 AC1-AC6: Remediation Velocity Widget
 */
export function VelocityWidget({
  overall,
  bySeverity,
  comparison,
  closedRisksCount,
  timeframeDays,
}: VelocityWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Remediation Velocity</CardTitle>
            {/* AC6: Tooltip explaining calculation */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Average time from risk creation to closure. Lower is better.
                    Calculated as (closedAt - createdAt) for all closed risks.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {/* AC4, AC5: Trend indicator */}
          <TrendIndicator
            direction={comparison.direction}
            change={comparison.change}
          />
        </div>
        <CardDescription>
          Last {timeframeDays} days • {closedRisksCount} risks closed
        </CardDescription>
      </CardHeader>
      <CardContent>
        {closedRisksCount === 0 ? (
          <div className="text-center py-6">
            <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No risks closed in this period
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Velocity metrics will appear once risks are resolved
            </p>
          </div>
        ) : (
          <>
            {/* Overall average */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Overall Average
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {overall.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            </div>

            {/* AC3: Breakdown by severity */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <SeverityVelocityCard
                severity="HIGH"
                velocity={bySeverity.HIGH}
                count={bySeverity.highCount}
              />
              <SeverityVelocityCard
                severity="MEDIUM"
                velocity={bySeverity.MEDIUM}
                count={bySeverity.mediumCount}
              />
              <SeverityVelocityCard
                severity="LOW"
                velocity={bySeverity.LOW}
                count={bySeverity.lowCount}
              />
            </div>

            {/* Link to detailed report */}
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/compliance/velocity">
                View Detailed Report
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
