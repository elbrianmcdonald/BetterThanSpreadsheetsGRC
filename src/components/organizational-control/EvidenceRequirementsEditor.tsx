"use client";

import { Plus, Trash2 } from "lucide-react";
import { EvidenceArtifactType } from "@prisma/client";
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

export interface EvidenceRequirementDraft {
  description: string;
  artifactType: EvidenceArtifactType;
  required: boolean;
  ownerId: string | null;
}

const ARTIFACT_TYPE_OPTIONS: { value: EvidenceArtifactType; label: string }[] = [
  { value: EvidenceArtifactType.LOG, label: "Log" },
  { value: EvidenceArtifactType.TICKET, label: "Ticket" },
  { value: EvidenceArtifactType.SCREENSHOT, label: "Screenshot" },
  { value: EvidenceArtifactType.APPROVAL, label: "Approval" },
  { value: EvidenceArtifactType.POLICY_DOCUMENT, label: "Policy document" },
  { value: EvidenceArtifactType.CONFIGURATION, label: "Configuration" },
  { value: EvidenceArtifactType.OTHER, label: "Other" },
];

export function makeEmptyRequirement(): EvidenceRequirementDraft {
  return {
    description: "",
    artifactType: EvidenceArtifactType.LOG,
    required: true,
    ownerId: null,
  };
}

interface Props {
  value: EvidenceRequirementDraft[];
  onChange: (value: EvidenceRequirementDraft[]) => void;
}

export function EvidenceRequirementsEditor({ value, onChange }: Props) {
  const addRow = () => onChange([...value, makeEmptyRequirement()]);
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<EvidenceRequirementDraft>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-gray-500">
          No requirements yet. Add one to describe the evidence auditors should expect.
        </p>
      )}

      {value.map((row, idx) => (
        <div key={idx} className="rounded-md border bg-gray-50 p-4 space-y-3">
          <div>
            <Label className="text-xs">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={2}
              placeholder="e.g., Monthly access review report showing privileged accounts reviewed..."
              value={row.description}
              onChange={(e) => updateRow(idx, { description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">Artifact type</Label>
              <Select
                value={row.artifactType}
                onValueChange={(v) =>
                  updateRow(idx, { artifactType: v as EvidenceArtifactType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTIFACT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Owner</Label>
              <PersonPicker
                value={row.ownerId}
                onChange={(id) => updateRow(idx, { ownerId: id ?? null })}
                placeholder="Unassigned"
                clearable
              />
            </div>

            <label className="flex items-center gap-2 text-sm pb-2">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={row.required}
                onChange={(e) => updateRow(idx, { required: e.target.checked })}
              />
              Required
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeRow(idx)}
              className="text-red-600 hover:text-red-700 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" />
        Add requirement
      </Button>
    </div>
  );
}
