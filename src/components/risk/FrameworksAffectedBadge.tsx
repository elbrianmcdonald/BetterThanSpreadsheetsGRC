"use client";

/**
 * Frameworks Affected Badge Component
 *
 * Displays the count and list of frameworks affected by a risk.
 *
 * Story 4.7: Frameworks Affected Calculation (AC18-AC21)
 * AC18: Frameworks affected count calculated from linked evidence control mappings
 * AC21: Frameworks affected displayed as badge list on risk detail page
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Get color based on frameworks count
 * AC3: (# frameworks) x 20, max 100 for 5+ frameworks
 */
function getFrameworksColor(count: number): {
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (count >= 5) {
    return {
      color: "text-red-700 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-200 dark:border-red-800",
    };
  }
  if (count >= 3) {
    return {
      color: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      borderColor: "border-amber-200 dark:border-amber-800",
    };
  }
  if (count >= 1) {
    return {
      color: "text-blue-700 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    };
  }
  return {
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    borderColor: "border-gray-200 dark:border-gray-700",
  };
}

interface FrameworksAffectedBadgeProps {
  /** Number of frameworks affected */
  count: number;
  /** List of framework names */
  frameworkNames?: string[];
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
 * Displays the number of frameworks affected with a tooltip listing them.
 *
 * @example
 * ```tsx
 * <FrameworksAffectedBadge count={3} frameworkNames={['SOC 2', 'ISO 27001', 'NIST CSF']} />
 * <FrameworksAffectedBadge count={0} />
 * ```
 */
export function FrameworksAffectedBadge({
  count,
  frameworkNames = [],
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: FrameworksAffectedBadgeProps) {
  const colors = getFrameworksColor(count);
  // Calculate the score (count x 20, max 100)
  const score = Math.min(count * 20, 100);

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
        colors.color,
        colors.bgColor,
        colors.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Shield className={cn(iconSizes[size], "shrink-0")} />}
      <span>
        {count} {count === 1 ? "Framework" : "Frameworks"}
      </span>
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">
              Compliance Impact (Score: {score})
            </p>
            {frameworkNames.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  Affects these frameworks:
                </p>
                <ul className="text-xs mt-1 space-y-0.5">
                  {frameworkNames.map((name, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                No compliance frameworks affected. Link evidence with control
                mappings to calculate framework impact.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Full display of affected frameworks as a list of badges
 * AC21: Frameworks affected displayed as badge list on risk detail page
 */
export function FrameworksAffectedList({
  frameworkNames,
  className,
}: {
  frameworkNames: string[];
  className?: string;
}) {
  if (frameworkNames.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No frameworks affected
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {frameworkNames.map((name, i) => (
        <Badge
          key={i}
          variant="outline"
          className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
        >
          <Shield className="h-3 w-3 mr-1" />
          {name}
        </Badge>
      ))}
    </div>
  );
}
