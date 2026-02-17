"use client";

/**
 * Finding Actions Component
 *
 * Story 7.3: Finding Triage Workflow (AC13-AC17)
 * Story 7.4: Finding Acceptance (AC21-AC25)
 *
 * Displays action buttons for transitioning findings based on current status:
 * - AC14: NEW status shows: "Mark Triaged", "Needs Info", "Mark Duplicate", "Reject"
 * - AC15: NEEDS_INFO status shows: "Mark Triaged"
 * - AC16/7.4: TRIAGED status shows: "Accept Finding" - uses accept mutation to create Risk Assessment
 * - AC17: Terminal states (DUPLICATE, REJECTED, ACCEPTED) show no transition buttons
 * - AC29-AC30: Only SecurityOrg role members can triage findings
 *
 * @see Story 7.3: Finding Triage Workflow
 * @see Story 7.4: Finding Acceptance (Creates Risk Assessment)
 */

import { useState } from "react";
import { FindingStatus, UserRole, type Severity } from "@prisma/client";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { getFindingActionConfigs } from "@/server/services/findingStateMachine";
import { DuplicateFinderModal } from "./DuplicateFinderModal";
import { RejectFindingDialog } from "./RejectFindingDialog";

/**
 * Roles that can triage findings (AC29)
 */
const FINDING_TRIAGE_ROLES: UserRole[] = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

/**
 * Finding data structure for this component
 */
interface FindingData {
  id: string;
  identifier: string;
  title: string;
  status: FindingStatus;
  severity: Severity;
}

interface FindingActionsProps {
  /** The finding to display actions for */
  finding: FindingData;
  /** Current user's role */
  userRole: UserRole;
  /** Callback when a transition completes successfully */
  onTransitionComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays action buttons for finding status transitions.
 *
 * @example
 * ```tsx
 * <FindingActions
 *   finding={finding}
 *   userRole={session.user.role}
 *   onTransitionComplete={() => refetch()}
 * />
 * ```
 */
export function FindingActions({
  finding,
  userRole,
  onTransitionComplete,
  className,
}: FindingActionsProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<FindingStatus | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  // AC30: Check if user has permission to triage
  const canTriage = FINDING_TRIAGE_ROLES.includes(userRole);

  // Get available actions for current status
  const actionConfigs = getFindingActionConfigs(finding.status);

  // Transition mutation (for all statuses except ACCEPTED)
  const transitionMutation = api.finding.transition.useMutation({
    onSuccess: () => {
      toast.success("Finding status updated successfully");
      onTransitionComplete?.();
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
    onSettled: () => {
      setIsTransitioning(false);
      setTransitionTarget(null);
    },
  });

  // Story 7.4: Accept mutation (creates Risk Assessment)
  const acceptMutation = api.finding.accept.useMutation({
    onSuccess: (data) => {
      // AC24: Success toast with assessment identifier
      toast.success(
        `Finding accepted. Risk Assessment ${data.assessment.identifier} created.`
      );
      onTransitionComplete?.();
    },
    onError: (error) => {
      toast.error(`Failed to accept finding: ${error.message}`);
    },
    onSettled: () => {
      setIsTransitioning(false);
      setTransitionTarget(null);
    },
  });

  // Handle direct transition (no modal required)
  const handleDirectTransition = async (targetStatus: FindingStatus) => {
    setIsTransitioning(true);
    setTransitionTarget(targetStatus);

    // Story 7.4: Use accept mutation for ACCEPTED status
    if (targetStatus === FindingStatus.ACCEPTED) {
      acceptMutation.mutate({ findingId: finding.id });
    } else {
      transitionMutation.mutate({
        findingId: finding.id,
        targetStatus,
      });
    }
  };

  // Handle duplicate selection from modal
  const handleDuplicateSelect = async (duplicateOfId: string) => {
    setIsTransitioning(true);
    setTransitionTarget(FindingStatus.DUPLICATE);
    setIsDuplicateModalOpen(false);

    transitionMutation.mutate({
      findingId: finding.id,
      targetStatus: FindingStatus.DUPLICATE,
      duplicateOfId,
    });
  };

  // Handle rejection with optional reason
  const handleReject = async (reason?: string) => {
    setIsTransitioning(true);
    setTransitionTarget(FindingStatus.REJECTED);
    setIsRejectDialogOpen(false);

    transitionMutation.mutate({
      findingId: finding.id,
      targetStatus: FindingStatus.REJECTED,
      rejectionReason: reason,
    });
  };

  // Handle action button click
  const handleActionClick = (targetStatus: FindingStatus, requiresModal: boolean, modalType?: "duplicate" | "rejection" | null) => {
    if (requiresModal) {
      if (modalType === "duplicate") {
        setIsDuplicateModalOpen(true);
      } else if (modalType === "rejection") {
        setIsRejectDialogOpen(true);
      }
    } else {
      handleDirectTransition(targetStatus);
    }
  };

  // AC17: Terminal states show no transition buttons
  // AC30: Hide buttons for unauthorized roles
  if (!canTriage || actionConfigs.length === 0) {
    return null;
  }

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap gap-2">
          {actionConfigs.map((action) => {
            const isLoading = isTransitioning && transitionTarget === action.targetStatus;

            return (
              <Button
                key={action.targetStatus}
                variant={action.variant}
                size="sm"
                disabled={isTransitioning}
                onClick={() => handleActionClick(action.targetStatus, action.requiresModal, action.modalType)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Duplicate Finder Modal (AC19-AC22) */}
      <DuplicateFinderModal
        open={isDuplicateModalOpen}
        onOpenChange={setIsDuplicateModalOpen}
        currentFindingId={finding.id}
        onSelect={handleDuplicateSelect}
      />

      {/* Rejection Dialog (AC23-AC25) */}
      <RejectFindingDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        findingIdentifier={finding.identifier}
        findingTitle={finding.title}
        onConfirm={handleReject}
      />
    </>
  );
}
