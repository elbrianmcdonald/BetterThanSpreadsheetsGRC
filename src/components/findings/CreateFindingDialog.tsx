"use client";

/**
 * "Create Finding" dialog.
 *
 * Modal chrome around the one real finding form (CreateFindingForm — the same
 * component served at /findings/new). This file owns the dialog, the context
 * chip, and the scroll container; it owns no form logic. Spawned from compliance
 * assessments, maturity assessments, and TPRM questionnaire responses, each of
 * which passes its own linkage ids straight through to finding.create.
 *
 * Prior to 2026-07-14 this was a separate, much leaner form (title/description/
 * source/severity only). It drifted from /findings/new and was replaced.
 */

import { toast } from "sonner";
import Link from "next/link";
import type { FindingSource } from "@prisma/client";
import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";

export interface CreateFindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled title (e.g. "AC-1 — Access Control Policy"). Title only — the
   *  risk statement is deliberately left blank for the user to write. */
  initialTitle?: string;
  /** Preselected source: AUDIT from assessments, MANUAL from vendor questionnaires. */
  initialSource?: FindingSource;
  /** Small chip shown above the form, e.g. "Spawned from GV — Govern". */
  contextLabel?: string;
  /** Linkage — set by the caller based on where the dialog was opened. */
  controlId?: string;
  complianceAssessmentId?: string;
  maturityAssessmentId?: string;
  maturityDomainId?: string;
  questionnaireResponseId?: string;
  /** Extra cache invalidation for the host page, after the shared ones run. */
  onCreated?: () => void;
}

export function CreateFindingDialog(props: CreateFindingDialogProps) {
  const utils = api.useUtils();

  const handleCreated = (finding: { id: string; identifier: string }) => {
    toast.success(
      <span>
        Finding <strong>{finding.identifier}</strong> created —{" "}
        <Link href={`/findings/${finding.id}`} className="underline" target="_blank">
          open
        </Link>
      </span>
    );

    // Refresh the "Findings from this assessment" list in-place.
    if (props.complianceAssessmentId) {
      void utils.finding.listForAssessment.invalidate({
        assessmentId: props.complianceAssessmentId,
        assessmentType: "COMPLIANCE",
      });
    }
    if (props.maturityAssessmentId) {
      void utils.finding.listForAssessment.invalidate({
        assessmentId: props.maturityAssessmentId,
        assessmentType: "MATURITY",
      });
    }
    void utils.finding.list.invalidate();
    props.onCreated?.();
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* The full finding form is tall — cap the dialog and scroll inside it. */}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create finding</DialogTitle>
          <DialogDescription>
            Capture an issue spotted during this assessment. It&apos;ll be linked
            back automatically so you can pick it up in the Findings register.
          </DialogDescription>
          {props.contextLabel ? (
            <Badge variant="secondary" className="mt-2 w-fit font-normal">
              {props.contextLabel}
            </Badge>
          ) : null}
        </DialogHeader>

        {/*
          Remount the form on each new spawn context so prefill and scoring
          state reset — CreateFindingForm seeds react-hook-form from props in
          defaultValues, which only reads on mount.
        */}
        <CreateFindingForm
          key={`${props.controlId ?? ""}:${props.maturityDomainId ?? ""}:${props.questionnaireResponseId ?? ""}:${props.initialTitle ?? ""}`}
          defaultTitle={props.initialTitle}
          defaultSource={props.initialSource}
          controlId={props.controlId}
          complianceAssessmentId={props.complianceAssessmentId}
          maturityAssessmentId={props.maturityAssessmentId}
          maturityDomainId={props.maturityDomainId}
          questionnaireResponseId={props.questionnaireResponseId}
          onCreated={handleCreated}
          onCancel={() => props.onOpenChange(false)}
          suppressSuccessToast
        />
      </DialogContent>
    </Dialog>
  );
}
