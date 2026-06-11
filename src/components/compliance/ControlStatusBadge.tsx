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
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-transparent",
    icon: CheckCircle,
  },
  NON_COMPLIANT: {
    label: "Non-Compliant",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-transparent",
    icon: XCircle,
  },
  PARTIALLY_COMPLIANT: {
    label: "Partial",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-transparent",
    icon: AlertCircle,
  },
  NOT_APPLICABLE: {
    label: "N/A",
    color: "text-secondary-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    icon: MinusCircle,
  },
  NOT_ASSESSED: {
    label: "Not Assessed",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
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
