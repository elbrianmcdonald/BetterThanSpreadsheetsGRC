"use client";

/**
 * Control Status Badge Component
 *
 * Displays a badge indicating the compliance status of a control.
 * Color-coded for quick visual identification.
 */

import { ComplianceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  MinusCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlStatusBadgeProps {
  status: ComplianceStatus;
  showIcon?: boolean;
  className?: string;
}

/**
 * Configuration for each compliance status
 */
export const complianceStatusConfig: Record<
  ComplianceStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof CheckCircle;
  }
> = {
  COMPLIANT: {
    label: "Compliant",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-800",
    icon: CheckCircle,
  },
  NON_COMPLIANT: {
    label: "Non-Compliant",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: XCircle,
  },
  PARTIALLY_COMPLIANT: {
    label: "Partial",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
  },
  NOT_APPLICABLE: {
    label: "N/A",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800/30",
    borderColor: "border-gray-200 dark:border-gray-700",
    icon: MinusCircle,
  },
  NOT_ASSESSED: {
    label: "Not Assessed",
    color: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/30",
    borderColor: "border-slate-200 dark:border-slate-700",
    icon: HelpCircle,
  },
};

export function ControlStatusBadge({
  status,
  showIcon = true,
  className,
}: ControlStatusBadgeProps) {
  const config = complianceStatusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        config.color,
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
