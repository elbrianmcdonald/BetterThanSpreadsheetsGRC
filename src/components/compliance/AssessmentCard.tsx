"use client";

/**
 * Assessment Card Component
 *
 * Displays a compliance assessment with its progress, compliance score,
 * and status. Links to the assessment detail page for full scoring.
 */

import Link from "next/link";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Target,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { ComplianceAssessmentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface AssessmentCardProps {
  /** Assessment ID */
  id: string;
  /** Assessment identifier (e.g., COMP-2026-0001) */
  identifier: string;
  /** Assessment name */
  name: string;
  /** Assessment status */
  status: ComplianceAssessmentStatus;
  /** Framework name */
  frameworkName: string;
  /** Framework code */
  frameworkCode: string;
  /** Business unit name (optional) */
  businessUnitName?: string | null;
  /** Business unit code (optional) */
  businessUnitCode?: string | null;
  /** Total controls in assessment */
  totalControls: number;
  /** Controls not yet assessed */
  notAssessedCount: number;
  /** Compliant control count */
  compliantCount: number;
  /** Non-compliant control count */
  nonCompliantCount: number;
  /** Partially compliant control count */
  partialCount: number;
  /** Compliance score (0-100) */
  complianceScore: number | null;
  /** Owner name */
  ownerName?: string | null;
  /** Created date */
  createdAt: Date;
  /** Due date */
  dueDate?: Date | null;
}

const statusConfig: Record<
  ComplianceAssessmentStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: FileText,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Clock,
  },
  IN_REVIEW: {
    label: "In Review",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: AlertCircle,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  ARCHIVED: {
    label: "Archived",
    color: "text-slate-500",
    bgColor: "bg-slate-100",
    icon: FileText,
  },
};

function getScoreColor(score: number | null): string {
  if (score === null) return "text-gray-500";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-lime-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-gray-100";
  if (score >= 80) return "bg-green-100";
  if (score >= 60) return "bg-lime-100";
  if (score >= 40) return "bg-amber-100";
  return "bg-red-100";
}

export function AssessmentCard({
  id,
  identifier,
  name,
  status,
  frameworkName,
  frameworkCode,
  businessUnitName,
  businessUnitCode,
  totalControls,
  notAssessedCount,
  compliantCount,
  nonCompliantCount,
  partialCount,
  complianceScore,
  ownerName,
  createdAt,
  dueDate,
}: AssessmentCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const assessedCount = totalControls - notAssessedCount;
  const progress = totalControls > 0 ? (assessedCount / totalControls) * 100 : 0;
  const gapCount = nonCompliantCount + partialCount;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {frameworkCode}
              </Badge>
              <Badge className={cn(config.color, config.bgColor)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {businessUnitName && (
                <Badge variant="secondary" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {businessUnitCode || businessUnitName}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {identifier}
            </CardDescription>
          </div>
          {/* Compliance Score */}
          <div className={cn(
            "text-center px-3 py-2 rounded-lg",
            getScoreBgColor(complianceScore)
          )}>
            <div className={cn("text-xl font-bold", getScoreColor(complianceScore))}>
              {complianceScore !== null ? `${complianceScore.toFixed(0)}%` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{assessedCount}/{totalControls} controls</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-bold text-green-700">{compliantCount}</div>
            <div className="text-green-600">Compliant</div>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded">
            <div className="font-bold text-amber-700">{partialCount}</div>
            <div className="text-amber-600">Partial</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="font-bold text-red-700">{nonCompliantCount}</div>
            <div className="text-red-600">Non-Compl.</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-bold text-gray-700">{notAssessedCount}</div>
            <div className="text-gray-600">Unscored</div>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          {ownerName && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{ownerName}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {gapCount > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{gapCount} gaps</span>
              </div>
            )}
            <span>{format(new Date(createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* View Button */}
        <Link href={`/compliance/assessments/${id}`}>
          <Button variant="outline" size="sm" className="w-full">
            View Assessment
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
