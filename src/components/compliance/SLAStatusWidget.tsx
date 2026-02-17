"use client";

/**
 * SLA Status Widget Component
 *
 * Story 16.8: Treatment SLA Display & Alerts (AC5-AC7)
 *
 * Dashboard widget showing treatment SLA status:
 * - AC5: "SLA Status" widget on compliance dashboard
 * - AC6: Shows count by status (On Track, At Risk, Breached)
 * - AC7: Click status to filter risk register
 *
 * @see Story 16.8: Treatment SLA Display & Alerts
 */

import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SLAStatusWidgetProps {
  /** Additional CSS classes */
  className?: string;
}

/** Status configuration */
const statusConfig = {
  onTrack: {
    label: "On Track",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    hoverColor: "hover:bg-green-50 dark:hover:bg-green-900/20",
    icon: CheckCircle,
  },
  atRisk: {
    label: "At Risk",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    hoverColor: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
    icon: AlertTriangle,
  },
  breached: {
    label: "Breached",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    hoverColor: "hover:bg-red-50 dark:hover:bg-red-900/20",
    icon: XCircle,
  },
};

export function SLAStatusWidget({ className }: SLAStatusWidgetProps) {
  const { data, isLoading, error } = api.compliance.getSLAStatusSummary.useQuery(
    undefined,
    {
      refetchInterval: 30 * 1000, // Poll every 30 seconds
    }
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Treatment SLA Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Treatment SLA Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Failed to load SLA status
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { onTrack, atRisk, breached, total, completedLast30Days, atRiskRisks, breachedRisks } = data;

  // If no treatments at all, show empty state
  if (total === 0 && completedLast30Days === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Treatment SLA Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active treatments. Risks need treatment decisions.
          </p>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/risks/register?status=OPEN">
              View Open Risks
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Treatment SLA Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary - AC6 */}
        <div className="grid grid-cols-3 gap-3">
          {/* On Track */}
          <Link
            href="/risks/register?slaStatus=on_track"
            className={cn(
              "flex flex-col items-center p-3 rounded-lg transition-colors cursor-pointer",
              statusConfig.onTrack.bgColor,
              statusConfig.onTrack.hoverColor
            )}
          >
            <CheckCircle className={cn("h-5 w-5 mb-1", statusConfig.onTrack.color)} />
            <span className={cn("text-2xl font-bold", statusConfig.onTrack.color)}>
              {onTrack}
            </span>
            <span className="text-xs text-muted-foreground">On Track</span>
          </Link>

          {/* At Risk */}
          <Link
            href="/risks/register?slaStatus=at_risk"
            className={cn(
              "flex flex-col items-center p-3 rounded-lg transition-colors cursor-pointer",
              statusConfig.atRisk.bgColor,
              statusConfig.atRisk.hoverColor
            )}
          >
            <AlertTriangle className={cn("h-5 w-5 mb-1", statusConfig.atRisk.color)} />
            <span className={cn("text-2xl font-bold", statusConfig.atRisk.color)}>
              {atRisk}
            </span>
            <span className="text-xs text-muted-foreground">At Risk</span>
          </Link>

          {/* Breached */}
          <Link
            href="/risks/register?slaStatus=breached"
            className={cn(
              "flex flex-col items-center p-3 rounded-lg transition-colors cursor-pointer",
              statusConfig.breached.bgColor,
              statusConfig.breached.hoverColor
            )}
          >
            <XCircle className={cn("h-5 w-5 mb-1", statusConfig.breached.color)} />
            <span className={cn("text-2xl font-bold", statusConfig.breached.color)}>
              {breached}
            </span>
            <span className="text-xs text-muted-foreground">Breached</span>
          </Link>
        </div>

        {/* Completed counter */}
        {completedLast30Days > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground border-t pt-3">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span>
              <strong className="text-green-600">{completedLast30Days}</strong> completed in last 30 days
            </span>
          </div>
        )}

        {/* At Risk List */}
        {atRiskRisks.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Expiring Soon
            </h4>
            {atRiskRisks.map((risk) => (
              <Link
                key={risk.id}
                href={`/risks/${risk.id}`}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-sm"
              >
                <span className="truncate flex-1 mr-2">{risk.title}</span>
                <Badge variant="outline" className="text-amber-600 shrink-0">
                  {risk.daysRemaining}d left
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Breached List */}
        {breachedRisks.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Overdue
            </h4>
            {breachedRisks.map((risk) => (
              <Link
                key={risk.id}
                href={`/risks/${risk.id}`}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-sm"
              >
                <span className="truncate flex-1 mr-2">{risk.title}</span>
                <Badge variant="outline" className="text-red-600 shrink-0">
                  {risk.daysOverdue}d overdue
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* View All Link */}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/risks/register">
            View All Risks
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
