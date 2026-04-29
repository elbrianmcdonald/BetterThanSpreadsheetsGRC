"use client";

/**
 * Edit Risk Dialog Component
 *
 * Modal dialog for editing risk finding details.
 *
 * Story 4.3: Risk Finding Documentation (Task 5)
 * - Provides edit form for all risk fields
 * - Uses same form components as CreateRiskForm
 * - Pre-populates with existing values
 * - Calls updateRisk mutation on save
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Loader2,
  Bold,
  Italic,
  Code,
  List,
  Link2,
  ChevronDown,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";

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
import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RiskControlsSection } from "./RiskControlsSection";
import type { Severity, RiskFindingSource, AssetCriticality } from "@prisma/client";

/**
 * Finding source options
 */
const FINDING_SOURCE_OPTIONS = [
  { value: "VULNERABILITY_SCAN", label: "Vulnerability Scan" },
  { value: "PENETRATION_TEST", label: "Penetration Test" },
  { value: "AUDIT_FINDING", label: "Audit Finding" },
  { value: "SECURITY_REVIEW", label: "Security Review" },
  { value: "COMPLIANCE_ASSESSMENT", label: "Compliance Assessment" },
  { value: "OTHER", label: "Other" },
] as const;

/**
 * Asset Criticality options (Story 4.7)
 */
const ASSET_CRITICALITY_OPTIONS: Array<{
  value: AssetCriticality;
  label: string;
  description: string;
  color: string;
}> = [
  { value: "CRITICAL", label: "Critical", description: "Core business systems", color: "text-red-600" },
  { value: "HIGH", label: "High", description: "Important systems", color: "text-orange-600" },
  { value: "MEDIUM", label: "Medium", description: "Standard systems", color: "text-amber-600" },
  { value: "LOW", label: "Low", description: "Non-essential systems", color: "text-blue-600" },
  { value: "NONE", label: "None", description: "No direct impact", color: "text-gray-500" },
];

/**
 * Form schema for editing risk
 */
const editRiskSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(10000, "Description must be less than 10,000 characters"),
  affectedSystems: z.string().optional().nullable(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"], {
    required_error: "Please select a severity level",
  }),
  findingSource: z
    .enum([
      "VULNERABILITY_SCAN",
      "PENETRATION_TEST",
      "AUDIT_FINDING",
      "SECURITY_REVIEW",
      "COMPLIANCE_ASSESSMENT",
      "OTHER",
    ])
    .optional()
    .nullable(),
  cveId: z.string().max(50).optional().nullable(),
  discoveryDate: z.date().optional().nullable(),
  technicalDetails: z.string().max(10000).optional().nullable(),
  // Story 4.7: Impact calculation fields
  assetCriticality: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]).optional().nullable(),
  nextAuditDate: z.date().optional().nullable(),
  // Story 16.3: Controls documentation fields
  mitigatingControlsInPlace: z.string().max(10000).optional().nullable(),
  preventativeControlsInPlace: z.string().max(10000).optional().nullable(),
  mitigatingControlsNeeded: z.string().max(10000).optional().nullable(),
  preventativeControlsNeeded: z.string().max(10000).optional().nullable(),
  // Enterprise Risk alignment
  enterpriseRiskId: z.string().optional().nullable(),
});

type EditRiskFormValues = z.infer<typeof editRiskSchema>;

interface EditRiskDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onOpenChange: (open: boolean) => void;
  /** The risk data to edit */
  risk: {
    id: string;
    title: string;
    description: string;
    affectedSystems: string | null;
    severity: Severity;
    findingSource: RiskFindingSource | null;
    cveId: string | null;
    discoveryDate: Date | null;
    technicalDetails: string | null;
    // Story 4.7: Impact calculation fields
    assetCriticality: AssetCriticality;
    nextAuditDate: Date | null;
    // Story 16.3: Controls documentation fields
    mitigatingControlsInPlace: string | null;
    preventativeControlsInPlace: string | null;
    mitigatingControlsNeeded: string | null;
    preventativeControlsNeeded: string | null;
    // Enterprise Risk alignment
    enterpriseRiskId?: string | null;
  };
  /** Callback when risk is updated successfully */
  onSuccess?: () => void;
}

