"use client";

/**
 * Findings Table Component
 *
 * Story 7.12: Findings List Page (AC5-AC12, AC19-AC21)
 *
 * Displays findings in a sortable, paginated table using TanStack Table.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { FindingSource, FindingStatus, Severity } from "@prisma/client";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FindingStatusBadge } from "./FindingStatusBadge";
import { FindingSourceBadge } from "./FindingSourceBadge";
import { SeverityBadge } from "@/components/risk/SeverityBadge";

/**
 * Finding data shape from the list query
 */
export interface FindingListItem {
  id: string;
  identifier: string;
  title: string;
  source: FindingSource;
  severity: Severity;
  status: FindingStatus;
  createdAt: Date | string;
  creator?: { id: string; name: string | null; email: string | null } | null;
  assignee?: { id: string; name: string | null; email: string | null } | null;
}

interface FindingsTableProps {
  data: FindingListItem[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  isLoading?: boolean;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Sortable column header component
 */
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
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting()}
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

export function FindingsTable({
  data,
  sorting,
  onSortingChange,
  isLoading = false,
}: FindingsTableProps) {
  // AC5-AC11: Define columns
  const columns = useMemo<ColumnDef<FindingListItem>[]>(
    () => [
      {
        accessorKey: "identifier",
        header: ({ column }) => (
          <SortableHeader column={column}>ID</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            href={`/findings/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.getValue("identifier")}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableHeader column={column}>Title</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[300px]" title={row.getValue("title")}>
            {row.getValue("title")}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <FindingSourceBadge source={row.getValue("source")} size="sm" />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "severity",
        header: ({ column }) => (
          <SortableHeader column={column}>Severity</SortableHeader>
        ),
        cell: ({ row }) => (
          <SeverityBadge
            severity={row.getValue("severity")}
            size="sm"
            showTooltip={false}
          />
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <FindingStatusBadge status={row.getValue("status")} size="sm" />
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <SortableHeader column={column}>Created</SortableHeader>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatRelativeTime(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/findings/${row.original.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(newSorting);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // We handle sorting server-side
  });

  return (
    <div className="rounded-md border">
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
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <span className="text-muted-foreground">Loading findings...</span>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
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
                  // Navigate on row click
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
    </div>
  );
}
