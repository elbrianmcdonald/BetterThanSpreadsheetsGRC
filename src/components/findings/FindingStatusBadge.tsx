"use client";

/**
 * Finding Status Badge Component
 *
 * Story 7.3: Finding Triage Workflow (AC18)
 *
 * Displays finding status with color-coded badges:
 * - NEW = blue (newly created finding awaiting triage)
 * - NEEDS_INFO = yellow (additional information required)
 * - TRIAGED = green (reviewed and ready for acceptance)
 * - DUPLICATE = gray (duplicate of another finding)
 * - REJECTED = red (not a valid security finding)
 * - ACCEPTED = purple (accepted, Risk Assessment created)
 *
 * @see Story 7.3: Finding Triage Workflow
 */

import { FindingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  Circle,
  AlertCircle,
  CheckCircle,
  Copy,
  XCircle,
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
 * Status configuration for each finding status.
 */
const STATUS_CONFIG: Record<
  FindingStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Circle;
    description: string;
  }
> = {
  [FindingStatus.NEW]: {
    label: "New",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-300 dark:border-blue-600",
    icon: Circle,
    description: "Newly created finding awaiting triage",
  },
  [FindingStatus.NEEDS_INFO]: {
    label: "Needs Info",
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    borderColor: "border-yellow-300 dark:border-yellow-600",
    icon: AlertCircle,
    description: "Additional information required before triage",
  },
  [FindingStatus.TRIAGED]: {
    label: "Triaged",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-300 dark:border-green-600",
    icon: CheckCircle,
    description: "Reviewed and ready for acceptance decision",
  },
  [FindingStatus.DUPLICATE]: {
    label: "Duplicate",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-300 dark:border-gray-600",
    icon: Copy,
    description: "Duplicate of another finding",
  },
  [FindingStatus.REJECTED]: {
    label: "Rejected",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-300 dark:border-red-600",
    icon: XCircle,
    description: "Not a valid security finding",
  },
  [FindingStatus.ACCEPTED]: {
    label: "Accepted",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-300 dark:border-purple-600",
    icon: CheckCircle2,
    description: "Accepted - Risk Assessment created",
  },
};

interface FindingStatusBadgeProps {
  /** The finding status to display */
  status: FindingStatus;
  /** Last updated timestamp */
  updatedAt?: Date | string | null;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a color-coded badge for finding status.
 *
 * @example
 * ```tsx
 * <FindingStatusBadge status={FindingStatus.NEW} />
 * <FindingStatusBadge status={FindingStatus.TRIAGED} size="sm" showIcon={false} />
 * ```
 */
export function FindingStatusBadge({
  status,
  updatedAt,
  size = "md",
  showIcon = true,
  className,
}: FindingStatusBadgeProps) {
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

  // Show last updated timestamp in tooltip
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Get the color class for a status (for use in other components).
 */
export function getFindingStatusColor(status: FindingStatus): string {
  return STATUS_CONFIG[status].color;
}

/**
 * Get the background color class for a status.
 */
export function getFindingStatusBgColor(status: FindingStatus): string {
  return STATUS_CONFIG[status].bgColor;
}

/**
 * Get the status label.
 */
export function getFindingStatusLabel(status: FindingStatus): string {
  return STATUS_CONFIG[status].label;
}

/**
 * Get the status description.
 */
export function getFindingStatusDescription(status: FindingStatus): string {
  return STATUS_CONFIG[status].description;
}
