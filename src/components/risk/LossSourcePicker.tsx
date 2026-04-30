"use client";

/**
 * Loss Source Picker
 *
 * Searchable combobox for picking an Asset or BusinessProcess as the
 * loss-event-range source for a risk assessment. Renders the option's
 * loss min/probable/max alongside its name.
 */

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface LossSourcePickerProps {
  kind: "asset" | "process";
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

function fmt(d: unknown) {
  if (d === null || d === undefined) return "—";
  return `$${Number(d).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function LossSourcePicker({ kind, value, onChange, placeholder }: LossSourcePickerProps) {
  const [open, setOpen] = useState(false);

  const assetQuery = api.asset.list.useQuery(
    { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" },
    { enabled: kind === "asset" },
  );
  const processQuery = api.businessProcess.list.useQuery(
    { page: 1, pageSize: 100, sortBy: "name", sortOrder: "asc" },
    { enabled: kind === "process" },
  );

  const items =
    kind === "asset"
      ? (assetQuery.data?.items ?? []).map((a) => ({
          id: a.id,
          identifier: a.identifier,
          name: a.name,
          lossMinimum: a.lossMinimum,
          lossProbable: a.lossProbable,
          lossMaximum: a.lossMaximum,
        }))
      : (processQuery.data?.items ?? []).map((p) => ({
          id: p.id,
          identifier: p.identifier,
          name: p.name,
          lossMinimum: p.lossMinimum,
          lossProbable: p.lossProbable,
          lossMaximum: p.lossMaximum,
        }));

  const selected = items.find((i) => i.id === value) ?? null;
  const label = kind === "asset" ? "asset" : "business process";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">{selected.identifier} — {selected.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder ?? `Search ${label}…`}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}…`} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">— None —</span>
              </CommandItem>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.identifier} ${item.name}`}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.identifier}</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      Loss: {fmt(item.lossMinimum)} / {fmt(item.lossProbable)} / {fmt(item.lossMaximum)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
