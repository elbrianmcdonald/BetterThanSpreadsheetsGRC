/**
 * Vendor Status Badge Component
 *
 * Epic 1: TPRM Vendor Registry
 * Story 1.5: Vendor Status Management (FR5)
 *
 * Displays vendor status with appropriate styling.
 */

import { VendorStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  PauseCircle,
  Search,
  XCircle,
} from "lucide-react";

interface VendorStatusBadgeProps {
  status: VendorStatus;
  className?: string;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  VendorStatus,
  {
    label: string;
    variant: "success" | "neutral" | "warning" | "critical";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ACTIVE: {
    label: "Active",
    variant: "success",
    className: "",
    icon: CheckCircle2,
  },
  INACTIVE: {
    label: "Inactive",
    variant: "neutral",
    className: "",
    icon: PauseCircle,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    variant: "warning",
    className: "",
    icon: Search,
  },
  OFFBOARDED: {
    label: "Offboarded",
    variant: "critical",
    className: "",
    icon: XCircle,
  },
};

export function VendorStatusBadge({
  status,
  className,
  showIcon = true,
}: VendorStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, "font-medium", className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

/**
 * Get all vendor status options for select/dropdown
 */
export function getVendorStatusOptions() {
  return Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value: value as VendorStatus,
    label: config.label,
  }));
}
