"use client";

/**
 * Asset List Client Component
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.2: Asset List Page with Filtering
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { useSession } from "next-auth/react";
import { UserRole, AssetType, AssetStatus } from "@prisma/client";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WRITE_ROLES } from "@/lib/auth/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Server,
  Database,
  AppWindow,
  Network,
  HardDrive,
  Monitor,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Role arrays for permission checks
const ASSET_MANAGE_ROLES: UserRole[] = WRITE_ROLES;

// Asset type display config
const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { label: string; icon: React.ReactNode }
> = {
  SERVER: { label: "Server", icon: <Server className="h-4 w-4" /> },
  DATABASE: { label: "Database", icon: <Database className="h-4 w-4" /> },
  APPLICATION: { label: "Application", icon: <AppWindow className="h-4 w-4" /> },
  NETWORK: { label: "Network", icon: <Network className="h-4 w-4" /> },
  STORAGE: { label: "Storage", icon: <HardDrive className="h-4 w-4" /> },
  ENDPOINT: { label: "Endpoint", icon: <Monitor className="h-4 w-4" /> },
};

// Status tones — soft "report" Badge variants (never solid/candy)
const STATUS_VARIANTS: Record<
  AssetStatus,
  "success" | "neutral" | "critical" | "warning"
> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  DECOMMISSIONED: "critical",
  UNDER_MAINTENANCE: "warning",
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DECOMMISSIONED: "Decommissioned",
  UNDER_MAINTENANCE: "Under Maintenance",
};

export function AssetListClient() {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canManage = userRole && ASSET_MANAGE_ROLES.includes(userRole);

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  };

  // Build query input
  const queryInput: any = {
    page,
    pageSize: 25,
    search: debouncedSearch || undefined,
  };

  if (statusFilter !== "all") {
    queryInput.status = [statusFilter as AssetStatus];
  }

  if (typeFilter !== "all") {
    queryInput.type = [typeFilter as AssetType];
  }

  // Fetch data
  const { data, isLoading, error } = api.asset.list.useQuery(queryInput);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading assets: {error.message}</p>
      </div>
    );
  }

  const hasFilters = statusFilter !== "all" || typeFilter !== "all" || debouncedSearch;

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ASSET_TYPE_CONFIG).map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Add Asset Button */}
        {canManage && (
          <Link href="/assets/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </Link>
        )}
      </div>

      {/* Empty State */}
      {!data?.items.length ? (
        <div className="text-center py-12 border border-border rounded-lg bg-secondary">
          <Server className="h-12 w-12 mx-auto text-muted-foreground/70 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Assets Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {hasFilters
              ? "No assets match your filters. Try adjusting your search."
              : "Get started by adding your first IT asset."}
          </p>
          {canManage && !hasFilters && (
            <Link href="/assets/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Identifier
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Tier
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground text-right">
                    Processes
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Owner
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-secondary"
                    onClick={() => window.location.href = `/assets/${asset.id}`}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {asset.identifier}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="hover:text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {ASSET_TYPE_CONFIG[asset.type]?.icon}
                        {ASSET_TYPE_CONFIG[asset.type]?.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[asset.status]}>
                        {STATUS_LABELS[asset.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {asset.calculatedTier ? (
                        <Badge
                          style={{
                            backgroundColor: asset.calculatedTier.colorHex + "20",
                            color: asset.calculatedTier.colorHex,
                            borderColor: asset.calculatedTier.colorHex,
                          }}
                          variant="outline"
                        >
                          {asset.calculatedTier.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {asset._count?.businessProcessLinks || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {asset.owner?.name || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {(page - 1) * 25 + 1}
                </span>{" "}
                to{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {Math.min(page * 25, data.total)}
                </span>{" "}
                of{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {data.total}
                </span>{" "}
                assets
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {page}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {data.totalPages}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
