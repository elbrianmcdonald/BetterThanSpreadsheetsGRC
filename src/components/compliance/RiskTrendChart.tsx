"use client";

/**
 * Risk Trend Chart Component
 *
 * Story 5.4: Open Risk Count and Recently Closed Risks Display (AC13-AC17)
 *
 * Displays risk trend for the dashboard:
 * - AC13: Widget shows risk trend over last 30 days
 * - AC14: Chart plots open risks count per day (line graph)
 * - AC15: Chart includes closed risks per week (bar graph overlay)
 * - AC16: Hover tooltip shows exact count for each day
 * - AC17: Trend helps visualize remediation velocity
 *
 * @see Story 5.4: Open Risk Count and Recently Closed Risks Display
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfWeek } from "date-fns";

export interface RiskTrendChartProps {
  dailyOpenCounts: Array<{
    date: string;
    count: number;
  }>;
  weeklyClosedCounts: Array<{
    weekStart: string;
    weekEnd: string;
    count: number;
  }>;
}

// Custom tooltip component for AC16
function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  // Safely parse the label date - handle undefined/invalid values
  let formattedDate = "";
  if (label && typeof label === "string") {
    try {
      const parsedDate = parseISO(label);
      if (!isNaN(parsedDate.getTime())) {
        formattedDate = format(parsedDate, "MMM d, yyyy");
      }
    } catch {
      formattedDate = label;
    }
  }

  return (
    <div className="bg-background border border-border rounded-md shadow-sm p-3 text-sm">
      <p className="font-medium mb-1">
        {formattedDate || "Unknown date"}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Calculate trend direction
function calculateTrend(
  dailyOpenCounts: Array<{ date: string; count: number }>
): { direction: "up" | "down" | "stable"; change: number } {
  if (dailyOpenCounts.length < 2) {
    return { direction: "stable", change: 0 };
  }

  const firstCount = dailyOpenCounts[0]?.count ?? 0;
  const lastCount = dailyOpenCounts[dailyOpenCounts.length - 1]?.count ?? 0;
  const change = lastCount - firstCount;

  if (change > 0) return { direction: "up", change };
  if (change < 0) return { direction: "down", change: Math.abs(change) };
  return { direction: "stable", change: 0 };
}

/**
 * Safely parse an ISO date string
 */
function safeParseISO(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  try {
    const date = parseISO(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Merge daily and weekly data for combined chart
function prepareChartData(
  dailyOpenCounts: Array<{ date: string; count: number }>,
  weeklyClosedCounts: Array<{ weekStart: string; weekEnd: string; count: number }>
) {
  // Create a map of week start dates to closed counts
  const weeklyMap = new Map<string, number>();
  for (const week of weeklyClosedCounts) {
    weeklyMap.set(week.weekStart, week.count);
  }

  // Merge daily open counts with weekly closed (shown on the first day of each week)
  return dailyOpenCounts.map((day) => {
    const dayDate = safeParseISO(day.date);

    // Skip invalid dates
    if (!dayDate) {
      return {
        date: day.date,
        displayDate: "Invalid",
        openRisks: day.count,
        closedRisks: null,
      };
    }

    const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 }); // Monday
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    // Only show closed count on the first day of the week
    const isMondayOrFirstDayOfWeek =
      day.date === weekStartStr ||
      (dailyOpenCounts.length > 0 && day === dailyOpenCounts[0]);

    return {
      date: day.date,
      displayDate: format(dayDate, "MMM d"),
      openRisks: day.count,
      closedRisks: isMondayOrFirstDayOfWeek
        ? weeklyMap.get(weekStartStr) ?? null
        : null,
    };
  });
}

export function RiskTrendChart({
  dailyOpenCounts,
  weeklyClosedCounts,
}: RiskTrendChartProps) {
  const chartData = prepareChartData(dailyOpenCounts, weeklyClosedCounts);
  const trend = calculateTrend(dailyOpenCounts);

  // Calculate total closed in period
  const totalClosed = weeklyClosedCounts.reduce((sum, week) => sum + week.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Risk Trend</CardTitle>
            <CardDescription>
              Open risks over last 30 days with weekly closures
            </CardDescription>
          </div>
          {/* Trend indicator - AC17: Visualize remediation velocity */}
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md",
              trend.direction === "down" && "bg-success/10 text-success",
              trend.direction === "up" && "bg-destructive/10 text-destructive",
              trend.direction === "stable" && "bg-secondary text-muted-foreground"
            )}
          >
            {trend.direction === "down" && (
              <>
                <TrendingDown className="h-4 w-4" />
                <span className="tabular-nums">-{trend.change}</span>
              </>
            )}
            {trend.direction === "up" && (
              <>
                <TrendingUp className="h-4 w-4" />
                <span className="tabular-nums">+{trend.change}</span>
              </>
            )}
            {trend.direction === "stable" && (
              <>
                <Minus className="h-4 w-4" />
                <span>No change</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dailyOpenCounts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            No risk data available for trend analysis
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="flex gap-6 mb-4 text-sm">
              <div>
                <span className="text-muted-foreground">Period:</span>{" "}
                <span className="font-medium tabular-nums">30 days</span>
              </div>
              <div>
                <span className="text-muted-foreground">Closed this month:</span>{" "}
                <span className="font-medium tabular-nums text-success">{totalClosed}</span>
              </div>
            </div>

            {/* AC13-AC16: Combined chart with line (open) and bar (closed) */}
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    allowDecimals={false}
                  />
                  {/* AC16: Hover tooltip shows exact count */}
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  {/* AC15: Closed risks per week as bar */}
                  <Bar
                    dataKey="closedRisks"
                    name="Closed (weekly)"
                    fill="var(--success)"
                    opacity={0.7}
                    barSize={20}
                    radius={[2, 2, 0, 0]}
                  />
                  {/* AC14: Open risks count per day as line */}
                  <Line
                    type="monotone"
                    dataKey="openRisks"
                    name="Open Risks"
                    stroke="var(--severity-high)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
