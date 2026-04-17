"use client";

/**
 * Start Compliance Assessment Dialog Component
 *
 * Dialog for creating a new compliance assessment against a framework.
 * Allows user to set name, description, assessor, and target dates.
 *
 * On success, redirects to the assessment detail page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Loader2,
  Play,
  Calendar,
  User,
  FileText,
  Shield,
} from "lucide-react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CreatableBusinessUnitPicker } from "@/components/business-unit/CreatableBusinessUnitPicker";

/**
 * Form schema with Zod validation
 */
const startAssessmentSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(200, "Name must be at most 200 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional(),
  baseline: z.string().optional(),
  businessUnitId: z.string().optional(),
  assessorId: z.string().optional(),
  targetCompletionDate: z.date().optional(),
  dueDate: z.date().optional(),
});

type StartAssessmentFormValues = z.infer<typeof startAssessmentSchema>;

interface StartAssessmentDialogProps {
  frameworkId: string;
  frameworkName: string;
  frameworkCode: string;
  /** Optional trigger button. If not provided, default button is used */
  trigger?: React.ReactNode;
  /** Callback after successful creation */
  onSuccess?: () => void;
  /** If true, dialog opens immediately on mount */
  defaultOpen?: boolean;
  /** Callback when dialog is closed without creating */
  onCancel?: () => void;
}

export function StartAssessmentDialog({
  frameworkId,
  frameworkName,
  frameworkCode,
  trigger,
  onSuccess,
  defaultOpen = false,
  onCancel,
}: StartAssessmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  // Fetch users for assessor selection
  const { data: usersData } = api.user.listUsers.useQuery(
    { skip: 0, take: 100 },
    { enabled: open }
  );

  // Fetch available baselines for this framework
  const { data: baselinesData } = api.complianceAssessment.getFrameworkBaselines.useQuery(
    { frameworkId },
    { enabled: open }
  );

  const form = useForm<StartAssessmentFormValues>({
    resolver: zodResolver(startAssessmentSchema),
    defaultValues: {
      name: `${frameworkCode} Assessment - ${format(new Date(), "MMMM yyyy")}`,
      description: "",
      baseline: undefined,
      businessUnitId: undefined,
      assessorId: undefined,
      targetCompletionDate: undefined,
      dueDate: undefined,
    },
  });

  const createMutation = api.complianceAssessment.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Assessment "${data.name}" created successfully!`);
      setOpen(false);
      form.reset();
      onSuccess?.();
      // Navigate to the assessment detail page
      router.push(`/compliance/assessments/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create assessment");
    },
  });

  const onSubmit = (values: StartAssessmentFormValues) => {
    createMutation.mutate({
      frameworkId,
      businessUnitId: values.businessUnitId,
      baseline: values.baseline || null,
      name: values.name,
      description: values.description,
      assessorId: values.assessorId,
      targetCompletionDate: values.targetCompletionDate,
      dueDate: values.dueDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && onCancel) onCancel(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1">
            <Play className="h-4 w-4" />
            Create Assessment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Compliance Assessment
          </DialogTitle>
          <DialogDescription>
            Create a new compliance assessment for{" "}
            <span className="font-medium">{frameworkName}</span>. All controls
            will be initialized as &quot;Not Assessed&quot;.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Assessment Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q1 2026 NIST Assessment" {...field} />
                  </FormControl>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this assessment..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Baseline Selection (only show if baselines available) */}
            {baselinesData && baselinesData.baselines.length > 0 && (
              <FormField
                control={form.control}
                name="baseline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baseline</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "__all__" ? undefined : val)}
                      defaultValue={field.value ?? "__all__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a baseline (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__all__">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            All Controls
                          </div>
                        </SelectItem>
                        {baselinesData.baselines.map((bl) => (
                          <SelectItem key={bl.value} value={bl.value}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3" />
                              {bl.label} Baseline ({bl.count} controls)
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Filter assessment to a specific NIST baseline
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Business Unit */}
            <FormField
              control={form.control}
              name="businessUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Unit</FormLabel>
                  <FormControl>
                    <CreatableBusinessUnitPicker
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                      placeholder="Select or create business unit..."
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Which business unit is being assessed
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assessor */}
            <FormField
              control={form.control}
              name="assessorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessor</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an assessor (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usersData?.users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {user.name || user.email}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Optional: Assign someone to complete this assessment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Target Completion Date */}
              <FormField
                control={form.control}
                name="targetCompletionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Target Completion</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Create Assessment
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
