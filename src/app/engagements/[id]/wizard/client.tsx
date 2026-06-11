"use client";

/**
 * Engagement Wizard client shell (Epic 18 — Stories 18.2–18.7).
 *
 * Loads the engagement via `api.engagement.getById`, renders the sticky 6-step
 * rail + the active step component, and drives phase advance through
 * `api.engagement.update({ id, phase })`. The current step always tracks the
 * persisted `engagement.phase`, so a reload restores the correct step.
 *
 * When `status === "DELIVERED"` the wizard renders read-only (no phase writes).
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { ASSESSMENT_PHASES } from "@/lib/engagement/assessment-methodology";

const KIND_LABELS: Record<string, string> = {
  COMPLIANCE: "Compliance assessment",
  MATURITY: "Maturity assessment",
  RISK: "Risk assessment",
  VENDOR: "Vendor (TPRM) assessment",
  BIA: "Business impact assessment",
};

import { StepRail } from "@/components/engagement/StepRail";
import { WizardFooterNav } from "@/components/engagement/WizardFooterNav";
import { PHASE_ORDER, type EngagementDetail, type EngagementPhase } from "@/components/engagement/types";

import { Step1Scope } from "@/components/engagement/steps/Step1Scope";
import { Step2Schedule } from "@/components/engagement/steps/Step2Schedule";
import { Step3Stakeholders } from "@/components/engagement/steps/Step3Stakeholders";
import { Step4Evidence } from "@/components/engagement/steps/Step4Evidence";
import { Step5Interviews } from "@/components/engagement/steps/Step5Interviews";
import { Step6Review } from "@/components/engagement/steps/Step6Review";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  SCOPING: "outline",
  SCHEDULED: "secondary",
  FIELDWORK: "secondary",
  REVIEW: "secondary",
  DELIVERED: "default",
};

export function EngagementWizardClient({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const utils = api.useUtils();

  const engagementQuery = api.engagement.getById.useQuery({ id: engagementId });

  const updateMutation = api.engagement.update.useMutation({
    onSuccess: () => {
      void utils.engagement.getById.invalidate({ id: engagementId });
    },
  });

  if (engagementQuery.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading engagement…
        </div>
      </AppLayout>
    );
  }

  if (engagementQuery.error || !engagementQuery.data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-medium">Engagement not found</p>
          <p className="mb-4 text-sm text-muted-foreground">
            It may have been removed or you may not have access.
          </p>
          <Button variant="outline" asChild>
            <Link href="/engagements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to engagements
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const engagement = engagementQuery.data as unknown as EngagementDetail;
  const phase = engagement.phase;
  const readOnly = engagement.status === "DELIVERED";
  const kindLabel =
    KIND_LABELS[engagement.assessmentKind] ?? engagement.assessmentKind;
  const activePhaseDef = ASSESSMENT_PHASES.find((p) => p.id === phase);

  // Step 1 gate: the wrapped assessment must still resolve before leaving Setup.
  const hasLinkedAssessment = Boolean(engagement.linkedAssessment?.id);

  function goToPhase(next: EngagementPhase) {
    if (readOnly || next === phase) return;
    updateMutation.mutate({ id: engagementId, phase: next });
  }

  function handleBack() {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx > 0) goToPhase(PHASE_ORDER[idx - 1]!);
  }

  function handleContinue() {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx < PHASE_ORDER.length - 1) {
      goToPhase(PHASE_ORDER[idx + 1]!);
    }
    // On the last step ("review") Continue is "Finish & view report"; the
    // Step6Review GenerateCard owns the navigate + markDelivered, so there is
    // nothing to advance here.
  }

  const continueDisabled = readOnly || (phase === "setup" && !hasLinkedAssessment);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Engagement · {engagement.identifier}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {engagement.clientName || "Untitled engagement"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kindLabel}
            {activePhaseDef ? ` · ${activePhaseDef.title}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[engagement.status] ?? "secondary"}>
            {engagement.status}
          </Badge>
          {readOnly ? (
            <Badge variant="outline">Read-only</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <StepRail
            current={phase}
            onSelect={readOnly ? undefined : goToPhase}
            disabled={updateMutation.isPending}
          />
        </aside>

        <section className="min-w-0">
          {phase === "setup" ? (
            <Step1Scope engagement={engagement} readOnly={readOnly} />
          ) : phase === "schedule" ? (
            <Step2Schedule engagement={engagement} readOnly={readOnly} />
          ) : phase === "stakeholders" ? (
            <Step3Stakeholders engagement={engagement} readOnly={readOnly} />
          ) : phase === "evidence" ? (
            <Step4Evidence engagement={engagement} readOnly={readOnly} />
          ) : phase === "interviews" ? (
            <Step5Interviews engagement={engagement} readOnly={readOnly} />
          ) : (
            <Step6Review engagement={engagement} readOnly={readOnly} />
          )}

          <WizardFooterNav
            current={phase}
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={continueDisabled}
            pending={updateMutation.isPending}
          />
        </section>
      </div>
    </AppLayout>
  );
}
