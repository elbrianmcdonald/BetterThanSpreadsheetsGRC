"use client";

/**
 * Assessment Filters Component
 *
 * Story 1.4: Assessment Filtering
 *
 * Provides filtering controls for the risk assessments list:
 * - Status dropdown (In Progress, Submitted, Approved)
 * - Assignee dropdown (users in organization)
 * - Date Range filter (from/to date pickers)
 * - Search input with debounce
 * - Clear filters button
 *
 * Filter state is persisted in URL for bookmarking and sharing.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AssessmentProjectStatus } from "@prisma/client";
import { Search, X, Filter, Calendar } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";

/**
 * Filter state interface
 */
export interface AssessmentFilterState {
  status: AssessmentProjectStatus | null;
  assigneeId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
}

/**
 * Default filter state
 */
export const DEFAULT_ASSESSMENT_FILTERS: AssessmentFilterState = {
  status: null,
  assigneeId: null,
  dateFrom: null,
  dateTo: null,
  search: "",
};

/**
 * Status options with labels
 */
const STATUS_OPTIONS: { value: AssessmentProjectStatus; label: string }[] = [
  { value: AssessmentProjectStatus.IN_PROGRESS, label: "In Progress" },
  { value: AssessmentProjectStatus.SUBMITTED, label: "Submitted" },
  { value: AssessmentProjectStatus.APPROVED, label: "Approved" },
];

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromURL(
  searchParams: URLSearchParams
): AssessmentFilterState {
  const statusParam = searchParams.get("status");
  const assigneeIdParam = searchParams.get("assigneeId");
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");
  const searchParam = searchParams.get("search");

  return {
    status:
      statusParam &&
      ["IN_PROGRESS", "SUBMITTED", "APPROVED"].includes(statusParam)
        ? (statusParam as AssessmentProjectStatus)
        : null,
    assigneeId: assigneeIdParam || null,
    dateFrom: dateFromParam ? new Date(dateFromParam) : null,
    dateTo: dateToParam ? new Date(dateToParam) : null,
    search: searchParam || "",
  };
}

/**
 * Build URL from filters
 */
export function buildURLFromFilters(filters: AssessmentFilterState): string {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.assigneeId) {
    params.set("assigneeId", filters.assigneeId);
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom.toISOString().split("T")[0]!);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo.toISOString().split("T")[0]!);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }

  return params.toString();
}

interface AssessmentFiltersProps {
  filters: AssessmentFilterState;
  onFiltersChange: (filters: AssessmentFilterState) => void;
}

export function AssessmentFilters({
  filters,
  onFiltersChange,
}: AssessmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState(filters.search);

  // Fetch users for assignee dropdown
  const { data: usersData } = api.user.listUsers.useQuery({
    skip: 0,
    take: 100,
  });

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        const newFilters = { ...filters, search: searchInput };
        onFiltersChange(newFilters);
        updateURL(newFilters);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync local state when filters change externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Update URL with new filters
  const updateURL = useCallback(
    (newFilters: AssessmentFilterState) => {
      const queryString = buildURLFromFilters(newFilters);
      const newURL = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newURL, { scroll: false });
    },
    [pathname, router]
  );

  // Handle status change
  const handleStatusChange = useCallback(
    (value: string) => {
      const newStatus =
        value === "all" ? null : (value as AssessmentProjectStatus);
      const newFilters = { ...filters, status: newStatus };
      onFiltersChange(newFilters);
      updateURL(newFilters);
    },
    [filters, onFiltersChange, updateURL]
  );

  // Handle assignee change
  const handleAssigneeChange = useCallback(
    (value: string) => {
      const newAssigneeId = value === "all" ? null : value === "unassigned" ? "unassigned" : value;
      const newFilters = { ...filters, assigneeId: newAssigneeId };
      onFiltersChange(newFilters);
      updateURL(newFilters);
    },
    [filters, onFiltersChange, updateURL]
  );

  // Handle date from change
  const handleDateFromChange = useCallback(
    (date: Date | undefined) => {
      const newFilters = { ...filters, dateFrom: date || null };
      onFiltersChange(newFilters);
      updateURL(newFilters);
    },
    [filters, onFiltersChange, updateURL]
  );

  // Handle date to change
  const handleDateToChange = useCallback(
    (date: Date | undefined) => {
      const newFilters = { ...filters, dateTo: date || null };
      onFiltersChange(newFilters);
      updateURL(newFilters);
    },
    [filters, onFiltersChange, updateURL]
  );

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    setSearchInput("");
    onFiltersChange(DEFAULT_ASSESSMENT_FILTERS);
    router.push(pathname, { scroll: false });
  }, [onFiltersChange, pathname, router]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.status !== null ||
    filters.assigneeId !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.search.length > 0;

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.assigneeId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by subject..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 w-[200px] pl-8"
        />
      </div>

      {/* Status filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="h-9 w-[140px]">
          <Filter className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select
        value={filters.assigneeId || "all"}
        onValueChange={handleAssigneeChange}
      >
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          <SelectItem value="unassigned">Unassigned (Backlog)</SelectItem>
          <Separator className="my-1" />
          {usersData?.users?.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name || user.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date From filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 w-[130px] justify-start text-left font-normal ${
              !filters.dateFrom && "text-muted-foreground"
            }`}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {filters.dateFrom ? format(filters.dateFrom, "MMM d, yyyy") : "From Date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={filters.dateFrom || undefined}
            onSelect={handleDateFromChange}
            initialFocus
          />
          {filters.dateFrom && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => handleDateFromChange(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Date To filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 w-[130px] justify-start text-left font-normal ${
              !filters.dateTo && "text-muted-foreground"
            }`}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {filters.dateTo ? format(filters.dateTo, "MMM d, yyyy") : "To Date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={filters.dateTo || undefined}
            onSelect={handleDateToChange}
            initialFocus
          />
          {filters.dateTo && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => handleDateToChange(undefined)}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={handleClearAll}
        >
          <X className="mr-1 h-4 w-4" />
          Clear filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      )}
    </div>
  );
}
