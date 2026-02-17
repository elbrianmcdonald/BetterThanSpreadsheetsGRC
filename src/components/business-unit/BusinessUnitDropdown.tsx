/**
 * Business Unit Dropdown Component
 *
 * Story 7.0.5: BU Hierarchy Picker Component
 *
 * A dropdown/popover wrapper for the BusinessUnitPicker.
 * Shows selected BU(s) in a trigger button.
 *
 * @see AC20-AC24: Dropdown variant requirements
 */

"use client";

import { useState, useMemo } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BusinessUnitPicker } from "./BusinessUnitPicker";
import type { BusinessUnitPickerProps } from "./BusinessUnitPicker";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Building2, X } from "lucide-react";

export interface BusinessUnitDropdownProps
  extends Omit<BusinessUnitPickerProps, "autoFocus" | "className"> {
  /** Trigger button class name */
  triggerClassName?: string;
  /** Popover content class name */
  contentClassName?: string;
  /** Width of the popover content */
  contentWidth?: string | number;
  /** Whether to show clear button */
  clearable?: boolean;
}

export function BusinessUnitDropdown({
  mode,
  value,
  onChange,
  placeholder = "Select Business Unit",
  maxSelections,
  disabled = false,
  triggerClassName,
  contentClassName,
  contentWidth = 320,
  clearable = true,
}: BusinessUnitDropdownProps) {
  const [open, setOpen] = useState(false);

  // Fetch BU data for displaying selected names
  const { data: buData } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Build a lookup map for BU names and paths
  const buLookup = useMemo(() => {
    const map = new Map<string, { name: string; path: string }>();

    if (!buData?.tree) return map;

    // Recursively build path for each BU
    function buildPaths(
      nodes: Array<{
        id: string;
        name: string;
        children: Array<{ id: string; name: string; children: unknown[] }>;
      }>,
      parentPath: string = ""
    ) {
      nodes.forEach((node) => {
        const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
        map.set(node.id, { name: node.name, path });
        buildPaths(node.children as typeof nodes, path);
      });
    }

    buildPaths(buData.tree);
    return map;
  }, [buData?.tree]);

  // Compute trigger label (AC21-AC23)
  const triggerLabel = useMemo(() => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null;
    }

    if (mode === "single" && typeof value === "string") {
      // AC23: Single-select shows BU name with path
      const bu = buLookup.get(value);
      return bu?.path ?? bu?.name ?? "Unknown";
    }

    if (mode === "multi" && Array.isArray(value)) {
      // AC22: Multi-select shows count
      if (value.length === 1) {
        const bu = buLookup.get(value[0]!);
        return bu?.name ?? "1 selected";
      }
      return `${value.length} selected`;
    }

    return null;
  }, [value, mode, buLookup]);

  // Handle selection change
  const handleChange = (newValue: string | string[] | null) => {
    onChange(newValue);

    // AC24: Close on single select
    if (mode === "single" && newValue) {
      setOpen(false);
    }
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const hasValue = triggerLabel !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !hasValue && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {hasValue ? triggerLabel : placeholder}
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && hasValue && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 hover:bg-muted rounded"
                aria-label="Clear selection"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", contentClassName)}
        style={{ width: typeof contentWidth === "number" ? `${contentWidth}px` : contentWidth }}
        align="start"
      >
        <BusinessUnitPicker
          mode={mode}
          value={value}
          onChange={handleChange}
          placeholder="Search business units..."
          maxSelections={maxSelections}
          disabled={disabled}
          autoFocus
          className="border-0"
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Convenience components for common use cases
 */

export interface SingleBUDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  triggerClassName?: string;
}

/**
 * Single-select Business Unit Dropdown
 *
 * Simplified interface for selecting a single business unit.
 */
export function SingleBUDropdown({
  value,
  onChange,
  ...props
}: SingleBUDropdownProps) {
  return (
    <BusinessUnitDropdown
      mode="single"
      value={value}
      onChange={(val) => onChange(val as string | null)}
      {...props}
    />
  );
}

export interface MultiBUDropdownProps {
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  placeholder?: string;
  maxSelections?: number;
  disabled?: boolean;
  clearable?: boolean;
  triggerClassName?: string;
}

/**
 * Multi-select Business Unit Dropdown
 *
 * Simplified interface for selecting multiple business units.
 */
export function MultiBUDropdown({
  value,
  onChange,
  ...props
}: MultiBUDropdownProps) {
  return (
    <BusinessUnitDropdown
      mode="multi"
      value={value}
      onChange={(val) => onChange(val as string[] | null)}
      {...props}
    />
  );
}
