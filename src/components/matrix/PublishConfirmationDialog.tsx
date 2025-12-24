"use client";

/**
 * PublishConfirmationDialog
 *
 * Story 7.8.7: Matrix Version Publishing (AC1-AC4)
 *
 * Displays a confirmation dialog before publishing a matrix version.
 * Shows a summary of changes compared to the current published version.
 */

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
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Minus, RefreshCw } from "lucide-react";
import {
  compareScales,
  compareThresholds,
  getDiffSummary,
  type MatrixScales,
  type Threshold,
  type ScaleDiff,
  type ThresholdDiff,
} from "@/lib/matrix";

interface VersionInfo {
  versionNumber: number;
  scales: MatrixScales;
  thresholds: Threshold[];
}

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: VersionInfo;
  previousVersion?: VersionInfo;
  onConfirm: () => void;
  isPending: boolean;
  validationErrors?: string[];
}

/**
 * Renders a section showing scale differences
 */
function ScaleDiffSection({ diffs }: { diffs: ScaleDiff[] }) {
  if (diffs.length === 0) return null;

  // Group by scale type
  const byScale = diffs.reduce(
    (acc, diff) => {
      if (!acc[diff.scale]) acc[diff.scale] = [];
      acc[diff.scale]!.push(diff);
      return acc;
    },
    {} as Record<string, ScaleDiff[]>
  );

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Scale changes</h4>
      {Object.entries(byScale).map(([scale, scaleDiffs]) => (
        <div key={scale} className="text-sm">
          <span className="text-muted-foreground capitalize">{scale}:</span>
          <ul className="ml-4 space-y-1">
            {scaleDiffs.map((diff, index) => (
              <li key={index} className="flex items-center gap-2">
                {diff.type === "added" && (
                  <>
                    <Plus className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">
                      Added "{diff.level.label}" (value: {diff.level.value})
                    </span>
                  </>
                )}
                {diff.type === "removed" && (
                  <>
                    <Minus className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">
                      Removed "{diff.level.label}" (value: {diff.level.value})
                    </span>
                  </>
                )}
                {diff.type === "changed" && (
                  <>
                    <RefreshCw className="h-3 w-3 text-yellow-600" />
                    <span className="text-yellow-600">
                      {diff.previousLevel?.label !== diff.level.label
                        ? `Changed "${diff.previousLevel?.label}" to "${diff.level.label}"`
                        : `Updated description for "${diff.level.label}" (value: ${diff.level.value})`}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a section showing threshold differences
 */
function ThresholdDiffSection({ diffs }: { diffs: ThresholdDiff[] }) {
  if (diffs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Threshold changes</h4>
      <ul className="ml-4 space-y-1 text-sm">
        {diffs.map((diff, index) => (
          <li key={index} className="flex items-center gap-2">
            {diff.type === "added" && (
              <>
                <Plus className="h-3 w-3 text-green-600" />
                <span className="text-green-600">
                  Added "{diff.threshold.label}" ({diff.threshold.minValue}-{diff.threshold.maxValue})
                </span>
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: diff.threshold.color }}
                />
              </>
            )}
            {diff.type === "removed" && (
              <>
                <Minus className="h-3 w-3 text-red-600" />
                <span className="text-red-600">
                  Removed "{diff.threshold.label}"
                </span>
              </>
            )}
            {diff.type === "changed" && (
              <>
                <RefreshCw className="h-3 w-3 text-yellow-600" />
                <span className="text-yellow-600">
                  Changed "{diff.threshold.label}"{" "}
                  {diff.previousThreshold &&
                    diff.previousThreshold.minValue !== diff.threshold.minValue &&
                    `(${diff.previousThreshold.minValue}-${diff.previousThreshold.maxValue} to ${diff.threshold.minValue}-${diff.threshold.maxValue})`}
                </span>
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: diff.threshold.color }}
                />
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  version,
  previousVersion,
  onConfirm,
  isPending,
  validationErrors,
}: PublishConfirmationDialogProps) {
  // Calculate differences if there's a previous version
  const scaleDiffs = previousVersion
    ? compareScales(previousVersion.scales, version.scales)
    : [];
  const thresholdDiffs = previousVersion
    ? compareThresholds(previousVersion.thresholds, version.thresholds)
    : [];

  const summary = getDiffSummary(scaleDiffs, thresholdDiffs);

  // Determine if we can publish (no validation errors)
  const canPublish = !validationErrors || validationErrors.length === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Publish Version {version.versionNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {previousVersion ? (
                summary.hasChanges ? (
                  <p>
                    This will update the active matrix from v{previousVersion.versionNumber}.
                    Once published, this version cannot be edited.
                  </p>
                ) : (
                  <p>
                    No changes from v{previousVersion.versionNumber}.
                    This will become the active version.
                  </p>
                )
              ) : (
                <p>
                  This will be the first published version for this template.
                  Once published, it will be available for risk assessments.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Validation errors */}
        {validationErrors && validationErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive rounded-md p-3 my-2">
            <p className="font-medium text-destructive text-sm mb-1">
              Cannot publish - validation errors:
            </p>
            <ul className="text-sm text-destructive list-disc list-inside">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Changes summary */}
        {summary.hasChanges && (
          <div className="border rounded-md p-3 my-2 space-y-3 max-h-64 overflow-y-auto">
            <div className="flex gap-2 flex-wrap">
              {summary.scaleChanges.added > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  +{summary.scaleChanges.added} scale levels
                </Badge>
              )}
              {summary.scaleChanges.removed > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  -{summary.scaleChanges.removed} scale levels
                </Badge>
              )}
              {summary.scaleChanges.changed > 0 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  ~{summary.scaleChanges.changed} scale levels changed
                </Badge>
              )}
              {summary.thresholdChanges.added > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  +{summary.thresholdChanges.added} thresholds
                </Badge>
              )}
              {summary.thresholdChanges.removed > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  -{summary.thresholdChanges.removed} thresholds
                </Badge>
              )}
              {summary.thresholdChanges.changed > 0 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  ~{summary.thresholdChanges.changed} thresholds changed
                </Badge>
              )}
            </div>

            <ScaleDiffSection diffs={scaleDiffs} />
            <ThresholdDiffSection diffs={thresholdDiffs} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending || !canPublish}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
