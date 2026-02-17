"use client";

/**
 * Risk Register Status History Component
 *
 * Story 16.6: Risk Register Status Transitions
 *
 * Displays the status change history for a risk register entry.
 * - AC13: Status history section
 * - AC14: Shows who changed status, when, and comments
 *
 * @see Story 16.6: Risk Register Status Transitions
 */

import { formatDistanceToNow } from "date-fns";
import {
  History,
  ArrowRight,
  User,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { RiskRegisterStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RiskRegisterStatusHistoryProps {
  /** The risk register entry ID */
  entryId: string;
  /** Additional CSS classes */
  className?: string;
}

/** Status badge configuration */
const statusConfig: Record<RiskRegisterStatus, { color: string; label: string }> = {
  OPEN: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Open",
  },
  IN_TREATMENT: {
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    label: "In Treatment",
  },
  ACCEPTED: {
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    label: "Accepted",
  },
  MITIGATED: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    label: "Mitigated",
  },
  TRANSFERRED: {
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    label: "Transferred",
  },
  CLOSED: {
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    label: "Closed",
  },
};

export function RiskRegisterStatusHistory({
  entryId,
  className,
}: RiskRegisterStatusHistoryProps) {
  const { data: history, isLoading } = api.riskRegister.getStatusHistory.useQuery(
    { entryId },
    { enabled: !!entryId }
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Status History
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

  if (!history || history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No status changes recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Status History
          <Badge variant="secondary" className="ml-auto">
            {history.length} {history.length === 1 ? "change" : "changes"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => {
            const oldConfig = statusConfig[entry.oldStatus];
            const newConfig = statusConfig[entry.newStatus];

            return (
              <div
                key={entry.id}
                className={cn(
                  "relative pl-6 pb-4",
                  index !== history.length - 1 && "border-l border-muted-foreground/20"
                )}
              >
                {/* Timeline dot */}
                <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                <div className="space-y-2">
                  {/* Status transition */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs", oldConfig.color)}>
                      {oldConfig.label}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className={cn("text-xs", newConfig.color)}>
                      {newConfig.label}
                    </Badge>
                  </div>

                  {/* User and time */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{entry.changedBy.name ?? entry.changedBy.email}</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>
                      {formatDistanceToNow(new Date(entry.changedAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Comment if present */}
                  {entry.comment && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-muted/50 rounded-md">
                      <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">{entry.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
