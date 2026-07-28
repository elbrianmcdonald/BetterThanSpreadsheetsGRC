"use client";

/**
 * Threshold Editor Component
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 * Story 11.6: Severity Threshold Configuration
 *
 * Main editor for risk thresholds (AC1-AC7, AC20-AC22, 11.6 AC1-AC19):
 * - AC1: Thresholds tab/section in Matrix Builder
 * - AC2: Visual representation of threshold ranges on a color bar
 * - AC3: Table view: minValue, maxValue, label, color
 * - AC4: "Add Threshold" button to split largest range
 * - AC5: Remove threshold button to merge ranges (disabled if only 2)
 * - AC6: Color picker for each threshold
 * - AC7: Inline editing for label
 * - AC20: "Apply Template" dropdown for common patterns
 * - AC21: Templates: 4-level (Low/Med/High/Critical), 3-level, 5-level
 * - AC22: Template applies based on current outputScaleMax
 * - 11.6 AC1-AC5: SLA days column in table
 * - 11.6 AC6-AC9: Template enhancements with gridSize awareness
 * - 11.6 AC17-AC19: GridSize mismatch warnings
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
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
import { Badge } from "@/components/ui/badge"; // Story 11.6 AC7: Recommended badge
import {
  Plus,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import type { Threshold } from "@/lib/matrix";
import { useThresholdValidation } from "@/hooks/useThresholdValidation";
import { ThresholdBar } from "./ThresholdBar";
import { ThresholdRow } from "./ThresholdRow";
import {
  getThresholdTemplate,
  getTemplateDisplayName,
  THRESHOLD_TEMPLATE_NAMES,
  type ThresholdTemplateName,
} from "@/lib/matrix/thresholdTemplates";

interface ThresholdEditorProps {
  thresholds: Threshold[];
  outputScaleMax: number;
  onChange: (thresholds: Threshold[]) => void;
  readOnly?: boolean;
  gridSize?: number; // Story 11.6 AC17-AC19: For template recommendations
}

const MIN_THRESHOLDS = 2;

export function ThresholdEditor({
  thresholds,
  outputScaleMax,
  onChange,
  readOnly = false,
  gridSize,
}: ThresholdEditorProps) {
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ThresholdTemplateName | null>(null);

  // Validation
  const validation = useThresholdValidation(thresholds, outputScaleMax);

  // Auto-normalize: Ensure last threshold always ends at outputScaleMax
  // This fixes cases where the data got out of sync (e.g., outputScaleMax changed)
  useEffect(() => {
    if (readOnly || thresholds.length === 0) return;

    const sorted = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);
    const lastThreshold = sorted[sorted.length - 1];

    if (lastThreshold && lastThreshold.maxValue !== outputScaleMax) {
      // Update the last threshold to end at outputScaleMax
      const updated = thresholds.map((t) => {
        if (t.sortOrder === lastThreshold.sortOrder) {
          return { ...t, maxValue: outputScaleMax };
        }
        return t;
      });
      onChange(updated);
    }
  }, [outputScaleMax]); // Only run when outputScaleMax changes, not on every threshold change

  // Story 11.6 AC17-AC18: Check if threshold count matches gridSize
  const thresholdCountMismatch = useMemo(() => {
    if (gridSize === undefined) return false;
    // Allow reasonable variation (gridSize ± 1)
    return Math.abs(thresholds.length - gridSize) > 1;
  }, [gridSize, thresholds.length]);

  // Sort thresholds by sortOrder for display
  const sortedThresholds = useMemo(() => {
    return [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [thresholds]);

  // AC4: Add new threshold by splitting the largest range
  const handleAddThreshold = useCallback(() => {
    if (readOnly || sortedThresholds.length >= 10) return;

    const GAP = 0.01;

    // Find the largest range
    let largestIdx = 0;
    let largestRange = 0;
    sortedThresholds.forEach((t, i) => {
      const range = t.maxValue - t.minValue;
      if (range > largestRange) {
        largestRange = range;
        largestIdx = i;
      }
    });

    const largest = sortedThresholds[largestIdx]!;
    // Calculate midpoint and round to 2 decimal places
    const midpoint = Math.round(((largest.minValue + largest.maxValue) / 2) * 100) / 100;

    // Update existing thresholds
    const updated = sortedThresholds.map((t, i) => {
      if (i === largestIdx) {
        // Shrink the largest threshold (its max becomes the midpoint)
        return { ...t, maxValue: midpoint };
      }
      if (i > largestIdx) {
        // Shift sortOrder for thresholds after the new one
        return { ...t, sortOrder: t.sortOrder + 1 };
      }
      return t;
    });

    // Add the new threshold with a gap from the midpoint
    // Story 11.1: Include slaDays - default to 30 days for new thresholds
    updated.push({
      minValue: Math.round((midpoint + GAP) * 100) / 100, // Start just after the midpoint
      maxValue: largest.maxValue,
      label: "New Level",
      color: "#888888",
      sortOrder: largest.sortOrder + 1,
      slaDays: 30,
    });

    onChange(updated);
  }, [readOnly, sortedThresholds, onChange]);

  // AC5: Remove threshold by merging with previous
  const handleRemoveThreshold = useCallback(
    (index: number) => {
      if (readOnly || sortedThresholds.length <= MIN_THRESHOLDS) return;

      const removed = sortedThresholds[index]!;

      const updated = sortedThresholds
        .filter((_, i) => i !== index)
        .map((t, i) => {
          // If we removed first, extend next to start at 0
          if (index === 0 && i === 0) {
            return { ...t, minValue: 0, sortOrder: 1 };
          }
          // Extend previous threshold to cover the removed range
          if (i === index - 1 && index > 0) {
            return { ...t, maxValue: removed.maxValue };
          }
          // Adjust sortOrder
          if (t.sortOrder > removed.sortOrder) {
            return { ...t, sortOrder: t.sortOrder - 1 };
          }
          return t;
        });

      onChange(updated);
    },
    [readOnly, sortedThresholds, onChange]
  );

  // Handle threshold update from row
  const handleThresholdChange = useCallback(
    (index: number, updates: Partial<Threshold>) => {
      if (readOnly) return;

      const updated = sortedThresholds.map((t, i) => {
        if (i === index) {
          return { ...t, ...updates };
        }
        return t;
      });

      // Ensure adjacent boundaries have a gap (maxValue of one < minValue of next)
      // Use 0.01 as the minimum gap for decimal precision
      const GAP = 0.01;

      if (updates.maxValue !== undefined && index < updated.length - 1) {
        // Set next threshold's minValue to be slightly higher than this maxValue
        updated[index + 1] = {
          ...updated[index + 1]!,
          minValue: Math.round((updates.maxValue + GAP) * 100) / 100,
        };
      }
      if (updates.minValue !== undefined && index > 0) {
        // Set previous threshold's maxValue to be slightly lower than this minValue
        updated[index - 1] = {
          ...updated[index - 1]!,
          maxValue: Math.round((updates.minValue - GAP) * 100) / 100,
        };
      }

      onChange(updated);
    },
    [readOnly, sortedThresholds, onChange]
  );

  // AC8: Handle drag boundary update from ThresholdBar
  const handleBoundaryDrag = useCallback(
    (index: number, newValue: number) => {
      if (readOnly) return;

      const GAP = 0.01;
      const roundedValue = Math.round(newValue * 100) / 100;

      const updated = sortedThresholds.map((t, i) => {
        if (i === index) {
          return { ...t, maxValue: roundedValue };
        }
        if (i === index + 1) {
          // Next threshold starts just after the boundary
          return { ...t, minValue: Math.round((roundedValue + GAP) * 100) / 100 };
        }
        return t;
      });

      onChange(updated);
    },
    [readOnly, sortedThresholds, onChange]
  );

  // AC20-AC22: Apply template
  const handleApplyTemplate = useCallback(
    (templateName: ThresholdTemplateName) => {
      if (thresholds.length > 0) {
        // Confirm before overwriting
        setPendingTemplate(templateName);
        setShowTemplateConfirm(true);
      } else {
        onChange(getThresholdTemplate(templateName, outputScaleMax));
      }
    },
    [thresholds.length, outputScaleMax, onChange]
  );

  const confirmApplyTemplate = useCallback(() => {
    if (pendingTemplate) {
      onChange(getThresholdTemplate(pendingTemplate, outputScaleMax));
    }
    setShowTemplateConfirm(false);
    setPendingTemplate(null);
  }, [pendingTemplate, outputScaleMax, onChange]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-medium">Risk Thresholds</CardTitle>
          <CardDescription>
            Define score ranges for each risk level
          </CardDescription>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {/* AC20-AC21: Apply Template dropdown, 11.6 AC7: Recommended badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Apply Template
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {THRESHOLD_TEMPLATE_NAMES.map((name) => {
                  // Story 11.6 AC7: Recommend template matching gridSize
                  const templateLevel = parseInt(name.split("-")[0] ?? "0");
                  const isRecommended = gridSize !== undefined && templateLevel === gridSize;
                  // Story 11.6 AC8: Show SLA days range
                  const slaRange = name === "3-level" ? "14-90 days SLA"
                    : name === "4-level" ? "7-90 days SLA"
                    : name === "5-level" ? "7-180 days SLA"
                    : "";
                  return (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => handleApplyTemplate(name)}
                      className="flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span>{getTemplateDisplayName(name)}</span>
                        {slaRange && (
                          <span className="text-xs text-muted-foreground">{slaRange}</span>
                        )}
                      </div>
                      {isRecommended && (
                        <Badge variant="secondary" className="ml-2 text-xs">Recommended</Badge>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AC4: Add Threshold button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddThreshold}
              disabled={sortedThresholds.length >= 10}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Threshold
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AC2, AC15-AC19: Visual threshold bar */}
        {sortedThresholds.length > 0 && (
          <ThresholdBar
            thresholds={sortedThresholds}
            outputScaleMax={outputScaleMax}
            onBoundaryDrag={handleBoundaryDrag}
            readOnly={readOnly}
          />
        )}

        {/* AC3: Table view */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Min</TableHead>
                <TableHead className="w-24">Max</TableHead>
                <TableHead className="w-40">Label</TableHead>
                <TableHead className="w-24">Color</TableHead>
                <TableHead className="w-24">SLA Days</TableHead> {/* Story 11.6 AC1 */}
                <TableHead className="w-28" title="Risks landing in this band are flagged as exceeding the organization's risk appetite">
                  Over Appetite
                </TableHead>
                {!readOnly && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedThresholds.map((threshold, index) => (
                <ThresholdRow
                  key={index}
                  threshold={threshold}
                  isFirst={index === 0}
                  isLast={index === sortedThresholds.length - 1}
                  outputScaleMax={outputScaleMax}
                  onChange={(updates) => handleThresholdChange(index, updates)}
                  onRemove={() => handleRemoveThreshold(index)}
                  canRemove={sortedThresholds.length > MIN_THRESHOLDS}
                  readOnly={readOnly}
                />
              ))}
              {sortedThresholds.length === 0 && (
                <TableRow>
                  <td
                    colSpan={readOnly ? 6 : 7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No thresholds defined. Click &quot;Add Threshold&quot; or apply a template.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Validation Messages (AC17) */}
        {validation.errors.length > 0 && (
          <Alert variant="destructive">
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
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
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

        {/* Story 11.6 AC17-AC19: GridSize mismatch warning */}
        {thresholdCountMismatch && gridSize !== undefined && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              Current threshold count ({thresholds.length}) differs significantly from grid size ({gridSize}).
              Consider using a {gridSize}-level template for better alignment.
            </AlertDescription>
          </Alert>
        )}

        {/* Threshold count info */}
        <div className="text-sm text-muted-foreground">
          {sortedThresholds.length} threshold(s) • Scale max: {outputScaleMax}
          {gridSize !== undefined && ` • Grid size: ${gridSize}`}
        </div>
      </CardContent>

      {/* Template confirmation dialog */}
      <AlertDialog open={showTemplateConfirm} onOpenChange={setShowTemplateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current thresholds with the template values.
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
