/**
 * Strategy Timeline Utilities
 *
 * Data transformation functions for calendar and timeline views.
 */

import { ObjectiveStatus } from "@prisma/client";
import { isValid, parseISO } from "date-fns";

/**
 * Safely parse a date value to a Date object
 */
function safeParseDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  try {
    const parsed = typeof date === "string" ? parseISO(date) : new Date(date);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Calendar event representing a goal or objective with a date
 */
export interface CalendarEvent {
  id: string;
  date: Date;
  type: "goal" | "objective";
  title: string;
  status?: ObjectiveStatus;
  progress: number;
  goalId?: string;
  goalTitle?: string;
}

/**
 * Timeline item for Gantt-style visualization
 */
export interface TimelineItem {
  id: string;
  title: string;
  type: "goal" | "objective";
  startDate: Date;
  endDate: Date | null;
  progress: number;
  status?: ObjectiveStatus;
  level: number; // 0 = goal, 1 = objective
  parentId?: string;
  children?: TimelineItem[];
}

/**
 * Strategy data structure from API
 */
export interface StrategyData {
  id: string;
  title: string;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  createdAt: Date;
  progress: number;
  goals: Array<{
    id: string;
    title: string;
    targetDate: Date | null;
    createdAt: Date;
    progress: number;
    objectives?: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      createdAt: Date;
      status: ObjectiveStatus;
      progress: number;
    }>;
    _count?: { objectives: number };
  }>;
}

/**
 * Transform strategy data to calendar events
 * Extracts goals and objectives with dates for calendar display
 */
export function transformToCalendarEvents(strategy: StrategyData): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const goal of strategy.goals) {
    // Add goal if it has a targetDate
    const goalDate = safeParseDate(goal.targetDate);
    if (goalDate) {
      events.push({
        id: goal.id,
        date: goalDate,
        type: "goal",
        title: goal.title,
        progress: goal.progress,
      });
    }

    // Add objectives with dueDates
    if (goal.objectives) {
      for (const obj of goal.objectives) {
        const objDate = safeParseDate(obj.dueDate);
        if (objDate) {
          events.push({
            id: obj.id,
            date: objDate,
            type: "objective",
            title: obj.title,
            status: obj.status,
            progress: obj.progress,
            goalId: goal.id,
            goalTitle: goal.title,
          });
        }
      }
    }
  }

  return events;
}

/**
 * Get items without dates (unscheduled)
 */
export function getUnscheduledItems(strategy: StrategyData): {
  goals: Array<{ id: string; title: string; progress: number }>;
  objectives: Array<{ id: string; title: string; status: ObjectiveStatus; progress: number; goalTitle: string }>;
} {
  const goals: Array<{ id: string; title: string; progress: number }> = [];
  const objectives: Array<{ id: string; title: string; status: ObjectiveStatus; progress: number; goalTitle: string }> = [];

  for (const goal of strategy.goals) {
    if (!goal.targetDate) {
      goals.push({
        id: goal.id,
        title: goal.title,
        progress: goal.progress,
      });
    }

    if (goal.objectives) {
      for (const obj of goal.objectives) {
        if (!obj.dueDate) {
          objectives.push({
            id: obj.id,
            title: obj.title,
            status: obj.status,
            progress: obj.progress,
            goalTitle: goal.title,
          });
        }
      }
    }
  }

  return { goals, objectives };
}

/**
 * Transform strategy data to timeline items for Gantt chart
 * Returns hierarchical data with goals containing objectives
 */
export function transformToTimelineData(strategy: StrategyData): TimelineItem[] {
  const now = new Date();

  return strategy.goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    type: "goal" as const,
    startDate: safeParseDate(goal.createdAt) ?? now,
    endDate: safeParseDate(goal.targetDate),
    progress: goal.progress,
    level: 0,
    children: goal.objectives?.map((obj) => ({
      id: obj.id,
      title: obj.title,
      type: "objective" as const,
      startDate: safeParseDate(obj.createdAt) ?? now,
      endDate: safeParseDate(obj.dueDate),
      progress: obj.progress,
      status: obj.status,
      level: 1,
      parentId: goal.id,
    })) ?? [],
  }));
}

/**
 * Get fiscal year date range
 * Assumes fiscal year starts on January 1st
 */
export function getFiscalYearRange(
  fiscalYearStart: number,
  fiscalYearEnd: number
): { start: Date; end: Date } {
  return {
    start: new Date(fiscalYearStart, 0, 1), // January 1st
    end: new Date(fiscalYearEnd, 11, 31), // December 31st
  };
}

/**
 * Get progress color class based on percentage
 */
export function getProgressColor(progress: number): string {
  if (progress >= 67) return "bg-green-500";
  if (progress >= 34) return "bg-amber-500";
  return "bg-red-500";
}

/**
 * Get progress text color class based on percentage
 */
export function getProgressTextColor(progress: number): string {
  if (progress >= 67) return "text-green-600";
  if (progress >= 34) return "text-amber-600";
  return "text-red-600";
}

/**
 * Get status color class for objectives
 */
export function getStatusColor(status: ObjectiveStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-500";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "AT_RISK":
      return "bg-amber-500";
    case "NOT_STARTED":
    default:
      return "bg-slate-400";
  }
}

/**
 * Get status badge color classes for objectives
 */
export function getStatusBadgeColor(status: ObjectiveStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700 border-green-200";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "AT_RISK":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "NOT_STARTED":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/**
 * Calculate the date range for the timeline
 * Uses strategy fiscal year as bounds, but expands if items fall outside
 */
export function calculateTimelineRange(
  strategy: StrategyData,
  timelineData: TimelineItem[]
): { start: Date; end: Date } {
  const fiscalRange = getFiscalYearRange(strategy.fiscalYearStart, strategy.fiscalYearEnd);
  let minDate = fiscalRange.start;
  let maxDate = fiscalRange.end;

  // Check all items to expand range if needed
  for (const goal of timelineData) {
    if (goal.startDate < minDate) minDate = goal.startDate;
    if (goal.endDate && goal.endDate > maxDate) maxDate = goal.endDate;

    for (const obj of goal.children ?? []) {
      if (obj.startDate < minDate) minDate = obj.startDate;
      if (obj.endDate && obj.endDate > maxDate) maxDate = obj.endDate;
    }
  }

  return { start: minDate, end: maxDate };
}

/**
 * Flatten timeline data for rendering (goals and objectives in order)
 */
export function flattenTimelineData(timelineData: TimelineItem[]): TimelineItem[] {
  const result: TimelineItem[] = [];

  for (const goal of timelineData) {
    result.push(goal);
    for (const obj of goal.children ?? []) {
      result.push(obj);
    }
  }

  return result;
}
