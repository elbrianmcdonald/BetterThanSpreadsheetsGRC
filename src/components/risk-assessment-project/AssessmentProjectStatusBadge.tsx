/**
 * Assessment Project Status Badge Component
 *
 * Displays a styled badge for assessment project status
 */

import { AssessmentProjectStatus } from "@prisma/client";
import { Clock, Send, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StatusConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  className: string;
}

const statusConfig: Record<AssessmentProjectStatus, StatusConfig> = {
  IN_PROGRESS: {
    label: "In Progress",
    description: "Analyst actively discovering risks",
    icon: Clock,
    badgeVariant: "secondary",
    className: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100",
  },
  SUBMITTED: {
    label: "Submitted",
    description: "Submitted for manager review",
    icon: Send,
    badgeVariant: "secondary",
    className: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100",
  },
  APPROVED: {
    label: "Approved",
    description: "Manager approved, risks published to register",
    icon: CheckCircle,
    badgeVariant: "secondary",
    className: "bg-green-100 text-green-800 border-green-300 hover:bg-green-100",
  },
};

interface AssessmentProjectStatusBadgeProps {
  status: AssessmentProjectStatus;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

export function AssessmentProjectStatusBadge({
  status,
  showIcon = true,
  size = "md",
  showTooltip = true,
}: AssessmentProjectStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const badge = (
    <Badge
      variant={config.badgeVariant}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border",
        sizeClasses[size],
        config.className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
