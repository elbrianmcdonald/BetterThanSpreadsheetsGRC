"use client";

/**
 * Matrix Preview Component
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 11.6: Severity Threshold Configuration
 * Story 11.7: Canvas Heatmap Preview Component
 *
 * Visual preview of the risk matrix (AC23-AC25, 11.6 AC15, 11.7 AC1-AC24):
 * - AC23: Preview tab shows matrix grid with colors from thresholds
 * - AC24: Each cell shows calculated score and threshold label
 * - AC25: Matrix dimensions based on scale level counts
 * - 11.6 AC15: Legend shows SLA days per severity
 * - 11.7: Canvas-based heatmap with 3D support and export
 */

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Grid3X3, LayoutGrid } from "lucide-react";
import { getContrastColor, type ScaleLevel, type Threshold } from "@/lib/matrix";
import { CanvasHeatmap } from "./CanvasHeatmap";

interface MatrixPreviewProps {
  scales: {
    likelihood: ScaleLevel[];
    impact: ScaleLevel[];
    exposure?: ScaleLevel[];
  };
  thresholds: Threshold[];
  outputScaleMax: number;
  dimensionCount?: 2 | 3;
  matrixName?: string;
}

export function MatrixPreview({
  scales,
  thresholds,
  outputScaleMax,
  dimensionCount = 2,
  matrixName = "Risk Matrix",
}: MatrixPreviewProps) {
  const [viewMode, setViewMode] = useState<"canvas" | "table">("canvas");

  // Sort scales for display
  // Likelihood: high-to-low (rows, so highest likelihood at top)
  // Impact: low-to-high (columns, so lowest impact on left)
  // Ensure values are numbers (JSON might store as strings)
  const likelihoodLevels = useMemo(
    () => [...scales.likelihood]
      .map(l => ({ ...l, value: Number(l.value) }))
      .sort((a, b) => b.value - a.value),
    [scales.likelihood]
  );

  const impactLevels = useMemo(
    () => [...scales.impact]
      .map(l => ({ ...l, value: Number(l.value) }))
      .sort((a, b) => a.value - b.value),
    [scales.impact]
  );

  // Sort thresholds by sortOrder
  const sortedThresholds = useMemo(
    () => [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder),
    [thresholds]
  );

  // Calculate max values for normalization
  const maxLikelihood = useMemo(
    () => Math.max(...scales.likelihood.map((l) => Number(l.value))),
    [scales.likelihood]
  );

  const maxImpact = useMemo(
    () => Math.max(...scales.impact.map((i) => Number(i.value))),
    [scales.impact]
  );

  // Find threshold for a given score
  const getThreshold = (score: number): Threshold | undefined => {
    // Find the threshold where score falls within [minValue, maxValue]
    // With gaps between thresholds, we use inclusive bounds on both ends
    return sortedThresholds.find((t) => {
      return score >= t.minValue && score <= t.maxValue;
    });
  };

  // Calculate score using multiplicative formula
  const calculateScore = (likelihood: number, impact: number): number => {
    // Raw score = likelihood * impact
    const raw = likelihood * impact;
    // Max possible = maxLikelihood * maxImpact
    const maxPossible = maxLikelihood * maxImpact;
    // Normalize to outputScaleMax
    if (maxPossible === 0) return 0;
    return (raw / maxPossible) * outputScaleMax;
  };

  // Validation
  const hasValidScales =
    scales.likelihood.length >= 3 && scales.impact.length >= 3;
  const hasValidThresholds = thresholds.length >= 2;

  if (!hasValidScales) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matrix Preview</CardTitle>
          <CardDescription>
            Visual preview of the risk matrix with current scales and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Both likelihood and impact scales must have at least 3 levels to
              preview the matrix.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!hasValidThresholds) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matrix Preview</CardTitle>
          <CardDescription>
            Visual preview of the risk matrix with current scales and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              At least 2 thresholds are required to preview the matrix. Go to
              the Thresholds tab to configure them.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Matrix Preview</CardTitle>
          <CardDescription>
            {dimensionCount === 3 && scales.exposure
              ? `${likelihoodLevels.length}×${impactLevels.length}×${scales.exposure.length} 3D Matrix`
              : `${likelihoodLevels.length}×${impactLevels.length} 2D Matrix`}{" "}
            • Max score: {outputScaleMax}
          </CardDescription>
        </div>
        {/* View mode toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "canvas" | "table")}>
          <TabsList className="h-8">
            <TabsTrigger value="canvas" className="h-7 px-2">
              <Grid3X3 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Canvas</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="h-7 px-2">
              <LayoutGrid className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Table</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {/* Story 11.7: Canvas Heatmap View */}
        {viewMode === "canvas" && (
          <CanvasHeatmap
            scales={scales}
            thresholds={thresholds}
            outputScaleMax={outputScaleMax}
            dimensionCount={dimensionCount}
            matrixName={matrixName}
          />
        )}

        {/* Original Table View */}
        {viewMode === "table" && (
        <>
        <TooltipProvider delayDuration={200}>
          <div className="overflow-x-auto">
            <table className="border-collapse w-full max-w-3xl">
              <thead>
                <tr>
                  {/* Corner cell */}
                  <th className="p-2 border bg-muted text-sm font-medium text-right min-w-24">
                    Likelihood ↓ / Impact →
                  </th>
                  {/* Impact column headers */}
                  {impactLevels.map((impact) => (
                    <th
                      key={impact.value}
                      className="p-2 border bg-muted text-sm font-medium text-center min-w-16"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {impact.label || impact.value}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">
                            Impact: {impact.label || `Level ${impact.value}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Value: {impact.value}
                          </p>
                          {impact.description && (
                            <p className="text-xs max-w-48">
                              {impact.description}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {likelihoodLevels.map((likelihood) => (
                  <tr key={likelihood.value}>
                    {/* Likelihood row header */}
                    <th className="p-2 border bg-muted text-sm text-right font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {likelihood.label || likelihood.value}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">
                            Likelihood:{" "}
                            {likelihood.label || `Level ${likelihood.value}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Value: {likelihood.value}
                          </p>
                          {likelihood.description && (
                            <p className="text-xs max-w-48">
                              {likelihood.description}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    {/* Matrix cells */}
                    {impactLevels.map((impact) => {
                      const score = calculateScore(
                        likelihood.value,
                        impact.value
                      );
                      const threshold = getThreshold(score);
                      const bgColor = threshold?.color ?? "#CCCCCC";
                      const textColor = getContrastColor(bgColor);

                      return (
                        <Tooltip key={impact.value}>
                          <TooltipTrigger asChild>
                            <td
                              className="p-2 border text-center cursor-help transition-transform hover:scale-105"
                              style={{
                                backgroundColor: bgColor,
                                color: textColor,
                                // Risk appetite: dashed inset ring flags cells
                                // whose band exceeds appetite (parity with the
                                // Canvas view's boundary line).
                                ...(threshold?.overAppetite && {
                                  outline: "2px dashed var(--destructive)",
                                  outlineOffset: "-3px",
                                }),
                              }}
                            >
                              <div className="font-bold text-sm">
                                {score.toFixed(1)}
                              </div>
                              {threshold && (
                                <div className="text-[10px] opacity-80 truncate">
                                  {threshold.label}
                                </div>
                              )}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-semibold">
                                Risk Score: {score.toFixed(2)}
                              </p>
                              <p className="text-xs">
                                Level:{" "}
                                <span
                                  className="px-1 rounded"
                                  style={{
                                    backgroundColor: bgColor,
                                    color: textColor,
                                  }}
                                >
                                  {threshold?.label ?? "Unknown"}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {likelihood.label || `L${likelihood.value}`} ×{" "}
                                {impact.label || `I${impact.value}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ({likelihood.value} × {impact.value}) /{" "}
                                {maxLikelihood * maxImpact} × {outputScaleMax}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>

        {/* Legend for table view - Story 11.6 AC15: Include SLA days */}
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2">Risk Levels</h4>
          <div className="flex flex-wrap gap-2">
            {sortedThresholds.map((threshold) => (
              <div
                key={threshold.sortOrder}
                className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: threshold.color,
                  color: getContrastColor(threshold.color),
                }}
              >
                <span className="font-medium">{threshold.label}</span>
                <span className="text-xs opacity-80">
                  {threshold.minValue.toFixed(1)} - {threshold.maxValue.toFixed(1)}
                </span>
                <span className="text-xs opacity-60">
                  ({threshold.slaDays ?? 30}d SLA)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Formula explanation for table view */}
        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>Formula:</strong> Risk Score = (Likelihood × Impact) /
            (MaxL × MaxI) × {outputScaleMax}
          </p>
          <p className="mt-1">
            Max Likelihood = {maxLikelihood}, Max Impact = {maxImpact}
          </p>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
