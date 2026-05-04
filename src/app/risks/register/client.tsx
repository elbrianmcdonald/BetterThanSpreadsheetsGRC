"use client";

/**
 * Risk Register Client Component
 *
 * Story 16.5: Unified Risk Register Page
 *
 * Displays all risk register entries with:
 * - Summary stats cards (AC9, AC10)
 * - Status/BU/Owner/Severity filters (AC11-AC16)
 * - Table with sortable columns (AC17-AC21)
 * - SLA status badges (AC19)
 *
 * @see Story 16.5: Unified Risk Register Page
 */

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Search,
  Loader2,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ArrowRightLeft,
  AlertCircle,
  Filter,
  X,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RiskRegisterStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { AppLayout } from "@/components/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RiskRegisterStatusDropdown } from "@/components/risk/RiskRegisterStatusDropdown";

/** Status badge configuration */
const statusConfig: Record<RiskRegisterStatus, { color: string; label: string; icon: typeof AlertTriangle }> = {
  OPEN: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Open", icon: AlertCircle },
  IN_TREATMENT: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "In Treatment", icon: Clock },
  ACCEPTED: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", label: "Accepted", icon: CheckCircle },
  MITIGATED: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Mitigated", icon: ShieldCheck },
  TRANSFERRED: { color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", label: "Transferred", icon: ArrowRightLeft },
  CLOSED: { color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", label: "Closed", icon: XCircle },
};

/** Severity badge configuration */
const severityConfig: Record<string, { color: string }> = {
  Critical: { color: "bg-red-600 text-white" },
  High: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  Medium: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  Low: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  Info: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

/** SLA status configuration (AC19) */
const slaStatusConfig = {
  on_track: { color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", label: "On Track" },
  at_risk: { color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30", label: "At Risk" },
  breached: { color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", label: "Breached" },
  no_sla: { color: "text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800", label: "No SLA" },
};

export function RiskRegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  // Filter state
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<RiskRegisterStatus[]>([]);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"createdAt" | "dueDate" | "severity">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Fetch status counts (AC9, AC10)
  const { data: statusCounts } = api.riskRegister.getStatusCounts.useQuery();

  // Fetch business units for filter
  const { data: businessUnits } = api.businessUnit.getAll.useQuery();

  // Fetch owners for filter
  const { data: owners } = api.riskRegister.getOwners.useQuery();

  // Fetch risk register entries with filters
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.riskRegister.list.useInfiniteQuery(
      {
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        businessUnitId: selectedBusinessUnit !== "all" ? selectedBusinessUnit : undefined,
        ownerId: selectedOwner !== "all" ? selectedOwner : undefined,
        severityLabels: selectedSeverities.length > 0 ? selectedSeverities : undefined,
        search: search || undefined,
        sortBy,
        sortOrder,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  // Flatten pages into entries array
  const entries = useMemo(() => {
    return data?.pages.flatMap((page) => page.entries) ?? [];
  }, [data]);

  // Check if any filters are active
  const hasFilters = selectedStatuses.length > 0 || selectedBusinessUnit !== "all" ||
    selectedOwner !== "all" || selectedSeverities.length > 0 || search;

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setSelectedStatuses([]);
    setSelectedBusinessUnit("all");
    setSelectedOwner("all");
    setSelectedSeverities([]);
  }, []);

  // Toggle status in multi-select
  const toggleStatus = useCallback((status: RiskRegisterStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  // Toggle severity in multi-select
  const toggleSeverity = useCallback((severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  }, []);

  // Toggle sort
  const toggleSort = useCallback((column: "createdAt" | "dueDate" | "severity") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }, [sortBy]);

  // Loading state
  if (sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk", href: "/risks" }, { label: "Risk Register" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Risk", href: "/risks" }, { label: "Risk Register" }]}>
      <div className="space-y-6">
        {/* Header (AC8, AC9) */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Risk Register
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unified view of all organizational risks from assessments
            </p>
          </div>
        </div>

      {/* Stats Cards (AC9, AC10) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold">{statusCounts?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([RiskRegisterStatus.OPEN])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Open</p>
              <p className="text-2xl font-bold text-blue-600">{statusCounts?.OPEN ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([RiskRegisterStatus.IN_TREATMENT])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">In Treatment</p>
              <p className="text-2xl font-bold text-amber-600">{statusCounts?.IN_TREATMENT ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([RiskRegisterStatus.ACCEPTED])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Accepted</p>
              <p className="text-2xl font-bold text-purple-600">{statusCounts?.ACCEPTED ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([RiskRegisterStatus.MITIGATED])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mitigated</p>
              <p className="text-2xl font-bold text-green-600">{statusCounts?.MITIGATED ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedStatuses([RiskRegisterStatus.CLOSED])}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Closed</p>
              <p className="text-2xl font-bold text-gray-600">{statusCounts?.CLOSED ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "cursor-pointer hover:bg-muted/50 transition-colors",
          (statusCounts?.overdue ?? 0) > 0 && "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
        )}>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{statusCounts?.overdue ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters (AC11-AC16) */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search (AC15) */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter (AC11) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Filter className="h-4 w-4" />
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(statusConfig).map(([status, config]) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={selectedStatuses.includes(status as RiskRegisterStatus)}
                onCheckedChange={() => toggleStatus(status as RiskRegisterStatus)}
              >
                {config.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Business Unit Filter (AC12) */}
        <Select value={selectedBusinessUnit} onValueChange={setSelectedBusinessUnit}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Business Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Business Units</SelectItem>
            {businessUnits?.map((bu) => (
              <SelectItem key={bu.id} value={bu.id}>
                {bu.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Owner Filter (AC13) */}
        <Select value={selectedOwner} onValueChange={setSelectedOwner}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners?.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name ?? owner.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity Filter (AC14) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Filter className="h-4 w-4" />
              Severity
              {selectedSeverities.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {selectedSeverities.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["Critical", "High", "Medium", "Low", "Info"].map((severity) => (
              <DropdownMenuCheckboxItem
                key={severity}
                checked={selectedSeverities.includes(severity)}
                onCheckedChange={() => toggleSeverity(severity)}
              >
                {severity}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters (AC16) */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedStatuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {statusConfig[status].label}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleStatus(status)} />
            </Badge>
          ))}
          {selectedBusinessUnit !== "all" && (
            <Badge variant="secondary" className="gap-1">
              BU: {businessUnits?.find((bu) => bu.id === selectedBusinessUnit)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedBusinessUnit("all")} />
            </Badge>
          )}
          {selectedOwner !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Owner: {owners?.find((o) => o.id === selectedOwner)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedOwner("all")} />
            </Badge>
          )}
          {selectedSeverities.map((severity) => (
            <Badge key={severity} variant="secondary" className="gap-1">
              {severity}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSeverity(severity)} />
            </Badge>
          ))}
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
            </Badge>
          )}
        </div>
      )}

      {/* Table (AC17-AC21) */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600">{error.message}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No risk register entries found</h3>
              <p className="text-muted-foreground">
                {hasFilters
                  ? "Try adjusting your filters"
                  : "Create risk assessments to populate the register"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Risk Title</TableHead>
                      <TableHead className="w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-3"
                          onClick={() => toggleSort("severity")}
                        >
                          Severity
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[150px]">Owner</TableHead>
                      <TableHead className="w-[150px]">Business Unit</TableHead>
                      <TableHead className="w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-3"
                          onClick={() => toggleSort("dueDate")}
                        >
                          Due Date
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px]">SLA Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      // Resolve display fields from whichever side of the entry is set
                      const severityLabel =
                        entry.assessment?.inherentScoreLabel ?? entry.risk?.severity ?? null;
                      const severityStyle =
                        (severityLabel ? severityConfig[severityLabel] : null) ?? {
                          color: "bg-gray-100 text-gray-800",
                        };
                      const slaStyle = slaStatusConfig[entry.slaStatus];
                      const targetRiskId =
                        entry.risk?.id ?? entry.assessment?.finding?.id ?? null;
                      const titleText =
                        entry.assessment?.finding?.title ?? entry.risk?.title ?? "Untitled";
                      const subIdentifier =
                        entry.assessment?.identifier ?? entry.risk?.identifier ?? null;
                      const businessUnitName =
                        entry.assessment?.businessUnit?.name ??
                        entry.risk?.BusinessUnit?.name ??
                        null;

                      return (
                        <TableRow
                          key={entry.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (targetRiskId) router.push(`/risks/${targetRiskId}`);
                          }}
                        >
                          <TableCell className="font-mono text-sm">
                            {entry.identifier}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{titleText}</p>
                              {subIdentifier && (
                                <p className="text-xs text-muted-foreground">
                                  {subIdentifier}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {severityLabel && (
                              <Badge className={severityStyle.color}>
                                {severityLabel}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <RiskRegisterStatusDropdown
                              entryId={entry.id}
                              currentStatus={entry.status}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{entry.owner?.name ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{businessUnitName ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            {entry.slaDueDate ? (
                              <span className="text-sm">
                                {new Date(entry.slaDueDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className={cn("text-sm font-medium", slaStyle.color)}>
                              {slaStyle.label}
                              {entry.slaStatus === "on_track" && entry.daysRemaining !== null && (
                                <span className="block text-xs text-muted-foreground">
                                  {entry.daysRemaining} days left
                                </span>
                              )}
                              {entry.slaStatus === "at_risk" && entry.daysRemaining !== null && (
                                <span className="block text-xs">
                                  {entry.daysRemaining} days left
                                </span>
                              )}
                              {entry.slaStatus === "breached" && entry.daysOverdue !== null && (
                                <span className="block text-xs">
                                  {entry.daysOverdue} days overdue
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Load More */}
              {hasNextPage && (
                <div className="flex justify-center py-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
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
