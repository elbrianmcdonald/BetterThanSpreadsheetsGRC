"use client";

/**
 * Kanban Column Component
 *
 * A droppable column container for the Kanban board.
 * Displays a header with title and count, and contains task cards.
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  taskIds: string[];
}

export function KanbanColumn({ id, title, count, color, children, taskIds }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[500px] flex-col rounded-lg border border-border bg-secondary/40",
        isOver && "ring-2 ring-primary/30 bg-accent"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between rounded-t-lg border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
          <span className={cn("size-1.5 rounded-full", color)} />
          {title}
        </h3>
        <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Column Content */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
