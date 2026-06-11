"use client";

/**
 * Wizard footer nav (Epic 18 — Story 18.2).
 *
 * Back / step-counter / Continue. On the last step Continue becomes
 * "Finish & view report". Back is disabled on step 1.
 */

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PHASE_ORDER, type EngagementPhase } from "./types";

interface WizardFooterNavProps {
  current: EngagementPhase;
  onBack: () => void;
  onContinue: () => void;
  /** When true, Continue is blocked (e.g. no linked assessment). */
  continueDisabled?: boolean;
  pending?: boolean;
}

export function WizardFooterNav({
  current,
  onBack,
  onContinue,
  continueDisabled,
  pending,
}: WizardFooterNavProps) {
  const idx = PHASE_ORDER.indexOf(current);
  const isFirst = idx <= 0;
  const isLast = idx === PHASE_ORDER.length - 1;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
      <Button
        variant="outline"
        onClick={onBack}
        disabled={isFirst || pending}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <span className="eyebrow">
        Step {idx + 1} of {PHASE_ORDER.length}
      </span>

      <Button onClick={onContinue} disabled={continueDisabled || pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {isLast ? "Finish & view report" : "Continue"}
        {!isLast && !pending ? (
          <ArrowRight className="ml-2 h-4 w-4" />
        ) : null}
      </Button>
    </div>
  );
}
