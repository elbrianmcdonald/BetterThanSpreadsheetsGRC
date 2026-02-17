"use client";

/**
 * Framework Filter Component
 *
 * Dropdown filter for evidence list filtering by compliance framework.
 * Displays active filter as removable badge and syncs with URL query params.
 *
 * @see Story 3.7: AC1-AC7 - Framework Filter UI
 */

import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, X } from "lucide-react";
import { useEvidenceFilters } from "@/hooks/useEvidenceFilters";

interface FrameworkFilterProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Framework filter dropdown with active filter badge
 *
 * Features:
 * - AC1: Displays framework filter dropdown above table
 * - AC2: Populated with active frameworks for organization
 * - AC3: Selecting framework filters evidence
 * - AC4: Filter state persisted in URL query param
 * - AC5: Clear Filter button resets filter
 * - AC6: Active filter displayed as badge
 */
export function FrameworkFilter({ className }: FrameworkFilterProps) {
  const { filters, setFrameworkCode, clearFilter } = useEvidenceFilters();

  // Fetch active frameworks (AC2)
  const { data: frameworks, isLoading, error } = api.framework.listActive.useQuery();

  // Find selected framework for display
  const selectedFramework = frameworks?.find(
    (f) => f.code === filters.frameworkCode
  );

  // Handle framework selection (AC3)
  const handleValueChange = (value: string) => {
    if (value === "__all__") {
      setFrameworkCode(null);
    } else {
      setFrameworkCode(value);
    }
  };

  // Handle badge remove click (AC18)
  const handleRemoveFilter = () => {
    clearFilter("frameworkCode");
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <Skeleton className="h-9 w-48" />
      </div>
    );
  }

  if (error) {
    return null; // Silently fail if frameworks can't be loaded
  }

  if (!frameworks || frameworks.length === 0) {
    return null; // No frameworks available to filter by
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {/* Framework Filter Dropdown (AC1) */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <Select
          value={filters.frameworkCode ?? "__all__"}
          onValueChange={handleValueChange}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Frameworks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Frameworks</SelectItem>
            {frameworks.map((framework) => (
              <SelectItem key={framework.code} value={framework.code}>
                {framework.name}
                {framework.controlCount !== undefined && (
                  <span className="ml-2 text-gray-400 text-xs">
                    ({framework.controlCount} controls)
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Badge (AC6) */}
      {filters.frameworkCode && selectedFramework && (
        <Badge
          variant="secondary"
          className="flex items-center gap-1 px-3 py-1"
        >
          <span className="text-xs text-gray-500">Framework:</span>
          <span className="font-medium">{selectedFramework.name}</span>
          <button
            onClick={handleRemoveFilter}
            className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
            title="Clear framework filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Clear Filter Button (AC5) */}
      {filters.frameworkCode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemoveFilter}
          className="text-gray-500 hover:text-gray-700"
        >
          Clear Filter
        </Button>
      )}
    </div>
  );
}

/**
 * Active Filters Display Component
 *
 * Shows all active filters (framework, control domain, search) as removable badges.
 * Used to display combined filter state (AC17).
 */
export function ActiveFiltersDisplay() {
  const { activeFilters, clearFilter, clearAllFilters, hasActiveFilters } =
    useEvidenceFilters();

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500">Active filters:</span>
      {activeFilters.map((filter) => (
        <Badge
          key={filter.key}
          variant="outline"
          className="flex items-center gap-1 px-2 py-0.5"
        >
          <span className="text-xs text-gray-500">{filter.label}:</span>
          <span className="font-medium text-sm">{filter.value}</span>
          <button
            onClick={() => clearFilter(filter.key)}
            className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
            title={`Clear ${filter.label.toLowerCase()} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {activeFilters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-xs text-gray-500 hover:text-gray-700 h-auto py-1"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
