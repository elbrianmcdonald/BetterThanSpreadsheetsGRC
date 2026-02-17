"use client";

/**
 * Duplicate Finder Modal Component
 *
 * Story 7.3: Finding Triage Workflow (AC19-AC22)
 *
 * Modal for searching and selecting an original finding when marking as duplicate.
 * - AC19: "Mark Duplicate" opens modal to search/select original finding
 * - AC20: Search finds findings by identifier or title (within organization)
 * - AC21: Selected duplicate linked via duplicateOfId
 *
 * @see Story 7.3: Finding Triage Workflow
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Search, Loader2, Link, AlertTriangle } from "lucide-react";

import { api } from "@/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FindingStatusBadge } from "./FindingStatusBadge";
import { SeverityBadge } from "@/components/risk/SeverityBadge";

interface DuplicateFinderModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current finding ID (to exclude from search results) */
  currentFindingId: string;
  /** Callback when a finding is selected */
  onSelect: (findingId: string) => void;
}

/**
 * Modal for finding and selecting an original finding to mark as duplicate.
 *
 * @example
 * ```tsx
 * <DuplicateFinderModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   currentFindingId={finding.id}
 *   onSelect={(id) => handleDuplicate(id)}
 * />
 * ```
 */
export function DuplicateFinderModal({
  open,
  onOpenChange,
  currentFindingId,
  onSelect,
}: DuplicateFinderModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search query update using useEffect
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  // Search query - only run when debounced query has content
  const searchResults = api.finding.search.useQuery(
    {
      query: debouncedQuery,
      excludeId: currentFindingId,
    },
    {
      enabled: debouncedQuery.length >= 1,
    }
  );

  // Handle finding selection
  const handleSelect = (findingId: string) => {
    setSelectedFindingId(findingId);
  };

  // Handle confirm button
  const handleConfirm = () => {
    if (selectedFindingId) {
      onSelect(selectedFindingId);
      // Reset state
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedFindingId(null);
    }
  };

  // Handle cancel/close
  const handleClose = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedFindingId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link to Original Finding
          </DialogTitle>
          <DialogDescription>
            Search for the original finding that this one duplicates. The
            selected finding will be linked as the original.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by identifier (e.g., FND-2025-0001) or title..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Search Results */}
        <div className="max-h-80 min-h-[200px] overflow-y-auto rounded-md border">
          {!debouncedQuery && (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              <p>Enter a search term to find findings</p>
            </div>
          )}

          {debouncedQuery && searchResults.isLoading && (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {debouncedQuery && searchResults.data && searchResults.data.length === 0 && (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-8 w-8" />
              <p>No findings found matching &quot;{debouncedQuery}&quot;</p>
            </div>
          )}

          {searchResults.data && searchResults.data.length > 0 && (
            <div className="divide-y">
              {searchResults.data.map((finding) => (
                <button
                  key={finding.id}
                  type="button"
                  onClick={() => handleSelect(finding.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent ${
                    selectedFindingId === finding.id
                      ? "bg-accent ring-2 ring-primary ring-inset"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-muted-foreground">
                          {finding.identifier}
                        </span>
                        <FindingStatusBadge status={finding.status} size="sm" />
                        <SeverityBadge severity={finding.severity} size="sm" />
                      </div>
                      <p className="mt-1 truncate text-sm">{finding.title}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedFindingId}
          >
            Link as Duplicate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
