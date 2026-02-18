"use client";

/**
 * Quick Assign Dialog Component (Story 4.13)
 *
 * Inline dialog for quickly assigning a single risk to IT and/or Business owners.
 *
 * AC13: Each risk in queue has "Assign" button
 * AC14: Clicking "Assign" opens quick assignment dialog
 * AC15: Dialog shows: IT Owner picker, Business Owner picker, "Assign" button
 * AC17: On assign, risk moves to ASSIGNED status and disappears from queue
 * AC18: Success toast: "Risk assigned to [IT Owner] and [Business Owner]"
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PersonPicker } from "@/components/person/PersonPicker";

interface QuickAssignDialogProps {
  riskId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickAssignDialog({
  riskId,
  onClose,
  onSuccess,
}: QuickAssignDialogProps) {
  const [itOwnerId, setItOwnerId] = useState<string | null>(null);
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);

  // Assign mutation
  const assignMutation = api.risk.assignRisk.useMutation({
    onSuccess: (data) => {
      // Build success message (AC18)
      const owners: string[] = [];
      if (data.ITOwner) {
        owners.push(`IT: ${data.ITOwner.name ?? data.ITOwner.email}`);
      }
      if (data.BusinessOwner) {
        owners.push(`Business: ${data.BusinessOwner.name ?? data.BusinessOwner.email}`);
      }
      toast.success(`Risk assigned to ${owners.join(" and ")}`);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAssign = () => {
    if (!itOwnerId && !businessOwnerId) {
      toast.error("Please select at least one owner");
      return;
    }

    assignMutation.mutate({
      riskId,
      itOwnerId: itOwnerId ?? undefined,
      businessOwnerId: businessOwnerId ?? undefined,
    });
  };

  const isLoading = assignMutation.isPending;
  const hasValidSelection = !!itOwnerId || !!businessOwnerId;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Risk</DialogTitle>
          <DialogDescription>
            Select an IT and/or Business owner to assign this risk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* IT Owner Picker (AC15) */}
          <div className="space-y-2">
            <Label htmlFor="it-owner">IT Owner</Label>
            <PersonPicker
              value={itOwnerId}
              onChange={setItOwnerId}
            />
          </div>

          {/* Business Owner Picker (AC15) */}
          <div className="space-y-2">
            <Label htmlFor="business-owner">Business Owner</Label>
            <PersonPicker
              value={businessOwnerId}
              onChange={setBusinessOwnerId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!hasValidSelection || isLoading}
          >
            {assignMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
