"use client";

/**
 * Threat Modeling Section Component
 *
 * Story 16.2: Risk Form MITRE Integration
 *
 * Provides MITRE ATT&CK threat modeling capabilities:
 * - AC10-AC12: Initial Access Vector picker (single select)
 * - AC13-AC16: Threat Actor Steps with drag-to-reorder
 * - AC17-AC19: Threat Actor Objectives picker (multi-select)
 *
 * @see Story 16.2: Risk Form MITRE Integration
 */

import { useState, useCallback, useEffect } from "react";
import {
  Shield,
  Target,
  Footprints,
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MitreTechniquePicker, TechniqueCard, type TechniqueOption } from "./MitreTechniquePicker";
// Story 16.9: Attack Chain Preview
import { AttackChainCompact } from "./AttackChainVisualization";

interface ThreatModelingSectionProps {
  /** Risk ID for saving */
  riskId: string;
  /** Whether the section is read-only */
  isReadOnly?: boolean;
  /** Whether section starts expanded */
  defaultExpanded?: boolean;
  /** Callback when data changes */
  onUpdate?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Sortable threat step item
 */
function SortableStep({
  step,
  onRemove,
  isReadOnly,
}: {
  step: { id: string; technique: TechniqueOption; stepOrder: number };
  onRemove: () => void;
  isReadOnly: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {!isReadOnly && (
        <button
          type="button"
          className="p-1 cursor-grab hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <Badge variant="outline" className="shrink-0 font-mono">
        Step {step.stepOrder + 1}
      </Badge>
      <TechniqueCard
        technique={step.technique}
        onRemove={onRemove}
        isReadOnly={isReadOnly}
        className="flex-1 border-0 p-0 bg-transparent"
      />
    </div>
  );
}

export function ThreatModelingSection({
  riskId,
  isReadOnly = false,
  defaultExpanded = false,
  onUpdate,
  className,
}: ThreatModelingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"initial" | "step" | "objective">("initial");

  // Fetch threat modeling data
  const { data, isLoading, refetch } = api.risk.getThreatModeling.useQuery(
    { riskId },
    { enabled: !!riskId }
  );

  // Track local step order for optimistic updates
  const [localSteps, setLocalSteps] = useState(data?.threatSteps ?? []);

  useEffect(() => {
    if (data?.threatSteps) {
      setLocalSteps(data.threatSteps);
    }
  }, [data?.threatSteps]);

  // Mutations
  const setInitialAccessMutation = api.risk.setInitialAccessVector.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  const addThreatStepMutation = api.risk.addThreatStep.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  const removeThreatStepMutation = api.risk.removeThreatStep.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  const reorderThreatStepsMutation = api.risk.reorderThreatSteps.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  const addThreatObjectiveMutation = api.risk.addThreatObjective.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  const removeThreatObjectiveMutation = api.risk.removeThreatObjective.useMutation({
    onSuccess: () => {
      refetch();
      onUpdate?.();
    },
  });

  // Drag sensors for sortable
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localSteps.findIndex((s) => s.id === active.id);
        const newIndex = localSteps.findIndex((s) => s.id === over.id);

        const newSteps = arrayMove(localSteps, oldIndex, newIndex);
        setLocalSteps(newSteps);

        // Save new order
        reorderThreatStepsMutation.mutate({
          riskId,
          stepIds: newSteps.map((s) => s.id),
        });
      }
    },
    [localSteps, riskId, reorderThreatStepsMutation]
  );

  // Handle picker selection
  const handlePickerSelect = useCallback(
    (technique: TechniqueOption) => {
      switch (pickerMode) {
        case "initial":
          setInitialAccessMutation.mutate({
            riskId,
            techniqueId: technique.id,
          });
          break;
        case "step":
          addThreatStepMutation.mutate({
            riskId,
            techniqueId: technique.id,
          });
          break;
        case "objective":
          addThreatObjectiveMutation.mutate({
            riskId,
            techniqueId: technique.id,
          });
          break;
      }
    },
    [pickerMode, riskId, setInitialAccessMutation, addThreatStepMutation, addThreatObjectiveMutation]
  );

  // Open picker for specific mode
  const openPicker = useCallback((mode: "initial" | "step" | "objective") => {
    setPickerMode(mode);
    setPickerOpen(true);
  }, []);

