"use client";

/**
 * AssessmentActions Component
 *
 * Story 7.9: Approval Gates & Assessment Approval (AC7-AC10, AC27-AC34)
 *
 * Provides Approve and Reject action buttons for risk assessments.
 * Buttons are only shown for DRAFT assessments to authorized users.
 */

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/react";
import type { ApprovalGateResult } from "./ApprovalGateChecklist";

interface AssessmentActionsProps {
  /** Assessment ID */
  assessmentId: string;
  /** Current assessment status */
  status: string;
  /** Approval gate check result */
  gates: ApprovalGateResult;
  /** Whether the current user can approve/reject */
  canModify?: boolean;
  /** Callback after successful approval */
  onApproved?: (riskRegistryEntryId: string, identifier: string) => void;
  /** Callback after successful rejection */
  onRejected?: () => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * Action buttons for assessment approval/rejection
 *
 * AC7: "Approve Assessment" button shown for DRAFT assessments
 * AC8: Button disabled when any gate is not met
 * AC9: Disabled button shows tooltip
 * AC10: Button enabled when all gates pass
 * AC31-AC34: Reject functionality
 */
export function AssessmentActions({
  assessmentId,
  status,
  gates,
  canModify = true,
  onApproved,
  onRejected,
  className,
}: AssessmentActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const utils = api.useUtils();

  // AC11: Approve mutation
  const approveMutation = api.riskAssessment.approve.useMutation({
    onSuccess: (result) => {
      // AC27: Success toast with entry identifier
      toast.success(
        `Assessment approved. Risk ${result.entry.identifier} added to register.`
      );
      // Invalidate queries to refresh
      void utils.riskAssessment.getById.invalidate({ id: assessmentId });
      void utils.riskRegister.list.invalidate();
      onApproved?.(result.entry.id, result.entry.identifier);
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // AC33: Reject mutation
  const rejectMutation = api.riskAssessment.reject.useMutation({
    onSuccess: () => {
      toast.success("Assessment rejected.");
      setShowRejectDialog(false);
      setRejectReason("");
      void utils.riskAssessment.getById.invalidate({ id: assessmentId });
      onRejected?.();
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const handleApprove = () => {
    approveMutation.mutate({ assessmentId });
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    rejectMutation.mutate({
      assessmentId,
      reason: rejectReason.trim(),
    });
  };

  // AC36: Don't show buttons if user can't modify
  if (!canModify) {
    return null;
  }

  // Only show for DRAFT status
  if (status !== "DRAFT") {
    return null;
  }

  const isApproving = approveMutation.isPending;
  const isRejecting = rejectMutation.isPending;
  const isProcessing = isApproving || isRejecting;

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        {/* AC7-AC10: Approve button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={handleApprove}
                  disabled={!gates.canApprove || isProcessing}
                  className="gap-2"
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve Assessment
                </Button>
              </span>
            </TooltipTrigger>
            {/* AC9: Tooltip for disabled state */}
            {!gates.canApprove && (
              <TooltipContent>
                <p>Complete all requirements to approve</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* AC31: Reject button */}
        <Button
          variant="outline"
          onClick={() => setShowRejectDialog(true)}
          disabled={isProcessing}
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>

      {/* AC32: Reject confirmation dialog with reason textarea */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Assessment</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this assessment. This will be
              recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Rejection Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isRejecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectReason.trim()}
              className="gap-2"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Displays approval status badge for approved/rejected assessments
 * AC30: "Approved on {date} by {user}" badge shown
 */
interface ApprovalBadgeProps {
  status: string;
  approvedAt?: Date | null;
  approvedBy?: { name: string | null; email: string } | null;
  riskRegisterEntry?: { id: string; identifier: string } | null;
}

export function ApprovalStatusBadge({
  status,
  approvedAt,
  approvedBy,
  riskRegisterEntry,
}: ApprovalBadgeProps) {
  if (status === "APPROVED" && approvedAt) {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="default" className="bg-green-600">
          Approved on {new Date(approvedAt).toLocaleDateString()} by{" "}
          {approvedBy?.name || approvedBy?.email || "Unknown"}
        </Badge>
        {/* AC29: Link to Risk Register entry */}
        {riskRegisterEntry && (
          <a
            href={`/risks/register/${riskRegisterEntry.id}`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View in Risk Register ({riskRegisterEntry.identifier})
          </a>
        )}
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <Badge variant="destructive">
        Rejected
      </Badge>
    );
  }

  return null;
}
