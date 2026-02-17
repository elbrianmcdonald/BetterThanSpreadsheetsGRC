"use client";

/**
 * ScaleLevelSelector Component
 *
 * Story 7.8.9: Assessment Form Matrix Integration (AC11-AC17)
 *
 * Radio group selector for choosing a scale level (likelihood, impact, exposure).
 * Shows level label, value badge, and description.
 */

import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { ScaleLevel } from "@/lib/matrix";

interface ScaleLevelSelectorProps {
  /** Scale levels to display (from matrix version) */
  levels: ScaleLevel[];
  /** Currently selected value */
  value: number | null | undefined;
  /** Callback when selection changes */
  onChange: (value: number) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional CSS class */
  className?: string;
  /** Display variant */
  variant?: "default" | "compact";
}

/**
 * Select a level from a risk scale
 *
 * AC11: Likelihood selector shows scale levels from selected matrix
 * AC12: Impact selector shows scale levels from selected matrix
 * AC13: Exposure selector shown only for 3D matrices (handled by parent)
 * AC14: Each selector shows label and description
 * AC15: Selectors disabled until matrix selected (controlled via disabled prop)
 * AC16: Current selection clearly indicated
 * AC17: Can change selections before final save (controlled via disabled prop)
 */
export function ScaleLevelSelector({
  levels,
  value,
  onChange,
  disabled = false,
  className,
  variant = "default",
}: ScaleLevelSelectorProps) {
  // Sort levels by value (ascending)
  const sortedLevels = [...levels].sort((a, b) => a.value - b.value);

  if (variant === "compact") {
    return (
      <CompactSelector
        levels={sortedLevels}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <RadioGroup
      value={value?.toString() ?? ""}
      onValueChange={(v) => onChange(parseFloat(v))}
      disabled={disabled}
      className={cn("grid grid-cols-1 gap-2", className)}
    >
      {sortedLevels.map((level) => {
        const isSelected = value === level.value;

        return (
          <div
            key={level.value}
            className={cn(
              "flex items-start space-x-3 rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <RadioGroupItem
              value={level.value.toString()}
              id={`level-${level.value}`}
              className="mt-0.5"
            />
            <Label
              htmlFor={`level-${level.value}`}
              className={cn(
                "flex-1 cursor-pointer",
                disabled && "cursor-not-allowed"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{level.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {level.value}
                  </Badge>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
              {level.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {level.description}
                </p>
              )}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

/**
 * Compact variant with inline buttons
 */
interface CompactSelectorProps {
  levels: ScaleLevel[];
  value: number | null | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

function CompactSelector({
  levels,
  value,
  onChange,
  disabled = false,
  className,
}: CompactSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {levels.map((level) => {
        const isSelected = value === level.value;

        return (
          <button
            key={level.value}
            type="button"
            onClick={() => !disabled && onChange(level.value)}
            disabled={disabled}
            title={level.description}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span>{level.label}</span>
            <Badge
              variant={isSelected ? "secondary" : "outline"}
              className="text-xs font-mono"
            >
              {level.value}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Display the selected level value
 */
interface ScaleLevelDisplayProps {
  /** Scale levels for lookup */
  levels: ScaleLevel[];
  /** Selected value */
  value: number | null | undefined;
  /** Optional CSS class */
  className?: string;
}

export function ScaleLevelDisplay({
  levels,
  value,
  className,
}: ScaleLevelDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        Not selected
      </span>
    );
  }

  const level = levels.find((l) => l.value === value);

  if (!level) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        Unknown ({value})
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span>{level.label}</span>
      <Badge variant="outline" className="text-xs font-mono">
        {level.value}
      </Badge>
    </span>
  );
}
