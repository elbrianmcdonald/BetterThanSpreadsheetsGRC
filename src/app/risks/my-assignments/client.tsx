"use client";

/**
 * My Assignments Client Page
 *
 * Shows the current user's assigned risk assessments.
 * Allows assessors to view, edit, and submit their assessments.
 *
 * Features:
 * - List of DRAFT assessments assigned to current user
 * - Due date indicators with overdue highlighting
 * - Quick actions: Edit, Submit for Review
 * - Toggle to include submitted (PENDING_REVIEW) assessments
 *
 * @see Risk Assessment Assignment & Approval Workflow
 */

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, isPast, formatDistanceToNow } from "date-fns";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  FileEdit,
  Send,
  CheckCircle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { MyAssessmentTasksSection } from "@/components/risk/MyAssessmentTasksSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function MyAssignmentsClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [includeSubmitted, setIncludeSubmitted] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const utils = api.useUtils();

  // Fetch assignments
  const { data, isLoading, error } = api.risk.getMyAssignments.useQuery({
    page: 1,
    pageSize: 50,
    includeSubmitted,
  });

  // Submit for review mutation
  const submitMutation = api.risk.submitForReview.useMutation({
    onSuccess: () => {
      toast.success("Assessment submitted for review");
      setSubmitDialogOpen(false);
      setSelectedRiskId(null);
      void utils.risk.getMyAssignments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit assessment");
    },
  });

  const handleEditClick = useCallback(
    (riskId: string) => {
      router.push(`/risks/${riskId}/edit`);
    },
    [router]
  );

  const handleSubmitClick = useCallback((riskId: string) => {
    setSelectedRiskId(riskId);
    setSubmitDialogOpen(true);
  }, []);

  const confirmSubmit = useCallback(() => {
    if (selectedRiskId) {
      submitMutation.mutate({ riskId: selectedRiskId });
    }
  }, [selectedRiskId, submitMutation]);

  // Loading state - include isMounted check to prevent hydration issues
  if (!isMounted || sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.refresh()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignments = data?.risks ?? [];
  const draftCount = assignments.filter((r) => r.status === "DRAFT").length;
  const pendingCount = assignments.filter((r) => r.status === "PENDING_REVIEW").length;
  const overdueCount = assignments.filter(
    (r) => r.status === "DRAFT" && r.assessmentDueDate && isPast(new Date(r.assessmentDueDate))
  ).length;

  return (
    <AppLayout breadcrumbs={[{ label: "Risk", href: "/risks" }, { label: "My Assignments" }]}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            My Assignments
          </h1>
          <p className="text-muted-foreground mt-1">
            Risk assessments assigned to you for completion
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-submitted"
              checked={includeSubmitted}
              onCheckedChange={setIncludeSubmitted}
            />
            <Label htmlFor="show-submitted" className="text-sm">
              Show Submitted
            </Label>
          </div>
        </div>
      </div>

      {/* Assessment Tasks Section */}
      <MyAssessmentTasksSection />

      {/* Stats Cards for Risk Assessments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <FileEdit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
            <p className="text-xs text-muted-foreground">
              Assessments awaiting completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting manager review
            </p>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
            />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}>
              {overdueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Past due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Assessments</CardTitle>
          <CardDescription>
            {assignments.length === 0
              ? "No assignments found"
              : `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Assignments</h3>
              <p className="text-muted-foreground">
                You don&apos;t have any risk assessments assigned to you yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Business Unit</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const isOverdue =
                    assignment.status === "DRAFT" &&
                    assignment.assessmentDueDate &&
                    isPast(new Date(assignment.assessmentDueDate));
                  const isDraft = assignment.status === "DRAFT";

                  return (
                    <TableRow
                      key={assignment.id}
                      className={isOverdue ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{assignment.title}</span>
                          {assignment.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {assignment.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.status === "DRAFT" ? (
                          <Badge variant="secondary">Draft</Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                            Pending Review
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {assignment.AssessmentCreatedBy?.name ??
                            assignment.AssessmentCreatedBy?.email ??
                            "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {assignment.BusinessUnit ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3" />
                            {assignment.BusinessUnit.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.assessmentDueDate ? (
                          <div className="flex items-center gap-2">
                            <Clock
                              className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                            />
                            <div className="flex flex-col">
                              <span
                                className={`text-sm ${isOverdue ? "text-destructive font-medium" : ""}`}
                              >
                                {format(new Date(assignment.assessmentDueDate), "MMM d, yyyy")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {isOverdue
                                  ? `Overdue by ${formatDistanceToNow(new Date(assignment.assessmentDueDate))}`
                                  : `Due in ${formatDistanceToNow(new Date(assignment.assessmentDueDate))}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDraft && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(assignment.id)}
                              >
                                <FileEdit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSubmitClick(assignment.id)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Submit
                              </Button>
                            </>
                          )}
                          {!isDraft && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/risks/${assignment.id}`)}
                            >
                              View
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Review?</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit your assessment to your manager for review.
              Make sure you have completed all required fields before submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Review
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AppLayout>
  );
}
