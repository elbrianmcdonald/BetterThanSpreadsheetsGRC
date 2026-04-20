"use client";

/**
 * Inline editor for per-risk remediation options embedded in the assessment
 * creation form. Collects an array of drafts that the router bulk-inserts
 * into RemediationOption (linked by riskId) after the parent Risk is created.
 */

import { Plus, Trash2 } from "lucide-react";
import type { Control, UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPicker } from "@/components/person/PersonPicker";

const EFFORT_OPTIONS = [
  { value: "LOW", label: "Low (< 1 week)" },
  { value: "MEDIUM", label: "Medium (1-4 weeks)" },
  { value: "HIGH", label: "High (1-3 months)" },
  { value: "VERY_HIGH", label: "Very high (> 3 months)" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "RECOMMENDED", label: "Recommended" },
  { value: "ALTERNATIVE", label: "Alternative" },
  { value: "NOT_RECOMMENDED", label: "Not recommended" },
] as const;

export function RemediationOptionsEditor({
  control,
  index,
}: {
  // Using any here because the outer form's value shape is deeply nested
  // and react-hook-form's generic variance isn't worth the ceremony for an
  // internal editor.
  control: Control<any>;
  index: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `risks.${index}.remediationOptions`,
  });

  const addOption = () => {
    append({
      title: "",
      description: "",
      approach: "",
      costEstimate: 0,
      timelineEstimate: "",
      effortLevel: "MEDIUM",
      priority: "RECOMMENDED",
      ownerId: null,
    });
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No remediation options yet. Add one or more to document treatment
          alternatives for this risk.
        </p>
      )}

      {fields.map((field, optIdx) => (
        <div
          key={field.id}
          className="rounded-md border bg-muted/20 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Option {optIdx + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 gap-1"
              onClick={() => remove(optIdx)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>

          <OptionField
            control={control}
            name={`risks.${index}.remediationOptions.${optIdx}.title`}
            label="Title *"
            placeholder="Short, descriptive title"
          />
          <OptionTextarea
            control={control}
            name={`risks.${index}.remediationOptions.${optIdx}.description`}
            label="Description *"
            placeholder="What problem this option solves"
            rows={2}
          />
          <OptionTextarea
            control={control}
            name={`risks.${index}.remediationOptions.${optIdx}.approach`}
            label="Approach *"
            placeholder="How the option would be implemented"
            rows={2}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OptionField
              control={control}
              name={`risks.${index}.remediationOptions.${optIdx}.costEstimate`}
              label="Cost estimate (USD) *"
              placeholder="0"
              type="number"
            />
            <OptionField
              control={control}
              name={`risks.${index}.remediationOptions.${optIdx}.timelineEstimate`}
              label="Timeline *"
              placeholder="e.g. 2-3 weeks"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <OptionSelect
              control={control}
              name={`risks.${index}.remediationOptions.${optIdx}.effortLevel`}
              label="Effort level *"
              options={EFFORT_OPTIONS}
            />
            <OptionSelect
              control={control}
              name={`risks.${index}.remediationOptions.${optIdx}.priority`}
              label="Priority *"
              options={PRIORITY_OPTIONS}
            />
          </div>

          <OptionPerson
            control={control}
            name={`risks.${index}.remediationOptions.${optIdx}.ownerId`}
            label="Owner"
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOption}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add remediation option
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight field wrappers — react-hook-form's generic form context isn't
// typed through nested field arrays nicely, so these use the useController
// equivalent inline with minimal typing.
// ---------------------------------------------------------------------------

import { useController } from "react-hook-form";

function OptionField({
  control,
  name,
  label,
  placeholder,
  type = "text",
}: {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  const { field } = useController({ control, name });
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={field.value ?? ""}
        onChange={(e) =>
          field.onChange(type === "number" ? Number(e.target.value) : e.target.value)
        }
        placeholder={placeholder}
      />
    </div>
  );
}

function OptionTextarea({
  control,
  name,
  label,
  placeholder,
  rows = 2,
}: {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
}) {
  const { field } = useController({ control, name });
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={rows}
        value={field.value ?? ""}
        onChange={(e) => field.onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function OptionSelect({
  control,
  name,
  label,
  options,
}: {
  control: Control<any>;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const { field } = useController({ control, name });
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={field.value ?? ""} onValueChange={field.onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OptionPerson({
  control,
  name,
  label,
}: {
  control: Control<any>;
  name: string;
  label: string;
}) {
  const { field } = useController({ control, name });
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <PersonPicker
        value={field.value ?? null}
        onChange={(id) => field.onChange(id ?? null)}
        placeholder="Unassigned"
        clearable
      />
    </div>
  );
}
