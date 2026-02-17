"use client";

/**
 * Assessment Summary Card Component
 *
 * Story 16.10: Risk Assessment Summary & Overall Severity
 *
 * Displays summary information for a risk assessment:
 * - AC5: Summary card on assessment detail page
 * - AC6: Shows: Total risks, Overall severity badge, Business owner, Business unit
 * - AC7: Risk breakdown by severity (e.g., "2 Critical, 3 High, 1 Medium")
 * - AC8: "Add Risk" button prominent
 *
 * @see Story 16.10: Risk Assessment Summary & Overall Severity
 */

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Building2,
  AlertTriangle,
  Plus,
  Loader2,
  ChevronRight,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AssessmentSummaryCardProps {
  /** Assessment ID */
  assessmentId: string;
  /** Whether the card is read-only */
  isReadOnly?: boolean;
  /** Callback when "Add Risk" is clicked */
  onAddRisk?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get severity badge variant based on severity label
 */
function getSeverityVariant(severity: string | null): "destructive" | "default" | "secondary" | "outline" {
  if (!severity) return "outline";
  const lowerSeverity = severity.toLowerCase();
  if (lowerSeverity === "critical") return "destructive";
  if (lowerSeverity === "high") return "destructive";
  if (lowerSeverity === "medium") return "default";
  return "secondary";
}

/**
 * Get severity badge color classes
 */
function getSeverityColorClass(severity: string | null): string {
  if (!severity) return "bg-muted text-muted-foreground";
  const lowerSeverity = severity.toLowerCase();
  if (lowerSeverity === "critical") return "bg-red-600 text-white";
  if (lowerSeverity === "high") return "bg-orange-500 text-white";
  if (lowerSeverity === "medium") return "bg-yellow-500 text-white";
  if (lowerSeverity === "low") return "bg-green-500 text-white";
  if (lowerSeverity === "info") return "bg-blue-500 text-white";
  return "bg-muted text-muted-foreground";
}

export function AssessmentSummaryCard({
  assessmentId,
  isReadOnly = false,
  onAddRisk,
  className,
}: AssessmentSummaryCardProps) {
  const { data, isLoading, error } = api.riskAssessment.getSummary.useQuery(
    { assessmentId },
    { enabled: !!assessmentId }
  );

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mr-2" />
          Failed to load assessment summary
        </CardContent>
      </Card>
    );
  }

  const { assessment, totalRisks, severityBreakdown, childRisks } = data;

  // Build severity breakdown text (AC7)
  const criticalCount = severityBreakdown.Critical ?? 0;
  const highCount = severityBreakdown.High ?? 0;
  const mediumCount = severityBreakdown.Medium ?? 0;
  const lowCount = severityBreakdown.Low ?? 0;
  const infoCount = severityBreakdown.Info ?? 0;

  const breakdownParts: string[] = [];
  if (criticalCount > 0) breakdownParts.push(`${criticalCount} Critical`);
  if (highCount > 0) breakdownParts.push(`${highCount} High`);
  if (mediumCount > 0) breakdownParts.push(`${mediumCount} Medium`);
  if (lowCount > 0) breakdownParts.push(`${lowCount} Low`);
  if (infoCount > 0) breakdownParts.push(`${infoCount} Info`);
  const breakdownText = breakdownParts.length > 0 ? breakdownParts.join(", ") : "No risks categorized";

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Assessment Summary
          </CardTitle>
          {/* AC6: Overall severity badge */}
          {assessment.overallSeverityLabel && (
            <Badge className={getSeverityColorClass(assessment.overallSeverityLabel)}>
              {assessment.overallSeverityLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AC6: Total risks count */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Total Risks</span>
          </div>
          <span className="text-2xl font-bold">{totalRisks}</span>
        </div>

        {/* AC7: Risk breakdown by severity */}
        {totalRisks > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Severity Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {criticalCount > 0 && (
                <Badge className="bg-red-600 text-white">
                  {criticalCount} Critical
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-orange-500 text-white">
                  {highCount} High
                </Badge>
              )}
              {mediumCount > 0 && (
                <Badge className="bg-yellow-500 text-white">
                  {mediumCount} Medium
                </Badge>
              )}
              {lowCount > 0 && (
                <Badge className="bg-green-500 text-white">
                  {lowCount} Low
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge className="bg-blue-500 text-white">
                  {infoCount} Info
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* AC6: Business owner */}
        {assessment.businessOwner && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Business Owner:</span>
            <span className="font-medium">{assessment.businessOwner.name || assessment.businessOwner.email}</span>
          </div>
        )}

        {/* AC6: Business unit */}
        {assessment.businessUnit && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Business Unit:</span>
            <span className="font-medium">
              {assessment.businessUnit.name}
              {assessment.businessUnit.code && (
                <span className="text-muted-foreground ml-1">({assessment.businessUnit.code})</span>
              )}
            </span>
          </div>
        )}

        {/* Owner */}
        {assessment.owner && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-medium">{assessment.owner.name || assessment.owner.email}</span>
          </div>
        )}

        {/* Child Risks List (collapsed) */}
        {childRisks.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">Associated Risks</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {childRisks.map((risk) => (
                <Link
                  key={risk.id}
                  href={`/risks/${risk.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-sm"
                >
                  <span className="truncate flex-1">{risk.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {risk.effectiveSeverity}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AC8: Add Risk button prominent */}
        {!isReadOnly && onAddRisk && (
          <Button
            onClick={onAddRisk}
            className="w-full mt-2"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Risk
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of the summary for list views
 */
export function AssessmentSummaryBadge({
  overallSeverityLabel,
  totalRisks,
}: {
  overallSeverityLabel: string | null;
  totalRisks: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {overallSeverityLabel && (
        <Badge className={getSeverityColorClass(overallSeverityLabel)}>
          {overallSeverityLabel}
        </Badge>
      )}
      <span className="text-sm text-muted-foreground">
        {totalRisks} {totalRisks === 1 ? "risk" : "risks"}
      </span>
    </div>
  );
}
