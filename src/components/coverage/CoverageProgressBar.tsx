"use client";

/**
 * Coverage Progress Bar Component
 *
 * Displays a progress bar with color coding based on coverage percentage:
 * - <30%: Red (critical gaps)
 * - 30-70%: Yellow (moderate coverage)
 * - >70%: Green (good coverage)
 *
 * @see Story 2.6: AC20, AC21
 */

import { cn } from "@/lib/utils";

interface CoverageProgressBarProps {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** Additional CSS classes */
  className?: string;
  /** Show percentage label */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Get color classes based on coverage percentage
 * <30%: Red, 30-70%: Yellow, >70%: Green
 */
function getCoverageColor(percentage: number): {
  bar: string;
  background: string;
  text: string;
} {
  if (percentage < 30) {
    return {
      bar: "bg-red-500",
      background: "bg-red-100",
      text: "text-red-700",
    };
  }
  if (percentage < 70) {
    return {
      bar: "bg-yellow-500",
      background: "bg-yellow-100",
      text: "text-yellow-700",
    };
  }
  return {
    bar: "bg-green-500",
    background: "bg-green-100",
    text: "text-green-700",
  };
}

/**
 * Get height classes based on size
 */
function getSizeClasses(size: "sm" | "md" | "lg"): string {
  switch (size) {
    case "sm":
      return "h-1.5";
    case "md":
      return "h-2.5";
    case "lg":
      return "h-4";
    default:
      return "h-2.5";
  }
}

export function CoverageProgressBar({
  percentage,
  className,
  showLabel = false,
  size = "md",
}: CoverageProgressBarProps) {
  const colors = getCoverageColor(percentage);
  const heightClass = getSizeClasses(size);
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full",
          heightClass,
          colors.background
        )}
        role="progressbar"
        aria-valuenow={clampedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Coverage: ${clampedPercentage.toFixed(1)}%`}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            colors.bar
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-sm font-medium min-w-[3.5rem] text-right", colors.text)}>
          {clampedPercentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export { getCoverageColor };
