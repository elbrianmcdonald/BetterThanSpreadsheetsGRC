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
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import { RiskScoreHeatmap, type HeatmapItem } from "@/components/risk/RiskScoreHeatmap";
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
import { ToxicMark } from "@/components/pathway/ToxicMark";

/** Status badge configuration */
const statusConfig: Record<RiskRegisterStatus, { color: string; label: string; icon: typeof AlertTriangle }> = {
  OPEN: { color: "bg-primary/10 text-primary", label: "Open", icon: AlertCircle },
  IN_TREATMENT: { color: "bg-warning/10 text-warning", label: "In Treatment", icon: Clock },
  ACCEPTED: { color: "bg-muted text-secondary-foreground", label: "Accepted", icon: CheckCircle },
  MITIGATED: { color: "bg-success/10 text-success", label: "Mitigated", icon: ShieldCheck },
  TRANSFERRED: { color: "bg-primary/10 text-primary", label: "Transferred", icon: ArrowRightLeft },
  CLOSED: { color: "bg-muted text-secondary-foreground", label: "Closed", icon: XCircle },
};

/** Severity badge configuration */
const severityConfig: Record<string, { color: string }> = {
  Critical: { color: "bg-destructive/10 text-destructive" },
  High: { color: "bg-severity-high/10 text-severity-high" },
  Medium: { color: "bg-warning/10 text-warning" },
  Low: { color: "bg-success/10 text-success" },
  Info: { color: "bg-primary/10 text-primary" },
};

/** SLA status configuration (AC19) */
const slaStatusConfig = {
  on_track: { color: "text-success", bgColor: "bg-success/10", label: "On Track" },
  at_risk: { color: "text-warning", bgColor: "bg-warning/10", label: "At Risk" },
  breached: { color: "text-destructive", bgColor: "bg-destructive/10", label: "Breached" },
  no_sla: { color: "text-muted-foreground/70", bgColor: "bg-muted", label: "No SLA" },
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

  // Matrix-adaptive risk heatmap (parity with the Findings list; same wiring as the dashboard).
  const { data: heatmapData } = api.risk.heatmap.useQuery();
  const heatmapRows: HeatmapItem[] = (heatmapData?.rows ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    title: r.title,
    likelihood: r.likelihood,
    impact: r.impact,
    score: r.score,
    scoreLabel: r.scoreLabel,
    color: r.color,
    href: r.href,
  }));

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
        <PageHeader
          eyebrow="RISK"
          title="Risk Register"
          icon={<ClipboardList />}
          description="Unified view of all organizational risks from assessments"
        />

      {/* Stats Cards (AC9, AC10) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([])}>
          <StatTile
            label="Total"
            value={statusCounts?.total ?? 0}
            tone="primary"
            accent
          />
        </button>

        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([RiskRegisterStatus.OPEN])}>
          <StatTile
            label="Open"
            value={statusCounts?.OPEN ?? 0}
            tone="primary"
          />
        </button>

        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([RiskRegisterStatus.IN_TREATMENT])}>
          <StatTile
            label="In Treatment"
            value={statusCounts?.IN_TREATMENT ?? 0}
            tone="warning"
          />
        </button>

        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([RiskRegisterStatus.ACCEPTED])}>
          <StatTile
            label="Accepted"
            value={statusCounts?.ACCEPTED ?? 0}
            tone="default"
          />
        </button>

        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([RiskRegisterStatus.MITIGATED])}>
          <StatTile
            label="Mitigated"
            value={statusCounts?.MITIGATED ?? 0}
            tone="success"
          />
        </button>

        <button type="button" className="block w-full text-left" onClick={() => setSelectedStatuses([RiskRegisterStatus.CLOSED])}>
          <StatTile
            label="Closed"
            value={statusCounts?.CLOSED ?? 0}
            tone="default"
          />
        </button>

        <StatTile
          label="Overdue"
          value={statusCounts?.overdue ?? 0}
          tone="critical"
          filled={(statusCounts?.overdue ?? 0) > 0}
        />
      </div>

      {/* Risk Heatmap (parity with the Findings list) */}
      {heatmapData?.matrix && (
        <RiskScoreHeatmap
          matrix={{
            scales: heatmapData.matrix.scales,
            thresholds: heatmapData.matrix.thresholds,
            outputScaleMax: heatmapData.matrix.outputScaleMax,
          }}
          rows={heatmapRows}
          title="Risk Heatmap"
          subtitle={`All risks plotted on ${heatmapData.matrix.templateName}`}
          emptyLabel="No scored risks yet."
        />
      )}

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
              <AlertTriangle className="h-12 w-12 text-destructive/70 mx-auto mb-4" />
              <p className="text-destructive">{error.message}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No risk register entries found</h3>
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
                      <TableHead className="w-[120px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">ID</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Risk Title</TableHead>
                      <TableHead className="w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
                          onClick={() => toggleSort("severity")}
                        >
                          Severity
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[130px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Status</TableHead>
                      <TableHead className="w-[150px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Owner</TableHead>
                      <TableHead className="w-[150px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Business Unit</TableHead>
                      <TableHead className="w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
                          onClick={() => toggleSort("dueDate")}
                        >
                          Due Date
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px] font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">SLA Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      // Resolve display fields from whichever side of the entry is set
                      const severityLabel =
                        entry.assessment?.inherentScoreLabel ?? entry.risk?.severity ?? null;
                      const severityStyle =
                        (severityLabel ? severityConfig[severityLabel] : null) ?? {
                          color: "bg-muted text-secondary-foreground",
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
                      // Epic 19: toxic if either side of the entry is on an exploitation pathway
                      const isToxic =
                        entry.risk?.isToxic === true ||
                        entry.assessment?.finding?.isToxic === true;

                      return (
                        <TableRow
                          key={entry.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (targetRiskId) router.push(`/risks/${targetRiskId}`);
                          }}
                        >
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {entry.identifier}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                                {titleText}
                                {isToxic ? <ToxicMark size={12} /> : null}
                              </p>
                              {subIdentifier && (
                                <p className="font-mono text-xs text-muted-foreground/70">
                                  {subIdentifier}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {severityLabel && (
                              <Badge variant="neutral" className={severityStyle.color}>
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
                              <span className="font-mono text-sm text-muted-foreground">
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
