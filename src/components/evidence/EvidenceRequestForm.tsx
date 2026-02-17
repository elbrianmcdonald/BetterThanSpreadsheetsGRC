"use client";

/**
 * Evidence Request Form Component
 *
 * Form for GRC Analysts to create evidence requests.
 *
 * AC1: GRC Analyst can create evidence request from Evidence Repository page
 * AC2: Request form captures: recipient user, control domains, due date, instructions, framework context
 * AC3: Recipient user must be from same organization
 * AC4: Control domains limited to 1-5 selections
 * AC5: Due date must be future date
 *
 * @see Story 3.12: Evidence Request Workflow
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import {
  Calendar as CalendarIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
  User,
  HelpCircle,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Form schema with validation
const evidenceRequestSchema = z.object({
  recipientUserId: z.string().min(1, "Please select a recipient"),
  controlTaxonomyIds: z
    .array(z.string())
    .min(1, "Select at least one control domain")
    .max(5, "Maximum 5 control domains allowed"),
  dueDate: z.date({
    required_error: "Please select a due date",
  }).refine((date) => date > new Date(), {
    message: "Due date must be in the future",
  }),
  instructions: z.string().min(10, "Instructions must be at least 10 characters"),
  frameworkCode: z.string().optional(),
});

type EvidenceRequestFormValues = z.infer<typeof evidenceRequestSchema>;

interface EvidenceRequestFormProps {
  /** Pre-selected control domain IDs */
  preselectedDomainIds?: string[];
  /** Pre-selected framework code */
  preselectedFrameworkCode?: string;
  /** Callback when request is created successfully */
  onSuccess?: () => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

export function EvidenceRequestForm({
  preselectedDomainIds = [],
  preselectedFrameworkCode,
  onSuccess,
  onCancel,
}: EvidenceRequestFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch available recipients
  const { data: recipients, isLoading: loadingRecipients } =
    api.evidenceRequest.getAvailableRecipients.useQuery();

  // Fetch control domains
  const { data: controlDomains, isLoading: loadingDomains } =
    api.controlDomain.list.useQuery();

  // Fetch active frameworks for context
  const { data: frameworks, isLoading: loadingFrameworks } =
    api.framework.listActive.useQuery();

  // Create mutation
  const createMutation = api.evidenceRequest.create.useMutation({
    onSuccess: () => {
      setShowSuccess(true);
      toast.success("Evidence request sent successfully");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup
  const form = useForm<EvidenceRequestFormValues>({
    resolver: zodResolver(evidenceRequestSchema),
    defaultValues: {
      recipientUserId: "",
      controlTaxonomyIds: preselectedDomainIds,
      dueDate: addDays(new Date(), 7), // Default to 1 week from now
      instructions: "",
      frameworkCode: preselectedFrameworkCode,
    },
  });

  const selectedDomainIds = form.watch("controlTaxonomyIds");

  // Handle form submission
  const onSubmit = (values: EvidenceRequestFormValues) => {
    createMutation.mutate(values);
  };

  // Handle domain toggle
  const handleDomainToggle = (domainId: string, checked: boolean) => {
    const current = form.getValues("controlTaxonomyIds");
    if (checked) {
      if (current.length < 5) {
        form.setValue("controlTaxonomyIds", [...current, domainId]);
      }
    } else {
      form.setValue("controlTaxonomyIds", current.filter((id) => id !== domainId));
    }
  };

  // Success state
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Evidence Request Sent
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          The recipient has been notified via email.
        </p>
        <Button onClick={onCancel}>Close</Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Recipient Selection (AC2, AC3) */}
        <FormField
          control={form.control}
          name="recipientUserId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user to request evidence from" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {loadingRecipients ? (
                    <SelectItem value="" disabled>
                      Loading users...
                    </SelectItem>
                  ) : recipients?.length === 0 ? (
                    <SelectItem value="" disabled>
                      No users available
                    </SelectItem>
                  ) : (
                    recipients?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{user.name ?? user.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormDescription>
                Select a user from your organization to request evidence from.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Control Domains (AC2, AC4) */}
        <FormField
          control={form.control}
          name="controlTaxonomyIds"
          render={() => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Control Domains</FormLabel>
                <span className="text-sm text-gray-500">
                  {selectedDomainIds.length}/5 selected
                </span>
              </div>
              <FormDescription>
                Select 1-5 control domains for which you need evidence.
              </FormDescription>
              <div className="h-48 overflow-y-auto rounded-md border p-4">
                <div className="space-y-2">
                  {loadingDomains ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading domains...
                    </div>
                  ) : controlDomains?.length === 0 ? (
                    <div className="text-gray-500">No control domains available</div>
                  ) : (
                    controlDomains?.map((domain: { id: string; code: string; name: string }) => (
                      <div
                        key={domain.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={domain.id}
                          checked={selectedDomainIds.includes(domain.id)}
                          onCheckedChange={(checked) =>
                            handleDomainToggle(domain.id, !!checked)
                          }
                          disabled={
                            !selectedDomainIds.includes(domain.id) &&
                            selectedDomainIds.length >= 5
                          }
                        />
                        <label
                          htmlFor={domain.id}
                          className={cn(
                            "text-sm flex-1 cursor-pointer",
                            !selectedDomainIds.includes(domain.id) &&
                              selectedDomainIds.length >= 5 &&
                              "text-gray-400"
                          )}
                        >
                          <span className="font-medium">{domain.code}</span>
                          <span className="text-gray-500"> - {domain.name}</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Due Date (AC2, AC5) */}
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
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                The date by which evidence should be submitted.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Framework Context (AC2) */}
        <FormField
          control={form.control}
          name="frameworkCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Framework Context
                <span className="text-gray-400 text-xs ml-1">(Optional)</span>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a framework for context" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">No framework</SelectItem>
                  {loadingFrameworks ? (
                    <SelectItem value="" disabled>
                      Loading frameworks...
                    </SelectItem>
                  ) : (
                    frameworks?.map((framework) => (
                      <SelectItem key={framework.id} value={framework.code}>
                        {framework.name} ({framework.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormDescription>
                Optionally specify which compliance framework this evidence relates to.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Instructions (AC2) */}
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please provide the following evidence:&#10;&#10;1. &#10;2. &#10;3. "
                  className="min-h-32"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Detailed instructions for the recipient about what evidence is needed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Error Display */}
        {createMutation.isError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{createMutation.error.message}</span>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Request...
              </>
            ) : (
              "Send Request"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
