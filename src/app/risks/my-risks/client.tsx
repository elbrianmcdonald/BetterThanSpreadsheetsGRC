"use client";

/**
 * My Assigned Risks Client Component (IT Stakeholder View)
 *
 * Displays a list of risks assigned to the current user as IT owner.
 *
 * Story 4.9: Role-Based Risk Views - IT Stakeholder Risk List (AC1-AC6)
 * AC3: Risk list displays risk title, severity, impact score, status, assigned date
 * AC4: Risk list filterable by status (ASSIGNED, REMEDIATED, CLOSED)
 * AC5: Risk list sortable by impact score, assigned date, status
 * AC34: IT_STAKEHOLDER with no assigned risks sees "No risks assigned" message
 *
 * @see Story 4.9: Role-Based Risk Views
 */

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Gauge,
} from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatTile } from "@/components/layout";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignOutButton } from "@/components/auth/SignOutButton";

/** Severity badge variants */
const severityConfig = {
  HIGH: { variant: "critical" as const, label: "High" },
  MEDIUM: { variant: "warning" as const, label: "Medium" },
  LOW: { variant: "success" as const, label: "Low" },
};

/** Status badge variants */
const statusConfig = {
  OPEN: { variant: "info" as const, label: "Open", icon: AlertTriangle },
  ASSIGNED: { variant: "info" as const, label: "Assigned", icon: Clock },
  REMEDIATED: { variant: "success" as const, label: "Remediated", icon: CheckCircle },
  CLOSED: { variant: "neutral" as const, label: "Closed", icon: XCircle },
};

/** Impact score color based on value */
function getImpactScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/70";
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-severity-high";
  if (score >= 25) return "text-warning";
  return "text-success";
}

type SortField = "impactScore" | "assignedAt" | "createdAt" | "severity";
type SortOrder = "asc" | "desc";

export function MyRisksClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("impactScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Fetch risks (automatically filtered by role in the backend)
  // Story 5.5: Updated to use array-based status filter
  const { data, isLoading, error } = api.risk.list.useQuery({
    page,
    pageSize,
    status: statusFilter !== "all" ? [statusFilter as "DRAFT" | "PENDING_REVIEW" | "OPEN" | "ASSIGNED" | "REMEDIATED" | "CLOSED"] : undefined,
    sortBy: sortField,
    sortOrder,
  });

  // Toggle sort order for a field
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Navigation */}
      <nav className="bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link href="/" className="text-xl font-bold text-foreground">
                  BetterThanSpreadsheetsGRC
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/risks/my-risks" className="inline-flex items-center border-b-2 border-primary px-1 pt-1 text-sm font-medium text-foreground">
                  My Assigned Risks
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {session?.user?.name} ({session?.user?.role})
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="text-muted-foreground/70 hover:text-muted-foreground">
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="h-5 w-5 flex-shrink-0 text-muted-foreground/70" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  My Assigned Risks
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          eyebrow="MY WORK"
          title="My Assigned Risks"
          icon={<ShieldAlert />}
          description="Risks assigned to you for technical remediation. Track your progress and update status as you resolve issues."
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatTile
            label="TOTAL ASSIGNED"
            value={data?.total ?? 0}
            icon={<ShieldAlert />}
            accent
          />

          <StatTile
            label="NEEDS ATTENTION"
            value={data?.risks.filter((r) => r.status === "ASSIGNED").length ?? 0}
            icon={<Clock />}
            tone="primary"
          />

          <StatTile
            label="REMEDIATED"
            value={data?.risks.filter((r) => r.status === "REMEDIATED").length ?? 0}
            icon={<CheckCircle />}
            tone="success"
          />

          <StatTile
            label="AVG IMPACT SCORE"
            value={
              data?.risks.length
                ? Math.round(
                    data.risks.reduce((sum, r) => sum + (r.impactScore ?? 0), 0) / data.risks.length
                  )
                : 0
            }
            icon={<Gauge />}
          />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-[15px] font-bold flex items-center gap-2">
              <ArrowUpDown className="h-[17px] w-[17px] text-primary" />
              Filters & Sorting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="REMEDIATED">Remediated</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={(value) => {
                  const [field, order] = value.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impactScore-desc">Impact Score (High to Low)</SelectItem>
                  <SelectItem value="impactScore-asc">Impact Score (Low to High)</SelectItem>
                  <SelectItem value="assignedAt-desc">Date Assigned (Newest)</SelectItem>
                  <SelectItem value="assignedAt-asc">Date Assigned (Oldest)</SelectItem>
                  <SelectItem value="severity-desc">Severity (High to Low)</SelectItem>
                  <SelectItem value="severity-asc">Severity (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Risk Table */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Risks</CardTitle>
            <CardDescription>
              Click on a risk to view details and update remediation progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive">{error.message}</p>
              </div>
            ) : data?.risks.length === 0 ? (
              /* AC34: Empty state for IT Stakeholder with no assigned risks */
              <div className="text-center py-12">
                <ShieldAlert className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No risks assigned to you</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  {statusFilter !== "all"
                    ? "No risks match the selected filter. Try adjusting your filter."
                    : "You currently have no risks assigned for remediation. When security findings are identified that require your attention, they will appear here."}
                </p>
                {statusFilter !== "all" && (
                  <Button variant="outline" onClick={() => setStatusFilter("all")}>
                    Clear Filter
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Title</TableHead>
                        <TableHead className="w-[100px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Severity</TableHead>
                        <TableHead className="w-[120px] text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <button
                            className="flex items-center gap-1 hover:text-foreground ml-auto"
                            onClick={() => toggleSort("impactScore")}
                          >
                            Impact Score
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="w-[120px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                        <TableHead className="w-[150px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => toggleSort("assignedAt")}
                          >
                            Assigned
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.risks.map((risk) => {
                        const severityStyle = severityConfig[risk.severity as keyof typeof severityConfig];
                        const statusStyle = statusConfig[risk.status as keyof typeof statusConfig];
                        const StatusIcon = statusStyle?.icon;

                        return (
                          <TableRow
                            key={risk.id}
                            className="cursor-pointer hover:bg-secondary"
                            onClick={() => router.push(`/risks/${risk.id}`)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-semibold text-foreground">{risk.title}</p>
                                <p className="text-sm text-muted-foreground truncate max-w-md">
                                  {risk.description.substring(0, 100)}
                                  {risk.description.length > 100 ? "..." : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={severityStyle?.variant}>
                                {severityStyle?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-semibold tabular-nums ${getImpactScoreColor(risk.impactScore)}`}>
                                {risk.impactScore !== null ? risk.impactScore : "N/A"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusStyle?.variant}>
                                {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                                {statusStyle?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground tabular-nums">
                              {risk.assignedAt
                                ? new Date(risk.assignedAt).toLocaleDateString()
                                : new Date(risk.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to{" "}
                      {Math.min(page * pageSize, data.total)} of {data.total} risks
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === data.totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
