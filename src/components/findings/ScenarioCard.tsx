"use client";

/**
 * Scenario Card Component
 *
 * Story 7.7: Risk Scenario Management (AC16-AC17, AC25-AC29)
 *
 * Displays a single scenario with edit/delete capabilities:
 * - AC16: Shows description text
 * - AC17: Edit and delete buttons (DRAFT only)
 * - AC25: Edit button toggles scenario to edit mode
 * - AC26: Edit mode shows textarea with current description
 * - AC27: Save/Cancel buttons for edit mode
 * - AC28: Delete shows confirmation dialog
 * - AC29: Confirm deletes scenario
 *
 * @see Story 7.7: Risk Scenario Management
 */

import { useState } from "react";
import { Pencil, Trash2, Save, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { api } from "@/trpc/react";

interface Scenario {
  id: string;
  description: string;
  order: number;
}

interface ScenarioCardProps {
  /** The scenario data */
  scenario: Scenario;
  /** Display index (1-based) */
  index: number;
  /** Whether the card is read-only */
  isReadOnly: boolean;
  /** Callback when scenario is modified */
  onUpdate?: () => void;
}

/**
 * Displays a single scenario with inline editing and delete functionality.
 *
 * @example
 * ```tsx
 * <ScenarioCard
 *   scenario={{ id: "1", description: "Attacker exploits...", order: 0 }}
 *   index={1}
 *   isReadOnly={false}
 *   onUpdate={() => refetch()}
 * />
 * ```
 */
export function ScenarioCard({
  scenario,
  index,
  isReadOnly,
  onUpdate,
}: ScenarioCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(scenario.description);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Update mutation
  const updateMutation = api.riskAssessment.updateScenario.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      onUpdate?.();
    },
  });

  // Delete mutation
  const deleteMutation = api.riskAssessment.removeScenario.useMutation({
    onSuccess: () => {
      setShowDeleteDialog(false);
      onUpdate?.();
    },
  });

  // Handle save
  const handleSave = () => {
    if (editValue.trim() && editValue !== scenario.description) {
      updateMutation.mutate({
        scenarioId: scenario.id,
        description: editValue.trim(),
      });
    } else {
      setIsEditing(false);
      setEditValue(scenario.description);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(scenario.description);
  };

  // Handle delete
  const handleDelete = () => {
    deleteMutation.mutate({ scenarioId: scenario.id });
  };

  // Render edit mode
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Badge variant="outline" className="shrink-0 mt-1">
            {index}
          </Badge>
          <div className="flex-1 space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Describe the risk scenario..."
              rows={3}
              className="resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || !editValue.trim()}
                className="gap-1"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
            {updateMutation.error && (
              <p className="text-sm text-destructive">
                {updateMutation.error.message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render view mode
  return (
    <>
      <div className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3">
          <Badge variant="outline" className="shrink-0 mt-0.5">
            {index}
          </Badge>
          <p className="flex-1 text-sm leading-relaxed">
            {scenario.description}
          </p>
          {/* AC17: Edit/Delete buttons (only when not read-only) */}
          {!isReadOnly && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
                title="Edit scenario"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete scenario"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* AC28, AC29: Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scenario? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 bg-muted rounded-md text-sm">
            {scenario.description}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
          {deleteMutation.error && (
            <p className="text-sm text-destructive mt-2">
              {deleteMutation.error.message}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
