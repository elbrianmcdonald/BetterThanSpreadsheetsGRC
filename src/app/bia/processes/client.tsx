"use client";

/**
 * BIA Register — dashboard-style list of all BIA Assessments.
 *
 * Features:
 *  - Summary stat cards (total / by status / by BCP / by anchor / stale)
 *  - Search (anchor identifier, name, overview, system description)
 *  - Filters: anchor type, status, BCP
 *  - Column visibility toggle (persisted to localStorage)
 *  - Clicking the anchor label links to the underlying Asset or
 *    BusinessProcess detail page; "Open BIA" opens the assessment.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  Loader2,
  ExternalLink,
  Search,
  Settings2,
  X,
  Activity,
  ShieldCheck,
  Clock,
  ClipboardList,
} from "lucide-react";
import { ContingencyBIAStatus, HasBCP } from "@prisma/client";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ANY = "__any__";
const COLUMN_STORAGE_KEY = "bia-register-column-visibility";

interface ColumnVisibility {
  anchor: boolean;
  status: boolean;
  bcp: boolean;
  completion: boolean;
  processes: boolean;
  resources: boolean;
  updated: boolean;
}

const DEFAULT_VISIBILITY: ColumnVisibility = {
  anchor: true,
  status: true,
  bcp: true,
  completion: true,
  processes: true,
  resources: true,
  updated: true,
};

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  anchor: "Anchor",
  status: "Status",
  bcp: "BCP?",
  completion: "Completion",
  processes: "Processes",
  resources: "Resources",
  updated: "Updated",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function bcpBadge(v: HasBCP | null | undefined) {
  if (!v) return <span className="text-muted-foreground text-sm">—</span>;
  if (v === HasBCP.YES) return <Badge variant="success">Yes</Badge>;
  if (v === HasBCP.NO) return <Badge variant="critical">No</Badge>;
  return <Badge variant="outline">N/A</Badge>;
}

export function BiaRegisterClient() {
  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContingencyBIAStatus | typeof ANY>(ANY);
  const [anchor, setAnchor] = useState<"ASSET" | "PROCESS" | typeof ANY>(ANY);
  const [bcp, setBcp] = useState<"YES" | "NO" | "NA" | "UNSET" | typeof ANY>(
    ANY
  );

  const hasActiveFilters =
    search.trim().length > 0 || status !== ANY || anchor !== ANY || bcp !== ANY;

  const listQuery = api.biaSystemContingency.list.useQuery({
    search: search.trim() || undefined,
    status: status !== ANY ? (status as ContingencyBIAStatus) : undefined,
    anchor: anchor !== ANY ? (anchor as "ASSET" | "PROCESS") : undefined,
    hasBCP:
      bcp !== ANY ? (bcp as "YES" | "NO" | "NA" | "UNSET") : undefined,
  });

  const statsQuery = api.biaSystemContingency.getRegisterStats.useQuery();

  // Column visibility — hydrate from localStorage on mount, persist on change
  const [visibility, setVisibility] =
    useState<ColumnVisibility>(DEFAULT_VISIBILITY);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
        setVisibility({ ...DEFAULT_VISIBILITY, ...parsed });
      }
    } catch {
      // ignore malformed storage
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLUMN_STORAGE_KEY,
        JSON.stringify(visibility)
      );
    } catch {
      // ignore quota/privacy errors
    }
  }, [visibility]);

  const stats = statsQuery.data;
  const rows = listQuery.data ?? [];

  const resetFilters = () => {
    setSearch("");
    setStatus(ANY);
    setAnchor(ANY);
    setBcp(ANY);
  };

  const visibleColCount = useMemo(
    () => Object.values(visibility).filter(Boolean).length,
    [visibility]
  );

  return (
    <AppLayout
      breadcrumbs={[{ label: "Business Impact" }, { label: "BIA Register" }]}
    >
      <div className="container max-w-7xl mx-auto py-6 space-y-6">
        <PageHeader
          eyebrow="BUSINESS IMPACT"
          title="BIA Register"
          icon={<FileText />}
          description="All Business Impact Analyses across your assets and business processes."
          actions={
            <Button asChild>
              <Link href="/bia/system-contingency/new">
                <Plus className="h-4 w-4 mr-2" />
                New BIA
              </Link>
            </Button>
          }
        />

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Total BIAs"
            value={stats?.total ?? "—"}
            sub={
              stats
                ? `${stats.byStatus.final} finalized · ${stats.byStatus.draft} draft`
                : "Loading…"
            }
            icon={<ClipboardList />}
            accent
          />
          <StatTile
            label="BCP Documented"
            value={stats ? `${stats.byBCP.yes} / ${stats.total}` : "—"}
            sub={
              stats
                ? `${stats.byBCP.no} missing · ${stats.byBCP.unset} not evaluated`
                : "Loading…"
            }
            icon={<ShieldCheck />}
          />
          <StatTile
            label="Anchor mix"
            value={
              stats
                ? `${stats.byAnchor.asset} / ${stats.byAnchor.process}`
                : "—"
            }
            sub="Asset / Process"
            icon={<Activity />}
          />
          <StatTile
            label="Annual review due"
            value={stats?.staleCount ?? "—"}
            sub="Not updated in the last year"
            icon={<Clock />}
            tone={
              stats && stats.staleCount > 0
                ? stats.staleCount > 5
                  ? "critical"
                  : "warning"
                : "default"
            }
          />
        </div>

        {/* Filter + search bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  placeholder="Search by anchor, overview, or description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <Label className="text-[12.5px] font-semibold text-secondary-foreground">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as ContingencyBIAStatus | typeof ANY)
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any</SelectItem>
                    <SelectItem value={ContingencyBIAStatus.DRAFT}>
                      Draft
                    </SelectItem>
                    <SelectItem value={ContingencyBIAStatus.FINAL}>
                      Final
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[12.5px] font-semibold text-secondary-foreground">Anchor</Label>
                <Select
                  value={anchor}
                  onValueChange={(v) =>
                    setAnchor(v as "ASSET" | "PROCESS" | typeof ANY)
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any</SelectItem>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="PROCESS">Process</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[12.5px] font-semibold text-secondary-foreground">BCP</Label>
                <Select
                  value={bcp}
                  onValueChange={(v) =>
                    setBcp(v as "YES" | "NO" | "NA" | "UNSET" | typeof ANY)
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any</SelectItem>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                    <SelectItem value="NA">N/A</SelectItem>
                    <SelectItem value="UNSET">Not evaluated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}

              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="h-4 w-4 mr-2" />
                      Columns ({visibleColCount})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.keys(DEFAULT_VISIBILITY) as (keyof ColumnVisibility)[]).map(
                      (key) => (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={visibility[key]}
                          onCheckedChange={(checked) =>
                            setVisibility((v) => ({
                              ...v,
                              [key]: Boolean(checked),
                            }))
                          }
                          // Anchor stays always on — it's the primary id
                          disabled={key === "anchor"}
                        >
                          {COLUMN_LABELS[key]}
                        </DropdownMenuCheckboxItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Results{" "}
              <span className="text-muted-foreground text-sm font-normal">
                ({rows.length})
              </span>
            </CardTitle>
            <CardDescription>
              Click the anchor link to jump to the underlying record, or Open
              BIA to edit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "No BIAs match your filters."
                    : "No BIAs yet. Create one to begin documenting recovery priorities."}
                </p>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/bia/system-contingency/new">
                      <Plus className="h-4 w-4 mr-2" />
                      New BIA
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibility.anchor && (
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Anchor
                      </TableHead>
                    )}
                    {visibility.status && (
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Status
                      </TableHead>
                    )}
                    {visibility.bcp && (
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        BCP?
                      </TableHead>
                    )}
                    {visibility.completion && (
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Completion
                      </TableHead>
                    )}
                    {visibility.processes && (
                      <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Processes
                      </TableHead>
                    )}
                    {visibility.resources && (
                      <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Resources
                      </TableHead>
                    )}
                    {visibility.updated && (
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        Updated
                      </TableHead>
                    )}
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((bia) => {
                    const anchorType = bia.asset
                      ? "Asset"
                      : bia.businessProcess
                        ? "Process"
                        : "—";
                    const anchorHref = bia.asset
                      ? `/assets/${bia.asset.id}`
                      : bia.businessProcess
                        ? `/bia/processes/${bia.businessProcess.id}`
                        : null;
                    const anchorLabel = bia.asset
                      ? `${bia.asset.identifier} · ${bia.asset.name}`
                      : bia.businessProcess
                        ? `${bia.businessProcess.identifier} · ${bia.businessProcess.name}`
                        : "—";

                    return (
                      <TableRow key={bia.id} className="hover:bg-secondary">
                        {visibility.anchor && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="code">{anchorType}</Badge>
                              {anchorHref ? (
                                <Link
                                  href={anchorHref}
                                  className="text-sm font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                                  title={`Open ${anchorType.toLowerCase()} detail`}
                                >
                                  {anchorLabel}
                                  <ExternalLink className="h-3 w-3 text-muted-foreground/70" />
                                </Link>
                              ) : (
                                <span className="text-sm font-semibold text-foreground">
                                  {anchorLabel}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {visibility.status && (
                          <TableCell>
                            <Badge
                              variant={
                                bia.status === ContingencyBIAStatus.FINAL
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              {bia.status}
                            </Badge>
                          </TableCell>
                        )}
                        {visibility.bcp && (
                          <TableCell>{bcpBadge(bia.hasBCP)}</TableCell>
                        )}
                        {visibility.completion && (
                          <TableCell className="font-mono text-[13px] text-muted-foreground">
                            {formatDate(bia.completionDate)}
                          </TableCell>
                        )}
                        {visibility.processes && (
                          <TableCell className="text-right tnum text-sm">
                            {bia._count.processes}
                          </TableCell>
                        )}
                        {visibility.resources && (
                          <TableCell className="text-right tnum text-sm">
                            {bia._count.resources}
                          </TableCell>
                        )}
                        {visibility.updated && (
                          <TableCell className="font-mono text-[13px] text-muted-foreground">
                            {formatDate(bia.updatedAt)}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/bia/system-contingency/${bia.id}`}>
                              Open BIA
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
