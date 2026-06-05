"use client";

/**
 * Question Risk Dialog
 *
 * "Add Risk" from a questionnaire question. Reuses the exact RiskItemCard from
 * the Identified Risks tab so the captured fields (threat model, controls,
 * scoring, treatment, enterprise-risk alignment) are identical. On save it
 * creates a PENDING identified risk linked to BOTH the assessment
 * (discoveryProjectId) and the source question (sourceRiskAssessmentQuestionId).
 *
 * The save sequence mirrors IdentifiedRisksEditor.handleSave for a single risk.
 */

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskItemCard } from "@/components/risk/RiskItemCard";
import type { MatrixScales, Threshold } from "@/lib/matrix";
import {
  emptyRisk,
  identifiedRisksFormSchema as formSchema,
  type IdentifiedRisksFormValues as FormValues,
} from "./identifiedRiskForm";

interface QuestionRiskDialogProps {
  questionId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a risk is successfully created. */
  onCreated: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
}

export function QuestionRiskDialog({
  questionId,
  projectId,
  open,
  onOpenChange,
  onCreated,
  defaultTitle,
  defaultDescription,
}: QuestionRiskDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const { data: project, isLoading } = api.riskAssessmentProject.getById.useQuery(
    { id: projectId },
    { enabled: open }
  );

  const { data: matrixVersion } = api.riskMatrix.getVersion.useQuery(
    { id: project?.matrixVersionId ?? "" },
    { enabled: open && !!project?.matrixVersionId }
  );

  const matrixScales = useMemo<MatrixScales | null>(
    () => (matrixVersion?.scales ? (matrixVersion.scales as MatrixScales) : null),
    [matrixVersion]
  );
  const matrixThresholds = useMemo<Threshold[]>(
    () => (matrixVersion?.thresholds ? (matrixVersion.thresholds as Threshold[]) : []),
    [matrixVersion]
  );
  const is3DMatrix = useMemo(
    () => !!matrixScales?.exposure && matrixScales.exposure.length > 0,
    [matrixScales]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { risks: [emptyRisk()] },
  });

  // Register `risks` as a field array (same as IdentifiedRisksEditor). Without
  // this the array isn't tracked and form.getValues().risks is undefined.
  const { fields } = useFieldArray({ control: form.control, name: "risks" });

  // Re-seed the single card each time the dialog opens, prefilled from the
  // question text / notes (mirrors the inline finding form behaviour).
  useEffect(() => {
    if (open) {
      form.reset({
        risks: [
          emptyRisk({
            title: defaultTitle ?? "",
            riskStatement: defaultDescription ?? "",
          }),
        ],
      });
    }
  }, [open, defaultTitle, defaultDescription, form]);

  const createRisk = api.risk.create.useMutation();
  const updateRisk = api.risk.updateRisk.useMutation();
  const createTreatment = api.risk.createTreatment.useMutation();
  const bulkLinkOrgControls = api.organizationalControl.bulkLinkToRisk.useMutation();

  const handleSave = async () => {
    // Mirror IdentifiedRisksEditor: gate on a non-empty risk statement only.
    // We deliberately don't run form.trigger() here — the matrix-scored fields
    // are read-only for non-admins (riskMatrix.getVersion is ORG_ADMIN-only),
    // and the assignee adding the risk is typically a GRC_ANALYST, so a strict
    // zod gate would block the very role allowed to add risks.
    const risk = (form.getValues().risks ?? [])[0];
    if (!risk || risk.riskStatement.trim().length === 0) {
      toast.error("A risk statement is required");
      return;
    }

    setIsSaving(true);
    try {
      const created = await createRisk.mutateAsync({
        title: risk.title || risk.riskStatement.slice(0, 80),
        description: risk.riskStatement,
        severity: "MEDIUM",
        discoveryProjectId: projectId,
        sourceRiskAssessmentQuestionId: questionId,
        enterpriseRiskId: risk.enterpriseRiskId ?? undefined,
      });
      const riskId = created.id;

      // Apply acceptance fields after create if applicable
      if (risk.treatment === "ACCEPT") {
        await updateRisk.mutateAsync({
          riskId,
          acceptanceJustification: risk.acceptanceJustification ?? null,
          acceptanceReviewDate: risk.acceptanceReviewDate ?? null,
          acceptanceCompensatingControls: risk.acceptanceCompensatingControls ?? null,
        });
      }

      if (risk.mitigatingControlIds.length > 0) {
        await bulkLinkOrgControls.mutateAsync({
          riskId,
          controlIds: risk.mitigatingControlIds,
          role: "IN_PLACE",
        });
      }
      if (risk.controlGapIds.length > 0) {
        await bulkLinkOrgControls.mutateAsync({
          riskId,
          controlIds: risk.controlGapIds,
          role: "NEEDED",
        });
      }

      if (risk.treatment) {
        let slaDays: number | undefined;
        if (risk.treatmentDueDate) {
          const diff = risk.treatmentDueDate.getTime() - new Date().getTime();
          slaDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
        await createTreatment.mutateAsync({
          riskId,
          treatmentType: risk.treatment,
          justification:
            risk.treatmentPlan ||
            `Risk ${risk.treatment.toLowerCase()}ed during assessment`,
          slaDays,
          detail: risk.treatmentPlan ?? null,
          residualLikelihood: risk.residualLikelihood ?? undefined,
          residualImpact: risk.residualImpact ?? undefined,
          residualExposure: risk.residualExposure ?? undefined,
        });
      }

      toast.success(`Risk ${created.identifier ?? ""} added to assessment`.trim());
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add risk");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Risk to Assessment</DialogTitle>
          <DialogDescription>
            This risk is identified during the assessment and stays PENDING until
            the assessment is approved, then publishes to the risk register.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Form {...form}>
            {fields.map((field, index) => (
              <RiskItemCard
                key={field.id}
                index={index}
                control={form.control as never}
                isExpanded={true}
                onToggle={() => {}}
                onRemove={() => {}}
                canRemove={false}
                matrixScales={matrixScales}
                matrixThresholds={matrixThresholds}
                is3DMatrix={is3DMatrix}
              />
            ))}
          </Form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Risk to Assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
