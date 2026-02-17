"use client";

/**
 * Status Transition Dialog Component
 *
 * Story 4.10: Remediation Workflow State Machine (AC25-AC30)
 *
 * Modal dialog for transitioning risk status through the workflow:
 * - AC25: Risk detail page shows current status with color-coded badge
 * - AC26: Status badge includes last updated timestamp
 * - AC27: "Change Status" button visible for authorized users
 * - AC28: Clicking button opens status transition dialog
 * - AC29: Dialog shows allowed transitions based on current status and user role
 * - AC30: Dialog requires transition reason textarea (optional for normal flow, required for reopening CLOSED risks)
 *
 * @see Story 4.10: Remediation Workflow State Machine
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, ArrowRight, AlertCircle, FileText } from "lucide-react";
import { RiskStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge, getStatusLabel, getStatusDescription } from "./StatusBadge";

interface StatusTransitionDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** The risk ID to transition */
  riskId: string;
  /** The risk title (for display) */
  riskTitle: string;
  /** The current risk status */
  currentStatus: RiskStatus;
  /** Callback when transition is successful */
  onSuccess?: () => void;
}

/**
 * Status configuration for styling transitions
 */
const STATUS_STYLE: Record<RiskStatus, { bgColor: string; borderColor: string }> = {
  [RiskStatus.DRAFT]: {
    bgColor: "bg-slate-50 dark:bg-slate-900/30",
    borderColor: "border-slate-200 dark:border-slate-700",
  },
  [RiskStatus.PENDING_REVIEW]: {
    bgColor: "bg-purple-50 dark:bg-purple-900/30",
    borderColor: "border-purple-200 dark:border-purple-700",
  },
  [RiskStatus.OPEN]: {
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
    borderColor: "border-gray-200 dark:border-gray-700",
  },
  [RiskStatus.ASSIGNED]: {
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-700",
  },
  [RiskStatus.REMEDIATED]: {
    bgColor: "bg-yellow-50 dark:bg-yellow-900/30",
    borderColor: "border-yellow-200 dark:border-yellow-700",
  },
  [RiskStatus.CLOSED]: {
    bgColor: "bg-green-50 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-700",
  },
};

export function StatusTransitionDialog({
  open,
  onOpenChange,
  riskId,
  riskTitle,
  currentStatus,
  onSuccess,
}: StatusTransitionDialogProps) {
  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // State
  const [selectedStatus, setSelectedStatus] = useState<RiskStatus | null>(null);
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Memoized handler to ensure stable reference
  const handleStatusChange = useCallback((value: string) => {
    setSelectedStatus(value as RiskStatus);
  }, []);

  // AC29: Fetch available transitions based on current status and user role
  const { data: availableTransitions, isLoading: loadingTransitions } =
    api.risk.getAvailableTransitions.useQuery(
      { riskId },
      { enabled: open }
    );

  // Update status mutation
  const updateStatusMutation = api.risk.updateRiskStatus.useMutation({
    onSuccess: () => {
      toast.success(
        `Risk status updated to ${getStatusLabel(selectedStatus!)}`
      );
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      setValidationError(error.message);
      toast.error(error.message);
    },
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedStatus(null);
      setReason("");
      setValidationError(null);
    }
  }, [open]);

  // Return null until mounted to prevent hydration mismatch
  if (!isMounted) {
    return null;
  }

  // Check if reason is required (AC30: required for reopening CLOSED risks)
  const isReasonRequired = currentStatus === RiskStatus.CLOSED;

  // Check if evidence is required (AC36: ASSIGNED → REMEDIATED)
  // Use transition data if available, otherwise check status manually
  const selectedTransition = availableTransitions?.transitions.find(
    (t) => t.status === selectedStatus
  );
  const requiresEvidence = selectedTransition?.requiresEvidence ?? (
    currentStatus === RiskStatus.ASSIGNED &&
    selectedStatus === RiskStatus.REMEDIATED
  );

  // Handle form submission
  const handleSubmit = () => {
    setValidationError(null);

    if (!selectedStatus) {
      setValidationError("Please select a new status");
      return;
    }

    // AC30: Validate reason is provided when reopening closed risks
    if (isReasonRequired && !reason.trim()) {
      setValidationError(
        "A reason is required when reopening a closed risk (audit requirement)"
      );
      return;
    }

    // Submit transition
    updateStatusMutation.mutate({
      riskId,
      newStatus: selectedStatus,
      reason: reason.trim() || undefined,
    });
  };

  const isPending = updateStatusMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Risk Status</DialogTitle>
          <DialogDescription>
            Transition this risk to a new status in the workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Risk Title */}
          <div className="text-sm">
            <span className="text-muted-foreground">Risk: </span>
            <span className="font-medium">{riskTitle}</span>
          </div>

          {/* Current Status Display */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current Status</Label>
            <div className="flex items-center gap-2">
              <StatusBadge status={currentStatus} size="md" />
              <span className="text-sm text-muted-foreground">
                {getStatusDescription(currentStatus)}
              </span>
            </div>
          </div>

          {/* Loading State */}
          {loadingTransitions && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* No Transitions Available */}
          {!loadingTransitions &&
            (!availableTransitions || availableTransitions.transitions.length === 0) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No status transitions available. This may be because:
                  <ul className="mt-2 list-disc list-inside text-sm">
                    <li>Your role does not have permission to change this risk&apos;s status</li>
                    <li>The risk is in a terminal state</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

          {/* AC29: Available Transitions as Radio Buttons */}
          {!loadingTransitions &&
            availableTransitions &&
            availableTransitions.transitions.length > 0 && (
              <div className="space-y-3">
                <Label>Select New Status</Label>
                <RadioGroup
                  value={selectedStatus ?? undefined}
                  onValueChange={handleStatusChange}
                  className="space-y-2"
                >
                  {availableTransitions.transitions.map((transition) => {
                    const style = STATUS_STYLE[transition.status];
                    return (
                      <label
                        key={transition.status}
                        className={cn(
                          "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                          selectedStatus === transition.status
                            ? `${style.bgColor} ${style.borderColor} border-2`
                            : "hover:bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value={transition.status} id={transition.status} />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={currentStatus} size="sm" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <StatusBadge status={transition.status} size="sm" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getStatusDescription(transition.status)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            )}

          {/* Evidence Required Notice (AC36) */}
          {requiresEvidence && (
            <Alert className="border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30">
              <FileText className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <strong>Remediation Evidence Required:</strong> Please upload
                remediation evidence using the Evidence tab after changing
                status to document what was done to remediate this risk.
              </AlertDescription>
            </Alert>
          )}

          {/* AC30: Transition Reason Textarea */}
          {selectedStatus && (
            <div className="space-y-2">
              <Label
                htmlFor="reason"
                className={isReasonRequired ? "text-foreground" : "text-muted-foreground"}
              >
                Transition Reason
                {isReasonRequired && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              <Textarea
                id="reason"
                placeholder={
                  isReasonRequired
                    ? "Please explain why this closed risk is being reopened (required for audit trail)..."
                    : "Optionally explain the reason for this status change..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className={cn(
                  isReasonRequired && !reason.trim() && "border-amber-500"
                )}
              />
              {isReasonRequired && (
                <p className="text-xs text-amber-600">
                  AC10: Reopening a closed risk requires an explanation for the
                  audit trail.
                </p>
              )}
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !selectedStatus ||
              (isReasonRequired && !reason.trim())
            }
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Status"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
