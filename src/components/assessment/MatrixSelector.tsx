"use client";

/**
 * MatrixSelector Component
 *
 * Story 7.8.9: Assessment Form Matrix Integration (AC6-AC10)
 *
 * Dropdown selector for choosing a risk matrix version.
 * Shows active templates with published versions.
 */

import { Grid2X2, Grid3X3, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

interface MatrixSelectorProps {
  /** Currently selected matrix version ID */
  value: string | null | undefined;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Whether the selector is disabled (e.g., after version locking) */
  disabled?: boolean;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional CSS class */
  className?: string;
}

/**
 * Select a risk matrix version from active templates
 *
 * AC6: Assessment form includes Matrix dropdown
 * AC7: Dropdown shows active matrix templates with published versions
 * AC8: Matrix is required before scoring (handled by form validation)
 * AC9: Selecting matrix locks to current published version
 * AC10: Matrix version displayed: "Standard Risk Matrix v2"
 */
export function MatrixSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Select a risk matrix...",
  className,
}: MatrixSelectorProps) {
  const { data: templates, isLoading, error } = api.riskMatrix.getTemplatesWithVersions.useQuery();

  // Find the currently selected template for display
  const selectedTemplate = templates?.find((t) => t.versionId === value);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading risk matrices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center h-10 px-3 border border-destructive rounded-md text-destructive text-sm">
        Failed to load risk matrices
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="flex items-center h-10 px-3 border rounded-md text-muted-foreground text-sm">
        No risk matrices available
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
        <SelectValue placeholder={placeholder}>
          {selectedTemplate && (
            <div className="flex items-center gap-2">
              {selectedTemplate.dimensionCount === 3 ? (
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Grid2X2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{selectedTemplate.displayLabel}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {templates.map((template) => (
          <SelectItem key={template.versionId} value={template.versionId}>
            <div className="flex items-center gap-2">
              {template.dimensionCount === 3 ? (
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Grid2X2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{template.displayLabel}</span>
              <Badge variant="outline" className="ml-1 text-xs">
                {template.dimensionCount}D
              </Badge>
              {template.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Display the selected matrix info with lock status
 */
interface MatrixDisplayProps {
  /** Matrix version ID */
  versionId: string | null | undefined;
  /** Whether the version is locked */
  isLocked?: boolean;
  /** Optional CSS class */
  className?: string;
}

export function MatrixDisplay({
  versionId,
  isLocked = false,
  className,
}: MatrixDisplayProps) {
  const { data: version, isLoading } = api.riskMatrix.getVersionForAssessment.useQuery(
    { id: versionId! },
    { enabled: !!versionId }
  );

  if (!versionId) {
    return (
      <span className="text-muted-foreground text-sm">
        No matrix selected
      </span>
    );
  }

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </span>
    );
  }

  if (!version) {
    return (
      <span className="text-destructive text-sm">
        Matrix not found
      </span>
    );
  }

  return (
    <span className={className}>
      {version.template.name} v{version.versionNumber}
      {isLocked && (
        <Badge variant="outline" className="ml-2 text-xs">
          Locked
        </Badge>
      )}
    </span>
  );
}
