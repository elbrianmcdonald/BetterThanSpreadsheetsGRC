"use client";

/**
 * VersionCompareDialog
 *
 * Story 7.8.7: Matrix Version Publishing (AC14-AC17)
 *
 * Displays a side-by-side comparison of two matrix versions,
 * highlighting differences in scales and thresholds.
 */

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowRight, Plus, Minus, RefreshCw } from "lucide-react";
import {
  compareScales,
  compareThresholds,
  type MatrixScales,
  type Threshold,
  type ScaleLevel,
} from "@/lib/matrix";

interface VersionInfo {
  id: string;
  versionNumber: number;
  publishedAt: Date | null;
  scales: MatrixScales;
  thresholds: Threshold[];
}

interface VersionCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionInfo[];
  initialLeftVersionId?: string;
  initialRightVersionId?: string;
}

type DiffType = "added" | "removed" | "changed" | "unchanged";

function getDiffStyle(type: DiffType): string {
  switch (type) {
    case "added":
      return "bg-green-50 dark:bg-green-950/20";
    case "removed":
      return "bg-red-50 dark:bg-red-950/20";
    case "changed":
      return "bg-yellow-50 dark:bg-yellow-950/20";
    default:
      return "";
  }
}

function getDiffIcon(type: DiffType) {
  switch (type) {
    case "added":
      return <Plus className="h-3 w-3 text-green-600" />;
    case "removed":
      return <Minus className="h-3 w-3 text-red-600" />;
    case "changed":
      return <RefreshCw className="h-3 w-3 text-yellow-600" />;
    default:
      return null;
  }
}

interface ScaleComparisonProps {
  scaleName: string;
  leftLevels: ScaleLevel[];
  rightLevels: ScaleLevel[];
  /** Pre-computed diffs for this scale from compareScales() - avoids duplicate computation */
  diffs: Array<{ type: "added" | "removed" | "changed"; value: number }>;
}

