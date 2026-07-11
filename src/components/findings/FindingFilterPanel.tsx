"use client";

/**
 * Finding Filter Panel Component
 *
 * Restyle of the findings register filter to match the Risk register's
 * RiskFilterPanel look/UX (collapsible panel + removable active-filter chips +
 * multi-select checkbox groups). Wired to FINDING facets rather than risk enums:
 *
 * - Search (debounced text)                → finding.list `search`
 * - Status (FindingStatus, multi-select)   → finding.list `status`
 * - Source (FindingSource, multi-select)   → finding.list `source`
 * - Severity (Severity, multi-select)      → finding.list `severity`
 * - Matrix Severity (dynamic labels)       → finding.list `severityLabel`
 *
 * State is callback-driven (same `{ filters, onFiltersChange }` contract as the
 * previous FindingFilters component) so the register's existing wiring — URL
 * seeding, pagination reset, export params — is preserved unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FindingSource, FindingStatus, Severity } from "@prisma/client";
import { Search, X, Filter, ChevronDown, ChevronUp } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import {
  type FindingFilterState,
  DEFAULT_FILTERS,
} from "@/components/findings/FindingFilters";

interface FindingFilterPanelProps {
  filters: FindingFilterState;
  onFiltersChange: (filters: FindingFilterState) => void;
}

/** Status options with labels (FindingStatus). */
const STATUS_OPTIONS: { value: FindingStatus; label: string }[] = [
  { value: FindingStatus.NEW, label: "New" },
  { value: FindingStatus.NEEDS_INFO, label: "Needs Info" },
  { value: FindingStatus.TRIAGED, label: "Triaged" },
  { value: FindingStatus.CLOSED, label: "Closed" },
  { value: FindingStatus.DUPLICATE, label: "Duplicate" },
  { value: FindingStatus.REJECTED, label: "Rejected" },
];

/** Source options with labels (FindingSource). */
const SOURCE_OPTIONS: { value: FindingSource; label: string }[] = [
  { value: FindingSource.AUDIT, label: "Audit" },
  { value: FindingSource.PENTEST, label: "Pentest" },
  { value: FindingSource.SCANNER, label: "Scanner" },
  { value: FindingSource.INCIDENT, label: "Incident" },
  { value: FindingSource.RISK_ASSESSMENT, label: "Risk Assessment" },
  { value: FindingSource.MANUAL, label: "Manual" },
];

/** Severity options with color-coded dots (mirrors RiskFilterPanel styling). */
const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: Severity.HIGH, label: "High", color: "bg-red-500" },
  { value: Severity.MEDIUM, label: "Medium", color: "bg-amber-500" },
  { value: Severity.LOW, label: "Low", color: "bg-green-500" },
];

const STATUS_LABELS: Record<FindingStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FindingStatus, string>;

const SOURCE_LABELS: Record<FindingSource, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FindingSource, string>;

const SEVERITY_META: Record<Severity, { label: string; color: string }> =
  Object.fromEntries(
    SEVERITY_OPTIONS.map((o) => [o.value, { label: o.label, color: o.color }]),
  ) as Record<Severity, { label: string; color: string }>;

export function FindingFilterPanel({
  filters,
  onFiltersChange,
}: FindingFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Local search state for debouncing (ported from FindingFilters).
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // Sync local search state when filters change externally (e.g. Clear all).
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Story 20.3: matrix labels present in the org's findings.
  const { data: severityLabels } = api.finding.listSeverityLabels.useQuery();
  const severityLabelOptions = useMemo(
    () => (severityLabels ?? []).map((label) => ({ value: label, label })),
    [severityLabels],
  );

  // Toggle a value in a multi-select finding facet.
  const toggleMultiSelect = useCallback(
    <T extends string>(
      key: "status" | "source" | "severity" | "severityLabel",
      value: T,
    ) => {
      const current = filters[key] as T[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ ...filters, [key]: next });
    },
    [filters, onFiltersChange],
  );

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    onFiltersChange({ ...DEFAULT_FILTERS });
  }, [onFiltersChange]);

  const activeFilterCount =
    filters.status.length +
    filters.source.length +
    filters.severity.length +
    filters.severityLabel.length;

  const hasActiveFilters = activeFilterCount > 0 || filters.search.length > 0;

  return (
    <div className="space-y-4">
      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {filters.severity.map((severity) => (
            <Badge
              key={severity}
              variant="secondary"
              className="flex items-center gap-1 pl-2"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  SEVERITY_META[severity].color,
                )}
              />
              {SEVERITY_META[severity].label}
              <button
                onClick={() => toggleMultiSelect("severity", severity)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.status.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {STATUS_LABELS[status]}
              <button
                onClick={() => toggleMultiSelect("status", status)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.source.map((source) => (
            <Badge
              key={source}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {SOURCE_LABELS[source]}
              <button
                onClick={() => toggleMultiSelect("source", source)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.severityLabel.map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {label}
              <button
                onClick={() => toggleMultiSelect("severityLabel", label)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Search input (always visible) */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search findings..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8"
        />
      </div>

      {/* Collapsible Filter Panel */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4 border rounded-lg bg-card">
            {/* Status Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Status</h4>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.status.includes(option.value)}
                      onCheckedChange={() =>
                        toggleMultiSelect("status", option.value)
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Source Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Source</h4>
              <div className="space-y-2">
                {SOURCE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.source.includes(option.value)}
                      onCheckedChange={() =>
                        toggleMultiSelect("source", option.value)
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Severity</h4>
              <div className="space-y-2">
                {SEVERITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.severity.includes(option.value)}
                      onCheckedChange={() =>
                        toggleMultiSelect("severity", option.value)
                      }
                    />
                    <span className={cn("w-3 h-3 rounded-full", option.color)} />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Matrix Severity Filter — only shown when the org has
                matrix-scored findings (dynamic labels). */}
            {severityLabelOptions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Matrix Severity</h4>
                <div className="space-y-2">
                  {severityLabelOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.severityLabel.includes(option.value)}
                        onCheckedChange={() =>
                          toggleMultiSelect("severityLabel", option.value)
                        }
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
