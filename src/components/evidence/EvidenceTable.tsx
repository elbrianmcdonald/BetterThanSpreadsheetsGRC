"use client";

/**
 * Evidence Table Component with TanStack Table v8
 *
 * Features:
 * - Server-side pagination (50 rows per page)
 * - Column sorting (ascending/descending with indicators)
 * - Global search by filename, title, description
 * - Framework and control domain filters
 * - Date range filter
 * - Column visibility toggle with localStorage persistence
 * - Role-based action buttons (View, Download, Edit, Delete)
 *
 * @see Story 3.10: Evidence Repository Page with TanStack Table
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings2,
  X,
  Search,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  CalendarIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { ControlDomainBadgeList } from "@/components/evidence/ControlDomainBadge";
import { ControlDomainSelector } from "@/components/evidence/ControlDomainSelector";
import { ControlCountBadge } from "@/components/evidence/FrameworkMappingPreview";
import { formatFileSize } from "@/utils/file-validation";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";

// Local storage key for column visibility
const COLUMN_VISIBILITY_KEY = "evidence-table-column-visibility";

// Evidence item type from API
interface EvidenceItem {
  id: string;
  title: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  createdAt: Date;
  User: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  EvidenceControlDomain: Array<{
    id: string;
    controlDomainId: string;
    ControlDomain: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

interface EvidenceTableProps {
  /** Callback when View Details is clicked */
  onViewDetails?: (evidenceId: string) => void;
  /** Callback when control domain filter is clicked */
  onDomainFilterClick?: (domainId: string) => void;
  /** Current active domain filter from URL */
  activeDomainId?: string;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get file icon based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-4 w-4 text-green-500" />;
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("word")) {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  return <File className="h-4 w-4 text-gray-500" />;
}

