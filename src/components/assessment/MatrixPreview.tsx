"use client";

/**
 * MatrixPreview Component
 *
 * Story 7.8.9: Assessment Form Matrix Integration (AC22)
 *
 * Visual representation of the risk matrix with current position highlighted.
 * Shows the matrix grid with threshold colors and highlights selected cell.
 */

import { cn } from "@/lib/utils";
import type { MatrixScales, Threshold } from "@/lib/matrix";
import { calculateInherentScore, isScoreResult } from "@/lib/matrix";

interface MatrixPreviewProps {
  /** Matrix scales configuration */
  scales: MatrixScales;
  /** Risk thresholds for coloring */
  thresholds: Threshold[];
  /** Maximum output scale value */
  outputScaleMax: number;
  /** Currently selected likelihood value */
  highlightLikelihood?: number | null;
  /** Currently selected impact value */
  highlightImpact?: number | null;
  /** Optional CSS class */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Display a visual risk matrix grid with position highlighting
 *
 * AC22: Matrix preview grid shows current position highlighted
 *
 * Shows a 2D matrix grid where:
 * - X-axis: Likelihood levels (low to high, left to right)
 * - Y-axis: Impact levels (high to low, top to bottom)
 * - Cell colors: Based on calculated score and thresholds
 * - Highlighted cell: Current selection
 */
export function MatrixPreview({
  scales,
  thresholds,
  outputScaleMax,
  highlightLikelihood,
  highlightImpact,
  className,
  size = "md",
}: MatrixPreviewProps) {
  // Sort scales by value
  const sortedLikelihood = [...scales.likelihood].sort((a, b) => a.value - b.value);
  const sortedImpact = [...scales.impact].sort((a, b) => b.value - a.value); // Descending for Y-axis

  // Size classes
  const cellSizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Y-axis label */}
      <div className="flex items-center justify-center mb-1">
        <span className={cn("text-muted-foreground font-medium", labelSizeClasses[size])}>
          Impact
        </span>
      </div>

      <div className="flex gap-1">
        {/* Y-axis labels column */}
        <div className="flex flex-col gap-1 justify-center">
          {sortedImpact.map((impact) => (
            <div
              key={impact.value}
              className={cn(
                "flex items-center justify-end pr-1",
                cellSizeClasses[size]
              )}
              title={impact.description}
            >
              <span
                className={cn(
                  "text-muted-foreground truncate",
                  labelSizeClasses[size],
                  highlightImpact === impact.value && "text-foreground font-medium"
                )}
              >
                {impact.label.charAt(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Matrix grid */}
        <div className="flex flex-col gap-1">
          {sortedImpact.map((impact) => (
            <div key={impact.value} className="flex gap-1">
              {sortedLikelihood.map((likelihood) => {
                const isHighlighted =
                  highlightLikelihood === likelihood.value &&
                  highlightImpact === impact.value;

                // Calculate score for this cell
                const result = calculateInherentScore(
                  scales,
                  thresholds,
                  outputScaleMax,
                  likelihood.value,
                  impact.value
                );

                const cellColor = isScoreResult(result) ? result.color : "#6b7280";

                return (
                  <div
                    key={`${likelihood.value}-${impact.value}`}
                    className={cn(
                      "rounded transition-all duration-200",
                      cellSizeClasses[size],
                      isHighlighted && "ring-2 ring-foreground ring-offset-2 scale-110 z-10"
                    )}
                    style={{ backgroundColor: cellColor }}
                    title={`L: ${likelihood.label}, I: ${impact.label}${isScoreResult(result) ? ` → ${result.label} (${result.normalizedScore})` : ""}`}
                  />
                );
              })}
            </div>
          ))}

          {/* X-axis labels row */}
          <div className="flex gap-1 mt-1">
            {sortedLikelihood.map((likelihood) => (
              <div
                key={likelihood.value}
                className={cn(
                  "flex items-center justify-center",
                  cellSizeClasses[size]
                )}
                title={likelihood.description}
              >
                <span
                  className={cn(
                    "text-muted-foreground truncate",
                    labelSizeClasses[size],
                    highlightLikelihood === likelihood.value && "text-foreground font-medium"
                  )}
                >
                  {likelihood.label.charAt(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* X-axis label */}
      <div className="flex items-center justify-center mt-1">
        <span className={cn("text-muted-foreground font-medium", labelSizeClasses[size])}>
          Likelihood
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        {[...thresholds]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((threshold) => (
            <div key={threshold.label} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: threshold.color }}
              />
              <span className={cn("text-muted-foreground", labelSizeClasses[size])}>
                {threshold.label}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/**
 * Compact matrix preview for inline display
 */
interface CompactMatrixPreviewProps {
  /** Matrix scales configuration */
  scales: MatrixScales;
  /** Risk thresholds for coloring */
  thresholds: Threshold[];
  /** Maximum output scale value */
  outputScaleMax: number;
  /** Currently selected likelihood value */
  highlightLikelihood?: number | null;
  /** Currently selected impact value */
  highlightImpact?: number | null;
  /** Optional CSS class */
  className?: string;
}

export function CompactMatrixPreview({
  scales,
  thresholds,
  outputScaleMax,
  highlightLikelihood,
  highlightImpact,
  className,
}: CompactMatrixPreviewProps) {
  return (
    <MatrixPreview
      scales={scales}
      thresholds={thresholds}
      outputScaleMax={outputScaleMax}
      highlightLikelihood={highlightLikelihood}
      highlightImpact={highlightImpact}
      className={className}
      size="sm"
    />
  );
}
