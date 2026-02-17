"use client";

/**
 * Impact Score Display Component
 *
 * Displays the calculated impact score with color coding and breakdown tooltip.
 *
 * Story 4.7: Impact Score Display (AC22-AC26)
 * AC22: Risk detail page shows impact score prominently (e.g., "Impact Score: 87/100")
 * AC23: Impact score shown with color coding (0-39=green, 40-69=yellow, 70-100=red)
 * AC24: Impact score includes breakdown tooltip showing component scores
 * AC26: Impact score updates in real-time when inputs change
 *
 * @see Story 4.7: Automated Impact Calculation Engine
 */

import { TrendingUp, Shield, Building, Calendar, Info, Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

/**
 * Impact score breakdown interface
 * Matches ImpactScoreBreakdown from risk-impact-calculator.ts
 */
export interface ImpactScoreBreakdown {
  /** Severity component score (0-100) */
  severityScore: number;
  /** Frameworks affected component score (0-100) */
  frameworksScore: number;
  /** Asset criticality component score (0-100) */
  criticalityScore: number;
  /** Audit proximity component score (0-100) */
  auditScore: number;
  /** Final weighted score (0-100) */
  totalScore: number;
  /** Number of frameworks affected */
  frameworksAffectedCount: number;
  /** Days until next audit (null if no audit date) */
  daysUntilAudit: number | null;
  /** List of affected framework names */
  affectedFrameworkNames: string[];
}

/**
 * Get color classes based on impact score tier
 * AC23: 0-39=green, 40-69=yellow, 70-100=red
 */
export function getImpactScoreColor(score: number): {
  text: string;
  bg: string;
  border: string;
  progress: string;
  label: string;
} {
  if (score >= 70) {
    return {
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      border: "border-red-200 dark:border-red-800",
      progress: "bg-red-500",
      label: "Critical",
    };
  }
  if (score >= 40) {
    return {
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
      progress: "bg-amber-500",
      label: "Elevated",
    };
  }
  return {
    text: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-800",
    progress: "bg-green-500",
    label: "Low",
  };
}

interface ImpactScoreDisplayProps {
  /** The calculated impact score (0-100) */
  score: number;
  /** Optional breakdown for tooltip display */
  breakdown?: Partial<ImpactScoreBreakdown>;
  /** When the score was last calculated */
  calculatedAt?: Date | null;
  /** Whether to show the breakdown tooltip (default: true) */
  showBreakdown?: boolean;
  /** Display size variant */
  size?: "sm" | "default" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays an impact score with color coding and optional breakdown tooltip.
 *
 * @example
 * ```tsx
 * <ImpactScoreDisplay score={87} breakdown={breakdown} />
 * <ImpactScoreDisplay score={45} size="lg" />
 * ```
 */
export function ImpactScoreDisplay({
  score,
  breakdown,
  calculatedAt,
  showBreakdown = true,
  size = "default",
  className,
}: ImpactScoreDisplayProps) {
  const colors = getImpactScoreColor(score);

  const sizeClasses = {
    sm: "text-sm",
    default: "text-base",
    lg: "text-xl",
  };

  const display = (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
        colors.bg,
        colors.border,
        className
      )}
    >
      <Zap className={cn("h-4 w-4", colors.text)} />
      <div className="flex flex-col">
        <div className={cn("font-bold", colors.text, sizeClasses[size])}>
          {score}/100
        </div>
        <div className="text-xs text-muted-foreground">
          Impact Score ({colors.label})
        </div>
      </div>
    </div>
  );

  if (showBreakdown && breakdown) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{display}</TooltipTrigger>
          <TooltipContent side="bottom" className="w-72 p-0">
            <div className="p-3 space-y-3">
              <div className="font-medium text-sm border-b pb-2">
                Impact Score Breakdown
              </div>

              {/* Severity (40%) */}
              <BreakdownRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Severity"
                score={breakdown.severityScore ?? 0}
                weight={40}
                description="Risk severity rating"
              />

              {/* Frameworks (30%) */}
              <BreakdownRow
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Frameworks"
                score={breakdown.frameworksScore ?? 0}
                weight={30}
                description={
                  breakdown.frameworksAffectedCount !== undefined
                    ? `${breakdown.frameworksAffectedCount} framework${breakdown.frameworksAffectedCount !== 1 ? "s" : ""} affected`
                    : "Compliance frameworks impacted"
                }
              />

              {/* Asset Criticality (20%) */}
              <BreakdownRow
                icon={<Building className="h-3.5 w-3.5" />}
                label="Asset Criticality"
                score={breakdown.criticalityScore ?? 0}
                weight={20}
                description="Business criticality of affected assets"
              />

              {/* Audit Proximity (10%) */}
              <BreakdownRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Audit Proximity"
                score={breakdown.auditScore ?? 0}
                weight={10}
                description={
                  breakdown.daysUntilAudit !== null && breakdown.daysUntilAudit !== undefined
                    ? breakdown.daysUntilAudit >= 0
                      ? `${breakdown.daysUntilAudit} days until audit`
                      : "Audit date passed"
                    : "No scheduled audit"
                }
              />

              {/* Total */}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-medium text-sm">Total Score</span>
                <span className={cn("font-bold", colors.text)}>{score}/100</span>
              </div>

              {/* Calculated timestamp */}
              {calculatedAt && (
                <div className="text-xs text-muted-foreground pt-1">
                  Last calculated: {new Date(calculatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return display;
}

/**
 * Helper component for rendering breakdown rows
 */
function BreakdownRow({
  icon,
  label,
  score,
  weight,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  weight: number;
  description: string;
}) {
  // Calculate weighted contribution
  const weighted = Math.round(score * (weight / 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span>{label}</span>
          <span className="opacity-60">({weight}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{score}</span>
          <span className="font-medium">+{weighted}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground/70">{description}</div>
    </div>
  );
}

/**
 * Large detailed impact score display for risk detail pages
 */
export function ImpactScoreCard({
  score,
  breakdown,
  calculatedAt,
  className,
}: {
  score: number;
  breakdown?: Partial<ImpactScoreBreakdown>;
  calculatedAt?: Date | null;
  className?: string;
}) {
  const colors = getImpactScoreColor(score);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-4",
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={cn("h-5 w-5", colors.text)} />
          <span className="font-semibold">Impact Score</span>
        </div>
        <div className={cn("text-3xl font-bold", colors.text)}>{score}</div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={score} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 (Low)</span>
          <span className={cn("font-medium", colors.text)}>{colors.label}</span>
          <span>100 (Critical)</span>
        </div>
      </div>

      {/* Breakdown grid */}
      {breakdown && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <ScoreComponent
            icon={<TrendingUp className="h-4 w-4" />}
            label="Severity"
            score={breakdown.severityScore ?? 0}
            weight={40}
          />
          <ScoreComponent
            icon={<Shield className="h-4 w-4" />}
            label="Frameworks"
            score={breakdown.frameworksScore ?? 0}
            weight={30}
          />
          <ScoreComponent
            icon={<Building className="h-4 w-4" />}
            label="Asset Criticality"
            score={breakdown.criticalityScore ?? 0}
            weight={20}
          />
          <ScoreComponent
            icon={<Calendar className="h-4 w-4" />}
            label="Audit Proximity"
            score={breakdown.auditScore ?? 0}
            weight={10}
          />
        </div>
      )}

      {/* Calculated timestamp */}
      {calculatedAt && (
        <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
          <Info className="h-3 w-3" />
          Last calculated: {new Date(calculatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

/**
 * Helper for the breakdown grid in ImpactScoreCard
 */
function ScoreComponent({
  icon,
  label,
  score,
  weight,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  weight: number;
}) {
  const weighted = Math.round(score * (weight / 100));

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="font-medium">
          {score} <span className="text-xs text-muted-foreground">(+{weighted})</span>
        </div>
      </div>
    </div>
  );
}
