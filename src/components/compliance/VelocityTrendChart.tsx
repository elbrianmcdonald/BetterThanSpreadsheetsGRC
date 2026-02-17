"use client";

/**
 * Velocity Trend Chart Component
 *
 * Story 5.8: Remediation Velocity Metrics (Average Days-to-Close)
 *
 * Displays velocity trend over time:
 * - AC12: Widget includes line chart showing average days-to-close over last 12 months
 * - AC13: Chart plots monthly average (one data point per month)
 * - AC14: Chart includes separate lines for HIGH, MEDIUM, LOW severities
 * - AC15: Hover tooltip shows exact average for each month
 * - AC16: Chart helps visualize velocity trends (improving vs degrading)
 *
 * @see Story 5.8: Remediation Velocity Metrics
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  type TooltipProps,
} from "recharts";
import { format, parseISO, isValid } from "date-fns";

/**
 * Safely parse a month string (YYYY-MM) to a Date
 */
function safeParseMonth(monthStr: string | undefined | null): Date | null {
  if (!monthStr || typeof monthStr !== "string") return null;
  try {
    const date = parseISO(`${monthStr}-01`);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

// Velocity benchmarks per severity
const VELOCITY_BENCHMARKS = {
  HIGH: 14,
  MEDIUM: 30,
  LOW: 60,
};

export interface VelocityTrendPoint {
  month: string; // YYYY-MM format
  overall: number;
  bySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  count: number;
}

export interface VelocityTrendChartProps {
  data: VelocityTrendPoint[];
  showBenchmarks?: boolean;
}

/**
 * AC15: Custom tooltip component
 */
function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  // Parse the month label (YYYY-MM) safely
  const parsedDate = safeParseMonth(label);
  const monthLabel = parsedDate ? format(parsedDate, "MMMM yyyy") : label ?? "";

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{monthLabel}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {typeof entry.value === "number" ? entry.value.toFixed(1) : "—"} days
          </span>
        </div>
      ))}
      {payload[0]?.payload?.count !== undefined && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          {payload[0].payload.count} risks closed this month
        </div>
      )}
    </div>
  );
}

/**
 * Transform trend data for the chart
 */
function prepareChartData(data: VelocityTrendPoint[]) {
  return data.map((point) => {
    const parsedDate = safeParseMonth(point.month);
    return {
      month: point.month,
      displayMonth: parsedDate ? format(parsedDate, "MMM yy") : point.month ?? "Unknown",
      overall: point.overall > 0 ? point.overall : null,
      high: point.bySeverity.HIGH > 0 ? point.bySeverity.HIGH : null,
      medium: point.bySeverity.MEDIUM > 0 ? point.bySeverity.MEDIUM : null,
      low: point.bySeverity.LOW > 0 ? point.bySeverity.LOW : null,
      count: point.count,
    };
  });
}

/**
 * Story 5.8 AC12-AC16: Velocity Trend Chart
 */
export function VelocityTrendChart({
  data,
  showBenchmarks = true,
}: VelocityTrendChartProps) {
  const chartData = prepareChartData(data);
  const hasData = chartData.some((d) => d.overall !== null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Velocity Trend</CardTitle>
        </div>
        <CardDescription>
          Average days-to-close by severity over last 12 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            No velocity data available for trend analysis
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="displayMonth"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  label={{
                    value: "Days",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                {/* AC15: Hover tooltip */}
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "hsl(var(--muted))", strokeWidth: 1 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />

                {/* Benchmark reference lines */}
                {showBenchmarks && (
                  <>
                    <ReferenceLine
                      y={VELOCITY_BENCHMARKS.HIGH}
                      stroke="hsl(0, 72%, 51%)"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                    <ReferenceLine
                      y={VELOCITY_BENCHMARKS.MEDIUM}
                      stroke="hsl(45, 93%, 47%)"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                    <ReferenceLine
                      y={VELOCITY_BENCHMARKS.LOW}
                      stroke="hsl(217, 91%, 60%)"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                  </>
                )}

                {/* AC14: Separate lines for each severity */}
                <Line
                  type="monotone"
                  dataKey="high"
                  name="High Severity"
                  stroke="hsl(0, 72%, 51%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  name="Medium Severity"
                  stroke="hsl(45, 93%, 47%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  name="Low Severity"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Benchmark legend */}
        {hasData && showBenchmarks && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Benchmark targets (dashed lines):
            </p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500" />
                <span>High: &lt;{VELOCITY_BENCHMARKS.HIGH}d</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-yellow-500" />
                <span>Medium: &lt;{VELOCITY_BENCHMARKS.MEDIUM}d</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-blue-500" />
                <span>Low: &lt;{VELOCITY_BENCHMARKS.LOW}d</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
