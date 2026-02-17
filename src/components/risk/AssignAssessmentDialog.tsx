"use client";

/**
 * Assign Assessment Dialog Component
 *
 * Allows GRC Managers to assign risk assessments to users.
 * Creates a new risk in DRAFT status assigned to the specified assessor.
 *
 * Features:
 * - User picker for selecting assessor
 * - Title and description fields
 * - Optional due date picker
 * - Optional business unit selector
 *
 * @see Risk Assessment Assignment & Approval Workflow
 */

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long").optional(),
  assessorId: z.string().min(1, "Assessor is required"),
  dueDate: z.date().optional(),
  businessUnitId: z.string().optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface AssignAssessmentDialogProps {
  /** Callback when assignment is created successfully */
  onSuccess?: () => void;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

export function AssignAssessmentDialog({
  onSuccess,
  trigger,
}: AssignAssessmentDialogProps) {
  const [open, setOpen] = useState(false);

  const utils = api.useUtils();

  // Fetch users for assessor picker
  const { data: usersData, isLoading: isLoadingUsers } = api.user.listUsers.useQuery(
    { take: 100, skip: 0 },
    { enabled: open }
  );

  // Fetch business units for optional BU selector
  const { data: businessUnitsData } = api.businessUnit.getAll.useQuery(
    undefined,
    { enabled: open }
  );

  // Assignment mutation
  const assignMutation = api.risk.assignAssessment.useMutation({
    onSuccess: (data) => {
      toast.success(`Assessment assigned to ${data.Assessor?.name ?? "user"}`);
      setOpen(false);
      form.reset();
      void utils.risk.getMyAssignments.invalidate();
      void utils.risk.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign assessment");
    },
  });

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      assessorId: "",
      businessUnitId: undefined,
    },
  });

  const handleSubmit = useCallback(
    (data: AssignmentFormData) => {
      assignMutation.mutate({
        title: data.title,
        description: data.description,
        assessorId: data.assessorId,
        dueDate: data.dueDate,
        // Convert "__none__" sentinel value back to undefined
        businessUnitId: data.businessUnitId && data.businessUnitId !== "__none__" ? data.businessUnitId : undefined,
      });
    },
    [assignMutation]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (!newOpen) {
        form.reset();
      }
    },
    [form]
  );

  const isSubmitting = assignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign Assessment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Risk Assessment</DialogTitle>
          <DialogDescription>
            Create a new risk assessment task and assign it to a team member.
            They will receive the assignment and can complete the assessment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Title <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Assess SQL Injection Risk for Payment API"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief title describing what needs to be assessed
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide context and any specific areas to focus on..."
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional context for the assessor (optional)
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
                  <FormLabel>
                    Assign To <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || isLoadingUsers}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team member..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        usersData?.users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex flex-col">
                              <span>{user.name ?? user.email}</span>
                              {user.name && (
                                <span className="text-xs text-muted-foreground">
                                  {user.email}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The person who will complete this risk assessment
                  </FormDescription>
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
                          disabled={isSubmitting}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date (optional)</span>
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
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When should the assessment be completed by?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Unit */}
            {businessUnitsData && businessUnitsData.length > 0 && (
              <FormField
                control={form.control}
                name="businessUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business unit (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {businessUnitsData.map((bu) => (
                          <SelectItem key={bu.id} value={bu.id}>
                            {bu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this risk with a specific business unit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Assessment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
