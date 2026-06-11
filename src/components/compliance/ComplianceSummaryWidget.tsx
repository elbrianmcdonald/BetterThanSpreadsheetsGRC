"use client";

/**
 * Compliance Summary Widget Component
 *
 * Story 5.1: Compliance Summary Dashboard (AC18-AC22)
 *
 * Dashboard summary widget showing:
 * - AC18: Overall compliance score, total frameworks, ready for audit, needs attention
 * - AC19: Overall score with color indicator
 * - AC20: Quick action buttons
 * - AC21: Last updated timestamp
 * - AC22: Responsive for mobile devices
 *
 * @see Story 5.1: Compliance Summary Dashboard
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
  Shield,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Upload,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComplianceSummaryWidgetProps {
  overallScore: number;
  totalFrameworks: number;
  readyForAudit: number;
  needsAttention: number;
  lastUpdated: Date;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Get color classes for overall score
 */
function getScoreColorClasses(score: number) {
  if (score >= 90) {
    return {
      bg: "bg-success/10",
      text: "text-success",
      ring: "ring-success/20",
    };
  }
  if (score >= 70) {
    return {
      bg: "bg-warning/10",
      text: "text-warning",
      ring: "ring-warning/20",
    };
  }
  return {
    bg: "bg-destructive/10",
    text: "text-destructive",
    ring: "ring-destructive/20",
  };
}

export function ComplianceSummaryWidget({
  overallScore,
  totalFrameworks,
  readyForAudit,
  needsAttention,
  lastUpdated,
  isRefreshing = false,
  onRefresh,
}: ComplianceSummaryWidgetProps) {
  const scoreColors = getScoreColorClasses(overallScore);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Compliance Overview</CardTitle>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-1"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              Refresh
            </Button>
          )}
        </div>
        <CardDescription>
          Last updated:{" "}
          {new Date(lastUpdated).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Overall Score - AC19 */}
          <div
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-lg ring-1",
              scoreColors.bg,
              scoreColors.ring
            )}
          >
            <span className={cn("text-5xl font-bold tabular-nums", scoreColors.text)}>
              {overallScore.toFixed(1)}%
            </span>
            <span className="eyebrow mt-1">
              Overall Score
            </span>
          </div>

          {/* Stats Grid */}
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-secondary">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{totalFrameworks}</div>
                <div className="text-sm text-muted-foreground">
                  Total Frameworks
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{readyForAudit}</div>
                <div className="text-sm text-muted-foreground">
                  Ready for Audit
                </div>
                <div className="text-xs text-muted-foreground">≥90% coverage</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{needsAttention}</div>
                <div className="text-sm text-muted-foreground">
                  Needs Attention
                </div>
                <div className="text-xs text-muted-foreground">&lt;70% coverage</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - AC20 */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/frameworks/configure">
              <Plus className="h-4 w-4 mr-2" />
              Add Framework
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/evidence">
              <Upload className="h-4 w-4 mr-2" />
              Upload Evidence
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/risks">
              <AlertCircle className="h-4 w-4 mr-2" />
              View Risks
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
