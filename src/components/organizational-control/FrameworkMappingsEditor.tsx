"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
import { StandardMappingType } from "@prisma/client";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAPPING_TYPE_OPTIONS } from "./enum-labels";

export interface FrameworkMappingDraft {
  frameworkId: string | null; // Tracked only in the UI; sent as frameworkControlId
  frameworkControlId: string | null;
  mappingType: StandardMappingType;
  notes?: string;
}

interface FrameworkMappingsEditorProps {
  value: FrameworkMappingDraft[];
  onChange: (value: FrameworkMappingDraft[]) => void;
}

export function FrameworkMappingsEditor({ value, onChange }: FrameworkMappingsEditorProps) {
  const { data: frameworks } = api.framework.list.useQuery({});

  const addRow = () => {
    onChange([
      ...value,
      { frameworkId: null, frameworkControlId: null, mappingType: StandardMappingType.EQUIVALENT },
    ]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<FrameworkMappingDraft>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-gray-500">
          No framework mappings yet. This control isn&apos;t linked to any framework requirement.
        </p>
      )}

      {value.map((row, idx) => (
        <FrameworkMappingRow
          key={idx}
          row={row}
          frameworks={frameworks ?? []}
          onChange={(patch) => updateRow(idx, patch)}
          onRemove={() => removeRow(idx)}
        />
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" />
        Add framework mapping
      </Button>
    </div>
  );
}

function FrameworkMappingRow({
  row,
  frameworks,
  onChange,
  onRemove,
}: {
  row: FrameworkMappingDraft;
  frameworks: { id: string; name: string; code: string }[];
  onChange: (patch: Partial<FrameworkMappingDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border bg-gray-50 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Framework</Label>
          <Select
            value={row.frameworkId ?? ""}
            onValueChange={(v) =>
              onChange({ frameworkId: v, frameworkControlId: null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select framework" />
            </SelectTrigger>
            <SelectContent>
              {frameworks.map((fw) => (
                <SelectItem key={fw.id} value={fw.id}>
                  {fw.name} ({fw.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Framework control</Label>
          <FrameworkControlCombobox
            frameworkId={row.frameworkId}
            value={row.frameworkControlId}
            onChange={(id) => onChange({ frameworkControlId: id })}
          />
        </div>

        <div>
          <Label className="text-xs">Mapping type</Label>
          <Select
            value={row.mappingType}
            onValueChange={(v) => onChange({ mappingType: v as StandardMappingType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAPPING_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Notes (optional)</Label>
        <Input
          maxLength={500}
          value={row.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Scope notes or rationale..."
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700 gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}

function FrameworkControlCombobox({
  frameworkId,
  value,
  onChange,
}: {
  frameworkId: string | null;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search via framework.getControls. The endpoint caps at 100 per
  // page; paired with a narrow search term that's enough to navigate 1,000+
  // control frameworks. Without a search term we fall back to the first page.
  const { data: controlsData, isLoading } = api.framework.getControls.useQuery(
    {
      frameworkId: frameworkId!,
      pageSize: 100,
      topLevelOnly: false,
      search: search.trim() || undefined,
    },
    { enabled: !!frameworkId && open }
  );

  // Also fetch the currently selected control so the trigger can render its
  // label even when it isn't in the current page of search results.
  const { data: selectedControl } = api.framework.getControls.useQuery(
    {
      frameworkId: frameworkId!,
      pageSize: 1,
      topLevelOnly: false,
      search: value ?? undefined,
    },
    { enabled: !!frameworkId && !!value }
  );

  const displayedControls = controlsData?.controls ?? [];
  const totalCount = controlsData?.pagination.totalCount ?? 0;
  const hasMore = totalCount > displayedControls.length;

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const fromPage = displayedControls.find((c) => c.id === value);
    if (fromPage) return `${fromPage.controlId} — ${fromPage.title}`;
    const fromSelected = selectedControl?.controls?.find((c) => c.id === value);
    if (fromSelected) return `${fromSelected.controlId} — ${fromSelected.title}`;
    return "Selected control";
  }, [value, displayedControls, selectedControl]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={!frameworkId}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value
              ? selectedLabel
              : frameworkId
                ? "Search framework controls..."
                : "Pick framework first"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search by ID, title, or description..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : displayedControls.length === 0 ? (
              <CommandEmpty>
                {search ? "No controls match that search." : "Start typing to search."}
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={
                  hasMore
                    ? `Showing ${displayedControls.length} of ${totalCount} — refine search to see more`
                    : `${displayedControls.length} result${displayedControls.length === 1 ? "" : "s"}`
                }
              >
                {displayedControls.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setSearch("");
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mr-2",
                        value === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="font-mono text-xs truncate">{c.controlId}</span>
                      <span className="text-sm truncate">{c.title}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
