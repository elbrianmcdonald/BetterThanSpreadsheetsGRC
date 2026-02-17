"use client";

/**
 * Remediation Priority Badge Component
 *
 * Displays remediation option priority with color-coded badges and tooltips.
 *
 * Story 4.5: Task 6 - Effort and Priority Badge Components (AC39)
 * AC39: Priority shown with badges (RECOMMENDED=blue, ALTERNATIVE=gray, NOT_RECOMMENDED=red)
 *
 * @see Story 4.5: Remediation Options Management
 */

import { Star, CircleDot, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RemediationPriority } from "@prisma/client";

/**
 * Configuration for each priority level
 * Includes color, icon, label, and tooltip description
 */
const priorityConfig: Record<
  RemediationPriority,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Star;
    label: string;
    description: string;
  }
> = {
  RECOMMENDED: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Star,
    label: "Recommended",
    description:
      "The preferred remediation approach. Offers the best balance of cost, timeline, and risk reduction.",
  },
  ALTERNATIVE: {
    color: "text-slate-700 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-900/30",
    borderColor: "border-slate-200 dark:border-slate-800",
    icon: CircleDot,
    label: "Alternative",
    description:
      "A viable alternative approach. Consider if the recommended option is not feasible for your organization.",
  },
  NOT_RECOMMENDED: {
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: XCircle,
    label: "Not Recommended",
    description:
      "Documented for completeness but not advised. May have significant drawbacks or better alternatives exist.",
  },
};

interface RemediationPriorityBadgeProps {
  /** The priority level to display */
  priority: RemediationPriority;
  /** Whether to show the label text (default: true) */
  showLabel?: boolean;
  /** Whether to show the icon (default: true) */
  showIcon?: boolean;
  /** Whether to show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Size variant for the badge */
  size?: "sm" | "default" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a remediation priority badge with color coding, icon, and optional tooltip.
 *
 * @example
 * ```tsx
 * <RemediationPriorityBadge priority="RECOMMENDED" />
 * <RemediationPriorityBadge priority="ALTERNATIVE" showTooltip={false} />
 * <RemediationPriorityBadge priority="NOT_RECOMMENDED" size="lg" />
 * ```
 */
export function RemediationPriorityBadge({
  priority,
  showLabel = true,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: RemediationPriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  // Size-specific classes
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium gap-1",
        config.color,
        config.bgColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], "shrink-0")} />}
      {showLabel && <span>{config.label}</span>}
      {!showLabel && showIcon && (
        <span className="sr-only">{config.label} priority</span>
      )}
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {config.description}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Export the priority configuration for use elsewhere
 */
export { priorityConfig };
