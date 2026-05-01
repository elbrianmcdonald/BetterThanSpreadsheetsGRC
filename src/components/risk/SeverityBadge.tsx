"use client";

/**
 * Severity Badge Component
 *
 * Displays severity level with color-coded badges and icons.
 *
 * Story 4.3: Task 8 - Severity Color Coding (AC12-AC15)
 * AC12: Severity dropdown with 3 options: HIGH (Critical), MEDIUM (Moderate), LOW (Minor)
 * AC14: Severity shown with color-coded badges (HIGH=red, MEDIUM=yellow, LOW=blue)
 * AC15: Severity includes hover tooltips explaining impact levels
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Severity } from "@prisma/client";

/**
 * Configuration for each severity level
 * Includes color, icon, label, and tooltip description
 */
const severityConfig: Record<
  Severity,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof AlertCircle;
    label: string;
    description: string;
  }
> = {
  HIGH: {
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: AlertCircle,
    label: "Critical",
    description:
      "Immediate attention required. Active exploitation possible, critical data at risk, or compliance violation.",
  },
  MEDIUM: {
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
    label: "Moderate",
    description:
      "Should be addressed soon. Potential for exploitation with moderate impact if compromised.",
  },
  LOW: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    icon: Info,
    label: "Minor",
    description:
      "Address when resources allow. Informational or best practice improvement with minimal direct risk.",
  },
};

interface SeverityBadgeProps {
  /** The severity level to display */
  severity: Severity;
  /**
   * Matrix-anchored severity label, e.g. "Critical". When present this
   * replaces the default "HIGH (Critical)" text but the badge colors still
   * come from the underlying enum.
   */
  severityLabel?: string | null;
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
 * Displays a severity badge with color coding, icon, and optional tooltip.
 *
 * @example
 * ```tsx
 * <SeverityBadge severity="HIGH" />
 * <SeverityBadge severity="MEDIUM" showTooltip={false} />
 * <SeverityBadge severity="LOW" size="lg" />
 * ```
 */
export function SeverityBadge({
  severity,
  severityLabel,
  showLabel = true,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: SeverityBadgeProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;
  const trimmedLabel = severityLabel?.trim();
  const hasMatrixLabel = !!trimmedLabel;

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
          {hasMatrixLabel ? (
            trimmedLabel
          ) : (
            <>
              {severity} <span className="opacity-70">({config.label})</span>
            </>
          )}
        </span>
      )}
      {!showLabel && showIcon && (
        <span className="sr-only">
          {hasMatrixLabel ? trimmedLabel : `${severity} severity`}
        </span>
      )}
    </Badge>
  );

  // AC15: Add tooltip with impact description
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">
              {hasMatrixLabel
                ? `${trimmedLabel} (${severity} severity)`
                : `${severity} Severity (${config.label})`}
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
 * Returns just the color dot for severity without badge styling
 * Useful for inline displays like tables
 */
export function SeverityDot({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const config = severityConfig[severity];

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        severity === "HIGH" && "bg-red-500",
        severity === "MEDIUM" && "bg-amber-500",
        severity === "LOW" && "bg-blue-500",
        className
      )}
      title={`${severity} severity (${config.label})`}
    />
  );
}

/**
 * Export the severity configuration for use elsewhere
 */
export { severityConfig };