/**
 * Use debounced value hook
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function EvidenceTable({
  onViewDetails,
  onDomainFilterClick,
  activeDomainId,
}: EvidenceTableProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Story 3.8: Role-based permissions
  const { canEditEvidence, canDeleteEvidence } = useUserPermissions();

  // State for pagination
  const [page, setPage] = useState(1);
  const pageSize = 50; // AC4: 50 rows per page

  // State for sorting
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true }, // AC10: Default sort by upload date, newest first
  ]);

  // State for search with debouncing - AC13
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300); // AC5.4: 300ms debounce

  // State for filters
  const [controlDomainFilter, setControlDomainFilter] = useState<string[]>(
    activeDomainId ? [activeDomainId] : []
  );
  const [frameworkFilter, setFrameworkFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  // State for column visibility - AC20-AC22
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // State for delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null);

  // Load column visibility from localStorage on mount
  useEffect(() => {
    const savedVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (savedVisibility) {
      try {
        setColumnVisibility(JSON.parse(savedVisibility) as VisibilityState);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  // Update domain filter when URL param changes
  useEffect(() => {
    if (activeDomainId) {
      setControlDomainFilter([activeDomainId]);
    }
  }, [activeDomainId]);

  // Convert sorting state to query params
  const sortBy = sorting[0]?.id as "createdAt" | "title" | "fileSize" | "originalFileName" | undefined;
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  // Fetch evidence data
  const { data: evidenceData, isLoading } = api.evidence.list.useQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    isActive: true,
    controlDomainId: controlDomainFilter.length === 1 ? controlDomainFilter[0] : undefined,
    frameworkCode: frameworkFilter,
    uploadDateStart: dateRange.from,
    uploadDateEnd: dateRange.to,
    sortBy: sortBy ?? "createdAt",
    sortDir,
  });

  // Fetch active frameworks for filter dropdown
  const { data: frameworks } = api.framework.listActive.useQuery();

  // Delete mutation
  const deleteMutation = api.evidence.delete.useMutation({
    onSuccess: () => {
      toast.success("Evidence deleted successfully");
      void utils.evidence.list.invalidate();
      setDeleteDialogOpen(false);
      setEvidenceToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete evidence: ${error.message}`);
    },
  });

  // Handle delete
  const handleDelete = useCallback(() => {
    if (evidenceToDelete) {
      deleteMutation.mutate({ id: evidenceToDelete });
    }
  }, [evidenceToDelete, deleteMutation]);

  // Handle download
  const handleDownload = useCallback((evidenceId: string) => {
    window.open(`/api/evidence/${evidenceId}/download`, "_blank");
  }, []);

  // Define table columns - AC2
  const columns = useMemo<ColumnDef<EvidenceItem>[]>(
    () => [
      {
        id: "icon",
        header: "",
        cell: ({ row }) => getFileIcon(row.original.fileType),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "originalFileName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Filename
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <p className="font-medium truncate" title={row.original.title}>
              {row.original.title}
            </p>
            <p className="text-sm text-gray-500 truncate" title={row.original.originalFileName}>
              {row.original.originalFileName}
            </p>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Upload Date
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
        enableSorting: true,
      },
      {
        id: "uploadedBy",
        header: "Uploaded By",
        cell: ({ row }) =>
          row.original.User?.name ?? row.original.User?.email ?? "Unknown",
        enableSorting: false,
      },
      {
        id: "controlDomains",
        header: "Control Domains",
        cell: ({ row }) => (
          <ControlDomainBadgeList
            domains={row.original.EvidenceControlDomain}
            maxDisplay={2}
            onDomainClick={onDomainFilterClick}
            activeDomainId={activeDomainId}
          />
        ),
        enableSorting: false,
      },
      {
        id: "frameworkControls",
        header: "Controls",
        cell: ({ row }) => (
          <ControlCountBadge
            controlDomainIds={row.original.EvidenceControlDomain.map(
              (cd) => cd.controlDomainId
            )}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "fileSize",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Size
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => formatFileSize(row.original.fileSize),
        enableSorting: true,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {/* View - AC23, AC25 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewDetails?.(row.original.id)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {/* Download - AC23, AC26 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDownload(row.original.id)}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            {/* Edit - AC23, AC24, AC27 */}
            {canEditEvidence && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push(`/admin/evidence/${row.original.id}/edit`)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {/* Delete - AC23, AC24, AC28 */}
            {canDeleteEvidence && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  setEvidenceToDelete(row.original.id);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [canEditEvidence, canDeleteEvidence, onViewDetails, onDomainFilterClick, activeDomainId, handleDownload, router]
  );

  // Create table instance
  const table = useReactTable({
    data: evidenceData?.items ?? [],
    columns,
    pageCount: evidenceData?.totalPages ?? 0,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  // Check if any filters are active - AC18
  const hasActiveFilters =
    debouncedSearch ||
    controlDomainFilter.length > 0 ||
    frameworkFilter ||
    dateRange.from ||
    dateRange.to;

  // Clear all filters - AC19
  const clearAllFilters = () => {
    setSearchInput("");
    setControlDomainFilter([]);
    setFrameworkFilter(undefined);
    setDateRange({ from: undefined, to: undefined });
    setPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, controlDomainFilter, frameworkFilter, dateRange]);

  return (
    <div className="space-y-4">
      {/* Filters Row - AC13-AC19 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Global Search - AC13 */}
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by filename..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Framework Filter - AC14 */}
          {frameworks && frameworks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  Framework
                  {frameworkFilter && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter by Framework</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {frameworks.map((framework) => (
                  <DropdownMenuCheckboxItem
                    key={framework.code}
                    checked={frameworkFilter === framework.code}
                    onCheckedChange={(checked) =>
                      setFrameworkFilter(checked ? framework.code : undefined)
                    }
                  >
                    {framework.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Control Domain Filter - AC15 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                Control Domain
                {controlDomainFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {controlDomainFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <h4 className="font-medium">Filter by Control Domain</h4>
                <ControlDomainSelector
                  value={controlDomainFilter}
                  onChange={setControlDomainFilter}
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Filter - AC16 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Date Range
                {(dateRange.from || dateRange.to) && (
                  <Badge variant="secondary" className="ml-1">
                    1
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) =>
                  setDateRange({ from: range?.from, to: range?.to })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Column Visibility Toggle - AC20 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === "originalFileName"
                    ? "Filename"
                    : column.id === "createdAt"
                    ? "Upload Date"
                    : column.id === "uploadedBy"
                    ? "Uploaded By"
                    : column.id === "controlDomains"
                    ? "Control Domains"
                    : column.id === "frameworkControls"
                    ? "Controls"
                    : column.id === "fileSize"
                    ? "Size"
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Filters Display - AC18 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {debouncedSearch && (
            <Badge variant="secondary" className="gap-1">
              Search: {debouncedSearch}
              <button onClick={() => setSearchInput("")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {frameworkFilter && (
            <Badge variant="secondary" className="gap-1">
              Framework: {frameworks?.find((f) => f.code === frameworkFilter)?.name}
              <button onClick={() => setFrameworkFilter(undefined)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {controlDomainFilter.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {controlDomainFilter.length} domain(s)
              <button onClick={() => setControlDomainFilter([])}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(dateRange.from || dateRange.to) && (
            <Badge variant="secondary" className="gap-1">
              {dateRange.from && formatDate(dateRange.from)}
              {dateRange.from && dateRange.to && " - "}
              {dateRange.to && formatDate(dateRange.to)}
              <button onClick={() => setDateRange({ from: undefined, to: undefined })}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {/* Clear All Button - AC19 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs"
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Table - AC1-AC6 */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {debouncedSearch
                      ? "No evidence found matching your search"
                      : "No evidence files found"}
                  </p>
                  {!debouncedSearch && (
                    <p className="text-sm text-gray-400 mt-1">
                      Upload your first evidence file to get started
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination - AC4-AC5 */}
      {evidenceData && evidenceData.totalPages > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, evidenceData.total)} of{" "}
            {evidenceData.total} results
          </p>
          <div className="flex items-center gap-2">
            {/* First page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            {/* Previous page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Page indicator */}
            <span className="text-sm">
              Page{" "}
              <Input
                type="number"
                min={1}
                max={evidenceData.totalPages}
                value={page}
                onChange={(e) => {
                  const newPage = parseInt(e.target.value);
                  if (newPage >= 1 && newPage <= evidenceData.totalPages) {
                    setPage(newPage);
                  }
                }}
                className="w-16 h-8 inline-block mx-1 text-center"
              />{" "}
              of {evidenceData.totalPages}
            </span>
            {/* Next page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setPage((p) => Math.min(evidenceData.totalPages, p + 1))
              }
              disabled={page === evidenceData.totalPages}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Last page */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(evidenceData.totalPages)}
              disabled={page === evidenceData.totalPages}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog - AC28 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Evidence</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this evidence? This action will
              archive the file and it will no longer be available for compliance
              tracking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setEvidenceToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
