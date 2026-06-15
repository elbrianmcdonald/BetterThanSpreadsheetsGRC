"use client";

/**
 * Create Risk Form Component
 *
 * Form for creating new risk records with validation and template selection.
 *
 * Story 4.1:
 * AC2: Form fields: title (required), description (required), affected systems (multi-line),
 *      severity (HIGH/MEDIUM/LOW dropdown), finding details
 * AC3: Description field supports markdown formatting
 * AC4: Severity selection required before submit
 * AC5: Form validation shows errors for missing required fields
 * AC6: "Create Risk" button submits form via tRPC mutation
 * AC7: Success message displayed on creation with link to risk detail page
 * AC8: Form resets after successful creation for creating multiple risks
 *
 * Story 4.2:
 * AC22: Risk creation form includes template selector dropdown at top
 * AC23: Template selector shows template name and category
 * AC24: Selecting template pre-populates description, control domains, and evidence guidance fields
 * AC25: User can override pre-populated values
 * AC26: "Start from scratch" option available (no template)
 *
 * Story 4.3:
 * AC1: Description field supports markdown formatting (headers, lists, code blocks, links)
 * AC3: Description field shows live markdown preview below textarea
 * AC6: Description field has formatting toolbar (bold, italic, code, list, link buttons)
 * AC18: Risk form includes "Finding Source" field (dropdown)
 * AC19: Risk form includes optional "CVE/Reference ID" field
 * AC20: Risk form includes optional "Discovery Date" field (defaults to creation date)
 * AC21: Risk form includes optional "Technical Details" collapsible section with markdown support
 *
 * @see Story 4.1: Risk Creation via tRPC Procedures and Web Forms
 * @see Story 4.2: Pre-Built Risk Assessment Templates
 * @see Story 4.3: Risk Finding Documentation
 */

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { format } from "date-fns";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileWarning,
  Info,
  FileText,
  Sparkles,
  Bold,
  Italic,
  Code,
  List,
  Link2,
  ChevronDown,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { RiskTemplateCategory, AssetCriticality } from "@prisma/client";

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
import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RiskControlsSection, useRiskControlsState } from "./RiskControlsSection";
import {
  PathwayAttachSection,
  type PathwayAttachState,
} from "@/components/pathway/PathwayAttachSection";

/**
 * Finding source options (Story 4.3 AC18)
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
 * Asset Criticality options (Story 4.7 AC8-AC12)
 */
const ASSET_CRITICALITY_OPTIONS: Array<{
  value: AssetCriticality;
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: "CRITICAL",
    label: "Critical",
    description: "Core business systems - immediate impact",
    color: "text-red-600",
  },
  {
    value: "HIGH",
    label: "High",
    description: "Important systems - significant disruption",
    color: "text-orange-600",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Standard systems - manageable impact",
    color: "text-amber-600",
  },
  {
    value: "LOW",
    label: "Low",
    description: "Non-essential systems - minimal impact",
    color: "text-blue-600",
  },
  {
    value: "NONE",
    label: "None",
    description: "No direct business impact",
    color: "text-gray-500",
  },
];

/**
 * Form schema with Zod validation (AC5, AC16, Story 4.3 AC2, AC18-AC21, Story 4.7 AC8-AC17)
 */
const createRiskSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters") // AC2: 20 char minimum
    .max(10000, "Description must be less than 10,000 characters"), // AC4: up to 10,000 chars
  affectedSystems: z.string().optional(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"], {
    required_error: "Please select a severity level",
  }),
  templateId: z.string().optional(),
  // Story 4.3 fields (AC18-AC21)
  findingSource: z
    .enum([
      "VULNERABILITY_SCAN",
      "PENETRATION_TEST",
      "AUDIT_FINDING",
      "SECURITY_REVIEW",
      "COMPLIANCE_ASSESSMENT",
      "OTHER",
    ])
    .optional(),
  cveId: z
    .string()
    .max(50, "CVE ID must be less than 50 characters")
    .optional(),
  discoveryDate: z.date().optional(),
  technicalDetails: z
    .string()
    .max(10000, "Technical details must be less than 10,000 characters")
    .optional(),
  // Story 4.7 fields (AC8-AC17)
  assetCriticality: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]).optional(),
  nextAuditDate: z.date().optional(),
  // Story 16.3: Controls documentation fields
  mitigatingControlsInPlace: z.string().max(10000).optional().nullable(),
  preventativeControlsInPlace: z.string().max(10000).optional().nullable(),
  mitigatingControlsNeeded: z.string().max(10000).optional().nullable(),
  preventativeControlsNeeded: z.string().max(10000).optional().nullable(),
  // Enterprise Risk alignment
  enterpriseRiskId: z.string().optional().nullable(),
});

type CreateRiskFormValues = z.infer<typeof createRiskSchema>;

