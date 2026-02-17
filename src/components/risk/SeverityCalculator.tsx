"use client";

/**
 * Severity Calculator Component
 *
 * Interactive calculator for inherent/residual severity scoring using
 * the selected risk matrix scales (2D or 3D).
 *
 * Calculates: Likelihood × Impact × Exposure (if 3D matrix)
 */

import { useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { MatrixScales, Threshold, ScaleLevel } from "@/lib/matrix";

// ============================================================================
// Types
// ============================================================================

interface SeverityCalculatorProps {
  title: string;
  description: string;
  control: Control<any>;
  likelihoodName: string;
  impactName: string;
  exposureName: string;
  scales: MatrixScales | null;
  thresholds: Threshold[];
  is3DMatrix: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SeverityCalculator({
  title,
  description,
  control,
  likelihoodName,
  impactName,
  exposureName,
  scales,
  thresholds,
  is3DMatrix,
}: SeverityCalculatorProps) {
  // Watch values for calculation
  const likelihood = useWatch({ control, name: likelihoodName });
  const impact = useWatch({ control, name: impactName });
  const exposure = useWatch({ control, name: exposureName });

  // Calculate score
  const score = useMemo(() => {
    if (!likelihood || !impact) return null;
    if (is3DMatrix && !exposure) return null;
    return is3DMatrix
      ? likelihood * impact * exposure
      : likelihood * impact;
  }, [likelihood, impact, exposure, is3DMatrix]);

  // Get severity label from score
  const severity = useMemo(() => {
    if (score === null || !thresholds.length) return null;
    // Find the matching threshold (inclusive minValue, exclusive maxValue)
    const threshold = thresholds.find(
      (t) => score >= t.minValue && score < t.maxValue
    );
    // If no match, check if score matches the max threshold
    if (!threshold) {
      const maxThreshold = thresholds.reduce((max, t) =>
        t.maxValue > max.maxValue ? t : max
      );
      if (score >= maxThreshold.minValue) {
        return { label: maxThreshold.label, color: maxThreshold.color, slaDays: maxThreshold.slaDays };
      }
    }
    return threshold
      ? { label: threshold.label, color: threshold.color, slaDays: threshold.slaDays }
      : null;
  }, [score, thresholds]);

  // Format calculation display
  const calculationDisplay = useMemo(() => {
    const l = likelihood ?? "?";
    const i = impact ?? "?";
    if (is3DMatrix) {
      const e = exposure ?? "?";
      return `${l} × ${i} × ${e}`;
    }
    return `${l} × ${i}`;
  }, [likelihood, impact, exposure, is3DMatrix]);

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4 space-y-4">
        <div>
          <h5 className="font-medium">{title}</h5>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {/* Likelihood */}
          <FormField
            control={control}
            name={likelihoodName}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Likelihood</FormLabel>
                <Select
                  value={field.value?.toString() ?? ""}
                  onValueChange={(v) => field.onChange(v ? parseFloat(v) : null)}
                  disabled={!scales}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {scales?.likelihood.map((level) => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{level.value}</span>
                          <span>{level.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Impact */}
          <FormField
            control={control}
            name={impactName}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Impact</FormLabel>
                <Select
                  value={field.value?.toString() ?? ""}
                  onValueChange={(v) => field.onChange(v ? parseFloat(v) : null)}
                  disabled={!scales}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {scales?.impact.map((level) => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{level.value}</span>
                          <span>{level.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Exposure (only for 3D matrices) */}
          {is3DMatrix && (
            <FormField
              control={control}
              name={exposureName}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Exposure</FormLabel>
                  <Select
                    value={field.value?.toString() ?? ""}
                    onValueChange={(v) => field.onChange(v ? parseFloat(v) : null)}
                    disabled={!scales}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {scales?.exposure?.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{level.value}</span>
                            <span>{level.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Calculation Result */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Score: </span>
              <span className="font-mono">{calculationDisplay}</span>
              {score !== null && (
                <span className="font-mono font-bold"> = {score}</span>
              )}
            </div>
            {severity && (
              <Badge
                style={{ backgroundColor: severity.color }}
                className="text-white"
              >
                {severity.label}
              </Badge>
            )}
          </div>
          {severity && (
            <p className="text-xs text-muted-foreground mt-1">
              SLA: {severity.slaDays} days
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
