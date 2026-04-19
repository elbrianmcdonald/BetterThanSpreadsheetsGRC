"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  ControlType,
  ControlNature,
  type AutomationLevel,
  OrgControlStatus,
  ControlFrequency,
  AssignmentRole,
} from "@prisma/client";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FrameworkMappingsEditor,
  type FrameworkMappingDraft,
} from "./FrameworkMappingsEditor";
import { AssignmentsEditor, type AssignmentDraft } from "./AssignmentsEditor";
import {
  EvidenceRequirementsEditor,
  type EvidenceRequirementDraft,
} from "./EvidenceRequirementsEditor";
import {
  CONTROL_TYPE_OPTIONS,
  CONTROL_NATURE_OPTIONS,
  ORG_CONTROL_STATUS_OPTIONS,
  CONTROL_FREQUENCY_OPTIONS,
} from "./enum-labels";

const formSchema = z.object({
  localControlId: z.string().max(50).optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  controlType: z.nativeEnum(ControlType),
  nature: z.nativeEnum(ControlNature).optional(),
  status: z.nativeEnum(OrgControlStatus),
  implementationNarrative: z.string().max(10000).optional(),
  scope: z.string().max(5000).optional(),
  frequency: z.nativeEnum(ControlFrequency).optional(),
});

type FormValues = z.input<typeof formSchema>;

const NONE = "__none__";

export interface OrgControlFormInitialValues {
  id?: string;
  localControlId: string;
  name: string;
  description: string | null;
  objective: string | null;
  family: string | null;
  controlType: ControlType;
  nature: ControlNature | null;
  automationLevel: AutomationLevel | null;
  status: OrgControlStatus;
  implementationNarrative: string | null;
  scope: string | null;
  frequency: ControlFrequency | null;
  procedureRunbookLink: string | null;
  reviewCycleMonths: number | null;
  frameworkMappings: FrameworkMappingDraft[];
  assignments: AssignmentDraft[];
}

interface OrgControlFormProps {
  mode: "create" | "edit";
  initialValues?: OrgControlFormInitialValues;
  onCancel: () => void;
}

