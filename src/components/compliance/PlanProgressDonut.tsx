"use client";

/**
 * PlanProgressDonut — compliance plan item breakdown donut.
 *
 * Renders a three-slice donut partitioning every plan item into exactly one of:
 *   - Complete     (closed statuses: COMPLETE / RISK_ACCEPTED)
 *   - Overdue      (not complete AND past target date)
 *   - Not Complete (open / in-progress / in-review / deferred, not overdue)
 *
 * The % complete is shown in the center. Theme-aware via CSS custom-property
 * chart tokens; responsive via ResponsiveContainer. Empty case (0 items) renders
 * a graceful empty-state instead of an empty chart.
 */

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  type TooltipProps,
} from "recharts";

type Slice = { name: string; value: number; color: string };

/** Custom tooltip mirroring the strategy dashboard idiom. */
function DonutTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm shadow-sm">
      <p className="font-medium text-foreground">
        {data?.name}: <span className="font-mono tnum">{data?.value}</span>
      </p>
    </div>
  );
}

export function PlanProgressDonut({
  complete,
  notComplete,
  overdue,
}: {
  complete: number;
  notComplete: number;
  overdue: number;
}) {
  const total = complete + notComplete + overdue;

  if (total === 0) {
    return (
      <div className="flex h-[180px] w-full items-center justify-center text-sm text-muted-foreground">
        No items to chart yet.
      </div>
    );
  }

  const progressPct = Math.round((complete / total) * 100);

  const data: Slice[] = [
    { name: "Complete", value: complete, color: "var(--success)" },
    { name: "Not Complete", value: notComplete, color: "var(--warning)" },
    { name: "Overdue", value: overdue, color: "var(--destructive)" },
  ];
  const visible = data.filter((d) => d.value > 0);

  return (
    <div className="relative h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={visible}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {visible.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={(value, entry) => (
              <span className="text-xs text-muted-foreground">
                {value} (
                <span className="font-mono tnum">
                  {(entry.payload as { value: number }).value}
                </span>
                )
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label — % complete. Positioned over the donut hole; the legend
          occupies the bottom band so nudge the label up to stay centered on the ring. */}
      <div className="pointer-events-none absolute inset-x-0 top-[64px] flex -translate-y-1/2 flex-col items-center">
        <span className="text-2xl font-bold tnum text-foreground">{progressPct}%</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Complete</span>
      </div>
    </div>
  );
}