  // Get excluded IDs for each picker mode
  const getExcludedIds = useCallback(() => {
    switch (pickerMode) {
      case "step":
        return localSteps.map((s) => s.technique.id);
      case "objective":
        return data?.threatObjectives?.map((o) => o.technique.id) ?? [];
      default:
        return [];
    }
  }, [pickerMode, localSteps, data?.threatObjectives]);

  // Get tactic filter for each mode
  const getTacticFilter = useCallback(() => {
    switch (pickerMode) {
      case "initial":
        return ["initial-access"];
      case "objective":
        return ["impact", "exfiltration", "collection"];
      default:
        return undefined;
    }
  }, [pickerMode]);

  // Check if has any content
  const hasContent =
    data?.initialAccessVector ||
    (data?.threatSteps?.length ?? 0) > 0 ||
    (data?.threatObjectives?.length ?? 0) > 0;

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">MITRE ATT&CK Threat Modeling</span>
          {hasContent && !isExpanded && (
            <Badge variant="secondary" className="ml-2">
              {(data?.threatSteps?.length ?? 0) + (data?.threatObjectives?.length ?? 0) + (data?.initialAccessVector ? 1 : 0)} techniques
            </Badge>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Initial Access Vector Section (AC10-AC12) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-red-500" />
                    Initial Access Vector
                  </h4>
                  {!isReadOnly && !data?.initialAccessVector && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openPicker("initial")}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Select
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The technique used by the threat actor to gain initial access to your environment.
                </p>
                {data?.initialAccessVector ? (
                  <TechniqueCard
                    technique={data.initialAccessVector}
                    onRemove={() =>
                      setInitialAccessMutation.mutate({
                        riskId,
                        techniqueId: null,
                      })
                    }
                    isReadOnly={isReadOnly}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No initial access vector selected
                  </p>
                )}
              </div>

              {/* Threat Actor Steps Section (AC13-AC16) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Footprints className="h-4 w-4 text-amber-500" />
                    Threat Actor Steps
                  </h4>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openPicker("step")}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Step
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The sequence of techniques the threat actor uses after gaining access.
                  {!isReadOnly && " Drag to reorder."}
                </p>
                {localSteps.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={localSteps.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {localSteps.map((step, index) => (
                          <SortableStep
                            key={step.id}
                            step={{ ...step, stepOrder: index }}
                            onRemove={() =>
                              removeThreatStepMutation.mutate({ stepId: step.id })
                            }
                            isReadOnly={isReadOnly}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No threat steps defined
                  </p>
                )}
              </div>

              {/* Threat Actor Objectives Section (AC17-AC19) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Threat Actor Objectives
                  </h4>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openPicker("objective")}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Objective
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The ultimate goals the threat actor is trying to achieve (Impact, Exfiltration, Collection).
                </p>
                {data?.threatObjectives && data.threatObjectives.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.threatObjectives.map((objective) => (
                      <TechniqueCard
                        key={objective.id}
                        technique={objective.technique}
                        onRemove={() =>
                          removeThreatObjectiveMutation.mutate({ objectiveId: objective.id })
                        }
                        isReadOnly={isReadOnly}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No objectives defined
                  </p>
                )}
              </div>
            </>
          )}

          {/* Saving indicators */}
          {(setInitialAccessMutation.isPending ||
            addThreatStepMutation.isPending ||
            removeThreatStepMutation.isPending ||
            reorderThreatStepsMutation.isPending ||
            addThreatObjectiveMutation.isPending ||
            removeThreatObjectiveMutation.isPending) && (
            <p className="text-xs text-muted-foreground text-center">
              Saving...
            </p>
          )}

          {/* Story 16.9: Attack Chain Preview (AC8) */}
          {hasContent && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                Attack Chain Preview
              </h4>
              <AttackChainCompact
                initialAccessVector={data?.initialAccessVector}
                threatSteps={localSteps.map((s, i) => ({ ...s, stepOrder: i }))}
                threatObjectives={data?.threatObjectives}
              />
            </div>
          )}
        </div>
      )}

      {/* Technique Picker Dialog */}
      <MitreTechniquePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
        tacticFilter={getTacticFilter()}
        excludeIds={getExcludedIds()}
        title={
          pickerMode === "initial"
            ? "Select Initial Access Vector"
            : pickerMode === "step"
            ? "Add Threat Step"
            : "Add Threat Objective"
        }
        description={
          pickerMode === "initial"
            ? "Select a technique from the Initial Access tactic"
            : pickerMode === "step"
            ? "Select a technique for the attack chain"
            : "Select an Impact, Exfiltration, or Collection technique"
        }
      />
    </div>
  );
}
