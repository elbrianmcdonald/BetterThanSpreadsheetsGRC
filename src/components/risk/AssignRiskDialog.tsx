"use client";

/**
 * Assign Risk Dialog Component
 *
 * Modal dialog for assigning IT and Business owners to a risk.
 *
 * Story 4.6: Risk Ownership Assignment (Task 5)
 * - AC19: Risk detail page has "Assign Risk" button
 * - AC20: Clicking button opens assignment dialog
 * - AC21: Dialog includes two searchable user dropdowns
 * - AC22: IT Owner dropdown filtered to IT_STAKEHOLDER role
 * - AC23: Business Owner dropdown filtered to BUSINESS_STAKEHOLDER role
 * - AC24: Dropdowns show user: name, email, and workload
 * - AC25: Dialog validates at least one owner selected
 *
 * @see Story 4.6: Risk Ownership Assignment
 */

import { useState } from "react";
import { Loader2, Check, ChevronsUpDown, User } from "lucide-react";

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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  /** Current IT owner ID (for reassignment) */
  currentITOwnerId?: string | null;
  /** Current Business owner ID (for reassignment) */
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
  // State for selected owners
  const [selectedITOwner, setSelectedITOwner] = useState<string | null>(
    currentITOwnerId ?? null
  );
  const [selectedBusinessOwner, setSelectedBusinessOwner] = useState<string | null>(
    currentBusinessOwnerId ?? null
  );

  // State for dropdown open/close
  const [itOwnerOpen, setItOwnerOpen] = useState(false);
  const [businessOwnerOpen, setBusinessOwnerOpen] = useState(false);

  // Fetch IT Stakeholders with workload
  const { data: itStakeholders, isLoading: loadingIT } =
    api.user.listUsersWithWorkload.useQuery(
      { role: "IT_STAKEHOLDER" },
      { enabled: open }
    );

  // Fetch Business Stakeholders with workload
  const { data: businessStakeholders, isLoading: loadingBusiness } =
    api.user.listUsersWithWorkload.useQuery(
      { role: "BUSINESS_STAKEHOLDER" },
      { enabled: open }
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

  // Get initials for avatar fallback
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Find selected user objects for display
  const selectedITOwnerData = itStakeholders?.find(
    (u) => u.id === selectedITOwner
  );
  const selectedBusinessOwnerData = businessStakeholders?.find(
    (u) => u.id === selectedBusinessOwner
  );

  // Handle form submission
  const handleSubmit = () => {
    // AC25: Validate at least one owner selected
    if (!selectedITOwner && !selectedBusinessOwner) {
      toast.error("Please select at least one owner (IT or Business)");
      return;
    }

    if (isReassign) {
      reassignMutation.mutate({
        riskId,
        itOwnerId: selectedITOwner,
        businessOwnerId: selectedBusinessOwner,
      });
    } else {
      assignMutation.mutate({
        riskId,
        itOwnerId: selectedITOwner ?? undefined,
        businessOwnerId: selectedBusinessOwner ?? undefined,
      });
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedITOwner(currentITOwnerId ?? null);
      setSelectedBusinessOwner(currentBusinessOwnerId ?? null);
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

          {/* IT Owner Selection (AC22) */}
          <div className="space-y-2">
            <Label>IT Owner (Technical Remediation)</Label>
            <Popover open={itOwnerOpen} onOpenChange={setItOwnerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={itOwnerOpen}
                  className="w-full justify-between"
                  disabled={loadingIT}
                >
                  {loadingIT ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : selectedITOwnerData ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedITOwnerData.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedITOwnerData.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedITOwnerData.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {selectedITOwnerData.assignedRiskCount} assigned
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Select IT Stakeholder...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search IT stakeholders..." />
                  <CommandList>
                    <CommandEmpty>No IT stakeholders found.</CommandEmpty>
                    <CommandGroup>
                      {/* Option to clear selection */}
                      {selectedITOwner && (
                        <CommandItem
                          value="__clear__"
                          onSelect={() => {
                            setSelectedITOwner(null);
                            setItOwnerOpen(false);
                          }}
                          className="text-muted-foreground"
                        >
                          <span>Clear selection</span>
                        </CommandItem>
                      )}
                      {itStakeholders?.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => {
                            setSelectedITOwner(user.id);
                            setItOwnerOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image ?? undefined} />
                              <AvatarFallback>
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {user.name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {user.email}
                              </div>
                            </div>
                            {/* AC24 & AC32: Show workload */}
                            <Badge
                              variant={
                                user.assignedRiskCount === 0
                                  ? "secondary"
                                  : user.assignedRiskCount > 5
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {user.assignedRiskCount} assigned
                            </Badge>
                            {selectedITOwner === user.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {!itStakeholders?.length && !loadingIT && (
              <p className="text-xs text-muted-foreground">
                No users with IT_STAKEHOLDER role in your organization.
              </p>
            )}
          </div>

          {/* Business Owner Selection (AC23) */}
          <div className="space-y-2">
            <Label>Business Owner (Business Decisions)</Label>
            <Popover open={businessOwnerOpen} onOpenChange={setBusinessOwnerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={businessOwnerOpen}
                  className="w-full justify-between"
                  disabled={loadingBusiness}
                >
                  {loadingBusiness ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : selectedBusinessOwnerData ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedBusinessOwnerData.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedBusinessOwnerData.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedBusinessOwnerData.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {selectedBusinessOwnerData.assignedRiskCount} assigned
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Select Business Stakeholder...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search business stakeholders..." />
                  <CommandList>
                    <CommandEmpty>No business stakeholders found.</CommandEmpty>
                    <CommandGroup>
                      {/* Option to clear selection */}
                      {selectedBusinessOwner && (
                        <CommandItem
                          value="__clear__"
                          onSelect={() => {
                            setSelectedBusinessOwner(null);
                            setBusinessOwnerOpen(false);
                          }}
                          className="text-muted-foreground"
                        >
                          <span>Clear selection</span>
                        </CommandItem>
                      )}
                      {businessStakeholders?.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => {
                            setSelectedBusinessOwner(user.id);
                            setBusinessOwnerOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.image ?? undefined} />
                              <AvatarFallback>
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {user.name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {user.email}
                              </div>
                            </div>
                            {/* AC24 & AC32: Show workload */}
                            <Badge
                              variant={
                                user.assignedRiskCount === 0
                                  ? "secondary"
                                  : user.assignedRiskCount > 5
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {user.assignedRiskCount} assigned
                            </Badge>
                            {selectedBusinessOwner === user.id && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {!businessStakeholders?.length && !loadingBusiness && (
              <p className="text-xs text-muted-foreground">
                No users with BUSINESS_STAKEHOLDER role in your organization.
              </p>
            )}
          </div>

          {/* Validation message */}
          {!selectedITOwner && !selectedBusinessOwner && (
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
            disabled={isPending || (!selectedITOwner && !selectedBusinessOwner)}
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
