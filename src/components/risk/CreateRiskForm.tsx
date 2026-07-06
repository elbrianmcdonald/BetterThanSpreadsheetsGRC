/**
 * Create Risk Form (/risks/new)
 *
 * Story 22.3 (Risk Model Cleanup): the ER-style form. A risk is an
 * AGGREGATION — this form captures what the risk IS (name, description,
 * owner, matrix, review cadence, business unit, category) and how it is
 * scored: linked findings (the 22.1 rollup) and/or a manual judgment score
 * (22.2). Direct inherent/residual L×I entry no longer exists; the rich
 * documentation fields (CVE, technical details, MITRE, controls) live on
 * FINDINGS now (Story 20.1's identified-risk card).
 *
 * Mirrors the Enterprise Risk create dialog per Brian's direction ("Use the
 * Enterprise Risk forms for creating risks"), extended with the
 * risk-specific fields from the validated epic.
 */

"use client";

import { useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MatrixSelector } from "@/components/assessment/MatrixSelector";
import { SeverityCalculator } from "@/components/risk/SeverityCalculator";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { PersonPicker } from "@/components/person/PersonPicker";
import { BusinessUnitPicker } from "@/components/business-unit/BusinessUnitPicker";
import {
  PathwayAttachSection,
  type PathwayAttachState,
} from "@/components/pathway/PathwayAttachSection";
import type { MatrixScales, Threshold } from "@/lib/matrix";

