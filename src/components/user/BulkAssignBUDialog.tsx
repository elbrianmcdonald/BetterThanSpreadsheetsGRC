/**
 * Bulk Assign Business Unit Dialog
 *
 * Story 7.0.4: User Business Unit Assignment UI (AC11-AC15)
 *
 * Dialog for assigning a business unit to multiple selected users at once.
 */

"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BusinessUnitSelect } from "./BusinessUnitSelect";
import { Loader2 } from "lucide-react";

interface BulkAssignBUDialogProps {
  /** Array of user IDs to update */
  userIds: string[];
  /** Called when dialog is closed */
  onClose: () => void;
  /** Called after successful assignment */
  onSuccess: () => void;
}

export function BulkAssignBUDialog({
  userIds,
  onClose,
  onSuccess,
}: BulkAssignBUDialogProps) {
  const [selectedBUId, setSelectedBUId] = useState<string | null>(null);

  const utils = api.useUtils();

  // AC14: Mutation to bulk update users
  const bulkUpdateMutation = api.user.bulkUpdateBU.useMutation({
    onSuccess: (data) => {
      // AC15: Success toast with count
      toast.success(`Updated ${data.updated} user${data.updated === 1 ? "" : "s"}`);
      void utils.user.listUsers.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to update users: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    bulkUpdateMutation.mutate({
      userIds,
      businessUnitId: selectedBUId,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Business Unit</DialogTitle>
          <DialogDescription>
            Assign a business unit to {userIds.length} selected user
            {userIds.length === 1 ? "" : "s"}. This will replace their current
            business unit assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label
            htmlFor="bulk-bu-select"
            className="block text-sm font-medium mb-2"
          >
            Business Unit
          </label>
          <BusinessUnitSelect
            value={selectedBUId}
            onChange={setSelectedBUId}
            allowNone={true}
            placeholder="Select a Business Unit"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Select &quot;None (Unassigned)&quot; to remove the business unit assignment.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={bulkUpdateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Assign to {userIds.length} User{userIds.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
