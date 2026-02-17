"use client";

/**
 * Remediation Velocity Report Client Component
 *
 * Story 5.8: Remediation Velocity Metrics (Average Days-to-Close)
 *
 * @see Story 5.8: Remediation Velocity Metrics
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout";
import Link from "next/link";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Download,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  User,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VelocityTrendChart, type VelocityTrendPoint } from "@/components/compliance/VelocityTrendChart";
import { format } from "date-fns";
import { toast } from "sonner";

// Velocity benchmarks
const VELOCITY_BENCHMARKS = {
  HIGH: 14,
  MEDIUM: 30,
  LOW: 60,
};

type Severity = "HIGH" | "MEDIUM" | "LOW";
type SortBy = "daysToClose" | "closedAt" | "severity";
type SortOrder = "asc" | "desc";

/**
 * Severity badge component
 */
function SeverityBadge({ severity }: { severity: Severity }) {
  const variants = {
    HIGH: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
    LOW: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  };

  const icons = {
    HIGH: AlertCircle,
    MEDIUM: AlertTriangle,
    LOW: Info,
  };

  const Icon = icons[severity];

  return (
    <Badge variant="secondary" className={cn("gap-1", variants[severity])}>
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}

/**
 * Trend indicator component
 */
function TrendIndicator({
  direction,
  change,
}: {
  direction: "improving" | "stable" | "degrading";
  change: number;
}) {
  const absChange = Math.abs(change);

  if (direction === "improving") {
    return (
      <div className="flex items-center gap-1 text-sm font-medium text-green-600">
        <TrendingDown className="h-4 w-4" />
        <span>-{absChange.toFixed(1)}d faster</span>
      </div>
    );
  }

  if (direction === "degrading") {
    return (
      <div className="flex items-center gap-1 text-sm font-medium text-red-600">
        <TrendingUp className="h-4 w-4" />
        <span>+{absChange.toFixed(1)}d slower</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
      <Minus className="h-4 w-4" />
      <span>Stable</span>
    </div>
  );
}

/**
 * Benchmark status indicator
 */
function BenchmarkStatus({
  velocity,
  benchmark,
}: {
  velocity: number;
  benchmark: number;
}) {
  const meetsBenchmark = velocity <= benchmark;

  return (
    <div className="flex items-center gap-1">
      {meetsBenchmark ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={cn("text-xs", meetsBenchmark ? "text-green-600" : "text-red-600")}>
        {meetsBenchmark ? "On target" : `${(velocity - benchmark).toFixed(1)}d over`}
      </span>
    </div>
  );
}

/**
 * Metric card component for summary statistics
 */
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  benchmark,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  trend?: {
    direction: "improving" | "stable" | "degrading";
    change: number;
  };
  benchmark?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            {value > 0 ? value.toFixed(1) : "—"}
          </span>
          <span className="text-sm text-muted-foreground">days</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        {trend && (
          <div className="mt-2">
            <TrendIndicator direction={trend.direction} change={trend.change} />
          </div>
        )}
        {benchmark !== undefined && value > 0 && (
          <div className="mt-2">
            <BenchmarkStatus velocity={value} benchmark={benchmark} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VelocityReportClient() {
  const [timeframe, setTimeframe] = useState<number>(90);
  const [sortBy, setSortBy] = useState<SortBy>("daysToClose");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch velocity data
  const { data: velocityData, isLoading: velocityLoading } =
    api.compliance.getRemediationVelocity.useQuery({ timeframeDays: timeframe });

  // Fetch detailed report data
  const { data: reportData, isLoading: reportLoading } =
    api.compliance.getVelocityReport.useQuery({
      timeframeDays: timeframe,
      sortBy,
      sortOrder,
    });

  // CSV export mutation
  const exportMutation = api.compliance.exportVelocityReport.useMutation({
    onSuccess: (data) => {
      // Create and download CSV
      const blob = new Blob([data.data], { type: data.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported: ${data.filename}`);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const handleExport = () => {
    exportMutation.mutate({ timeframeDays: timeframe });
  };

  const toggleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const isLoading = velocityLoading || reportLoading;

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Velocity Metrics" }]}>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Remediation Velocity Report</h1>
            <p className="text-muted-foreground">
              Average days-to-close analysis for risk remediation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe selector */}
          <Select
            value={String(timeframe)}
            onValueChange={(v) => setTimeframe(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          {/* AC21: CSV export button */}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exportMutation.isPending || isLoading}
          >
            <Download className="h-4 w-4 mr-1" />
            {exportMutation.isPending ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* AC18: Summary metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Overall Average"
              value={velocityData?.overall ?? 0}
              subtitle={`${velocityData?.closedRisksCount ?? 0} risks closed`}
              icon={Clock}
              trend={
                velocityData?.comparison
                  ? {
                      direction: velocityData.comparison.direction,
                      change: velocityData.comparison.change,
                    }
                  : undefined
              }
            />
            <MetricCard
              title="High Severity"
              value={velocityData?.bySeverity.HIGH ?? 0}
              subtitle={`${velocityData?.bySeverity.highCount ?? 0} risks closed`}
              icon={AlertCircle}
              benchmark={VELOCITY_BENCHMARKS.HIGH}
            />
            <MetricCard
              title="Medium Severity"
              value={velocityData?.bySeverity.MEDIUM ?? 0}
              subtitle={`${velocityData?.bySeverity.mediumCount ?? 0} risks closed`}
              icon={AlertTriangle}
              benchmark={VELOCITY_BENCHMARKS.MEDIUM}
            />
            <MetricCard
              title="Low Severity"
              value={velocityData?.bySeverity.LOW ?? 0}
              subtitle={`${velocityData?.bySeverity.lowCount ?? 0} risks closed`}
              icon={Info}
              benchmark={VELOCITY_BENCHMARKS.LOW}
            />
          </div>

          {/* AC12-AC16: Velocity trend chart */}
          <VelocityTrendChart
            data={(velocityData?.trend ?? []) as VelocityTrendPoint[]}
            showBenchmarks={true}
          />

          {/* AC18: Breakdown by IT Owner (Top 5) */}
          {reportData?.averageByItOwner && reportData.averageByItOwner.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">By IT Owner (Top 5)</CardTitle>
                </div>
                <CardDescription>
                  Average days-to-close by risk owner
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.averageByItOwner.slice(0, 5).map((owner, index) => (
                    <div
                      key={owner.ownerId || index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{owner.ownerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {owner.count} risks closed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{owner.average.toFixed(1)}d</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AC18: Breakdown by Finding Source */}
          {reportData?.averageByFindingSource && reportData.averageByFindingSource.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">By Finding Source</CardTitle>
                </div>
                <CardDescription>
                  Average days-to-close by how the risk was discovered
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {reportData.averageByFindingSource.map((source) => (
                    <div
                      key={source.source}
                      className="p-3 bg-muted/50 rounded-lg text-center"
                    >
                      <p className="text-sm text-muted-foreground">
                        {source.source.replace(/_/g, " ")}
                      </p>
                      <p className="text-2xl font-bold">{source.average.toFixed(1)}d</p>
                      <p className="text-xs text-muted-foreground">
                        {source.count} risks
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AC18: Slowest risks (Bottom 10 by days-to-close) */}
          {reportData?.slowestRisks && reportData.slowestRisks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Slowest Remediation</CardTitle>
                <CardDescription>
                  Top 10 risks with longest time to resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Days to Close</TableHead>
                      <TableHead>Closed Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.slowestRisks.map((risk) => (
                      <TableRow key={risk.id}>
                        <TableCell>
                          <Link
                            href={`/risks/${risk.id}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {risk.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={risk.severity as Severity} />
                        </TableCell>
                        <TableCell className="font-mono">
                          {risk.daysToClose}d
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(risk.closedAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* AC19, AC20: All closed risks table */}
          {reportData?.closedRisks && reportData.closedRisks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Closed Risks</CardTitle>
                <CardDescription>
                  Complete list of closed risks in the selected timeframe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-accent"
                          onClick={() => toggleSort("severity")}
                        >
                          Severity
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-accent"
                          onClick={() => toggleSort("daysToClose")}
                        >
                          Days to Close
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 data-[state=open]:bg-accent"
                          onClick={() => toggleSort("closedAt")}
                        >
                          Closed Date
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.closedRisks.map((risk) => (
                      <TableRow key={risk.id}>
                        <TableCell>
                          <Link
                            href={`/risks/${risk.id}`}
                            className="font-medium hover:underline text-primary"
                          >
                            {risk.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={risk.severity as Severity} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {risk.itOwnerName || "Unassigned"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {risk.daysToClose}d
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(risk.closedAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {(!reportData?.closedRisks || reportData.closedRisks.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Closed Risks</h3>
                <p className="text-muted-foreground">
                  No risks have been closed in the last {timeframe} days.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      </div>
    </AppLayout>
  );
}
