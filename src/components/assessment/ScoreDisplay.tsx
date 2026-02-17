"use client";

/**
 * ScoreDisplay Component
 *
 * Story 7.8.8: Multiplicative Scoring Algorithm (AC13-AC16)
 *
 * Displays the calculated risk score with threshold color and label.
 * Shows "incomplete" state until all required values are selected.
 */

import { type UseRiskScoreResult } from "@/hooks/useRiskScore";
import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  /** Score result from useRiskScore hook */
  score: UseRiskScoreResult;
  /** Optional size variant */
  size?: "sm" | "md" | "lg";
  /** Optional CSS class */
  className?: string;
}

/**
 * Display the calculated risk score with visual indicator
 *
 * AC13: Assessment form shows score as user selects values
 * AC15: Threshold color and label displayed with score
 * AC16: "Incomplete" shown until all required values selected
 */
export function ScoreDisplay({
  score,
  size = "md",
  className,
}: ScoreDisplayProps) {
  // Size classes for the score box
  const sizeClasses = {
    sm: "w-12 h-12 text-base",
    md: "w-16 h-16 text-xl",
    lg: "w-20 h-20 text-2xl",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // No matrix data available
  if (!score.hasMatrix) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        Select a matrix to see score
      </div>
    );
  }

  // Score is incomplete (missing required values)
  if (!score.isComplete) {
    const reason =
      score.score && "incomplete" in score.score
        ? score.score.reason
        : "Complete all fields to see score";

    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div
          className={cn(
            "rounded-lg flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/30",
            sizeClasses[size]
          )}
        >
          <span className="text-muted-foreground">--</span>
        </div>
        <div>
          <div className="font-medium text-muted-foreground">Incomplete</div>
          <div className={cn("text-muted-foreground", labelSizeClasses[size])}>
            {reason}
          </div>
        </div>
      </div>
    );
  }

  // Score is complete - display with color
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "rounded-lg flex items-center justify-center text-white font-bold shadow-md",
          sizeClasses[size]
        )}
        style={{ backgroundColor: score.color ?? "#6b7280" }}
      >
        {score.displayScore}
      </div>
      <div>
        <div className="font-medium" style={{ color: score.color ?? "#6b7280" }}>
          {score.label}
        </div>
        <div className={cn("text-muted-foreground", labelSizeClasses[size])}>
          Inherent Risk Score
        </div>
      </div>
    </div>
  );
}

/**
 * Compact score badge for inline display
 */
interface ScoreBadgeProps {
  /** Score result from useRiskScore hook */
  score: UseRiskScoreResult;
  /** Optional CSS class */
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  if (!score.hasMatrix || !score.isComplete) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground",
          className
        )}
      >
        --
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: score.color ?? "#6b7280" }}
    >
      {score.displayScore} {score.label}
    </span>
  );
}
