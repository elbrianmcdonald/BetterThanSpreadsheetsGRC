/**
 * Create Finding Form Component
 *
 * Story 7.2 (original form) → Story 20.1 follow-up (Risk Model Cleanup):
 * the finding form IS the identified-risk card — the exact same fields as a
 * risk item in the Create Risk Assessment flow (title, statement, taxonomy
 * category, enterprise-risk alignment, MITRE ATT&CK mapping, mitigating
 * controls / control gaps, inherent + residual severity, remediation options)
 * — minus the Treatment section, because acceptance attaches to the Risk,
 * never the finding.
 *
 * Scores against the org's default risk matrix (server resolves + locks the
 * version). Finding-specific operational fields (source, business units,
 * assignee, exploitation pathway) wrap the card.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { FindingSource } from "@prisma/client";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BusinessUnitPicker } from "@/components/business-unit/BusinessUnitPicker";
import { AssigneePicker } from "@/components/assignment/AssigneePicker";
import {
  PathwayTagSection,
  type PathwayTagState,
} from "@/components/pathway/PathwayTagSection";
import { RiskItemCard } from "@/components/risk/RiskItemCard";
import { severityFromLabel } from "@/lib/findings/scoring-options";
import type { MatrixScales, Threshold } from "@/lib/matrix";

/**
 * Finding Source Options (AC7)
 */
const FINDING_SOURCE_OPTIONS = [
  { value: "AUDIT", label: "Audit", description: "From security/compliance audit" },
  { value: "PENTEST", label: "Penetration Test", description: "From security testing" },
  { value: "SCANNER", label: "Vulnerability Scanner", description: "From automated scanning" },
  { value: "INCIDENT", label: "Security Incident", description: "Discovered during incident" },
  { value: "RISK_ASSESSMENT", label: "Risk Assessment", description: "Identified during a risk assessment" },
  { value: "MANUAL", label: "Manual Discovery", description: "Manually discovered" },
] as const;

// Identical shape to the Create Risk Assessment risk item (RiskAssessmentForm)
// so RiskItemCard's `risks.${index}.*` field paths line up. Treatment fields
// stay in the schema but are never rendered (hideTreatment) and never sent.
const remediationOptionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  approach: z.string().min(1, "Approach is required"),
  costEstimate: z.number().min(0, "Cost must be >= 0"),
  timelineEstimate: z.string().min(1, "Timeline is required").max(100),
  effortLevel: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
  priority: z.enum(["RECOMMENDED", "ALTERNATIVE", "NOT_RECOMMENDED"]),
  ownerId: z.string().nullable(),
});

const riskItemSchema = z.object({
  id: z.string(),
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  riskStatement: z.string().min(20, "Statement must be at least 20 characters"),
  controlDomainId: z.string().nullable().optional(),
  enterpriseRiskId: z.string().nullable().optional(),
  // Finding variant: links to register risks (replaces the ER picker)
  linkedRiskIds: z.array(z.string()),
  remediationOptions: z.array(remediationOptionSchema),
  initialAccessVectorId: z.string().nullable().optional(),
  threatStepIds: z.array(z.string()),
  threatObjectiveIds: z.array(z.string()),
  mitigatingControlsInPlace: z.string().nullable().optional(),
  preventativeControlsInPlace: z.string().nullable().optional(),
  mitigatingControlsNeeded: z.string().nullable().optional(),
  preventativeControlsNeeded: z.string().nullable().optional(),
  controlLinkIds: z.array(z.string()),
  mitigatingControlIds: z.array(z.string()),
  controlGapIds: z.array(z.string()),
  inherentLikelihood: z.number().nullable().optional(),
  inherentImpact: z.number().nullable().optional(),
  inherentExposure: z.number().nullable().optional(),
  residualLikelihood: z.number().nullable().optional(),
  residualImpact: z.number().nullable().optional(),
  residualExposure: z.number().nullable().optional(),
  residualEliminated: z.boolean(),
  treatment: z.enum(["ACCEPT", "REMEDIATE"]).nullable().optional(),
  treatmentDueDate: z.date().nullable().optional(),
  evidenceIds: z.array(z.string()),
});

const createFindingSchema = z.object({
  source: z.nativeEnum(FindingSource, {
    required_error: "Please select a source",
  }),
  affectedBusinessUnitIds: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
  risks: z.array(riskItemSchema).length(1),
});

type CreateFindingFormValues = z.infer<typeof createFindingSchema>;
type RiskItemValues = z.infer<typeof riskItemSchema>;