export function OrgControlForm({ mode, initialValues, onCancel }: OrgControlFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const [mappings, setMappings] = useState<FrameworkMappingDraft[]>(
    initialValues?.frameworkMappings ?? []
  );
  const [assignments, setAssignments] = useState<AssignmentDraft[]>(
    initialValues?.assignments ?? []
  );
  const [requirements, setRequirements] = useState<EvidenceRequirementDraft[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      localControlId: initialValues?.localControlId ?? "",
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      objective: initialValues?.objective ?? "",
      controlType: initialValues?.controlType ?? ControlType.PREVENTIVE,
      nature: initialValues?.nature ?? undefined,
      status: initialValues?.status ?? OrgControlStatus.NOT_IMPLEMENTED,
      implementationNarrative: initialValues?.implementationNarrative ?? "",
      scope: initialValues?.scope ?? "",
      frequency: initialValues?.frequency ?? undefined,
    },
  });

  const createMutation = api.organizationalControl.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Created control "${data.name}"`);
      void utils.organizationalControl.list.invalidate();
      void utils.organizationalControl.distinctFamilies.invalidate();
      router.push(`/controls/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create control");
    },
  });

  const updateMutation = api.organizationalControl.update.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated control "${data.name}"`);
      void utils.organizationalControl.list.invalidate();
      void utils.organizationalControl.getById.invalidate({ id: data.id });
      router.push(`/controls/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update control");
    },
  });

  const onSubmit = (values: FormValues) => {
    // Validation: require ≥1 OWNER
    const ownerCount = assignments.filter((a) => a.role === AssignmentRole.OWNER).length;
    if (ownerCount < 1) {
      toast.error("At least one OWNER assignment is required");
      return;
    }

    // Validation: mappings must have both framework + control control filled (if any row)
    const incompleteMapping = mappings.find(
      (m) => !m.frameworkControlId || !m.mappingType
    );
    if (incompleteMapping) {
      toast.error("Every framework mapping row needs a framework control + mapping type");
      return;
    }

    // Validation: assignments must have personId
    const incompleteAssignment = assignments.find((a) => !a.personId);
    if (incompleteAssignment) {
      toast.error("Every assignment row needs a person selected");
      return;
    }

    // Validation: requirements must have description
    const incompleteRequirement = requirements.find((r) => !r.description.trim());
    if (incompleteRequirement) {
      toast.error("Every evidence requirement needs a description");
      return;
    }

    const payload = {
      localControlId: values.localControlId?.trim() || undefined,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      objective: values.objective?.trim() || null,
      controlType: values.controlType,
      nature: values.nature ?? null,
      status: values.status,
      implementationNarrative: values.implementationNarrative?.trim() || null,
      scope: values.scope?.trim() || null,
      frequency: values.frequency ?? null,
      frameworkMappings: mappings.map((m) => ({
        frameworkControlId: m.frameworkControlId!,
        mappingType: m.mappingType,
        notes: m.notes?.trim() || undefined,
      })),
      assignments: assignments.map((a) => ({
        personId: a.personId,
        role: a.role,
      })),
      // Evidence requirements only sent on create (edit flow manages them on the detail tab)
      ...(mode === "create" && {
        evidenceRequirements: requirements.map((r) => ({
          description: r.description.trim(),
          artifactType: r.artifactType,
          required: r.required,
          ownerId: r.ownerId,
        })),
      }),
    };

    if (mode === "create") {
      createMutation.mutate(payload);
    } else if (initialValues?.id) {
      updateMutation.mutate({ id: initialValues.id, data: payload });
    }
  };

  const isSaving = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identification */}
      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
          <CardDescription>How this control is identified across your organization.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="localControlId">Local control ID</Label>
            <Input id="localControlId" placeholder="AC-001 (auto-generated if blank)" {...register("localControlId")} />
            {errors.localControlId && (
              <p className="text-xs text-red-600 mt-1">{errors.localControlId.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" placeholder="MFA on Admin Accounts" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="What this control does at a high level..."
              {...register("description")}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="objective">Objective</Label>
            <Textarea
              id="objective"
              rows={3}
              placeholder="The outcome this control is meant to achieve..."
              {...register("objective")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
          <CardDescription>
            Type (preventive/detective/…) and nature (technical/administrative/physical) describe different axes — a control has both.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>
              Control type <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="controlType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTROL_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex flex-col">
                          <span>{o.label}</span>
                          <span className="text-xs text-muted-foreground">{o.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Nature</Label>
            <Controller
              name="nature"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? undefined : (v as ControlNature))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {CONTROL_NATURE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex flex-col">
                          <span>{o.label}</span>
                          <span className="text-xs text-muted-foreground">{o.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Implementation */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation</CardTitle>
          <CardDescription>Current operational state and narrative.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Status <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_CONTROL_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="implementationNarrative">Implementation narrative</Label>
            <Textarea
              id="implementationNarrative"
              rows={4}
              placeholder="How this control is implemented in practice — systems, processes, people..."
              {...register("implementationNarrative")}
            />
          </div>
          <div>
            <Label htmlFor="scope">Scope</Label>
            <Textarea
              id="scope"
              rows={3}
              placeholder="Systems, environments, business units, or data covered by this control..."
              {...register("scope")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test cadence */}
      <Card>
        <CardHeader>
          <CardTitle>Test cadence</CardTitle>
          <CardDescription>How often this control is tested.</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Review cycle</Label>
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) =>
                    field.onChange(v === NONE ? undefined : (v as ControlFrequency))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {CONTROL_FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ownership */}
      <Card>
        <CardHeader>
          <CardTitle>Ownership</CardTitle>
          <CardDescription>
            RACI assignments. At least one <strong>Owner</strong> is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentsEditor value={assignments} onChange={setAssignments} />
        </CardContent>
      </Card>

      {/* Evidence requirements (create mode only — edit via detail tab) */}
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence requirements (optional)</CardTitle>
            <CardDescription>
              Describe the evidence auditors should expect for this control. You can add, edit, or
              remove requirements later from the Evidence tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvidenceRequirementsEditor value={requirements} onChange={setRequirements} />
          </CardContent>
        </Card>
      )}

      {/* Framework mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Framework mapping</CardTitle>
          <CardDescription>
            Map this control to one or more framework requirements (NIST, CSF, etc.) for compliance tracking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FrameworkMappingsEditor value={mappings} onChange={setMappings} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : mode === "create" ? (
            "Create control"
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
