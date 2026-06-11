"use client";

/**
 * Step 6: Review & Generate (Polymorphic Engagement rework).
 *
 * Summarizes the engagement, embeds the exploitation-pathways panel, and offers
 * a "Generate report →" CTA that calls `markDelivered({ id })` then routes to
 * the deliverable matching the wrapped assessment's kind:
 *   COMPLIANCE → /deliverables/compliance/{assessmentId}
 *   MATURITY   → /deliverables/maturity/{assessmentId}
 *   RISK       → /deliverables/risk/{assessmentId}
 *   VENDOR/BIA → no deliverable body yet → "Deliverable coming soon" (disabled).
 *
 * Scoring/roll-up lives in the wrapped assessment; this step does not recompute.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";
import { StatTile } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { InfoCallout } from "../InfoCallout";
import { EngagementPathways } from "../EngagementPathways";
import type { AssessmentKind, EngagementDetail } from "../types";

interface Props {
  engagement: EngagementDetail;
  readOnly?: boolean;
}

const KIND_LABELS: Record<AssessmentKind, string> = {
  COMPLIANCE: "Compliance",
  MATURITY: "Maturity",
  RISK: "Risk",
  VENDOR: "Vendor (TPRM)",
  BIA: "Business Impact",
};

/**
 * The exec-summary lives INSIDE the assessment as its "Executive Summary" tab
 * (e.g. /compliance/assessments/[id]), not a standalone /deliverables route.
 * null = no deliverable body yet (VENDOR/BIA pending).
 */
function summaryHref(kind: AssessmentKind, assessmentId: string): string | null {
  switch (kind) {
    case "COMPLIANCE":
      return `/compliance/assessments/${assessmentId}`;
    case "MATURITY":
      return `/maturity/${assessmentId}/summary`;
    case "RISK":
      return `/risk-assessments/${assessmentId}/summary`;
    default:
      return null;
  }
}

export function Step6Review({ engagement, readOnly }: Props) {
  const router = useRouter();
  const kind = engagement.assessmentKind;
  const linked = engagement.linkedAssessment;

  const markDelivered = api.engagement.markDelivered.useMutation();

  const deliverableHref = linked?.id ? summaryHref(kind, linked.id) : null;
  const hasDeliverable = Boolean(deliverableHref);

  const canGenerate = Boolean(linked?.id) && hasDeliverable;

  async function handleGenerate() {
    if (!deliverableHref) return;
    try {
      await markDelivered.mutateAsync({ id: engagement.id });
    } catch {
      // Surfaced via markDelivered.error below; do not navigate on failure.
      return;
    }
    router.push(deliverableHref);
  }

  return (
    <div className="space-y-6">
      <InfoCallout>
        Roll up the engagement and generate the client deliverable. No scores are
        recomputed here — this reads the wrapped {KIND_LABELS[kind].toLowerCase()}{" "}
        assessment.
      </InfoCallout>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Wrapped assessment"
          value={KIND_LABELS[kind]}
          sub={linked ? linked.name : "Unavailable"}
          tone="primary"
        />
        <StatTile
          label="Assessment status"
          value={linked?.status ?? "—"}
          sub="From linked assessment"
        />
        <StatTile
          label="In-scope domains"
          value={`${engagement.inScopeDomains.length}`}
          sub="Planned for fieldwork"
        />
        <StatTile
          label="Stakeholders"
          value={`${engagement.stakeholders.length}`}
          sub="On the RACI"
        />
      </div>

      {/* Generate CTA */}
      <Card className="border-primary/40 bg-primary/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="eyebrow">Generate the deliverable</p>
            </div>
            <h3 className="text-lg font-semibold">
              {KIND_LABELS[kind]} assessment report
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasDeliverable
                ? "Compile the wrapped assessment into the client-ready deliverable."
                : "A deliverable body for this assessment kind is coming soon."}
            </p>
            {!linked ? (
              <p className="mt-2 text-xs text-destructive">
                The wrapped assessment could not be resolved.
              </p>
            ) : null}
            {markDelivered.error ? (
              <p className="mt-2 text-xs text-destructive">
                {markDelivered.error.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {linked?.href ? (
              <Button variant="ghost" asChild>
                <Link href={linked.href}>
                  Open assessment
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {hasDeliverable ? (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || markDelivered.isPending || readOnly}
              >
                {markDelivered.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate report →
              </Button>
            ) : (
              <Button disabled>Deliverable coming soon</Button>
            )}
          </div>
        </div>

        {readOnly && deliverableHref ? (
          <p className="mt-4 border-t border-primary/20 pt-3 text-xs text-muted-foreground">
            This engagement is already delivered. Re-open the deliverable:{" "}
            <Link href={deliverableHref} className="text-primary hover:underline">
              view report →
            </Link>
          </p>
        ) : null}
      </Card>

      {/* Exploitation pathways */}
      {linked?.id ? (
        <EngagementPathways
          assessmentKind={kind}
          assessmentId={engagement.assessmentId}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  );
}
