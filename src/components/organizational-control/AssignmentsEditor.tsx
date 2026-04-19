"use client";

import { Plus, Trash2 } from "lucide-react";
import { AssignmentRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPicker } from "@/components/person/PersonPicker";
import { ASSIGNMENT_ROLE_OPTIONS } from "./enum-labels";

export interface AssignmentDraft {
  personId: string;
  role: AssignmentRole;
}

interface AssignmentsEditorProps {
  value: AssignmentDraft[];
  onChange: (value: AssignmentDraft[]) => void;
}

export function AssignmentsEditor({ value, onChange }: AssignmentsEditorProps) {
  const addRow = () => {
    onChange([...value, { personId: "", role: AssignmentRole.OPERATOR }]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<AssignmentDraft>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const ownerCount = value.filter((a) => a.role === AssignmentRole.OWNER).length;
  const ownerWarning = ownerCount > 1;

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-gray-500">
          No assignees yet. Add at least one owner before saving.
        </p>
      )}

      {value.map((row, idx) => (
        <div key={idx} className="rounded-md border bg-gray-50 p-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">Person</Label>
              <PersonPicker
                value={row.personId || null}
                onChange={(personId) => updateRow(idx, { personId: personId ?? "" })}
                placeholder="Select or create person..."
                clearable
              />
            </div>

            <div>
              <Label className="text-xs">Role</Label>
              <Select
                value={row.role}
                onValueChange={(v) => updateRow(idx, { role: v as AssignmentRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        <span className="text-xs text-muted-foreground">{o.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(idx)}
              className="text-red-600 hover:text-red-700"
              aria-label="Remove assignment"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
          <Plus className="h-4 w-4" />
          Add assignee
        </Button>
        {ownerWarning && (
          <span className="text-xs text-amber-700">
            Multiple owners assigned — most compliance frameworks expect single accountability.
          </span>
        )}
      </div>
    </div>
  );
}
