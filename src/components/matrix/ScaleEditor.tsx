"use client";

/**
 * Scale Editor Component
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 * Story 11.2: Risk Matrix Create/Edit Form (gridSize validation)
 * Story 11.3: Likelihood Level Configuration
 * Story 11.4: Impact Level Configuration
 * Story 11.5: Exposure Level Configuration
 *
 * Features (AC6-AC12, AC21-AC23 from 7.8.5, AC17-AC18 from 11.2, AC1-AC10 from 11.3/11.4/11.5):
 * - AC7: Table of levels with value, label, description
 * - AC8: Add Level button (max 10 levels)
 * - AC9: Inline editing for label and description
 * - AC10: Value input with decimal support
 * - AC11: Delete level button (min 3 levels)
 * - AC12: Drag-to-reorder levels
 * - AC21-AC23: Apply Template dropdown (with scale-specific templates)
 * - 11.2 AC17: Show expected level count based on gridSize
 * - 11.2 AC18: Validation warning if level count != gridSize
 * - 11.3/11.4/11.5 AC1-AC3: GridSize-constrained mode with position indicator
 * - 11.3/11.4/11.5 AC6: Hide add/remove when constrained
 * - 11.3/11.4/11.5 AC7-AC9: Scale-specific template names in dropdown
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import type { ScaleLevel } from "@/lib/matrix";
import { useScaleValidation } from "@/hooks/useScaleValidation";
import {
  SCALE_TEMPLATES,
  LIKELIHOOD_TEMPLATES,
  IMPACT_TEMPLATES,
  EXPOSURE_TEMPLATES,
  type ScaleTemplateName,
  type LikelihoodTemplateName,
  type ImpactTemplateName,
  type ExposureTemplateName,
} from "@/lib/matrix/scaleTemplates";

// Union type for all template names (Story 11.5: Added ExposureTemplateName)
type AnyTemplateName = ScaleTemplateName | LikelihoodTemplateName | ImpactTemplateName | ExposureTemplateName;

// Scale type for showing appropriate templates
export type ScaleType = "likelihood" | "impact" | "exposure" | "generic";

interface ScaleEditorProps {
  name: string;
  levels: ScaleLevel[];
  onChange: (levels: ScaleLevel[]) => void;
  readOnly?: boolean;
  expectedLevelCount?: number; // Story 11.2: Expected level count from gridSize
  constrainToGridSize?: boolean; // Story 11.3: Lock level count to gridSize, hide add/remove
  scaleType?: ScaleType; // Story 11.4: Scale type for showing appropriate templates
}

const MIN_LEVELS = 3;
const MAX_LEVELS = 10;

/**
 * Score input component with local state to allow typing decimals freely
 */
