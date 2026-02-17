"use client";

/**
 * Finding SLA Status Component
 *
 * Story 14.7: Finding SLA Tracking
 *
 * Displays SLA status (On Track, At Risk, Breached) with visual indicators.
 */

import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { differenceInDays, formatDistanceToNow, isPast } from "date-fns";

interface FindingSlaStatusProps {
  dueDate: Date | string | null | undefined;
  slaBreached?: boolean;
  showDaysRemaining?: boolean;
  size?: "sm" | "default";
}

type SlaStatus = "on_track" | "at_risk" | "breached" | "no_sla";

function getSlaStatus(
  dueDate: Date | string | null | undefined,
  slaBreached?: boolean
): SlaStatus {
  if (!dueDate) return "no_sla";

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();

  if (slaBreached || isPast(due)) {
    return "breached";
  }

  const daysRemaining = differenceInDays(due, now);

  if (daysRemaining <= 3) {
    return "at_risk";
  }

  return "on_track";
}

const statusConfig: Record<
  SlaStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    className?: string;
  }
> = {
  on_track: {
    label: "On Track",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-500 hover:bg-green-600",
  },
  at_risk: {
    label: "At Risk",
    variant: "default",
    icon: <AlertTriangle className="h-3 w-3" />,
    className: "bg-yellow-500 hover:bg-yellow-600 text-yellow-950",
  },
  breached: {
    label: "Breached",
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  no_sla: {
    label: "No SLA",
    variant: "outline",
    icon: <Clock className="h-3 w-3" />,
  },
};

export function FindingSlaStatus({
  dueDate,
  slaBreached,
  showDaysRemaining = true,
  size = "default",
}: FindingSlaStatusProps) {
  const status = getSlaStatus(dueDate, slaBreached);
  const config = statusConfig[status];

  const getDaysText = () => {
    if (!dueDate || status === "no_sla") return null;

    const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
    const now = new Date();
    const days = differenceInDays(due, now);

    if (days < 0) {
      return `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`;
    } else if (days === 0) {
      return "Due today";
    } else if (days === 1) {
      return "Due tomorrow";
    } else {
      return `${days} days remaining`;
    }
  };

  const daysText = getDaysText();

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={config.variant}
        className={`gap-1 ${config.className ?? ""} ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      >
        {config.icon}
        {config.label}
      </Badge>
      {showDaysRemaining && daysText && (
        <span
          className={`text-muted-foreground ${size === "sm" ? "text-xs" : "text-sm"}`}
        >
          {daysText}
        </span>
      )}
    </div>
  );
}

/**
 * Compact SLA indicator for table rows
 */
export function FindingSlaIndicator({
  dueDate,
  slaBreached,
}: {
  dueDate: Date | string | null | undefined;
  slaBreached?: boolean;
}) {
  const status = getSlaStatus(dueDate, slaBreached);

  if (status === "no_sla") {
    return <span className="text-muted-foreground">-</span>;
  }

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const timeText = due
    ? formatDistanceToNow(due, { addSuffix: true })
    : "";

  const colorClass =
    status === "breached"
      ? "text-red-600"
      : status === "at_risk"
        ? "text-yellow-600"
        : "text-green-600";

  return (
    <span className={`text-sm ${colorClass}`}>
      {status === "breached" ? "Overdue " : "Due "}
      {timeText}
    </span>
  );
}

/**
 * Utility to get SLA status for filtering
 */
export function calculateSlaStatus(
  dueDate: Date | string | null | undefined,
  slaBreached?: boolean
): SlaStatus {
  return getSlaStatus(dueDate, slaBreached);
}
