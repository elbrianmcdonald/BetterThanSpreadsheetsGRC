"use client";

/**
 * Strategy Timeline Chart Component (Gantt-style)
 *
 * Displays goals and objectives as horizontal bars on a timeline.
 * X-axis shows the fiscal year date range with month markers.
 * Y-axis shows goals with nested objectives.
 */

import { useMemo, useState } from "react";
import {
  format,
  differenceInDays,
  startOfMonth,
  eachMonthOfInterval,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import {
  Flag,
  Target,
  ChevronDown,
  ChevronRight,
  GanttChart,
  Calendar,
} from "lucide-react";
import { ObjectiveStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  type StrategyData,
  type TimelineItem,
  transformToTimelineData,
  calculateTimelineRange,
  getProgressColor,
  getStatusColor,
  getStatusBadgeColor,
} from "@/lib/strategy-timeline-utils";

interface StrategyTimelineChartProps {
  strategy: StrategyData;
  onGoalClick?: (goalId: string) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}

const GOAL_ROW_HEIGHT = 48;
const OBJECTIVE_ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 250;

/**
 * Calculate position and width of a timeline bar as percentages
 */
function calculateBarPosition(
  startDate: Date,
  endDate: Date | null,
  timelineStart: Date,
  timelineEnd: Date
): { left: number; width: number } {
  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
  const now = new Date();

  // Clamp start date to timeline range
  const effectiveStart = isBefore(startDate, timelineStart)
    ? timelineStart
    : startDate;
  const effectiveEnd = endDate
    ? isAfter(endDate, timelineEnd)
      ? timelineEnd
      : endDate
    : isAfter(now, timelineEnd)
    ? timelineEnd
    : now;

  const startOffset = differenceInDays(effectiveStart, timelineStart);
  const duration = Math.max(1, differenceInDays(effectiveEnd, effectiveStart));

  const left = (startOffset / totalDays) * 100;
  const width = (duration / totalDays) * 100;

  return { left: Math.max(0, left), width: Math.min(100 - left, width) };
}

/**
 * Calculate position for a due date marker as percentage
 */
function calculateDueDatePosition(
  dueDate: Date,
  timelineStart: Date,
  timelineEnd: Date
): number {
  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
  const dueDateOffset = differenceInDays(dueDate, timelineStart);
  return Math.max(0, Math.min(100, (dueDateOffset / totalDays) * 100));
}

/**
 * Timeline bar component for goals/objectives
 */
function TimelineBar({
  item,
  timelineStart,
  timelineEnd,
  onClick,
}: {
  item: TimelineItem;
  timelineStart: Date;
  timelineEnd: Date;
  onClick?: () => void;
}) {
  const { left, width } = calculateBarPosition(
    item.startDate,
    item.endDate,
    timelineStart,
    timelineEnd
  );

  const bgColor =
    item.type === "goal"
      ? getProgressColor(item.progress)
      : getStatusColor(item.status ?? "NOT_STARTED");

  const progressWidth = Math.min(item.progress, 100);

  // Calculate due date marker position for objectives
  const dueDatePosition = item.type === "objective" && item.endDate
    ? calculateDueDatePosition(item.endDate, timelineStart, timelineEnd)
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-6 rounded-md transition-all hover:ring-2 hover:ring-primary/50",
              item.type === "objective" && "h-4",
              "bg-muted border"
            )}
            style={{
              left: `${left}%`,
              width: `${Math.max(width, 1)}%`,
            }}
          >
            {/* Progress fill */}
            <div
              className={cn("h-full rounded-md transition-all", bgColor)}
              style={{ width: `${progressWidth}%` }}
            />
            {/* Label on bar if wide enough */}
            {width > 15 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference truncate px-1">
                {item.progress}%
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{item.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {format(item.startDate, "MMM d, yyyy")} →{" "}
                {item.endDate ? format(item.endDate, "MMM d, yyyy") : "Ongoing"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Progress: {item.progress}%</span>
              {item.status && (
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1 py-0", getStatusBadgeColor(item.status))}
                >
                  {item.status.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
      {/* Due date marker for objectives */}
      {dueDatePosition !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-red-500 z-10 cursor-pointer"
              style={{ left: `${dueDatePosition}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rotate-45" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Due: {format(item.endDate!, "MMM d, yyyy")}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </TooltipProvider>
  );
}

/**
 * Today marker line
 */
function TodayMarker({
  timelineStart,
  timelineEnd,
}: {
  timelineStart: Date;
  timelineEnd: Date;
}) {
  const now = new Date();

  if (!isWithinInterval(now, { start: timelineStart, end: timelineEnd })) {
    return null;
  }

  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
  const todayOffset = differenceInDays(now, timelineStart);
  const left = (todayOffset / totalDays) * 100;

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
      style={{ left: `${left}%` }}
    >
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1 rounded">
        Today
      </div>
    </div>
  );
}

/**
 * Month header grid
 */
function MonthHeaders({
  timelineStart,
  timelineEnd,
}: {
  timelineStart: Date;
  timelineEnd: Date;
}) {
  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;

  return (
    <div className="flex h-full border-b bg-muted/30">
      {months.map((month, index) => {
        const monthStart = startOfMonth(month);
        const nextMonth =
          index < months.length - 1 ? (months[index + 1] ?? timelineEnd) : timelineEnd;
        const monthDays = differenceInDays(nextMonth, monthStart);
        const width = (monthDays / totalDays) * 100;

        return (
          <div
            key={month.toISOString()}
            className="border-r last:border-r-0 flex items-center justify-center text-xs font-medium text-muted-foreground"
            style={{ width: `${width}%` }}
          >
            {format(month, "MMM yyyy")}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Goal row with expandable objectives
 */
function GoalRow({
  goal,
  timelineStart,
  timelineEnd,
  isExpanded,
  onToggle,
  onGoalClick,
  onObjectiveClick,
}: {
  goal: TimelineItem;
  timelineStart: Date;
  timelineEnd: Date;
  isExpanded: boolean;
  onToggle: () => void;
  onGoalClick?: (goalId: string) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}) {
  const objectiveCount = goal.children?.length ?? 0;

  return (
    <>
      {/* Goal row */}
      <div className="flex border-b hover:bg-muted/30 transition-colors">
        {/* Left panel - goal info */}
        <div
          className="shrink-0 flex items-center gap-2 px-3 border-r bg-background"
          style={{ width: LEFT_PANEL_WIDTH, height: GOAL_ROW_HEIGHT }}
        >
          <button
            onClick={onToggle}
            className="p-0.5 hover:bg-muted rounded"
            disabled={objectiveCount === 0}
          >
            {objectiveCount > 0 ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="w-4" />
            )}
          </button>
          <Flag className="h-4 w-4 text-primary shrink-0" />
          <button
            onClick={() => onGoalClick?.(goal.id)}
            className="text-sm font-medium truncate text-left hover:text-primary transition-colors"
            title={goal.title}
          >
            {goal.title}
          </button>
          {objectiveCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
              {objectiveCount}
            </Badge>
          )}
        </div>

        {/* Right panel - timeline bar */}
        <div
          className="flex-1 relative"
          style={{ height: GOAL_ROW_HEIGHT }}
        >
          <TimelineBar
            item={goal}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            onClick={() => onGoalClick?.(goal.id)}
          />
        </div>
      </div>

      {/* Objective rows (when expanded) */}
      {isExpanded &&
        goal.children?.map((objective) => (
          <div
            key={objective.id}
            className="flex border-b hover:bg-muted/30 transition-colors bg-muted/10"
          >
            {/* Left panel - objective info */}
            <div
              className="shrink-0 flex items-center gap-2 px-3 pl-10 border-r bg-background"
              style={{ width: LEFT_PANEL_WIDTH, height: OBJECTIVE_ROW_HEIGHT }}
            >
              <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => onObjectiveClick?.(objective.id)}
                className="text-xs truncate text-left hover:text-primary transition-colors"
                title={objective.title}
              >
                {objective.title}
              </button>
              {objective.status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-[9px] px-1 py-0 shrink-0",
                    getStatusBadgeColor(objective.status)
                  )}
                >
                  {objective.status.replace("_", " ")}
                </Badge>
              )}
            </div>

            {/* Right panel - timeline bar */}
            <div
              className="flex-1 relative"
              style={{ height: OBJECTIVE_ROW_HEIGHT }}
            >
              <TimelineBar
                item={objective}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                onClick={() => onObjectiveClick?.(objective.id)}
              />
            </div>
          </div>
        ))}
    </>
  );
}

export function StrategyTimelineChart({
  strategy,
  onGoalClick,
  onObjectiveClick,
}: StrategyTimelineChartProps) {
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  // Transform data
  const timelineData = useMemo(
    () => transformToTimelineData(strategy),
    [strategy]
  );

  // Calculate timeline range
  const { start: timelineStart, end: timelineEnd } = useMemo(
    () => calculateTimelineRange(strategy, timelineData),
    [strategy, timelineData]
  );

  const toggleGoal = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGoals(new Set(timelineData.map((g) => g.id)));
  };

  const collapseAll = () => {
    setExpandedGoals(new Set());
  };

  // Count totals
  const totalGoals = timelineData.length;
  const totalObjectives = timelineData.reduce(
    (sum, g) => sum + (g.children?.length ?? 0),
    0
  );

  if (totalGoals === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <GanttChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Goals to Display</h3>
            <p className="text-muted-foreground mt-1">
              Add goals to see them on the timeline.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GanttChart className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Timeline View</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {format(timelineStart, "MMM yyyy")} - {format(timelineEnd, "MMM yyyy")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Goals:</span>
          <Badge variant="secondary">{totalGoals}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Objectives:</span>
          <Badge variant="secondary">{totalObjectives}</Badge>
        </div>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header row with months */}
            <div className="flex border-b">
              {/* Left panel header */}
              <div
                className="shrink-0 flex items-center px-3 border-r bg-muted/50 font-medium text-sm"
                style={{ width: LEFT_PANEL_WIDTH, height: HEADER_HEIGHT }}
              >
                Goals & Objectives
              </div>

              {/* Right panel header - month grid */}
              <div className="flex-1 relative" style={{ height: HEADER_HEIGHT }}>
                <MonthHeaders
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                />
              </div>
            </div>

            {/* Data rows */}
            <div className="relative">
              {/* Today marker spans all rows */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LEFT_PANEL_WIDTH, right: 0 }}>
                <TodayMarker
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                />
              </div>

              {timelineData.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  isExpanded={expandedGoals.has(goal.id)}
                  onToggle={() => toggleGoal(goal.id)}
                  onGoalClick={onGoalClick}
                  onObjectiveClick={onObjectiveClick}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Progress:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded bg-muted border">
            <div className="h-full w-1/4 rounded-l bg-red-500" />
          </div>
          <span>0-33%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded bg-muted border">
            <div className="h-full w-1/2 rounded-l bg-amber-500" />
          </div>
          <span>34-66%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-3 rounded bg-muted border">
            <div className="h-full w-3/4 rounded-l bg-green-500" />
          </div>
          <span>67-100%</span>
        </div>
        <span className="mx-2">|</span>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-4 bg-red-500" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
