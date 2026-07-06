"use client";

/**
 * Edit Remediation Option Dialog Component
 *
 * Dialog for editing an existing remediation option.
 *
 * Story 4.5: Task 5 - Edit Remediation Option Dialog
 * - Load existing option data into form
 * - Use same form fields as add dialog
 * - Call updateRemediationOption mutation on submit
 * - Refresh options list on success
 *
 * @see Story 4.5: Remediation Options Management
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, DollarSign, Clock, Info } from "lucide-react";
import { EffortLevel, RemediationPriority } from "@prisma/client";
import type { RemediationOption, User } from "@prisma/client";

import { api } from "@/trpc/react";
import { PersonPicker } from "@/components/person/PersonPicker";
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
import { toast } from "sonner";
import { effortLevelConfig } from "./EffortLevelBadge";
import { priorityConfig } from "./RemediationPriorityBadge";

/**
 * Form schema with Zod validation
 */
const editRemediationOptionSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be at most 5000 characters"),
  approach: z
    .string()
    .min(10, "Approach must be at least 10 characters")
    .max(5000, "Approach must be at most 5000 characters"),
  costEstimate: z
    .string()
    .min(1, "Cost estimate is required"),
  timelineEstimate: z
    .string()
    .min(1, "Timeline estimate is required")
    .max(100, "Timeline estimate must be at most 100 characters"),
  effortLevel: z.nativeEnum(EffortLevel, {
    required_error: "Please select an effort level",
  }),
  priority: z.nativeEnum(RemediationPriority, {
    required_error: "Please select a priority",
  }),
  ownerId: z.string().nullable(),
});

type EditRemediationOptionFormValues = z.infer<typeof editRemediationOptionSchema>;

/**
 * Parse cost string to number
 */
const parseCostEstimate = (value: string): number => {
  const cleaned = value.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) {
    return 0;
  }
  return num;
};

type RemediationOptionWithRelations = RemediationOption & {
  CreatedBy: Pick<User, "id" | "name" | "email"> | null;
  SelectedBy?: Pick<User, "id" | "name" | "email"> | null;
};

interface EditRemediationOptionDialogProps {
  /** The option to edit */
  option: RemediationOptionWithRelations;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when option is updated successfully */
  onSuccess?: () => void;
}

/**
 * Format a number as currency
 */
const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === "number" ? value.toString() : value;
  const cleaned = numValue.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length > 1 && parts[1]) {
    parts[1] = parts[1].slice(0, 2);
  }

  if (parts[0]) {
    parts[0] = parseInt(parts[0], 10).toLocaleString("en-US");
  }

  return parts.join(".");
};

export function EditRemediationOptionDialog({
  option,
  open,
  onOpenChange,
  onSuccess,
}: EditRemediationOptionDialogProps) {
  const [costDisplay, setCostDisplay] = useState("");

  const utils = api.useUtils();

  // Update mutation
  const updateMutation = api.risk.updateRemediationOption.useMutation({
    onSuccess: () => {
      toast.success("Remediation option updated successfully");
      onOpenChange(false);
      // riskId is null for finding-attached options (Story 20.1) — only
      // invalidate the risk caches when this option belongs to a risk.
      if (option.riskId) {
        void utils.risk.listRemediationOptions.invalidate({ riskId: option.riskId });
        void utils.risk.getById.invalidate({ id: option.riskId });
      }
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup
  const form = useForm<EditRemediationOptionFormValues>({
    resolver: zodResolver(editRemediationOptionSchema),
    defaultValues: {
      title: option.title,
      description: option.description,
      approach: option.approach,
      costEstimate: formatCurrency(Number(option.costEstimate)),
      timelineEstimate: option.timelineEstimate,
      effortLevel: option.effortLevel,
      priority: option.priority,
      ownerId: option.ownerId ?? null,
    },
  });

  // Initialize cost display
  useEffect(() => {
    setCostDisplay(formatCurrency(Number(option.costEstimate)));
  }, [option.costEstimate]);

  // Reset form when option changes
  useEffect(() => {
    form.reset({
      title: option.title,
      description: option.description,
      approach: option.approach,
      costEstimate: formatCurrency(Number(option.costEstimate)),
      timelineEstimate: option.timelineEstimate,
      effortLevel: option.effortLevel,
      priority: option.priority,
      ownerId: option.ownerId ?? null,
    });
    setCostDisplay(formatCurrency(Number(option.costEstimate)));
  }, [option, form]);

  // Handle cost input with formatting
  const handleCostChange = (value: string) => {
    const formatted = formatCurrency(value);
    setCostDisplay(formatted);
    form.setValue("costEstimate", formatted);
  };

  // Handle form submission
  const onSubmit = (values: EditRemediationOptionFormValues) => {
    updateMutation.mutate({
      optionId: option.id,
      title: values.title,
      description: values.description,
      approach: values.approach,
      costEstimate: parseCostEstimate(values.costEstimate),
      timelineEstimate: values.timelineEstimate,
      effortLevel: values.effortLevel,
      priority: values.priority,
      ownerId: values.ownerId ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Remediation Option</DialogTitle>
          <DialogDescription>
            Update the details of this remediation option.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Immediate Patch Deployment"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A concise name for this remediation approach.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority and Effort Level Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority Field */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              <span>{config.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Effort Level Field */}
              <FormField
                control={form.control}
                name="effortLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effort Level *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select effort level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(effortLevelConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              <span>{config.label}</span>
                              <span className="text-xs text-muted-foreground">
                                ({config.timeframe})
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

            {/* Cost and Timeline Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cost Estimate Field */}
              <FormField
                control={form.control}
                name="costEstimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Estimate *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="5,000"
                          className="pl-8"
                          value={costDisplay}
                          onChange={(e) => handleCostChange(e.target.value)}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Estimated cost in USD</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Timeline Estimate Field */}
              <FormField
                control={form.control}
                name="timelineEstimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeline Estimate *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="e.g., 2-3 weeks"
                          className="pl-8"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      e.g., &quot;Immediate&quot;, &quot;1 week&quot;, &quot;2-3 months&quot;
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Owner Field */}
            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <FormControl>
                    <PersonPicker
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id ?? null)}
                      placeholder="Unassigned"
                      clearable
                    />
                  </FormControl>
                  <FormDescription>
                    Person accountable for executing this remediation option.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this remediation option in detail."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Explain the value proposition of this approach.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Approach Field */}
            <FormField
              control={form.control}
              name="approach"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Implementation Approach *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Outline the implementation steps..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Detail the implementation steps, resources, and dependencies.
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
