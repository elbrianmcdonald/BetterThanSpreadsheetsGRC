/**
 * Assessment Status Badge Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.3: Assessment Status Workflow (FR20)
 *
 * Displays assessment status with appropriate styling.
 */

import { VendorAssessmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileEdit,
  PlayCircle,
  Search,
  CheckCircle2,
} from "lucide-react";

interface AssessmentStatusBadgeProps {
  status: VendorAssessmentStatus;
  className?: string;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  VendorAssessmentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200",
    icon: FileEdit,
  },
  IN_PROGRESS: {
    label: "In Progress",
    variant: "default",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200",
    icon: PlayCircle,
  },
  IN_REVIEW: {
    label: "In Review",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
    icon: Search,
  },
  COMPLETED: {
    label: "Completed",
    variant: "default",
    className: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
    icon: CheckCircle2,
  },
};

export function AssessmentStatusBadge({
  status,
  className,
  showIcon = true,
}: AssessmentStatusBadgeProps) {
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
 * Get all assessment status options for select/dropdown
 */
export function getAssessmentStatusOptions() {
  return Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value: value as VendorAssessmentStatus,
    label: config.label,
  }));
}
