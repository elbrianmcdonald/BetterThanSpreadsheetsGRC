"use client";

/**
 * Step 5: Interviews (Polymorphic Engagement rework).
 *
 * Interviews and scoring are NATIVE to the wrapped assessment — the engagement
 * no longer owns a methodology question bank. This step is a simple hand-off:
 * an info callout plus a prominent link to the assessment where the analyst
 * conducts interviews and records scores.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClipboardList, ExternalLink } from "lucide-react";
import { InfoCallout } from "../InfoCallout";
import type { EngagementDetail } from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

const KIND_LABELS: Record<string, string> = {
  COMPLIANCE: "compliance",
  MATURITY: "maturity",
  RISK: "risk",
  VENDOR: "vendor",
  BIA: "business impact",
};

export function Step5Interviews({ engagement }: Props) {
  const linked = engagement.linkedAssessment;
  const kindLabel =
    KIND_LABELS[engagement.assessmentKind] ?? engagement.assessmentKind;

  return (
    <div className="space-y-5">
      <InfoCallout>
        Interviews and scoring happen <strong>inside the assessment</strong> —
        the engagement does not duplicate the question bank. Conduct your{" "}
        {kindLabel} interviews there; results roll up automatically into the
        deliverable.
      </InfoCallout>

      <Card className="border-primary/40 bg-primary/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="mb-1 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <p className="eyebrow">Conduct interviews</p>
            </div>
            <h3 className="text-lg font-semibold">
              {linked?.name ?? "Wrapped assessment"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the assessment to interview stakeholders, score controls and
              capture evidence. Use the schedule and stakeholder plans from the
              earlier steps to drive each session.
            </p>
            {!linked ? (
              <p className="mt-2 text-xs text-destructive">
                The wrapped assessment could not be resolved.
              </p>
            ) : null}
          </div>

          <Button asChild disabled={!linked?.href}>
            {linked?.href ? (
              <Link href={linked.href}>
                Open assessment to conduct interviews
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            ) : (
              <span>
                Open assessment to conduct interviews
                <ExternalLink className="ml-2 h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
