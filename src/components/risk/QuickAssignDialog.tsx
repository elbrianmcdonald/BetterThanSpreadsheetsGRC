"use client";

/**
 * Quick Assign Dialog Component (Story 4.13)
 *
 * Inline dialog for quickly assigning a single risk to IT and/or Business owners.
 *
 * AC13: Each risk in queue has "Assign" button
 * AC14: Clicking "Assign" opens quick assignment dialog
 * AC15: Dialog shows: IT Owner dropdown, Business Owner dropdown, "Assign" button
 * AC16: Dropdowns pre-filtered to users with IT_STAKEHOLDER and BUSINESS_STAKEHOLDER roles
 * AC17: On assign, risk moves to ASSIGNED status and disappears from queue
 * AC18: Success toast: "Risk assigned to [IT Owner] and [Business Owner]"
 */

import { useState } from "react";
import { Loader2, User } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  const [itOwnerId, setItOwnerId] = useState<string>("");
  const [businessOwnerId, setBusinessOwnerId] = useState<string>("");

  // Fetch IT Stakeholders with workload (AC16)
  const { data: itStakeholders, isLoading: itLoading } = api.user.listUsersWithWorkload.useQuery({
    role: "IT_STAKEHOLDER",
  });

  // Fetch Business Stakeholders with workload (AC16)
  const { data: businessStakeholders, isLoading: businessLoading } = api.user.listUsersWithWorkload.useQuery({
    role: "BUSINESS_STAKEHOLDER",
  });

  const usersLoading = itLoading || businessLoading;

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
    const effectiveItOwnerId = itOwnerId && itOwnerId !== "__none__" ? itOwnerId : undefined;
    const effectiveBusinessOwnerId = businessOwnerId && businessOwnerId !== "__none__" ? businessOwnerId : undefined;

    if (!effectiveItOwnerId && !effectiveBusinessOwnerId) {
      toast.error("Please select at least one owner");
      return;
    }

    assignMutation.mutate({
      riskId,
      itOwnerId: effectiveItOwnerId,
      businessOwnerId: effectiveBusinessOwnerId,
    });
  };

  const isLoading = usersLoading || assignMutation.isPending;
  const hasValidSelection = (itOwnerId && itOwnerId !== "__none__") || (businessOwnerId && businessOwnerId !== "__none__");

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
          {/* IT Owner Dropdown (AC15, AC16) */}
          <div className="space-y-2">
            <Label htmlFor="it-owner">IT Owner</Label>
            <Select
              value={itOwnerId}
              onValueChange={setItOwnerId}
              disabled={isLoading}
            >
              <SelectTrigger id="it-owner">
                <SelectValue placeholder="Select IT owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-gray-400">None</span>
                </SelectItem>
                {itStakeholders?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{user.name ?? user.email}</span>
                      <span className="text-gray-400 text-xs">
                        ({user.assignedRiskCount} risks)
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {(!itStakeholders || itStakeholders.length === 0) && (
                  <div className="py-2 px-2 text-sm text-gray-500">
                    No IT Stakeholders available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Business Owner Dropdown (AC15, AC16) */}
          <div className="space-y-2">
            <Label htmlFor="business-owner">Business Owner</Label>
            <Select
              value={businessOwnerId}
              onValueChange={setBusinessOwnerId}
              disabled={isLoading}
            >
              <SelectTrigger id="business-owner">
                <SelectValue placeholder="Select Business owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-gray-400">None</span>
                </SelectItem>
                {businessStakeholders?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{user.name ?? user.email}</span>
                      <span className="text-gray-400 text-xs">
                        ({user.assignedRiskCount} risks)
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {(!businessStakeholders || businessStakeholders.length === 0) && (
                  <div className="py-2 px-2 text-sm text-gray-500">
                    No Business Stakeholders available
                  </div>
                )}
              </SelectContent>
            </Select>
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
