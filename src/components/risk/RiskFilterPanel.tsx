"use client";

/**
 * Risk Filter Panel Component
 *
 * Story 5.5: Risk Filtering UI (Multi-Select Filters)
 *
 * Provides comprehensive filtering for the risk list:
 * - AC1: Collapsible filter sidebar
 * - AC2-AC4: Multi-select filters (severity, status, framework, finding source)
 * - AC5: Clear All Filters button
 * - AC6: Active filters shown as removable chips
 * - AC7-AC9: Severity filter with color-coded checkboxes
 * - AC10-AC12: Status filter with counts
 * - AC13-AC15: Framework filter including "No Framework" option
 * - AC16-AC18: IT/Business owner dropdowns with "Unassigned" option
 * - AC19-AC22: URL state management
 *
 * @see Story 5.5: Risk Filtering UI
 */

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

// Types for filter values
export type SeverityValue = "HIGH" | "MEDIUM" | "LOW";
export type StatusValue = "DRAFT" | "PENDING_REVIEW" | "OPEN" | "ASSIGNED" | "REMEDIATED" | "CLOSED";
export type FindingSourceValue =
  | "VULNERABILITY_SCAN"
  | "PENETRATION_TEST"
  | "AUDIT_FINDING"
  | "SECURITY_REVIEW"
  | "COMPLIANCE_ASSESSMENT"
  | "OTHER";

export interface RiskFilters {
  severity: SeverityValue[];
  status: StatusValue[];
  findingSource: FindingSourceValue[];
  frameworkId: string | null;
  itOwnerId: string | null;
  businessOwnerId: string | null;
}

// Severity configuration with colors
const SEVERITY_CONFIG: Record<SeverityValue, { label: string; color: string }> = {
  HIGH: { label: "High", color: "bg-red-500" },
  MEDIUM: { label: "Medium", color: "bg-amber-500" },
  LOW: { label: "Low", color: "bg-green-500" },
};

// Status configuration
const STATUS_CONFIG: Record<StatusValue, { label: string }> = {
  DRAFT: { label: "Draft" },
  PENDING_REVIEW: { label: "Pending Review" },
  OPEN: { label: "Open" },
  ASSIGNED: { label: "Assigned" },
  REMEDIATED: { label: "Remediated" },
  CLOSED: { label: "Closed" },
};

// Finding source configuration
const FINDING_SOURCE_CONFIG: Record<FindingSourceValue, { label: string }> = {
  VULNERABILITY_SCAN: { label: "Vulnerability Scan" },
  PENETRATION_TEST: { label: "Penetration Test" },
  AUDIT_FINDING: { label: "Audit Finding" },
  SECURITY_REVIEW: { label: "Security Review" },
  COMPLIANCE_ASSESSMENT: { label: "Compliance Assessment" },
  OTHER: { label: "Other" },
};

// Parse filters from URL search params (AC21)
function parseFiltersFromURL(searchParams: URLSearchParams): RiskFilters {
  const severityParam = searchParams.get("severity");
  const statusParam = searchParams.get("status");
  const findingSourceParam = searchParams.get("findingSource");

  return {
    severity: severityParam
      ? (severityParam.split(",").filter((s) => ["HIGH", "MEDIUM", "LOW"].includes(s)) as SeverityValue[])
      : [],
    status: statusParam
      ? (statusParam.split(",").filter((s) => ["DRAFT", "PENDING_REVIEW", "OPEN", "ASSIGNED", "REMEDIATED", "CLOSED"].includes(s)) as StatusValue[])
      : [],
    findingSource: findingSourceParam
      ? (findingSourceParam.split(",").filter((s) =>
          Object.keys(FINDING_SOURCE_CONFIG).includes(s)
        ) as FindingSourceValue[])
      : [],
    frameworkId: searchParams.get("frameworkId"),
    itOwnerId: searchParams.get("itOwnerId"),
    businessOwnerId: searchParams.get("businessOwnerId"),
  };
}

