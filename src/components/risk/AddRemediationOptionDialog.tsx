"use client";

/**
 * Add Remediation Option Dialog Component
 *
 * Dialog for adding remediation options to a risk.
 *
 * Story 4.5: Task 3 - Add Remediation Option Dialog (AC23-AC28)
 * AC23: Risk detail page has "Add Remediation Option" button (for authorized users)
 * AC24: Clicking button opens remediation option dialog
 * AC25: Dialog includes fields: title, description (markdown), approach (textarea),
 *       cost estimate (currency), timeline estimate (text), effort level (dropdown), priority (dropdown)
 * AC26: Cost estimate field supports currency formatting (e.g., "$5,000")
 * AC27: Timeline estimate supports flexible text (e.g., "2-3 weeks", "1 month", "Immediate")
 * AC28: Dialog validates required fields (title, description, effortLevel)
 *
 * @see Story 4.5: Remediation Options Management
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Plus,
  DollarSign,
  Clock,
  Info,
} from "lucide-react";
import { EffortLevel, RemediationPriority } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
 * Form schema with Zod validation (AC28)
 */
const addRemediationOptionSchema = z.object({
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
});

type AddRemediationOptionFormValues = z.infer<typeof addRemediationOptionSchema>;

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

interface AddRemediationOptionDialogProps {
  /** The risk ID to add the option to */
  riskId: string;
  /** Callback when option is added successfully */
  onSuccess?: () => void;
  /** Custom trigger element (optional) */
  trigger?: React.ReactNode;
}

/**
 * Format a number as currency (AC26)
 */
const formatCurrency = (value: string): string => {
  // Remove non-numeric characters except decimal
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");

  // Limit to 2 decimal places
  if (parts.length > 1 && parts[1]) {
    parts[1] = parts[1].slice(0, 2);
  }

  // Add thousand separators to integer part
  if (parts[0]) {
    parts[0] = parseInt(parts[0], 10).toLocaleString("en-US");
  }

  return parts.join(".");
};

export function AddRemediationOptionDialog({
  riskId,
  onSuccess,
  trigger,
}: AddRemediationOptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [costDisplay, setCostDisplay] = useState("");

  const utils = api.useUtils();

  // Add mutation
  const addMutation = api.risk.addRemediationOption.useMutation({
    onSuccess: () => {
      toast.success("Remediation option added successfully");
      setOpen(false);
      form.reset();
      setCostDisplay("");
      // Invalidate queries to refresh the options list
      void utils.risk.listRemediationOptions.invalidate({ riskId });
      void utils.risk.getById.invalidate({ id: riskId });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup
  const form = useForm<AddRemediationOptionFormValues>({
    resolver: zodResolver(addRemediationOptionSchema),
    defaultValues: {
      title: "",
      description: "",
      approach: "",
      costEstimate: "",
      timelineEstimate: "",
      effortLevel: undefined,
      priority: undefined,
    },
  });

  // Handle cost input with formatting (AC26)
  const handleCostChange = (value: string) => {
    const formatted = formatCurrency(value);
    setCostDisplay(formatted);
    form.setValue("costEstimate", formatted);
  };

  // Handle form submission
  const onSubmit = (values: AddRemediationOptionFormValues) => {
    addMutation.mutate({
      riskId,
      title: values.title,
      description: values.description,
      approach: values.approach,
      costEstimate: parseCostEstimate(values.costEstimate),
      timelineEstimate: values.timelineEstimate,
      effortLevel: values.effortLevel,
      priority: values.priority,
    });
  };

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setCostDisplay("");
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Option
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Remediation Option</DialogTitle>
          <DialogDescription>
            Define a remediation approach with cost estimate, timeline, and effort level.
            Multiple options help stakeholders evaluate different paths forward.
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
              {/* Cost Estimate Field (AC26) */}
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
                    <FormDescription>
                      Estimated cost in USD
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Timeline Estimate Field (AC27) */}
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

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this remediation option in detail. What does it accomplish and why might stakeholders choose it?"
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
                      placeholder="Outline the steps required to implement this remediation:
- Step 1: ...
- Step 2: ...
- Resources needed: ...
- Dependencies: ..."
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
                onClick={() => handleOpenChange(false)}
                disabled={addMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
