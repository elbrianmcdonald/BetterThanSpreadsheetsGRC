"use client";

/**
 * Create Assessment Project Form Component
 *
 * Story 1.3: Create Assessment Form
 *
 * Form for creating new risk assessment projects with:
 * - Subject field (required, max 500 chars)
 * - Description field (optional)
 * - Risk matrix selection (required)
 * - Due date picker (required, defaults to 2 weeks, no past dates)
 * - Assign to myself checkbox (checked by default)
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { addWeeks, startOfDay } from "date-fns";
import { format } from "date-fns";
import { Loader2, Calendar } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Form validation schema
 * Matches tRPC input validation in riskAssessmentProject router
 */
const createAssessmentSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(500, "Subject must be less than 500 characters"),
  description: z.string().max(5000).optional(),
  matrixVersionId: z.string().min(1, "Risk matrix is required"),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  assignToSelf: z.boolean(),
});

type CreateAssessmentFormValues = z.infer<typeof createAssessmentSchema>;

export function CreateAssessmentProjectForm() {
  const router = useRouter();
  const utils = api.useUtils();

  // Fetch available risk matrix templates
  const { data: matrixTemplates, isLoading: isLoadingMatrices } =
    api.riskMatrix.listTemplates.useQuery({ includeInactive: false });

  // Initialize form with react-hook-form and zod validation
  const form = useForm<CreateAssessmentFormValues>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      subject: "",
      description: "",
      matrixVersionId: "",
      dueDate: addWeeks(new Date(), 2), // Default to 2 weeks from today
      assignToSelf: true,
    },
  });

  // Create mutation
  const createMutation = api.riskAssessmentProject.create.useMutation({
    onSuccess: (result) => {
      toast.success("Assessment created successfully");
      // Invalidate list query to refresh data
      void utils.riskAssessmentProject.list.invalidate();
      // Redirect to the new assessment
      router.push(`/risk-assessments/${result.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create assessment");
    },
  });

  // Form submission handler
  const onSubmit = (values: CreateAssessmentFormValues) => {
    createMutation.mutate({
      subject: values.subject,
      description: values.description,
      matrixVersionId: values.matrixVersionId,
      dueDate: values.dueDate,
      assignToSelf: values.assignToSelf,
    });
  };

  // Today's date for calendar validation
  const today = startOfDay(new Date());

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Subject Field */}
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12.5px] font-semibold text-secondary-foreground">
                Subject <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., AWS Migration Project"
                  maxLength={500}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[11.5px]">
                What is being assessed? This could be an application, process,
                security finding, or any other subject requiring risk assessment.
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
              <FormLabel className="text-[12.5px] font-semibold text-secondary-foreground">
                Description
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the scope and objectives of this assessment..."
                  className="min-h-[100px]"
                  maxLength={5000}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[11.5px]">
                Optional details about the assessment scope, objectives, or context.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Risk Matrix Selection */}
        <FormField
          control={form.control}
          name="matrixVersionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12.5px] font-semibold text-secondary-foreground">
                Risk Matrix <span className="text-destructive">*</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMatrices ? "Loading matrices..." : "Select a risk matrix"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {matrixTemplates
                    ?.filter((template) => template.currentVersionId) // Only show templates with published versions
                    .map((template) => (
                      <SelectItem key={template.id} value={template.currentVersionId!}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{template.name}</span>
                          <Badge variant="code">
                            {template.gridSize}x{template.gridSize}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  {matrixTemplates?.every((t) => !t.currentVersionId) && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No published risk matrices available.
                      <br />
                      Please publish a matrix first.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <FormDescription className="text-[11.5px]">
                All risks in this assessment will be scored using this matrix.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Due Date Field */}
        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-[12.5px] font-semibold text-secondary-foreground">
                Due Date <span className="text-destructive">*</span>
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Select a due date</span>
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
                    disabled={(date) => date < today}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className="text-[11.5px]">
                When should this assessment be completed? Past dates are not allowed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Assign to Self Checkbox */}
        <FormField
          control={form.control}
          name="assignToSelf"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border bg-secondary p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="cursor-pointer text-[12.5px] font-semibold text-secondary-foreground">
                  Assign to myself
                </FormLabel>
                <FormDescription className="text-[11.5px]">
                  {field.value
                    ? "You will be assigned to work on this assessment."
                    : "This assessment will be added to the backlog for someone else to claim."}
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/risk-assessments")}
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
              "Create Assessment"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
