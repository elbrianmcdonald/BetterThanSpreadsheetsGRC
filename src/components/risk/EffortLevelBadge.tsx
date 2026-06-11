"use client";

/**
 * Effort Level Badge Component
 *
 * Displays effort level with color-coded badges and tooltips.
 *
 * Story 4.5: Task 6 - Effort and Priority Badge Components (AC38)
 * AC38: Effort level shown with color-coded badges (LOW=green, MEDIUM=yellow, HIGH=orange, VERY_HIGH=red)
 *
 * @see Story 4.5: Remediation Options Management
 */

import { Zap, Clock, Calendar, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EffortLevel } from "@prisma/client";

/**
 * Configuration for each effort level
 * Includes color, icon, label, and tooltip description
 */
const effortLevelConfig: Record<
  EffortLevel,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Zap;
    label: string;
    timeframe: string;
    description: string;
  }
> = {
  LOW: {
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-transparent",
    icon: Zap,
    label: "Low",
    timeframe: "< 1 week",
    description:
      "Quick implementation. Minimal resources required. Can be completed within a few days.",
  },
  MEDIUM: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-transparent",
    icon: Clock,
    label: "Medium",
    timeframe: "1-4 weeks",
    description:
      "Moderate effort. Requires planning and some dedicated resources. Typical project timeline.",
  },
  HIGH: {
    color: "text-severity-high",
    bgColor: "bg-severity-high/10",
    borderColor: "border-transparent",
    icon: Calendar,
    label: "High",
    timeframe: "1-3 months",
    description:
      "Significant effort. Requires substantial resources, coordination, and project management.",
  },
  VERY_HIGH: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-transparent",
    icon: AlertTriangle,
    label: "Very High",
    timeframe: "> 3 months",
    description:
      "Major undertaking. Large-scale project requiring extensive resources, budget, and cross-team coordination.",
  },
};

interface EffortLevelBadgeProps {
  /** The effort level to display */
  effortLevel: EffortLevel;
  /** Whether to show the label text (default: true) */
  showLabel?: boolean;
  /** Whether to show the timeframe text (default: true) */
  showTimeframe?: boolean;
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
 * Displays an effort level badge with color coding, icon, and optional tooltip.
 *
 * @example
 * ```tsx
 * <EffortLevelBadge effortLevel="LOW" />
 * <EffortLevelBadge effortLevel="MEDIUM" showTooltip={false} />
 * <EffortLevelBadge effortLevel="HIGH" size="lg" />
 * ```
 */
export function EffortLevelBadge({
  effortLevel,
  showLabel = true,
  showTimeframe = true,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: EffortLevelBadgeProps) {
  const config = effortLevelConfig[effortLevel];
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
      {showLabel && (
        <span>
          {config.label}
          {showTimeframe && (
            <span className="opacity-70 ml-1">({config.timeframe})</span>
          )}
        </span>
      )}
      {!showLabel && showIcon && (
        <span className="sr-only">{config.label} effort level</span>
      )}
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">
              {config.label} Effort ({config.timeframe})
            </p>
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
 * Export the effort level configuration for use elsewhere
 */
export { effortLevelConfig };
