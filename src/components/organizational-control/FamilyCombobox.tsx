"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
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

interface FamilyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FamilyCombobox({ value, onChange, placeholder = "Select or create family..." }: FamilyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: families } = api.organizationalControl.distinctFamilies.useQuery();

  const options = useMemo(() => families ?? [], [families]);

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return options.find((f) => f.toLowerCase() === q) ?? null;
  }, [search, options]);

  const showCreateOption = !!search.trim() && !exactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search or type new family..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {showCreateOption && (
              <>
                <CommandGroup heading="Create new">
                  <CommandItem
                    value={`__create__${search}`}
                    onSelect={() => {
                      onChange(search.trim());
                      setSearch("");
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Use &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
                {options.length > 0 && <CommandSeparator />}
              </>
            )}
            {options.length > 0 ? (
              <CommandGroup heading="Existing">
                {options.map((f) => (
                  <CommandItem
                    key={f}
                    value={f}
                    onSelect={() => {
                      onChange(f);
                      setSearch("");
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check className={cn("h-4 w-4 mr-2", value === f ? "opacity-100" : "opacity-0")} />
                    {f}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              !showCreateOption && <CommandEmpty>No families yet. Type to create one.</CommandEmpty>
            )}
            {value && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="cursor-pointer text-muted-foreground"
                  >
                    Clear selection
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
