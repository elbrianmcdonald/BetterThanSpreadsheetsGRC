"use client";

/**
 * TPRM Dashboard Client Component
 *
 * Epic 2: Vendor Risk Tiering
 * Story 2.3: Risk Tier Dashboard (FR13)
 * Story 2.4: Review Alerts and Notifications (FR14, FR15)
 *
 * Features:
 * - Risk tier distribution chart
 * - Summary statistics cards
 * - Upcoming reviews table
 * - Overdue reviews alerts
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isBefore, addDays } from "date-fns";
import {
  Building2,
  AlertTriangle,
  ShieldAlert,
  Shield,
  ShieldCheck,
  CalendarClock,
  Clock,
  ArrowRight,
  ChevronRight,
  FileWarning,
  ClipboardCheck,
  GitCompare,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { api } from "@/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VendorRiskTierBadge, VendorStatusBadge } from "@/components/vendor";
import { VendorRiskTier, VendorStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

/**
 * Risk tier colors for charts
 */
const TIER_COLORS = {
  CRITICAL: "#dc2626", // red-600
  HIGH: "#ea580c", // orange-600
  MEDIUM: "#ca8a04", // yellow-600
  LOW: "#16a34a", // green-600
  NOT_CLASSIFIED: "#6b7280", // gray-500
};

/**
 * Risk tier labels
 */
const TIER_LABELS = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NOT_CLASSIFIED: "Not Classified",
};