/**
 * Helper to format template category for display
 */
const formatCategory = (category: RiskTemplateCategory): string => {
  const labels: Record<RiskTemplateCategory, string> = {
    ACCESS_CONTROL: "Access Control",
    APPLICATION_SECURITY: "Application Security",
    CLOUD_INFRASTRUCTURE: "Cloud Infrastructure",
    DATA_SECURITY: "Data Security",
    NETWORK_SECURITY: "Network Security",
  };
  return labels[category] || category;
};

interface CreateRiskFormProps {
  /** Callback when risk is created successfully */
  onSuccess?: (riskId: string) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

export function CreateRiskForm({ onSuccess, onCancel }: CreateRiskFormProps) {
  const [createdRisk, setCreatedRisk] = useState<{ id: string; title: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [showTechnicalDetailsPreview, setShowTechnicalDetailsPreview] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Organizational controls state for new risk creation
  const { controlsInPlace, controlsNeeded, handleControlsChange } = useRiskControlsState();

  // Story 4.2: Fetch templates (AC22)
  const { data: templates, isLoading: isLoadingTemplates } = api.risk.listRiskTemplates.useQuery();

  // Epic 19: exploitation-pathway attachment state (reported by the section).
  const [pathwayState, setPathwayState] = useState<PathwayAttachState>({
    enabled: false,
    value: null,
  });
  const handlePathwayChange = useCallback(
    (s: PathwayAttachState) => setPathwayState(s),
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  // Create mutation. Success/error handled in onSubmit so we can chain the
  // pathway attach before showing the success screen.
  const createMutation = api.risk.create.useMutation();
  const createPathwayMutation = api.pathway.create.useMutation();
  const addStepMutation = api.pathway.addStep.useMutation();

  // Form setup
  const form = useForm<CreateRiskFormValues>({
    resolver: zodResolver(createRiskSchema),
    defaultValues: {
      title: "",
      description: "",
      affectedSystems: "",
      severity: undefined,
      templateId: undefined,
      // Story 4.3 defaults
      findingSource: undefined,
      cveId: "",
      discoveryDate: undefined,
      technicalDetails: "",
      // Story 4.7 defaults (AC11: Asset criticality defaults to MEDIUM)
      assetCriticality: "MEDIUM" as const,
      nextAuditDate: undefined,
      // Story 16.3: Controls documentation defaults
      mitigatingControlsInPlace: "",
      preventativeControlsInPlace: "",
      mitigatingControlsNeeded: "",
      preventativeControlsNeeded: "",
      enterpriseRiskId: null,
    },
  });

  // Enterprise Risk options for picker
  const { data: enterpriseRiskOptions } = api.enterpriseRisk.listForPicker.useQuery();

  // Watch description value for preview (AC3)
  const descriptionValue = form.watch("description");
  const technicalDetailsValue = form.watch("technicalDetails");

  /**
   * Insert markdown formatting at cursor position (AC6)
   */
  const insertMarkdown = (field: "description" | "technicalDetails", format: string) => {
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

    switch (format) {
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

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };

  // Story 4.2: Handle template selection (AC24)
  const handleTemplateChange = useCallback((templateId: string) => {
    if (templateId === "none") {
      // AC26: "Start from scratch" clears pre-populated values
      setSelectedTemplateId(null);
      form.setValue("templateId", undefined);
      form.setValue("description", "");
      form.setValue("affectedSystems", "");
      form.setValue("severity", undefined as unknown as "HIGH" | "MEDIUM" | "LOW");
      // Reset Story 4.3 fields too
      form.setValue("findingSource", undefined);
      form.setValue("cveId", "");
      form.setValue("discoveryDate", undefined);
      form.setValue("technicalDetails", "");
      // Reset Story 4.7 fields (but keep default asset criticality)
      form.setValue("assetCriticality", "MEDIUM");
      form.setValue("nextAuditDate", undefined);
      // Reset Story 16.3 controls fields
      form.setValue("mitigatingControlsInPlace", "");
      form.setValue("preventativeControlsInPlace", "");
      form.setValue("mitigatingControlsNeeded", "");
      form.setValue("preventativeControlsNeeded", "");
      setShowTechnicalDetails(false);
      return;
    }

    const template = templates?.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    form.setValue("templateId", templateId);

    // AC24: Pre-populate form fields from template
    // Build description with template guidance
    const descriptionWithGuidance = `${template.description}\n\n${template.evidenceGuidance}`;
    form.setValue("description", descriptionWithGuidance);

    // Pre-populate affected systems guidance if available
    if (template.affectedSystemsGuidance) {
      form.setValue("affectedSystems", template.affectedSystemsGuidance);
    }

    // Pre-populate severity default
    form.setValue("severity", template.severityDefault as "HIGH" | "MEDIUM" | "LOW");
  }, [templates, form]);

  // Handle form submission (AC6)
  const onSubmit = async (values: CreateRiskFormValues) => {
    // Block submit when the pathway box is checked but its details are incomplete.
    if (pathwayState.enabled && !pathwayState.value) {
      toast.error(
        "Complete the exploitation pathway details (assessment, pathway, and MITRE technique) or uncheck it.",
      );
      return;
    }

    setSubmitting(true);
    try {
      let risk: { id: string; title: string };
      try {
        risk = await createMutation.mutateAsync({
          ...values,
          // Include organizational control linkages
          controlIdsInPlace: controlsInPlace.length > 0 ? controlsInPlace : undefined,
          controlIdsNeeded: controlsNeeded.length > 0 ? controlsNeeded : undefined,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create risk");
        return;
      }

      // Epic 19: attach to an exploitation pathway if requested. The risk now
      // exists, so a pathway failure is non-fatal — we warn and still continue.
      if (pathwayState.value) {
        const v = pathwayState.value;
        try {
          let pathwayId = v.pathwayId;
          if (!pathwayId && v.newPathwayName) {
            const pathway = await createPathwayMutation.mutateAsync({
              assessmentKind: v.assessmentKind,
              assessmentId: v.assessmentId,
              name: v.newPathwayName,
            });
            pathwayId = pathway.id;
          }
          if (pathwayId) {
            await addStepMutation.mutateAsync({
              pathwayId,
              tactic: v.tactic,
              technique: v.technique,
              mitreTid: v.mitreTid,
              riskIds: [risk.id],
            });
          }
          toast.success("Risk created and added to the exploitation pathway");
        } catch (error) {
          toast.error(
            `Risk created, but adding it to the pathway failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      } else {
        // AC7: Success message displayed with link to detail page
        toast.success("Risk created successfully");
      }

      // AC7/AC8: success screen + reset form for creating multiple risks
      setCreatedRisk({ id: risk.id, title: risk.title });
      form.reset();
      setSelectedTemplateId(null);
      onSuccess?.(risk.id);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle creating another risk
  const handleCreateAnother = () => {
    setCreatedRisk(null);
    setSelectedTemplateId(null);
  };

  // Get the currently selected template for display
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  // Success state (AC7)
  if (createdRisk) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-green-100 p-4 mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Risk Created Successfully
        </h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          &ldquo;{createdRisk.title}&rdquo; has been created and is now open for triage.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCreateAnother}>
            Create Another Risk
          </Button>
          <Button asChild>
            <Link href={`/risks/${createdRisk.id}`}>
              View Risk Details
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Story 4.2: Template Selector (AC22-AC26) */}
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-medium text-gray-700">Start with a Template</p>
                  <p className="text-sm text-gray-500">
                    Templates pre-populate fields with domain-specific guidance and evidence requirements.
                  </p>
                </div>
                <Select
                  value={selectedTemplateId ?? "none"}
                  onValueChange={handleTemplateChange}
                  disabled={isLoadingTemplates}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template or start from scratch"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* AC26: "Start from scratch" option */}
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>Start from scratch</span>
                        <span className="text-xs text-gray-400">— No template</span>
                      </div>
                    </SelectItem>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {/* AC23: Show template name and category */}
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{template.name}</span>
                          <span className="text-xs text-gray-400">— {formatCategory(template.category)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Show selected template info */}
                {selectedTemplate && (
                  <div className="rounded-md bg-white border p-3 text-sm">
                    <p className="font-medium text-gray-700">{selectedTemplate.name}</p>
                    <p className="text-gray-500 mt-1">{selectedTemplate.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-400">Pre-populated domains:</span>
                      {selectedTemplate.prePopulatedDomains.map((domain) => (
                        <span
                          key={domain}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                        >
                          {domain.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Default severity: <span className={
                        selectedTemplate.severityDefault === "HIGH" ? "text-red-600 font-medium" :
                        selectedTemplate.severityDefault === "MEDIUM" ? "text-amber-600 font-medium" :
                        "text-blue-600 font-medium"
                      }>{selectedTemplate.severityDefault}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Title Field (AC2) */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Outdated SSL certificate on production server"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A concise summary of the security finding or risk.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Severity Field (AC2, AC4) */}
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
                      <span className="text-xs text-gray-500">- Immediate attention required</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Medium</span>
                      <span className="text-xs text-gray-500">- Should be addressed soon</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LOW">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Low</span>
                      <span className="text-xs text-gray-500">- Address when resources allow</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                The severity level determines how quickly this risk should be addressed.
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
                onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
                value={field.value ?? "__none"}
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

        {/* Story 4.7: Asset Criticality and Audit Date (AC8-AC17) */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-4">
            <p className="font-medium text-sm text-muted-foreground">Impact Assessment</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AC9: Asset Criticality dropdown */}
              <FormField
                control={form.control}
                name="assetCriticality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Criticality</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                              <span className="text-xs text-gray-400">- {option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* AC12: Help text explains business impact levels */}
                    <FormDescription>
                      Business importance of affected systems. Higher criticality increases impact score.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AC15: Next Audit Date picker */}
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
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {/* AC16: Next audit date optional */}
                    <FormDescription>
                      Optional. Risks with upcoming audits have higher priority.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Description Field (Story 4.3: AC1-AC6) */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Description *</FormLabel>
                {/* AC6: Formatting toolbar */}
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Bold"
                    onClick={() => insertMarkdown("description", "bold")}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Italic"
                    onClick={() => insertMarkdown("description", "italic")}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Code"
                    onClick={() => insertMarkdown("description", "code")}
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="List"
                    onClick={() => insertMarkdown("description", "list")}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Link"
                    onClick={() => insertMarkdown("description", "link")}
                  >
                    <Link2 className="h-3.5 w-3.5" />
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
                  /* AC3: Live markdown preview */
                  <div className="min-h-40 rounded-md border bg-muted/30 p-3">
                    <MarkdownPreview content={descriptionValue} />
                  </div>
                ) : (
                  <Textarea
                    placeholder="Describe the security finding in detail. Include:
- What was discovered
- How it was discovered (scan, manual review, etc.)
- Potential impact if exploited
- Recommended remediation steps"
                    className="min-h-40 font-mono text-sm"
                    {...field}
                  />
                )}
              </FormControl>
              <FormDescription className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                Supports markdown formatting for rich text.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Affected Systems Field (AC7-AC11) */}
        <FormField
          control={form.control}
          name="affectedSystems"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Affected Systems</FormLabel>
              <FormControl>
                {/* AC7: Multi-line textarea, AC8: comma or newline separated, AC9: placeholder examples */}
                <Textarea
                  placeholder="List the systems, applications, or assets affected by this risk.
e.g.,
- web-server-01.example.com
- customer-api-prod
- Internal HR database"
                  className="min-h-24"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {/* AC11: Optional field */}
                Optional: Identify specific systems impacted by this finding. Use commas or new lines to separate entries.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Story 4.3: Finding Context Fields (AC18-AC22) */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-4">
            <p className="font-medium text-sm text-muted-foreground">Finding Context (Optional)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AC18: Finding Source dropdown */}
              <FormField
                control={form.control}
                name="findingSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Finding Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="How was this discovered?" />
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

              {/* AC19: CVE/Reference ID */}
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AC20: Discovery Date */}
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
                              <span>When was this discovered?</span>
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

        {/* AC21: Technical Details collapsible section */}
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
              <span className="text-sm text-muted-foreground">(Optional)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Markdown supported
            </span>
          </button>

          {showTechnicalDetails && (
            <div className="border-t p-4 space-y-3">
              <FormField
                control={form.control}
                name="technicalDetails"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="sr-only">Technical Details</FormLabel>
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Bold"
                          onClick={() => insertMarkdown("technicalDetails", "bold")}
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Code"
                          onClick={() => insertMarkdown("technicalDetails", "code")}
                        >
                          <Code className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="List"
                          onClick={() => insertMarkdown("technicalDetails", "list")}
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setShowTechnicalDetailsPreview(!showTechnicalDetailsPreview)}
                        >
                          {showTechnicalDetailsPreview ? "Edit" : "Preview"}
                        </Button>
                      </div>
                    </div>
                    <FormControl>
                      {showTechnicalDetailsPreview ? (
                        <div className="min-h-32 rounded-md border bg-muted/30 p-3">
                          <MarkdownPreview content={technicalDetailsValue || ""} />
                        </div>
                      ) : (
                        <Textarea
                          placeholder="Add technical details such as:
- Configuration snippets
- Log excerpts
- Reproduction steps
- Technical analysis"
                          className="min-h-32 font-mono text-sm"
                          {...field}
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
        <RiskControlsSection
          onControlsChange={handleControlsChange}
        />

        {/* Epic 19: Exploitation pathway attachment */}
        <PathwayAttachSection onChange={handlePathwayChange} />

        {/* Severity Guide */}
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileWarning className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-700">Severity Guide</p>
                <ul className="text-gray-600 space-y-1">
                  <li>
                    <span className="font-medium text-red-600">High:</span> Active exploitation possible, critical data at risk, or compliance violation
                  </li>
                  <li>
                    <span className="font-medium text-amber-600">Medium:</span> Potential for exploitation, moderate impact if compromised
                  </li>
                  <li>
                    <span className="font-medium text-blue-600">Low:</span> Informational or best practice improvement, minimal direct risk
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {createMutation.isError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{createMutation.error.message}</span>
            </div>
          </div>
        )}

        {/* Form Actions (AC6) */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Risk...
              </>
            ) : (
              "Create Risk"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
