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
 * - Column visibility and reordering (TanStack Table + dnd-kit)
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnOrderState,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  Plus,
  FileSearch,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Settings2,
  GripVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow, format } from "date-fns";

import { FindingSource, FindingStatus, Severity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";
import { READ_ROLES, WRITE_ROLES } from "@/lib/auth/roles";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";

import {
  FindingFilters,
  DEFAULT_FILTERS,
  type FindingFilterState,
} from "@/components/findings/FindingFilters";
import { FindingsPagination } from "@/components/findings/FindingsPagination";
import { FindingStatusBadge } from "@/components/findings/FindingStatusBadge";
import { FindingSourceBadge } from "@/components/findings/FindingSourceBadge";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { ToxicMark } from "@/components/pathway/ToxicMark";

// localStorage keys for column persistence
const COLUMN_VISIBILITY_KEY = "findings-table-column-visibility";
const COLUMN_ORDER_KEY = "findings-table-column-order";

/**
 * Roles that can create findings (any mutation → write tier)
 */
const FINDING_CREATE_ROLES = WRITE_ROLES;

/**
 * Roles that can export findings (read tier — Business Users may export)
 */
const FINDING_EXPORT_ROLES = READ_ROLES;

/**
 * Finding data shape from the list query (expanded)
 */
interface FindingListItem {
  id: string;
  identifier: string;
  title: string;
  description: string;
  source: FindingSource;
  severity: Severity;
  // Story 20.3: matrix-anchored severity (label preferred by SeverityBadge)
  severityLabel: string | null;
  inherentScore: number | string | null;
  status: FindingStatus;
  affectedAssets: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  triagedAt: Date | string | null;
  dueDate: Date | string | null;
  closedAt: Date | string | null;
  slaBreached: boolean;
  isToxic: boolean;
  duplicateOfId: string | null;
  creator?: { id: string; name: string | null; email: string | null } | null;
  assignee?: { id: string; name: string | null; email: string | null } | null;
  triager?: { id: string; name: string | null; email: string | null } | null;
  affectedBusinessUnits?: { id: string; name: string }[];
  _count?: {
    ControlLinks: number;
    comments: number;
    evidenceLinks: number;
  };
}

/** All available column IDs */
const ALL_COLUMN_IDS = [
  "identifier",
  "title",
  "source",
  "severity",
  "inherentScore",
  "status",
  "createdAt",
  "updatedAt",
  "description",
  "assignee",
  "creator",
  "triager",
  "triagedAt",
  "dueDate",
  "closedAt",
  "slaBreached",
  "affectedAssets",
  "affectedBusinessUnits",
  "controlLinksCount",
  "commentsCount",
  "evidenceCount",
  "actions",
] as const;

/** Default column visibility */
const DEFAULT_VISIBILITY: VisibilityState = {
  identifier: true,
  title: true,
  source: true,
  severity: true,
  inherentScore: true,
  status: true,
  createdAt: true,
  updatedAt: false,
  description: false,
  assignee: false,
  creator: false,
  triager: false,
  triagedAt: false,
  dueDate: false,
  closedAt: false,
  slaBreached: false,
  affectedAssets: false,
  affectedBusinessUnits: false,
  controlLinksCount: false,
  commentsCount: false,
  evidenceCount: false,
  actions: true,
};

/** Column labels for display */
const COLUMN_LABELS: Record<string, string> = {
  identifier: "ID",
  title: "Title",
  source: "Source",
  severity: "Severity",
  status: "Status",
  createdAt: "Created",
  updatedAt: "Updated",
  description: "Description",
  assignee: "Assignee",
  creator: "Creator",
  triager: "Triaged By",
  triagedAt: "Triaged Date",
  dueDate: "Due Date",
  closedAt: "Closed Date",
  slaBreached: "SLA Breached",
  affectedAssets: "Affected Assets",
  affectedBusinessUnits: "Business Units",
  controlLinksCount: "Control Links",
  commentsCount: "Comments",
  evidenceCount: "Evidence",
  actions: "Actions",
};

/** Format relative time (e.g., "2 hours ago") */
function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Format date for display */
function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

/** Truncate text with ellipsis */
function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/** Draggable table header component */
function DraggableTableHeader({
  header,
  children,
}: {
  header: { id: string; column: { getCanSort: () => boolean } };
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <TableHead ref={setNodeRef} style={style} className="group relative">
      <div className="flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/70" />
        </span>
        {children}
      </div>
    </TableHead>
  );
}

/** Sortable column header component */
function SortableHeader({
  column,
  children,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: () => void };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground data-[state=open]:bg-accent"
      onClick={(e) => {
        e.stopPropagation();
        column.toggleSorting();
      }}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export function FindingsListContent() {
  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter state (AC13-AC18). Seeded from URL search params so deep links
  // from dashboard metric cards (e.g. /findings?status=NEW,TRIAGED) land
  // pre-filtered.
  const searchParams = useSearchParams();
  const initialFilters = useMemo<FindingFilterState>(() => {
    const parseEnum = <T extends string>(
      key: string,
      allowed: readonly T[]
    ): T[] => {
      const raw = searchParams.get(key);
      if (!raw) return [];
      return raw
        .split(",")
        .map((v) => v.trim())
        .filter((v): v is T => (allowed as readonly string[]).includes(v));
    };
    return {
      status: parseEnum<FindingStatus>("status", Object.values(FindingStatus)),
      source: parseEnum<FindingSource>("source", Object.values(FindingSource)),
      severity: parseEnum<Severity>("severity", Object.values(Severity)),
      // Story 20.3: matrix label deep-links (e.g. /findings?severityLabel=Critical)
      severityLabel:
        searchParams
          .get("severityLabel")
          ?.split(",")
          .map((v) => v.trim())
          .filter(Boolean) ?? [],
      search: searchParams.get("search") ?? "",
    };
    // Run once on mount; subsequent filter changes are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [filters, setFilters] = useState<FindingFilterState>(initialFilters);

  // Sorting state (AC19-AC21)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true }, // AC20: Default sort by created descending
  ]);

  // Pagination state (AC22-AC25)
  const [pageSize, setPageSize] = useState(25);
  const [cursors, setCursors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);

  // Column order state
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([...ALL_COLUMN_IDS]);

  // Load saved column visibility and order from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (savedVisibility) {
        try {
          setColumnVisibility(JSON.parse(savedVisibility) as VisibilityState);
        } catch {
          // Invalid JSON, use defaults
        }
      }

      const savedOrder = localStorage.getItem(COLUMN_ORDER_KEY);
      if (savedOrder) {
        try {
          setColumnOrder(JSON.parse(savedOrder) as ColumnOrderState);
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
  }, []);

  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, isMounted]);

  // Save column order to localStorage when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    }
  }, [columnOrder, isMounted]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get current cursor for pagination
  const currentCursor = cursors[currentPage - 2]; // -2 because first page has no cursor

  // Map TanStack sorting to API format
  const sortBy = sorting[0]?.id as
    | "identifier"
    | "title"
    | "severity"
    | "status"
    | "createdAt"
    | "inherentScore" // Story 20.3: score column
    | undefined;
  const sortOrder = sorting[0]?.desc ? "desc" : "asc";

  // Fetch findings stats for summary cards
  const { data: stats, isLoading: isStatsLoading } = api.finding.getStats.useQuery();

  // Fetch findings with filters, sorting, and pagination
  const { data, isLoading, isError, error } = api.finding.list.useQuery({
    status: filters.status.length > 0 ? filters.status : undefined,
    source: filters.source.length > 0 ? filters.source : undefined,
    severity: filters.severity.length > 0 ? filters.severity : undefined,
    severityLabel:
      filters.severityLabel.length > 0 ? filters.severityLabel : undefined,
    search: filters.search || undefined,
    sortBy,
    sortOrder,
    limit: pageSize,
    cursor: currentCursor,
  });

  // Check if user can create findings (AC4, AC32-AC33)
  const canCreateFinding = useHasRole(FINDING_CREATE_ROLES);

  // Check if user can export findings
  const canExportFindings = useHasRole(FINDING_EXPORT_ROLES);

  // Export mutation
  const exportMutation = api.finding.exportFindings.useMutation({
    onSuccess: (result) => {
      // Download CSV file
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", result.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${result.rowCount} findings`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to export findings");
    },
  });

  const handleExport = useCallback(() => {
    exportMutation.mutate({
      status: filters.status.length > 0 ? filters.status : undefined,
      source: filters.source.length > 0 ? filters.source : undefined,
      severity: filters.severity.length > 0 ? filters.severity : undefined,
      search: filters.search || undefined,
    });
  }, [exportMutation, filters]);

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

  // Handle drag end for column reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((current) => {
        const oldIndex = current.indexOf(active.id as string);
        const newIndex = current.indexOf(over.id as string);
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  }, []);

  // Define column definitions
  const columns = useMemo<ColumnDef<FindingListItem>[]>(
    () => [
      {
        id: "identifier",
        accessorKey: "identifier",
        header: ({ column }) => (
          <SortableHeader column={column}>ID</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <Link
              href={`/findings/${row.original.id}`}
              className="font-mono text-sm font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.getValue("identifier")}
            </Link>
            {row.original.isToxic ? <ToxicMark size={12} /> : null}
          </span>
        ),
        enableHiding: false,
      },
      {
        id: "title",
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>Title</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[300px] font-semibold text-foreground" title={row.getValue("title")}>
            {row.getValue("title")}
          </span>
        ),
      },
      {
        id: "source",
        accessorKey: "source",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Source
          </span>
        ),
        cell: ({ row }) => (
          <FindingSourceBadge source={row.getValue("source")} size="sm" />
        ),
        enableSorting: false,
      },
      {
        id: "severity",
        accessorKey: "severity",
        header: ({ column }) => (
          <SortableHeader column={column}>Severity</SortableHeader>
        ),
        cell: ({ row }) => (
          <SeverityBadge
            severity={row.getValue("severity")}
            severityLabel={row.original.severityLabel}
            size="sm"
            showTooltip={false}
          />
        ),
      },
      {
        // Story 20.3: sortable matrix score (unscored legacy findings show —)
        id: "inherentScore",
        accessorKey: "inherentScore",
        header: ({ column }) => (
          <SortableHeader column={column}>Score</SortableHeader>
        ),
        cell: ({ row }) => {
          const score = row.original.inherentScore;
          return (
            <span className="font-mono text-sm text-muted-foreground">
              {score == null ? "—" : Number(Number(score).toFixed(2))}
            </span>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <FindingStatusBadge status={row.getValue("status")} size="sm" />
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <SortableHeader column={column}>Created</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground text-sm">
            {formatRelativeTime(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Updated
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground text-sm">
            {formatRelativeTime(row.getValue("updatedAt"))}
          </span>
        ),
      },
      {
        id: "description",
        accessorKey: "description",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Description
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-[250px] truncate block">
            {truncateText(row.getValue("description"), 80)}
          </span>
        ),
      },
      {
        id: "assignee",
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Assignee
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.assignee?.name ?? row.original.assignee?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "creator",
        accessorFn: (row) => row.creator?.name ?? row.creator?.email,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Creator
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.creator?.name ?? row.original.creator?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "triager",
        accessorFn: (row) => row.triager?.name ?? row.triager?.email,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Triaged By
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.triager?.name ?? row.original.triager?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "triagedAt",
        accessorKey: "triagedAt",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Triaged Date
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {formatDate(row.getValue("triagedAt"))}
          </span>
        ),
      },
      {
        id: "dueDate",
        accessorKey: "dueDate",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Due Date
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {formatDate(row.getValue("dueDate"))}
          </span>
        ),
      },
      {
        id: "closedAt",
        accessorKey: "closedAt",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Closed Date
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {formatDate(row.getValue("closedAt"))}
          </span>
        ),
      },
      {
        id: "slaBreached",
        accessorKey: "slaBreached",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            SLA Breached
          </span>
        ),
        cell: ({ row }) => (
          row.getValue("slaBreached") ? (
            <Badge variant="critical" className="text-xs">Breached</Badge>
          ) : (
            <span className="text-sm text-muted-foreground/70">—</span>
          )
        ),
      },
      {
        id: "affectedAssets",
        accessorKey: "affectedAssets",
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Affected Assets
          </span>
        ),
        cell: ({ row }) => {
          const assets = row.original.affectedAssets ?? [];
          if (assets.length === 0) return <span className="text-sm text-muted-foreground/70">—</span>;
          return (
            <span className="text-sm" title={assets.join(", ")}>
              {assets.length} asset{assets.length !== 1 ? "s" : ""}
            </span>
          );
        },
      },
      {
        id: "affectedBusinessUnits",
        accessorFn: (row) => row.affectedBusinessUnits?.map((bu) => bu.name).join(", "),
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Business Units
          </span>
        ),
        cell: ({ row }) => {
          const bus = row.original.affectedBusinessUnits ?? [];
          if (bus.length === 0) return <span className="text-sm text-muted-foreground/70">—</span>;
          return (
            <span className="text-sm" title={bus.map((bu) => bu.name).join(", ")}>
              {bus.length} unit{bus.length !== 1 ? "s" : ""}
            </span>
          );
        },
      },
      {
        id: "controlLinksCount",
        accessorFn: (row) => row._count?.ControlLinks ?? 0,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Control Links
          </span>
        ),
        cell: ({ row }) => (
          <Badge variant="code" className="text-xs">
            {row.original._count?.ControlLinks ?? 0}
          </Badge>
        ),
      },
      {
        id: "commentsCount",
        accessorFn: (row) => row._count?.comments ?? 0,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Comments
          </span>
        ),
        cell: ({ row }) => (
          <Badge variant="code" className="text-xs">
            {row.original._count?.comments ?? 0}
          </Badge>
        ),
      },
      {
        id: "evidenceCount",
        accessorFn: (row) => row._count?.evidenceLinks ?? 0,
        header: () => (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Evidence
          </span>
        ),
        cell: ({ row }) => (
          <Badge variant="code" className="text-xs">
            {row.original._count?.evidenceLinks ?? 0}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost" className="text-muted-foreground/70 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
            <Link href={`/findings/${row.original.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        ),
        enableHiding: false,
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: (data?.items ?? []) as FindingListItem[],
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      handleSortingChange(newSorting);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // We handle sorting server-side
    manualPagination: true,
  });

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

  // Loading state - include isMounted check to prevent hydration mismatch
  if (!isMounted) {
    return (
      <AppLayout breadcrumbs={[{ label: "Findings" }]} fullWidth>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (isError) {
    return (
      <AppLayout breadcrumbs={[{ label: "Findings" }]} fullWidth>
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
    <AppLayout breadcrumbs={[{ label: "Findings" }]} fullWidth>
      {/* Header with title and action buttons */}
      <PageHeader
        eyebrow="FINDINGS REGISTER"
        title="Findings"
        icon={<FileSearch />}
        description="Manage security findings from audits, pentests, and other sources."
        actions={
          <>
            {/* Export button */}
            {canExportFindings && (
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export CSV
              </Button>
            )}
            {/* AC4: "New Finding" button (role-based visibility) */}
            {canCreateFinding && (
              <Button asChild>
                <Link href="/findings/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Finding
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Open Findings */}
        <StatTile
          label="OPEN FINDINGS"
          value={
            isStatsLoading ? <Skeleton className="h-8 w-16" /> : (stats?.openCount ?? 0)
          }
          sub="Awaiting triage or resolution"
          icon={<AlertTriangle />}
          tone="primary"
          accent
        />

        {/* By Severity */}
        <StatTile
          label="BY SEVERITY"
          icon={<AlertCircle />}
          value={
            isStatsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-severity-high" />
                  <span className="tnum font-medium text-foreground">{stats?.severityDistribution.HIGH ?? 0}</span>
                  <span className="text-muted-foreground">High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="tnum font-medium text-foreground">{stats?.severityDistribution.MEDIUM ?? 0}</span>
                  <span className="text-muted-foreground">Med</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="tnum font-medium text-foreground">{stats?.severityDistribution.LOW ?? 0}</span>
                  <span className="text-muted-foreground">Low</span>
                </div>
              </div>
            )
          }
        />

        {/* Closed */}
        <StatTile
          label="CLOSED"
          value={
            isStatsLoading ? <Skeleton className="h-8 w-16" /> : (stats?.statusDistribution.CLOSED ?? 0)
          }
          sub="Remediated or resolved"
          icon={<CheckCircle2 />}
          tone="success"
        />

        {/* Rejected / duplicate */}
        <StatTile
          label="DISMISSED"
          value={
            isStatsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              (stats?.statusDistribution.REJECTED ?? 0) + (stats?.statusDistribution.DUPLICATE ?? 0)
            )
          }
          sub="Rejected or duplicate"
          icon={<XCircle />}
        />
      </div>

      {/* Filters */}
      <FindingFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Table or Empty State */}
      {!isLoading && findings.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Findings</CardTitle>
                  <CardDescription>
                    Click on a finding to view details. Drag column headers to reorder.
                  </CardDescription>
                </div>
                {/* Column Visibility Toggle */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
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
                          {COLUMN_LABELS[column.id] ?? column.id}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToHorizontalAxis]}
                  >
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            <SortableContext
                              items={headerGroup.headers.map((h) => h.id)}
                              strategy={horizontalListSortingStrategy}
                            >
                              {headerGroup.headers.map((header) => (
                                <DraggableTableHeader key={header.id} header={header}>
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </DraggableTableHeader>
                              ))}
                            </SortableContext>
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                              <span className="text-muted-foreground">No findings found</span>
                            </TableCell>
                          </TableRow>
                        ) : (
                          table.getRowModel().rows.map((row) => (
                            <TableRow
                              key={row.id}
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                window.location.href = `/findings/${row.original.id}`;
                              }}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              )}
            </CardContent>
          </Card>

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