export function TPRMDashboardClient() {
  const router = useRouter();

  // Vendor comparison state (FR52)
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Fetch vendor stats
  const { data: stats, isLoading: loadingStats } = api.vendor.getStats.useQuery();

  // Fetch overdue reviews
  const { data: overdueData, isLoading: loadingOverdue } = api.vendor.getReviewAlerts.useQuery({
    type: "overdue",
    limit: 10,
  });

  // Fetch upcoming reviews
  const { data: upcomingData, isLoading: loadingUpcoming } = api.vendor.getReviewAlerts.useQuery({
    type: "upcoming",
    limit: 10,
  });

  // Fetch all vendors for comparison selector (FR52)
  const { data: vendorListData } = api.vendor.list.useQuery({
    page: 1,
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
  });

  // Fetch comparison data when vendors are selected (FR52)
  const { data: comparisonData, isLoading: loadingComparison } = api.vendor.compareVendors.useQuery(
    { vendorIds: selectedVendorIds },
    { enabled: selectedVendorIds.length >= 2 && showComparison }
  );

  const isLoading = loadingStats || loadingOverdue || loadingUpcoming;

  // Comparison handlers
  const handleAddVendorToCompare = (vendorId: string) => {
    if (selectedVendorIds.length < 5 && !selectedVendorIds.includes(vendorId)) {
      setSelectedVendorIds([...selectedVendorIds, vendorId]);
    }
  };

  const handleRemoveVendorFromCompare = (vendorId: string) => {
    setSelectedVendorIds(selectedVendorIds.filter((id) => id !== vendorId));
  };

  const handleStartComparison = () => {
    if (selectedVendorIds.length >= 2) {
      setShowComparison(true);
      setCompareDialogOpen(false);
    }
  };

  const handleClearComparison = () => {
    setSelectedVendorIds([]);
    setShowComparison(false);
  };

  // Prepare chart data for tier distribution
  const tierChartData = stats?.tierDistribution
    ? [
        { name: "Critical", value: stats.tierDistribution.CRITICAL || 0, tier: "CRITICAL" },
        { name: "High", value: stats.tierDistribution.HIGH || 0, tier: "HIGH" },
        { name: "Medium", value: stats.tierDistribution.MEDIUM || 0, tier: "MEDIUM" },
        { name: "Low", value: stats.tierDistribution.LOW || 0, tier: "LOW" },
        { name: "Not Classified", value: stats.tierDistribution.NOT_CLASSIFIED || 0, tier: "NOT_CLASSIFIED" },
      ].filter((d) => d.value > 0)
    : [];

  // Handle chart segment click - navigate to filtered vendor list
  const handleChartClick = (tier: string) => {
    if (tier === "NOT_CLASSIFIED") {
      router.push("/vendors?riskTier=none");
    } else {
      router.push(`/vendors?riskTier=${tier}`);
    }
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; tier: string } }> }) => {
    if (active && payload && payload.length > 0) {
      const entry = payload[0];
      if (!entry) return null;
      const data = entry.payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} vendor{data.value !== 1 ? "s" : ""}
          </p>
        </div>
      );
    }
    return null;
  };

  // Upcoming reviews - next 30 days
  const upcomingReviews = upcomingData || [];

  // Overdue reviews
  const overdueReviews = overdueData || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">TPRM Dashboard</h1>
          <p className="text-muted-foreground">
            Third Party Risk Management overview and review status
          </p>
        </div>
      </div>

      {/* Summary Statistics - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeCount || 0} active
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Critical Tier</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {isLoading ? "..." : stats?.tierDistribution?.CRITICAL || 0}
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              6-month review cycle
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Overdue Reviews</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {isLoading ? "..." : stats?.overdueReviewCount || 0}
            </div>
            <Link
              href="/vendors?reviewStatus=overdue"
              className="text-xs text-orange-600/80 hover:text-orange-700 hover:underline dark:text-orange-400/80"
            >
              View overdue vendors
            </Link>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Due in 30 Days</CardTitle>
            <CalendarClock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {isLoading ? "..." : stats?.upcomingReviewCount || 0}
            </div>
            <Link
              href="/vendors?reviewStatus=due_in_30_days"
              className="text-xs text-blue-600/80 hover:text-blue-700 hover:underline dark:text-blue-400/80"
            >
              View upcoming reviews
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Summary Statistics - Row 2: Assessment Coverage & Findings (FR51, FR55) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Assessment Coverage</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {isLoading ? "..." : `${stats?.assessmentCoverage?.total || 0}%`}
            </div>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">
              {stats?.assessmentCoverage?.vendorsAssessed || 0} of {stats?.totalCount || 0} vendors assessed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Coverage</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `${stats?.assessmentCoverage?.byTier?.CRITICAL?.percentage || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.assessmentCoverage?.byTier?.CRITICAL?.assessed || 0} of {stats?.assessmentCoverage?.byTier?.CRITICAL?.total || 0} assessed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Coverage</CardTitle>
            <ShieldAlert className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `${stats?.assessmentCoverage?.byTier?.HIGH?.percentage || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.assessmentCoverage?.byTier?.HIGH?.assessed || 0} of {stats?.assessmentCoverage?.byTier?.HIGH?.total || 0} assessed
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Open Findings</CardTitle>
            <FileWarning className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {isLoading ? "..." : stats?.openFindingsCount || 0}
            </div>
            <Link
              href="/findings?vendorId=any"
              className="text-xs text-yellow-600/80 hover:text-yellow-700 hover:underline dark:text-yellow-400/80"
            >
              View vendor findings
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Risk Tier Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Tier Distribution</CardTitle>
            <CardDescription>
              Vendor count by risk classification. Click a segment to view vendors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tierChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tierChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data) => handleChartClick(data.tier)}
                    style={{ cursor: "pointer" }}
                  >
                    {tierChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {isLoading ? "Loading..." : "No vendors with risk tiers assigned"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tier Breakdown Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Count by Tier</CardTitle>
            <CardDescription>
              Bar chart showing vendor distribution across risk tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.tierDistribution ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: "Critical", count: stats.tierDistribution.CRITICAL || 0, fill: TIER_COLORS.CRITICAL },
                    { name: "High", count: stats.tierDistribution.HIGH || 0, fill: TIER_COLORS.HIGH },
                    { name: "Medium", count: stats.tierDistribution.MEDIUM || 0, fill: TIER_COLORS.MEDIUM },
                    { name: "Low", count: stats.tierDistribution.LOW || 0, fill: TIER_COLORS.LOW },
                    { name: "Not Set", count: stats.tierDistribution.NOT_CLASSIFIED || 0, fill: TIER_COLORS.NOT_CLASSIFIED },
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {[
                      { fill: TIER_COLORS.CRITICAL },
                      { fill: TIER_COLORS.HIGH },
                      { fill: TIER_COLORS.MEDIUM },
                      { fill: TIER_COLORS.LOW },
                      { fill: TIER_COLORS.NOT_CLASSIFIED },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {isLoading ? "Loading..." : "No data available"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Alerts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Reviews */}
        <Card className={overdueReviews.length > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  Overdue Reviews
                </CardTitle>
                <CardDescription>
                  Vendors past their scheduled review date
                </CardDescription>
              </div>
              {overdueReviews.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/vendors?reviewStatus=overdue">
                    View All <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : overdueReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShieldCheck className="h-12 w-12 text-green-500 mb-2" />
                <p className="text-muted-foreground">No overdue reviews</p>
                <p className="text-xs text-muted-foreground">All vendors are up to date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overdueReviews.slice(0, 5).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900 dark:bg-red-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <VendorRiskTierBadge tier={vendor.riskTier as VendorRiskTier} />
                      <div>
                        <Link
                          href={`/vendors/${vendor.id}`}
                          className="font-medium hover:underline"
                        >
                          {vendor.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {vendor.identifier}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {vendor.nextReviewDate && formatDistanceToNow(new Date(vendor.nextReviewDate), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.nextReviewDate && format(new Date(vendor.nextReviewDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Reviews */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-blue-600" />
                  Upcoming Reviews
                </CardTitle>
                <CardDescription>
                  Vendors due for review in the next 30 days
                </CardDescription>
              </div>
              {upcomingReviews.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/vendors?reviewStatus=due_in_30_days">
                    View All <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : upcomingReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarClock className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No upcoming reviews</p>
                <p className="text-xs text-muted-foreground">No reviews scheduled in the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingReviews.slice(0, 5).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <VendorRiskTierBadge tier={vendor.riskTier as VendorRiskTier} />
                      <div>
                        <Link
                          href={`/vendors/${vendor.id}`}
                          className="font-medium hover:underline"
                        >
                          {vendor.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {vendor.identifier}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {vendor.nextReviewDate && formatDistanceToNow(new Date(vendor.nextReviewDate), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.nextReviewDate && format(new Date(vendor.nextReviewDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
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
            <Button asChild>
              <Link href="/vendors/new">
                <Building2 className="mr-2 h-4 w-4" />
                Add New Vendor
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendors">
                <ArrowRight className="mr-2 h-4 w-4" />
                View All Vendors
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vendors?riskTier=CRITICAL">
                <AlertTriangle className="mr-2 h-4 w-4" />
                View Critical Vendors
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Comparison Section (FR52) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Vendor Comparison
              </CardTitle>
              <CardDescription>
                Compare vendors side-by-side on key metrics
              </CardDescription>
            </div>
            <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Select Vendors to Compare
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Select Vendors to Compare</DialogTitle>
                  <DialogDescription>
                    Choose 2-5 vendors to compare. Selected: {selectedVendorIds.length}/5
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Select
                    onValueChange={handleAddVendorToCompare}
                    disabled={selectedVendorIds.length >= 5}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add a vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorListData?.items
                        .filter((v) => !selectedVendorIds.includes(v.id))
                        .map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name} ({vendor.identifier})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedVendorIds.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Selected vendors:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedVendorIds.map((id) => {
                          const vendor = vendorListData?.items.find((v) => v.id === id);
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {vendor?.name || id}
                              <button
                                onClick={() => handleRemoveVendorFromCompare(id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCompareDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStartComparison}
                      disabled={selectedVendorIds.length < 2}
                    >
                      Compare Vendors
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {showComparison && selectedVendorIds.length >= 2 ? (
            loadingComparison ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading comparison...</span>
              </div>
            ) : comparisonData ? (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleClearComparison}>
                    <X className="mr-1 h-4 w-4" />
                    Clear Comparison
                  </Button>
                </div>

                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">Metric</th>
                        {comparisonData.vendors.map((vendor) => (
                          <th key={vendor.id} className="py-3 px-4 text-center font-medium">
                            <Link href={`/vendors/${vendor.id}`} className="hover:underline">
                              {vendor.name}
                            </Link>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Basic Info */}
                      <tr className="border-b bg-muted/50">
                        <td colSpan={comparisonData.vendors.length + 1} className="py-2 px-4 font-semibold">
                          Basic Information
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Identifier</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.identifier}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Risk Tier</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            <div className="flex justify-center">
                              <VendorRiskTierBadge tier={vendor.riskTier as VendorRiskTier} />
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Status</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            <div className="flex justify-center">
                              <VendorStatusBadge status={vendor.status as VendorStatus} />
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Category</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.category || "-"}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Business Unit</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.businessUnit || "-"}
                          </td>
                        ))}
                      </tr>

                      {/* Assessment Metrics */}
                      <tr className="border-b bg-muted/50">
                        <td colSpan={comparisonData.vendors.length + 1} className="py-2 px-4 font-semibold">
                          Assessment Metrics
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Total Assessments</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.metrics.assessments.total}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Completed Assessments</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.metrics.assessments.completed}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Assessment Completion</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium">
                                {vendor.metrics.assessments.completionRate}%
                              </span>
                              <Progress
                                value={vendor.metrics.assessments.completionRate}
                                className="h-2 w-20"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Questionnaire Completion</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium">
                                {vendor.metrics.questionnaires.completionRate}%
                              </span>
                              <Progress
                                value={vendor.metrics.questionnaires.completionRate}
                                className="h-2 w-20"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Findings Metrics */}
                      <tr className="border-b bg-muted/50">
                        <td colSpan={comparisonData.vendors.length + 1} className="py-2 px-4 font-semibold">
                          Findings Metrics
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Total Findings</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.metrics.findings.total}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Open Findings</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            <span className={vendor.metrics.findings.open > 0 ? "text-yellow-600 font-medium" : ""}>
                              {vendor.metrics.findings.open}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">High Findings</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            <span className={vendor.metrics.findings.high > 0 ? "text-red-600 font-medium" : ""}>
                              {vendor.metrics.findings.high}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Medium Findings</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            <span className={vendor.metrics.findings.medium > 0 ? "text-orange-600 font-medium" : ""}>
                              {vendor.metrics.findings.medium}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Finding Closure Rate</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium">
                                {vendor.metrics.findings.closureRate}%
                              </span>
                              <Progress
                                value={vendor.metrics.findings.closureRate}
                                className="h-2 w-20"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Dates */}
                      <tr className="border-b bg-muted/50">
                        <td colSpan={comparisonData.vendors.length + 1} className="py-2 px-4 font-semibold">
                          Key Dates
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Next Review</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.nextReviewDate
                              ? format(new Date(vendor.nextReviewDate), "MMM d, yyyy")
                              : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Last Assessment</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {vendor.metrics.assessments.latestDate
                              ? format(new Date(vendor.metrics.assessments.latestDate), "MMM d, yyyy")
                              : "-"}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-muted-foreground">Created</td>
                        {comparisonData.vendors.map((vendor) => (
                          <td key={vendor.id} className="py-2 px-4 text-center">
                            {format(new Date(vendor.createdAt), "MMM d, yyyy")}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitCompare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Select 2-5 vendors to compare their risk metrics, assessment history, and findings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
