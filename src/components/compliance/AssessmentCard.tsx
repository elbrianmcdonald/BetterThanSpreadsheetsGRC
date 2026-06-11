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
    color: "text-secondary-foreground",
    bgColor: "bg-muted border-transparent",
    icon: FileText,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-primary",
    bgColor: "bg-primary/10 border-transparent",
    icon: Clock,
  },
  IN_REVIEW: {
    label: "In Review",
    color: "text-warning",
    bgColor: "bg-warning/10 border-transparent",
    icon: AlertCircle,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-success",
    bgColor: "bg-success/10 border-transparent",
    icon: CheckCircle2,
  },
  ARCHIVED: {
    label: "Archived",
    color: "text-muted-foreground",
    bgColor: "bg-muted border-transparent",
    icon: FileText,
  },
};

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-success/10";
  if (score >= 60) return "bg-success/10";
  if (score >= 40) return "bg-warning/10";
  return "bg-destructive/10";
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
    <Card className="transition-colors hover:bg-secondary/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="code">
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
            <div className={cn("text-xl font-bold tabular-nums", getScoreColor(complianceScore))}>
              {complianceScore !== null ? `${complianceScore.toFixed(0)}%` : "—"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{assessedCount}/{totalControls} controls</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-2 bg-success/10 rounded-sm">
            <div className="font-bold tabular-nums text-success">{compliantCount}</div>
            <div className="text-success">Compliant</div>
          </div>
          <div className="text-center p-2 bg-warning/10 rounded-sm">
            <div className="font-bold tabular-nums text-warning">{partialCount}</div>
            <div className="text-warning">Partial</div>
          </div>
          <div className="text-center p-2 bg-destructive/10 rounded-sm">
            <div className="font-bold tabular-nums text-destructive">{nonCompliantCount}</div>
            <div className="text-destructive">Non-Compl.</div>
          </div>
          <div className="text-center p-2 bg-secondary rounded-sm">
            <div className="font-bold tabular-nums text-foreground">{notAssessedCount}</div>
            <div className="text-muted-foreground">Unscored</div>
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
              <div className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span className="tabular-nums">{gapCount} gaps</span>
              </div>
            )}
            <span className="font-mono tabular-nums">{format(new Date(createdAt), "MMM d, yyyy")}</span>
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
