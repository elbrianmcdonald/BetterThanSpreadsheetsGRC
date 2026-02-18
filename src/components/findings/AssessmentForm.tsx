"use client";

/**
 * Assessment Form Component
 *
 * Story 7.6: Risk Assessment Form with Auto-Save
 *
 * Main form for editing risk assessments with:
 * - AC1-AC9: Form fields (title, context, category, systems, likelihood, impact, treatment, owner)
 * - AC10: All fields disabled when APPROVED or REJECTED
 * - AC11: Receives assessment data via props
 * - AC12: Integrates with InlineAssessmentSection
 * - AC13: Collapsible card layout
 * - AC22-AC27: Auto-save with 1000ms debounce
 * - AC31-AC33: Read-only mode for terminal statuses
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

import { useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TreatmentType, AssessmentStatus } from "@prisma/client";
import { useDebouncedCallback } from "use-debounce";
import { format } from "date-fns";
import { Lock } from "lucide-react";

import { api } from "@/trpc/react";
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
import { Badge } from "@/components/ui/badge";

import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";
import { PersonPicker } from "@/components/person/PersonPicker";
import { SaveIndicator, type SaveStatus } from "./SaveIndicator";
import { RiskScoreDisplay } from "./RiskScoreDisplay";
import { RISK_CATEGORY_OPTIONS } from "@/lib/constants/risk-categories";
import { LIKELIHOOD_OPTIONS, IMPACT_OPTIONS } from "@/lib/utils/risk-scoring";

/**
 * Treatment options for form select (AC8)
 */
const TREATMENT_OPTIONS = [
  { value: TreatmentType.ACCEPT, label: "Accept", description: "Accept the risk as-is" },
  { value: TreatmentType.MITIGATE, label: "Mitigate", description: "Implement controls to reduce risk" },
  { value: TreatmentType.TRANSFER, label: "Transfer", description: "Transfer risk to third party" },
  { value: TreatmentType.AVOID, label: "Avoid", description: "Avoid by eliminating activity" },
] as const;

/**
 * Form validation schema
 */
const assessmentFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  context: z.string().optional(),
  riskCategory: z.string().optional(),
  affectedSystems: z.string().optional(), // Stored as newline-separated string, converted to array on submit
  likelihoodValue: z.number().min(1).max(4).optional().nullable(),
  impactValue: z.number().min(1).max(4).optional().nullable(),
  treatment: z.nativeEnum(TreatmentType).optional().nullable(),
  ownerId: z.string().optional().nullable(),
  // Story 16.1: Business context fields
  businessOwnerId: z.string().optional().nullable(),
  businessUnitId: z.string().optional().nullable(),
  performedById: z.string().optional().nullable(),
});

type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

/**
 * Assessment data structure from API
 */
interface AssessmentData {
  id: string;
  identifier: string;
  title: string;
  context: string | null;
  riskCategory: string | null;
  affectedSystems: string[];
  likelihoodValue: number | null;
  impactValue: number | null;
  treatment: TreatmentType | null;
  ownerId: string | null;
  status: AssessmentStatus;
  approvedAt?: Date | string | null;
  owner?: { id: string; name: string | null; email: string | null } | null;
  // Story 16.1: Business context fields
  businessOwnerId: string | null;
  businessUnitId: string | null;
  performedById: string | null;
  businessOwner?: { id: string; name: string | null; email: string | null } | null;
  businessUnit?: { id: string; name: string; code: string | null } | null;
  performedBy?: { id: string; name: string | null; email: string | null } | null;
  approvalGates: {
    canApprove: boolean;
    missingGates: string[];
  };
}

