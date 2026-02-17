"use client";

/**
 * Assign Assessment Dialog Component
 *
 * Story 3.3: Manager Assigns Assessment
 *
 * Dialog for managers/admins to assign or reassign assessments to users.
 * Shows dropdown with user names and current assignment counts.
 */

import { useState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface AssignAssessmentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** Assessment ID to assign */
  assessmentId: string;
  /** Assessment subject for display */
  assessmentSubject: string;
  /** Current assignee ID (if any) */
  currentAssigneeId: string | null;
  /** Callback when assignment is successful */
  onSuccess?: () => void;
}

export function AssignAssessmentDialog({
  open,
  onOpenChange,
  assessmentId,
  assessmentSubject,
  currentAssigneeId,
  onSuccess,
}: AssignAssessmentDialogProps) {
  const utils = api.useUtils();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch assignable users when dialog opens
  const { data: users, isLoading: isLoadingUsers } =
    api.riskAssessmentProject.getAssignableUsers.useQuery(undefined, {
      enabled: open,
    });

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedUserId(currentAssigneeId);
    }
  }, [open, currentAssigneeId]);

  // Assign mutation
  const assignMutation = api.riskAssessmentProject.assign.useMutation({
    onSuccess: (result) => {
      toast.success(`Assessment assigned to ${result.assigneeName}`);
      // Invalidate the list query to refresh
      void utils.riskAssessmentProject.list.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign assessment");
    },
  });

  const handleAssign = () => {
    if (!selectedUserId) {
      toast.error("Please select a user to assign");
      return;
    }

    assignMutation.mutate({
      id: assessmentId,
      assigneeId: selectedUserId,
    });
  };

  const selectedUser = users?.find((u) => u.id === selectedUserId);
  const isReassignment = currentAssigneeId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {isReassignment ? "Reassign Assessment" : "Assign Assessment"}
          </DialogTitle>
          <DialogDescription>
            {isReassignment
              ? "Select a different user to assign this assessment to."
              : "Select a user to assign this assessment to."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Assessment info */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm font-medium">{assessmentSubject}</p>
          </div>

          {/* User selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assign to</label>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedUserId || undefined}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>{user.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {user.assignmentCount} assigned
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Capacity warning */}
          {selectedUser && selectedUser.assignmentCount >= 5 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">High workload warning</p>
              <p className="mt-1">
                {selectedUser.name} already has {selectedUser.assignmentCount}{" "}
                assessments in progress.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              !selectedUserId ||
              selectedUserId === currentAssigneeId ||
              assignMutation.isPending
            }
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {isReassignment ? "Reassign" : "Assign"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
