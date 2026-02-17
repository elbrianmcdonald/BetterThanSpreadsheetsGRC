"use client";

/**
 * Risk Register Status Dropdown Component
 *
 * Story 16.6: Risk Register Status Transitions
 *
 * Displays current status with dropdown menu for valid transitions.
 * - AC5: Status badge with dropdown menu
 * - AC6: Shows only valid transitions
 * - AC7-AC12: Action buttons for each transition type
 *
 * @see Story 16.6: Risk Register Status Transitions
 */

import { useState, useCallback } from "react";
import {
  ChevronDown,
  Play,
  CheckCircle,
  ShieldCheck,
  ArrowRightLeft,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { RiskRegisterStatus } from "@prisma/client";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RiskRegisterStatusDropdownProps {
  /** The risk register entry ID */
  entryId: string;
  /** Current status of the entry */
  currentStatus: RiskRegisterStatus;
  /** Callback when status changes */
  onStatusChange?: () => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Status badge configuration */
const statusConfig: Record<
  RiskRegisterStatus,
  { color: string; label: string; icon: typeof ChevronDown }
> = {
  OPEN: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Open",
    icon: Play,
  },
  IN_TREATMENT: {
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    label: "In Treatment",
    icon: Loader2,
  },
  ACCEPTED: {
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    label: "Accepted",
    icon: CheckCircle,
  },
  MITIGATED: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    label: "Mitigated",
    icon: ShieldCheck,
  },
  TRANSFERRED: {
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    label: "Transferred",
    icon: ArrowRightLeft,
  },
  CLOSED: {
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    label: "Closed",
    icon: XCircle,
  },
};

/** Action icon by status */
function getActionIcon(status: RiskRegisterStatus) {
  switch (status) {
    case RiskRegisterStatus.IN_TREATMENT:
      return Play;
    case RiskRegisterStatus.ACCEPTED:
      return CheckCircle;
    case RiskRegisterStatus.MITIGATED:
      return ShieldCheck;
    case RiskRegisterStatus.TRANSFERRED:
      return ArrowRightLeft;
    case RiskRegisterStatus.CLOSED:
      return XCircle;
    case RiskRegisterStatus.OPEN:
      return RotateCcw;
    default:
      return ChevronDown;
  }
}

export function RiskRegisterStatusDropdown({
  entryId,
  currentStatus,
  onStatusChange,
  disabled = false,
  className,
}: RiskRegisterStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    status: RiskRegisterStatus;
    label: string;
  } | null>(null);
  const [comment, setComment] = useState("");

  const utils = api.useUtils();

  // Fetch available transitions
  const { data: transitions } = api.riskRegister.getAvailableTransitions.useQuery(
    { entryId },
    { enabled: !!entryId }
  );

  // Update status mutation
  const updateStatusMutation = api.riskRegister.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated successfully");
      utils.riskRegister.invalidate();
      onStatusChange?.();
      setCommentDialogOpen(false);
      setComment("");
      setPendingTransition(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  // Handle transition click
  const handleTransitionClick = useCallback(
    (transition: { status: RiskRegisterStatus; label: string; requiresComment: boolean }) => {
      if (transition.requiresComment) {
        // Open comment dialog
        setPendingTransition({ status: transition.status, label: transition.label });
        setCommentDialogOpen(true);
        setIsOpen(false);
      } else {
        // Execute immediately
        updateStatusMutation.mutate({
          entryId,
          newStatus: transition.status,
        });
        setIsOpen(false);
      }
    },
    [entryId, updateStatusMutation]
  );

  // Handle comment submit
  const handleCommentSubmit = useCallback(() => {
    if (!pendingTransition) return;

    if (!comment.trim()) {
      toast.error("Comment is required for this action");
      return;
    }

    updateStatusMutation.mutate({
      entryId,
      newStatus: pendingTransition.status,
      comment: comment.trim(),
    });
  }, [entryId, pendingTransition, comment, updateStatusMutation]);

  const currentConfig = statusConfig[currentStatus];
  const StatusIcon = currentConfig.icon;

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild disabled={disabled || updateStatusMutation.isPending}>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", className)}
            disabled={disabled || updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StatusIcon className="h-4 w-4" />
            )}
            <Badge className={cn("font-normal", currentConfig.color)}>
              {currentConfig.label}
            </Badge>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {transitions && transitions.length > 0 ? (
            <>
              {transitions
                .filter((t) => t.status !== RiskRegisterStatus.OPEN)
                .map((transition) => {
                  const Icon = getActionIcon(transition.status);
                  return (
                    <DropdownMenuItem
                      key={transition.status}
                      onClick={() => handleTransitionClick(transition)}
                      className="gap-2 cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {transition.label}
                      {transition.requiresComment && (
                        <span className="text-xs text-muted-foreground ml-auto">*</span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              {transitions.some((t) => t.status === RiskRegisterStatus.OPEN) && (
                <>
                  <DropdownMenuSeparator />
                  {transitions
                    .filter((t) => t.status === RiskRegisterStatus.OPEN)
                    .map((transition) => {
                      const Icon = getActionIcon(transition.status);
                      return (
                        <DropdownMenuItem
                          key={transition.status}
                          onClick={() => handleTransitionClick(transition)}
                          className="gap-2 cursor-pointer text-amber-600"
                        >
                          <Icon className="h-4 w-4" />
                          {transition.label}
                        </DropdownMenuItem>
                      );
                    })}
                </>
              )}
            </>
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No transitions available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Comment Dialog for Accept/Close actions */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingTransition?.label}</DialogTitle>
            <DialogDescription>
              {pendingTransition?.status === RiskRegisterStatus.ACCEPTED
                ? "Please provide a justification for accepting this risk."
                : "Please provide a reason for closing this risk."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">
                {pendingTransition?.status === RiskRegisterStatus.ACCEPTED
                  ? "Justification"
                  : "Comment"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  pendingTransition?.status === RiskRegisterStatus.ACCEPTED
                    ? "Explain why this risk is being accepted..."
                    : "Provide details about the closure..."
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommentDialogOpen(false);
                setComment("");
                setPendingTransition(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={!comment.trim() || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                pendingTransition?.label
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
