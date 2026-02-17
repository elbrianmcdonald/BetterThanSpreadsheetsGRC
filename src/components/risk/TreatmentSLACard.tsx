"use client";

/**
 * Treatment SLA Card Component
 *
 * Story 16.8: Treatment SLA Display & Alerts (AC4)
 *
 * Displays treatment SLA status on risk detail page:
 * - Active treatment info with due date
 * - SLA status (On Track, At Risk, Breached)
 * - Days remaining or overdue
 * - Treatment type and decision info
 *
 * @see Story 16.8: Treatment SLA Display & Alerts
 */

import { format, differenceInDays } from "date-fns";
import {
  Clock,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  ArrowRightLeft,
  Loader2,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TreatmentSLACardProps {
  /** Risk ID */
  riskId: string;
  /** Additional CSS classes */
  className?: string;
}

/** Treatment type configuration */
const treatmentTypeConfig = {
  ACCEPT: {
    label: "Accepted",
    icon: CheckCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  REMEDIATE: {
    label: "Remediation",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  TRANSFER: {
    label: "Transferred",
    icon: ArrowRightLeft,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  AVOID: {
    label: "Avoided",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

/** SLA status configuration */
const slaStatusConfig = {
  on_track: {
    label: "On Track",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: CheckCircle,
  },
  at_risk: {
    label: "At Risk",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: AlertTriangle,
  },
  breached: {
    label: "SLA Breached",
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: XCircle,
  },
  completed: {
    label: "Completed",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: CheckCircle,
  },
};

/**
 * Calculate SLA status based on due date
 */
function getSLAStatus(dueDate: Date | null, completedAt: Date | null): {
  status: "on_track" | "at_risk" | "breached" | "completed";
  daysRemaining: number | null;
  daysOverdue: number | null;
} {
  if (completedAt) {
    return { status: "completed", daysRemaining: null, daysOverdue: null };
  }

  if (!dueDate) {
    return { status: "on_track", daysRemaining: null, daysOverdue: null };
  }

  const days = differenceInDays(new Date(dueDate), new Date());

  if (days < 0) {
    return { status: "breached", daysRemaining: null, daysOverdue: Math.abs(days) };
  } else if (days <= 3) {
    return { status: "at_risk", daysRemaining: days, daysOverdue: null };
  } else {
    return { status: "on_track", daysRemaining: days, daysOverdue: null };
  }
}

export function TreatmentSLACard({ riskId, className }: TreatmentSLACardProps) {
  // Fetch treatments for this risk
  const { data: treatments, isLoading } = api.risk.getTreatments.useQuery(
    { riskId },
    { enabled: !!riskId }
  );

  // Get the most recent active treatment (not completed)
  const activeTreatment = treatments?.find((t) => !t.completedAt);
  const latestTreatment = treatments?.[0]; // Most recent treatment

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Treatment SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No treatments yet
  if (!treatments || treatments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Treatment SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-2">
            No treatment decision yet.
          </p>
          <Button variant="outline" size="sm" className="w-full mt-2" asChild>
            <Link href={`/risks/${riskId}/treatment`}>
              Start Treatment
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show active or latest treatment
  const treatment = activeTreatment ?? latestTreatment;
  if (!treatment) return null;

  const typeConfig = treatmentTypeConfig[treatment.treatmentType as keyof typeof treatmentTypeConfig];
  const TypeIcon = typeConfig?.icon ?? Shield;

  const slaInfo = getSLAStatus(
    treatment.dueDate ? new Date(treatment.dueDate) : null,
    treatment.completedAt ? new Date(treatment.completedAt) : null
  );
  const statusConfig = slaStatusConfig[slaInfo.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Treatment SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Treatment Type */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Treatment</span>
          <Badge className={cn("gap-1", typeConfig?.bgColor, typeConfig?.color)}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig?.label ?? treatment.treatmentType}
          </Badge>
        </div>

        {/* SLA Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">SLA Status</span>
          <Badge className={cn("gap-1", statusConfig.bgColor, statusConfig.color)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Due Date */}
        {treatment.dueDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due Date
            </span>
            <span className="text-sm font-medium">
              {format(new Date(treatment.dueDate), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Expected Residual Severity */}
        {treatment.residualScoreLabel && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Expected Residual
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                treatment.residualScoreLabel === "Critical" && "border-red-500 text-red-600",
                treatment.residualScoreLabel === "High" && "border-orange-500 text-orange-600",
                treatment.residualScoreLabel === "Medium" && "border-yellow-500 text-yellow-600",
                treatment.residualScoreLabel === "Low" && "border-green-500 text-green-600"
              )}
            >
              {treatment.residualScoreLabel}
              {treatment.residualScore && (
                <span className="ml-1 text-muted-foreground">
                  ({Number(treatment.residualScore).toFixed(1)})
                </span>
              )}
            </Badge>
          </div>
        )}

        {/* Days Remaining/Overdue */}
        {slaInfo.daysRemaining !== null && (
          <div className={cn(
            "text-center py-2 rounded-md text-sm font-medium",
            slaInfo.status === "at_risk" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          )}>
            {slaInfo.daysRemaining} days remaining
          </div>
        )}

        {slaInfo.daysOverdue !== null && (
          <div className="text-center py-2 rounded-md text-sm font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {slaInfo.daysOverdue} days overdue
          </div>
        )}

        {/* Completed Date */}
        {treatment.completedAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completed</span>
            <span className="text-sm font-medium text-green-600">
              {format(new Date(treatment.completedAt), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Decided By */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Decided by</span>
          <span>{treatment.decidedBy?.name ?? treatment.decidedBy?.email ?? "Unknown"}</span>
        </div>

        {/* Justification (if short enough) */}
        {treatment.justification && treatment.justification.length <= 100 && (
          <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
            <span className="font-medium">Note:</span> {treatment.justification}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
