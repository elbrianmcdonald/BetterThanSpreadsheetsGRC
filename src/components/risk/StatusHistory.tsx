"use client";

/**
 * Status History Component
 *
 * Story 4.10: Remediation Workflow State Machine (AC31-AC35)
 *
 * Displays the history of risk status transitions:
 * - AC31: Risk detail page shows "Status History" section
 * - AC32: History displays all status transitions chronologically (newest first)
 * - AC33: Each transition shows: old status → new status, changed by user, timestamp, reason
 * - AC34: Status history immutable (cannot be edited or deleted)
 * - AC35: Empty state for new risks: "No status changes yet"
 *
 * @see Story 4.10: Remediation Workflow State Machine
 */

import { ArrowRight, Clock, History, MessageSquare, User } from "lucide-react";
import { RiskStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface StatusHistoryProps {
  /** The risk ID to show history for */
  riskId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from a user's name for avatar fallback
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return formatDate(date);
}

export function StatusHistory({ riskId, className }: StatusHistoryProps) {
  // Fetch status history (AC31-AC32)
  const { data: history, isLoading } = api.risk.getRiskStatusHistory.useQuery({
    riskId,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-muted-foreground" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AC35: Empty State for new risks */}
        {!isLoading && (!history || history.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <History className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No status changes yet</p>
            <p className="text-xs mt-1">
              Status transitions will appear here when the risk workflow
              progresses.
            </p>
          </div>
        )}

        {/* AC32-AC33: Timeline of status changes */}
        {!isLoading && history && history.length > 0 && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-6">
              {history.map((entry, index) => (
                <div key={entry.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
                      index === 0
                        ? "border-primary bg-primary/10"
                        : "border-muted"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={entry.ChangedBy.image ?? undefined}
                        alt={entry.ChangedBy.name ?? "User"}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(entry.ChangedBy.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-2">
                    {/* Status transition (AC33) */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StatusBadge
                        status={entry.oldStatus as RiskStatus}
                        size="sm"
                        showIcon={false}
                      />
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <StatusBadge
                        status={entry.newStatus as RiskStatus}
                        size="sm"
                        showIcon={false}
                      />
                    </div>

                    {/* User and timestamp (AC33) */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {entry.ChangedBy.name ?? entry.ChangedBy.email}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title={formatDate(entry.changedAt)}
                      >
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(entry.changedAt)}
                      </span>
                    </div>

                    {/* Reason (AC33) */}
                    {entry.reason && (
                      <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-foreground">{entry.reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
