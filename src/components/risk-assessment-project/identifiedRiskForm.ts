/**
 * Shared form shape for an "identified risk" item rendered by RiskItemCard.
 *
 * Used by both the Identified Risks tab (IdentifiedRisksEditor) and the
 * IdentifiedRisksEditor (the per-question "Add Risk" dialog was retired 2026-07-06 - questions spawn findings only)
 * with the field paths RiskItemCard reads/writes (`risks.${index}.*`).
 */
import { z } from "zod";

export const riskItemSchema = z.object({
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

export type RiskItemValues = z.infer<typeof riskItemSchema>;

export const identifiedRisksFormSchema = z.object({
  risks: z.array(riskItemSchema),
});

export type IdentifiedRisksFormValues = z.infer<typeof identifiedRisksFormSchema>;

/** A blank risk item, optionally prefilled with a title / statement. */
export function emptyRisk(prefill?: {
  title?: string;
  riskStatement?: string;
}): RiskItemValues {
  return {
    id: crypto.randomUUID(),
    title: prefill?.title ?? "",
    riskStatement: prefill?.riskStatement ?? "",
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
