"use client";

/**
 * Framework Coverage Card Component
 *
 * Story 5.1: Compliance Summary Dashboard (AC3-AC5, AC23-AC27)
 * Story 5.2: On-Demand Compliance Refresh Button (AC12-AC15)
 * Story 5.3: Automatic Compliance Updates (AC21)
 *
 * Displays a single framework's coverage status:
 * - AC3: Framework name, coverage percentage, controls satisfied/total, trend indicator
 * - AC4: Color-coded by coverage (Green ≥90%, Yellow 70-89%, Red <70%)
 * - AC5: Cards sortable (handled at parent level)
 * - AC23-AC27: Trend indicators (↑/↓/→) with tooltips
 * - 5.2 AC12: Individual framework cards include small refresh icon button
 * - 5.2 AC13: Clicking framework refresh recalculates only that framework
 * - 5.3 AC21: Shows subtle loading indicator (shimmer) during recalculation
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.2: On-Demand Compliance Refresh Button
 * @see Story 5.3: Automatic Compliance Updates
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { StartAssessmentDialog } from "./StartAssessmentDialog";

export type TrendDirection = "up" | "down" | "stable" | "new";

export interface FrameworkCoverageCardProps {
  frameworkId: string;
  frameworkCode: string;
  frameworkName: string;
  frameworkVersion: string;
  coveragePercentage: number;
  satisfiedControlsCount: number;
  totalControlsCount: number;
  lastUpdated: Date;
  trend: {
    direction: TrendDirection;
    change: number;
    previousCoverage: number | null;
  };
  coverageLevel: "high" | "medium" | "low";
  /** Story 5.2 AC12: Handler for per-framework refresh */
  onRefresh?: () => void;
  /** Story 5.2 AC12: Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Story 5.3 AC21: Whether data just updated (shows brief shimmer) */
  hasJustUpdated?: boolean;
  /** Show the Start Assessment button */
  showStartAssessment?: boolean;
  /** Callback when an assessment is created */
  onAssessmentCreated?: () => void;
}

/**
 * Get the color classes for a coverage level
 */
function getCoverageColorClasses(level: "high" | "medium" | "low") {
  switch (level) {
    case "high":
      return {
        border: "border-border",
        bg: "bg-card",
        text: "text-success",
        progressBg: "bg-success",
      };
    case "medium":
      return {
        border: "border-border",
        bg: "bg-card",
        text: "text-warning",
        progressBg: "bg-warning",
      };
    case "low":
      return {
        border: "border-border",
        bg: "bg-card",
        text: "text-destructive",
        progressBg: "bg-destructive",
      };
  }
}

/**
 * Trend indicator component (AC23-AC27)
 */
function TrendIndicator({
  direction,
  change,
  previousCoverage,
}: {
  direction: TrendDirection;
  change: number;
  previousCoverage: number | null;
}) {
  if (direction === "new") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              New
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Framework recently activated - no historical data yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  const iconColor =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  const tooltipText =
    direction === "up"
      ? `+${change.toFixed(1)}% from last week (was ${previousCoverage?.toFixed(1)}%)`
      : direction === "down"
        ? `${change.toFixed(1)}% from last week (was ${previousCoverage?.toFixed(1)}%)`
        : "No change from last week";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1", iconColor)}>
            <Icon className="h-4 w-4" />
            {direction !== "stable" && (
              <span className="font-mono text-xs font-medium tabular-nums">
                {direction === "up" ? "+" : ""}
                {change.toFixed(1)}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FrameworkCoverageCard({
  frameworkId,
  frameworkCode,
  frameworkName,
  frameworkVersion,
  coveragePercentage,
  satisfiedControlsCount,
  totalControlsCount,
  lastUpdated,
  trend,
  coverageLevel,
  onRefresh,
  isRefreshing = false,
  hasJustUpdated = false,
  showStartAssessment = false,
  onAssessmentCreated,
}: FrameworkCoverageCardProps) {
  const colors = getCoverageColorClasses(coverageLevel);

  // Story 5.2 AC12: Handle refresh button click
  const handleRefreshClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to detail page
    e.stopPropagation();
    onRefresh?.();
  };

  return (
    <Link href={`/compliance/frameworks/${frameworkId}`}>
      <Card
        className={cn(
          "transition-all hover:shadow-md cursor-pointer",
          colors.border,
          colors.bg,
          // Story 5.3 AC21: Subtle shimmer effect when data updates
          hasJustUpdated && "animate-pulse ring-2 ring-primary/20"
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{frameworkName}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {frameworkCode} v{frameworkVersion}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TrendIndicator
                direction={trend.direction}
                change={trend.change}
                previousCoverage={trend.previousCoverage}
              />
              {/* Story 5.2 AC12: Per-framework refresh button */}
              {onRefresh && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleRefreshClick}
                        disabled={isRefreshing}
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            isRefreshing && "animate-spin"
                          )}
                        />
                        <span className="sr-only">Refresh coverage</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh coverage for this framework</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Large coverage percentage */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className={cn("text-4xl font-bold tabular-nums", colors.text)}>
              {coveragePercentage.toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground">coverage</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-secondary rounded-sm overflow-hidden mb-3 border border-border">
            <div
              className={cn("h-full transition-all", colors.progressBg)}
              style={{ width: `${Math.min(100, coveragePercentage)}%` }}
            />
          </div>

          {/* Controls count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground tabular-nums">
              {satisfiedControlsCount} / {totalControlsCount} controls
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
              Updated {formatRelativeTime(lastUpdated)}
            </span>
          </div>

          {/* Start Assessment Button */}
          {showStartAssessment && (
            <div className="mt-4 pt-3 border-t" onClick={(e) => e.preventDefault()}>
              <StartAssessmentDialog
                frameworkId={frameworkId}
                frameworkName={frameworkName}
                frameworkCode={frameworkCode}
                onSuccess={onAssessmentCreated}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Play className="h-4 w-4" />
                    Create Assessment
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
