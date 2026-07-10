"use client";

/**
 * Finding Actions Component
 *
 * Story 7.3: Finding Triage Workflow (AC13-AC17)
 * Story 21.2: "Link to Risk" replaces the legacy "Accept Finding" promotion —
 * findings attach to register risks (RiskFindingLink); they never become risks.
 *
 * Displays action buttons for transitioning findings based on current status:
 * - AC14: NEW status shows: "Mark Triaged", "Needs Info", "Mark Duplicate", "Reject"
 * - AC15: NEEDS_INFO status shows: "Mark Triaged"
 * - Story 21.2: non-terminal statuses also show "Link to Risk"
 * - AC17: Terminal states (DUPLICATE, REJECTED, CLOSED) show no buttons
 * - AC29-AC30: Only SecurityOrg role members can triage findings
 *
 * @see Story 7.3: Finding Triage Workflow
 * @see Story 21.2: Link a Finding to a Risk (Replaces "Accept")
 */

import { useState } from "react";
import { FindingStatus, UserRole, type Severity } from "@prisma/client";
import { Loader2, Link2 } from "lucide-react";
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
  getFindingActionConfigs,
  isTerminalFindingStatus,
} from "@/server/services/findingStateMachine";
import { DuplicateFinderModal } from "./DuplicateFinderModal";
import { RejectFindingDialog } from "./RejectFindingDialog";
import { LinkFindingToRiskDialog } from "./LinkFindingToRiskDialog";

/**
 * Roles that can triage findings (AC29)
 */
const FINDING_TRIAGE_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
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
  /** Risk ids already linked to this finding (Story 21.2 dialog exclusions) */
  linkedRiskIds?: string[];
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
  linkedRiskIds = [],
  onTransitionComplete,
  className,
}: FindingActionsProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<FindingStatus | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  // Story 21.2: Link to Risk dialog (replaces Accept)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  // Story 21.4: nudge before closing a finding with zero risk links (FR5 —
  // linking is recommended, never required)
  const [isCloseNudgeOpen, setIsCloseNudgeOpen] = useState(false);

  // AC30: Check if user has permission to triage
  const canTriage = FINDING_TRIAGE_ROLES.includes(userRole);

  // Get available actions for current status
  const actionConfigs = getFindingActionConfigs(finding.status);
  const isTerminal = isTerminalFindingStatus(finding.status);

  // Transition mutation
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

  // Handle direct transition (no modal required). Story 21.2: findings link
  // to risks instead of promoting into them.
  const handleDirectTransition = async (targetStatus: FindingStatus) => {
    setIsTransitioning(true);
    setTransitionTarget(targetStatus);

    transitionMutation.mutate({
      findingId: finding.id,
      targetStatus,
    });
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
    } else if (
      targetStatus === FindingStatus.CLOSED &&
      linkedRiskIds.length === 0
    ) {
      // Story 21.4: non-blocking nudge — the close still succeeds if confirmed
      setIsCloseNudgeOpen(true);
    } else {
      handleDirectTransition(targetStatus);
    }
  };

  // AC17: Terminal states show no buttons at all
  // AC30: Hide buttons for unauthorized roles
  if (!canTriage || isTerminal) {
    return null;
  }

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap gap-2">
          {/* Story 21.2: Link to Risk — the primary triage outcome */}
          <Button
            variant="default"
            size="sm"
            disabled={isTransitioning}
            onClick={() => setIsLinkDialogOpen(true)}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Link to Risk
          </Button>
          {actionConfigs.map((action) => {
            const isLoading = isTransitioning && transitionTarget === action.targetStatus;

            return (
              <Button
                key={action.targetStatus}
                variant={action.variant === "default" ? "secondary" : action.variant}
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

      {/* Story 21.2: Link to Risk dialog */}
      <LinkFindingToRiskDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        findingId={finding.id}
        findingIdentifier={finding.identifier}
        linkedRiskIds={linkedRiskIds}
        onLinked={onTransitionComplete}
      />

      {/* Story 21.4: close-without-links nudge (non-blocking) */}
      <Dialog open={isCloseNudgeOpen} onOpenChange={setIsCloseNudgeOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>No linked risk — link one?</DialogTitle>
            <DialogDescription>
              This finding isn&apos;t linked to any risk. Linking is
              recommended so the exposure it evidences stays visible in the
              risk register — but you can close it without one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCloseNudgeOpen(false);
                setIsLinkDialogOpen(true);
              }}
            >
              Link to Risk first
            </Button>
            <Button
              onClick={() => {
                setIsCloseNudgeOpen(false);
                handleDirectTransition(FindingStatus.CLOSED);
              }}
            >
              Close anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
