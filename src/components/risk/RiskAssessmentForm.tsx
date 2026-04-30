"use client";

/**
 * Risk Assessment Form Component
 *
 * Unified single-page form for creating risk assessments with multiple identified risks.
 *
 * Features:
 * - Assessment header with title, matrix selection, description, business context
 * - Multiple risk items with MITRE ATT&CK integration
 * - Inherent and residual severity calculations
 * - Controls documentation and linkage
 * - Treatment selection (Accept/Remediate) with SLA
 * - Evidence file upload per risk
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Shield,
} from "lucide-react";
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
import { LossSourcePicker } from "@/components/risk/LossSourcePicker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";
import { PersonPicker } from "@/components/person/PersonPicker";
import { RiskItemCard } from "./RiskItemCard";
import type { MatrixScales, Threshold } from "@/lib/matrix";

// ============================================================================
// Form Schema
// ============================================================================

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
  id: z.string(), // Client-side ID for tracking
  title: z.string().min(5, "Risk title must be at least 5 characters").max(200),
  riskStatement: z.string().min(10, "Risk statement must be at least 10 characters"),
  controlDomainId: z.string().nullable().optional(),
  remediationOptions: z.array(remediationOptionSchema),
  // MITRE ATT&CK
  initialAccessVectorId: z.string().nullable().optional(),
  threatStepIds: z.array(z.string()),
  threatObjectiveIds: z.array(z.string()),
  // Controls
  mitigatingControlsInPlace: z.string().nullable().optional(),
  preventativeControlsInPlace: z.string().nullable().optional(),
  mitigatingControlsNeeded: z.string().nullable().optional(),
  preventativeControlsNeeded: z.string().nullable().optional(),
  controlLinkIds: z.array(z.string()),
  mitigatingControlIds: z.array(z.string()),
  controlGapIds: z.array(z.string()),
  // Inherent severity
  inherentLikelihood: z.number().nullable().optional(),
  inherentImpact: z.number().nullable().optional(),
  inherentExposure: z.number().nullable().optional(),
  // Residual severity
  residualLikelihood: z.number().nullable().optional(),
  residualImpact: z.number().nullable().optional(),
  residualExposure: z.number().nullable().optional(),
  residualEliminated: z.boolean(),
  // Treatment
  treatment: z.enum(["ACCEPT", "REMEDIATE"]).nullable().optional(),
  treatmentDueDate: z.date().nullable().optional(),
  // Evidence (file IDs after upload)
  evidenceIds: z.array(z.string()),
});

const riskAssessmentFormSchema = z.object({
  // Assessment header
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  matrixVersionId: z.string().min(1, "Please select a risk matrix"),
  description: z.string().optional(),
  businessOwnerId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  performedById: z.string().optional().nullable(),
  // Optional asset / process linkage — loss values inherited from these
  linkedAssetId: z.string().optional().nullable(),
  linkedBusinessProcessId: z.string().optional().nullable(),
  // Risk items
  risks: z.array(riskItemSchema).min(1, "At least one risk must be identified"),
});

type RiskAssessmentFormValues = z.infer<typeof riskAssessmentFormSchema>;
type RiskItemValues = z.infer<typeof riskItemSchema>;

// ============================================================================
// Component
// ============================================================================

interface RiskAssessmentFormProps {
  onSuccess?: (assessmentId: string) => void;
  onCancel?: () => void;
}

export function RiskAssessmentForm({ onSuccess, onCancel }: RiskAssessmentFormProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();
  const [expandedRiskIndex, setExpandedRiskIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  // Fetch risk matrix templates and versions
  const { data: matrixTemplates } = api.riskMatrix.listTemplates.useQuery({
    includeInactive: false,
  });

  // Fetch users for dropdowns
  const { data: usersData } = api.user.listUsers.useQuery({ take: 100 });
  const users = usersData?.users ?? [];

  // ============================================================================
  // Form Setup
  // ============================================================================

  const form = useForm<RiskAssessmentFormValues>({
    resolver: zodResolver(riskAssessmentFormSchema),
    defaultValues: {
      title: "",
      matrixVersionId: "",
      description: "",
      businessOwnerId: undefined,
      businessUnitId: null,
      performedById: null,
      linkedAssetId: null,
      linkedBusinessProcessId: null,
      risks: [createEmptyRiskItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "risks",
  });

  // Set performedById to current user when session loads
  // Match by email since session.user.id might differ from database user.id
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user?.email && users.length > 0) {
      const currentValue = form.getValues("performedById");
      if (!currentValue) {
        const currentUser = users.find(u => u.email === session.user.email);
        if (currentUser) {
          form.setValue("performedById", currentUser.id);
        }
      }
    }
  }, [sessionStatus, session?.user?.email, users, form]);

  // Watch matrix version to get scales
  const selectedMatrixVersionId = form.watch("matrixVersionId");

  // Fetch selected matrix version details
  const { data: matrixVersion } = api.riskMatrix.getVersion.useQuery(
    { id: selectedMatrixVersionId },
    { enabled: !!selectedMatrixVersionId }
  );

  // Parse matrix scales and thresholds
  const matrixScales = useMemo<MatrixScales | null>(() => {
    if (!matrixVersion?.scales) return null;
    return matrixVersion.scales as MatrixScales;
  }, [matrixVersion]);

  const matrixThresholds = useMemo<Threshold[]>(() => {
    if (!matrixVersion?.thresholds) return [];
    return matrixVersion.thresholds as Threshold[];
  }, [matrixVersion]);

  const is3DMatrix = useMemo(() => {
    return !!matrixScales?.exposure && matrixScales.exposure.length > 0;
  }, [matrixScales]);

  // Get template for selected version
  const selectedTemplate = useMemo(() => {
    if (!matrixVersion?.templateId || !matrixTemplates) return null;
    return matrixTemplates.find((t) => t.id === matrixVersion.templateId);
  }, [matrixVersion, matrixTemplates]);

  // ============================================================================
  // Handlers
  // ============================================================================

  function createEmptyRiskItem(): RiskItemValues {
    return {
      id: crypto.randomUUID(),
      title: "",
      riskStatement: "",
      controlDomainId: null,
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

  const handleAddRisk = useCallback(() => {
    const newRisk = createEmptyRiskItem();
    append(newRisk);
    setExpandedRiskIndex(fields.length);
  }, [append, fields.length]);

  const handleRemoveRisk = useCallback(
    (index: number) => {
      if (fields.length <= 1) {
        toast.error("At least one risk must be identified");
        return;
      }
      remove(index);
      if (expandedRiskIndex >= index && expandedRiskIndex > 0) {
        setExpandedRiskIndex(expandedRiskIndex - 1);
      }
    },
    [remove, fields.length, expandedRiskIndex]
  );

  const toggleRiskExpanded = useCallback((index: number) => {
    setExpandedRiskIndex((prev) => (prev === index ? -1 : index));
  }, []);

  // Create risk assessment mutation
  const createAssessmentMutation = api.risk.createAssessment.useMutation({
    onSuccess: (data) => {
      toast.success("Risk assessment created successfully");
      onSuccess?.(data.id);
      router.push(`/risks/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create risk assessment");
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (values: RiskAssessmentFormValues) => {
    setIsSubmitting(true);
    try {
      await createAssessmentMutation.mutateAsync({
        title: values.title,
        matrixVersionId: values.matrixVersionId,
        description: values.description,
        businessOwnerId: values.businessOwnerId,
        businessUnitId: values.businessUnitId,
        performedById: values.performedById,
        linkedAssetId: values.linkedAssetId,
        linkedBusinessProcessId: values.linkedBusinessProcessId,
        risks: values.risks.map((risk) => ({
          title: risk.title,
          riskStatement: risk.riskStatement,
          controlDomainId: risk.controlDomainId,
          remediationOptions: risk.remediationOptions,
          initialAccessVectorId: risk.initialAccessVectorId,
          threatStepIds: risk.threatStepIds,
          threatObjectiveIds: risk.threatObjectiveIds,
          mitigatingControlsInPlace: risk.mitigatingControlsInPlace,
          preventativeControlsInPlace: risk.preventativeControlsInPlace,
          mitigatingControlsNeeded: risk.mitigatingControlsNeeded,
          preventativeControlsNeeded: risk.preventativeControlsNeeded,
          controlLinkIds: risk.controlLinkIds,
          mitigatingControlIds: risk.mitigatingControlIds,
          controlGapIds: risk.controlGapIds,
          inherentLikelihood: risk.inherentLikelihood,
          inherentImpact: risk.inherentImpact,
          inherentExposure: risk.inherentExposure,
          residualLikelihood: risk.residualLikelihood,
          residualImpact: risk.residualImpact,
          residualExposure: risk.residualExposure,
          residualEliminated: risk.residualEliminated,
          treatment: risk.treatment,
          treatmentDueDate: risk.treatmentDueDate,
          evidenceIds: risk.evidenceIds,
        })),
      });
    } catch {
      // Error handled by mutation
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* ================================================================== */}
        {/* Assessment Header Section */}
        {/* ================================================================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Risk Assessment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title and Matrix Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assessment Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Q1 2024 Infrastructure Security Assessment"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="matrixVersionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Matrix *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a risk matrix" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {matrixTemplates?.map((template) => (
                          template.currentVersionId && (
                            <SelectItem
                              key={template.currentVersionId}
                              value={template.currentVersionId}
                            >
                              <div className="flex items-center gap-2">
                                <span>{template.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {template.dimensionCount}D
                                </Badge>
                              </div>
                            </SelectItem>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <FormDescription>
                        {selectedTemplate.dimensionCount === 3
                          ? "3D matrix: Likelihood × Impact × Exposure"
                          : "2D matrix: Likelihood × Impact"}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the scope and purpose of this risk assessment..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Context */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="businessOwnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Owner</FormLabel>
                    <FormControl>
                      <PersonPicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                      <CreatableBusinessUnitPicker
                        value={field.value ?? null}
                        onChange={(value) => field.onChange(value)}
                        placeholder="Select or create business unit..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="performedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Performed By</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select assessor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name ?? user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Asset / Process linkage — loss values snapshot at create time */}
            <div className="rounded-md border p-4 space-y-3 bg-muted/30">
              <div>
                <h4 className="font-medium text-sm">Loss Event Range Source (optional)</h4>
                <p className="text-xs text-muted-foreground">
                  Link an asset and/or process. Their loss values are snapshotted onto this assessment and applied to all child risks. Re-pick to refresh.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="linkedAssetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Asset</FormLabel>
                      <FormControl>
                        <LossSourcePicker
                          kind="asset"
                          value={field.value ?? null}
                          onChange={field.onChange}
                          placeholder="Search assets…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedBusinessProcessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Business Process</FormLabel>
                      <FormControl>
                        <LossSourcePicker
                          kind="process"
                          value={field.value ?? null}
                          onChange={field.onChange}
                          placeholder="Search processes…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* Identified Risks Section */}
        {/* ================================================================== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Identified Risks ({fields.length})
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRisk}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Risk
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No risks identified yet.</p>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleAddRisk}
                  className="mt-2"
                >
                  Add your first risk
                </Button>
              </div>
            )}

            {fields.map((field, index) => (
              <RiskItemCard
                key={field.id}
                index={index}
                control={form.control}
                isExpanded={expandedRiskIndex === index}
                onToggle={() => toggleRiskExpanded(index)}
                onRemove={() => handleRemoveRisk(index)}
                canRemove={fields.length > 1}
                matrixScales={matrixScales}
                matrixThresholds={matrixThresholds}
                is3DMatrix={is3DMatrix}
              />
            ))}

            {form.formState.errors.risks?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.risks.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* Form Actions */}
        {/* ================================================================== */}
        <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Assessment...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Risk Assessment
              </>
            )}
          </Button>
        </div>
      </form>

    </Form>
  );
}