const createRiskSchema = z.object({
  title: z.string().min(5, "Name must be at least 5 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(10000),
  businessOwnerId: z.string().nullable().optional(),
  businessUnitId: z.string().nullable().optional(),
  controlDomainId: z.string().nullable().optional(),
  enterpriseRiskId: z.string().nullable().optional(),
  matrixVersionId: z.string().min(1, "Select a risk matrix"),
  reviewIntervalDays: z.number().int().positive().max(3650).nullable().optional(),
  linkedFindingIds: z.array(z.string()),
  useManual: z.boolean(),
  manualLikelihood: z.number().nullable().optional(),
  manualImpact: z.number().nullable().optional(),
  manualExposure: z.number().nullable().optional(),
});

type CreateRiskFormValues = z.infer<typeof createRiskSchema>;

interface CreateRiskFormProps {
  /** Callback when risk is created successfully */
  onSuccess?: (riskId: string) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

export function CreateRiskForm({ onSuccess, onCancel }: CreateRiskFormProps) {
  const router = useRouter();
  const [findingSearch, setFindingSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Epic 19: exploitation-pathway attachment state (reported by the section).
  const [pathwayState, setPathwayState] = useState<PathwayAttachState>({
    enabled: false,
    value: null,
  });
  const handlePathwayChange = useCallback(
    (s: PathwayAttachState) => setPathwayState(s),
    [],
  );

  const form = useForm<CreateRiskFormValues>({
    resolver: zodResolver(createRiskSchema),
    defaultValues: {
      title: "",
      description: "",
      businessOwnerId: null,
      businessUnitId: null,
      controlDomainId: null,
      enterpriseRiskId: null,
      matrixVersionId: "",
      reviewIntervalDays: null,
      linkedFindingIds: [],
      useManual: false,
      manualLikelihood: null,
      manualImpact: null,
      manualExposure: null,
    },
    mode: "onBlur",
  });

  const matrixVersionId = form.watch("matrixVersionId");
  const useManual = form.watch("useManual");
  const linkedFindingIds = form.watch("linkedFindingIds");

  // Selected matrix version drives the manual-score calculator.
  const { data: matrixVersion } = api.riskMatrix.getVersion.useQuery(
    { id: matrixVersionId },
    { enabled: !!matrixVersionId }
  );
  const scales = (matrixVersion?.scales ?? null) as MatrixScales | null;
  const thresholds = (matrixVersion?.thresholds ?? []) as Threshold[];
  const is3DMatrix = !!scales?.exposure && scales.exposure.length > 0;

  // Category taxonomy + ER alignment + finding picker
  const { data: controlDomains } = api.controlDomain.listAll.useQuery();
  const { data: enterpriseRisks } = api.enterpriseRisk.list.useQuery();
  const { data: pickerFindings } = api.finding.listForPicker.useQuery();

  const findingOptions = useMemo(() => {
    const q = findingSearch.trim().toLowerCase();
    return (pickerFindings ?? []).filter(
      (f) =>
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.identifier.toLowerCase().includes(q)
    );
  }, [pickerFindings, findingSearch]);

  const createMutation = api.risk.createAggregateRisk.useMutation();
  const createPathwayMutation = api.pathway.create.useMutation();
  const addStepMutation = api.pathway.addStep.useMutation();

  const onSubmit = async (values: CreateRiskFormValues) => {
    if (pathwayState.enabled && !pathwayState.value) {
      toast.error(
        "Complete the exploitation pathway details (assessment, pathway, and MITRE technique) or uncheck it.",
      );
      return;
    }
    const hasManual =
      values.useManual &&
      values.manualLikelihood != null &&
      values.manualImpact != null;
    if (values.linkedFindingIds.length === 0 && !hasManual) {
      toast.error(
        "A risk is never unscored — link at least one finding or set a manual score."
      );
      return;
    }
    if (values.useManual && !hasManual) {
      toast.error("Select likelihood and impact for the manual score.");
      return;
    }

    setSubmitting(true);
    try {
      let risk: { id: string; identifier: string };
      try {
        const created = await createMutation.mutateAsync({
          title: values.title,
          description: values.description,
          businessOwnerId: values.businessOwnerId ?? undefined,
          businessUnitId: values.businessUnitId ?? undefined,
          controlDomainId: values.controlDomainId ?? undefined,
          enterpriseRiskId: values.enterpriseRiskId ?? undefined,
          matrixVersionId: values.matrixVersionId,
          reviewIntervalDays: values.reviewIntervalDays ?? undefined,
          linkedFindingIds: values.linkedFindingIds,
          manualLikelihood: hasManual ? values.manualLikelihood! : undefined,
          manualImpact: hasManual ? values.manualImpact! : undefined,
          manualExposure:
            hasManual && is3DMatrix ? values.manualExposure ?? undefined : undefined,
        });
        risk = { id: created!.id, identifier: created!.identifier ?? created!.id };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create risk");
        return;
      }

      // Epic 19: attach to an exploitation pathway if requested (non-fatal).
      if (pathwayState.value) {
        const v = pathwayState.value;
        try {
          let pathwayId = v.pathwayId;
          if (!pathwayId && v.newPathwayName) {
            const pathway = await createPathwayMutation.mutateAsync({
              assessmentKind: v.assessmentKind,
              assessmentId: v.assessmentId,
              name: v.newPathwayName,
            });
            pathwayId = pathway.id;
          }
          if (pathwayId) {
            await addStepMutation.mutateAsync({
              pathwayId,
              tactic: v.tactic,
              technique: v.technique,
              mitreTid: v.mitreTid,
              riskIds: [risk.id],
            });
          }
        } catch (error) {
          toast.error(
            `Risk ${risk.identifier} created, but adding it to the pathway failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      }

      toast.success(`Risk ${risk.identifier} created`);
      if (onSuccess) {
        onSuccess(risk.id);
      } else {
        router.push(`/risks/${risk.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFinding = (id: string) => {
    const current = form.getValues("linkedFindingIds");
    form.setValue(
      "linkedFindingIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Short, specific risk name..." maxLength={200} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Description <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What could happen, why it matters, and the potential consequences..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="businessOwnerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner</FormLabel>
                <FormControl>
                  <PersonPicker
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v)}
                    placeholder="Select person..."
                  />
                </FormControl>
                <FormDescription>Accountable for this risk.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="businessUnitId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Unit</FormLabel>
                <FormControl>
                  <BusinessUnitPicker
                    mode="single"
                    value={field.value ?? null}
                    onChange={(v) =>
                      field.onChange(Array.isArray(v) ? v[0] ?? null : v)
                    }
                    placeholder="Select or create business unit..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="controlDomainId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Category</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Uncategorized</SelectItem>
                    {(controlDomains ?? [])
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Aligned to the taxonomy managed in Administration → Taxonomy.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enterpriseRiskId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enterprise Risk</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Not aligned" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Not aligned</SelectItem>
                    {enterpriseRisks?.map((er) => (
                      <SelectItem key={er.id} value={er.id}>
                        {er.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Optional roll-up parent for executive reporting.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="matrixVersionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Risk Matrix <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <MatrixSelector
                    value={field.value || null}
                    onChange={(v) => field.onChange(v)}
                    placeholder="Select a risk matrix..."
                  />
                </FormControl>
                <FormDescription>Locked to this risk at creation.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reviewIntervalDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Review interval (days)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    placeholder="e.g., 90"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </FormControl>
                <FormDescription>Leave empty for no scheduled review.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Score at creation — findings rollup and/or manual judgment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Score at creation</CardTitle>
            <p className="text-xs text-muted-foreground">
              A risk is never unscored: link the findings that evidence it (the
              score derives from the highest open finding) and/or set a manual
              judgment score. Both can be changed later.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link findings */}
            <div>
              <FormLabel>Linked Findings</FormLabel>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search open findings..."
                  value={findingSearch}
                  onChange={(e) => setFindingSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {findingOptions.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    {findingSearch ? "No findings match." : "No open findings available."}
                  </p>
                ) : (
                  findingOptions.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        checked={linkedFindingIds.includes(f.id)}
                        onCheckedChange={() => toggleFinding(f.id)}
                      />
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {f.identifier}
                      </span>
                      <span className="text-sm line-clamp-1 flex-1">{f.title}</span>
                      <SeverityBadge
                        severity={f.severity}
                        severityLabel={f.severityLabel}
                        size="sm"
                        showTooltip={false}
                      />
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {linkedFindingIds.length === 0
                  ? "No findings linked yet."
                  : `${linkedFindingIds.length} finding${linkedFindingIds.length === 1 ? "" : "s"} linked — score will derive from the highest.`}
              </p>
            </div>

            {/* Manual score toggle */}
            <FormField
              control={form.control}
              name="useManual"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    Set a manual score (overrides the calculated rollup)
                  </FormLabel>
                </FormItem>
              )}
            />

            {useManual && (
              <div className="max-w-md">
                {matrixVersionId ? (
                  <SeverityCalculator
                    title="Manual Severity"
                    description="Judgment score against the selected matrix"
                    control={form.control}
                    likelihoodName="manualLikelihood"
                    impactName="manualImpact"
                    exposureName="manualExposure"
                    scales={scales}
                    thresholds={thresholds}
                    is3DMatrix={is3DMatrix}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a risk matrix first.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Epic 19: Exploitation pathway attachment */}
        <PathwayAttachSection onChange={handlePathwayChange} />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.back())}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Risk...
              </>
            ) : (
              "Create Risk"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
