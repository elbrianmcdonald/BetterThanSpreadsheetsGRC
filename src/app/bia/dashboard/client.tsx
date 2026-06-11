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
import { StatTile } from "@/components/layout";
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
          <CardTitle className="eyebrow">Filters</CardTitle>
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

      {/* Summary Stats — each card links to the relevant filtered list. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/bia/processes" className="block w-full text-left">
          <StatTile
            label="Business Processes"
            value={
              loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (summaryStats?.totalProcesses ?? 0)
              )
            }
            icon={<Activity />}
            tone="primary"
            accent
          />
        </Link>

        <Link href="/bia/functions" className="block w-full text-left">
          <StatTile
            label="Business Functions"
            value={
              loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (summaryStats?.totalFunctions ?? 0)
              )
            }
            icon={<Layers />}
          />
        </Link>

        <Link
          href="/bia/processes?assessment=assessed"
          className="block w-full text-left"
        >
          <StatTile
            label="Assessment Coverage"
            value={
              loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${summaryStats?.assessmentRate ?? 0}%`
              )
            }
            icon={<BarChart3 />}
            tone="success"
          />
        </Link>

        <Link
          href="/bia/processes?assessment=pending"
          className="block w-full text-left"
        >
          <StatTile
            label="Pending Assessments"
            value={
              loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (summaryStats?.pendingAssessments ?? 0) +
                (summaryStats?.neverAssessed ?? 0)
              )
            }
            icon={<AlertTriangle />}
            tone="warning"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
              <BarChart3 className="h-[17px] w-[17px] text-primary" />
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
                      <div className="flex items-center gap-3 p-2 rounded hover:bg-secondary transition-colors">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-foreground">
                              {tier.name}
                            </span>
                            <span className="font-mono text-[12px] text-muted-foreground tnum">
                              {tier.count} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
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
                      <div className="w-4 h-4 rounded-full flex-shrink-0 bg-muted-foreground/30" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-foreground">
                            Unassigned
                          </span>
                          <span className="font-mono text-[12px] text-muted-foreground tnum">
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
            <CardTitle className="flex items-center gap-2 text-[15px] font-bold">
              <Clock className="h-[17px] w-[17px] text-primary" />
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
                <div className="flex items-center justify-between p-3 rounded bg-success/10">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-medium text-foreground">Current (&lt; 6 months)</span>
                  </div>
                  <Badge variant="success" className="tnum">
                    {freshnessStats?.current ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-warning/10">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <span className="font-medium text-foreground">Aging (6-12 months)</span>
                  </div>
                  <Badge variant="warning" className="tnum">
                    {freshnessStats?.aging ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-destructive/10">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-foreground">Stale (&gt; 12 months)</span>
                  </div>
                  <Badge variant="critical" className="tnum">
                    {freshnessStats?.stale ?? 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-secondary">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground/70" />
                    <span className="font-medium text-foreground">Never Assessed</span>
                  </div>
                  <Badge variant="neutral" className="tnum">
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
          <CardTitle className="text-[15px] font-bold">Quick Actions</CardTitle>
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
