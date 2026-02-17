/**
 * Business Unit Select Component
 *
 * Story 7.0.4: User Business Unit Assignment UI
 *
 * Reusable dropdown for selecting a business unit from the organization's hierarchy.
 * Displays units in hierarchical format (e.g., "Engineering > Platform").
 *
 * @see AC6-AC9: Business unit dropdown in user forms
 */

"use client";

import { useMemo } from "react";
import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BusinessUnitSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Whether the "None (Unassigned)" option is shown */
  allowNone?: boolean;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function BusinessUnitSelect({
  value,
  onChange,
  allowNone = true,
  placeholder = "Select Business Unit",
  disabled = false,
}: BusinessUnitSelectProps) {
  // Fetch business unit tree from the organization
  const { data, isLoading } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  // Build flat options with hierarchical labels
  const options = useMemo(() => {
    if (!data?.flatOptions) return [];
    return data.flatOptions;
  }, [data?.flatOptions]);

  const handleChange = (newValue: string) => {
    if (newValue === "__none__") {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">None (Unassigned)</SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
