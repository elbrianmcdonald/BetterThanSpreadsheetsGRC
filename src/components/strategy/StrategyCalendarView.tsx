"use client";

/**
 * Strategy Calendar View Component
 *
 * Displays goals and objectives on a calendar based on their target/due dates.
 * Goals are shown with flag icons, objectives with target icons.
 * Color-coded by progress (goals) or status (objectives).
 */

import { useState, useMemo } from "react";
import { format, isSameDay, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import {
  Flag,
  Target,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertCircle,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type CalendarEvent,
  type StrategyData,
  transformToCalendarEvents,
  getUnscheduledItems,
  getProgressColor,
  getStatusColor,
  getStatusBadgeColor,
} from "@/lib/strategy-timeline-utils";

interface StrategyCalendarViewProps {
  strategy: StrategyData;
  onGoalClick?: (goalId: string) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}

/**
 * Get events for a specific day
 */
function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((event) => isSameDay(event.date, date));
}

/**
 * Event marker dot component
 */
function EventDot({ event }: { event: CalendarEvent }) {
  const colorClass =
    event.type === "goal"
      ? getProgressColor(event.progress)
      : getStatusColor(event.status ?? "NOT_STARTED");

  return (
    <div
      className={cn("w-1.5 h-1.5 rounded-full", colorClass)}
      title={event.title}
    />
  );
}

/**
 * Event list item in popover
 */
