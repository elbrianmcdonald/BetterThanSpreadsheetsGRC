"use client";

/**
 * Finding Comments Component
 *
 * Story 14.5: Finding Comments & Collaboration
 *
 * Allows stakeholders to add, edit, and delete comments on findings.
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";

interface FindingCommentsProps {
  findingId: string;
}

export function FindingComments({ findingId }: FindingCommentsProps) {
  const { data: session } = useSession();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch comments
  const { data: comments, isLoading } = api.finding.getComments.useQuery({
    findingId,
  });

  // Add comment mutation
  const addMutation = api.finding.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.finding.getComments.invalidate({ findingId });
      toast.success("Comment added");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update comment mutation
  const updateMutation = api.finding.updateComment.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditContent("");
      utils.finding.getComments.invalidate({ findingId });
      toast.success("Comment updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete comment mutation
  const deleteMutation = api.finding.deleteComment.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      utils.finding.getComments.invalidate({ findingId });
      toast.success("Comment deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addMutation.mutate({ findingId, content: newComment.trim() });
  };

  const handleUpdateComment = (commentId: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ commentId, content: editContent.trim() });
  };

  const handleDeleteComment = () => {
    if (!deleteId) return;
    deleteMutation.mutate({ commentId: deleteId });
  };

  const startEditing = (commentId: string, content: string) => {
    setEditingId(commentId);
    setEditContent(content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
          {comments && comments.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new comment */}
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs">
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Comment
              </Button>
            </div>
          </div>
        </div>

        {/* Comments list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments && comments.length > 0 ? (
          <div className="space-y-4 border-t pt-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {comment.user.name || comment.user.email}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {session?.user?.id === comment.userId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              startEditing(comment.id, comment.content)
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(comment.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateComment(comment.id)}
                          disabled={
                            !editContent.trim() || updateMutation.isPending
                          }
                        >
                          {updateMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 border-t">
            No comments yet. Be the first to comment!
          </p>
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Comment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this comment? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteComment}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
