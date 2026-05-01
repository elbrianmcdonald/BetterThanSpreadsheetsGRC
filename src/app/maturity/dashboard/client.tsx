"use client";

/**
 * Maturity Dashboard Client Component
 *
 * Redesigned to match the compliance dashboard layout:
 * - Overview card with framework selector and 4 stat boxes
 * - Assessment cards in a tabbed 3-column grid
 * - Create assessment dialog
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Gauge,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  User,
  AlertTriangle,
  Shield,
  ClipboardList,
  ChevronRight,
  Building2,
  BarChart3,
} from "lucide-react";
import {
  MaturityFrameworkType,
  MaturityAssessmentStatus,
  AssessmentDepth,
  AssessmentMode,
  MaturityScoringScale,
} from "@prisma/client";
import {
  getScaleDefinition,
  NIST_TIERS_SCALE,
  CMMI_MATURITY_SCALE,
  type ScaleDefinition,
} from "@/lib/maturity-scales";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BusinessUnitSelector } from "@/components/compliance/BusinessUnitSelector";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";

// ---------- Constants ----------

const FRAMEWORK_LABELS: Record<MaturityFrameworkType, string> = {
  NIST_CSF_2: "NIST CSF 2.0",
  C2M2: "C2M2",
  OWASP_SAMM: "OWASP SAMM",
};

const STATUS_CONFIG: Record<
  MaturityAssessmentStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  DRAFT: { label: "Draft", color: "text-gray-700", bgColor: "bg-gray-100", icon: FileText },
  IN_PROGRESS: { label: "In Progress", color: "text-blue-700", bgColor: "bg-blue-100", icon: Clock },
  IN_REVIEW: { label: "In Review", color: "text-amber-700", bgColor: "bg-amber-100", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "text-green-700", bgColor: "bg-green-100", icon: CheckCircle2 },
  ARCHIVED: { label: "Archived", color: "text-slate-500", bgColor: "bg-slate-100", icon: FileText },
};

const DEPTH_LABELS: Record<AssessmentDepth, string> = {
  FUNCTION: "Function",
  CATEGORY: "Category",
  SUBCATEGORY: "Subcategory",
};

// ---------- Helpers ----------

function getLevelLabel(type: MaturityFrameworkType, level: number | null): string {
  if (level === null) return "\u2014";
  switch (type) {
    case "C2M2": return `MIL ${level}`;
    case "NIST_CSF_2": return `Tier ${level}`;
    case "OWASP_SAMM": return `Level ${level}`;
    default: return `Level ${level}`;
  }
}

function getLevelColorClasses(level: number | null, maxLevel: number) {
  if (level === null || maxLevel === 0) {
    return { bg: "bg-gray-100 dark:bg-gray-950/50", text: "text-gray-500 dark:text-gray-400", ring: "ring-gray-200", progress: "bg-gray-400" };
  }
  const pct = level / maxLevel;
  if (pct >= 0.75) {
    return { bg: "bg-green-100 dark:bg-green-950/50", text: "text-green-700 dark:text-green-400", ring: "ring-green-500/20", progress: "bg-green-500" };
  }
  if (pct >= 0.5) {
    return { bg: "bg-yellow-100 dark:bg-yellow-950/50", text: "text-yellow-700 dark:text-yellow-400", ring: "ring-yellow-500/20", progress: "bg-yellow-500" };
  }
  return { bg: "bg-red-100 dark:bg-red-950/50", text: "text-red-700 dark:text-red-400", ring: "ring-red-500/20", progress: "bg-red-500" };
}

function getLevelScoreBg(level: number | null, maxLevel: number): string {
  if (level === null || maxLevel === 0) return "bg-gray-100";
  const pct = level / maxLevel;
  if (pct >= 0.75) return "bg-green-100";
  if (pct >= 0.5) return "bg-amber-100";
  return "bg-red-100";
}

function getLevelScoreText(level: number | null, maxLevel: number): string {
  if (level === null || maxLevel === 0) return "text-gray-500";
  const pct = level / maxLevel;
  if (pct >= 0.75) return "text-green-600";
  if (pct >= 0.5) return "text-amber-600";
  return "text-red-600";
}

// ---------- Types ----------

type AssessmentWithRelations = {
  id: string;
  name: string;
  identifier: string;
  status: MaturityAssessmentStatus;
  assessmentDepth: AssessmentDepth;
  overallLevel: number | null;
  overallScore: unknown;
  targetLevel: number | null;
  targetDate: Date | null;
  updatedAt: Date;
  framework: { type: string; name: string; maxLevel: number; minLevel: number };
  owner: { id: string; name: string | null; email: string };
  businessUnit?: { id: string; name: string; code: string } | null;
  _count: { domainScores: number; assignees: number; snapshots: number };
};

// ---------- MaturityAssessmentCard ----------

function MaturityAssessmentCard({ assessment }: { assessment: AssessmentWithRelations }) {
  const config = STATUS_CONFIG[assessment.status];
  const StatusIcon = config.icon;
  const frameworkType = assessment.framework.type as MaturityFrameworkType;
  const maxLevel = assessment.framework.maxLevel;
  const levelLabel = assessment.overallLevel !== null
    ? getLevelLabel(frameworkType, assessment.overallLevel)
    : "\u2014";
  const domainsScored = assessment._count.domainScores;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {FRAMEWORK_LABELS[frameworkType]}
              </Badge>
              <Badge className={cn(config.color, config.bgColor)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {assessment.businessUnit && (
                <Badge variant="secondary" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {assessment.businessUnit.code || assessment.businessUnit.name}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base">{assessment.name}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {assessment.identifier}
            </CardDescription>
          </div>
          {/* Maturity Level */}
          <div className={cn(
            "text-center px-3 py-2 rounded-lg",
            getLevelScoreBg(assessment.overallLevel, maxLevel)
          )}>
            <div className={cn(
              "text-xl font-bold",
              getLevelScoreText(assessment.overallLevel, maxLevel)
            )}>
              {levelLabel}
            </div>
            <div className="text-xs text-muted-foreground">Level</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{domainsScored} domains scored</span>
          </div>
          <Progress
            value={assessment.overallLevel !== null && maxLevel > 0
              ? (assessment.overallLevel / maxLevel) * 100
              : 0}
            className="h-2"
          />
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-bold text-green-700">
              {assessment.overallLevel !== null
                ? getLevelLabel(frameworkType, assessment.overallLevel)
                : "\u2014"}
            </div>
            <div className="text-green-600">Current</div>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded">
            <div className="font-bold text-amber-700">
              {assessment.targetLevel !== null
                ? getLevelLabel(frameworkType, assessment.targetLevel)
                : "\u2014"}
            </div>
            <div className="text-amber-600">Target</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-bold text-gray-700">{domainsScored}</div>
            <div className="text-gray-600">Scored</div>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          {assessment.owner.name && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{assessment.owner.name}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span>{DEPTH_LABELS[assessment.assessmentDepth]}</span>
            <span>{format(new Date(assessment.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* View Button */}
        <Link href={`/maturity/${assessment.id}`}>
          <Button variant="outline" size="sm" className="w-full">
            View Assessment
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export function MaturityDashboardClient() {
  const searchParams = useSearchParams();

  // Overview framework selector
  const [selectedFrameworkType, setSelectedFrameworkType] = useState<MaturityFrameworkType | null>(null);

  // Business unit filter
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string | null>(null);

  // Assessment tab filter
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(() => {
    return searchParams.get("create") === "true";
  });

  // Form state for creating assessments
  const [formData, setFormData] = useState<{
    frameworkId: string;
    name: string;
    description: string;
    assessmentDepth: AssessmentDepth;
    assessmentMode: AssessmentMode;
    scoringScale: MaturityScoringScale | null;
    targetLevel: number | null;
    functionTargets: Record<string, number>; // code → tier
    targetDate: string;
    businessUnitId: string | null;
  }>({
    frameworkId: "",
    name: "",
    description: "",
    assessmentDepth: AssessmentDepth.FUNCTION,
    assessmentMode: AssessmentMode.SELF,
    scoringScale: null,
    targetLevel: null,
    functionTargets: {},
    targetDate: "",
    businessUnitId: null,
  });

  const utils = api.useUtils();

  // ---- Queries ----

  const buFilter = selectedBusinessUnitId ? { businessUnitId: selectedBusinessUnitId } : {};

  const { data: dashboardData, isLoading: dashboardLoading } =
    api.maturity.getDashboardSummary.useQuery(
      selectedBusinessUnitId ? { businessUnitId: selectedBusinessUnitId } : undefined
    );

  const { data: comparisonData, isLoading: comparisonLoading } =
    api.maturity.getFrameworkComparison.useQuery(
      selectedBusinessUnitId ? { businessUnitId: selectedBusinessUnitId } : undefined
    );

  const { data: domainData } = api.maturity.getDomainScoresForChart.useQuery(
    { frameworkType: selectedFrameworkType!, ...buFilter },
    { enabled: !!selectedFrameworkType }
  );

  const { data: allAssessmentsData, isLoading: assessmentsLoading } =
    api.maturity.list.useQuery({ pageSize: 50, ...buFilter });

  const { data: frameworks } = api.maturity.listFrameworks.useQuery();

  // ---- Mutations ----

  const createMutation = api.maturity.create.useMutation({
    onSuccess: () => {
      toast.success("Assessment created successfully");
      setCreateDialogOpen(false);
      setFormData({
        frameworkId: "",
        name: "",
        description: "",
        assessmentDepth: AssessmentDepth.FUNCTION,
        assessmentMode: AssessmentMode.SELF,
        scoringScale: null,
        targetLevel: null,
        functionTargets: {},
        targetDate: "",
        businessUnitId: null,
      });
      void utils.maturity.list.invalidate();
      void utils.maturity.getDashboardSummary.invalidate();
      void utils.maturity.getFrameworkComparison.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create assessment");
    },
  });

  const handleCreate = () => {
    if (!formData.frameworkId || !formData.name.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    const isCsf = selectedCreateFramework?.type === "NIST_CSF_2";
    const hasPerDomainTargets =
      Object.keys(formData.functionTargets).length > 0;

    createMutation.mutate({
      frameworkId: formData.frameworkId,
      name: formData.name.trim(),
      description: formData.description || undefined,
      // NIST CSF 2.0 is forced to FUNCTION depth (no Category/Subcategory
      // for this framework per simplified UX).
      assessmentDepth: isCsf
        ? AssessmentDepth.FUNCTION
        : formData.assessmentDepth,
      // Assessment mode is no longer user-selectable — all maturity
      // assessments use the same workflow. Persist SELF for compatibility.
      assessmentMode: AssessmentMode.SELF,
      scoringScale: isCsf
        ? formData.scoringScale ?? MaturityScoringScale.NIST_TIERS
        : undefined,
      targetLevel: hasPerDomainTargets ? null : formData.targetLevel,
      functionTargets: hasPerDomainTargets ? formData.functionTargets : undefined,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
      businessUnitId: formData.businessUnitId,
    });
  };

  // ---- Derived State ----

  const comparisonList = comparisonData?.comparison ?? [];

  // Auto-select first framework that has assessments, or fall back to first
  useEffect(() => {
    if (!selectedFrameworkType && comparisonList.length > 0) {
      const withAssessments = comparisonList.find((c) => c.assessmentCount > 0);
      setSelectedFrameworkType((withAssessments ?? comparisonList[0])!.frameworkType);
    }
  }, [comparisonList, selectedFrameworkType]);

  const selectedComparison = selectedFrameworkType
    ? comparisonList.find((c) => c.frameworkType === selectedFrameworkType)
    : null;

  // Domain stats from getDomainScoresForChart
  const domains = domainData?.domains ?? [];
  const totalDomains = domains.length;
  const domainsScored = domains.filter((d) => d.currentLevel > 0).length;
  const domainsBelowTarget = domains.filter((d) => d.currentLevel < d.targetLevel).length;

  // Last updated from latest assessment
  const latestUpdated = selectedComparison?.latestAssessment?.updatedAt;

  // Level color classes for the overview card
  const levelColors = selectedComparison
    ? getLevelColorClasses(selectedComparison.currentLevel, selectedComparison.maxLevel)
    : getLevelColorClasses(null, 0);

  // Filter assessments for tabs
  const allAssessments = (allAssessmentsData?.assessments ?? []) as AssessmentWithRelations[];
  const activeAssessments = allAssessments.filter((a) =>
    ["DRAFT", "IN_PROGRESS", "IN_REVIEW"].includes(a.status)
  );
  const completedAssessments = allAssessments.filter((a) => a.status === "COMPLETED");

  // Create dialog: selected framework detail
  const selectedCreateFramework = frameworks?.find((f) => f.id === formData.frameworkId);

  // Loading
  const isLoading = dashboardLoading || comparisonLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Maturity", href: "/maturity/dashboard" }, { label: "Dashboard" }]}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Maturity Dashboard</h1>
          <p className="text-muted-foreground">
            Track and improve organizational maturity across security frameworks
          </p>
        </div>
      </div>

      {/* Maturity Overview Card */}
      {comparisonList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No Maturity Frameworks</CardTitle>
            <CardDescription className="mb-4">
              Create a maturity assessment to start tracking your organization&apos;s maturity.
            </CardDescription>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <CardTitle>Maturity Overview</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={selectedFrameworkType ?? ""}
                  onValueChange={(value) => setSelectedFrameworkType(value as MaturityFrameworkType)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {comparisonList.map((c) => (
                      <SelectItem key={c.frameworkType} value={c.frameworkType}>
                        {FRAMEWORK_LABELS[c.frameworkType] ?? c.frameworkName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <BusinessUnitSelector
                  value={selectedBusinessUnitId}
                  onChange={setSelectedBusinessUnitId}
                  className="w-[200px]"
                />

                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Assessment
                </Button>
              </div>
            </div>
            {latestUpdated && (
              <CardDescription>
                Last updated:{" "}
                {new Date(latestUpdated).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedComparison ? (
              <div className="space-y-6">
                {/* 4 Stat Boxes \u2014 link to the latest assessment so the
                    user lands on the page that actually shows the items
                    each card is counting. The "Below Target" card adds
                    a hash anchor so the page can scroll to its target
                    section once that's wired up. */}
                {(() => {
                  const matAssessmentId = selectedComparison.latestAssessment?.id;
                  const assessmentLink = matAssessmentId
                    ? `/maturity/${matAssessmentId}`
                    : "/maturity";
                  return (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                      <Link
                        href={assessmentLink}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-lg ring-1 hover:ring-2 transition-all cursor-pointer",
                          levelColors.bg,
                          levelColors.ring
                        )}
                      >
                        <span className={cn("text-4xl font-bold", levelColors.text)}>
                          {selectedComparison.currentLevel !== null
                            ? getLevelLabel(selectedFrameworkType!, selectedComparison.currentLevel)
                            : "\u2014"}
                        </span>
                        <span className="text-sm text-muted-foreground mt-1">
                          Maturity Level
                        </span>
                      </Link>

                      <Link
                        href={`${assessmentLink}?filter=scored`}
                        className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted hover:ring-1 hover:ring-green-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-2xl font-semibold">{domainsScored}</div>
                            <div className="text-sm text-muted-foreground">Domains Scored</div>
                          </div>
                        </div>
                      </Link>

                      <Link
                        href={assessmentLink}
                        className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-2xl font-semibold">{totalDomains}</div>
                            <div className="text-sm text-muted-foreground">Total Domains</div>
                          </div>
                        </div>
                      </Link>

                      <Link
                        href={`${assessmentLink}?filter=below-target`}
                        className="flex flex-col justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted hover:ring-1 hover:ring-red-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/50">
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <div className="text-2xl font-semibold">{domainsBelowTarget}</div>
                            <div className="text-sm text-muted-foreground">Below Target</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })()}

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Scoring Progress</span>
                    <span className="font-medium">
                      {domainsScored} / {totalDomains} domains
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-500", levelColors.progress)}
                      style={{
                        width: `${totalDomains > 0 ? (domainsScored / totalDomains) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {selectedComparison.latestAssessment && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/maturity/${selectedComparison.latestAssessment.id}`}>
                        View Assessment
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                    Start New Assessment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gauge className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a framework to view maturity details</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assessments Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Maturity Assessments</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Assessment
            </Button>
          </div>
        </div>

        <Tabs value={assessmentFilter} onValueChange={setAssessmentFilter} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              All
              <span className="text-xs text-muted-foreground">
                ({allAssessments.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="gap-2">
              <Clock className="h-3.5 w-3.5" />
              In Progress
              <span className="text-xs text-muted-foreground">
                ({activeAssessments.length})
              </span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
              <span className="text-xs text-muted-foreground">
                ({completedAssessments.length})
              </span>
            </TabsTrigger>
          </TabsList>

          {/* All Tab */}
          <TabsContent value="all" className="mt-4">
            {assessmentsLoading ? (
              <AssessmentGridSkeleton />
            ) : allAssessments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allAssessments.map((a) => (
                  <MaturityAssessmentCard key={a.id} assessment={a} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Assessments</CardTitle>
                  <CardDescription className="mb-4">
                    Create your first maturity assessment to start tracking your organization&apos;s security posture.
                  </CardDescription>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Assessment
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* In Progress Tab */}
          <TabsContent value="in-progress" className="mt-4">
            {assessmentsLoading ? (
              <AssessmentGridSkeleton />
            ) : activeAssessments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeAssessments.map((a) => (
                  <MaturityAssessmentCard key={a.id} assessment={a} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No In Progress Assessments</CardTitle>
                  <CardDescription className="mb-4">
                    Start a maturity assessment to begin tracking progress.
                  </CardDescription>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Assessment
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="mt-4">
            {assessmentsLoading ? (
              <AssessmentGridSkeleton />
            ) : completedAssessments.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedAssessments.map((a) => (
                  <MaturityAssessmentCard key={a.id} assessment={a} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <CardTitle className="mb-2">No Completed Assessments</CardTitle>
                  <CardDescription>
                    Completed maturity assessments will appear here.
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Assessment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Maturity Assessment</DialogTitle>
            <DialogDescription>
              Start a new maturity assessment to evaluate your organization against a security framework.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="framework">Framework *</Label>
              <Select
                value={formData.frameworkId}
                onValueChange={(value) => {
                  const fw = frameworks?.find((f) => f.id === value);
                  setFormData((prev) => ({
                    ...prev,
                    frameworkId: value,
                    assessmentDepth: fw?.type === "C2M2" ? AssessmentDepth.FUNCTION : prev.assessmentDepth,
                    // Per-domain targets are keyed by the previous framework's
                    // domain codes — clear them when the framework changes.
                    functionTargets: {},
                    targetLevel: null,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a framework" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks?.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {framework.name} (v{framework.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Assessment Name *</Label>
              <Input
                id="name"
                placeholder="e.g., 2024 Q1 Security Maturity Assessment"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this assessment..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>Business Unit</Label>
              <BusinessUnitSelector
                value={formData.businessUnitId}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, businessUnitId: value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Assessment Depth — hidden for NIST CSF 2.0 (Function-only) */}
              {selectedCreateFramework?.type !== "NIST_CSF_2" && (
                <div className="grid gap-2">
                  <Label>Assessment Depth</Label>
                  <Select
                    value={formData.assessmentDepth}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        assessmentDepth: value as AssessmentDepth,
                        // Switching depth changes which domain level is
                        // scored; stale per-domain targets at the old depth
                        // won't match, so clear them.
                        functionTargets: {},
                      }))
                    }
                    disabled={selectedCreateFramework?.type === "C2M2"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCreateFramework?.type === "C2M2" ? (
                        <SelectItem value="FUNCTION">Domain Level (10 domains)</SelectItem>
                      ) : selectedCreateFramework?.type === "OWASP_SAMM" ? (
                        <>
                          <SelectItem value="FUNCTION">Business Function Level (5 items)</SelectItem>
                          <SelectItem value="CATEGORY">Practice Level (15 items)</SelectItem>
                          <SelectItem value="SUBCATEGORY">Activity Level (30 items)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="FUNCTION">Function Level (6 items)</SelectItem>
                          <SelectItem value="CATEGORY">Category Level (22 items)</SelectItem>
                          <SelectItem value="SUBCATEGORY">Subcategory Level (106 items)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Assessment Mode dropdown removed — all maturity assessments
                  follow the same workflow now. assessmentMode is hardcoded
                  to SELF in the submit payload below to satisfy the DB
                  constraint without exposing a meaningless choice. */}
            </div>

            {/* NIST CSF 2.0: pick a scoring scale (Tiers or CMMI) */}
            {selectedCreateFramework?.type === "NIST_CSF_2" && (
              <div className="grid gap-2">
                <Label>Scoring Scale</Label>
                <Select
                  value={formData.scoringScale ?? MaturityScoringScale.NIST_TIERS}
                  onValueChange={(value) => {
                    // Clear any per-function targets when the scale changes —
                    // they're interpreted differently by each scale.
                    setFormData((prev) => ({
                      ...prev,
                      scoringScale: value as MaturityScoringScale,
                      functionTargets: {},
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MaturityScoringScale.NIST_TIERS}>
                      NIST Implementation Tiers (0–4)
                    </SelectItem>
                    <SelectItem value={MaturityScoringScale.CMMI_MATURITY}>
                      CMMI Maturity Levels (1–5)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.scoringScale === MaturityScoringScale.CMMI_MATURITY
                    ? "Levels: Initial / Managed / Defined / Quantitatively Managed / Optimizing"
                    : "Tiers: None / Partial / Risk Informed / Repeatable / Adaptive"}
                </p>
              </div>
            )}

            {/* Per-domain target levels. CSF uses the chosen scoring scale;
                C2M2 and SAMM use the framework's built-in minLevel→maxLevel
                range with framework-appropriate labels (MIL / Level). */}
            {selectedCreateFramework && (
              <DomainTargetsBlock
                framework={selectedCreateFramework}
                assessmentDepth={
                  selectedCreateFramework.type === "NIST_CSF_2"
                    ? AssessmentDepth.FUNCTION
                    : selectedCreateFramework.type === "C2M2"
                      ? AssessmentDepth.FUNCTION
                      : formData.assessmentDepth
                }
                scoringScale={formData.scoringScale}
                value={formData.functionTargets}
                onChange={(next) =>
                  setFormData((prev) => ({ ...prev, functionTargets: next }))
                }
              />
            )}

            <div className="grid gap-2">
              <Label>Target Date</Label>
              <Input
                type="date"
                value={formData.targetDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ---------- Skeletons ----------

function AssessmentGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="py-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-24 mb-4" />
            <Skeleton className="h-2 w-full rounded-full mb-4" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <AppLayout breadcrumbs={[{ label: "Maturity", href: "/maturity/dashboard" }, { label: "Dashboard" }]}>
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <Card>
          <CardContent className="py-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-10 w-24 mb-4" />
                <Skeleton className="h-2 w-full rounded-full mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * Per-domain target level picker. Works for any maturity framework by
 * fetching the framework's domains at the chosen assessment depth and
 * rendering one row per domain. Labels are driven by the framework type
 * (NIST Tier / CMMI / MIL / Level) and — for NIST CSF 2.0 — by the
 * selected scoring scale.
 */
function DomainTargetsBlock(props: {
  framework: { id: string; type: MaturityFrameworkType; minLevel: number; maxLevel: number };
  assessmentDepth: AssessmentDepth;
  scoringScale: MaturityScoringScale | null;
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const { data: frameworkWithDomains, isLoading } = api.maturity.getFramework.useQuery(
    { id: props.framework.id },
    { enabled: !!props.framework.id }
  );

  const domains = (frameworkWithDomains?.domains ?? [])
    .filter((d) => d.level === props.assessmentDepth)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Build the list of {value, label} options for the target dropdown. CSF
  // 2.0 uses whichever scoringScale was picked; other frameworks use their
  // native min→max range with framework-appropriate prefix labels.
  const scaleDef =
    props.framework.type === "NIST_CSF_2"
      ? getScaleDefinition(props.scoringScale ?? MaturityScoringScale.NIST_TIERS)
      : null;

  const levelOptions = scaleDef
    ? scaleDef.levels.map((l) => ({ value: l.value, label: l.label }))
    : Array.from(
        { length: props.framework.maxLevel - props.framework.minLevel + 1 },
        (_, i) => props.framework.minLevel + i
      ).map((level) => ({
        value: level,
        label:
          props.framework.type === "C2M2"
            ? `MIL ${level}`
            : props.framework.type === "OWASP_SAMM"
              ? `Level ${level}`
              : `Level ${level}`,
      }));

  const levelHeading =
    props.framework.type === "NIST_CSF_2"
      ? "Target levels per Function"
      : props.framework.type === "C2M2"
        ? "Target levels per Domain"
        : props.assessmentDepth === AssessmentDepth.FUNCTION
          ? "Target levels per Business Function"
          : props.assessmentDepth === AssessmentDepth.CATEGORY
            ? "Target levels per Practice"
            : "Target levels per Activity";

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Label>{levelHeading}</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading items…
        </div>
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="grid gap-2">
        <Label>{levelHeading}</Label>
        <p className="text-xs text-muted-foreground">
          No items found for this framework / depth.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label>{levelHeading}</Label>
      <p className="text-xs text-muted-foreground -mt-1">
        Each item gets its own target. Children inherit their parent's target.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-[320px] overflow-y-auto">
        {domains.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <span className="font-mono text-xs text-blue-700 w-12 shrink-0 truncate">
              {d.code}
            </span>
            <span className="text-sm flex-1 truncate" title={d.name}>
              {d.name}
            </span>
            <Select
              value={
                props.value[d.code] !== undefined
                  ? props.value[d.code]!.toString()
                  : "none"
              }
              onValueChange={(v) => {
                const next = { ...props.value };
                if (v === "none") {
                  delete next[d.code];
                } else {
                  next[d.code] = parseInt(v, 10);
                }
                props.onChange(next);
              }}
            >
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="No target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No target</SelectItem>
                {levelOptions.map((lvl) => (
                  <SelectItem key={lvl.value} value={lvl.value.toString()}>
                    {lvl.value} — {lvl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
