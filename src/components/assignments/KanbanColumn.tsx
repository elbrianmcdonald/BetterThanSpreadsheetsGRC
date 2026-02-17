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
        "flex flex-col min-h-[500px] bg-gray-50 rounded-lg",
        isOver && "ring-2 ring-blue-400 bg-blue-50/50"
      )}
    >
      {/* Column Header */}
      <div className={cn("px-4 py-3 rounded-t-lg", color)}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="bg-white/20 text-white text-sm px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
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