function ScoreInput({
  value,
  onChange,
  hasError
}: {
  value: number;
  onChange: (val: number) => void;
  hasError: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local value when external value changes (e.g., from template)
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        const val = e.target.value;
        // Allow empty, numbers, decimals, and partial decimal input like "0." or ".5"
        if (val === "" || val === "." || /^-?\d*\.?\d*$/.test(val)) {
          setLocalValue(val);
        }
      }}
      onBlur={() => {
        // Parse and commit on blur
        const parsed = parseFloat(localValue);
        if (isNaN(parsed) || parsed < 0) {
          setLocalValue(String(value)); // Reset to previous valid value
        } else {
          onChange(parsed);
          setLocalValue(String(parsed)); // Normalize display
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={`w-20 font-mono ${hasError ? "border-destructive" : ""}`}
    />
  );
}

export function ScaleEditor({ name, levels, onChange, readOnly = false, expectedLevelCount, constrainToGridSize = false, scaleType = "generic" }: ScaleEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<AnyTemplateName | null>(null);

  // Validation (AC13-AC17)
  const validation = useScaleValidation(levels);

  // Story 11.2 AC18: Check if level count matches expected gridSize
  const levelCountMismatch = expectedLevelCount !== undefined && levels.length !== expectedLevelCount;

  // Story 11.3 AC6: Determine if add/remove buttons should be shown
  const showAddRemove = !readOnly && !constrainToGridSize;

  // Sort levels by value for display
  const sortedLevels = useMemo(() => {
    return [...levels].sort((a, b) => a.value - b.value);
  }, [levels]);

  // AC8: Add new level
  const handleAddLevel = useCallback(() => {
    if (levels.length >= MAX_LEVELS) return;

    const maxValue = Math.max(...levels.map((l) => l.value), 0);
    const newLevel: ScaleLevel = {
      value: maxValue + 1,
      label: "",
      description: "",
    };

    onChange([...levels, newLevel]);
  }, [levels, onChange]);

  // AC11: Remove level
  const handleRemoveLevel = useCallback(
    (index: number) => {
      if (levels.length <= MIN_LEVELS) return;

      // Find the actual level by sorted index
      const levelToRemove = sortedLevels[index];
      if (!levelToRemove) return;

      onChange(levels.filter((l) => l.value !== levelToRemove.value));
    },
    [levels, sortedLevels, onChange]
  );

  // AC9: Update level
  const handleUpdateLevel = useCallback(
    (sortedIndex: number, updates: Partial<ScaleLevel>) => {
      const levelToUpdate = sortedLevels[sortedIndex];
      if (!levelToUpdate) return;

      // Find the original index in the unsorted array
      const originalIndex = levels.findIndex((l) => l.value === levelToUpdate.value);
      if (originalIndex === -1) return;

      const newLevels = [...levels];
      newLevels[originalIndex] = { ...newLevels[originalIndex]!, ...updates };
      onChange(newLevels);
    },
    [levels, sortedLevels, onChange]
  );

  // AC12: Drag and drop reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        return;
      }

      // Get the levels being swapped
      const draggedLevel = sortedLevels[draggedIndex];
      const dropLevel = sortedLevels[dropIndex];

      if (!draggedLevel || !dropLevel) {
        setDraggedIndex(null);
        return;
      }

      // Swap their values
      const newLevels = levels.map((l) => {
        if (l.value === draggedLevel.value) {
          return { ...l, value: dropLevel.value };
        }
        if (l.value === dropLevel.value) {
          return { ...l, value: draggedLevel.value };
        }
        return l;
      });

      onChange(newLevels);
      setDraggedIndex(null);
    },
    [draggedIndex, sortedLevels, levels, onChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // AC21-AC23: Apply template (with scale-specific support for 11.3/11.4/11.5)
  const handleApplyTemplate = useCallback((templateName: AnyTemplateName) => {
    // Get template levels based on template type
    const getTemplateLevels = (name: AnyTemplateName): ScaleLevel[] => {
      if (name in SCALE_TEMPLATES) {
        return SCALE_TEMPLATES[name as ScaleTemplateName];
      }
      if (name in LIKELIHOOD_TEMPLATES) {
        return LIKELIHOOD_TEMPLATES[name as LikelihoodTemplateName];
      }
      if (name in IMPACT_TEMPLATES) {
        return IMPACT_TEMPLATES[name as ImpactTemplateName];
      }
      // Story 11.5: Handle exposure templates
      if (name in EXPOSURE_TEMPLATES) {
        return EXPOSURE_TEMPLATES[name as ExposureTemplateName];
      }
      return [];
    };

    if (levels.length > 0) {
      // AC23: Confirmation before overwrite
      setPendingTemplate(templateName);
      setShowTemplateConfirm(true);
    } else {
      onChange(getTemplateLevels(templateName));
    }
  }, [levels.length, onChange]);

  const confirmApplyTemplate = useCallback(() => {
    if (pendingTemplate) {
      // Get template levels based on template type
      let templateLevels: ScaleLevel[] = [];
      if (pendingTemplate in SCALE_TEMPLATES) {
        templateLevels = SCALE_TEMPLATES[pendingTemplate as ScaleTemplateName];
      } else if (pendingTemplate in LIKELIHOOD_TEMPLATES) {
        templateLevels = LIKELIHOOD_TEMPLATES[pendingTemplate as LikelihoodTemplateName];
      } else if (pendingTemplate in IMPACT_TEMPLATES) {
        templateLevels = IMPACT_TEMPLATES[pendingTemplate as ImpactTemplateName];
      } else if (pendingTemplate in EXPOSURE_TEMPLATES) {
        // Story 11.5: Handle exposure templates
        templateLevels = EXPOSURE_TEMPLATES[pendingTemplate as ExposureTemplateName];
      }
      onChange(templateLevels);
    }
    setShowTemplateConfirm(false);
    setPendingTemplate(null);
  }, [pendingTemplate, onChange]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-medium">{name} Scale</CardTitle>
          {/* Story 11.2 AC17: Show level count with expected count */}
          <span className={`text-sm ${levelCountMismatch ? "text-amber-600" : "text-muted-foreground"}`}>
            ({levels.length}{expectedLevelCount !== undefined ? `/${expectedLevelCount}` : ""} levels)
          </span>
          {/* Story 11.2 AC18: Warning if level count doesn't match gridSize */}
          {levelCountMismatch && (
            <span className="text-amber-600 text-sm flex items-center gap-1" title={`Expected ${expectedLevelCount} levels to match grid size`}>
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {/* AC21-AC22: Apply Template dropdown (with scale-specific templates for 11.3/11.4) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Apply Template
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Scale-specific templates when scaleType is set */}
                {scaleType === "likelihood" && (
                  <>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("likelihood-3")}>
                      3-Level (Unlikely, Possible, Likely)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("likelihood-4")}>
                      4-Level (Rare to Almost Certain)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("likelihood-5")}>
                      5-Level (Rare to Almost Certain)
                    </DropdownMenuItem>
                  </>
                )}
                {scaleType === "impact" && (
                  <>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("impact-3")}>
                      3-Level (Minor, Moderate, Major)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("impact-4")}>
                      4-Level (Negligible to Catastrophic)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("impact-5")}>
                      5-Level (Negligible to Catastrophic)
                    </DropdownMenuItem>
                  </>
                )}
                {/* Story 11.5: Exposure-specific templates */}
                {scaleType === "exposure" && (
                  <>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("exposure-3")}>
                      3-Level (Limited, Moderate, Significant)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("exposure-4")}>
                      4-Level (None to Extensive)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("exposure-5")}>
                      5-Level (None to Extensive)
                    </DropdownMenuItem>
                  </>
                )}
                {/* Generic templates for generic scale types only */}
                {scaleType === "generic" && (
                  <>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("3-level")}>
                      3-Level (Low, Medium, High)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("5-level")}>
                      5-Level (Very Low to Very High)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApplyTemplate("10-level")}>
                      10-Level (Level 1-10)
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AC8: Add Level button - Story 11.3: Hidden when constrained to gridSize */}
            {showAddRemove && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddLevel}
                disabled={levels.length >= MAX_LEVELS}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Level
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* AC7: Table of levels */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {!readOnly && !constrainToGridSize && <TableHead className="w-10"></TableHead>}
                {/* Story 11.3 AC2-AC3: Show Position when constrained, Value when not */}
                <TableHead className="w-24">{constrainToGridSize ? "Position" : "Value"}</TableHead>
                {/* Score column - allows manual score entry for each level */}
                <TableHead className="w-24">Score</TableHead>
                <TableHead className="w-40">Label</TableHead>
                <TableHead>Description</TableHead>
                {/* Story 11.3 AC6: Hide delete column when constrained */}
                {showAddRemove && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLevels.map((level, index) => {
                const levelError = validation.levelErrors.get(index);
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index && draggedIndex !== index;
                // Use index as key - stable for sorted array; avoid using value which changes during editing
                return (
                  <TableRow
                    key={index}
                    className={`
                      ${isDragging ? "opacity-50" : ""}
                      ${isDragOver ? "bg-muted" : ""}
                      ${levelError ? "bg-destructive/5" : ""}
                    `}
                    draggable={!readOnly}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    {/* Drag Handle - Story 11.3: Hidden when constrained */}
                    {!readOnly && !constrainToGridSize && (
                      <TableCell className="cursor-grab">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    )}

                    {/* Story 11.3 AC2-AC3: Position indicator when constrained, otherwise Value input */}
                    <TableCell>
                      {constrainToGridSize ? (
                        // Story 11.3 AC3: Position indicator with (lowest)/(highest) labels
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{index + 1}</span>
                          <span className="text-xs text-muted-foreground">
                            {index === 0 && "(lowest)"}
                            {index === sortedLevels.length - 1 && "(highest)"}
                          </span>
                        </div>
                      ) : readOnly ? (
                        <span className="font-mono">{level.value}</span>
                      ) : (
                        // AC10: Value input with decimal support
                        <Input
                          type="number"
                          value={level.value}
                          onChange={(e) =>
                            handleUpdateLevel(index, {
                              value: parseFloat(e.target.value) || 0,
                            })
                          }
                          step="0.1"
                          min="0.01"
                          className={`w-20 font-mono ${levelError ? "border-destructive" : ""}`}
                        />
                      )}
                    </TableCell>

                    {/* Score input - manual score entry for each level */}
                    <TableCell>
                      {readOnly ? (
                        <span className="font-mono font-medium">{level.value}</span>
                      ) : (
                        <ScoreInput
                          value={level.value}
                          onChange={(val) => handleUpdateLevel(index, { value: val })}
                          hasError={!!levelError}
                        />
                      )}
                    </TableCell>

                    {/* AC9: Label input */}
                    <TableCell>
                      {readOnly ? (
                        <span>{level.label || "-"}</span>
                      ) : (
                        <Input
                          value={level.label}
                          onChange={(e) =>
                            handleUpdateLevel(index, { label: e.target.value })
                          }
                          placeholder="e.g., Low, High"
                          maxLength={50}
                        />
                      )}
                    </TableCell>

                    {/* AC9: Description input */}
                    <TableCell>
                      {readOnly ? (
                        <span className="text-muted-foreground">
                          {level.description || "-"}
                        </span>
                      ) : (
                        <Input
                          value={level.description}
                          onChange={(e) =>
                            handleUpdateLevel(index, { description: e.target.value })
                          }
                          placeholder="Optional description"
                          maxLength={200}
                        />
                      )}
                    </TableCell>

                    {/* AC11: Delete button - Story 11.3: Hidden when constrained */}
                    {showAddRemove && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLevel(index)}
                          disabled={levels.length <= MIN_LEVELS}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}

              {sortedLevels.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 4 : constrainToGridSize ? 4 : 6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {constrainToGridSize
                      ? "Apply a template to initialize levels."
                      : "No levels defined. Click \"Add Level\" or apply a template."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Validation Messages (AC13-AC17) */}
        {validation.errors.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validation.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert className="mt-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              <ul className="list-disc list-inside">
                {validation.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Level count info */}
        <div className="mt-4 text-sm text-muted-foreground">
          {constrainToGridSize && expectedLevelCount
            ? `${levels.length} of ${expectedLevelCount} levels (fixed to grid size)`
            : `${levels.length} / ${MAX_LEVELS} levels (minimum ${MIN_LEVELS})`}
        </div>
      </CardContent>

      {/* AC23: Template confirmation dialog */}
      <AlertDialog open={showTemplateConfirm} onOpenChange={setShowTemplateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current {name.toLowerCase()} scale levels with the template values.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTemplate(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmApplyTemplate}>
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
