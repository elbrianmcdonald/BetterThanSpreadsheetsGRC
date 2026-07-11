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
  ChevronRight,
  FileWarning,
  ClipboardCheck,
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
import { PageHeader, StatTile } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { VendorRiskTierBadge } from "@/components/vendor";
import { VendorRiskTier } from "@prisma/client";

/**
 * Risk tier colors for charts — muted "report" status tokens
 * (Critical=destructive, High=severity-high, Medium=warning, Low=success).
 */
const TIER_COLORS = {
  CRITICAL: "var(--destructive)",
  HIGH: "var(--severity-high)",
  MEDIUM: "var(--warning)",
  LOW: "var(--success)",
  NOT_CLASSIFIED: "var(--muted-foreground)",
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

  const isLoading = loadingStats || loadingOverdue || loadingUpcoming;

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
        <div className="rounded-md border border-border bg-background p-3 shadow-sm">
          <p className="text-sm font-semibold text-foreground">{data.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
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
      <PageHeader
        eyebrow="THIRD PARTY RISK"
        title="TPRM Dashboard"
        icon={<Building2 />}
        description="Third Party Risk Management overview and review status"
      />

      {/* Summary Statistics - Row 1 — each card is a clickable link to the
          vendors list pre-filtered by the dimension the card counts. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/vendors" className="block">
          <StatTile
            label="TOTAL VENDORS"
            value={isLoading ? "..." : stats?.totalCount || 0}
            sub={`${stats?.activeCount || 0} active`}
            icon={<Building2 />}
            tone="primary"
            accent
          />
        </Link>

        <Link href="/vendors?riskTier=CRITICAL" className="block">
          <StatTile
            label="CRITICAL TIER"
            value={isLoading ? "..." : stats?.tierDistribution?.CRITICAL || 0}
            sub="6-month review cycle"
            icon={<AlertTriangle />}
            tone="critical"
            filled
          />
        </Link>

        <Link href="/vendors?reviewStatus=overdue" className="block">
          <StatTile
            label="OVERDUE REVIEWS"
            value={isLoading ? "..." : stats?.overdueReviewCount || 0}
            sub="View overdue vendors →"
            icon={<Clock />}
            tone="warning"
            filled
          />
        </Link>

        <Link href="/vendors?reviewStatus=due_in_30_days" className="block">
          <StatTile
            label="DUE IN 30 DAYS"
            value={isLoading ? "..." : stats?.upcomingReviewCount || 0}
            sub="View upcoming reviews →"
            icon={<CalendarClock />}
            tone="primary"
          />
        </Link>
      </div>

      {/* Summary Statistics - Row 2: Assessment Coverage & Findings (FR51, FR55).
          Coverage % cards link to /vendors filtered by tier; Open Findings
          links to the findings list. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/vendors" className="block">
          <StatTile
            label="ASSESSMENT COVERAGE"
            value={isLoading ? "..." : `${stats?.assessmentCoverage?.total || 0}%`}
            sub={`${stats?.assessmentCoverage?.vendorsAssessed || 0} of ${stats?.totalCount || 0} vendors assessed`}
            icon={<ClipboardCheck />}
            tone="success"
          />
        </Link>

        <Link href="/vendors?riskTier=CRITICAL" className="block">
          <StatTile
            label="CRITICAL COVERAGE"
            value={isLoading ? "..." : `${stats?.assessmentCoverage?.byTier?.CRITICAL?.percentage || 0}%`}
            sub={`${stats?.assessmentCoverage?.byTier?.CRITICAL?.assessed || 0} of ${stats?.assessmentCoverage?.byTier?.CRITICAL?.total || 0} assessed`}
            icon={<AlertTriangle />}
          />
        </Link>

        <Link href="/vendors?riskTier=HIGH" className="block">
          <StatTile
            label="HIGH COVERAGE"
            value={isLoading ? "..." : `${stats?.assessmentCoverage?.byTier?.HIGH?.percentage || 0}%`}
            sub={`${stats?.assessmentCoverage?.byTier?.HIGH?.assessed || 0} of ${stats?.assessmentCoverage?.byTier?.HIGH?.total || 0} assessed`}
            icon={<ShieldAlert />}
          />
        </Link>

        <Link href="/findings?source=PENTEST,SCANNER" className="block">
          <StatTile
            label="OPEN FINDINGS"
            value={isLoading ? "..." : stats?.openFindingsCount || 0}
            sub="View vendor findings →"
            icon={<FileWarning />}
            tone="warning"
            filled
          />
        </Link>
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
                    fill="var(--chart-1)"
                    dataKey="value"
                    onClick={(data) => handleChartClick(data.tier)}
                    style={{ cursor: "pointer" }}
                  >
                    {tierChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]}
                        stroke="var(--background)"
                        strokeWidth={1}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--border)"
                    tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--border)"
                    tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)" }}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
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
        <Card className={overdueReviews.length > 0 ? "border-destructive/30" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-[17px] w-[17px] text-destructive" />
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
                <ShieldCheck className="h-12 w-12 text-success mb-2" />
                <p className="text-muted-foreground">No overdue reviews</p>
                <p className="text-xs text-muted-foreground">All vendors are up to date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overdueReviews.slice(0, 5).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3"
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
                        <p className="font-mono text-xs text-muted-foreground">
                          {vendor.identifier}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-destructive">
                        {vendor.nextReviewDate && formatDistanceToNow(new Date(vendor.nextReviewDate), { addSuffix: true })}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
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
                  <CalendarClock className="h-[17px] w-[17px] text-primary" />
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
                        <p className="font-mono text-xs text-muted-foreground">
                          {vendor.identifier}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        {vendor.nextReviewDate && formatDistanceToNow(new Date(vendor.nextReviewDate), { addSuffix: true })}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
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
    </div>
  );
}
