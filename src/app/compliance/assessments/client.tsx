"use client";

/**
 * Compliance Assessments Client Component
 *
 * Displays:
 * - Summary statistics (frameworks, controls, assessments)
 * - Frameworks section with cards to view or start assessments
 * - Assessments table with filters for framework, business unit, assessor, and status
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FrameworkCard } from "@/components/coverage/FrameworkCard";
import {
  RefreshCw,
  Loader2,
  Shield,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  X,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

export function CoverageDashboardClient() {
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial tab + filter state seeded from URL params so the dashboard
  // metric cards can deep-link with ?tab=assessments&status=...
  const initialTab = searchParams.get("tab") === "assessments" ? "assessments" : "frameworks";
  const initialStatusFilter = (() => {
    const raw = searchParams.get("status");
    if (!raw) return "__all__";
    // The current single-select Status filter expects one value. If the URL
    // carries a comma list, keep the existing UI as-is and pick the first.
    return raw.split(",")[0] ?? "__all__";
  })();

  // Filter state
  const [filterFramework, setFilterFramework] = useState<string>("__all__");
  const [filterBU, setFilterBU] = useState<string>("__all__");
  const [filterAssessor, setFilterAssessor] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>(initialStatusFilter);

  const utils = api.useUtils();

  // Fetch frameworks with control counts
  const {
    data: coverageData,
    isLoading: isLoadingCoverage,
    refetch: refetchCoverage,
  } = api.coverage.calculateAllFrameworkCoverage.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Fetch coverage summary
  const { data: summary, isLoading: isLoadingSummary } =
    api.coverage.getCoverageSummary.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });

  // Fetch all assessments
  const {
    data: assessmentsData,
    isLoading: isLoadingAssessments,
    refetch: refetchAssessments,
  } = api.complianceAssessment.list.useQuery(
    { pageSize: 100 },
    { staleTime: 2 * 60 * 1000 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchCoverage(),
        refetchAssessments(),
        utils.coverage.getCoverageSummary.invalidate(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAssessmentCreated = () => {
    void refetchAssessments();
  };

  const isLoading = isLoadingCoverage || isLoadingSummary || isLoadingAssessments;

  const assessments = assessmentsData?.assessments ?? [];

  // Derive unique filter options from the data
  const filterOptions = useMemo(() => {
    const frameworks = new Map<string, string>();
    const businessUnits = new Map<string, string>();
    const assessors = new Map<string, string>();
    const statuses = new Set<string>();

    assessments.forEach((a) => {
      frameworks.set(a.framework.id, `${a.framework.code} - ${a.framework.name}`);
      if (a.businessUnit) {
        businessUnits.set(a.businessUnit.id, a.businessUnit.name);
      }
      if (a.assessor) {
        assessors.set(a.assessor.id, a.assessor.name ?? a.assessor.email ?? a.assessor.id);
      }
      statuses.add(a.status);
    });

    return {
      frameworks: Array.from(frameworks.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      businessUnits: Array.from(businessUnits.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      assessors: Array.from(assessors.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      statuses: Array.from(statuses).sort(),
    };
  }, [assessments]);

  // Apply client-side filters
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (filterFramework !== "__all__" && a.framework.id !== filterFramework) return false;
      if (filterBU !== "__all__") {
        if (filterBU === "__none__" && a.businessUnit) return false;
        if (filterBU !== "__none__" && a.businessUnit?.id !== filterBU) return false;
      }
      if (filterAssessor !== "__all__") {
        if (filterAssessor === "__none__" && a.assessor) return false;
        if (filterAssessor !== "__none__" && a.assessor?.id !== filterAssessor) return false;
      }
      if (filterStatus !== "__all__" && a.status !== filterStatus) return false;
      return true;
    });
  }, [assessments, filterFramework, filterBU, filterAssessor, filterStatus]);

  const hasActiveFilters =
    filterFramework !== "__all__" ||
    filterBU !== "__all__" ||
    filterAssessor !== "__all__" ||
    filterStatus !== "__all__";

  const clearFilters = () => {
    setFilterFramework("__all__");
    setFilterBU("__all__");
    setFilterAssessor("__all__");
    setFilterStatus("__all__");
  };

  // Stats from all assessments (unfiltered)
  const activeAssessments = assessments.filter(
    (a) => a.status === "IN_PROGRESS" || a.status === "IN_REVIEW"
  );
  const completedAssessments = assessments.filter(
    (a) => a.status === "COMPLETED"
  );
  const draftAssessments = assessments.filter((a) => a.status === "DRAFT");

  // Count assessments per framework
  const assessmentsByFramework = new Map<string, number>();
  assessments.forEach((a) => {
    const count = assessmentsByFramework.get(a.frameworkId) ?? 0;
    assessmentsByFramework.set(a.frameworkId, count + 1);
  });

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Compliance" }, { label: "Assessments" }]}>
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-gray-500">Loading compliance data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance" }, { label: "Assessments" }]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7" />
              Compliance Assessments
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage frameworks and track compliance assessments
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Summary Statistics \u2014 each card is a clickable Link to the
            relevant filtered list. */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/frameworks?status=active" className="block">
            <Card className="hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                <p className="text-sm font-medium">Active Frameworks</p>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold">{summary?.activeFrameworks ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalControls ?? 0} total controls
                </p>
              </div>
            </Card>
          </Link>

          <Link href="/compliance/assessments?tab=assessments&status=IN_PROGRESS,IN_REVIEW" className="block">
            <Card className="hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                <p className="text-sm font-medium">Active Assessments</p>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold">{activeAssessments.length}</div>
                <p className="text-xs text-muted-foreground">
                  {draftAssessments.length} draft, {completedAssessments.length} completed
                </p>
              </div>
            </Card>
          </Link>

          <Link href="/compliance/dashboard" className="block">
            <Card className="hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                <p className="text-sm font-medium">Avg. Compliance</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-0">
                {(() => {
                  const scoredAssessments = assessments.filter(
                    (a) => a.complianceScore !== null && a.status !== "DRAFT"
                  );
                  const avgScore =
                    scoredAssessments.length > 0
                      ? scoredAssessments.reduce(
                          (sum, a) => sum + Number(a.complianceScore ?? 0),
                          0
                        ) / scoredAssessments.length
                      : null;
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {avgScore !== null ? `${avgScore.toFixed(0)}%` : "\u2014"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Across {scoredAssessments.length} scored assessments
                      </p>
                    </>
                  );
                })()}
              </div>
            </Card>
          </Link>

          <Link href="/compliance/assessments?tab=assessments&gaps=open" className="block">
            <Card className="hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer">
              <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                <p className="text-sm font-medium">Open Gaps</p>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="p-6 pt-0">
                {(() => {
                  const totalGaps = activeAssessments.reduce(
                    (sum, a) => sum + a.nonCompliantCount + a.partialCount,
                    0
                  );
                  return (
                    <>
                      <div className="text-2xl font-bold">{totalGaps}</div>
                      <p className="text-xs text-muted-foreground">
                        Non-compliant or partial controls
                      </p>
                    </>
                  );
                })()}
              </div>
            </Card>
          </Link>
        </div>

        {/* Main Content Tabs — initial tab seeded from `?tab=` so card
            deep-links land on the right tab. */}
        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="frameworks" className="gap-2">
              <Shield className="h-4 w-4" />
              Frameworks
            </TabsTrigger>
            <TabsTrigger value="assessments" className="gap-2">
              <FileText className="h-4 w-4" />
              Assessments
              {assessments.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {assessments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Assessments Tab */}
          <TabsContent value="assessments" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterFramework} onValueChange={setFilterFramework}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Frameworks</SelectItem>
                  {filterOptions.frameworks.map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterBU} onValueChange={setFilterBU}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Business Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Business Units</SelectItem>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {filterOptions.businessUnits.map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterAssessor} onValueChange={setFilterAssessor}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Assessor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Assessors</SelectItem>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {filterOptions.assessors.map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {filterOptions.statuses.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}

              <span className="text-sm text-muted-foreground ml-auto">
                {filteredAssessments.length} of {assessments.length} assessments
              </span>
            </div>

            {/* Table */}
            {filteredAssessments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium">
                    {assessments.length === 0 ? "No Assessments Yet" : "No Matching Assessments"}
                  </h3>
                  <p className="mt-2 text-gray-500">
                    {assessments.length === 0
                      ? "Start a compliance assessment from one of your active frameworks."
                      : "Try adjusting your filters."}
                  </p>
                  {assessments.length === 0 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        const frameworksTab = document.querySelector('[value="frameworks"]');
                        if (frameworksTab instanceof HTMLElement) frameworksTab.click();
                      }}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      View Frameworks
                    </Button>
                  )}
                  {hasActiveFilters && assessments.length > 0 && (
                    <Button variant="outline" className="mt-4" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Framework</TableHead>
                      <TableHead>Business Unit</TableHead>
                      <TableHead>Assessor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssessments.map((a) => {
                      const assessed = a.totalControls - a.notAssessedCount;
                      const progressPct = a.totalControls > 0
                        ? Math.round((assessed / a.totalControls) * 100)
                        : 0;

                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Link
                              href={`/compliance/assessments/${a.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {a.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{a.identifier}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.framework.code}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {a.businessUnit?.name ?? <span className="text-muted-foreground">&mdash;</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {a.assessor?.name ?? a.assessor?.email ?? <span className="text-muted-foreground">&mdash;</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[a.status] ?? ""} variant="secondary">
                              {STATUS_LABELS[a.status] ?? a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {a.complianceScore !== null
                              ? `${Number(a.complianceScore).toFixed(0)}%`
                              : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">
                                {progressPct}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {a.dueDate
                              ? format(new Date(a.dueDate), "MMM d, yyyy")
                              : <span className="text-muted-foreground">&mdash;</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Frameworks Tab */}
          <TabsContent value="frameworks" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Active Frameworks
              </h2>
              {coverageData?.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Shield className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-gray-500">No active frameworks found</p>
                    <p className="text-sm text-gray-400">
                      Activate frameworks in Administration to see them here
                    </p>
                    <Link href="/admin/frameworks">
                      <Button variant="outline" className="mt-4">
                        Manage Frameworks
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {coverageData?.map((framework) => (
                    <FrameworkCard
                      key={framework.frameworkId}
                      frameworkId={framework.frameworkId}
                      frameworkCode={framework.frameworkCode}
                      frameworkName={framework.frameworkName}
                      totalControls={framework.totalControls}
                      isActive={framework.isActive}
                      assessmentCount={assessmentsByFramework.get(framework.frameworkId) ?? 0}
                      onAssessmentCreated={handleAssessmentCreated}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
