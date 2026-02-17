"use client";

/**
 * Risk Heatmap Component
 *
 * Displays a 5x5 heatmap showing risk distribution by
 * likelihood (Y-axis) and impact (X-axis). Uses gradient
 * coloring based on risk count in each cell.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3X3 } from "lucide-react";
import { api } from "@/trpc/react";

interface HeatmapCell {
  likelihood: string;
  likelihoodIdx: number;
  impact: string;
  impactIdx: number;
  count: number;
  risks: Array<{ id: string; title: string; severity: string }>;
  severityLevel: "critical" | "high" | "medium" | "low";
}

/**
 * Interpolate between two colors based on a ratio (0-1)
 */
function interpolateColor(color1: [number, number, number], color2: [number, number, number], ratio: number): string {
  const r = Math.round(color1[0] + (color2[0] - color1[0]) * ratio);
  const g = Math.round(color1[1] + (color2[1] - color1[1]) * ratio);
  const b = Math.round(color1[2] + (color2[2] - color1[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get gradient color based on count and max count
 * Uses a green -> yellow -> orange -> red gradient
 */
function getGradientColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) {
    return "rgb(240, 253, 244)"; // Very light green for empty cells
  }

  const ratio = Math.min(count / maxCount, 1);

  // Color stops: light green -> yellow -> orange -> red
  const colors: [number, number, number][] = [
    [187, 247, 208], // Light green (rgb(187, 247, 208))
    [254, 240, 138], // Yellow (rgb(254, 240, 138))
    [253, 186, 116], // Orange (rgb(253, 186, 116))
    [252, 129, 129], // Red (rgb(252, 129, 129))
  ];

  if (ratio <= 0.33) {
    return interpolateColor(colors[0]!, colors[1]!, ratio / 0.33);
  } else if (ratio <= 0.66) {
    return interpolateColor(colors[1]!, colors[2]!, (ratio - 0.33) / 0.33);
  } else {
    return interpolateColor(colors[2]!, colors[3]!, (ratio - 0.66) / 0.34);
  }
}

/**
 * Get text color based on background brightness
 */
function getTextColor(count: number, maxCount: number): string {
  if (count === 0) return "rgb(156, 163, 175)"; // Gray for empty
  const ratio = count / maxCount;
  return ratio > 0.5 ? "rgb(55, 65, 81)" : "rgb(75, 85, 99)"; // Dark gray
}

export function RiskHeatmap() {
  const router = useRouter();
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const { data, isLoading, error } = api.compliance.getRiskHeatmapData.useQuery(
    undefined,
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );

  // Find max count for gradient scaling
  const maxCount = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.cells.map((c) => c.count), 1);
  }, [data]);

  // Organize cells into a grid structure
  const grid = useMemo(() => {
    if (!data) return null;

    const levels = data.levels;
    const gridRows: HeatmapCell[][] = [];

    // Build grid from top (Very High likelihood) to bottom (Very Low likelihood)
    for (let likelihoodIdx = 4; likelihoodIdx >= 0; likelihoodIdx--) {
      const row: HeatmapCell[] = [];
      for (let impactIdx = 0; impactIdx <= 4; impactIdx++) {
        const cell = data.cells.find(
          (c) => c.likelihoodIdx === likelihoodIdx && c.impactIdx === impactIdx
        );
        if (cell) {
          row.push(cell);
        }
      }
      gridRows.push(row);
    }

    return { rows: gridRows, levels };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Risk Severity Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !grid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Risk Severity Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Unable to load heatmap data
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCellClick = (cell: HeatmapCell) => {
    const firstRisk = cell.risks[0];
    if (cell.count > 0 && firstRisk) {
      // Navigate to the first risk in the cell
      router.push(`/risks/${firstRisk.id}`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              Risk Severity Heatmap
            </CardTitle>
            <CardDescription>
              Open risks by likelihood and impact ({data?.totalRisks ?? 0} total)
            </CardDescription>
          </div>
          {/* Gradient legend */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fewer</span>
            <div
              className="h-3 w-24 rounded-sm"
              style={{
                background: "linear-gradient(to right, rgb(187, 247, 208), rgb(254, 240, 138), rgb(253, 186, 116), rgb(252, 129, 129))",
              }}
            />
            <span className="text-xs text-muted-foreground">More risks</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex">
          {/* Y-axis label */}
          <div className="flex flex-col justify-center pr-1">
            <div
              className="text-xs font-medium text-muted-foreground tracking-wider"
              style={{
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)",
              }}
            >
              LIKELIHOOD
            </div>
          </div>

          <div className="flex-1">
            {/* Y-axis levels and grid */}
            <div className="flex">
              {/* Y-axis level labels */}
              <div className="flex flex-col justify-around pr-2">
                {["Very High", "High", "Medium", "Low", "Very Low"].map((level) => (
                  <div
                    key={level}
                    className="h-14 flex items-center text-[11px] text-muted-foreground font-medium"
                  >
                    {level}
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              <TooltipProvider delayDuration={100}>
                <div className="flex-1">
                  <div
                    className="grid grid-cols-5 gap-[2px] p-[2px] rounded-lg"
                    style={{ backgroundColor: "rgb(229, 231, 235)" }}
                  >
                    {grid.rows.map((row, rowIdx) =>
                      row.map((cell, colIdx) => {
                        const bgColor = getGradientColor(cell.count, maxCount);
                        const textColor = getTextColor(cell.count, maxCount);

                        return (
                          <Tooltip key={`${rowIdx}-${colIdx}`}>
                            <TooltipTrigger asChild>
                              <button
                                className={`
                                  h-14 w-full transition-all duration-200
                                  flex items-center justify-center
                                  font-bold text-lg
                                  ${cell.count > 0 ? "cursor-pointer hover:scale-105 hover:shadow-lg hover:z-10" : "cursor-default"}
                                  ${rowIdx === 0 && colIdx === 0 ? "rounded-tl-md" : ""}
                                  ${rowIdx === 0 && colIdx === 4 ? "rounded-tr-md" : ""}
                                  ${rowIdx === 4 && colIdx === 0 ? "rounded-bl-md" : ""}
                                  ${rowIdx === 4 && colIdx === 4 ? "rounded-br-md" : ""}
                                `}
                                style={{
                                  backgroundColor: bgColor,
                                  color: textColor,
                                }}
                                onClick={() => handleCellClick(cell)}
                                onMouseEnter={() => setHoveredCell(cell)}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                {cell.count > 0 ? cell.count : ""}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="space-y-2">
                                <div className="font-semibold">
                                  {cell.likelihood} Likelihood × {cell.impact} Impact
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">{cell.count}</span> risk{cell.count !== 1 ? "s" : ""}
                                </div>
                                {cell.risks.length > 0 && (
                                  <div className="space-y-1 pt-1 border-t">
                                    {cell.risks.slice(0, 3).map((risk) => (
                                      <div
                                        key={risk.id}
                                        className="text-xs truncate"
                                      >
                                        <Badge
                                          variant="outline"
                                          className={`mr-1 text-[10px] px-1 py-0 ${
                                            risk.severity === "HIGH"
                                              ? "border-red-500 text-red-600"
                                              : risk.severity === "MEDIUM"
                                              ? "border-amber-500 text-amber-600"
                                              : "border-green-500 text-green-600"
                                          }`}
                                        >
                                          {risk.severity}
                                        </Badge>
                                        {risk.title.substring(0, 35)}
                                        {risk.title.length > 35 ? "..." : ""}
                                      </div>
                                    ))}
                                    {cell.risks.length > 3 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{cell.risks.length - 3} more
                                      </div>
                                    )}
                                  </div>
                                )}
                                {cell.count > 0 && (
                                  <div className="text-xs text-muted-foreground pt-1 italic">
                                    Click to view risks
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    )}
                  </div>

                  {/* X-axis level labels */}
                  <div className="flex justify-around mt-2">
                    {["Very Low", "Low", "Medium", "High", "Very High"].map(
                      (level) => (
                        <div
                          key={level}
                          className="text-[11px] text-muted-foreground font-medium text-center flex-1"
                        >
                          {level}
                        </div>
                      )
                    )}
                  </div>

                  {/* X-axis label */}
                  <div className="text-xs font-medium text-muted-foreground text-center mt-1 tracking-wider">
                    IMPACT
                  </div>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
