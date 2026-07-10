"use client";

/**
 * Risk Assessment Projects List Content Component
 *
 * Story 1.2: Assessment List Page
 * Story 1.4: Assessment Filtering
 * Story 3.1: Backlog Tab & My Assessments Tab
 *
 * Client component that handles:
 * - Data fetching with tRPC
 * - Card-based list display
 * - Pagination
 * - URL-based filtering (status, assignee, date range, search)
 * - Tab navigation (All, My Assessments, Backlog, Due for Reassessment)
 * - Navigation to assessment workspace
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import {
  Plus,
  FileSearch,
  Calendar,
  User,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  UserCheck,
  RotateCcw,
  List,
  Loader2,
  Hand,
  UserPlus,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

import { AssessmentProjectStatus, UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { AppLayout, PageHeader } from "@/components/layout";
import { AssessmentProjectStatusBadge } from "@/components/risk-assessment-project/AssessmentProjectStatusBadge";
import {
  AssessmentFilters,
  parseFiltersFromURL,
  DEFAULT_ASSESSMENT_FILTERS,
  type AssessmentFilterState,
  AssignAssessmentDialog,
} from "@/components/risk-assessment-project";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Story 3.1: Tab configuration
type AssessmentTab = "all" | "my" | "backlog" | "reassessment";

const TAB_CONFIG: Array<{
  value: AssessmentTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { value: "all", label: "All", icon: List, description: "All assessments" },
  { value: "my", label: "My Assessments", icon: UserCheck, description: "Assigned to me" },
  { value: "backlog", label: "Backlog", icon: Inbox, description: "Unassigned assessments" },
  { value: "reassessment", label: "Due for Reassessment", icon: RotateCcw, description: "Reassessment due" },
];

export function RiskAssessmentsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const currentUserRole = session?.user?.role as UserRole | undefined;

  // Story 3.3: Check if user can assign (ORG_ADMIN or CISO)
  const canAssign = useMemo(() => {
    const allowedRoles: UserRole[] = [UserRole.ADMINISTRATOR, UserRole.MANAGER];
    return currentUserRole && allowedRoles.includes(currentUserRole);
  }, [currentUserRole]);

  // Story 3.3: Assign dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssessmentForAssign, setSelectedAssessmentForAssign] = useState<{
    id: string;
    subject: string;
    assigneeId: string | null;
  } | null>(null);

  // Story 5.3: Create Reassessment dialog state
  const [reassessDialogOpen, setReassessDialogOpen] = useState(false);
  const [selectedAssessmentForReassess, setSelectedAssessmentForReassess] = useState<{
    id: string;
    subject: string;
  } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Story 3.1: Tab state from URL
  const initialTab = (searchParams.get("tab") as AssessmentTab) || "all";
  const [activeTab, setActiveTab] = useState<AssessmentTab>(initialTab);

  // Story 1.4: Parse filters from URL for persistence
  const filters = useMemo(
    () => parseFiltersFromURL(searchParams),
    [searchParams]
  );

  // Filter state for controlled component
  const [filterState, setFilterState] = useState<AssessmentFilterState>(filters);

  // Story 3.1: Update URL when tab changes
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as AssessmentTab;
    setActiveTab(newTab);
    setPage(1); // Reset to first page when tab changes

    // Update URL with tab parameter
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    router.push(`/risk-assessments?${params.toString()}`);
  }, [searchParams, router]);

  // Sync tab state with URL on mount/navigation
  useEffect(() => {
    const urlTab = (searchParams.get("tab") as AssessmentTab) || "all";
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  // Fetch assessments with filters and tab
  const { data, isLoading, isError, error, refetch } = api.riskAssessmentProject.list.useQuery({
    page,
    limit: pageSize,
    sortBy: "dueDate",
    sortOrder: "asc",
    // Story 3.1: Pass active tab to API
    tab: activeTab === "all" ? undefined : activeTab,
    // Story 1.4: Pass filter values to API (not applicable when using specific tabs)
    status: activeTab === "all" ? (filterState.status || undefined) : undefined,
    assigneeId: activeTab === "all" ? (filterState.assigneeId === "unassigned" ? undefined : filterState.assigneeId || undefined) : undefined,
    search: filterState.search || undefined,
    dateFrom: filterState.dateFrom || undefined,
    dateTo: filterState.dateTo || undefined,
  });

  // Story 3.2: Claim assessment mutation
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimMutation = api.riskAssessmentProject.claim.useMutation({
    onSuccess: (result) => {
      toast.success("Assessment claimed successfully");
      // Navigate to the assessment workspace
      router.push(`/risk-assessments/${result.id}`);
    },
    onError: (error) => {
      // Handle race condition - another user claimed first
      if (error.data?.code === "CONFLICT") {
        toast.error("This assessment has already been claimed");
        // Refresh the list to show updated state
        void refetch();
      } else {
        toast.error(error.message || "Failed to claim assessment");
      }
      setClaimingId(null);
    },
  });

  // Story 3.2: Handle claim action
  const handleClaim = useCallback((assessmentId: string) => {
    setClaimingId(assessmentId);
    claimMutation.mutate({ id: assessmentId });
  }, [claimMutation]);

  // Story 5.3: Create Reassessment mutation
  const createReassessmentMutation = api.riskAssessmentProject.createReassessment.useMutation({
    onSuccess: (result) => {
      toast.success("Reassessment created successfully");
      setReassessDialogOpen(false);
      setSelectedAssessmentForReassess(null);
      // Navigate to the new reassessment
      router.push(`/risk-assessments/${result.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create reassessment");
    },
  });

  // Story 5.3: Handle create reassessment
  const handleCreateReassessment = useCallback(() => {
    if (selectedAssessmentForReassess) {
      createReassessmentMutation.mutate({
        parentAssessmentId: selectedAssessmentForReassess.id,
        assignToSelf: true,
      });
    }
  }, [selectedAssessmentForReassess, createReassessmentMutation]);

  // Story 5.3: Handle open reassess dialog
  const handleOpenReassessDialog = useCallback(
    (assessment: { id: string; subject: string }) => {
      setSelectedAssessmentForReassess(assessment);
      setReassessDialogOpen(true);
    },
    []
  );

  // Story 3.3: Handle open assign dialog
  const handleOpenAssignDialog = useCallback(
    (assessment: { id: string; subject: string; assigneeId: string | null }) => {
      setSelectedAssessmentForAssign(assessment);
      setAssignDialogOpen(true);
    },
    []
  );

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (data && page < data.totalPages) {
      setPage((prev) => prev + 1);
    }
  }, [data, page]);

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value));
    setPage(1); // Reset to first page when page size changes
  }, []);

  // Story 1.4: Handle filter changes - reset to page 1
  const handleFiltersChange = useCallback((newFilters: AssessmentFilterState) => {
    setFilterState(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filterState.status !== null ||
      filterState.assigneeId !== null ||
      filterState.dateFrom !== null ||
      filterState.dateTo !== null ||
      filterState.search.length > 0
    );
  }, [filterState]);

  // Check if assessment is assigned to current user and in progress
  const isMyInProgressAssessment = useCallback(
    (assessment: { assigneeId: string | null; status: AssessmentProjectStatus }) => {
      return (
        assessment.assigneeId === currentUserId &&
        assessment.status === AssessmentProjectStatus.IN_PROGRESS
      );
    },
    [currentUserId]
  );

  // Get due date styling based on urgency
  const getDueDateStyle = useCallback((dueDate: Date | string) => {
    const date = new Date(dueDate);
    const now = new Date();

    if (isPast(date)) {
      return "text-destructive font-medium";
    }

    if (isWithinInterval(date, { start: now, end: addDays(now, 7) })) {
      return "text-warning font-medium";
    }

    return "text-muted-foreground";
  }, []);

  // Story 5.2: Get reassessment due date status badge
  const getReassessmentStatus = useCallback((reassessmentDueDate: Date | string | null) => {
    if (!reassessmentDueDate) return null;

    const date = new Date(reassessmentDueDate);
    const now = new Date();

    if (isPast(date)) {
      return { label: "OVERDUE", variant: "critical" as const, isWarning: false };
    }

    // Due within 30 days
    if (isWithinInterval(date, { start: now, end: addDays(now, 30) })) {
      return { label: "Due Soon", variant: "warning" as const, isWarning: true };
    }

    return null;
  }, []);

  // Render loading skeleton
  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk Assessments" }]}>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>

          {/* Cards skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-9 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Render error state
  if (isError) {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk Assessments" }]}>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Failed to load assessments</h2>
          <p className="mt-2 text-muted-foreground">
            {error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Render empty state - distinguish between "no results" and "no data"
  if (!data?.items || data.items.length === 0) {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk Assessments" }]}>
        <div className="space-y-6">
          {/* Header */}
          <PageHeader
            eyebrow="RISK PROGRAM"
            title="Risk Assessments"
            icon={<FileSearch />}
            description="Manage risk assessment projects for your organization"
            actions={
              <Button asChild>
                <Link href="/risk-assessments/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Assessment
                </Link>
              </Button>
            }
          />

          {/* Story 3.1: Tab Navigation */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Story 1.4: Show filters even when empty - only on "all" tab */}
          {activeTab === "all" && (
            <AssessmentFilters
              filters={filterState}
              onFiltersChange={handleFiltersChange}
            />
          )}

          {/* Empty state - different message based on tab and filters */}
          <Card className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <FileSearch className="h-12 w-12 text-muted-foreground/50" />
              {activeTab === "my" ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No assigned assessments</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    You don&apos;t have any assessments assigned to you. Check the backlog
                    to claim an assessment or create a new one.
                  </p>
                </>
              ) : activeTab === "backlog" ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold">Backlog is empty</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    There are no unassigned assessments in the backlog. Create a new
                    assessment to add to the backlog.
                  </p>
                </>
              ) : activeTab === "reassessment" ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No reassessments due</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    No assessments are currently due for reassessment. Assessments will
                    appear here when their reassessment date approaches.
                  </p>
                </>
              ) : hasActiveFilters ? (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No assessments found</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    No assessments match your current filters. Try adjusting your
                    filters or create a new assessment.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => handleFiltersChange(DEFAULT_ASSESSMENT_FILTERS)}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-lg font-semibold">No assessments yet</h2>
                  <p className="mt-2 max-w-md text-muted-foreground">
                    Get started by creating your first risk assessment project to document
                    and track risks for your organization.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/risk-assessments/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create your first assessment
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Risk Assessments" }]}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="RISK PROGRAM"
          title="Risk Assessments"
          icon={<FileSearch />}
          description="Manage risk assessment projects for your organization"
          actions={
            <Button asChild>
              <Link href="/risk-assessments/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Assessment
              </Link>
            </Button>
          }
        />

        {/* Story 3.1: Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Story 1.4: Filter Panel - Only show on "all" tab */}
        {activeTab === "all" && (
          <AssessmentFilters
            filters={filterState}
            onFiltersChange={handleFiltersChange}
          />
        )}

        {/* Assessment Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((assessment) => (
            <Card
              key={assessment.id}
              className={cn(
                "transition-colors hover:border-primary/40",
                isMyInProgressAssessment(assessment) && "border-primary/50"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base font-semibold">
                    {assessment.subject}
                  </CardTitle>
                  <AssessmentProjectStatusBadge
                    status={assessment.status}
                    size="sm"
                    showIcon={false}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pb-3">
                {/* Story 5.2: Reassessment Due Date (for reassessment tab) */}
                {activeTab === "reassessment" && assessment.reassessmentDueDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className={getDueDateStyle(assessment.reassessmentDueDate)}>
                      Reassessment due {format(new Date(assessment.reassessmentDueDate), "MMM d, yyyy")}
                    </span>
                    {(() => {
                      const status = getReassessmentStatus(assessment.reassessmentDueDate);
                      if (status) {
                        return (
                          <Badge variant={status.variant} className="ml-1">
                            {status.label}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Due Date (for non-reassessment tabs or also show original due date) */}
                {activeTab !== "reassessment" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={getDueDateStyle(assessment.dueDate)}>
                      Due {format(new Date(assessment.dueDate), "MMM d, yyyy")}
                      {isPast(new Date(assessment.dueDate)) && (
                        <span className="ml-1">(Overdue)</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Original Assessment Date (for reassessment tab) */}
                {activeTab === "reassessment" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Approved {assessment.reviewedAt ? format(new Date(assessment.reviewedAt), "MMM d, yyyy") : "N/A"}
                    </span>
                  </div>
                )}

                {/* Assignee */}
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {assessment.assignee?.name || (
                      <span className="italic">Unassigned (Backlog)</span>
                    )}
                  </span>
                </div>

                {/* Risk Count */}
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {assessment.riskCount} risk{assessment.riskCount !== 1 ? "s" : ""} discovered
                  </span>
                </div>
              </CardContent>

              <CardFooter className="pt-3 flex gap-2">
                {/* Story 3.2: Show "Claim & Start" for backlog items */}
                {activeTab === "backlog" && !assessment.assigneeId ? (
                  <>
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleClaim(assessment.id)}
                      disabled={claimingId === assessment.id}
                    >
                      {claimingId === assessment.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Hand className="mr-2 h-4 w-4" />
                          Claim & Start
                        </>
                      )}
                    </Button>
                    {/* Story 3.3: Show Assign button for managers/admins */}
                    {canAssign && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleOpenAssignDialog({
                            id: assessment.id,
                            subject: assessment.subject,
                            assigneeId: assessment.assigneeId,
                          })
                        }
                        title="Assign to user"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : activeTab === "reassessment" ? (
                  /* Story 5.3: Show "Create Reassessment" for reassessment tab */
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/risk-assessments/${assessment.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      variant="default"
                      onClick={() =>
                        handleOpenReassessDialog({
                          id: assessment.id,
                          subject: assessment.subject,
                        })
                      }
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Reassessment
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={isMyInProgressAssessment(assessment) ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => router.push(`/risk-assessments/${assessment.id}`)}
                    >
                      {isMyInProgressAssessment(assessment) ? "Continue" : "View"}
                    </Button>
                    {/* Story 3.3: Show Assign button for managers/admins */}
                    {canAssign && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleOpenAssignDialog({
                            id: assessment.id,
                            subject: assessment.subject,
                            assigneeId: assessment.assigneeId,
                          })
                        }
                        title={assessment.assigneeId ? "Reassign" : "Assign to user"}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {page} of {data.totalPages} ({data.total} total)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page >= data.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Story 3.3: Assign Assessment Dialog */}
      {selectedAssessmentForAssign && (
        <AssignAssessmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          assessmentId={selectedAssessmentForAssign.id}
          assessmentSubject={selectedAssessmentForAssign.subject}
          currentAssigneeId={selectedAssessmentForAssign.assigneeId}
          onSuccess={() => setSelectedAssessmentForAssign(null)}
        />
      )}

      {/* Story 5.3: Create Reassessment Dialog */}
      <AlertDialog
        open={reassessDialogOpen}
        onOpenChange={(open) => {
          setReassessDialogOpen(open);
          if (!open) setSelectedAssessmentForReassess(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Start Reassessment
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new assessment project based on the original assessment.
              The new assessment will be assigned to you and due in 2 weeks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedAssessmentForReassess && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">Original Assessment:</p>
              <p className="font-medium">{selectedAssessmentForReassess.subject}</p>
              <p className="text-sm text-muted-foreground mt-2">New Assessment Subject:</p>
              <p className="font-medium">Reassessment of: {selectedAssessmentForReassess.subject}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateReassessment}
              disabled={createReassessmentMutation.isPending}
            >
              {createReassessmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Create Reassessment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
