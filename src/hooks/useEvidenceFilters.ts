"use client";

/**
 * Evidence Filters Hook
 *
 * Manages evidence list filter state with URL query parameter synchronization.
 * Supports framework and control domain filters with multi-filter AND logic.
 *
 * @see Story 3.7: AC4, AC15-AC18 - Filter state persisted in URL query params
 */

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface EvidenceFilters {
  /** Framework code filter (e.g., "ISO27001", "SOC2") */
  frameworkCode: string | null;
  /** Control domain ID filter */
  controlDomainId: string | null;
  /** Search query */
  search: string | null;
  /** Page number (1-indexed) */
  page: number;
}

export interface UseEvidenceFiltersReturn {
  /** Current filter values */
  filters: EvidenceFilters;
  /** Set framework filter */
  setFrameworkCode: (code: string | null) => void;
  /** Set control domain filter */
  setControlDomainId: (id: string | null) => void;
  /** Set search query */
  setSearch: (query: string | null) => void;
  /** Set page number */
  setPage: (page: number) => void;
  /** Clear all filters */
  clearAllFilters: () => void;
  /** Clear a specific filter */
  clearFilter: (filterName: keyof Omit<EvidenceFilters, "page">) => void;
  /** Check if any filter is active */
  hasActiveFilters: boolean;
  /** Get active filters as array for badge display */
  activeFilters: Array<{
    key: keyof Omit<EvidenceFilters, "page">;
    label: string;
    value: string;
  }>;
}

/**
 * Hook for managing evidence list filters with URL sync
 *
 * Features:
 * - Reads initial filter state from URL query params
 * - Updates URL when filters change (AC4)
 * - Handles browser back/forward navigation (Task 6.4)
 * - Supports multiple simultaneous filters (AC15-AC18)
 *
 * @example
 * ```tsx
 * const { filters, setFrameworkCode, clearFilter } = useEvidenceFilters();
 *
 * // Read current filters
 * console.log(filters.frameworkCode); // "ISO27001"
 *
 * // Update framework filter (updates URL automatically)
 * setFrameworkCode("SOC2");
 *
 * // Clear specific filter
 * clearFilter("frameworkCode");
 * ```
 */
export function useEvidenceFilters(): UseEvidenceFiltersReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current filters from URL
  const filters = useMemo<EvidenceFilters>(() => ({
    frameworkCode: searchParams.get("framework"),
    controlDomainId: searchParams.get("domain"),
    search: searchParams.get("search"),
    page: parseInt(searchParams.get("page") ?? "1", 10) || 1,
  }), [searchParams]);

  // Helper to update URL params
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (!("page" in updates)) {
      params.delete("page");
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }, [router, pathname, searchParams]);

  // Filter setters
  const setFrameworkCode = useCallback((code: string | null) => {
    updateParams({ framework: code });
  }, [updateParams]);

  const setControlDomainId = useCallback((id: string | null) => {
    updateParams({ domain: id });
  }, [updateParams]);

  const setSearch = useCallback((query: string | null) => {
    updateParams({ search: query });
  }, [updateParams]);

  const setPage = useCallback((page: number) => {
    updateParams({ page: page > 1 ? page.toString() : null });
  }, [updateParams]);

  // Clear all filters (AC5)
  const clearAllFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  // Clear specific filter (AC18)
  const clearFilter = useCallback((filterName: keyof Omit<EvidenceFilters, "page">) => {
    const paramMap: Record<keyof Omit<EvidenceFilters, "page">, string> = {
      frameworkCode: "framework",
      controlDomainId: "domain",
      search: "search",
    };
    updateParams({ [paramMap[filterName]]: null });
  }, [updateParams]);

  // Check if any filter is active (AC6)
  const hasActiveFilters = useMemo(() => {
    return !!(filters.frameworkCode || filters.controlDomainId || filters.search);
  }, [filters]);

  // Get active filters for badge display (AC17)
  const activeFilters = useMemo(() => {
    const result: Array<{
      key: keyof Omit<EvidenceFilters, "page">;
      label: string;
      value: string;
    }> = [];

    if (filters.frameworkCode) {
      result.push({
        key: "frameworkCode",
        label: "Framework",
        value: filters.frameworkCode,
      });
    }

    if (filters.controlDomainId) {
      result.push({
        key: "controlDomainId",
        label: "Control Domain",
        value: filters.controlDomainId,
      });
    }

    if (filters.search) {
      result.push({
        key: "search",
        label: "Search",
        value: filters.search,
      });
    }

    return result;
  }, [filters]);

  return {
    filters,
    setFrameworkCode,
    setControlDomainId,
    setSearch,
    setPage,
    clearAllFilters,
    clearFilter,
    hasActiveFilters,
    activeFilters,
  };
}
