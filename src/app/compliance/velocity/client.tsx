"use client";

/**
 * Remediation Velocity Report Client Component
 *
 * Story 5.8: Remediation Velocity Metrics (Average Days-to-Close)
 *
 * @see Story 5.8: Remediation Velocity Metrics
 */

import { useState } from "react";
import { AppLayout, PageHeader, StatTile } from "@/components/layout";
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
  Gauge,
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
    HIGH: "high",
    MEDIUM: "warning",
    LOW: "info",
  } as const;

  const icons = {
    HIGH: AlertCircle,
    MEDIUM: AlertTriangle,
    LOW: Info,
  };

  const Icon = icons[severity];

  return (
    <Badge variant={variants[severity]} className="gap-1">
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
      <div className="flex items-center gap-1 text-sm font-medium text-success">
        <TrendingDown className="h-4 w-4" />
        <span className="tnum">-{absChange.toFixed(1)}d faster</span>
      </div>
    );
  }

  if (direction === "degrading") {
    return (
      <div className="flex items-center gap-1 text-sm font-medium text-destructive">
        <TrendingUp className="h-4 w-4" />
        <span className="tnum">+{absChange.toFixed(1)}d slower</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
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
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={cn("text-xs", meetsBenchmark ? "text-success" : "text-destructive")}>
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
  accent,
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
  accent?: boolean;
}) {
  const hasFooter =
    Boolean(trend) || (benchmark !== undefined && value > 0);

  return (
    <StatTile
      label={title}
      accent={accent}
      icon={<Icon />}
      value={
        <span className="flex items-baseline gap-1.5">
          <span>{value > 0 ? value.toFixed(1) : "—"}</span>
          <span className="text-[13px] font-medium text-muted-foreground">
            days
          </span>
        </span>
      }
      sub={subtitle}
      footer={
        hasFooter ? (
          <>
            {trend && (
              <TrendIndicator direction={trend.direction} change={trend.change} />
            )}
            {benchmark !== undefined && value > 0 && (
              <div className={cn(trend && "mt-2")}>
                <BenchmarkStatus velocity={value} benchmark={benchmark} />
              </div>
            )}
          </>
        ) : undefined
      }
    />
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
      <PageHeader
        eyebrow="VELOCITY METRICS"
        title="Remediation Velocity Report"
        icon={<Gauge />}
        description="Average days-to-close analysis for risk remediation"
        actions={
          <>
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
          </>
        }
      />

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
              accent
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
                  <User className="h-[17px] w-[17px] text-primary" />
                  <CardTitle className="text-[15px] font-bold">By IT Owner (Top 5)</CardTitle>
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
                      className="flex items-center justify-between rounded-md border border-border bg-secondary p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{owner.ownerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {owner.count} risks closed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-lg font-bold text-foreground">{owner.average.toFixed(1)}d</p>
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
                  <FileText className="h-[17px] w-[17px] text-primary" />
                  <CardTitle className="text-[15px] font-bold">By Finding Source</CardTitle>
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
                      className="rounded-md border border-border bg-secondary p-3 text-center"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {source.source.replace(/_/g, " ")}
                      </p>
                      <p className="tnum mt-1 text-2xl font-bold text-foreground">{source.average.toFixed(1)}d</p>
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
                <CardTitle className="text-[15px] font-bold">Slowest Remediation</CardTitle>
                <CardDescription>
                  Top 10 risks with longest time to resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Risk</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Severity</TableHead>
                      <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Days to Close</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Closed Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.slowestRisks.map((risk) => (
                      <TableRow key={risk.id} className="hover:bg-secondary">
                        <TableCell>
                          <Link
                            href={`/risks/${risk.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {risk.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={risk.severity as Severity} />
                        </TableCell>
                        <TableCell className="tnum text-right font-mono">
                          {risk.daysToClose}d
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
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
                <CardTitle className="text-[15px] font-bold">All Closed Risks</CardTitle>
                <CardDescription>
                  Complete list of closed risks in the selected timeframe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Risk</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground data-[state=open]:bg-accent"
                          onClick={() => toggleSort("severity")}
                        >
                          Severity
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Owner</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-mr-3 ml-auto h-8 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground data-[state=open]:bg-accent"
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
                          className="-ml-3 h-8 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground data-[state=open]:bg-accent"
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
                      <TableRow key={risk.id} className="hover:bg-secondary">
                        <TableCell>
                          <Link
                            href={`/risks/${risk.id}`}
                            className="font-semibold text-primary hover:underline"
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
                        <TableCell className="tnum text-right font-mono">
                          {risk.daysToClose}d
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
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
                <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/70" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">No Closed Risks</h3>
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
