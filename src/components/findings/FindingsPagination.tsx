"use client";

/**
 * Findings Pagination Component
 *
 * Story 7.12: Findings List Page (AC22-AC25)
 *
 * Provides pagination controls:
 * - Page size selector (10, 25, 50)
 * - Previous/Next navigation
 * - Total count display
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FindingsPaginationProps {
  /** Total number of items */
  totalCount: number;
  /** Current page size */
  pageSize: number;
  /** Callback when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Callback to go to previous page */
  onPreviousPage: () => void;
  /** Callback to go to next page */
  onNextPage: () => void;
  /** Current page number (1-indexed, for display) */
  currentPage: number;
  /** Number of items on current page */
  currentPageCount: number;
}

const PAGE_SIZES = [10, 25, 50];

export function FindingsPagination({
  totalCount,
  pageSize,
  onPageSizeChange,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  currentPage,
  currentPageCount,
}: FindingsPaginationProps) {
  // Calculate display range
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(startItem + currentPageCount - 1, totalCount);

  return (
    <div className="flex items-center justify-between px-2">
      {/* Total count display (AC24) */}
      <div className="text-sm text-muted-foreground">
        {totalCount === 0 ? (
          "No findings"
        ) : (
          <>
            Showing <span className="font-medium">{startItem}</span> to{" "}
            <span className="font-medium">{endItem}</span> of{" "}
            <span className="font-medium">{totalCount}</span> findings
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector (AC22) */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={String(pageSize)} />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation (AC23) */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onPreviousPage}
            disabled={!hasPreviousPage}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            Page {currentPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onNextPage}
            disabled={!hasNextPage}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
