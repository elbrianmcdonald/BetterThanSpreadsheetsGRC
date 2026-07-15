"use client";

/**
 * Creation-time pathway-level tagging for findings and risks.
 *
 * Shared by CreateFindingForm and CreateRiskForm. Unlike the older step-based
 * attach (which required an assessment + a MITRE technique), this is the light,
 * optional many-to-many linkage Brian asked for: pick zero or more existing
 * pathways from the org master library, and/or name new ones (which get created
 * in the library), all without needing an assessment context.
 *
 * It owns no submission logic — it reports its state up via `onChange`. The
 * parent form, after the finding/risk is created, links each existing pathway
 * (`pathway.linkFinding` / `pathway.linkRisk`) and creates-then-links each new
 * name (`pathway.create` with no assessment → link).
 */

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { api } from "@/trpc/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** What the section reports to its parent on every change. */
export interface PathwayTagState {
  enabled: boolean;
  /** Existing master pathways to link. */
  existingIds: string[];
  /** Brand-new pathway names to create (in the library) then link. */
  newNames: string[];
}

interface Chip {
  /** Present for an existing library pathway; absent for a brand-new one. */
  id?: string;
  name: string;
}

export function PathwayTagSection({
  onChange,
}: {
  onChange: (state: PathwayTagState) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);
  const [newName, setNewName] = useState("");

  const listQuery = api.pathway.list.useQuery(undefined, { enabled });
  const options = listQuery.data ?? [];
  const selectedIds = new Set(chips.filter((c) => c.id).map((c) => c.id!));
  const available = options.filter((o) => !selectedIds.has(o.id));

  useEffect(() => {
    onChange({
      enabled,
      existingIds: enabled ? chips.filter((c) => c.id).map((c) => c.id!) : [],
      newNames: enabled ? chips.filter((c) => !c.id).map((c) => c.name) : [],
    });
    // onChange identity is owned by the parent; intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, chips]);

  function addExisting(id: string) {
    const o = options.find((x) => x.id === id);
    if (o && !selectedIds.has(id)) setChips((prev) => [...prev, { id: o.id, name: o.name }]);
  }
  function addNew() {
    const n = newName.trim();
    if (!n) return;
    setChips((prev) => [...prev, { name: n }]);
    setNewName("");
  }
  function removeChip(index: number) {
    setChips((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="pathway-tag"
          checked={enabled}
          onCheckedChange={(c) => setEnabled(c === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="pathway-tag" className="cursor-pointer">
            Link to exploitation pathways
          </Label>
          <p className="text-xs text-muted-foreground">
            Optionally align this to one or more attack paths from the library. Creating a new one
            adds it to the library.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="space-y-3 pl-6">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c, i) => (
                <span
                  key={`${c.id ?? "new"}:${c.name}:${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                >
                  {!c.id && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      new
                    </span>
                  )}
                  <span className="max-w-[220px] truncate">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => removeChip(i)}
                    aria-label={`Remove ${c.name}`}
                    className="rounded-sm p-0.5 transition-colors hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Existing pathway</Label>
            <Select
              value=""
              onValueChange={addExisting}
              disabled={listQuery.isLoading || available.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    listQuery.isLoading
                      ? "Loading pathways…"
                      : available.length === 0
                        ? "No more pathways to add"
                        : "Select a pathway…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {available.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Create new pathway</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNew();
                  }
                }}
                placeholder="New pathway name (e.g. Initial access → domain admin)"
                maxLength={200}
              />
              <Button type="button" variant="outline" onClick={addNew} disabled={!newName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
