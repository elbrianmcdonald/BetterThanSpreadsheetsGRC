"use client";

/**
 * AssessmentTypeSelector Component
 *
 * Story 7.8.9: Assessment Form Matrix Integration (AC1-AC5)
 *
 * Dropdown selector for choosing an assessment type.
 * Shows active assessment types for the organization.
 */

import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

interface AssessmentTypeSelectorProps {
  /** Currently selected assessment type ID */
  value: string | null | undefined;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Whether the selector is disabled (e.g., after locking) */
  disabled?: boolean;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * Select an assessment type from active types in the organization
 *
 * AC1: Assessment form includes Assessment Type dropdown
 * AC2: Dropdown shows active assessment types for organization
 * AC3: Type is required before proceeding (handled by form validation)
 * AC4: Type selection can be changed before submission
 * AC5: Type locked after initial save (controlled via disabled prop)
 */
export function AssessmentTypeSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Select assessment type...",
  className,
}: AssessmentTypeSelectorProps) {
  const { data: types, isLoading, error } = api.assessmentType.getActiveTypes.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading assessment types...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center h-10 px-3 border border-destructive rounded-md text-destructive text-sm">
        Failed to load assessment types
      </div>
    );
  }

  if (!types || types.length === 0) {
    return (
      <div className="flex items-center h-10 px-3 border rounded-md text-muted-foreground text-sm">
        No assessment types available
      </div>
    );
  }

  return (
    <Select
      value={value ?? ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {types.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            <div className="flex flex-col">
              <span>{type.name}</span>
              {type.description && (
                <span className="text-xs text-muted-foreground">
                  {type.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
