"use client";

/**
 * Business Processes List Client Component
 *
 * Epic 10: BIA Core Module
 * Story 10.4: Process List View with Search & Sort
 *
 * Features:
 * - Paginated list of business processes
 * - Search by name/identifier
 * - Filter by status, function, owner, tier
 * - Sort by various columns
 * - Role-based visibility (stakeholders see only their processes)
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Search,
  Activity,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { BusinessProcessStatus } from "@prisma/client";
import { useSession } from "next-auth/react";

const STATUS_LABELS: Record<BusinessProcessStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  UNDER_REVIEW: "Under Review",
  DELETED: "Deleted",
};

const STATUS_COLORS: Record<BusinessProcessStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  DELETED: "bg-red-100 text-red-800",
};

export function BusinessProcessesClient() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [functionFilter, setFunctionFilter] = useState<string>(
    searchParams.get("functionId") ?? "all"
  );
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "identifier" | "status" | "updatedAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Queries
  const { data: processesData, isLoading } = api.businessProcess.list.useQuery({
    page,
    pageSize: 25,
    search: search || undefined,
    status: statusFilter !== "all" ? [statusFilter as BusinessProcessStatus] : undefined,
    businessFunctionId: functionFilter !== "all" ? functionFilter : undefined,
    sortBy,
    sortOrder,
  });

  const { data: functions } = api.businessFunction.list.useQuery({
    includeInactive: false,
  });

  const processes = processesData?.items ?? [];
  const totalPages = processesData?.totalPages ?? 1;
  const total = processesData?.total ?? 0;

  // Toggle sort
  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setFunctionFilter("all");
    setPage(1);
  };

  const hasFilters = search || statusFilter !== "all" || functionFilter !== "all";

  return (
    <AppLayout breadcrumbs={[{ label: "Business Impact" }, { label: "Business Processes" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Business Processes
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Document and assess critical business processes.
            </p>
          </div>
          <Link href="/bia/processes/new">
            <Button className="mt-4 sm:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Add Process
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={BusinessProcessStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={BusinessProcessStatus.INACTIVE}>Inactive</SelectItem>
                  <SelectItem value={BusinessProcessStatus.UNDER_REVIEW}>Under Review</SelectItem>
                </SelectContent>
              </Select>

              {/* Function Filter */}
              <Select
                value={functionFilter}
                onValueChange={(v) => {
                  setFunctionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Function" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {functions?.map((fn) => (
                    <SelectItem key={fn.id} value={fn.id}>
                      {fn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Processes</CardTitle>
                <CardDescription>
                  {total} process{total !== 1 ? "es" : ""} found
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No business processes found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasFilters
                    ? "Try adjusting your filters"
                    : "Create your first business process to get started"}
                </p>
                {!hasFilters && (
                  <Link href="/bia/processes/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Process
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("identifier")}
                      >
                        <div className="flex items-center gap-2">
                          Identifier
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("name")}
                      >
                        <div className="flex items-center gap-2">
                          Name
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead>Function</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-center">Tier</TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("status")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Status
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSort("updatedAt")}
                      >
                        <div className="flex items-center gap-2">
                          Updated
                          <ArrowUpDown className="h-4 w-4" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processes.map((process) => (
                      <TableRow key={process.id}>
                        <TableCell>
                          <Link
                            href={`/bia/processes/${process.id}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {process.identifier}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bia/processes/${process.id}`}
                            className="font-medium hover:underline"
                          >
                            {process.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {process.businessFunction?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {process.owner?.name ?? (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {process.effectiveTier ? (
                            <Badge
                              style={{
                                backgroundColor: process.effectiveTier.colorHex,
                                color: "#fff",
                              }}
                            >
                              {process.effectiveTier.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Assessed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={STATUS_COLORS[process.status]}>
                            {STATUS_LABELS[process.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(process.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
