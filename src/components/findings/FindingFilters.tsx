"use client";

/**
 * Finding Filters Component
 *
 * Story 7.12: Findings List Page (AC13-AC18)
 *
 * Provides filtering controls for the findings list:
 * - Status multi-select
 * - Source multi-select
 * - Severity multi-select
 * - Search input with debounce
 * - Clear filters button
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { FindingSource, FindingStatus, Severity } from "@prisma/client";
import { Search, X, Filter } from "lucide-react";

import { api } from "@/trpc/react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface FindingFilterState {
  status: FindingStatus[];
  source: FindingSource[];
  severity: Severity[];
  /** Story 20.3: matrix-anchored severity labels (e.g. "Critical") */
  severityLabel: string[];
  search: string;
}

interface FindingFiltersProps {
  filters: FindingFilterState;
  onFiltersChange: (filters: FindingFilterState) => void;
}

/**
 * Status options with labels
 */
const STATUS_OPTIONS: { value: FindingStatus; label: string }[] = [
  { value: FindingStatus.NEW, label: "New" },
  { value: FindingStatus.NEEDS_INFO, label: "Needs Info" },
  { value: FindingStatus.TRIAGED, label: "Triaged" },
  { value: FindingStatus.CLOSED, label: "Closed" },
  { value: FindingStatus.DUPLICATE, label: "Duplicate" },
  { value: FindingStatus.REJECTED, label: "Rejected" },
];

/**
 * Source options with labels
 * Matches FindingSource enum in prisma/schema.prisma
 */
const SOURCE_OPTIONS: { value: FindingSource; label: string }[] = [
  { value: FindingSource.AUDIT, label: "Audit" },
  { value: FindingSource.PENTEST, label: "Pentest" },
  { value: FindingSource.SCANNER, label: "Scanner" },
  { value: FindingSource.INCIDENT, label: "Incident" },
  { value: FindingSource.RISK_ASSESSMENT, label: "Risk Assessment" },
  { value: FindingSource.MANUAL, label: "Manual" },
];

/**
 * Severity options with labels
 */
const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: Severity.HIGH, label: "High" },
  { value: Severity.MEDIUM, label: "Medium" },
  { value: Severity.LOW, label: "Low" },
];

/**
 * Multi-select filter popover component
 */
function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const handleToggle = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <Filter className="mr-2 h-4 w-4" />
          {label}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {selected.length}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 space-y-2">
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`filter-${label}-${option.value}`}
                checked={selected.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <Label
                htmlFor={`filter-${label}-${option.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
          {selected.length > 0 && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FindingFilters({
  filters,
  onFiltersChange,
}: FindingFiltersProps) {
  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // Sync local state when filters change externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleStatusChange = useCallback(
    (status: FindingStatus[]) => {
      onFiltersChange({ ...filters, status });
    },
    [filters, onFiltersChange]
  );

  const handleSourceChange = useCallback(
    (source: FindingSource[]) => {
      onFiltersChange({ ...filters, source });
    },
    [filters, onFiltersChange]
  );

  const handleSeverityChange = useCallback(
    (severity: Severity[]) => {
      onFiltersChange({ ...filters, severity });
    },
    [filters, onFiltersChange]
  );

  const handleSeverityLabelChange = useCallback(
    (severityLabel: string[]) => {
      onFiltersChange({ ...filters, severityLabel });
    },
    [filters, onFiltersChange]
  );

  // Story 20.3: matrix labels present in the org's findings
  const { data: severityLabels } = api.finding.listSeverityLabels.useQuery();
  const severityLabelOptions = useMemo(
    () => (severityLabels ?? []).map((label) => ({ value: label, label })),
    [severityLabels]
  );

  const handleClearAll = () => {
    setSearchInput("");
    onFiltersChange({
      status: [],
      source: [],
      severity: [],
      severityLabel: [],
      search: "",
    });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.source.length > 0 ||
    filters.severity.length > 0 ||
    filters.severityLabel.length > 0 ||
    filters.search.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search input (AC16) */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search findings..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 w-[200px] pl-8"
        />
      </div>

      {/* Status filter (AC13) */}
      <MultiSelectFilter
        label="Status"
        options={STATUS_OPTIONS}
        selected={filters.status}
        onChange={handleStatusChange}
      />

      {/* Source filter (AC14) */}
      <MultiSelectFilter
        label="Source"
        options={SOURCE_OPTIONS}
        selected={filters.source}
        onChange={handleSourceChange}
      />

      {/* Severity filter (AC15) */}
      <MultiSelectFilter
        label="Severity"
        options={SEVERITY_OPTIONS}
        selected={filters.severity}
        onChange={handleSeverityChange}
      />

      {/* Matrix severity label filter (Story 20.3) — only shown when the org
          has matrix-scored findings */}
      {severityLabelOptions.length > 0 && (
        <MultiSelectFilter
          label="Matrix Severity"
          options={severityLabelOptions}
          selected={filters.severityLabel}
          onChange={handleSeverityLabelChange}
        />
      )}

      {/* Clear filters button (AC18) */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={handleClearAll}
        >
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/**
 * Default filter state
 */
export const DEFAULT_FILTERS: FindingFilterState = {
  status: [],
  source: [],
  severity: [],
  severityLabel: [],
  search: "",
};
