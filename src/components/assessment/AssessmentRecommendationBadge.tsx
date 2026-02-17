/**
 * Assessment Recommendation Badge Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.4: Assessment Scoring and Recommendation (FR21, FR22)
 *
 * Displays assessment recommendation with appropriate styling.
 */

import { VendorAssessmentRecommendation } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

interface AssessmentRecommendationBadgeProps {
  recommendation: VendorAssessmentRecommendation | null;
  className?: string;
  showIcon?: boolean;
}

const RECOMMENDATION_CONFIG: Record<
  VendorAssessmentRecommendation,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  APPROVE: {
    label: "Approved",
    variant: "default",
    className: "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
    icon: CheckCircle2,
  },
  CONDITIONAL_APPROVE: {
    label: "Conditional Approval",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
    icon: AlertCircle,
  },
  REJECT: {
    label: "Rejected",
    variant: "destructive",
    className: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
    icon: XCircle,
  },
};

export function AssessmentRecommendationBadge({
  recommendation,
  className,
  showIcon = true,
}: AssessmentRecommendationBadgeProps) {
  if (!recommendation) {
    return (
      <Badge variant="secondary" className={cn("font-medium text-muted-foreground", className)}>
        Pending
      </Badge>
    );
  }

  const config = RECOMMENDATION_CONFIG[recommendation];
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
 * Get all assessment recommendation options for select/dropdown
 */
export function getAssessmentRecommendationOptions() {
  return Object.entries(RECOMMENDATION_CONFIG).map(([value, config]) => ({
    value: value as VendorAssessmentRecommendation,
    label: config.label,
  }));
}
