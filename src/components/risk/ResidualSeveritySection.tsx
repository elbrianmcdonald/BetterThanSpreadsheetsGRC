"use client";

/**
 * Residual Severity Section Component
 *
 * Story 16.4: Risk Residual Severity Calculation (AC8-AC17)
 *
 * Provides a section for entering residual severity values after controls:
 * - AC8: "Residual Severity" section appears after "Controls Needed" section
 * - AC9-AC11: Dropdowns for residual likelihood, impact, exposure (if 3D)
 * - AC12-AC13: Auto-calculated score with severity label and color
 * - AC14: Mini heatmap showing selected cell
 * - AC15-AC17: Comparison display with inherent severity
 *
 * @see Story 16.4: Risk Residual Severity Calculation
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRiskScore } from "@/hooks/useRiskScore";
import type { MatrixScales, Threshold } from "@/lib/matrix/types";

/**
 * Score badge color mapping
 */
function getScoreBadgeClass(label: string): string {
  switch (label.toLowerCase()) {
    case "low":
      return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-600";
    case "critical":
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
  }
}

interface ResidualSeveritySectionProps {
  /** Risk ID for saving */
  riskId: string;
  /** Current residual likelihood */
  residualLikelihood?: number | null;
  /** Current residual impact */
  residualImpact?: number | null;
  /** Current residual exposure (3D only) */
  residualExposure?: number | null;
  /** Current residual score */
  residualScore?: number | null;
  /** Current residual score label */
  residualScoreLabel?: string | null;
  /** Inherent likelihood for comparison */
  inherentLikelihood?: number | null;
  /** Inherent impact for comparison */
  inherentImpact?: number | null;
  /** Inherent exposure for comparison (3D only) */
  inherentExposure?: number | null;
  /** Inherent score for comparison */
  inherentScore?: number | null;
  /** Inherent score label for comparison */
  inherentScoreLabel?: string | null;
  /** Matrix scales from active version */
  scales?: MatrixScales | null;
  /** Matrix thresholds from active version */
  thresholds?: Threshold[] | null;
  /** Output scale max for scoring */
  outputScaleMax?: number | null;
  /** Whether the section is read-only */
  isReadOnly?: boolean;
  /** Whether section starts expanded */
  defaultExpanded?: boolean;
  /** Callback when residual values change */
  onUpdate?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Residual Severity Section for risk forms
 *
 * Provides dropdowns for residual severity values with auto-calculation
 * and comparison to inherent severity.
 */
export function ResidualSeveritySection({
  riskId,
  residualLikelihood: initialLikelihood,
  residualImpact: initialImpact,
  residualExposure: initialExposure,
  residualScore: initialScore,
  residualScoreLabel: initialLabel,
  inherentLikelihood,
  inherentImpact,
  inherentExposure,
  inherentScore,
  inherentScoreLabel,
  scales,
  thresholds,
  outputScaleMax,
  isReadOnly = false,
  defaultExpanded = false,
  onUpdate,
  className,
}: ResidualSeveritySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [likelihood, setLikelihood] = useState<number | null>(initialLikelihood ?? null);
  const [impact, setImpact] = useState<number | null>(initialImpact ?? null);
  const [exposure, setExposure] = useState<number | null>(initialExposure ?? null);

  // Sync with props when they change
  useEffect(() => {
    setLikelihood(initialLikelihood ?? null);
    setImpact(initialImpact ?? null);
    setExposure(initialExposure ?? null);
  }, [initialLikelihood, initialImpact, initialExposure]);

  // Check if 3D matrix
  const is3D = scales?.exposure && scales.exposure.length > 0;

  // Calculate score in real-time
  const score = useRiskScore({
    scales,
    thresholds,
    outputScaleMax,
    likelihoodValue: likelihood,
    impactValue: impact,
    exposureValue: is3D ? exposure : undefined,
  });

  // Mutation for saving
  const updateMutation = api.risk.updateResidualSeverity.useMutation({
    onSuccess: () => {
      onUpdate?.();
    },
  });

  // Debounced save
  const saveResidual = useCallback(
    (newLikelihood: number | null, newImpact: number | null, newExposure: number | null) => {
      updateMutation.mutate({
        riskId,
        residualLikelihood: newLikelihood,
        residualImpact: newImpact,
        residualExposure: is3D ? newExposure : undefined,
      });
    },
    [riskId, is3D, updateMutation]
  );

  // Handle value changes
  const handleLikelihoodChange = (value: string) => {
    const newValue = value === "clear" ? null : parseInt(value, 10);
    setLikelihood(newValue);
    saveResidual(newValue, impact, exposure);
  };

  const handleImpactChange = (value: string) => {
    const newValue = value === "clear" ? null : parseInt(value, 10);
    setImpact(newValue);
    saveResidual(likelihood, newValue, exposure);
  };

  const handleExposureChange = (value: string) => {
    const newValue = value === "clear" ? null : parseInt(value, 10);
    setExposure(newValue);
    saveResidual(likelihood, impact, newValue);
  };

  // Calculate percentage change (parse displayScore to number for comparison)
  const residualScoreNum = score.displayScore ? parseFloat(score.displayScore) : null;
  const percentageChange = inherentScore && residualScoreNum
    ? Math.round(((inherentScore - residualScoreNum) / inherentScore) * 100)
    : null;

  // Has content (for collapsed indicator)
  const hasContent = likelihood !== null || impact !== null;

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Residual Severity</span>
          {hasContent && !isExpanded && score.label && (
            <Badge variant="outline" className={cn("border", getScoreBadgeClass(score.label))}>
              {score.label}
            </Badge>
          )}
          {!hasContent && !isReadOnly && (
            <span className="text-sm text-muted-foreground">(After controls)</span>
          )}
        </div>
        {score.label && isExpanded && (
          <Badge variant="outline" className={cn("border", getScoreBadgeClass(score.label))}>
            {score.displayScore} - {score.label}
          </Badge>
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-6">
          {/* Selector Grid */}
          <div className={cn("grid gap-4", is3D ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
            {/* Likelihood Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Residual Likelihood
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Likelihood after controls are in place</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <Select
                value={likelihood?.toString() ?? ""}
                onValueChange={handleLikelihoodChange}
                disabled={isReadOnly || !scales}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select likelihood" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear" className="text-muted-foreground">
                    Not selected
                  </SelectItem>
                  {scales?.likelihood.map((level) => (
                    <SelectItem key={level.value} value={level.value.toString()}>
                      <div className="flex flex-col">
                        <span>{level.label}</span>
                        {level.description && (
                          <span className="text-xs text-muted-foreground">
                            {level.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Impact Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Residual Impact
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Impact after controls reduce the effect</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <Select
                value={impact?.toString() ?? ""}
                onValueChange={handleImpactChange}
                disabled={isReadOnly || !scales}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear" className="text-muted-foreground">
                    Not selected
                  </SelectItem>
                  {scales?.impact.map((level) => (
                    <SelectItem key={level.value} value={level.value.toString()}>
                      <div className="flex flex-col">
                        <span>{level.label}</span>
                        {level.description && (
                          <span className="text-xs text-muted-foreground">
                            {level.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exposure Selector (3D only) */}
            {is3D && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Residual Exposure
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Exposure after controls reduce visibility</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Select
                  value={exposure?.toString() ?? ""}
                  onValueChange={handleExposureChange}
                  disabled={isReadOnly || !scales}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select exposure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear" className="text-muted-foreground">
                      Not selected
                    </SelectItem>
                    {scales?.exposure?.map((level) => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        <div className="flex flex-col">
                          <span>{level.label}</span>
                          {level.description && (
                            <span className="text-xs text-muted-foreground">
                              {level.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* AC15-AC17: Comparison Display */}
          {inherentScore !== null && inherentScore !== undefined && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Severity Comparison
                </p>
                <div className="flex items-center justify-between gap-4">
                  {/* Inherent */}
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Inherent</p>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl font-bold">
                        {inherentScore?.toFixed(1) ?? "—"}
                      </span>
                      {inherentScoreLabel && (
                        <Badge
                          variant="outline"
                          className={cn("border", getScoreBadgeClass(inherentScoreLabel))}
                        >
                          {inherentScoreLabel}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    {percentageChange !== null && (
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        percentageChange > 0 ? "text-green-600" : percentageChange < 0 ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {percentageChange > 0 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : percentageChange < 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        {Math.abs(percentageChange)}%
                      </div>
                    )}
                  </div>

                  {/* Residual */}
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Residual</p>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl font-bold">
                        {score.displayScore ?? "—"}
                      </span>
                      {score.label ? (
                        <Badge
                          variant="outline"
                          className={cn("border", getScoreBadgeClass(score.label))}
                        >
                          {score.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Select values above
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Percentage Change Summary */}
                {percentageChange !== null && percentageChange !== 0 && (
                  <p className={cn(
                    "text-sm text-center mt-3",
                    percentageChange > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {percentageChange > 0
                      ? `Controls reduce risk by ${percentageChange}%`
                      : `Risk increased by ${Math.abs(percentageChange)}%`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* No inherent score message */}
          {(inherentScore === null || inherentScore === undefined) && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Set inherent severity first to see comparison
            </p>
          )}

          {/* Saving indicator */}
          {updateMutation.isPending && (
            <p className="text-xs text-muted-foreground text-center">
              Saving...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
