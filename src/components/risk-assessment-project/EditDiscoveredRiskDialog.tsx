"use client";

/**
 * Edit Discovered Risk Dialog Component
 *
 * Story 2.3: Edit Discovered Risk
 *
 * Simplified dialog for editing PENDING risks within an assessment context.
 * Preserves discoveryStatus as PENDING after edit.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Severity } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";

// Form validation schema
const editDiscoveredRiskSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  severity: z.nativeEnum(Severity, {
    errorMap: () => ({ message: "Please select a severity level" }),
  }),
  affectedSystems: z.string().max(2000).optional().nullable(),
  enterpriseRiskId: z.string().optional().nullable(),
});

type EditDiscoveredRiskFormValues = z.infer<typeof editDiscoveredRiskSchema>;

/**
 * Severity options with colors
 */
const severityOptions = [
  { value: Severity.HIGH, label: "High", color: "bg-red-100 text-red-800 border-red-300" },
  { value: Severity.MEDIUM, label: "Medium", color: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: Severity.LOW, label: "Low", color: "bg-green-100 text-green-800 border-green-300" },
];

interface EditDiscoveredRiskDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** The risk data to edit */
  risk: {
    id: string;
    title: string;
    description: string | null;
    severity: Severity;
    affectedSystems?: string | null;
    enterpriseRiskId?: string | null;
  };
  /** Assessment ID for invalidating queries */
  assessmentId: string;
  /** Callback when risk is updated successfully */
  onSuccess?: () => void;
}

export function EditDiscoveredRiskDialog({
  open,
  onOpenChange,
  risk,
  assessmentId,
  onSuccess,
}: EditDiscoveredRiskDialogProps) {
  const utils = api.useUtils();

  const form = useForm<EditDiscoveredRiskFormValues>({
    resolver: zodResolver(editDiscoveredRiskSchema),
    defaultValues: {
      title: risk.title,
      description: risk.description || "",
      severity: risk.severity,
      affectedSystems: risk.affectedSystems || "",
      enterpriseRiskId: risk.enterpriseRiskId ?? null,
    },
  });

  const { data: enterpriseRiskOptions } = api.enterpriseRisk.listForPicker.useQuery();

  // Reset form when risk changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: risk.title,
        description: risk.description || "",
        severity: risk.severity,
        affectedSystems: risk.affectedSystems || "",
        enterpriseRiskId: risk.enterpriseRiskId ?? null,
      });
    }
  }, [open, risk, form]);

  // Update mutation
  const updateMutation = api.risk.updateRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk updated successfully");
      // Invalidate the assessment query to refresh the list
      void utils.riskAssessmentProject.getById.invalidate({ id: assessmentId });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update risk");
    },
  });

  const onSubmit = (values: EditDiscoveredRiskFormValues) => {
    updateMutation.mutate({
      riskId: risk.id,
      title: values.title,
      description: values.description,
      severity: values.severity,
      affectedSystems: values.affectedSystems || null,
      enterpriseRiskId: values.enterpriseRiskId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Discovered Risk</DialogTitle>
          <DialogDescription>
            Update the details of this risk. Changes are tracked in the audit log.
            The risk will remain in PENDING status until the assessment is approved.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Systems or components impacted by this risk
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
