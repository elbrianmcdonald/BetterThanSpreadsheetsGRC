"use client";

/**
 * Identified Risks Editor — accordion of editable risk cards rendered
 * inside the Identified Risks tab on the assessment workspace.
 *
 * Each card (RiskItemCard) holds: title/category/description/severity,
 * MITRE Threat Model, Controls (in-place + needed), Treatment toggle.
 * "Add Risk" appends a new empty card and auto-expands it.
 *
 * Story 5a — core editor. Acceptance form fields and the enterprise-risk
 * picker land in story 5b.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskItemCard } from "@/components/risk/RiskItemCard";
import type { MatrixScales, Threshold } from "@/lib/matrix";

const riskItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  riskStatement: z.string().min(1, "Risk statement is required"),
  controlDomainId: z.string().nullable().optional(),
  initialAccessVectorId: z.string().nullable().optional(),
  threatStepIds: z.array(z.string()),
  threatObjectiveIds: z.array(z.string()),
  mitigatingControlIds: z.array(z.string()),
  controlGapIds: z.array(z.string()),
  inherentLikelihood: z.number().nullable().optional(),
  inherentImpact: z.number().nullable().optional(),
  inherentExposure: z.number().nullable().optional(),
  residualLikelihood: z.number().nullable().optional(),
  residualImpact: z.number().nullable().optional(),
  residualExposure: z.number().nullable().optional(),
  residualEliminated: z.boolean().optional(),
  treatment: z.enum(["ACCEPT", "REMEDIATE"]).nullable().optional(),
  treatmentDueDate: z.date().nullable().optional(),
  treatmentPlan: z.string().nullable().optional(),
  // Acceptance form (rendered when treatment === ACCEPT)
  acceptanceJustification: z.string().nullable().optional(),
  acceptanceReviewDate: z.date().nullable().optional(),
  acceptanceCompensatingControls: z.string().nullable().optional(),
  // Enterprise risk alignment
  enterpriseRiskId: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()),
  isExisting: z.boolean().optional(),
  dbId: z.string().optional(),
});

type RiskItemValues = z.infer<typeof riskItemSchema>;

const formSchema = z.object({
  risks: z.array(riskItemSchema),
});

type FormValues = z.infer<typeof formSchema>;

function emptyRisk(): RiskItemValues {
  return {
    id: crypto.randomUUID(),
    title: "",
    riskStatement: "",
    controlDomainId: null,
    initialAccessVectorId: null,
    threatStepIds: [],
    threatObjectiveIds: [],
    mitigatingControlIds: [],
    controlGapIds: [],
    inherentLikelihood: null,
    inherentImpact: null,
    inherentExposure: null,
    residualLikelihood: null,
    residualImpact: null,
    residualExposure: null,
    residualEliminated: false,
    treatment: null,
    treatmentDueDate: null,
    treatmentPlan: null,
    acceptanceJustification: null,
    acceptanceReviewDate: null,
    acceptanceCompensatingControls: null,
    enterpriseRiskId: null,
    evidenceIds: [],
    isExisting: false,
  };
}

interface IdentifiedRisksEditorProps {
  projectId: string;
  isReadOnly?: boolean;
}

export function IdentifiedRisksEditor({
  projectId,
  isReadOnly = false,
}: IdentifiedRisksEditorProps) {
  const utils = api.useUtils();
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);

  const { data: project, isLoading } = api.riskAssessmentProject.getById.useQuery({
    id: projectId,
  });

  const { data: matrixVersion } = api.riskMatrix.getVersion.useQuery(
    { id: project?.matrixVersionId ?? "" },
    { enabled: !!project?.matrixVersionId }
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
    defaultValues: { risks: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "risks",
  });

  // Hydrate form when project loads
  useEffect(() => {
    if (!project?.discoveredRisks) return;
    const existing: RiskItemValues[] = project.discoveredRisks.map((r) => {
      const numOrNull = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const treatments = (r as { Treatments?: Array<{ treatmentType: string; dueDate: Date | string | null; detail: string | null }> }).Treatments;
      const latestTreatment = treatments?.[0];
      const treatmentType = latestTreatment?.treatmentType;
      const treatmentDueDate = latestTreatment?.dueDate
        ? new Date(latestTreatment.dueDate)
        : null;

      const acc = r as {
        enterpriseRiskId?: string | null;
        acceptanceJustification?: string | null;
        acceptanceReviewDate?: Date | string | null;
        acceptanceCompensatingControls?: string | null;
      };

      return {
        id: r.id,
        title: r.title ?? "",
        riskStatement: r.description ?? r.title ?? "",
        controlDomainId: null,
        initialAccessVectorId: null,
        threatStepIds: [],
        threatObjectiveIds: [],
        mitigatingControlIds: [],
        controlGapIds: [],
        inherentLikelihood: numOrNull(r.inherentLikelihood),
        inherentImpact: numOrNull(r.inherentImpact),
        inherentExposure: numOrNull(r.inherentExposure),
        residualLikelihood: numOrNull(r.residualLikelihood),
        residualImpact: numOrNull(r.residualImpact),
        residualExposure: numOrNull(r.residualExposure),
        residualEliminated: false,
        treatment:
          treatmentType === "ACCEPT" || treatmentType === "REMEDIATE"
            ? treatmentType
            : null,
        treatmentDueDate,
        treatmentPlan: latestTreatment?.detail ?? null,
        acceptanceJustification: acc.acceptanceJustification ?? null,
        acceptanceReviewDate: acc.acceptanceReviewDate
          ? new Date(acc.acceptanceReviewDate)
          : null,
        acceptanceCompensatingControls: acc.acceptanceCompensatingControls ?? null,
        enterpriseRiskId: acc.enterpriseRiskId ?? null,
        evidenceIds: [],
        isExisting: true,
        dbId: r.id,
      };
    });
    form.reset({ risks: existing });
  }, [project?.discoveredRisks, form]);

  const createRisk = api.risk.create.useMutation();
  const updateRisk = api.risk.updateRisk.useMutation();
  const createTreatment = api.risk.createTreatment.useMutation();
  const bulkLinkOrgControls = api.organizationalControl.bulkLinkToRisk.useMutation();

  const handleAddRisk = useCallback(() => {
    append(emptyRisk());
    // Expand the newly added card
    setExpandedIndex(fields.length);
  }, [append, fields.length]);

  const handleRemove = useCallback(
    (index: number) => {
      remove(index);
      setExpandedIndex(-1);
    },
    [remove]
  );

  const toggleExpanded = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? -1 : index));
  }, []);

  const handleSave = async () => {
    if (isReadOnly) return;
    const values = form.getValues();
    const valid = values.risks.filter(
      (r) => r.riskStatement.trim().length > 0
    );
    if (valid.length === 0) {
      toast.error("At least one risk with a non-empty statement is required");
      return;
    }
    setIsSaving(true);
    try {
      for (const risk of valid) {
        let riskId: string | undefined;
        if (risk.isExisting && risk.dbId) {
          await updateRisk.mutateAsync({
            riskId: risk.dbId,
            title: risk.title || risk.riskStatement.slice(0, 80),
            enterpriseRiskId: risk.enterpriseRiskId,
            // Acceptance form persists when treatment === ACCEPT; clear when not
            acceptanceJustification:
              risk.treatment === "ACCEPT" ? risk.acceptanceJustification ?? null : null,
            acceptanceReviewDate:
              risk.treatment === "ACCEPT" ? risk.acceptanceReviewDate ?? null : null,
            acceptanceCompensatingControls:
              risk.treatment === "ACCEPT"
                ? risk.acceptanceCompensatingControls ?? null
                : null,
          });
          riskId = risk.dbId;
        } else {
          const created = await createRisk.mutateAsync({
            title: risk.title || risk.riskStatement.slice(0, 80),
            description: risk.riskStatement,
            severity: "MEDIUM",
            discoveryProjectId: projectId,
            enterpriseRiskId: risk.enterpriseRiskId ?? undefined,
          });
          riskId = created.id;
          // Apply acceptance fields after create if applicable
          if (risk.treatment === "ACCEPT") {
            await updateRisk.mutateAsync({
              riskId,
              acceptanceJustification: risk.acceptanceJustification ?? null,
              acceptanceReviewDate: risk.acceptanceReviewDate ?? null,
              acceptanceCompensatingControls:
                risk.acceptanceCompensatingControls ?? null,
            });
          }
        }

        if (riskId && risk.mitigatingControlIds.length > 0) {
          await bulkLinkOrgControls.mutateAsync({
            riskId,
            controlIds: risk.mitigatingControlIds,
            role: "IN_PLACE",
          });
        }
        if (riskId && risk.controlGapIds.length > 0) {
          await bulkLinkOrgControls.mutateAsync({
            riskId,
            controlIds: risk.controlGapIds,
            role: "NEEDED",
          });
        }

        if (riskId && risk.treatment) {
          let slaDays: number | undefined;
          if (risk.treatmentDueDate) {
            const diff =
              risk.treatmentDueDate.getTime() - new Date().getTime();
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
      }
      toast.success("Identified risks saved");
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Document each risk discovered during this assessment. Every risk
            owns its own threat model, controls, evidence, and treatment.
          </p>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRisk}
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Risk
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || fields.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed rounded-lg">
            <p className="text-sm">No identified risks yet.</p>
            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleAddRisk}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add First Risk
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <RiskItemCard
                key={field.id}
                index={index}
                control={form.control as never}
                isExpanded={expandedIndex === index}
                onToggle={() => toggleExpanded(index)}
                onRemove={() => handleRemove(index)}
                canRemove={!isReadOnly}
                matrixScales={matrixScales}
                matrixThresholds={matrixThresholds}
                is3DMatrix={is3DMatrix}
              />
            ))}
          </div>
        )}

        {/* Mirror the top Add Risk / Save controls at the bottom for long lists */}
        {!isReadOnly && fields.length > 0 && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRisk}
              disabled={isSaving}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Risk
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || fields.length === 0}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </Form>
  );
}
