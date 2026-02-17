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
const ASSET_MANAGE_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

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

// Status colors
const STATUS_COLORS: Record<AssetStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  INACTIVE: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  DECOMMISSIONED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  UNDER_MAINTENANCE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
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
        <p className="text-red-500">Error loading assets: {error.message}</p>
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
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Assets Found</h3>
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Processes</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/assets/${asset.id}`}
                  >
                    <TableCell className="font-mono text-sm">
                      {asset.identifier}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="hover:underline"
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
                      <Badge className={STATUS_COLORS[asset.status]}>
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
                    <TableCell>
                      <span className="text-sm">
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
                Showing {(page - 1) * 25 + 1} to{" "}
                {Math.min(page * 25, data.total)} of {data.total} assets
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
                <span className="text-sm">
                  Page {page} of {data.totalPages}
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
