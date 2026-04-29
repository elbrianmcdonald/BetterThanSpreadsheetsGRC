"use client";

/**
 * Discovered Risk Form Component
 *
 * Story 2.2: Add Risk to Assessment
 *
 * Simplified form for creating risks within an assessment context.
 * Creates risks with discoveryStatus: PENDING linked to the assessment.
 */

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Severity } from "@prisma/client";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Form validation schema
const discoveredRiskFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  severity: z.nativeEnum(Severity, {
    errorMap: () => ({ message: "Please select a severity level" }),
  }),
  affectedSystems: z.string().max(2000).optional(),
  enterpriseRiskId: z.string().optional().nullable(),
});

type DiscoveredRiskFormValues = z.infer<typeof discoveredRiskFormSchema>;

/**
 * Severity options with colors
 */
const severityOptions = [
  { value: Severity.HIGH, label: "High", color: "bg-red-100 text-red-800 border-red-300" },
  { value: Severity.MEDIUM, label: "Medium", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: Severity.LOW, label: "Low", color: "bg-green-100 text-green-800 border-green-300" },
];

interface DiscoveredRiskFormProps {
  /** The assessment project ID to link this risk to */
  discoveryProjectId: string;
  /** Assessment subject for display */
  assessmentSubject?: string;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when risk is created successfully */
  onSuccess?: (riskId: string) => void;
}

export function DiscoveredRiskForm({
  discoveryProjectId,
  assessmentSubject,
  onCancel,
  onSuccess,
}: DiscoveredRiskFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DiscoveredRiskFormValues>({
    resolver: zodResolver(discoveredRiskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: undefined,
      affectedSystems: "",
      enterpriseRiskId: null,
    },
  });

  const { data: enterpriseRiskOptions } = api.enterpriseRisk.listForPicker.useQuery();

  // Create risk mutation
  const createRiskMutation = api.risk.create.useMutation({
    onSuccess: (data) => {
      toast.success("Risk added to assessment");
      onSuccess?.(data.id);
      // Navigate back to assessment workspace
      router.push(`/risk-assessments/${discoveryProjectId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create risk");
      setIsSubmitting(false);
    },
  });

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      router.push(`/risk-assessments/${discoveryProjectId}`);
    }
  }, [onCancel, router, discoveryProjectId]);

  const onSubmit = async (values: DiscoveredRiskFormValues) => {
    setIsSubmitting(true);
    try {
      await createRiskMutation.mutateAsync({
        title: values.title,
        description: values.description,
        severity: values.severity,
        affectedSystems: values.affectedSystems || undefined,
        discoveryProjectId: discoveryProjectId,
        enterpriseRiskId: values.enterpriseRiskId,
      });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Assessment Context Banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-800 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              Adding Risk to Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-900">
              {assessmentSubject || "Risk Assessment Project"}
            </p>
            <p className="mt-1 text-sm text-blue-700">
              This risk will be linked to the assessment with PENDING status until
              the assessment is approved.
            </p>
          </CardContent>
        </Card>

        {/* Risk Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Details</CardTitle>
            <CardDescription>
              Document the discovered risk with its title, description, and severity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Unpatched servers in production environment"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A concise title describing the risk (5-200 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Severity */}
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {severityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`${option.color} font-medium`}
                            >
                              {option.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The severity level of this risk
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Enterprise Risk alignment */}
            <FormField
              control={form.control}
              name="enterpriseRiskId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enterprise Risk</FormLabel>
                  <Select
                    value={field.value ?? "__none"}
                    onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Align to an enterprise risk (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
                      {enterpriseRiskOptions?.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Roll this risk up to a top-level enterprise risk.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the risk in detail, including potential impact and affected areas..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A detailed description of the risk (minimum 20 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Affected Systems (Optional) */}
            <FormField
              control={form.control}
              name="affectedSystems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affected Systems</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List the systems, applications, or components affected by this risk..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Systems or components impacted by this risk
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-between gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assessment
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Risk...
                </>
              ) : (
                "Add Risk to Assessment"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
