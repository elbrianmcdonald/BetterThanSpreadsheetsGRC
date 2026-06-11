"use client";

/**
 * Kanban Board Component
 *
 * Main Kanban board layout with three columns:
 * - To Do (PENDING)
 * - In Progress (IN_PROGRESS)
 * - Completed (COMPLETED)
 *
 * Supports drag-and-drop between columns using @dnd-kit.
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { AssessmentTaskStatus, UnifiedAssessmentType } from "@prisma/client";

import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

interface Task {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  unifiedType: UnifiedAssessmentType;
  entityId?: string | null;
  entityType?: string | null;
  priority: string;
  dueDate?: Date | null;
  status: AssessmentTaskStatus;
  businessUnit?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

interface KanbanBoardProps {
  todo: Task[];
  inProgress: Task[];
  completed: Task[];
  onStatusChange: (taskId: string, newStatus: AssessmentTaskStatus) => void;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  isLoading?: boolean;
}

/** Map column IDs to statuses */
const columnStatusMap: Record<string, AssessmentTaskStatus> = {
  todo: AssessmentTaskStatus.PENDING,
  "in-progress": AssessmentTaskStatus.IN_PROGRESS,
  completed: AssessmentTaskStatus.COMPLETED,
};

/** Map statuses to column IDs */
const statusColumnMap: Record<AssessmentTaskStatus, string> = {
  [AssessmentTaskStatus.PENDING]: "todo",
  [AssessmentTaskStatus.IN_PROGRESS]: "in-progress",
  [AssessmentTaskStatus.COMPLETED]: "completed",
  [AssessmentTaskStatus.CANCELLED]: "completed", // Cancelled tasks don't show in Kanban
};

export function KanbanBoard({
  todo,
  inProgress,
  completed,
  onStatusChange,
  onStart,
  onComplete,
  isLoading,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    })
  );

  // Find a task by ID across all columns
  const findTask = useCallback((taskId: string): Task | null => {
    const allTasks = [...todo, ...inProgress, ...completed];
    return allTasks.find((t) => t.id === taskId) ?? null;
  }, [todo, inProgress, completed]);

  // Get current column for a task
  const getTaskColumn = useCallback((taskId: string): string | null => {
    if (todo.some((t) => t.id === taskId)) return "todo";
    if (inProgress.some((t) => t.id === taskId)) return "in-progress";
    if (completed.some((t) => t.id === taskId)) return "completed";
    return null;
  }, [todo, inProgress, completed]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = findTask(event.active.id as string);
    setActiveTask(task);
  }, [findTask]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as string;

    // Check if dropped on a column or another task
    let newColumnId = targetColumnId;

    // If dropped on a task, get its column
    if (!["todo", "in-progress", "completed"].includes(targetColumnId)) {
      const targetTask = findTask(targetColumnId);
      if (targetTask) {
        newColumnId = statusColumnMap[targetTask.status];
      } else {
        return; // Invalid drop target
      }
    }

    // Get current column
    const currentColumnId = getTaskColumn(taskId);
    if (!currentColumnId || currentColumnId === newColumnId) {
      return; // No change needed
    }

    // Validate the transition
    const currentStatus = columnStatusMap[currentColumnId as keyof typeof columnStatusMap];
    const newStatus = columnStatusMap[newColumnId as keyof typeof columnStatusMap];

    if (!currentStatus || !newStatus) {
      return; // Invalid column
    }

    // Define valid transitions
    const validTransitions: Record<AssessmentTaskStatus, AssessmentTaskStatus[]> = {
      [AssessmentTaskStatus.PENDING]: [AssessmentTaskStatus.IN_PROGRESS],
      [AssessmentTaskStatus.IN_PROGRESS]: [AssessmentTaskStatus.PENDING, AssessmentTaskStatus.COMPLETED],
      [AssessmentTaskStatus.COMPLETED]: [],
      [AssessmentTaskStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return; // Invalid transition
    }

    // Perform the status change
    onStatusChange(taskId, newStatus);
  }, [findTask, getTaskColumn, onStatusChange]);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could add visual feedback here
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* To Do Column */}
        <KanbanColumn
          id="todo"
          title="To Do"
          count={todo.length}
          color="bg-muted-foreground/40"
          taskIds={todo.map((t) => t.id)}
        >
          {todo.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onStart={onStart}
              isLoading={isLoading}
            />
          ))}
          {todo.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/70">
              <p className="text-sm">No pending tasks</p>
            </div>
          )}
        </KanbanColumn>

        {/* In Progress Column */}
        <KanbanColumn
          id="in-progress"
          title="In Progress"
          count={inProgress.length}
          color="bg-primary"
          taskIds={inProgress.map((t) => t.id)}
        >
          {inProgress.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              isLoading={isLoading}
            />
          ))}
          {inProgress.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/70">
              <p className="text-sm">No tasks in progress</p>
            </div>
          )}
        </KanbanColumn>

        {/* Completed Column */}
        <KanbanColumn
          id="completed"
          title="Completed"
          count={completed.length}
          color="bg-success"
          taskIds={completed.map((t) => t.id)}
        >
          {completed.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              isLoading={isLoading}
            />
          ))}
          {completed.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/70">
              <p className="text-sm">No completed tasks</p>
            </div>
          )}
        </KanbanColumn>
      </div>

      {/* Drag Overlay - Shows the card being dragged */}
      <DragOverlay>
        {activeTask && (
          <div className="opacity-80">
            <KanbanCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