export function EditRiskDialog({
  open,
  onOpenChange,
  risk,
  onSuccess,
}: EditRiskDialogProps) {
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [showTechnicalDetailsPreview, setShowTechnicalDetailsPreview] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(!!risk.technicalDetails);

  // Update mutation
  const updateMutation = api.risk.updateRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk updated successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Form setup with existing values
  const form = useForm<EditRiskFormValues>({
    resolver: zodResolver(editRiskSchema),
    defaultValues: {
      title: risk.title,
      description: risk.description,
      affectedSystems: risk.affectedSystems ?? "",
      severity: risk.severity,
      findingSource: risk.findingSource ?? undefined,
      cveId: risk.cveId ?? "",
      discoveryDate: risk.discoveryDate ? new Date(risk.discoveryDate) : undefined,
      technicalDetails: risk.technicalDetails ?? "",
      // Story 4.7: Impact calculation fields
      assetCriticality: risk.assetCriticality ?? "MEDIUM",
      nextAuditDate: risk.nextAuditDate ? new Date(risk.nextAuditDate) : undefined,
      // Story 16.3: Controls documentation fields
      mitigatingControlsInPlace: risk.mitigatingControlsInPlace ?? "",
      preventativeControlsInPlace: risk.preventativeControlsInPlace ?? "",
      mitigatingControlsNeeded: risk.mitigatingControlsNeeded ?? "",
      preventativeControlsNeeded: risk.preventativeControlsNeeded ?? "",
      enterpriseRiskId: risk.enterpriseRiskId ?? null,
    },
  });

  const { data: enterpriseRiskOptions } = api.enterpriseRisk.listForPicker.useQuery();

  // Reset form when risk changes
  useEffect(() => {
    if (open) {
      form.reset({
        title: risk.title,
        description: risk.description,
        affectedSystems: risk.affectedSystems ?? "",
        severity: risk.severity,
        findingSource: risk.findingSource ?? undefined,
        cveId: risk.cveId ?? "",
        discoveryDate: risk.discoveryDate ? new Date(risk.discoveryDate) : undefined,
        technicalDetails: risk.technicalDetails ?? "",
        // Story 4.7: Impact calculation fields
        assetCriticality: risk.assetCriticality ?? "MEDIUM",
        nextAuditDate: risk.nextAuditDate ? new Date(risk.nextAuditDate) : undefined,
        // Story 16.3: Controls documentation fields
        mitigatingControlsInPlace: risk.mitigatingControlsInPlace ?? "",
        preventativeControlsInPlace: risk.preventativeControlsInPlace ?? "",
        mitigatingControlsNeeded: risk.mitigatingControlsNeeded ?? "",
        preventativeControlsNeeded: risk.preventativeControlsNeeded ?? "",
        enterpriseRiskId: risk.enterpriseRiskId ?? null,
      });
      setShowTechnicalDetails(!!risk.technicalDetails);
    }
  }, [open, risk, form]);

  // Watch values for preview
  const descriptionValue = form.watch("description");
  const technicalDetailsValue = form.watch("technicalDetails");

  /**
   * Insert markdown formatting at cursor position
   */
  const insertMarkdown = (field: "description" | "technicalDetails", formatType: string) => {
    const textarea = document.querySelector(
      `textarea[name="${field}"]`
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let insertion = "";
    let cursorOffset = 0;

    switch (formatType) {
      case "bold":
        insertion = `**${selectedText || "bold text"}**`;
        cursorOffset = selectedText ? insertion.length : 2;
        break;
      case "italic":
        insertion = `*${selectedText || "italic text"}*`;
        cursorOffset = selectedText ? insertion.length : 1;
        break;
      case "code":
        if (selectedText.includes("\n")) {
          insertion = `\`\`\`\n${selectedText || "code"}\n\`\`\``;
        } else {
          insertion = `\`${selectedText || "code"}\``;
        }
        cursorOffset = selectedText ? insertion.length : 1;
        break;
      case "list":
        insertion = `\n- ${selectedText || "list item"}`;
        cursorOffset = insertion.length;
        break;
      case "link":
        insertion = `[${selectedText || "link text"}](url)`;
        cursorOffset = selectedText ? insertion.length - 1 : 11;
        break;
    }

    const newValue = text.substring(0, start) + insertion + text.substring(end);
    form.setValue(field, newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };

  // Handle form submission
  const onSubmit = (values: EditRiskFormValues) => {
    updateMutation.mutate({
      riskId: risk.id,
      title: values.title,
      description: values.description,
      affectedSystems: values.affectedSystems || null,
      severity: values.severity,
      findingSource: values.findingSource || null,
      cveId: values.cveId || null,
      discoveryDate: values.discoveryDate || null,
      technicalDetails: values.technicalDetails || null,
      // Story 4.7: Impact calculation fields
      assetCriticality: values.assetCriticality || "MEDIUM",
      nextAuditDate: values.nextAuditDate || null,
      // Story 16.3: Controls documentation fields
      mitigatingControlsInPlace: values.mitigatingControlsInPlace || null,
      preventativeControlsInPlace: values.preventativeControlsInPlace || null,
      mitigatingControlsNeeded: values.mitigatingControlsNeeded || null,
      preventativeControlsNeeded: values.preventativeControlsNeeded || null,
      enterpriseRiskId: values.enterpriseRiskId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Risk Finding</DialogTitle>
          <DialogDescription>
            Update the details of this risk finding. Changes are tracked in the audit log.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HIGH">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>High</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="MEDIUM">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Medium</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="LOW">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Low</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description with toolbar */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Description *</FormLabel>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => insertMarkdown("description", "bold")}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => insertMarkdown("description", "italic")}
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => insertMarkdown("description", "code")}
                      >
                        <Code className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => insertMarkdown("description", "list")}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <div className="w-px h-4 bg-border mx-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowDescriptionPreview(!showDescriptionPreview)}
                      >
                        {showDescriptionPreview ? "Edit" : "Preview"}
                      </Button>
                    </div>
                  </div>
                  <FormControl>
                    {showDescriptionPreview ? (
                      <div className="min-h-32 rounded-md border bg-muted/30 p-3">
                        <MarkdownPreview content={descriptionValue} />
                      </div>
                    ) : (
                      <Textarea className="min-h-32 font-mono text-sm" {...field} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Affected Systems */}
            <FormField
              control={form.control}
              name="affectedSystems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affected Systems</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-20"
                      placeholder="List affected systems (comma or newline separated)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Finding Context */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-4">
                <p className="font-medium text-sm text-muted-foreground">Finding Context</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Finding Source */}
                  <FormField
                    control={form.control}
                    name="findingSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Finding Source</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FINDING_SOURCE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* CVE ID */}
                  <FormField
                    control={form.control}
                    name="cveId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CVE/Reference ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., CVE-2024-12345"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Discovery Date */}
                  <FormField
                    control={form.control}
                    name="discoveryDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Discovery Date</FormLabel>
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
                                  <span>Select date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Story 4.7: Impact Assessment Fields */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-4">
                <p className="font-medium text-sm text-muted-foreground">Impact Assessment</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Asset Criticality */}
                  <FormField
                    control={form.control}
                    name="assetCriticality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Criticality</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select criticality level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASSET_CRITICALITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <span className={cn("w-2 h-2 rounded-full",
                                    option.value === "CRITICAL" && "bg-red-500",
                                    option.value === "HIGH" && "bg-orange-500",
                                    option.value === "MEDIUM" && "bg-amber-500",
                                    option.value === "LOW" && "bg-blue-500",
                                    option.value === "NONE" && "bg-gray-400"
                                  )} />
                                  <span className={option.color}>{option.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Business importance of affected systems.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Next Audit Date */}
                  <FormField
                    control={form.control}
                    name="nextAuditDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Next Audit Date</FormLabel>
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
                                  <span>When is the next audit?</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Risks with upcoming audits have higher priority.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Technical Details */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              >
                <div className="flex items-center gap-2">
                  {showTechnicalDetails ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium">Technical Details</span>
                </div>
              </button>

              {showTechnicalDetails && (
                <div className="border-t p-4">
                  <FormField
                    control={form.control}
                    name="technicalDetails"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel className="sr-only">Technical Details</FormLabel>
                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => insertMarkdown("technicalDetails", "bold")}
                            >
                              <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => insertMarkdown("technicalDetails", "code")}
                            >
                              <Code className="h-3.5 w-3.5" />
                            </Button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                setShowTechnicalDetailsPreview(!showTechnicalDetailsPreview)
                              }
                            >
                              {showTechnicalDetailsPreview ? "Edit" : "Preview"}
                            </Button>
                          </div>
                        </div>
                        <FormControl>
                          {showTechnicalDetailsPreview ? (
                            <div className="min-h-24 rounded-md border bg-muted/30 p-3">
                              <MarkdownPreview content={technicalDetailsValue ?? ""} />
                            </div>
                          ) : (
                            <Textarea
                              className="min-h-24 font-mono text-sm"
                              {...field}
                              value={field.value ?? ""}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Organizational Controls Section */}
            <RiskControlsSection riskId={risk.id} />

            {/* Actions */}
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
