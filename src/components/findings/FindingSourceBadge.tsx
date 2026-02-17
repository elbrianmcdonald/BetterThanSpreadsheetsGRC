"use client";

/**
 * Finding Source Badge Component
 *
 * Story 7.12: Findings List Page (AC7)
 *
 * Displays finding source as a color-coded badge.
 */

import { FindingSource } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Shield,
  Bug,
  ClipboardCheck,
  FileText,
  Scan,
  AlertTriangle,
} from "lucide-react";

/**
 * Configuration for each finding source
 * Matches FindingSource enum in prisma/schema.prisma
 */
const SOURCE_CONFIG: Record<
  FindingSource,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Shield;
  }
> = {
  [FindingSource.AUDIT]: {
    label: "Audit",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-300 dark:border-purple-600",
    icon: ClipboardCheck,
  },
  [FindingSource.PENTEST]: {
    label: "Pentest",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-300 dark:border-red-600",
    icon: Bug,
  },
  [FindingSource.SCANNER]: {
    label: "Scanner",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    borderColor: "border-orange-300 dark:border-orange-600",
    icon: Scan,
  },
  [FindingSource.INCIDENT]: {
    label: "Incident",
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
    borderColor: "border-rose-300 dark:border-rose-600",
    icon: AlertTriangle,
  },
  [FindingSource.MANUAL]: {
    label: "Manual",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-300 dark:border-blue-600",
    icon: FileText,
  },
};

interface FindingSourceBadgeProps {
  source: FindingSource;
  showIcon?: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function FindingSourceBadge({
  source,
  showIcon = true,
  size = "default",
  className,
}: FindingSourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs px-2 py-0.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
  };

  return (
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
      <span>{config.label}</span>
    </Badge>
  );
}

export { SOURCE_CONFIG };
