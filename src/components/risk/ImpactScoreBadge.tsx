"use client";

/**
 * Impact Score Badge Component
 *
 * Compact badge display of impact score for list views and tables.
 *
 * Story 4.7: Impact Score Display (AC22-AC26)
 * AC23: Impact score shown with color coding (0-39=green, 40-69=yellow, 70-100=red)
 * AC25: Risk list pages sortable by impact score (highest first)
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getImpactScoreColor } from "./ImpactScoreDisplay";

interface ImpactScoreBadgeProps {
  /** The calculated impact score (0-100) */
  score: number;
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
 * Compact impact score badge for list views.
 *
 * @example
 * ```tsx
 * <ImpactScoreBadge score={87} />
 * <ImpactScoreBadge score={45} showIcon={false} />
 * ```
 */
export function ImpactScoreBadge({
  score,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: ImpactScoreBadgeProps) {
  const colors = getImpactScoreColor(score);

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
        colors.text,
        colors.bg,
        colors.border,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Zap className={cn(iconSizes[size], "shrink-0")} />}
      <span>{score}</span>
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">Impact Score: {score}/100</p>
            <p className="text-xs text-muted-foreground mt-1">
              {colors.label} priority risk. Higher scores indicate greater urgency.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * Just the colored dot indicator for impact score
 * Useful for very compact table displays
 */
export function ImpactScoreDot({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const colors = getImpactScoreColor(score);

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        score >= 70 && "bg-destructive",
        score >= 40 && score < 70 && "bg-warning",
        score < 40 && "bg-success",
        className
      )}
      title={`Impact Score: ${score}/100 (${colors.label})`}
    />
  );
}
