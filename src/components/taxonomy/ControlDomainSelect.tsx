"use client";

/**
 * Control Domain Select Component
 *
 * Reusable dropdown for selecting control domains (simplified taxonomy).
 * Supports single-select and multi-select modes.
 *
 * @see Story 2.3: Simplified Control Taxonomy Definition (AC14-AC19)
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X, Loader2, Info } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface ControlDomainSelectProps {
  /** Single value for single-select mode */
  value?: string;
  /** Multiple values for multi-select mode */
  values?: string[];
  /** Callback for single-select mode */
  onChange?: (value: string) => void;
  /** Callback for multi-select mode */
  onChangeMulti?: (values: string[]) => void;
  /** Selection mode */
  mode?: "single" | "multi";
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Show descriptions as tooltips */
  showTooltips?: boolean;
}

export function ControlDomainSelect({
  value,
  values = [],
  onChange,
  onChangeMulti,
  mode = "single",
  placeholder = "Select control domain...",
  disabled = false,
  showTooltips = true,
}: ControlDomainSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: domains, isLoading } = api.controlDomain.list.useQuery();

  // Handle single selection
  const handleSingleSelect = (domainId: string) => {
    onChange?.(domainId);
    setOpen(false);
  };

  // Handle multi selection
  const handleMultiSelect = (domainId: string) => {
    const newValues = values.includes(domainId)
      ? values.filter((v) => v !== domainId)
      : [...values, domainId];
    onChangeMulti?.(newValues);
  };

  // Remove a selected value in multi-select mode
  const handleRemove = (domainId: string) => {
    onChangeMulti?.(values.filter((v) => v !== domainId));
  };

  // Get domain name by ID
  const getDomainName = (id: string) => {
    return domains?.find((d) => d.id === id)?.name ?? id;
  };

  // Get domain description by ID
  const getDomainDescription = (id: string) => {
    return domains?.find((d) => d.id === id)?.description ?? "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading domains...</span>
      </div>
    );
  }

  // Single select mode
  if (mode === "single") {
    return (
      <Select value={value} onValueChange={handleSingleSelect} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {domains?.map((domain) => (
            <SelectItem key={domain.id} value={domain.id}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <span>{domain.name}</span>
                      {showTooltips && (
                        <Info className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {showTooltips && (
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">{domain.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Multi-select mode
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {values.length > 0
              ? `${values.length} domain${values.length > 1 ? "s" : ""} selected`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search domains..." />
            <CommandList>
              <CommandEmpty>No domains found.</CommandEmpty>
              <CommandGroup>
                {domains?.map((domain) => (
                  <CommandItem
                    key={domain.id}
                    value={domain.name}
                    onSelect={() => handleMultiSelect(domain.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        values.includes(domain.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <span>{domain.name}</span>
                      {showTooltips && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {domain.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected domains as badges */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((domainId) => (
            <TooltipProvider key={domainId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1">
                    {getDomainName(domainId)}
                    <button
                      type="button"
                      onClick={() => handleRemove(domainId)}
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </button>
                  </Badge>
                </TooltipTrigger>
                {showTooltips && (
                  <TooltipContent>
                    <p className="max-w-xs text-sm">{getDomainDescription(domainId)}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}
    </div>
  );
}
