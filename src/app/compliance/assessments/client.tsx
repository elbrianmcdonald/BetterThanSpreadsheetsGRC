"use client";

/**
 * Compliance Assessments Client Component
 *
 * Displays:
 * - Summary statistics (frameworks, controls, assessments)
 * - Frameworks section with cards to view or start assessments
 * - Active assessments section showing progress and compliance scores
 * - New Assessment button with framework picker → StartAssessmentDialog flow
 */

import { useState } from "react";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FrameworkCard } from "@/components/coverage/FrameworkCard";
import { AssessmentCard } from "@/components/compliance/AssessmentCard";
import { StartAssessmentDialog } from "@/components/compliance/StartAssessmentDialog";
import {
  RefreshCw,
  Loader2,
  Shield,
  CheckCircle2,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Plus,
} from "lucide-react";

export function CoverageDashboardClient() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const utils = api.useUtils();

  // Fetch frameworks with control counts
  const {
    data: coverageData,
    isLoading: isLoadingCoverage,
    refetch: refetchCoverage,
  } = api.coverage.calculateAllFrameworkCoverage.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes cache
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
    { pageSize: 50 },
    { staleTime: 2 * 60 * 1000 }
  );

  // Fetch frameworks for new assessment picker
  const { data: frameworksData } = api.framework.list.useQuery({});

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

  // Count assessments by status
  const assessments = assessmentsData?.assessments ?? [];
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
          <div className="flex items-center gap-2">
            <NewAssessmentButton
              frameworks={frameworksData}
              onCreated={handleAssessmentCreated}
            />
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
        </div>

        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
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

          <Card>
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

          <Card>
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
                      {avgScore !== null ? `${avgScore.toFixed(0)}%` : "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across {scoredAssessments.length} scored assessments
                    </p>
                  </>
                );
              })()}
            </div>
          </Card>

          <Card>
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
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="frameworks" className="space-y-6">
          <TabsList>
            <TabsTrigger value="frameworks" className="gap-2">
              <Shield className="h-4 w-4" />
              Frameworks
            </TabsTrigger>
            <TabsTrigger value="assessments" className="gap-2">
              <FileText className="h-4 w-4" />
              Assessments
              {activeAssessments.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeAssessments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Assessments Tab */}
          <TabsContent value="assessments" className="space-y-6">
            {/* Active Assessments */}
            {activeAssessments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Active Assessments
                  <Badge variant="secondary">{activeAssessments.length}</Badge>
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {activeAssessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      id={assessment.id}
                      identifier={assessment.identifier}
                      name={assessment.name}
                      status={assessment.status}
                      frameworkName={assessment.framework.name}
                      frameworkCode={assessment.framework.code}
                      businessUnitName={assessment.businessUnit?.name}
                      businessUnitCode={assessment.businessUnit?.code}
                      totalControls={assessment.totalControls}
                      notAssessedCount={assessment.notAssessedCount}
                      compliantCount={assessment.compliantCount}
                      nonCompliantCount={assessment.nonCompliantCount}
                      partialCount={assessment.partialCount}
                      complianceScore={
                        assessment.complianceScore
                          ? Number(assessment.complianceScore)
                          : null
                      }
                      ownerName={assessment.owner?.name}
                      createdAt={assessment.createdAt}
                      dueDate={assessment.dueDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Draft Assessments */}
            {draftAssessments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  Draft Assessments
                  <Badge variant="outline">{draftAssessments.length}</Badge>
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {draftAssessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      id={assessment.id}
                      identifier={assessment.identifier}
                      name={assessment.name}
                      status={assessment.status}
                      frameworkName={assessment.framework.name}
                      frameworkCode={assessment.framework.code}
                      businessUnitName={assessment.businessUnit?.name}
                      businessUnitCode={assessment.businessUnit?.code}
                      totalControls={assessment.totalControls}
                      notAssessedCount={assessment.notAssessedCount}
                      compliantCount={assessment.compliantCount}
                      nonCompliantCount={assessment.nonCompliantCount}
                      partialCount={assessment.partialCount}
                      complianceScore={
                        assessment.complianceScore
                          ? Number(assessment.complianceScore)
                          : null
                      }
                      ownerName={assessment.owner?.name}
                      createdAt={assessment.createdAt}
                      dueDate={assessment.dueDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Assessments */}
            {completedAssessments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Completed Assessments
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {completedAssessments.length}
                  </Badge>
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {completedAssessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      id={assessment.id}
                      identifier={assessment.identifier}
                      name={assessment.name}
                      status={assessment.status}
                      frameworkName={assessment.framework.name}
                      frameworkCode={assessment.framework.code}
                      businessUnitName={assessment.businessUnit?.name}
                      businessUnitCode={assessment.businessUnit?.code}
                      totalControls={assessment.totalControls}
                      notAssessedCount={assessment.notAssessedCount}
                      compliantCount={assessment.compliantCount}
                      nonCompliantCount={assessment.nonCompliantCount}
                      partialCount={assessment.partialCount}
                      complianceScore={
                        assessment.complianceScore
                          ? Number(assessment.complianceScore)
                          : null
                      }
                      ownerName={assessment.owner?.name}
                      createdAt={assessment.createdAt}
                      dueDate={assessment.dueDate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {assessments.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium">No Assessments Yet</h3>
                  <p className="mt-2 text-gray-500">
                    Start a compliance assessment from one of your active frameworks.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const frameworksTab = document.querySelector('[value="frameworks"]');
                      if (frameworksTab instanceof HTMLElement) {
                        frameworksTab.click();
                      }
                    }}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    View Frameworks
                  </Button>
                </CardContent>
              </Card>
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

/**
 * New Assessment Button with framework picker dialog
 *
 * Lets user select a framework, then opens StartAssessmentDialog to create the assessment.
 */
function NewAssessmentButton({
  frameworks,
  onCreated,
}: {
  frameworks?: Array<{ id: string; name: string; code: string }>;
  onCreated?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  // If a framework is selected, render the StartAssessmentDialog
  if (selectedFramework) {
    return (
      <StartAssessmentDialog
        frameworkId={selectedFramework.id}
        frameworkName={selectedFramework.name}
        frameworkCode={selectedFramework.code}
        defaultOpen
        trigger={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        }
        onSuccess={() => {
          setSelectedFramework(null);
          onCreated?.();
        }}
        onCancel={() => setSelectedFramework(null)}
      />
    );
  }

  return (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Framework</DialogTitle>
          <DialogDescription>
            Choose a framework to assess. You&apos;ll configure assessment details in the next step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {!frameworks || frameworks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No frameworks available. Activate a framework first in{" "}
              <Link href="/admin/frameworks" className="underline">
                Administration
              </Link>
              .
            </p>
          ) : (
            frameworks.map((fw) => (
              <Button
                key={fw.id}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setPickerOpen(false);
                  setSelectedFramework(fw);
                }}
              >
                <Shield className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{fw.code}</div>
                  <div className="text-xs text-muted-foreground">{fw.name}</div>
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
