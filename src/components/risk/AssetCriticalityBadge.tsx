"use client";

/**
 * Asset Criticality Badge Component
 *
 * Displays asset criticality level with color-coded badges and icons.
 *
 * Story 4.7: Asset Criticality Field (AC8-AC12)
 * AC8: Risk model includes assetCriticality field (enum: CRITICAL, HIGH, MEDIUM, LOW, NONE)
 * AC10: Asset criticality shown with color-coded badges on risk detail page
 * AC12: Asset criticality help text explains business impact levels
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import { Building, AlertCircle, AlertTriangle, Info, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AssetCriticality } from "@prisma/client";

/**
 * Configuration for each asset criticality level
 * AC12: Help text explains business impact levels
 */
const criticalityConfig: Record<
  AssetCriticality,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof AlertCircle;
    label: string;
    description: string;
    score: number;
  }
> = {
  CRITICAL: {
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-transparent",
    icon: AlertCircle,
    label: "Critical",
    description:
      "Core business systems. Downtime causes immediate, significant financial or operational impact. Customer-facing production systems, payment processing, core databases.",
    score: 100,
  },
  HIGH: {
    color: "text-severity-high",
    bgColor: "bg-severity-high/10",
    borderColor: "border-transparent",
    icon: AlertTriangle,
    label: "High",
    description:
      "Important business systems. Downtime causes significant disruption but workarounds exist. Internal tools, secondary services, non-core customer features.",
    score: 75,
  },
  MEDIUM: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-transparent",
    icon: Building,
    label: "Medium",
    description:
      "Standard business systems. Downtime is inconvenient but manageable. Development environments, internal dashboards, monitoring tools.",
    score: 50,
  },
  LOW: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-transparent",
    icon: Info,
    label: "Low",
    description:
      "Non-essential systems. Downtime has minimal business impact. Archive systems, test environments, deprecated services.",
    score: 25,
  },
  NONE: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    icon: MinusCircle,
    label: "None",
    description:
      "No direct business impact. Informational assets, documentation, or assets pending decommission.",
    score: 0,
  },
};

interface AssetCriticalityBadgeProps {
  /** The asset criticality level to display */
  criticality: AssetCriticality;
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
 * Displays an asset criticality badge with color coding, icon, and optional tooltip.
 *
 * @example
 * ```tsx
 * <AssetCriticalityBadge criticality="CRITICAL" />
 * <AssetCriticalityBadge criticality="MEDIUM" showTooltip={false} />
 * <AssetCriticalityBadge criticality="LOW" size="lg" />
 * ```
 */
export function AssetCriticalityBadge({
  criticality,
  showLabel = true,
  showIcon = true,
  showTooltip = true,
  size = "default",
  className,
}: AssetCriticalityBadgeProps) {
  const config = criticalityConfig[criticality];
  const Icon = config.icon;

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
        <span className="sr-only">{config.label} criticality</span>
      )}
    </Badge>
  );

  // AC12: Add tooltip with business impact description
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium">
              {config.label} Criticality (Score: {config.score})
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
 * Returns just the color dot for criticality without badge styling
 * Useful for inline displays like tables
 */
export function AssetCriticalityDot({
  criticality,
  className,
}: {
  criticality: AssetCriticality;
  className?: string;
}) {
  const config = criticalityConfig[criticality];

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        criticality === "CRITICAL" && "bg-destructive",
        criticality === "HIGH" && "bg-severity-high",
        criticality === "MEDIUM" && "bg-warning",
        criticality === "LOW" && "bg-primary",
        criticality === "NONE" && "bg-muted-foreground/40",
        className
      )}
      title={`${config.label} criticality`}
    />
  );
}

/**
 * Export the criticality configuration for use elsewhere
 */
export { criticalityConfig };
