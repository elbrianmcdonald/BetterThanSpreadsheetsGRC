"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type FrameworkRef =
  | { kind: "none" }
  | { kind: "standard"; id: string; label: string }
  | { kind: "org"; id: string; label: string }
  | { kind: "unresolved"; value: string };

interface Props {
  value: FrameworkRef;
  onChange: (ref: FrameworkRef) => void;
}

export function FrameworkReferencePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [unresolvedDraft, setUnresolvedDraft] = useState(
    value.kind === "unresolved" ? value.value : ""
  );

  const { data: results, isLoading } = api.riskAssessmentTemplate.searchFrameworkRefs.useQuery(
    { query: search },
    { enabled: open, staleTime: 5_000 }
  );

  const summary = (() => {
    switch (value.kind) {
      case "none":
        return <span className="text-muted-foreground">No reference</span>;
      case "standard":
        return (
          <span className="inline-flex items-center gap-2">
            <Badge variant="default">Standard</Badge>
            {value.label}
          </span>
        );
      case "org":
        return (
          <span className="inline-flex items-center gap-2">
            <Badge variant="secondary">Org</Badge>
            {value.label}
          </span>
        );
      case "unresolved":
        return (
          <span className="inline-flex items-center gap-2">
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Unresolved
            </Badge>
            {value.value}
          </span>
        );
    }
  })();

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal"
            >
              {summary}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[480px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search by code, ID, title or name..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {isLoading && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
                )}
                {!isLoading &&
                  results &&
                  results.standardControls.length === 0 &&
                  results.organizationalControls.length === 0 && (
                    <CommandEmpty>No matches.</CommandEmpty>
                  )}
                {results && results.standardControls.length > 0 && (
                  <CommandGroup heading="Framework controls">
                    {results.standardControls.map((sc) => {
                      const label = `${sc.code} — ${sc.title}`;
                      return (
                        <CommandItem
                          key={`s-${sc.id}`}
                          value={`s-${sc.id}`}
                          onSelect={() => {
                            onChange({ kind: "standard", id: sc.id, label });
                            setOpen(false);
                            setSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2",
                              value.kind === "standard" && value.id === sc.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">{sc.standardName}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                {results &&
                  results.standardControls.length > 0 &&
                  results.organizationalControls.length > 0 && <CommandSeparator />}
                {results && results.organizationalControls.length > 0 && (
                  <CommandGroup heading="Organizational controls">
                    {results.organizationalControls.map((oc) => {
                      const label = `${oc.localControlId} — ${oc.name}`;
                      return (
                        <CommandItem
                          key={`o-${oc.id}`}
                          value={`o-${oc.id}`}
                          onSelect={() => {
                            onChange({ kind: "org", id: oc.id, label });
                            setOpen(false);
                            setSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "h-4 w-4 mr-2",
                              value.kind === "org" && value.id === oc.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {value.kind !== "none" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ kind: "none" })}
            title="Clear reference"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Or set an unresolved reference (raw string from CSV import)
        </summary>
        <div className="flex gap-2 mt-2">
          <Input
            value={unresolvedDraft}
            onChange={(e) => setUnresolvedDraft(e.target.value)}
            placeholder="e.g., AC-02 (will resolve later)"
            maxLength={255}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const v = unresolvedDraft.trim();
              if (v) onChange({ kind: "unresolved", value: v });
              else onChange({ kind: "none" });
            }}
          >
            Set
          </Button>
        </div>
      </details>
    </div>
  );
}
