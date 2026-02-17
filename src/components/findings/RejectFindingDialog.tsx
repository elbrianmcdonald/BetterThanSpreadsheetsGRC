"use client";

/**
 * Reject Finding Dialog Component
 *
 * Story 7.3: Finding Triage Workflow (AC23-AC25)
 *
 * Confirmation dialog for rejecting a finding with optional reason.
 * - AC23: "Reject" button opens confirmation dialog
 * - AC24: Optional rejection reason can be added (stored in audit log)
 * - AC25: Rejected findings clearly marked with visual indicator
 *
 * @see Story 7.3: Finding Triage Workflow
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RejectFindingDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Finding identifier for display */
  findingIdentifier: string;
  /** Finding title for display */
  findingTitle: string;
  /** Callback when rejection is confirmed */
  onConfirm: (reason?: string) => void;
}

/**
 * Dialog for confirming finding rejection with optional reason.
 *
 * @example
 * ```tsx
 * <RejectFindingDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   findingIdentifier="FND-2025-0001"
 *   findingTitle="SQL Injection Vulnerability"
 *   onConfirm={(reason) => handleReject(reason)}
 * />
 * ```
 */
export function RejectFindingDialog({
  open,
  onOpenChange,
  findingIdentifier,
  findingTitle,
  onConfirm,
}: RejectFindingDialogProps) {
  const [reason, setReason] = useState("");

  // Handle confirm with optional reason
  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
  };

  // Handle cancel/close
  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reject Finding?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to reject finding{" "}
            <span className="font-mono font-medium">{findingIdentifier}</span>:
            <span className="mt-1 block font-medium text-foreground">
              &quot;{findingTitle}&quot;
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Rejection Reason (AC24) */}
        <div className="space-y-2">
          <Label htmlFor="rejection-reason">
            Rejection Reason{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="rejection-reason"
            placeholder="Provide a reason for rejection (e.g., false positive, out of scope, insufficient evidence...)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {reason.length}/500 characters
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject Finding
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
