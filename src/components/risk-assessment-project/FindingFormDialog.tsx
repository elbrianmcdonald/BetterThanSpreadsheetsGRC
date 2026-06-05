"use client";

/**
 * Finding Form Dialog
 *
 * "Add Finding" for a risk assessment — used both from a questionnaire question
 * and from the assessment's Findings tab. Captures the same fields as the
 * findings-register create form (title, description, source, severity, affected
 * assets, business units, assignee) and creates a finding linked to the
 * assessment (discoveryProjectId) — and optionally the source question. The
 * finding is created PENDING and publishes to the register on assessment
 * approval (mirrors discovered risks).
 */

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FindingSource, Severity } from "@prisma/client";
import { Loader2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BusinessUnitPicker } from "@/components/business-unit/BusinessUnitPicker";
import { AssigneePicker } from "@/components/assignment/AssigneePicker";

const FINDING_SOURCE_OPTIONS = [
  { value: FindingSource.AUDIT, label: "Audit" },
  { value: FindingSource.PENTEST, label: "Penetration Test" },
  { value: FindingSource.SCANNER, label: "Vulnerability Scanner" },
  { value: FindingSource.INCIDENT, label: "Security Incident" },
  { value: FindingSource.MANUAL, label: "Manual Discovery" },
] as const;

const SEVERITY_OPTIONS = [
  { value: Severity.HIGH, label: "High", color: "text-red-600" },
  { value: Severity.MEDIUM, label: "Medium", color: "text-amber-600" },
  { value: Severity.LOW, label: "Low", color: "text-blue-600" },
] as const;

const findingFormSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(500, "Title must be less than 500 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  source: z.nativeEnum(FindingSource),
  severity: z.nativeEnum(Severity),
  affectedAssets: z.string().optional(),
  affectedBusinessUnitIds: z.array(z.string()).optional(),
  assigneeId: z.string().optional(),
});

type FindingFormValues = z.infer<typeof findingFormSchema>;

interface FindingFormDialogProps {
  projectId: string;
  /** Source questionnaire question, when opened from a question card. */
  questionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultTitle?: string;
  defaultDescription?: string;
}

export function FindingFormDialog({
  projectId,
  questionId,
  open,
  onOpenChange,
  onCreated,
  defaultTitle,
  defaultDescription,
}: FindingFormDialogProps) {
  const form = useForm<FindingFormValues>({
    resolver: zodResolver(findingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      source: FindingSource.MANUAL,
      severity: Severity.MEDIUM,
      affectedAssets: "",
      affectedBusinessUnitIds: [],
      assigneeId: undefined,
    },
  });

  // Re-seed each time the dialog opens, prefilled from the question text / notes.
  useEffect(() => {
    if (open) {
      form.reset({
        title: defaultTitle ?? "",
        description: defaultDescription ?? "",
        source: FindingSource.MANUAL,
        severity: Severity.MEDIUM,
        affectedAssets: "",
        affectedBusinessUnitIds: [],
        assigneeId: undefined,
      });
    }
  }, [open, defaultTitle, defaultDescription, form]);

  const createFinding = api.finding.create.useMutation();
  const [isSaving, setIsSaving] = useState(false);

  const affectedBUs = form.watch("affectedBusinessUnitIds");
  const suggestedBUs = useMemo(() => affectedBUs ?? [], [affectedBUs]);

  const onSubmit = async (values: FindingFormValues) => {
    setIsSaving(true);
    try {
      const affectedAssets = values.affectedAssets
        ? values.affectedAssets
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const created = await createFinding.mutateAsync({
        title: values.title,
        description: values.description,
        source: values.source,
        severity: values.severity,
        affectedAssets,
        affectedBusinessUnitIds: values.affectedBusinessUnitIds ?? [],
        assigneeId: values.assigneeId,
        discoveryProjectId: projectId,
        sourceRiskAssessmentQuestionId: questionId,
      });
      toast.success(`Finding ${created.identifier} added to assessment`);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add finding");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Finding to Assessment</DialogTitle>
          <DialogDescription>
            This finding is recorded against the assessment and stays pending until
            the assessment is approved, then publishes to the findings register.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Title <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a descriptive title for the finding" {...field} />
                  </FormControl>
                  <FormDescription>A clear, concise title (5-500 characters)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed description of the finding, including context, impact, and technical details..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Minimum 20 characters. Markdown supported.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Source <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FINDING_SOURCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
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
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Severity <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <span className={o.color}>{o.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="affectedAssets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affected Assets</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={"Enter affected assets, one per line:\nserver-prod-01\ndatabase-main"}
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Affected systems or assets (one per line)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="affectedBusinessUnitIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affected Business Units</FormLabel>
                  <FormControl>
                    <BusinessUnitPicker
                      mode="multi"
                      value={field.value ?? null}
                      onChange={(value) =>
                        field.onChange(value ? (Array.isArray(value) ? value : [value]) : [])
                      }
                      placeholder="Search business units..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <FormControl>
                    <AssigneePicker
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(value ?? undefined)}
                      suggestedFromBUs={suggestedBUs}
                      placeholder="Select assignee..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Finding to Assessment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
