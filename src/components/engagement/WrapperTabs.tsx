"use client";

/**
 * Shared consulting "wrapper tab" helpers.
 *
 * These pieces were originally inlined in the compliance assessment workspace
 * (`src/app/compliance/assessments/[id]/client.tsx`). They are extracted here so
 * every assessment workspace (Compliance, Risk, Vendor, Maturity, BIA) can reuse
 * the same Schedule / Stakeholders / Evidence / Exploitation-Pathways /
 * Action-Plans tabs that wrap an assessment inside a consulting engagement.
 *
 * Nothing here hardcodes "COMPLIANCE" — callers pass `assessmentKind`.
 */

import {
  Calendar,
  Users,
  FolderOpen,
  Network,
  ListChecks,
  Loader2,
  Play,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Step2Schedule } from "@/components/engagement/steps/Step2Schedule";
import { Step3Stakeholders } from "@/components/engagement/steps/Step3Stakeholders";
import { Step4Evidence } from "@/components/engagement/steps/Step4Evidence";
import { EngagementPathways } from "@/components/engagement/EngagementPathways";
import { ActionPlansPanel } from "@/components/actionplan/ActionPlansPanel";
import type { AssessmentKind, EngagementDetail } from "@/components/engagement/types";

// =============================================================================
// Tab definitions
// =============================================================================

/** The id of a consulting "wrapper" tab. */
export type WrapperTabId =
  | "schedule"
  | "stakeholders"
  | "evidence"
  | "pathways"
  | "action-plans";

/**
 * The five consulting wrapper tabs, in canonical order. Each workspace can
 * splice these into its own TABS array wherever appropriate.
 */
export const WRAPPER_TAB_DEFS: Array<{
  id: WrapperTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "stakeholders", label: "Stakeholders", icon: Users },
  { id: "evidence", label: "Evidence", icon: FolderOpen },
  { id: "pathways", label: "Exploitation Pathways", icon: Network },
  { id: "action-plans", label: "Action Plans", icon: ListChecks },
];

// =============================================================================
// Start-engagement empty state
// =============================================================================

/**
 * Empty-state shown on the Schedule/Stakeholders/Evidence tabs when no
 * consulting engagement wraps this assessment yet. Offers an explicit
 * "Start consulting engagement" action.
 */
export function StartEngagementCard({
  assessmentKind,
  assessmentId,
  clientName,
  onStarted,
}: {
  assessmentKind: AssessmentKind;
  assessmentId: string;
  clientName: string;
  onStarted: () => void;
}) {
  const createMutation = api.engagement.create.useMutation({
    onSuccess: () => {
      toast.success("Consulting engagement started");
      onStarted();
    },
    onError: (e) => {
      toast.error(`Failed to start engagement: ${e.message}`);
    },
  });

  return (
    <div className="flex justify-center py-12">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-base">No consulting engagement yet</CardTitle>
          <CardDescription>
            Start a consulting engagement to plan the schedule, stakeholders,
            and evidence for this assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() =>
              createMutation.mutate({
                assessmentKind,
                assessmentId,
                clientName,
              })
            }
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start consulting engagement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Engagement-gated step tab (Schedule / Stakeholders / Evidence)
// =============================================================================

/**
 * Wrapper-tab content (Schedule / Stakeholders / Evidence). Gated on an
 * engagement existing: if none, render the start-engagement empty state;
 * otherwise fetch the full engagement detail and render the requested step.
 */
export function EngagementStepTab({
  step,
  assessmentKind,
  assessmentId,
  clientName,
}: {
  step: "schedule" | "stakeholders" | "evidence";
  assessmentKind: AssessmentKind;
  assessmentId: string;
  clientName: string;
}) {
  const utils = api.useUtils();
  const summaryQuery = api.engagement.getByAssessment.useQuery({
    assessmentKind,
    assessmentId,
  });

  const engagementSummary = summaryQuery.data ?? null;

  const detailQuery = api.engagement.getById.useQuery(
    { id: engagementSummary?.id ?? "" },
    { enabled: !!engagementSummary?.id },
  );

  const refetchAll = () => {
    void utils.engagement.getByAssessment.invalidate({
      assessmentKind,
      assessmentId,
    });
  };

  if (summaryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!engagementSummary) {
    return (
      <StartEngagementCard
        assessmentKind={assessmentKind}
        assessmentId={assessmentId}
        clientName={clientName}
        onStarted={refetchAll}
      />
    );
  }

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // `getById`'s result matches EngagementDetail (sessions/stakeholders/
  // evidenceRequests/linkedAssessment) — same cast the wizard uses.
  const engagement = detailQuery.data as unknown as EngagementDetail;

  if (step === "schedule") return <Step2Schedule engagement={engagement} />;
  if (step === "stakeholders") return <Step3Stakeholders engagement={engagement} />;
  return <Step4Evidence engagement={engagement} />;
}

// =============================================================================
// Unified panel dispatcher
// =============================================================================

/**
 * Renders the correct panel for a given wrapper-tab id. Returns null for any
 * id that is not one of the five wrapper tabs (so non-wrapper tabs fall through
 * to the host workspace's own rendering).
 */
export function WrapperTabPanel({
  tab,
  assessmentKind,
  assessmentId,
  clientName,
  readOnly,
}: {
  tab: string;
  assessmentKind: AssessmentKind;
  assessmentId: string;
  clientName: string;
  readOnly?: boolean;
}) {
  if (tab === "schedule" || tab === "stakeholders" || tab === "evidence") {
    return (
      <EngagementStepTab
        step={tab}
        assessmentKind={assessmentKind}
        assessmentId={assessmentId}
        clientName={clientName}
      />
    );
  }

  if (tab === "pathways") {
    return (
      <EngagementPathways
        assessmentKind={assessmentKind}
        assessmentId={assessmentId}
        readOnly={readOnly}
      />
    );
  }

  if (tab === "action-plans") {
    // ActionPlansPanel currently narrows assessmentKind to "COMPLIANCE" | "MATURITY";
    // cast through to satisfy its prop type while keeping this dispatcher generic.
    return (
      <ActionPlansPanel
        assessmentKind={assessmentKind as "COMPLIANCE" | "MATURITY"}
        assessmentId={assessmentId}
      />
    );
  }

  return null;
}
