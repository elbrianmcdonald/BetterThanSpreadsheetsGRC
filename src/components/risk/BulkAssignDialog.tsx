"use client";

/**
 * Bulk Assign Dialog Component (Story 4.13)
 *
 * Dialog for assigning multiple risks to the same owners.
 *
 * AC19: Queue supports multi-select
 * AC20: Bulk actions toolbar appears when risks selected
 * AC21: Bulk "Assign to Same Owner" action opens dialog
 * AC22: Dialog allows assigning all selected risks to same IT and/or Business owner
 * AC23: Bulk assignment processes all risks and shows "X risks assigned" confirmation
 */

import { useState } from "react";
import { Loader2, User, Users } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

interface BulkAssignDialogProps {
  riskIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignDialog({
  riskIds,
  onClose,
  onSuccess,
}: BulkAssignDialogProps) {
  const [itOwnerId, setItOwnerId] = useState<string>("");
  const [businessOwnerId, setBusinessOwnerId] = useState<string>("");

  // Fetch IT Stakeholders with workload
  const { data: itStakeholders, isLoading: itLoading } = api.user.listUsersWithWorkload.useQuery({
    role: "IT_STAKEHOLDER",
  });

  // Fetch Business Stakeholders with workload
  const { data: businessStakeholders, isLoading: businessLoading } = api.user.listUsersWithWorkload.useQuery({
    role: "BUSINESS_STAKEHOLDER",
  });

  const usersLoading = itLoading || businessLoading;

  // Bulk assign mutation
  const bulkAssignMutation = api.risk.bulkAssignRisks.useMutation({
    onSuccess: (data) => {
      // AC23: Show confirmation
      toast.success(`${data.assignedCount} risk${data.assignedCount !== 1 ? "s" : ""} assigned successfully`);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleBulkAssign = () => {
    const effectiveItOwnerId = itOwnerId && itOwnerId !== "__none__" ? itOwnerId : undefined;
    const effectiveBusinessOwnerId = businessOwnerId && businessOwnerId !== "__none__" ? businessOwnerId : undefined;

    if (!effectiveItOwnerId && !effectiveBusinessOwnerId) {
      toast.error("Please select at least one owner");
      return;
    }

    bulkAssignMutation.mutate({
      riskIds,
      itOwnerId: effectiveItOwnerId,
      businessOwnerId: effectiveBusinessOwnerId,
    });
  };

  const isLoading = usersLoading || bulkAssignMutation.isPending;
  const hasValidSelection = (itOwnerId && itOwnerId !== "__none__") || (businessOwnerId && businessOwnerId !== "__none__");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Assign Risks
          </DialogTitle>
          <DialogDescription>
            Assign {riskIds.length} risk{riskIds.length !== 1 ? "s" : ""} to the same owners.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress indicator (AC23 - part of user feedback) */}
          {bulkAssignMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Assigning risks...</span>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {/* IT Owner Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="bulk-it-owner">IT Owner</Label>
            <Select
              value={itOwnerId}
              onValueChange={setItOwnerId}
              disabled={isLoading}
            >
              <SelectTrigger id="bulk-it-owner">
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

          {/* Business Owner Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="bulk-business-owner">Business Owner</Label>
            <Select
              value={businessOwnerId}
              onValueChange={setBusinessOwnerId}
              disabled={isLoading}
            >
              <SelectTrigger id="bulk-business-owner">
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

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-700 mb-1">Assignment Summary:</p>
            <ul className="text-gray-600 space-y-1">
              <li>• {riskIds.length} risk{riskIds.length !== 1 ? "s" : ""} will be assigned</li>
              {itOwnerId && (
                <li>• IT Owner: {itStakeholders?.find((u) => u.id === itOwnerId)?.name ?? "Selected"}</li>
              )}
              {businessOwnerId && (
                <li>• Business Owner: {businessStakeholders?.find((u) => u.id === businessOwnerId)?.name ?? "Selected"}</li>
              )}
              <li>• Status will change from OPEN to ASSIGNED</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAssign}
            disabled={!hasValidSelection || isLoading}
          >
            {bulkAssignMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Assign {riskIds.length} Risk{riskIds.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