function emptyItem(): RiskItemValues {
  return {
    id: crypto.randomUUID(),
    title: "",
    riskStatement: "",
    controlDomainId: null,
    enterpriseRiskId: null,
    linkedRiskIds: [],
    remediationOptions: [],
    initialAccessVectorId: null,
    threatStepIds: [],
    threatObjectiveIds: [],
    mitigatingControlsInPlace: null,
    preventativeControlsInPlace: null,
    mitigatingControlsNeeded: null,
    preventativeControlsNeeded: null,
    controlLinkIds: [],
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
    evidenceIds: [],
  };
}

interface CreateFindingFormProps {
  /**
   * Assessment-scoped create (2026-07-06): the finding is recorded against
   * this risk-assessment project (PENDING until approval) and optionally
   * back-links the questionnaire question that surfaced it.
   */
  discoveryProjectId?: string;
  sourceRiskAssessmentQuestionId?: string;
  /**
   * Spawn linkage (2026-07-14): the finding was raised from a specific
   * compliance control, maturity domain, or vendor questionnaire response.
   * These are pass-through to finding.create and are deliberately NOT rendered
   * as form fields — a user must not be able to re-point a finding at a
   * different assessment. The server derives vendorId/vendorAssessmentId from
   * questionnaireResponseId.
   */
  controlId?: string;
  complianceAssessmentId?: string;
  maturityAssessmentId?: string;
  maturityDomainId?: string;
  questionnaireResponseId?: string;
  /** Prefill for question-spawned findings (question text / notes). */
  defaultTitle?: string;
  defaultDescription?: string;
  /**
   * Preselected source, by where the finding was spawned from (AUDIT for
   * assessments, MANUAL for vendor questionnaires). Still user-editable.
   */
  defaultSource?: FindingSource;
  /** When set, called after create instead of navigating to the finding. */
  onCreated?: (finding: { id: string; identifier: string }) => void;
  /** Cancel handler when hosted in a dialog (defaults to router.back()). */
  onCancel?: () => void;
  /**
   * Suppress this form's own success toast(s) (2026-07-14): CreateFindingDialog
   * shows its own richer "created — open" toast after `onCreated` runs, so the
   * form's plain success toast would double up. Error toasts are unaffected.
   */
  suppressSuccessToast?: boolean;
  /**
   * Where to navigate after a successful create (e.g. back to the source
   * assessment tab). Defaults to the new finding's detail page.
   */
  returnTo?: string;
}

