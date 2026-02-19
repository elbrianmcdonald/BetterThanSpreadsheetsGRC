"use client";

/**
 * Canvas Heatmap Component
 *
 * Story 11.7: Canvas Heatmap Preview Component
 *
 * HTML5 Canvas-based heatmap rendering for risk matrices (AC1-AC24):
 * - AC1-AC6: Canvas rendering with crisp display and grid lines
 * - AC7-AC11: 3D matrix support with exposure layer selector
 * - AC12-AC16: Visual polish with hover, tooltips, legend
 * - AC17-AC20: PNG export functionality
 * - AC21-AC24: Responsive design with minimum cell size
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download } from "lucide-react";
import { getContrastColor, type ScaleLevel, type Threshold } from "@/lib/matrix";

interface CanvasHeatmapProps {
  scales: {
    likelihood: ScaleLevel[];
    impact: ScaleLevel[];
    exposure?: ScaleLevel[];
  };
  thresholds: Threshold[];
  outputScaleMax: number;
  dimensionCount: 2 | 3;
  matrixName?: string;
  showGradient?: boolean;
}

interface HoveredCell {
  row: number;
  col: number;
  score: number;
  threshold: Threshold | undefined;
  likelihood: ScaleLevel;
  impact: ScaleLevel;
  exposure?: ScaleLevel;
  x: number;
  y: number;
}

// Layout constants
const MIN_CELL_SIZE = 40;
const MAX_CELL_SIZE = 80;
const AXIS_LABEL_WIDTH = 80;
const AXIS_LABEL_HEIGHT = 40;
const HEADER_HEIGHT = 30;
const PADDING = 20;

export function CanvasHeatmap({
  scales,
  thresholds,
  outputScaleMax,
  dimensionCount,
  matrixName = "Risk Matrix",
  showGradient = false,
}: CanvasHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);
  const [selectedExposureLevel, setSelectedExposureLevel] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState(0);

  // Sort scales for display
  // Likelihood: high-to-low (rows, highest at top)
  // Impact: low-to-high (columns, lowest on left)
  // Exposure: low-to-high (tabs)
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

  const exposureLevels = useMemo(
    () => (scales.exposure
      ? [...scales.exposure]
          .map(l => ({ ...l, value: Number(l.value) }))
          .sort((a, b) => a.value - b.value)
      : []),
    [scales.exposure]
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

  const maxExposure = useMemo(
    () => (scales.exposure ? Math.max(...scales.exposure.map((e) => Number(e.value))) : undefined),
    [scales.exposure]
  );

  // Initialize selected exposure level to first available level
  useEffect(() => {
    if (exposureLevels.length > 0) {
      const firstValue = exposureLevels[0]?.value;
      // Only initialize if current selection doesn't exist in levels
      const currentExists = exposureLevels.some(e => e.value === selectedExposureLevel);
      if (!currentExists && firstValue !== undefined) {
        setSelectedExposureLevel(firstValue);
      }
    }
  }, [exposureLevels, selectedExposureLevel]);

  // Get current exposure value for 3D calculation
  const currentExposure = useMemo(() => {
    if (dimensionCount === 2 || !scales.exposure) return undefined;
    return exposureLevels.find((e) => e.value === selectedExposureLevel);
  }, [dimensionCount, scales.exposure, exposureLevels, selectedExposureLevel]);

  /**
   * Calculate risk score
   * 2D: (L × I) / (maxL × maxI) × outputScaleMax
   * 3D: (L × I × E) / (maxL × maxI × maxE) × outputScaleMax
   */
  const calculateScore = useCallback(
    (likelihood: number, impact: number, exposure?: number): number => {
      if (exposure !== undefined && maxExposure !== undefined) {
        // 3D calculation
        const raw = likelihood * impact * exposure;
        const maxPossible = maxLikelihood * maxImpact * maxExposure;
        return maxPossible > 0 ? (raw / maxPossible) * outputScaleMax : 0;
      } else {
        // 2D calculation
        const raw = likelihood * impact;
        const maxPossible = maxLikelihood * maxImpact;
        return maxPossible > 0 ? (raw / maxPossible) * outputScaleMax : 0;
      }
    },
    [maxLikelihood, maxImpact, maxExposure, outputScaleMax]
  );

  /**
   * Find threshold for a given score
   * With gaps between thresholds, we use inclusive bounds on both ends
   */
  const getThreshold = useCallback(
    (score: number): Threshold | undefined => {
      return sortedThresholds.find((t) => {
        return score >= t.minValue && score <= t.maxValue;
      });
    },
    [sortedThresholds]
  );

  /**
   * Calculate canvas dimensions
   */
  const canvasDimensions = useMemo(() => {
    const cols = impactLevels.length;
    const rows = likelihoodLevels.length;

    // Calculate cell size based on container width
    const availableWidth = Math.max(containerWidth - AXIS_LABEL_WIDTH - PADDING * 2, cols * MIN_CELL_SIZE);
    const cellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, Math.floor(availableWidth / cols)));

    const width = AXIS_LABEL_WIDTH + cols * cellSize + PADDING;
    const height = HEADER_HEIGHT + AXIS_LABEL_HEIGHT + rows * cellSize + PADDING;

    return { width, height, cellSize, cols, rows };
  }, [containerWidth, impactLevels.length, likelihoodLevels.length]);

  /**
   * Draw the heatmap on canvas
   */
  const renderHeatmap = useCallback(
    (ctx: CanvasRenderingContext2D, dpr: number) => {
      const { width, height, cellSize, cols, rows } = canvasDimensions;

      // Clear canvas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Draw header
      ctx.fillStyle = "#374151";
      ctx.font = "bold 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const gridStartX = AXIS_LABEL_WIDTH;
      const gridStartY = HEADER_HEIGHT + AXIS_LABEL_HEIGHT;

      // Impact header (X axis)
      ctx.fillText(
        "Impact →",
        gridStartX + (cols * cellSize) / 2,
        HEADER_HEIGHT / 2
      );

      // Column headers (impact levels)
      ctx.font = "12px Inter, system-ui, sans-serif";
      impactLevels.forEach((impact, colIdx) => {
        const x = gridStartX + colIdx * cellSize + cellSize / 2;
        const y = HEADER_HEIGHT + AXIS_LABEL_HEIGHT / 2;
        ctx.fillText(
          impact.label || `${impact.value}`,
          x,
          y,
          cellSize - 4
        );
      });

      // Likelihood header (Y axis)
      ctx.save();
      ctx.translate(PADDING, gridStartY + (rows * cellSize) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = "bold 14px Inter, system-ui, sans-serif";
      ctx.fillText("Likelihood ↑", 0, 0);
      ctx.restore();

      // Row headers (likelihood levels)
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      likelihoodLevels.forEach((likelihood, rowIdx) => {
        const x = AXIS_LABEL_WIDTH - 8;
        const y = gridStartY + rowIdx * cellSize + cellSize / 2;
        ctx.fillText(
          likelihood.label || `${likelihood.value}`,
          x,
          y,
          AXIS_LABEL_WIDTH - 16
        );
      });

      // Draw cells
      likelihoodLevels.forEach((likelihood, rowIdx) => {
        impactLevels.forEach((impact, colIdx) => {
          const x = gridStartX + colIdx * cellSize;
          const y = gridStartY + rowIdx * cellSize;

          const score = calculateScore(
            likelihood.value,
            impact.value,
            currentExposure?.value
          );
          const threshold = getThreshold(score);
          const bgColor = threshold?.color ?? "#CCCCCC";
          const textColor = getContrastColor(bgColor);

          // Fill cell
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, cellSize, cellSize);

          // Hover highlight
          if (
            hoveredCell &&
            hoveredCell.row === rowIdx &&
            hoveredCell.col === colIdx
          ) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
          }

          // Grid lines
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellSize, cellSize);

          // Score text
          ctx.fillStyle = textColor;
          ctx.font = "bold 14px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(score.toFixed(1), x + cellSize / 2, y + cellSize / 2 - 8);

          // Label text (smaller)
          if (threshold && cellSize >= 50) {
            ctx.font = "10px Inter, system-ui, sans-serif";
            ctx.fillText(
              threshold.label,
              x + cellSize / 2,
              y + cellSize / 2 + 10,
              cellSize - 8
            );
          }
        });
      });
    },
    [
      canvasDimensions,
      impactLevels,
      likelihoodLevels,
      calculateScore,
      currentExposure,
      getThreshold,
      hoveredCell,
    ]
  );

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Render canvas when dependencies change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvasDimensions;

    // Set canvas size with DPR for crisp rendering
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    renderHeatmap(ctx, dpr);
  }, [canvasDimensions, containerWidth, renderHeatmap]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const { cellSize } = canvasDimensions;
      const gridStartX = AXIS_LABEL_WIDTH;
      const gridStartY = HEADER_HEIGHT + AXIS_LABEL_HEIGHT;

      // Check if within grid area
      if (
        x >= gridStartX &&
        x < gridStartX + impactLevels.length * cellSize &&
        y >= gridStartY &&
        y < gridStartY + likelihoodLevels.length * cellSize
      ) {
        const col = Math.floor((x - gridStartX) / cellSize);
        const row = Math.floor((y - gridStartY) / cellSize);

        const likelihood = likelihoodLevels[row];
        const impact = impactLevels[col];

        if (likelihood && impact) {
          const score = calculateScore(
            likelihood.value,
            impact.value,
            currentExposure?.value
          );
          const threshold = getThreshold(score);

          setHoveredCell({
            row,
            col,
            score,
            threshold,
            likelihood,
            impact,
            exposure: currentExposure,
            x: e.clientX,
            y: e.clientY,
          });
        }
      } else {
        setHoveredCell(null);
      }
    },
    [
      canvasDimensions,
      impactLevels,
      likelihoodLevels,
      calculateScore,
      currentExposure,
      getThreshold,
    ]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  /**
   * Export canvas as PNG (AC17-AC20)
   */
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create export canvas with legend
    const exportCanvas = document.createElement("canvas");
    const legendHeight = 80 + sortedThresholds.length * 24;
    const { width, height } = canvasDimensions;
    const dpr = window.devicePixelRatio || 1;

    exportCanvas.width = width * dpr;
    exportCanvas.height = (height + legendHeight) * dpr;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height + legendHeight);

    // Copy heatmap (re-render without hover)
    const tempHovered = hoveredCell;
    setHoveredCell(null);
    renderHeatmap(ctx, dpr);

    // Draw legend
    const legendY = height + 20;
    ctx.fillStyle = "#374151";
    ctx.font = "bold 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Risk Levels:", 20, legendY);

    sortedThresholds.forEach((threshold, idx) => {
      const y = legendY + 24 + idx * 24;

      // Color box
      ctx.fillStyle = threshold.color;
      ctx.fillRect(20, y - 12, 20, 16);
      ctx.strokeStyle = "#e5e7eb";
      ctx.strokeRect(20, y - 12, 20, 16);

      // Label and range
      ctx.fillStyle = "#374151";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.fillText(
        `${threshold.label}: ${threshold.minValue.toFixed(1)} - ${threshold.maxValue.toFixed(1)} (${threshold.slaDays}d SLA)`,
        48,
        y
      );
    });

    // Formula
    const formulaY = legendY + 24 + sortedThresholds.length * 24 + 16;
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Inter, system-ui, sans-serif";
    const formula = dimensionCount === 3
      ? `Formula: Score = (L × I × E) / (${maxLikelihood} × ${maxImpact} × ${maxExposure}) × ${outputScaleMax}`
      : `Formula: Score = (L × I) / (${maxLikelihood} × ${maxImpact}) × ${outputScaleMax}`;
    ctx.fillText(formula, 20, formulaY);

    // Restore hover state
    if (tempHovered) {
      setHoveredCell(tempHovered);
    }

    // Download
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().split("T")[0];
    const safeName = matrixName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    link.download = `${safeName}-heatmap-${timestamp}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, [
    canvasDimensions,
    sortedThresholds,
    dimensionCount,
    maxLikelihood,
    maxImpact,
    maxExposure,
    outputScaleMax,
    matrixName,
    hoveredCell,
    renderHeatmap,
  ]);

  // Validation
  const hasValidScales =
    scales.likelihood.length >= 3 && scales.impact.length >= 3;
  const hasValidThresholds = thresholds.length >= 2;

  if (!hasValidScales || !hasValidThresholds) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {!hasValidScales
          ? "Both likelihood and impact scales must have at least 3 levels."
          : "At least 2 thresholds are required to display the heatmap."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AC7-AC8: Exposure layer selector for 3D matrices */}
      {dimensionCount === 3 && exposureLevels.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Exposure Layer:</span>
          <div className="flex gap-2">
            {exposureLevels.map((level) => (
              <Button
                key={level.value}
                variant={selectedExposureLevel === level.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedExposureLevel(level.value)}
              >
                {level.label || `Level ${level.value}`}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto"
        style={{ minWidth: impactLevels.length * MIN_CELL_SIZE + AXIS_LABEL_WIDTH }}
      >
        <TooltipProvider delayDuration={0}>
          <Tooltip open={!!hoveredCell}>
            <TooltipTrigger asChild>
              <canvas
                ref={canvasRef}
                className="cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </TooltipTrigger>
            {hoveredCell && (
              <TooltipContent
                side="right"
                sideOffset={10}
                className="max-w-xs"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    Risk Score: {hoveredCell.score.toFixed(2)}
                  </p>
                  <p className="text-xs">
                    Level:{" "}
                    <span
                      className="px-1 rounded"
                      style={{
                        backgroundColor: hoveredCell.threshold?.color ?? "#ccc",
                        color: getContrastColor(hoveredCell.threshold?.color ?? "#ccc"),
                      }}
                    >
                      {hoveredCell.threshold?.label ?? "Unknown"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hoveredCell.likelihood.label || `L${hoveredCell.likelihood.value}`} ×{" "}
                    {hoveredCell.impact.label || `I${hoveredCell.impact.value}`}
                    {hoveredCell.exposure && (
                      <> × {hoveredCell.exposure.label || `E${hoveredCell.exposure.value}`}</>
                    )}
                  </p>
                  {hoveredCell.threshold && (
                    <p className="text-xs text-muted-foreground">
                      SLA: {hoveredCell.threshold.slaDays} days
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Calculation: ({hoveredCell.likelihood.value} × {hoveredCell.impact.value}
                    {hoveredCell.exposure && <> × {hoveredCell.exposure.value}</>}) /{" "}
                    {maxLikelihood * maxImpact * (maxExposure ?? 1)} × {outputScaleMax}
                  </p>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Legend (AC15) */}
      <div className="mt-4">
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
                ({threshold.slaDays}d SLA)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Formula explanation (AC16) */}
      <div className="text-xs text-muted-foreground">
        <p>
          <strong>Formula:</strong>{" "}
          {dimensionCount === 3
            ? `Risk Score = (Likelihood × Impact × Exposure) / (${maxLikelihood} × ${maxImpact} × ${maxExposure}) × ${outputScaleMax}`
            : `Risk Score = (Likelihood × Impact) / (${maxLikelihood} × ${maxImpact}) × ${outputScaleMax}`}
        </p>
        {dimensionCount === 3 && currentExposure && (
          <p className="mt-1">
            Current Exposure: {currentExposure.label || `Level ${currentExposure.value}`} (value: {currentExposure.value})
          </p>
        )}
      </div>

      {/* Export button (AC17) */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export as PNG
        </Button>
      </div>
    </div>
  );
}