interface AssessmentFormProps {
  /** Assessment data from API */
  assessment: AssessmentData;
  /** Whether the form is read-only (AC10, AC31) */
  isReadOnly?: boolean;
  /** Callback when assessment is updated */
  onUpdate?: (updated: AssessmentData) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Risk Assessment editing form with auto-save functionality.
 *
 * @example
 * ```tsx
 * <AssessmentForm
 *   assessment={assessment}
 *   isReadOnly={assessment.status !== "DRAFT"}
 *   onUpdate={handleUpdate}
 * />
 * ```
 */
export function AssessmentForm({
  assessment,
  isReadOnly = false,
  onUpdate,
  className,
}: AssessmentFormProps) {
  // Track last saved values to detect actual changes
  const lastSavedValues = useRef<AssessmentFormValues | null>(null);

  // Fetch users for owner dropdown (AC9)
  const { data: users } = api.user.listUsers.useQuery(
    { take: 100 },
    { enabled: !isReadOnly }
  );

  // Update mutation
  const updateMutation = api.riskAssessment.update.useMutation({
    onSuccess: (data) => {
      // AC27: Sync form state with server response
      if (onUpdate) {
        onUpdate(data as unknown as AssessmentData);
      }
      // Update last saved values
      lastSavedValues.current = form.getValues();
    },
  });

  // Determine save status for indicator
  const getSaveStatus = (): SaveStatus => {
    if (updateMutation.isPending) return "saving";
    if (updateMutation.isError) return "error";
    if (updateMutation.isSuccess) return "saved";
    return "idle";
  };

  // Initialize form with assessment data
  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: {
      title: assessment.title,
      context: assessment.context ?? "",
      riskCategory: assessment.riskCategory ?? undefined,
      affectedSystems: assessment.affectedSystems.join("\n"),
      likelihoodValue: assessment.likelihoodValue,
      impactValue: assessment.impactValue,
      treatment: assessment.treatment,
      ownerId: assessment.ownerId,
      // Story 16.1: Business context defaults
      businessOwnerId: assessment.businessOwnerId,
      businessUnitId: assessment.businessUnitId,
      performedById: assessment.performedById,
    },
  });

  // Initialize last saved values
  useEffect(() => {
    lastSavedValues.current = form.getValues();
  }, []);

  // AC22: Debounced save with 1000ms delay
  const debouncedSave = useDebouncedCallback((values: AssessmentFormValues) => {
    // AC26: Only save if values actually changed
    if (isReadOnly) return;

    // Convert affected systems from newline-separated string to array
    const affectedSystems = values.affectedSystems
      ? values.affectedSystems.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

    updateMutation.mutate({
      assessmentId: assessment.id,
      title: values.title,
      context: values.context || undefined,
      riskCategory: values.riskCategory || undefined,
      affectedSystems,
      likelihoodValue: values.likelihoodValue ?? undefined,
      impactValue: values.impactValue ?? undefined,
      treatment: values.treatment ?? undefined,
      ownerId: values.ownerId,
      // Story 16.1: Business context fields
      businessOwnerId: values.businessOwnerId,
      businessUnitId: values.businessUnitId,
      performedById: values.performedById,
    });
  }, 1000);

  // Watch for form changes and trigger auto-save
  useEffect(() => {
    if (isReadOnly) return;

    const subscription = form.watch((values) => {
      // AC26: Only trigger save on dirty fields
      if (form.formState.isDirty) {
        debouncedSave(values as AssessmentFormValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, isReadOnly]);

  // Retry handler for save errors
  const handleRetry = useCallback(() => {
    debouncedSave(form.getValues());
  }, [form, debouncedSave]);

  // Watch likelihood and impact for score display
  const likelihoodValue = form.watch("likelihoodValue");
  const impactValue = form.watch("impactValue");

  // AC31, AC33: Terminal status badge
  const isTerminal = assessment.status === AssessmentStatus.APPROVED ||
                     assessment.status === AssessmentStatus.REJECTED;
  const effectiveReadOnly = isReadOnly || isTerminal;

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Assessment Details</CardTitle>
          <div className="flex items-center gap-3">
            {/* AC32: Hide save indicator when read-only */}
            {!effectiveReadOnly && (
              <SaveIndicator
                status={getSaveStatus()}
                onRetry={handleRetry}
              />
            )}
            {/* AC33: Terminal status badge */}
            {isTerminal && (
              <Badge
                variant="outline"
                className={
                  assessment.status === AssessmentStatus.APPROVED
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }
              >
                <Lock className="h-3 w-3 mr-1" />
                {assessment.status === AssessmentStatus.APPROVED
                  ? `Approved${assessment.approvedAt ? ` on ${format(new Date(assessment.approvedAt), "MMM d, yyyy")}` : ""}`
                  : "Rejected"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form className="space-y-6">
            {/* AC1: Title field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={effectiveReadOnly}
                      placeholder="Assessment title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AC2: Context field */}
            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      disabled={effectiveReadOnly}
                      placeholder="Describe the risk context, background, and relevant details..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Provide background and context for this risk assessment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AC3: Risk Category dropdown */}
            <FormField
              control={form.control}
              name="riskCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    disabled={effectiveReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RISK_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AC4: Affected Systems */}
            <FormField
              control={form.control}
              name="affectedSystems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affected Systems</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      disabled={effectiveReadOnly}
                      placeholder="Enter affected systems, one per line"
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormDescription>
                    List systems, servers, or assets affected by this risk (one per line)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AC5 & AC6: Likelihood and Impact selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="likelihoodValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Likelihood</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() ?? undefined}
                      disabled={effectiveReadOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select likelihood..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LIKELIHOOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
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

              <FormField
                control={form.control}
                name="impactValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impact</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() ?? undefined}
                      disabled={effectiveReadOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select impact..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {IMPACT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
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
            </div>

            {/* AC7: Score display */}
            <RiskScoreDisplay
              likelihood={likelihoodValue ?? null}
              impact={impactValue ?? null}
            />

            {/* AC8: Treatment dropdown */}
            <FormField
              control={form.control}
              name="treatment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    disabled={effectiveReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select treatment..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TREATMENT_OPTIONS.map((option) => (
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
                  <FormDescription>
                    How will this risk be addressed?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AC9: Owner dropdown */}
            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Owner</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    disabled={effectiveReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users?.users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name ?? user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Person responsible for managing this risk
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Story 16.1: Business Context Fields */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Business Context</h3>

              {/* Business Unit dropdown */}
              <FormField
                control={form.control}
                name="businessUnitId"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Business Unit</FormLabel>
                    <FormControl>
                      <CreatableBusinessUnitPicker
                        value={field.value ?? null}
                        onChange={(value) => field.onChange(value ?? undefined)}
                        placeholder="Select or create business unit..."
                        disabled={effectiveReadOnly}
                      />
                    </FormControl>
                    <FormDescription>
                      The business unit this assessment applies to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Owner picker (Person) */}
              <FormField
                control={form.control}
                name="businessOwnerId"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Business Owner</FormLabel>
                    <FormControl>
                      <PersonPicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Business stakeholder responsible for risk decisions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assessor/Performed By dropdown */}
              <FormField
                control={form.control}
                name="performedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assessed By</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                      disabled={effectiveReadOnly}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select assessor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name ?? user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Person who performed this risk assessment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
