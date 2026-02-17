"use client";

/**
 * BIA Dashboard Client Component
 *
 * Epic 13: BIA Reporting & Compliance
 * Stories 13.1-13.9: Dashboard, Filtering, Metrics, Reports, Exports
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  BarChart3,
  Layers,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Building2,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";

interface DashboardFilters {
  businessFunctionId?: string;
  tierId?: string;
  vendorId?: string;
}

export function BIADashboardClient() {
  const [filters, setFilters] = useState<DashboardFilters>({});

  // Fetch filter options
  const { data: filterOptions } = api.biaDashboard.getFilterOptions.useQuery();

  // Fetch dashboard data with filters
  const { data: summaryStats, isLoading: loadingStats } =
    api.biaDashboard.getSummaryStats.useQuery(filters);

  const { data: tierDistribution, isLoading: loadingTiers } =
    api.biaDashboard.getTierDistribution.useQuery(filters);

  const { data: freshnessStats, isLoading: loadingFreshness } =
    api.biaDashboard.getFreshnessStats.useQuery(filters);

  // Export mutation
  const exportCsv = api.biaDashboard.exportCsv.useMutation({
    onSuccess: (data) => {
      // Create blob and download
      const blob = new Blob([data.content], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });

  const clearFilters = () => {
    setFilters({});
  };

  const hasFilters =
    filters.businessFunctionId || filters.tierId || filters.vendorId;

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Business Function Filter */}
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <Select
                value={filters.businessFunctionId ?? "all"}
                onValueChange={(value) =>
                  setFilters((f) => ({
                    ...f,
                    businessFunctionId: value === "all" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Business Functions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Business Functions</SelectItem>
                  {filterOptions?.businessFunctions.map((fn) => (
                    <SelectItem key={fn.id} value={fn.id}>
                      {fn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tier Filter */}
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <Select
                value={filters.tierId ?? "all"}
                onValueChange={(value) =>
                  setFilters((f) => ({
                    ...f,
                    tierId: value === "all" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {filterOptions?.tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        {tier.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor Filter */}
            <div className="flex-1 min-w-[200px] max-w-[250px]">
              <Select
                value={filters.vendorId ?? "all"}
                onValueChange={(value) =>
                  setFilters((f) => ({
                    ...f,
                    vendorId: value === "all" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {filterOptions?.vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}

            {/* Export Buttons */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCsv.mutate(filters)}
                disabled={exportCsv.isPending}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" disabled>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Business Processes
                </p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">
                    {summaryStats?.totalProcesses ?? 0}
                  </p>
                )}
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Business Functions
                </p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">
                    {summaryStats?.totalFunctions ?? 0}
                  </p>
                )}
              </div>
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Assessment Coverage
                </p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">
                    {summaryStats?.assessmentRate ?? 0}%
                  </p>
                )}
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Pending Assessments
                </p>
                {loadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">
                    {(summaryStats?.pendingAssessments ?? 0) +
                      (summaryStats?.neverAssessed ?? 0)}
                  </p>
                )}
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tier Distribution
            </CardTitle>
            <CardDescription>
              Business processes by criticality tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTiers ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {tierDistribution?.tiers.map((tier) => {
                  const total =
                    (tierDistribution?.tiers.reduce((s, t) => s + t.count, 0) ??
                      0) + (tierDistribution?.unassigned ?? 0);
                  const percentage =
                    total > 0 ? Math.round((tier.count / total) * 100) : 0;

                  return (
                    <Link
                      key={tier.id}
                      href={`/bia/processes?tierId=${tier.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {tier.name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {tier.count} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: tier.colorHex,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {(tierDistribution?.unassigned ?? 0) > 0 && (
                  <Link href="/bia/processes?unassigned=true" className="block">
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors">
                      <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-300" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            Unassigned
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {tierDistribution?.unassigned}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessment Freshness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Assessment Freshness
            </CardTitle>
            <CardDescription>
              How recently processes have been assessed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFreshness ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Current (&lt; 6 months)</span>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    {freshnessStats?.current ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-yellow-50 dark:bg-yellow-950">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Aging (6-12 months)</span>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                    {freshnessStats?.aging ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-red-50 dark:bg-red-950">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Stale (&gt; 12 months)</span>
                  </div>
                  <Badge variant="outline" className="bg-red-100 text-red-700">
                    {freshnessStats?.stale ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Never Assessed</span>
                  </div>
                  <Badge variant="outline">
                    {freshnessStats?.neverAssessed ?? 0}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link href="/bia/processes">
              <Button>
                <Activity className="h-4 w-4 mr-2" />
                View All Processes
              </Button>
            </Link>
            <Link href="/bia/functions">
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                View Business Functions
              </Button>
            </Link>
            <Link href="/bia/processes/new">
              <Button variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Add Process
              </Button>
            </Link>
            <Link href="/bia/reports/vendor-dependencies">
              <Button variant="outline">
                <Building2 className="h-4 w-4 mr-2" />
                Vendor Dependencies Report
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
