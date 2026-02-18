"use client";

/**
 * Assign Risk Dialog Component
 *
 * Modal dialog for assigning IT and Business owners to a risk.
 *
 * Story 4.6: Risk Ownership Assignment (Task 5)
 * - AC19: Risk detail page has "Assign Risk" button
 * - AC20: Clicking button opens assignment dialog
 * - AC21: Dialog includes two owner pickers (Person)
 * - AC25: Dialog validates at least one owner selected
 *
 * @see Story 4.6: Risk Ownership Assignment
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
import { toast } from "sonner";
import { PersonPicker } from "@/components/person/PersonPicker";

interface AssignRiskDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** The risk ID to assign */
  riskId: string;
  /** The risk title (for display) */
  riskTitle: string;
  /** Whether this is a reassignment (risk already has owners) */
  isReassign?: boolean;
  /** Current IT owner person ID (for reassignment) */
  currentITOwnerId?: string | null;
  /** Current Business owner person ID (for reassignment) */
  currentBusinessOwnerId?: string | null;
  /** Callback when assignment is successful */
  onSuccess?: () => void;
}

export function AssignRiskDialog({
  open,
  onOpenChange,
  riskId,
  riskTitle,
  isReassign = false,
  currentITOwnerId,
  currentBusinessOwnerId,
  onSuccess,
}: AssignRiskDialogProps) {
  // State for selected person IDs
  const [itOwnerId, setItOwnerId] = useState<string | null>(
    currentITOwnerId ?? null
  );
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(
    currentBusinessOwnerId ?? null
  );

  // Assign mutation
  const assignMutation = api.risk.assignRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk assigned successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Reassign mutation
  const reassignMutation = api.risk.reassignRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk reassigned successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isPending = assignMutation.isPending || reassignMutation.isPending;

  // Handle form submission
  const handleSubmit = () => {
    // AC25: Validate at least one owner selected
    if (!itOwnerId && !businessOwnerId) {
      toast.error("Please select at least one owner (IT or Business)");
      return;
    }

    if (isReassign) {
      reassignMutation.mutate({
        riskId,
        itOwnerId,
        businessOwnerId,
      });
    } else {
      assignMutation.mutate({
        riskId,
        itOwnerId: itOwnerId ?? undefined,
        businessOwnerId: businessOwnerId ?? undefined,
      });
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setItOwnerId(currentITOwnerId ?? null);
      setBusinessOwnerId(currentBusinessOwnerId ?? null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReassign ? "Reassign Risk" : "Assign Risk"}
          </DialogTitle>
          <DialogDescription>
            {isReassign
              ? "Update the owners responsible for this risk."
              : "Select IT and/or Business owners for this risk."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Risk Title */}
          <div className="text-sm">
            <span className="text-muted-foreground">Risk: </span>
            <span className="font-medium">{riskTitle}</span>
          </div>

          {/* IT Owner Selection */}
          <div className="space-y-2">
            <Label>IT Owner (Technical Remediation)</Label>
            <PersonPicker value={itOwnerId} onChange={setItOwnerId} />
          </div>

          {/* Business Owner Selection */}
          <div className="space-y-2">
            <Label>Business Owner (Business Decisions)</Label>
            <PersonPicker value={businessOwnerId} onChange={setBusinessOwnerId} />
          </div>

          {/* Validation message */}
          {!itOwnerId && !businessOwnerId && (
            <p className="text-sm text-amber-600">
              Select at least one owner to assign this risk.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!itOwnerId && !businessOwnerId)}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isReassign ? "Reassigning..." : "Assigning..."}
              </>
            ) : isReassign ? (
              "Reassign Risk"
            ) : (
              "Assign Risk"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