export function CreateFindingForm({
  discoveryProjectId,
  sourceRiskAssessmentQuestionId,
  controlId,
  complianceAssessmentId,
  maturityAssessmentId,
  maturityDomainId,
  questionnaireResponseId,
  defaultTitle,
  defaultDescription,
  defaultSource,
  onCreated,
  onCancel,
  returnTo,
  suppressSuccessToast,
}: CreateFindingFormProps = {}) {
  const router = useRouter();
  const [selectedBUs, setSelectedBUs] = useState<string[]>([]);
  const [createBUDialogOpen, setCreateBUDialogOpen] = useState(false);
  const [newBUName, setNewBUName] = useState("");
  const [newBUCode, setNewBUCode] = useState("");
  const [newBUParentId, setNewBUParentId] = useState<string | null>(null);
  const [cardExpanded, setCardExpanded] = useState(true);

  const utils = api.useUtils();

  // Org default risk matrix drives the card's severity calculators; the
  // server re-resolves + locks the version authoritatively on create.
  const { data: defaultMatrix } = api.riskMatrix.getDefault.useQuery();
  const matrixScales = (defaultMatrix?.scales ?? null) as MatrixScales | null;
  const matrixThresholds = (defaultMatrix?.thresholds ?? []) as Threshold[];
  const is3DMatrix = !!matrixScales?.exposure && matrixScales.exposure.length > 0;

  // Fetch all business units for parent selection
  const { data: buData } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Quick create BU mutation
  const createBUMutation = api.businessUnit.quickCreate.useMutation({
    onSuccess: (data) => {
      if (data.created) {
        toast.success(`Created business unit "${data.name}"`);
      } else {
        toast.info(`Business unit "${data.name}" already exists`);
      }
      const currentBUs = form.getValues("affectedBusinessUnitIds") ?? [];
      const newBUs = [...currentBUs, data.id];
      form.setValue("affectedBusinessUnitIds", newBUs);
      setSelectedBUs(newBUs);
      void utils.businessUnit.list.invalidate();
      setNewBUName("");
      setNewBUCode("");
      setNewBUParentId(null);
      setCreateBUDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create business unit");
    },
  });

  // Flatten BU tree for parent selection
  const allBusinessUnits = useMemo(() => {
    if (!buData?.tree) return [];
    const flatten = (nodes: typeof buData.tree): Array<{ id: string; name: string; code: string | null }> => {
      const result: Array<{ id: string; name: string; code: string | null }> = [];
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, code: node.code });
        if (node.children?.length) {
          result.push(...flatten(node.children));
        }
      }
      return result;
    };
    return flatten(buData.tree);
  }, [buData?.tree]);

  const handleCreateBU = () => {
    if (!newBUName.trim()) return;
    createBUMutation.mutate({
      name: newBUName.trim(),
      code: newBUCode.trim() || undefined,
      parentId: newBUParentId || undefined,
    });
  };

  // Epic 19: pathway-level tagging state (reported by the section).
  const [pathwayState, setPathwayState] = useState<PathwayTagState>({
    enabled: false,
    existingIds: [],
    newNames: [],
  });
  const handlePathwayChange = useCallback(
    (s: PathwayTagState) => setPathwayState(s),
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  const createMutation = api.finding.create.useMutation();
  const createPathwayMutation = api.pathway.create.useMutation();
  const linkFindingMutation = api.pathway.linkFinding.useMutation();

  const form = useForm<CreateFindingFormValues>({
    resolver: zodResolver(createFindingSchema),
    defaultValues: {
      // Spawn-site default (AUDIT from assessments, MANUAL from vendor
      // questionnaires); risk-assessment projects keep RISK_ASSESSMENT.
      source:
        defaultSource ??
        (discoveryProjectId ? FindingSource.RISK_ASSESSMENT : undefined),
      affectedBusinessUnitIds: [],
      assigneeId: undefined,
      risks: [
        {
          ...emptyItem(),
          title: defaultTitle ?? "",
          riskStatement: defaultDescription ?? "",
        },
      ],
    },
    mode: "onBlur",
  });

  const onSubmit = async (values: CreateFindingFormValues) => {
    const item = values.risks[0]!;

    // Findings are scored observations — require the inherent score.
    if (item.inherentLikelihood == null || item.inherentImpact == null) {
      toast.error("Select inherent likelihood and impact to score the finding.");
      return;
    }
    if (is3DMatrix && item.inherentExposure == null) {
      toast.error("Select inherent exposure to score the finding.");
      return;
    }

    // Advisory severity from the inherent score against the matrix thresholds;
    // the server recomputes authoritatively.
    const rawScore = is3DMatrix
      ? item.inherentLikelihood * item.inherentImpact * (item.inherentExposure ?? 1)
      : item.inherentLikelihood * item.inherentImpact;
    const threshold = matrixThresholds.find(
      (t) => rawScore >= t.minValue && rawScore < t.maxValue
    );
    const advisorySeverity = severityFromLabel(threshold?.label ?? null);

    setSubmitting(true);
    try {
      let finding: { id: string; identifier: string };
      try {
        finding = await createMutation.mutateAsync({
          title: item.title,
          description: item.riskStatement,
          source: values.source,
          severity: advisorySeverity,
          likelihood: item.inherentLikelihood,
          impact: item.inherentImpact,
          exposure: is3DMatrix ? item.inherentExposure ?? undefined : undefined,
          matrixVersionId: defaultMatrix?.currentVersionId ?? undefined,
          // Identified-risk-card parity
          controlDomainId: item.controlDomainId ?? undefined,
          linkedRiskIds: item.linkedRiskIds,
          initialAccessVectorId: item.initialAccessVectorId ?? undefined,
          threatStepIds: item.threatStepIds,
          threatObjectiveIds: item.threatObjectiveIds,
          mitigatingControlIds: item.mitigatingControlIds,
          controlGapIds: item.controlGapIds,
          residualLikelihood: item.residualEliminated ? undefined : item.residualLikelihood ?? undefined,
          residualImpact: item.residualEliminated ? undefined : item.residualImpact ?? undefined,
          residualExposure: item.residualEliminated ? undefined : item.residualExposure ?? undefined,
          residualEliminated: item.residualEliminated,
          remediationOptions: item.remediationOptions.map((opt) => ({
            ...opt,
            ownerId: opt.ownerId ?? undefined,
          })),
          // Finding operational fields
          affectedBusinessUnitIds: values.affectedBusinessUnitIds,
          assigneeId: values.assigneeId,
          // Assessment-scoped create: gated PENDING until project approval,
          // optionally back-linking the source questionnaire question.
          discoveryProjectId,
          sourceRiskAssessmentQuestionId,
          // Spawn linkage (2026-07-14). controlId also auto-creates an
          // OBSERVATION ControlLink server-side; questionnaireResponseId makes
          // the server derive the vendor + vendor-assessment ids.
          controlId,
          complianceAssessmentId,
          maturityAssessmentId,
          maturityDomainId,
          questionnaireResponseId,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create finding");
        return;
      }

      // Epic 19: link to exploitation pathways if requested. The finding now
      // exists, so a link failure is non-fatal — we warn and still navigate.
      if (pathwayState.enabled) {
        try {
          for (const pathwayId of pathwayState.existingIds) {
            await linkFindingMutation.mutateAsync({ pathwayId, findingId: finding.id });
          }
          for (const name of pathwayState.newNames) {
            const pathway = await createPathwayMutation.mutateAsync({ name });
            await linkFindingMutation.mutateAsync({ pathwayId: pathway.id, findingId: finding.id });
          }
          if (!suppressSuccessToast) {
            toast.success(
              `Finding ${finding.identifier} created and linked to the exploitation pathway`,
            );
          }
        } catch (error) {
          toast.error(
            `Finding ${finding.identifier} created, but linking a pathway failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      } else if (!suppressSuccessToast) {
        toast.success(`Finding ${finding.identifier} created successfully`);
      }

      if (onCreated) {
        onCreated(finding);
      } else {
        router.push(returnTo ?? `/findings/${finding.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Watch BU selection for assignee suggestions (AC11)
  const affectedBUs = form.watch("affectedBusinessUnitIds");
  const suggestedBUs = useMemo(() => affectedBUs ?? [], [affectedBUs]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Source Field (AC7) — the one finding-specific required field */}
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Source <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="How was this discovered?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FINDING_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Story 20.1 follow-up: the identified-risk card IS the finding form —
            exact same fields as a risk item in Create Risk Assessment, minus
            Treatment (acceptance lives on the Risk). Scores against the org
            default matrix. */}
        <RiskItemCard
          index={0}
          control={form.control}
          isExpanded={cardExpanded}
          onToggle={() => setCardExpanded((v) => !v)}
          onRemove={() => undefined}
          canRemove={false}
          matrixScales={matrixScales}
          matrixThresholds={matrixThresholds}
          is3DMatrix={is3DMatrix}
          variant="finding"
        />
        {defaultMatrix?.name ? (
          <p className="text-xs text-muted-foreground -mt-4">
            Severity scored against <span className="font-medium">{defaultMatrix.name}</span> (org default).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground -mt-4">
            No default risk matrix configured — configure one under Admin → Risk
            Matrices to score findings.
          </p>
        )}

        {/* Business Units Field (AC10) */}
        <FormField
          control={form.control}
          name="affectedBusinessUnitIds"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Affected Business Units</FormLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCreateBUDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create New
                </Button>
              </div>
              <FormControl>
                <BusinessUnitPicker
                  mode="multi"
                  value={field.value ?? null}
                  onChange={(value) => {
                    const newValue = value ? (Array.isArray(value) ? value : [value]) : [];
                    field.onChange(newValue);
                    setSelectedBUs(newValue);
                  }}
                  placeholder="Search business units..."
                />
              </FormControl>
              <FormDescription>
                Select business units affected by this finding. Can&apos;t find one? Click &quot;Create New&quot; above.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Assignee Field (AC11) */}
        <FormField
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assignee</FormLabel>
              <FormControl>
                <AssigneePicker
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  suggestedFromBUs={suggestedBUs}
                  placeholder="Select assignee..."
                />
              </FormControl>
              <FormDescription>
                Assign to a team member for triage
                {suggestedBUs.length > 0 && " (suggestions based on affected BUs)"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Epic 19: Exploitation pathway tagging (optional, many-to-many) */}
        <PathwayTagSection onChange={handlePathwayChange} />

        {/* Submit Button (AC17, AC18) */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onCancel ? onCancel() : returnTo ? router.push(returnTo) : router.back()
            }
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Finding...
              </>
            ) : (
              "Create Finding"
            )}
          </Button>
        </div>
      </form>

      {/* Create Business Unit Dialog */}
      <Dialog open={createBUDialogOpen} onOpenChange={setCreateBUDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Business Unit</DialogTitle>
            <DialogDescription>
              Add a new business unit to your organization. It will be automatically
              added to the affected business units for this finding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-bu-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-bu-name"
                placeholder="Enter business unit name"
                value={newBUName}
                onChange={(e) => setNewBUName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bu-code">Code (optional)</Label>
              <Input
                id="new-bu-code"
                placeholder="e.g., ENG, SALES, HR"
                value={newBUCode}
                onChange={(e) => setNewBUCode(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Short identifier for quick reference (max 20 characters)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bu-parent">Parent Business Unit (optional)</Label>
              <Select
                value={newBUParentId ?? "__none__"}
                onValueChange={(v) => setNewBUParentId(v === "__none__" ? null : v)}
              >
                <SelectTrigger id="new-bu-parent">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {allBusinessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                      {bu.code && ` (${bu.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optionally place this under an existing business unit
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateBUDialogOpen(false)}
              disabled={createBUMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBU}
              disabled={!newBUName.trim() || createBUMutation.isPending}
            >
              {createBUMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Business Unit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