function EventListItem({
  event,
  onGoalClick,
  onObjectiveClick,
}: {
  event: CalendarEvent;
  onGoalClick?: (goalId: string) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}) {
  const handleClick = () => {
    if (event.type === "goal" && onGoalClick) {
      onGoalClick(event.id);
    } else if (event.type === "objective" && onObjectiveClick) {
      onObjectiveClick(event.id);
    }
  };

  const Icon = event.type === "goal" ? Flag : Target;
  const colorClass =
    event.type === "goal"
      ? getProgressColor(event.progress)
      : getStatusColor(event.status ?? "NOT_STARTED");

  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-start gap-2"
    >
      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", colorClass)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{event.title}</span>
        </div>
        {event.type === "objective" && event.goalTitle && (
          <p className="text-xs text-muted-foreground truncate">
            {event.goalTitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {event.progress}% complete
          </span>
          {event.type === "objective" && event.status && (
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1 py-0", getStatusBadgeColor(event.status))}
            >
              {event.status.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Unscheduled items section
 */
function UnscheduledSection({
  goals,
  objectives,
  onGoalClick,
  onObjectiveClick,
}: {
  goals: Array<{ id: string; title: string; progress: number }>;
  objectives: Array<{
    id: string;
    title: string;
    status: ObjectiveStatus;
    progress: number;
    goalTitle: string;
  }>;
  onGoalClick?: (goalId: string) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}) {
  const totalUnscheduled = goals.length + objectives.length;

  if (totalUnscheduled === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Unscheduled Items</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {totalUnscheduled}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Goals and objectives without target dates
        </CardDescription>
      </CardHeader>
      <CardContent className="py-2">
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => onGoalClick?.(goal.id)}
              className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  getProgressColor(goal.progress)
                )}
              />
              <Flag className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{goal.title}</span>
              <span className="text-xs text-muted-foreground">
                {goal.progress}%
              </span>
            </button>
          ))}
          {objectives.map((obj) => (
            <button
              key={obj.id}
              onClick={() => onObjectiveClick?.(obj.id)}
              className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors flex items-start gap-2"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-1 shrink-0",
                  getStatusColor(obj.status)
                )}
              />
              <Target className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{obj.title}</span>
                <span className="text-xs text-muted-foreground truncate block">
                  {obj.goalTitle}
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StrategyCalendarView({
  strategy,
  onGoalClick,
  onObjectiveClick,
}: StrategyCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Default to fiscal year start or current date
    const now = new Date();
    const fiscalStart = new Date(strategy.fiscalYearStart, 0, 1);
    return now >= fiscalStart ? now : fiscalStart;
  });

  // Transform data
  const events = useMemo(
    () => transformToCalendarEvents(strategy),
    [strategy]
  );
  const unscheduled = useMemo(
    () => getUnscheduledItems(strategy),
    [strategy]
  );

  // Get events for the current month for the legend
  const monthEvents = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return events.filter(
      (e) => e.date >= monthStart && e.date <= monthEnd
    );
  }, [events, currentMonth]);

  const goalCount = monthEvents.filter((e) => e.type === "goal").length;
  const objectiveCount = monthEvents.filter((e) => e.type === "objective").length;

  // Custom day content renderer
  const renderDay = (day: Date) => {
    const dayEvents = getEventsForDay(events, day);
    if (dayEvents.length === 0) return null;

    return (
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
        {dayEvents.slice(0, 3).map((event) => (
          <EventDot key={event.id} event={event} />
        ))}
        {dayEvents.length > 3 && (
          <span className="text-[8px] text-muted-foreground ml-0.5">
            +{dayEvents.length - 3}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">
              {format(currentMonth, "MMMM yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setCurrentMonth(
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Goals</span>
            <Badge variant="secondary" className="ml-1">
              {goalCount}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Objectives</span>
            <Badge variant="secondary" className="ml-1">
              {objectiveCount}
            </Badge>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <DayPicker
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            showOutsideDays
            className="mx-auto p-3"
            classNames={{
              months: "flex flex-col",
              month: "flex flex-col gap-4",
              month_caption: "hidden", // We use our own header
              nav: "hidden",
              weekdays: "flex w-full",
              weekday: "text-muted-foreground flex-1 text-center font-normal text-[0.8rem]",
              week: "flex w-full mt-2",
              day: "relative flex-1 text-center text-sm p-0",
              today: "bg-accent text-accent-foreground rounded-md",
              outside: "text-muted-foreground opacity-50",
              disabled: "text-muted-foreground opacity-50",
              hidden: "invisible",
            }}
            components={{
              DayButton: (props) => {
                const dayEvents = getEventsForDay(events, props.day.date);
                const hasEvents = dayEvents.length > 0;
                const isCurrentMonth = isSameMonth(props.day.date, currentMonth);

                if (!hasEvents) {
                  return (
                    <button
                      className={cn(
                        "h-12 w-full flex flex-col items-center justify-center rounded-md hover:bg-accent transition-colors",
                        !isCurrentMonth && "text-muted-foreground opacity-50"
                      )}
                      {...props}
                    >
                      {props.day.date.getDate()}
                    </button>
                  );
                }

                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "h-12 w-full flex flex-col items-center justify-center rounded-md hover:bg-accent transition-colors relative",
                          !isCurrentMonth && "text-muted-foreground opacity-50"
                        )}
                        {...props}
                      >
                        <span>{props.day.date.getDate()}</span>
                        <div className="absolute bottom-1 flex gap-0.5">
                          {dayEvents.slice(0, 4).map((event) => (
                            <EventDot key={event.id} event={event} />
                          ))}
                          {dayEvents.length > 4 && (
                            <span className="text-[8px] text-muted-foreground">
                              +{dayEvents.length - 4}
                            </span>
                          )}
                        </div>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <div className="space-y-1">
                        <p className="text-sm font-medium px-2 pb-1 border-b">
                          {format(props.day.date, "MMMM d, yyyy")}
                        </p>
                        <div className="max-h-48 overflow-y-auto">
                          {dayEvents.map((event) => (
                            <EventListItem
                              key={event.id}
                              event={event}
                              onGoalClick={onGoalClick}
                              onObjectiveClick={onObjectiveClick}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Color Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Progress:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>0-33%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>34-66%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>67-100%</span>
        </div>
        <span className="mx-2">|</span>
        <span className="font-medium">Status:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span>Not Started</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>At Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Completed</span>
        </div>
      </div>

      {/* Unscheduled Items */}
      <UnscheduledSection
        goals={unscheduled.goals}
        objectives={unscheduled.objectives}
        onGoalClick={onGoalClick}
        onObjectiveClick={onObjectiveClick}
      />
    </div>
  );
}
