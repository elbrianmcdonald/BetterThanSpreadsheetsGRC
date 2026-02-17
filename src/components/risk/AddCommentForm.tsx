"use client";

/**
 * Add Comment Form Component
 *
 * Story 4.11: Risk Comments and Collaboration (AC29-AC34)
 *
 * Form for adding new comments to a risk:
 * - AC29: Risk detail page includes "Add Comment" form at bottom of comments section
 * - AC30: Form includes: textarea, comment type selector (dropdown)
 * - AC31: Form includes formatting toolbar (simplified - just basic text for now)
 * - AC32: Form validates comment is not empty
 * - AC33: "Add Comment" button calls addRiskComment mutation
 * - AC34: On success, comment appears in timeline immediately (optimistic update)
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { useState, useRef, useCallback } from "react";
import { CommentType } from "@prisma/client";
import { Send, Loader2, Bold, Italic, List, Link2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { commentTypeConfig, getAllCommentTypes } from "./CommentTypeBadge";

interface AddCommentFormProps {
  /** The risk ID to add comment to */
  riskId: string;
  /** Callback after successful submission */
  onSuccess?: () => void;
  /** Whether the form is disabled (e.g., for read-only users) */
  disabled?: boolean;
}

export function AddCommentForm({
  riskId,
  onSuccess,
  disabled = false,
}: AddCommentFormProps) {
  const [comment, setComment] = useState("");
  const [commentType, setCommentType] = useState<CommentType>(CommentType.GENERAL);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = api.useUtils();

  /**
   * AC31: Insert markdown formatting at cursor position or wrap selected text
   */
  const insertMarkdown = useCallback(
    (prefix: string, suffix: string = "", placeholder: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = comment.substring(start, end);
      const textToInsert = selectedText || placeholder;

      const before = comment.substring(0, start);
      const after = comment.substring(end);
      const newText = `${before}${prefix}${textToInsert}${suffix}${after}`;

      setComment(newText);

      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length + textToInsert.length + suffix.length;
        textarea.setSelectionRange(
          selectedText ? cursorPos : start + prefix.length,
          selectedText ? cursorPos : start + prefix.length + placeholder.length
        );
      }, 0);
    },
    [comment]
  );

  const handleBold = () => insertMarkdown("**", "**", "bold text");
  const handleItalic = () => insertMarkdown("*", "*", "italic text");
  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const before = comment.substring(0, start);
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    insertMarkdown(needsNewline ? "\n- " : "- ", "", "list item");
  };
  const handleLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectedText = comment.substring(textarea.selectionStart, textarea.selectionEnd);
    if (selectedText) {
      insertMarkdown("[", "](url)", "");
    } else {
      insertMarkdown("[link text](", ")", "url");
    }
  };

  // Add comment mutation
  const addCommentMutation = api.risk.addRiskComment.useMutation({
    onSuccess: () => {
      // AC34: Clear form and refresh comments
      setComment("");
      setCommentType(CommentType.GENERAL);
      toast.success("Comment added successfully");

      // Invalidate to refresh the comments list
      void utils.risk.getRiskComments.invalidate({ riskId });

      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // AC32: Validate comment is not empty
  const isValid = comment.trim().length > 0;
  const isPending = addCommentMutation.isPending;

  // AC33: Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || disabled) return;

    addCommentMutation.mutate({
      riskId,
      comment: comment.trim(),
      commentType,
    });
  };

  const commentTypes = getAllCommentTypes();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AC30: Comment textarea with AC31: Formatting toolbar */}
      <div className="space-y-2">
        <Label htmlFor="comment">Add a Comment</Label>

        {/* AC31: Formatting toolbar */}
        <div className="flex items-center gap-1 p-1 border border-b-0 rounded-t-md bg-muted/30">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBold}
                  disabled={disabled || isPending}
                  className="h-8 w-8 p-0"
                >
                  <Bold className="h-4 w-4" />
                  <span className="sr-only">Bold</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bold (Ctrl+B)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleItalic}
                  disabled={disabled || isPending}
                  className="h-8 w-8 p-0"
                >
                  <Italic className="h-4 w-4" />
                  <span className="sr-only">Italic</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Italic (Ctrl+I)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-5 bg-border mx-1" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleList}
                  disabled={disabled || isPending}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                  <span className="sr-only">Bullet List</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bullet List</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLink}
                  disabled={disabled || isPending}
                  className="h-8 w-8 p-0"
                >
                  <Link2 className="h-4 w-4" />
                  <span className="sr-only">Insert Link</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Insert Link</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Textarea
          ref={textareaRef}
          id="comment"
          placeholder="Type your comment here... Share updates, ask questions, or provide decision rationale. Use markdown for formatting."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={disabled || isPending}
          rows={4}
          maxLength={5000}
          className={cn(
            "resize-none rounded-t-none -mt-2",
            !isValid && comment.length > 0 && "border-amber-500"
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Supports markdown formatting. Max 5,000 characters.</span>
          <span>{comment.length}/5000</span>
        </div>
      </div>

      {/* Footer: Type selector and submit button */}
      <div className="flex flex-wrap items-end gap-3">
        {/* AC30 & AC35: Comment type selector with tooltips */}
        <div className="space-y-2 flex-1 min-w-[180px]">
          <Label htmlFor="commentType">Comment Type</Label>
          <Select
            value={commentType}
            onValueChange={(value) => setCommentType(value as CommentType)}
            disabled={disabled || isPending}
          >
            <SelectTrigger id="commentType" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {commentTypes.map((type) => {
                const Icon = type.icon;
                const config = commentTypeConfig[type.value];
                return (
                  <TooltipProvider key={type.value}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SelectItem value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", config.color)} />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{type.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* AC33: Add Comment button */}
        <Button
          type="submit"
          disabled={!isValid || disabled || isPending}
          className="min-w-[120px]"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Add Comment
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
