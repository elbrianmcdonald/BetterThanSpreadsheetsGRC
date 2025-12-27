"use client";

/**
 * Findings List Content Component
 *
 * Story 7.12: Findings List Page
 *
 * Client component that handles:
 * - Filter state management
 * - Pagination state
 * - Sorting state
 * - API queries
 * - Empty states
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { type SortingState } from "@tanstack/react-table";
import { Plus, FileSearch, AlertCircle } from "lucide-react";

import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";
import { AppLayout } from "@/components/layout";

import {
  FindingFilters,
  DEFAULT_FILTERS,
  type FindingFilterState,
} from "@/components/findings/FindingFilters";
import { FindingsTable } from "@/components/findings/FindingsTable";
import { FindingsPagination } from "@/components/findings/FindingsPagination";

/**
 * Roles that can create findings
 */
const FINDING_CREATE_ROLES = [
  UserRole.SECURITY_ENGINEER,
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

export function FindingsListContent() {
  // Filter state (AC13-AC18)
  const [filters, setFilters] = useState<FindingFilterState>(DEFAULT_FILTERS);

  // Sorting state (AC19-AC21)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true }, // AC20: Default sort by created descending
  ]);

  // Pagination state (AC22-AC25)
  const [pageSize, setPageSize] = useState(25);
  const [cursors, setCursors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Get current cursor for pagination
  const currentCursor = cursors[currentPage - 2]; // -2 because first page has no cursor

  // Map TanStack sorting to API format
  const sortBy = sorting[0]?.id as
    | "identifier"
    | "title"
    | "severity"
    | "status"
    | "createdAt"
    | undefined;
  const sortOrder = sorting[0]?.desc ? "desc" : "asc";

  // Fetch findings with filters, sorting, and pagination
  const { data, isLoading, isError, error } = api.finding.list.useQuery({
    status: filters.status.length > 0 ? filters.status : undefined,
    source: filters.source.length > 0 ? filters.source : undefined,
    severity: filters.severity.length > 0 ? filters.severity : undefined,
    search: filters.search || undefined,
    sortBy,
    sortOrder,
    limit: pageSize,
    cursor: currentCursor,
  });

  // Check if user can create findings (AC4, AC32-AC33)
  const canCreateFinding = useHasRole(FINDING_CREATE_ROLES);

  // Handle filter changes - reset pagination
  const handleFiltersChange = useCallback((newFilters: FindingFilterState) => {
    setFilters(newFilters);
    setCursors([]);
    setCurrentPage(1);
  }, []);

  // Handle sorting changes - reset pagination
  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
    setCursors([]);
    setCurrentPage(1);
  }, []);

  // Handle page size change - reset pagination
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCursors([]);
    setCurrentPage(1);
  }, []);

  // Handle next page
  const handleNextPage = useCallback(() => {
    if (data?.nextCursor) {
      setCursors((prev) => [...prev, data.nextCursor!]);
      setCurrentPage((prev) => prev + 1);
    }
  }, [data?.nextCursor]);

  // Handle previous page
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCursors((prev) => prev.slice(0, -1));
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const findings = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const hasNextPage = !!data?.nextCursor;
  const hasPreviousPage = currentPage > 1;

  // AC26-AC28: Empty states
  const renderEmptyState = () => {
    const hasFilters =
      filters.status.length > 0 ||
      filters.source.length > 0 ||
      filters.severity.length > 0 ||
      filters.search.length > 0;

    if (hasFilters) {
      // AC27: "No findings match your filters"
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No findings match your filters</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting your filters to find what you&apos;re looking for.
            </p>
            <Button
              variant="outline"
              onClick={() => handleFiltersChange(DEFAULT_FILTERS)}
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      );
    }

    // AC26, AC28: "No findings yet" with CTA
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No findings yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Get started by creating your first security finding.
          </p>
          {canCreateFinding && (
            <Button asChild>
              <Link href="/findings/new">
                <Plus className="mr-2 h-4 w-4" />
                New Finding
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // Error state
  if (isError) {
    return (
      <AppLayout breadcrumbs={[{ label: "Findings" }]}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Error loading findings</h3>
            <p className="text-muted-foreground text-sm">
              {error?.message ?? "An unexpected error occurred"}
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Findings" }]}>
      {/* Header with title and New Finding button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Findings</h1>
          <p className="text-muted-foreground">
            Manage security findings from audits, pentests, and other sources.
          </p>
        </div>
        {/* AC4: "New Finding" button (role-based visibility) */}
        {canCreateFinding && (
          <Button asChild>
            <Link href="/findings/new">
              <Plus className="mr-2 h-4 w-4" />
              New Finding
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <FindingFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Table or Empty State */}
      {!isLoading && findings.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <FindingsTable
            data={findings}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            isLoading={isLoading}
          />

          {/* Pagination */}
          <FindingsPagination
            totalCount={totalCount}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            currentPage={currentPage}
            currentPageCount={findings.length}
          />
        </>
      )}
    </AppLayout>
  );
}
