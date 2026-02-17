"use client";

/**
 * Audit Proximity Badge Component
 *
 * Displays audit proximity with color-coded badges based on days until next audit.
 *
 * Story 4.7: Audit Proximity Field (AC13-AC17)
 * AC14: Audit proximity calculated from days between now and nextAuditDate
 * AC17: Audit proximity shown as "X days until audit" on risk detail page
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import { Calendar, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Get audit proximity tier based on days until audit
 * AC5: <30=100, 30-60=75, 60-90=50, >90=25, null=0
 */
function getAuditProximityTier(daysUntilAudit: number | null): {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Calendar;
  label: string;
  description: string;
  score: number;
} {
  if (daysUntilAudit === null) {
    return {
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-100 dark:bg-gray-800/50",
      borderColor: "border-gray-200 dark:border-gray-700",
      icon: Calendar,
      label: "No Audit",
      description: "No audit date scheduled",
      score: 0,
    };
  }

  if (daysUntilAudit < 0) {
    return {
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
      borderColor: "border-purple-200 dark:border-purple-800",
      icon: CheckCircle,
      label: "Past",
      description: "Audit date has passed",
      score: 0,
    };
  }

  if (daysUntilAudit < 30) {
    return {
      color: "text-red-700 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-200 dark:border-red-800",
      icon: AlertTriangle,
      label: "Urgent",
      description: "Less than 30 days until audit",
      score: 100,
    };
  }

  if (daysUntilAudit < 60) {
    return {
      color: "text-orange-700 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      borderColor: "border-orange-200 dark:border-orange-800",
      icon: Clock,
      label: "Soon",
      description: "30-60 days until audit",
      score: 75,
    };
  }

  if (daysUntilAudit < 90) {
    return {
      color: "text-amber-700 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      borderColor: "border-amber-200 dark:border-amber-800",
      icon: Calendar,
      label: "Upcoming",
      description: "60-90 days until audit",
      score: 50,
    };
  }

  return {
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-800",
    icon: Calendar,
    label: "Planned",
    description: "More than 90 days until audit",
    score: 25,
  };
}

interface AuditProximityBadgeProps {
  /** The next audit date (null if not scheduled) */
  nextAuditDate: Date | null;
  /** Pre-calculated days until audit (optional, will be calculated if not provided) */
  daysUntilAudit?: number | null;
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
 * Displays an audit proximity badge with color coding and days until audit.
 *
 * @example
 * ```tsx
 * <AuditProximityBadge nextAuditDate={new Date('2024-02-15')} />
 * <AuditProximityBadge nextAuditDate={null} />
 * ```
 */
export function AuditProximityBadge({
  nextAuditDate,
  daysUntilAudit: providedDays,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: AuditProximityBadgeProps) {
  // Calculate days if not provided
  const daysUntilAudit =
    providedDays !== undefined
      ? providedDays
      : nextAuditDate
        ? Math.floor(
            (nextAuditDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null;

  const tier = getAuditProximityTier(daysUntilAudit);
  const Icon = tier.icon;

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

  // Format display text
  const displayText =
    daysUntilAudit === null
      ? "No Audit Scheduled"
      : daysUntilAudit < 0
        ? `${Math.abs(daysUntilAudit)}d ago`
        : daysUntilAudit === 0
          ? "Today"
          : daysUntilAudit === 1
            ? "Tomorrow"
            : `${daysUntilAudit}d`;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium gap-1",
        tier.color,
        tier.bgColor,
        tier.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], "shrink-0")} />}
      <span>{displayText}</span>
    </Badge>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">
              Audit Proximity: {tier.label} (Score: {tier.score})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tier.description}
            </p>
            {nextAuditDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Audit Date: {nextAuditDate.toLocaleDateString()}
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
 * Compact text display for audit proximity
 * AC17: "X days until audit" display
 */
export function AuditProximityText({
  nextAuditDate,
  daysUntilAudit: providedDays,
  className,
}: {
  nextAuditDate: Date | null;
  daysUntilAudit?: number | null;
  className?: string;
}) {
  const daysUntilAudit =
    providedDays !== undefined
      ? providedDays
      : nextAuditDate
        ? Math.floor(
            (nextAuditDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null;

  const tier = getAuditProximityTier(daysUntilAudit);

  if (daysUntilAudit === null) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        No audit scheduled
      </span>
    );
  }

  if (daysUntilAudit < 0) {
    return (
      <span className={cn(tier.color, className)}>
        Audit was {Math.abs(daysUntilAudit)} days ago
      </span>
    );
  }

  if (daysUntilAudit === 0) {
    return <span className={cn(tier.color, "font-medium", className)}>Audit today</span>;
  }

  if (daysUntilAudit === 1) {
    return <span className={cn(tier.color, "font-medium", className)}>Audit tomorrow</span>;
  }

  return (
    <span className={cn(tier.color, className)}>
      {daysUntilAudit} days until audit
    </span>
  );
}
