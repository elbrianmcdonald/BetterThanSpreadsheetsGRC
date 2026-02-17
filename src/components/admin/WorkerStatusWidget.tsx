"use client";

/**
 * Worker Status Widget Component
 *
 * Story 4.18: Background Job Processing for Email Sending
 *
 * AC26: Admin dashboard shows worker status and metrics
 *
 * Displays:
 * - Worker status (running/stopped)
 * - Last processed timestamp
 * - Jobs processed in last 24 hours
 * - Error count
 * - Queue statistics
 *
 * @see Story 4.18: Background Job Processing
 */

import { useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Mail,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkerStatusWidgetProps {
  /** Auto-refresh interval in ms (default: 60000 = 1 minute) */
  refreshInterval?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function WorkerStatusWidget({
  refreshInterval = 60000,
  className,
}: WorkerStatusWidgetProps) {
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
    isFetching,
  } = api.worker.getMetrics.useQuery(undefined, {
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error("[WorkerStatusWidget] Error fetching metrics:", error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Background Workers
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
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Background Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-muted-foreground">
              Unable to load worker status
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const emailWorker = metrics.workers.email;
  const isRunning = emailWorker.status === "running";
  const hasErrors = emailWorker.errorCount > 0;

  // Calculate success rate
  const totalProcessed = emailWorker.jobsProcessedLast24h;
  const successRate =
    totalProcessed > 0
      ? Math.round((emailWorker.jobsSucceededLast24h / totalProcessed) * 100)
      : 100;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Background Workers
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-3 w-3", isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Worker Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email Worker</span>
            </div>
            <Badge
              variant={isRunning ? "default" : "destructive"}
              className={cn(
                "flex items-center gap-1",
                isRunning && "bg-green-600 hover:bg-green-700"
              )}
            >
              {isRunning ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Running
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Stopped
                </>
              )}
            </Badge>
          </div>

          {/* Processing indicator */}
          {emailWorker.isProcessing && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing batch...
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Last processed */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last Run
              </p>
              <p className="text-sm font-medium">
                {emailWorker.lastProcessedAt
                  ? formatDistanceToNow(new Date(emailWorker.lastProcessedAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </p>
            </div>

            {/* Avg duration */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Duration</p>
              <p className="text-sm font-medium">
                {formatDuration(emailWorker.avgProcessingDurationMs)}
              </p>
            </div>

            {/* Jobs last 24h */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">24h Processed</p>
              <p className="text-sm font-medium">
                {emailWorker.jobsProcessedLast24h}
                {totalProcessed > 0 && (
                  <span
                    className={cn(
                      "ml-1 text-xs",
                      successRate >= 95
                        ? "text-green-600"
                        : successRate >= 80
                        ? "text-amber-600"
                        : "text-red-600"
                    )}
                  >
                    ({successRate}%)
                  </span>
                )}
              </p>
            </div>

            {/* Error count */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  hasErrors && "text-red-600"
                )}
              >
                {emailWorker.errorCount}
              </p>
            </div>
          </div>

          {/* Last error */}
          {emailWorker.lastError && (
            <div className="mt-3 p-2 bg-red-50 rounded-md border border-red-100">
              <p className="text-xs font-medium text-red-800 mb-1">
                Last Error
                {emailWorker.lastErrorAt && (
                  <span className="font-normal text-red-600 ml-1">
                    ({format(new Date(emailWorker.lastErrorAt), "MMM d, HH:mm")})
                  </span>
                )}
              </p>
              <p className="text-xs text-red-700 truncate">
                {emailWorker.lastError}
              </p>
            </div>
          )}
        </div>

        {/* Queue stats */}
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">Email Queue</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold">{metrics.queue.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-amber-600">
                {metrics.queue.retrying}
              </p>
              <p className="text-xs text-muted-foreground">Retrying</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-green-600">
                {metrics.queue.sent24h}
              </p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-600">
                {metrics.queue.failed24h}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>

        {/* Config info */}
        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Interval: {metrics.config.intervalMs / 1000}s
          </span>
          <span>
            {metrics.config.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
