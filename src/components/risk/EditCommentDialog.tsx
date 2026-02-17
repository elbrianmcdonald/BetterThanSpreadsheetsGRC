"use client";

/**
 * Edit Comment Dialog Component
 *
 * Story 4.11: Risk Comments and Collaboration (Task 7)
 *
 * Dialog for editing an existing comment:
 * - 7.1: Create EditCommentDialog component
 * - 7.2: Load current comment text into editor
 * - 7.3: Allow editing comment text only (not type)
 * - 7.4: Call updateRiskComment mutation on save
 * - 7.5: Update comment in UI with "Edited" badge
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditCommentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** The comment ID being edited */
  commentId: string;
  /** The current comment text */
  currentText: string;
  /** The risk ID (for cache invalidation) */
  riskId: string;
  /** Callback on successful edit */
  onSuccess?: () => void;
}

export function EditCommentDialog({
  open,
  onOpenChange,
  commentId,
  currentText,
  riskId,
  onSuccess,
}: EditCommentDialogProps) {
  // 7.2: Load current comment text into editor
  const [text, setText] = useState(currentText);

  const utils = api.useUtils();

  // Reset text when dialog opens with new content
  useEffect(() => {
    if (open) {
      setText(currentText);
    }
  }, [open, currentText]);

  // 7.4: Update comment mutation
  const updateMutation = api.risk.updateRiskComment.useMutation({
    onSuccess: () => {
      toast.success("Comment updated successfully");
      // 7.5: Invalidate to refresh with "Edited" badge
      void utils.risk.getRiskComments.invalidate({ riskId });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update comment");
    },
  });

  // Validation
  const isValid = text.trim().length > 0;
  const hasChanged = text.trim() !== currentText.trim();
  const isPending = updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || !hasChanged) return;

    updateMutation.mutate({
      commentId,
      updatedComment: text.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Comment</DialogTitle>
          <DialogDescription>
            Make changes to your comment. The comment will be marked as edited.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 7.2 & 7.3: Comment text editor (type not editable) */}
            <div className="space-y-2">
              <Label htmlFor="editComment">Comment</Label>
              <Textarea
                id="editComment"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isPending}
                rows={6}
                maxLength={5000}
                className={cn(
                  "resize-none",
                  !isValid && text.length > 0 && "border-destructive"
                )}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {!isValid && text.length > 0 && (
                    <span className="text-destructive">Comment cannot be empty</span>
                  )}
                </span>
                <span>{text.length}/5000</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || !hasChanged || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
