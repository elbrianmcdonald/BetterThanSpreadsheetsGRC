"use client";

/**
 * Maturity Dashboard Client Component
 *
 * Unified maturity management dashboard with:
 * - Summary cards showing assessment counts and average maturity
 * - Full assessments list with filtering and creation
 * - Framework summary cards with progress
 *
 * Note: Consolidated from separate dashboard and assessments pages.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Gauge,
  BarChart3,
  Activity,
  Clock,
  Target,
  ChevronRight,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Calendar,
  User,
  Filter,
} from "lucide-react";
import {
  MaturityFrameworkType,
  MaturityAssessmentStatus,
  AssessmentDepth,
  AssessmentMode,
} from "@prisma/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

// Framework type labels
const FRAMEWORK_LABELS: Record<MaturityFrameworkType, string> = {
  NIST_CSF_2: "NIST CSF 2.0",
  C2M2: "C2M2",
  OWASP_SAMM: "OWASP SAMM",
};

// Framework colors
const FRAMEWORK_COLORS: Record<MaturityFrameworkType, string> = {
  NIST_CSF_2: "hsl(221, 83%, 53%)", // Blue
  C2M2: "hsl(24, 94%, 50%)", // Orange
  OWASP_SAMM: "hsl(142, 71%, 45%)", // Green
};

// Level labels by framework
function getLevelLabel(type: MaturityFrameworkType, level: number | null): string {
  if (level === null) return "Not Assessed";

  switch (type) {
    case "C2M2":
      return `MIL ${level}`;
    case "NIST_CSF_2":
      return `Tier ${level}`;
    case "OWASP_SAMM":
      return `Level ${level}`;
    default:
      return `Level ${level}`;
  }
}

// Status badge configuration
const STATUS_CONFIG: Record<
  MaturityAssessmentStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  IN_REVIEW: { label: "In Review", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-700", icon: FileText },
};

// Assessment depth labels
const DEPTH_LABELS: Record<AssessmentDepth, string> = {
  FUNCTION: "Function Level",
  CATEGORY: "Category Level",
  SUBCATEGORY: "Subcategory Level",
};

// Assessment mode labels
const MODE_LABELS: Record<AssessmentMode, string> = {
  SELF: "Self-Assessment",
  GUIDED: "Guided Wizard",
  HYBRID: "Hybrid",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MaturityDashboardClient() {
  const searchParams = useSearchParams();
  const [selectedFramework, setSelectedFramework] = useState<string>("all");

  // Tab state - default to "assessments" if ?create=true in URL
  const [activeTab, setActiveTab] = useState<string>(() => {
    return searchParams.get("create") === "true" ? "assessments" : "overview";
  });

  // Assessment list state
  const [filterFramework, setFilterFramework] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Create dialog state - auto-open if ?create=true in URL
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
    targetLevel: number | null;
    targetDate: string;
  }>({
    frameworkId: "",
    name: "",
    description: "",
    assessmentDepth: AssessmentDepth.FUNCTION,
    assessmentMode: AssessmentMode.SELF,
    targetLevel: null,
    targetDate: "",
  });

  const utils = api.useUtils();

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } =
    api.maturity.getDashboardSummary.useQuery();

  // Fetch framework comparison for summary cards
  const { data: comparisonData } =
    api.maturity.getFrameworkComparison.useQuery();

  // Fetch frameworks for create dialog
  const { data: frameworks, isLoading: frameworksLoading } =
    api.maturity.listFrameworks.useQuery();

  // Fetch assessments list
  const { data: assessmentsData, isLoading: assessmentsLoading } =
    api.maturity.list.useQuery({
      frameworkType: filterFramework !== "all" ? (filterFramework as MaturityFrameworkType) : undefined,
      status: filterStatus !== "all" ? (filterStatus as MaturityAssessmentStatus) : undefined,
      page,
      pageSize: 20,
    });

  // Create assessment mutation
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
        targetLevel: null,
        targetDate: "",
      });
      void utils.maturity.list.invalidate();
      void utils.maturity.getDashboardSummary.invalidate();
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

    createMutation.mutate({
      frameworkId: formData.frameworkId,
      name: formData.name.trim(),
      description: formData.description || undefined,
      assessmentDepth: formData.assessmentDepth,
      assessmentMode: formData.assessmentMode,
      targetLevel: formData.targetLevel,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
    });
  };

  // Get selected framework details for create dialog
  const selectedCreateFramework = frameworks?.find((f) => f.id === formData.frameworkId);

  const isLoading = dashboardLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!dashboardData) {
    return null;
  }

  const { totalAssessments, byFramework, statusDistribution, recentAssessments } =
    dashboardData;

  return (
    <AppLayout
      breadcrumbs={[{ label: "Maturity" }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Gauge className="h-6 w-6" />
              Maturity
            </h1>
            <p className="mt-1 text-sm text-gray-700">
              Track and improve organizational maturity across security frameworks.
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Button>
            </DialogTrigger>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Assessment Depth</Label>
                    <Select
                      value={formData.assessmentDepth}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          assessmentDepth: value as AssessmentDepth,
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

                  <div className="grid gap-2">
                    <Label>Assessment Mode</Label>
                    <Select
                      value={formData.assessmentMode}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          assessmentMode: value as AssessmentMode,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SELF">Self-Assessment</SelectItem>
                        <SelectItem value="GUIDED">Guided Wizard</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Target Level</Label>
                    <Select
                      value={formData.targetLevel?.toString() ?? "none"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          targetLevel: value === "none" ? null : parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No target</SelectItem>
                        {selectedCreateFramework &&
                          Array.from(
                            { length: selectedCreateFramework.maxLevel - selectedCreateFramework.minLevel + 1 },
                            (_, i) => selectedCreateFramework.minLevel + i
                          ).map((level) => (
                            <SelectItem key={level} value={level.toString()}>
                              {selectedCreateFramework.type === "C2M2" ? `MIL ${level}` : selectedCreateFramework.type === "OWASP_SAMM" ? `Level ${level}` : `Tier ${level}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

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
        </div>

        {/* Tabs for Overview and Assessments */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="assessments" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Assessments
              {assessmentsData?.pagination.total ? (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {assessmentsData.pagination.total}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Assessments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssessments}</div>
              <p className="text-xs text-muted-foreground">
                {statusDistribution.completed} completed, {statusDistribution.inProgress} in progress
              </p>
            </CardContent>
          </Card>

          {/* By Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assessment Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {statusDistribution.draft > 0 && (
                  <Badge variant="secondary">{statusDistribution.draft} Draft</Badge>
                )}
                {statusDistribution.inProgress > 0 && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {statusDistribution.inProgress} In Progress
                  </Badge>
                )}
                {statusDistribution.completed > 0 && (
                  <Badge className="bg-green-100 text-green-700">
                    {statusDistribution.completed} Completed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Frameworks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">By Framework</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {(Object.keys(byFramework) as MaturityFrameworkType[]).map((type) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-muted-foreground">{FRAMEWORK_LABELS[type]}</span>
                    <span className="font-medium">{byFramework[type].count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Assessments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Assessments</CardTitle>
              <CardDescription>Latest maturity assessment activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("assessments")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentAssessments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gauge className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No assessments yet</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Assessment
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAssessments.map((assessment) => {
                  const statusConfig = STATUS_CONFIG[assessment.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <Link
                      key={assessment.id}
                      href={`/maturity/${assessment.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {FRAMEWORK_LABELS[assessment.frameworkType]}
                            </Badge>
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <span className="font-medium mt-1">{assessment.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {assessment.identifier} | Updated{" "}
                            {format(new Date(assessment.updatedAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {getLevelLabel(assessment.frameworkType, assessment.overallLevel)}
                          </div>
                          {assessment.targetLevel !== null && (
                            <div className="text-xs text-muted-foreground">
                              Target: {getLevelLabel(assessment.frameworkType, assessment.targetLevel)}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Framework Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(byFramework) as MaturityFrameworkType[]).map((type) => {
            const framework = byFramework[type];
            const comparison = comparisonData?.comparison.find(
              (c) => c.frameworkType === type
            );

            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: FRAMEWORK_COLORS[type] }}
                    />
                    {FRAMEWORK_LABELS[type]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Assessments</span>
                      <span className="font-medium">{framework.count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg. Level</span>
                      <span className="font-medium">
                        {framework.count > 0 && framework.avgLevel > 0
                          ? getLevelLabel(type, Math.round(framework.avgLevel))
                          : "N/A"}
                      </span>
                    </div>
                    {comparison?.latestAssessment && (
                      <>
                        <div className="pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-1">
                            Latest Assessment
                          </div>
                          <Link
                            href={`/maturity/${comparison.latestAssessment.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {comparison.latestAssessment.name}
                          </Link>
                        </div>
                        {comparison.currentLevel !== null && comparison.maxLevel > 0 && (
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>
                                {comparison.currentLevel} / {comparison.maxLevel}
                              </span>
                            </div>
                            <Progress
                              value={(comparison.currentLevel / comparison.maxLevel) * 100}
                              className="h-2"
                            />
                          </div>
                        )}
                      </>
                    )}
                    {framework.count === 0 && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Start Assessment
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
          </TabsContent>

          {/* Assessments Tab */}
          <TabsContent value="assessments" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex gap-3">
                <Select value={filterFramework} onValueChange={setFilterFramework}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Frameworks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frameworks</SelectItem>
                    <SelectItem value="NIST_CSF_2">NIST CSF 2.0</SelectItem>
                    <SelectItem value="C2M2">C2M2</SelectItem>
                    <SelectItem value="OWASP_SAMM">OWASP SAMM</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assessments List */}
            {assessmentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !assessmentsData?.assessments.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Gauge className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Assessments Found</h3>
                  <p className="text-muted-foreground text-center mb-4 max-w-md">
                    {filterFramework !== "all" || filterStatus !== "all"
                      ? "No assessments match your current filters."
                      : "Create your first maturity assessment to start tracking your organization's security posture."}
                  </p>
                  {filterFramework === "all" && filterStatus === "all" && (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Assessment
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assessmentsData.assessments.map((assessmentData) => {
                  // Type assertion for relations
                  const assessment = assessmentData as typeof assessmentData & {
                    framework: { type: MaturityFrameworkType; name: string };
                    owner: { id: string; name: string | null; email: string };
                    _count: { domainScores: number; assignees: number; snapshots: number };
                  };
                  const statusConfig = STATUS_CONFIG[assessment.status];
                  const StatusIcon = statusConfig.icon;
                  const progress = assessment.overallScore
                    ? Number(assessment.overallScore)
                    : 0;

                  return (
                    <Link
                      key={assessment.id}
                      href={`/maturity/${assessment.id}`}
                      className="block"
                    >
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {FRAMEWORK_LABELS[assessment.framework.type]}
                                </Badge>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <CardTitle className="text-lg">{assessment.name}</CardTitle>
                              <CardDescription className="text-sm">
                                {assessment.identifier} | {DEPTH_LABELS[assessment.assessmentDepth]}
                              </CardDescription>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              {/* Progress */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Gauge className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {assessment.overallLevel !== null
                                      ? `${assessment.framework.type === "C2M2" ? "MIL" : assessment.framework.type === "OWASP_SAMM" ? "Level" : "Tier"} ${assessment.overallLevel}`
                                      : "Not Assessed"}
                                  </span>
                                </div>
                                {assessment.targetLevel !== null && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Target className="h-3 w-3" />
                                    Target: {assessment.framework.type === "C2M2" ? "MIL" : assessment.framework.type === "OWASP_SAMM" ? "Level" : "Tier"} {assessment.targetLevel}
                                  </div>
                                )}
                              </div>

                              {/* Target Date */}
                              {assessment.targetDate && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  {format(new Date(assessment.targetDate), "MMM d, yyyy")}
                                </div>
                              )}

                              {/* Owner */}
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(assessment.owner.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">
                                  {assessment.owner.name}
                                </span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-32">
                              <Progress value={progress * 25} className="h-2" />
                              <span className="text-xs text-muted-foreground mt-1 block text-right">
                                {assessment._count.domainScores} domains
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}

                {/* Pagination */}
                {assessmentsData.pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      Page {page} of {assessmentsData.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= assessmentsData.pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/**
 * Loading skeleton for dashboard
 */
function DashboardSkeleton() {
  return (
    <AppLayout
      breadcrumbs={[{ label: "Maturity" }]}
    >
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