function ScaleComparison({ scaleName, leftLevels, rightLevels, diffs }: ScaleComparisonProps) {
  // Create a union of all values from both sides
  const allValues = new Set([
    ...leftLevels.map((l) => l.value),
    ...rightLevels.map((l) => l.value),
  ]);
  const sortedValues = [...allValues].sort((a, b) => a - b);

  const leftByValue = new Map(leftLevels.map((l) => [l.value, l]));
  const rightByValue = new Map(rightLevels.map((l) => [l.value, l]));

  // Use pre-computed diffs instead of recalculating
  const diffByValue = new Map(diffs.map((d) => [d.value, d.type]));

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm capitalize">{scaleName}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Value</TableHead>
            <TableHead>Left</TableHead>
            <TableHead className="w-8"></TableHead>
            <TableHead>Right</TableHead>
            <TableHead className="w-8">Diff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedValues.map((value) => {
            const leftLevel = leftByValue.get(value);
            const rightLevel = rightByValue.get(value);
            const diffType: DiffType = diffByValue.get(value) ?? "unchanged";

            return (
              <TableRow key={value} className={getDiffStyle(diffType)}>
                <TableCell className="font-mono text-sm">{value}</TableCell>
                <TableCell>
                  {leftLevel ? (
                    <div>
                      <div className="font-medium text-sm">{leftLevel.label}</div>
                      {leftLevel.description && (
                        <div className="text-xs text-muted-foreground">
                          {leftLevel.description}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell>
                  {rightLevel ? (
                    <div>
                      <div className="font-medium text-sm">{rightLevel.label}</div>
                      {rightLevel.description && (
                        <div className="text-xs text-muted-foreground">
                          {rightLevel.description}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>{getDiffIcon(diffType)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface ThresholdComparisonProps {
  leftThresholds: Threshold[];
  rightThresholds: Threshold[];
  /** Pre-computed diffs from compareThresholds() - avoids duplicate computation */
  diffs: Array<{ type: "added" | "removed" | "changed"; sortOrder: number }>;
}

function ThresholdComparison({
  leftThresholds,
  rightThresholds,
  diffs,
}: ThresholdComparisonProps) {
  // Create a union of all sortOrders from both sides
  const allOrders = new Set([
    ...leftThresholds.map((t) => t.sortOrder),
    ...rightThresholds.map((t) => t.sortOrder),
  ]);
  const sortedOrders = [...allOrders].sort((a, b) => a - b);

  const leftByOrder = new Map(leftThresholds.map((t) => [t.sortOrder, t]));
  const rightByOrder = new Map(rightThresholds.map((t) => [t.sortOrder, t]));

  // Use pre-computed diffs instead of recalculating
  const diffByOrder = new Map(diffs.map((d) => [d.sortOrder, d.type]));

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Thresholds</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Left</TableHead>
            <TableHead className="w-8"></TableHead>
            <TableHead>Right</TableHead>
            <TableHead className="w-8">Diff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => {
            const leftThreshold = leftByOrder.get(order);
            const rightThreshold = rightByOrder.get(order);
            const diffType: DiffType = diffByOrder.get(order) ?? "unchanged";

            return (
              <TableRow key={order} className={getDiffStyle(diffType)}>
                <TableCell className="text-sm">{order}</TableCell>
                <TableCell>
                  {leftThreshold ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border flex-shrink-0"
                        style={{ backgroundColor: leftThreshold.color }}
                      />
                      <div>
                        <div className="font-medium text-sm">
                          {leftThreshold.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {leftThreshold.minValue} - {leftThreshold.maxValue}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell>
                  {rightThreshold ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border flex-shrink-0"
                        style={{ backgroundColor: rightThreshold.color }}
                      />
                      <div>
                        <div className="font-medium text-sm">
                          {rightThreshold.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rightThreshold.minValue} - {rightThreshold.maxValue}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>{getDiffIcon(diffType)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function VersionCompareDialog({
  open,
  onOpenChange,
  versions,
  initialLeftVersionId,
  initialRightVersionId,
}: VersionCompareDialogProps) {
  // Sort versions by version number for the dropdowns
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions]
  );

  // Default to comparing the two most recent versions
  const [leftVersionId, setLeftVersionId] = useState<string | undefined>(
    initialLeftVersionId ?? sortedVersions[1]?.id
  );
  const [rightVersionId, setRightVersionId] = useState<string | undefined>(
    initialRightVersionId ?? sortedVersions[0]?.id
  );

  // Issue 3 fix: Reset state when dialog opens with new versions
  useEffect(() => {
    if (open) {
      setLeftVersionId(initialLeftVersionId ?? sortedVersions[1]?.id);
      setRightVersionId(initialRightVersionId ?? sortedVersions[0]?.id);
    }
  }, [open, initialLeftVersionId, initialRightVersionId, sortedVersions]);

  const leftVersion = versions.find((v) => v.id === leftVersionId);
  const rightVersion = versions.find((v) => v.id === rightVersionId);

  // Calculate differences
  const scaleDiffs = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];
    return compareScales(leftVersion.scales, rightVersion.scales);
  }, [leftVersion, rightVersion]);

  const thresholdDiffs = useMemo(() => {
    if (!leftVersion || !rightVersion) return [];
    return compareThresholds(leftVersion.thresholds, rightVersion.thresholds);
  }, [leftVersion, rightVersion]);

  // Transform diffs to simpler format for subcomponents (Issue 1 & 4 fix)
  const scaleDiffsByScale = useMemo(() => ({
    likelihood: scaleDiffs
      .filter((d) => d.scale === "likelihood")
      .map((d) => ({ type: d.type, value: d.level.value })),
    impact: scaleDiffs
      .filter((d) => d.scale === "impact")
      .map((d) => ({ type: d.type, value: d.level.value })),
    exposure: scaleDiffs
      .filter((d) => d.scale === "exposure")
      .map((d) => ({ type: d.type, value: d.level.value })),
  }), [scaleDiffs]);

  const thresholdDiffsSimple = useMemo(() =>
    thresholdDiffs.map((d) => ({ type: d.type, sortOrder: d.threshold.sortOrder })),
    [thresholdDiffs]
  );

  const totalDiffs = scaleDiffs.length + thresholdDiffs.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1">
            <label htmlFor="left-version" className="text-sm font-medium mb-1 block">
              Left (older)
            </label>
            <Select value={leftVersionId} onValueChange={setLeftVersionId}>
              <SelectTrigger id="left-version" aria-label="Select left version to compare">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {sortedVersions.map((v) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === rightVersionId}
                  >
                    v{v.versionNumber} {v.publishedAt ? "(Published)" : "(Draft)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" aria-hidden="true" />

          <div className="flex-1">
            <label htmlFor="right-version" className="text-sm font-medium mb-1 block">
              Right (newer)
            </label>
            <Select value={rightVersionId} onValueChange={setRightVersionId}>
              <SelectTrigger id="right-version" aria-label="Select right version to compare">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {sortedVersions.map((v) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === leftVersionId}
                  >
                    v{v.versionNumber} {v.publishedAt ? "(Published)" : "(Draft)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary badge */}
        <div className="flex items-center gap-2">
          <Badge variant={totalDiffs > 0 ? "default" : "secondary"}>
            {totalDiffs} difference{totalDiffs !== 1 ? "s" : ""} found
          </Badge>
        </div>

        {/* Comparison content */}
        {leftVersion && rightVersion ? (
          <Tabs defaultValue="scales" className="flex-1">
            <TabsList>
              <TabsTrigger value="scales">
                Scales ({scaleDiffs.length})
              </TabsTrigger>
              <TabsTrigger value="thresholds">
                Thresholds ({thresholdDiffs.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              <TabsContent value="scales" className="space-y-6 pr-4">
                <ScaleComparison
                  scaleName="likelihood"
                  leftLevels={leftVersion.scales.likelihood ?? []}
                  rightLevels={rightVersion.scales.likelihood ?? []}
                  diffs={scaleDiffsByScale.likelihood}
                />
                <ScaleComparison
                  scaleName="impact"
                  leftLevels={leftVersion.scales.impact ?? []}
                  rightLevels={rightVersion.scales.impact ?? []}
                  diffs={scaleDiffsByScale.impact}
                />
                {(leftVersion.scales.exposure?.length ||
                  rightVersion.scales.exposure?.length) && (
                  <ScaleComparison
                    scaleName="exposure"
                    leftLevels={leftVersion.scales.exposure ?? []}
                    rightLevels={rightVersion.scales.exposure ?? []}
                    diffs={scaleDiffsByScale.exposure}
                  />
                )}
              </TabsContent>

              <TabsContent value="thresholds" className="pr-4">
                <ThresholdComparison
                  leftThresholds={leftVersion.thresholds}
                  rightThresholds={rightVersion.thresholds}
                  diffs={thresholdDiffsSimple}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Select two versions to compare
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
