"use client";

/**
 * Status Badge Component
 *
 * Story 4.10: Remediation Workflow State Machine (AC5)
 *
 * Displays risk status with color-coded badges:
 * - OPEN = gray (risk identified, awaiting assignment)
 * - ASSIGNED = blue (assigned to stakeholder for remediation)
 * - REMEDIATED = yellow (remediation complete, awaiting verification)
 * - CLOSED = green (verified and closed)
 *
 * @see Story 4.10: Remediation Workflow State Machine
 */

import { RiskStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  CircleDot,
  UserCheck,
  CheckCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Status configuration for each risk status.
 */
const STATUS_CONFIG: Record<
  RiskStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof CircleDot;
    description: string;
  }
> = {
  [RiskStatus.DRAFT]: {
    label: "Draft",
    color: "text-secondary-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    icon: CircleDot,
    description: "Assessment in progress by assignee",
  },
  [RiskStatus.PENDING_REVIEW]: {
    label: "Pending Review",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-transparent",
    icon: Clock,
    description: "Submitted for manager review",
  },
  [RiskStatus.OPEN]: {
    label: "Open",
    color: "text-secondary-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    icon: CircleDot,
    description: "Risk identified, awaiting assignment",
  },
  [RiskStatus.ASSIGNED]: {
    label: "Assigned",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-transparent",
    icon: UserCheck,
    description: "Assigned to stakeholder for remediation",
  },
  [RiskStatus.REMEDIATED]: {
    label: "Remediated",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-transparent",
    icon: CheckCircle,
    description: "Remediation complete, awaiting verification",
  },
  [RiskStatus.CLOSED]: {
    label: "Closed",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-transparent",
    icon: CheckCircle2,
    description: "Verified and closed",
  },
};

interface StatusBadgeProps {
  /** The risk status to display */
  status: RiskStatus;
  /** Last updated timestamp (AC26) */
  updatedAt?: Date | string | null;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a color-coded badge for risk status.
 *
 * @example
 * ```tsx
 * <StatusBadge status={RiskStatus.ASSIGNED} updatedAt={risk.updatedAt} />
 * ```
 */
export function StatusBadge({
  status,
  updatedAt,
  size = "md",
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Format the last updated timestamp
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );

  // AC26: Show last updated timestamp in tooltip
  if (formattedDate) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{config.description}</p>
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last updated: {formattedDate}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Get the color class for a status (for use in other components).
 */
export function getStatusColor(status: RiskStatus): string {
  return STATUS_CONFIG[status].color;
}

/**
 * Get the background color class for a status.
 */
export function getStatusBgColor(status: RiskStatus): string {
  return STATUS_CONFIG[status].bgColor;
}

/**
 * Get the status label.
 */
export function getStatusLabel(status: RiskStatus): string {
  return STATUS_CONFIG[status].label;
}

/**
 * Get the status description.
 */
export function getStatusDescription(status: RiskStatus): string {
  return STATUS_CONFIG[status].description;
}