// Build URL from filters (AC19-AC20)
function buildURLFromFilters(filters: RiskFilters): string {
  const params = new URLSearchParams();

  if (filters.severity.length > 0) {
    params.set("severity", filters.severity.join(","));
  }
  if (filters.status.length > 0) {
    params.set("status", filters.status.join(","));
  }
  if (filters.findingSource.length > 0) {
    params.set("findingSource", filters.findingSource.join(","));
  }
  if (filters.frameworkId) {
    params.set("frameworkId", filters.frameworkId);
  }
  if (filters.itOwnerId) {
    params.set("itOwnerId", filters.itOwnerId);
  }
  if (filters.businessOwnerId) {
    params.set("businessOwnerId", filters.businessOwnerId);
  }

  return params.toString();
}

interface RiskFilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onFiltersChange: (filters: RiskFilters) => void;
  showOwnerFilters?: boolean;
}

export function RiskFilterPanel({
  isOpen,
  onToggle,
  onFiltersChange,
  showOwnerFilters = true,
}: RiskFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current filters from URL (AC21)
  const filters = useMemo(
    () => parseFiltersFromURL(searchParams),
    [searchParams]
  );

  // Fetch filter counts (AC12)
  const { data: filterCounts } = api.risk.getFilterCounts.useQuery();

  // Fetch active frameworks for framework filter (AC13)
  const { data: frameworksData } = api.framework.listActive.useQuery();

  // Fetch users for owner filters (AC16-AC17)
  const { data: usersData } = api.user.listUsers.useQuery(
    { take: 100, skip: 0 },
    { enabled: showOwnerFilters }
  );

  // Update URL and notify parent of filter changes (AC19-AC22)
  const updateFilters = useCallback(
    (newFilters: RiskFilters) => {
      const queryString = buildURLFromFilters(newFilters);
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url, { scroll: false });
      onFiltersChange(newFilters);
    },
    [router, pathname, onFiltersChange]
  );

  // Toggle a value in a multi-select filter
  const toggleMultiSelect = useCallback(
    <T extends string>(
      filterKey: "severity" | "status" | "findingSource",
      value: T
    ) => {
      const currentValues = filters[filterKey] as T[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      updateFilters({
        ...filters,
        [filterKey]: newValues,
      });
    },
    [filters, updateFilters]
  );

  // Set a single-select filter value
  const setFilter = useCallback(
    (filterKey: "frameworkId" | "itOwnerId" | "businessOwnerId", value: string | null) => {
      updateFilters({
        ...filters,
        [filterKey]: value,
      });
    },
    [filters, updateFilters]
  );

  // Clear all filters (AC5)
  const clearAllFilters = useCallback(() => {
    updateFilters({
      severity: [],
      status: [],
      findingSource: [],
      frameworkId: null,
      itOwnerId: null,
      businessOwnerId: null,
    });
  }, [updateFilters]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.severity.length > 0 ||
    filters.status.length > 0 ||
    filters.findingSource.length > 0 ||
    filters.frameworkId !== null ||
    filters.itOwnerId !== null ||
    filters.businessOwnerId !== null;

  // Get active filter count
  const activeFilterCount =
    filters.severity.length +
    filters.status.length +
    filters.findingSource.length +
    (filters.frameworkId ? 1 : 0) +
    (filters.itOwnerId ? 1 : 0) +
    (filters.businessOwnerId ? 1 : 0);

  // Filter users by role for owner dropdowns
  const itStakeholders = usersData?.users.filter(
    (u) => u.role === "IT_STAKEHOLDER"
  ) ?? [];
  const businessStakeholders = usersData?.users.filter(
    (u) => u.role === "BUSINESS_STAKEHOLDER"
  ) ?? [];

  return (
    <div className="space-y-4">
      {/* Active Filter Chips (AC6) */}
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
                  SEVERITY_CONFIG[severity].color
                )}
              />
              {SEVERITY_CONFIG[severity].label}
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
              {STATUS_CONFIG[status].label}
              <button
                onClick={() => toggleMultiSelect("status", status)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.findingSource.map((source) => (
            <Badge
              key={source}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {FINDING_SOURCE_CONFIG[source].label}
              <button
                onClick={() => toggleMultiSelect("findingSource", source)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.frameworkId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Framework:{" "}
              {filters.frameworkId === "none"
                ? "No Framework"
                : frameworksData?.find((f) => f.id === filters.frameworkId)?.name ?? filters.frameworkId}
              <button
                onClick={() => setFilter("frameworkId", null)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.itOwnerId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              IT Owner:{" "}
              {filters.itOwnerId === "unassigned"
                ? "Unassigned"
                : usersData?.users.find((u) => u.id === filters.itOwnerId)?.name ?? "Unknown"}
              <button
                onClick={() => setFilter("itOwnerId", null)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.businessOwnerId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Business Owner:{" "}
              {filters.businessOwnerId === "unassigned"
                ? "Unassigned"
                : usersData?.users.find((u) => u.id === filters.businessOwnerId)?.name ?? "Unknown"}
              <button
                onClick={() => setFilter("businessOwnerId", null)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
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

      {/* Collapsible Filter Panel (AC1) */}
      <Collapsible open={isOpen} onOpenChange={onToggle}>
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
            {/* Severity Filter (AC7-AC9) */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Severity</h4>
              <div className="space-y-2">
                {(Object.keys(SEVERITY_CONFIG) as SeverityValue[]).map((severity) => (
                  <label
                    key={severity}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.severity.includes(severity)}
                      onCheckedChange={() => toggleMultiSelect("severity", severity)}
                    />
                    <span
                      className={cn(
                        "w-3 h-3 rounded-full",
                        SEVERITY_CONFIG[severity].color
                      )}
                    />
                    <span className="text-sm">
                      {SEVERITY_CONFIG[severity].label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({filterCounts?.bySeverity[severity] ?? 0})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Filter (AC10-AC12) */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Status</h4>
              <div className="space-y-2">
                {(Object.keys(STATUS_CONFIG) as StatusValue[]).map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.status.includes(status)}
                      onCheckedChange={() => toggleMultiSelect("status", status)}
                    />
                    <span className="text-sm">{STATUS_CONFIG[status].label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({filterCounts?.byStatus[status] ?? 0})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Finding Source Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Finding Source</h4>
              <div className="space-y-2">
                {(Object.keys(FINDING_SOURCE_CONFIG) as FindingSourceValue[]).map(
                  (source) => (
                    <label
                      key={source}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.findingSource.includes(source)}
                        onCheckedChange={() => toggleMultiSelect("findingSource", source)}
                      />
                      <span className="text-sm">
                        {FINDING_SOURCE_CONFIG[source].label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ({filterCounts?.byFindingSource[source] ?? 0})
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>

            {/* Framework Filter (AC13-AC15) */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Framework</h4>
              <Select
                value={filters.frameworkId ?? "all"}
                onValueChange={(value) =>
                  setFilter("frameworkId", value === "all" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Frameworks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  <SelectItem value="none">No Framework</SelectItem>
                  {frameworksData?.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {framework.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Owner Filters (AC16-AC18) */}
            {showOwnerFilters && (
              <>
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">IT Owner</h4>
                  <Select
                    value={filters.itOwnerId ?? "all"}
                    onValueChange={(value) =>
                      setFilter("itOwnerId", value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All IT Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All IT Owners</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {itStakeholders.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name ?? user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Business Owner</h4>
                  <Select
                    value={filters.businessOwnerId ?? "all"}
                    onValueChange={(value) =>
                      setFilter("businessOwnerId", value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Business Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Business Owners</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {businessStakeholders.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name ?? user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Export the filter types and utilities for use in the parent component
export { parseFiltersFromURL };
