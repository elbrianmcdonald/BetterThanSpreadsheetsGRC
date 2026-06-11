"use client";

/**
 * Customize-sections dialog for the executive summary.
 *
 * Drag to reorder sections (dnd-kit vertical sortable) and toggle each one's
 * visibility. The parent owns persistence; this just edits a local draft and
 * hands the final ordered `[{ key, enabled }]` back via onSave.
 */

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  EXEC_SECTION_LABELS,
  type ExecSectionConfig,
  type ExecSectionKey,
} from "./execSummaryLayout";

function SortableRow({
  cfg,
  onToggle,
}: {
  cfg: ExecSectionConfig;
  onToggle: (key: ExecSectionKey) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cfg.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        aria-label={`Drag ${EXEC_SECTION_LABELS[cfg.key]}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={`flex-1 text-sm font-medium ${cfg.enabled ? "" : "text-muted-foreground line-through"}`}>
        {EXEC_SECTION_LABELS[cfg.key]}
      </span>
      <Switch
        checked={cfg.enabled}
        onCheckedChange={() => onToggle(cfg.key)}
        aria-label={`Show ${EXEC_SECTION_LABELS[cfg.key]}`}
      />
    </div>
  );
}

export function ExecSummaryLayoutDialog({
  open,
  onOpenChange,
  layout,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ExecSectionConfig[];
  saving: boolean;
  onSave: (next: ExecSectionConfig[]) => void;
}) {
  const [draft, setDraft] = useState<ExecSectionConfig[]>(layout);

  // Reset the draft to the current saved layout each time the dialog opens.
  useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setDraft((d) => {
        const from = d.findIndex((x) => x.key === active.id);
        const to = d.findIndex((x) => x.key === over.id);
        return from >= 0 && to >= 0 ? arrayMove(d, from, to) : d;
      });
    }
  }

  function toggle(key: ExecSectionKey) {
    setDraft((d) => d.map((x) => (x.key === key ? { ...x, enabled: !x.enabled } : x)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize sections</DialogTitle>
          <DialogDescription>
            Drag to reorder. Toggle a section off to leave it out of this report.
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={draft.map((d) => d.key)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 py-1">
              {draft.map((cfg) => (
                <SortableRow key={cfg.key} cfg={cfg} onToggle={toggle} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)} disabled={saving}>
            {saving ? "Saving…" : "Save layout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
