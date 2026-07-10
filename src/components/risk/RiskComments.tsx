"use client";

/**
 * Risk Comments Component
 *
 * Story 4.11: Risk Comments and Collaboration (AC22-AC34)
 *
 * Main component for displaying and managing risk comments:
 * - AC22: Risk detail page shows "Comments" section
 * - AC23: Comments displayed in chronological order (oldest first)
 * - AC28: Empty state shows "No comments yet. Start the conversation."
 * - AC29: Risk detail page includes "Add Comment" form at bottom
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { useState } from "react";
import { UserRole } from "@prisma/client";
import { MessageSquare, Loader2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CommentCard } from "./CommentCard";
import { AddCommentForm } from "./AddCommentForm";
import { EditCommentDialog } from "./EditCommentDialog";

interface RiskCommentsProps {
  /** The risk ID */
  riskId: string;
  /** Current user's ID */
  currentUserId: string;
  /** Current user's role */
  currentUserRole: UserRole;
  /** Whether the current user can add comments */
  canComment: boolean;
}

/**
 * Roles that cannot add comments (AC42)
 */
const NO_COMMENT_ROLES = [UserRole.BUSINESS_USER];

export function RiskComments({
  riskId,
  currentUserId,
  currentUserRole,
  canComment,
}: RiskCommentsProps) {
  // State for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<{
    id: string;
    text: string;
  } | null>(null);

  // Fetch comments
  const { data: comments, isLoading } = api.risk.getRiskComments.useQuery(
    { riskId },
    { refetchOnWindowFocus: false }
  );

  // Delete mutation
  const deleteMutation = api.risk.deleteRiskComment.useMutation({
    onSuccess: () => {
      // Invalidation handled in CommentCard via utils
    },
  });

  const utils = api.useUtils();

  // Handle edit click
  const handleEdit = (commentId: string, currentText: string) => {
    setEditingComment({ id: commentId, text: currentText });
    setEditDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (commentId: string) => {
    deleteMutation.mutate(
      { commentId },
      {
        onSuccess: () => {
          void utils.risk.getRiskComments.invalidate({ riskId });
        },
      }
    );
  };

  // Determine if user can comment based on role
  const userCanComment = canComment && !(NO_COMMENT_ROLES as UserRole[]).includes(currentUserRole);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Comments
          {comments && comments.length > 0 && (
            <span className="text-muted-foreground font-normal text-sm">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* AC28: Empty state */}
        {!isLoading && (!comments || comments.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No comments yet. Start the conversation.</p>
          </div>
        )}

        {/* AC23: Comments list (chronological order - oldest first) */}
        {!isLoading && comments && comments.length > 0 && (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* AC29: Add Comment form */}
        {userCanComment && (
          <>
            <Separator className="my-6" />
            <AddCommentForm riskId={riskId} />
          </>
        )}

        {/* Show message for users who can't comment */}
        {!userCanComment && !isLoading && (
          <>
            <Separator className="my-6" />
            <p className="text-sm text-muted-foreground text-center py-4">
              {currentUserRole === UserRole.BUSINESS_USER
                ? "Auditors have read-only access and cannot add comments."
                : "You don't have permission to comment on this risk."}
            </p>
          </>
        )}

        {/* Edit Dialog */}
        {editingComment && (
          <EditCommentDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            commentId={editingComment.id}
            currentText={editingComment.text}
            riskId={riskId}
          />
        )}
      </CardContent>
    </Card>
  );
}
