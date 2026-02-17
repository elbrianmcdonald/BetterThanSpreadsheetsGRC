"use client";

/**
 * Risk Score Display Component
 *
 * Story 7.6: Risk Assessment Form with Auto-Save (AC7)
 *
 * Displays calculated risk score with visual indicators:
 * - Score = Likelihood × Impact (1-16 range)
 * - Color-coded progress bar
 * - Score label (Low/Medium/High/Critical)
 * - "Select likelihood and impact" when values missing
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

import { AlertTriangle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  calculateScore,
  getScoreLabel,
  getScoreColorClass,
  getScoreBadgeClass,
  getScorePercentage,
} from "@/lib/utils/risk-scoring";

interface RiskScoreDisplayProps {
  /** Likelihood value (1-4), null if not set */
  likelihood: number | null;
  /** Impact value (1-4), null if not set */
  impact: number | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the calculated risk score with a color-coded progress bar.
 *
 * @example
 * ```tsx
 * <RiskScoreDisplay likelihood={3} impact={4} />
 * // Shows: Score 12 (High) with orange progress bar at 75%
 *
 * <RiskScoreDisplay likelihood={null} impact={2} />
 * // Shows: "Select likelihood and impact to calculate score"
 * ```
 */
export function RiskScoreDisplay({
  likelihood,
  impact,
  className,
}: RiskScoreDisplayProps) {
  // Check if both values are set
  const hasValues = likelihood !== null && impact !== null;

  if (!hasValues) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30",
          className
        )}
      >
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Select likelihood and impact to calculate score
        </span>
      </div>
    );
  }

  const score = calculateScore(likelihood, impact);
  const label = getScoreLabel(score);
  const percentage = getScorePercentage(score);
  const colorClass = getScoreColorClass(label);
  const badgeClass = getScoreBadgeClass(label);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Score Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Inherent Risk Score
          </span>
          <Badge variant="outline" className={cn("border", badgeClass)}>
            {label}
          </Badge>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{score}</span>
          <span className="text-sm text-muted-foreground">/ 16</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <Progress
          value={percentage}
          className="h-3"
          // Override the indicator color based on score level
          style={
            {
              "--progress-background": `var(--${label.toLowerCase()}-color, hsl(var(--primary)))`,
            } as React.CSSProperties
          }
        />
        {/* Color overlay for progress bar */}
        <div
          className={cn(
            "absolute top-0 left-0 h-3 rounded-full transition-all duration-300",
            colorClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Score Breakdown */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Likelihood: <strong className="text-foreground">{likelihood}</strong>
        </span>
        <span>×</span>
        <span>
          Impact: <strong className="text-foreground">{impact}</strong>
        </span>
        <span>=</span>
        <span>
          Score: <strong className="text-foreground">{score}</strong>
        </span>
      </div>
    </div>
  );
}
