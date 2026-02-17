"use client";

/**
 * Vendor Assessment Form Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.1: Create Vendor Assessment (FR17)
 * Story 3.2: Assign Assessor and Due Date (FR18, FR19)
 * Story 3.4: Assessment Scoring and Recommendation (FR21, FR22)
 * Story 3.5: Assessment Notes and Summary (FR23)
 *
 * Shared form for creating and editing vendor assessments.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { VendorAssessmentRecommendation } from "@prisma/client";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/**
 * Form validation schema
 */
const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  vendorId: z.string().min(1, "Vendor is required"),
  dueDate: z.date().optional().nullable(),
  assessorId: z.string().optional().nullable(),
  riskScore: z.coerce.number().min(0).max(100).optional().nullable(),
  recommendation: z.nativeEnum(VendorAssessmentRecommendation).optional().nullable(),
  conditions: z.string().max(2000).optional().nullable(),
  rejectionReason: z.string().max(2000).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface VendorAssessmentFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: FormValues) => Promise<void>;
  isSubmitting?: boolean;
  vendorId?: string; // Pre-selected vendor for create from vendor page
}

export function VendorAssessmentForm({
  mode,
  defaultValues,
  onSubmit,
  isSubmitting = false,
  vendorId,
}: VendorAssessmentFormProps) {
  // Fetch vendors for dropdown
  const { data: vendorsData } = api.vendor.list.useQuery({
    page: 1,
    limit: 100,
    status: ["ACTIVE", "UNDER_REVIEW"],
  });

  // Fetch users who can be assessors
  const { data: usersData } = api.user.listUsers.useQuery({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      vendorId: defaultValues?.vendorId || vendorId || "",
      dueDate: defaultValues?.dueDate ? new Date(defaultValues.dueDate) : null,
      assessorId: defaultValues?.assessorId || null,
      riskScore: defaultValues?.riskScore ?? null,
      recommendation: defaultValues?.recommendation || null,
      conditions: defaultValues?.conditions || "",
      rejectionReason: defaultValues?.rejectionReason || "",
      summary: defaultValues?.summary || "",
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  const watchRecommendation = form.watch("recommendation");

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assessment Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Q1 2026 Security Assessment"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  A descriptive title for this assessment
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={mode === "edit" || !!vendorId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vendorsData?.items.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.identifier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The vendor being assessed
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Assignment */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Assignment</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="assessorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessor</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "UNASSIGNED" ? null : value)}
                    defaultValue={field.value ?? "UNASSIGNED"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an assessor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {usersData?.users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The person responsible for conducting the assessment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Target completion date for the assessment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Scoring (only show in edit mode or when assessment has scoring) */}
        {mode === "edit" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Assessment Results</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="riskScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Score (0-100)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="e.g., 75"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? null : Number(val));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Higher score indicates higher risk (0 = low risk, 100 = critical)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recommendation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recommendation</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select recommendation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={VendorAssessmentRecommendation.APPROVE}>
                          Approved
                        </SelectItem>
                        <SelectItem value={VendorAssessmentRecommendation.CONDITIONAL_APPROVE}>
                          Conditional Approval
                        </SelectItem>
                        <SelectItem value={VendorAssessmentRecommendation.REJECT}>
                          Rejected
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Final recommendation based on assessment findings
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conditions (shown when recommendation is CONDITIONAL_APPROVE) */}
            {watchRecommendation === VendorAssessmentRecommendation.CONDITIONAL_APPROVE && (
              <FormField
                control={form.control}
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions for Approval</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the conditions that must be met..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Specify the conditions the vendor must satisfy
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Rejection Reason (shown when recommendation is REJECT) */}
            {watchRecommendation === VendorAssessmentRecommendation.REJECT && (
              <FormField
                control={form.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why the vendor is being rejected..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Document the reasons for rejection
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Summarize key findings and conclusions..."
                      className="min-h-[150px]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Overall summary of the assessment findings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Assessment" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
