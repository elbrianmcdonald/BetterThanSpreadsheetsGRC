"use client";

/**
 * Comment Card Component
 *
 * Story 4.11: Risk Comments and Collaboration (AC22-AC28)
 *
 * Displays an individual comment with author info, timestamp, and actions:
 * - AC24: Shows author name/avatar, comment text (markdown), timestamp, comment type badge
 * - AC26: Comments authored by current user show "Edit" and "Delete" buttons
 * - AC27: GRC_ANALYST and ORG_ADMIN can edit/delete any comment
 * - AC17: Edited comments show "Edited" badge with timestamp
 * - AC21: Deleted comments show "[Comment deleted]" placeholder
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { useState } from "react";
import { CommentType, UserRole } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2, MoreHorizontal, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CommentTypeBadge } from "./CommentTypeBadge";
import { MarkdownPreview } from "@/components/ui/markdown-preview";

interface CommentAuthor {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface CommentCardProps {
  /** The comment data */
  comment: {
    id: string;
    comment: string;
    commentType: CommentType;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    Author: CommentAuthor | null;
  };
  /** Current user's ID */
  currentUserId: string;
  /** Current user's role */
  currentUserRole: UserRole;
  /** Callback when edit is clicked */
  onEdit?: (commentId: string, currentText: string) => void;
  /** Callback when delete is confirmed */
  onDelete?: (commentId: string) => void;
  /** Whether delete is pending */
  isDeleting?: boolean;
}

/**
 * Get user initials for avatar fallback
 */
function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : name.slice(0, 2);
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export function CommentCard({
  comment,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  isDeleting = false,
}: CommentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Check if comment is deleted
  const isDeleted = !!comment.deletedAt;

  // Check if comment was edited (updatedAt > createdAt + 1 second to account for creation)
  const isEdited =
    !isDeleted &&
    new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;

  // AC26 & AC27: Check if user can edit/delete this comment
  const isAuthor = comment.Author?.id === currentUserId;
  const canModify =
    isAuthor ||
    currentUserRole === UserRole.GRC_ANALYST ||
    currentUserRole === UserRole.ORG_ADMIN;

  // AC21: Show deleted placeholder
  if (isDeleted) {
    return (
      <div className="flex gap-3 p-4 bg-muted/30 rounded-lg border border-dashed">
        <Avatar className="h-8 w-8 opacity-50">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground italic">
            [Comment deleted]
          </p>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    );
  }

  const author = comment.Author;

  return (
    <div className="flex gap-3 p-4 bg-card rounded-lg border">
      {/* AC24: Author avatar */}
      <Avatar className="h-8 w-8">
        <AvatarImage src={author?.image ?? undefined} alt={author?.name ?? "User"} />
        <AvatarFallback className="text-xs">
          {getInitials(author?.name ?? null, author?.email ?? null)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Header: Author name, badge, timestamp, actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Author name */}
            <span className="font-medium text-sm">
              {author?.name ?? author?.email ?? "Unknown User"}
            </span>

            {/* AC25: Comment type badge */}
            <CommentTypeBadge type={comment.commentType} size="sm" showTooltip={false} />

            {/* AC17: Edited badge */}
            {isEdited && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Edited
              </Badge>
            )}
          </div>

          {/* Actions menu */}
          {canModify && !isDeleted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Comment actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* AC26: Edit button */}
                <DropdownMenuItem
                  onClick={() => onEdit?.(comment.id, comment.comment)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {/* AC26: Delete button */}
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          {isEdited && (
            <span className="ml-1">
              (edited {formatDistanceToNow(new Date(comment.updatedAt), { addSuffix: true })})
            </span>
          )}
        </p>

        {/* AC24: Comment text with markdown rendering (AC31) */}
        <div className="mt-2 text-sm">
          <MarkdownPreview
            content={comment.comment}
            className="prose-sm"
          />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be
              undone. The comment will be replaced with a &quot;[Comment deleted]&quot;
              placeholder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(comment.id);
                setShowDeleteDialog(false);
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
