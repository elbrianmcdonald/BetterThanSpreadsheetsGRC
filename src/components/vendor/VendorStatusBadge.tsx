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
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ACTIVE: {
    label: "Active",
    variant: "default",
    className: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
    icon: CheckCircle2,
  },
  INACTIVE: {
    label: "Inactive",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200",
    icon: PauseCircle,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
    icon: Search,
  },
  OFFBOARDED: {
    label: "Offboarded",
    variant: "destructive",
    className: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
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
