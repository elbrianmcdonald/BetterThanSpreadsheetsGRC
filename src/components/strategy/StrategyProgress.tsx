"use client";

/**
 * Strategy Progress Component
 *
 * Story 4.4: Real-Time Progress Updates
 * AC6: Color-coded progress bar based on percentage
 * - 0-33%: Red/danger color
 * - 34-66%: Amber/warning color
 * - 67-100%: Green/success color
 *
 * @see docs/epics-strategy.md - Story 4.4
 */

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface StrategyProgressProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Get progress bar color class based on percentage (AC6)
 * - 0-33%: Red/danger
 * - 34-66%: Amber/warning
 * - 67-100%: Green/success
 */
function getProgressColor(value: number): string {
  if (value <= 33) {
    return "bg-red-500";
  } else if (value <= 66) {
    return "bg-amber-500";
  } else {
    return "bg-green-500";
  }
}

/**
 * Get progress background color class based on percentage
 */
function getProgressBgColor(value: number): string {
  if (value <= 33) {
    return "bg-red-100";
  } else if (value <= 66) {
    return "bg-amber-100";
  } else {
    return "bg-green-100";
  }
}

/**
 * Get progress text color class based on percentage
 */
function getProgressTextColor(value: number): string {
  if (value <= 33) {
    return "text-red-700";
  } else if (value <= 66) {
    return "text-amber-700";
  } else {
    return "text-green-700";
  }
}

/**
 * Color-coded progress bar for strategy, goal, and objective progress
 */
export function StrategyProgress({
  value,
  className,
  showLabel = true,
  size = "md",
}: StrategyProgressProps) {
  // Ensure value is between 0 and 100
  const normalizedValue = Math.max(0, Math.min(100, value));

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ProgressPrimitive.Root
        className={cn(
          "relative w-full overflow-hidden rounded-full",
          getProgressBgColor(normalizedValue),
          sizeClasses[size]
        )}
        value={normalizedValue}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-300",
            getProgressColor(normalizedValue)
          )}
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </ProgressPrimitive.Root>
      {showLabel && (
        <span
          className={cn(
            "text-sm font-medium tabular-nums min-w-[3rem] text-right",
            getProgressTextColor(normalizedValue)
          )}
        >
          {normalizedValue.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

/**
 * Compact progress indicator for lists and tables
 */
export function ProgressBadge({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        getProgressBgColor(normalizedValue),
        getProgressTextColor(normalizedValue),
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", getProgressColor(normalizedValue))}
      />
      {normalizedValue.toFixed(1)}%
    </span>
  );
}

/**
 * Progress display with label for cards
 */
export function ProgressWithLabel({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label ?? "Progress"}</span>
        <span className={cn("font-medium", getProgressTextColor(normalizedValue))}>
          {normalizedValue.toFixed(1)}%
        </span>
      </div>
      <StrategyProgress value={normalizedValue} showLabel={false} size="sm" />
    </div>
  );
}

// Export color utilities for use in other components
export { getProgressColor, getProgressBgColor, getProgressTextColor };
