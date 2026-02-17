"use client";

/**
 * Assessment List Client Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.6: Assessment History View (FR24)
 *
 * Client component that handles:
 * - Filter state management
 * - Pagination state
 * - Sorting state
 * - API queries
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format, isPast, differenceInDays } from "date-fns";
import {
  Plus,
  ClipboardCheck,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  MessageSquare,
} from "lucide-react";

import { UserRole, VendorAssessmentStatus } from "@prisma/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";
import {
  AssessmentStatusBadge,
  getAssessmentStatusOptions,
  AssessmentRecommendationBadge,
} from "@/components/assessment";
import { VendorRiskTierBadge } from "@/components/vendor";

/**
 * Roles that can create assessments
 */
const ASSESSMENT_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

/**
 * Assessment data shape from the list query
 */
interface AssessmentListItem {
  id: string;
  identifier: string;
  title: string;
  status: VendorAssessmentStatus;
  dueDate: Date | string | null;
  riskScore: number | null;
  recommendation: string | null;
  createdAt: Date | string;
  vendor: {
    id: string;
    identifier: string;
    name: string;
    riskTier: string | null;
  };
  assessor: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  _count: {
    comments: number;
  };
}

export function AssessmentListClient() {
  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorAssessmentStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  // Role checks
  const canManageAssessments = useHasRole(ASSESSMENT_MANAGE_ROLES);

  // Fetch assessments with filters
  const { data, isLoading, error } = api.vendorAssessment.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    page,
    pageSize: 25,
    sortBy: sorting[0]?.id as "createdAt" | "dueDate" | "status" | "title" | undefined,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
  });

  // Fetch stats
  const { data: stats } = api.vendorAssessment.getStats.useQuery();

  // Define columns
  const columns = useMemo<ColumnDef<AssessmentListItem>[]>(
    () => [
      {
        accessorKey: "identifier",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            ID
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
          <Link
            href={`/tprm/assessments/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.getValue("identifier")}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Title
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
          <Link
            href={`/tprm/assessments/${row.original.id}`}
            className="hover:underline"
          >
            {row.getValue("title")}
          </Link>
        ),
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/vendors/${row.original.vendor.id}`}
              className="hover:underline"
            >
              {row.original.vendor.name}
            </Link>
            {row.original.vendor.riskTier && (
              <VendorRiskTierBadge tier={row.original.vendor.riskTier as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} />
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <AssessmentStatusBadge status={row.getValue("status")} />
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Due Date
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const dueDate = row.original.dueDate;
          if (!dueDate) return "-";
          const date = new Date(dueDate);
          const isOverdue = row.original.status !== VendorAssessmentStatus.COMPLETED && isPast(date);
          const daysUntil = differenceInDays(date, new Date());
          return (
            <div className="flex items-center gap-2">
              <span className={isOverdue ? "text-destructive" : daysUntil <= 7 && daysUntil >= 0 ? "text-yellow-600" : ""}>
                {format(date, "MMM d, yyyy")}
              </span>
              {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {!isOverdue && daysUntil <= 7 && daysUntil >= 0 && <Clock className="h-4 w-4 text-yellow-600" />}
            </div>
          );
        },
      },
      {
        accessorKey: "recommendation",
        header: "Recommendation",
        cell: ({ row }) => (
          <AssessmentRecommendationBadge recommendation={row.original.recommendation as "APPROVE" | "CONDITIONAL_APPROVE" | "REJECT" | null} />
        ),
      },
      {
        accessorKey: "assessor",
        header: "Assessor",
        cell: ({ row }) =>
          row.original.assessor?.name || row.original.assessor?.email || "-",
      },
      {
        accessorKey: "comments",
        header: "Comments",
        cell: ({ row }) => {
          const count = row.original._count?.comments || 0;
          if (count === 0) return "-";
          return (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              {count}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Created
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) =>
          format(new Date(row.getValue("createdAt")), "MMM d, yyyy"),
      },
    ],
    []
  );

  // Table instance
  const table = useReactTable({
    data: data?.assessments ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualSorting: true,
  });

  const statusOptions = getAssessmentStatusOptions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Vendor Assessments
            </h1>
            <p className="text-sm text-muted-foreground">
              Track and manage vendor assessment workflow
            </p>
          </div>
        </div>
        {canManageAssessments && (
          <Link href="/tprm/assessments/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Assessment
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assessments</CardDescription>
              <CardTitle className="text-2xl">{stats.totalCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Draft</CardDescription>
              <CardTitle className="text-2xl text-gray-600">
                {stats.statusDistribution?.DRAFT ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl text-blue-600">
                {stats.statusDistribution?.IN_PROGRESS ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Review</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">
                {stats.statusDistribution?.IN_REVIEW ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={stats.overdueCount > 0 ? "border-destructive" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className={`h-3 w-3 ${stats.overdueCount > 0 ? "text-destructive" : ""}`} />
                Overdue
              </CardDescription>
              <CardTitle className={`text-2xl ${stats.overdueCount > 0 ? "text-destructive" : ""}`}>
                {stats.overdueCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assessments..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as VendorAssessmentStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-destructive">
              Failed to load assessments: {error.message}
            </div>
          ) : data?.assessments.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No assessments found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search || statusFilter !== "ALL"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first assessment"}
              </p>
              {canManageAssessments && !search && statusFilter === "ALL" && (
                <Link href="/tprm/assessments/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    New Assessment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 25 + 1} to{" "}
              {Math.min(page * 25, data.totalCount)} of {data.totalCount}{" "}
              assessments
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
