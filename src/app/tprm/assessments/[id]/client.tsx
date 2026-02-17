"use client";

/**
 * Assessment Detail Client Component
 *
 * Epic 3: Assessment Workflow
 * Story 3.6: Assessment History View (FR24)
 * Story 3.7: IT Stakeholder Assessment Access (FR25, FR26)
 *
 * Displays assessment details, status workflow, scoring, and comments.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardCheck,
  Building2,
  Calendar,
  User,
  FileText,
  MessageSquare,
  Send,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileQuestion,
  Plus,
  Trash2,
  Mail,
  Eye,
  Clock,
} from "lucide-react";

import {
  UserRole,
  VendorAssessmentStatus,
  VendorAssessmentRecommendation,
  QuestionnaireStatus,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { useHasRole } from "@/hooks/useHasRole";
import toast from "react-hot-toast";
import {
  AssessmentStatusBadge,
  AssessmentRecommendationBadge,
} from "@/components/assessment";
import { VendorRiskTierBadge } from "@/components/vendor";

/**
 * Roles that can manage assessments
 */
const ASSESSMENT_MANAGE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
];

/**
 * Roles that can complete assessments
 */
const ASSESSMENT_COMPLETE_ROLES = [
  UserRole.ORG_ADMIN,
  UserRole.GRC_ANALYST,
];

interface AssessmentDetailClientProps {
  assessmentId: string;
}

export function AssessmentDetailClient({ assessmentId }: AssessmentDetailClientProps) {
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Questionnaire state
  const [addQuestionnaireOpen, setAddQuestionnaireOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingQuestionnaireId, setSendingQuestionnaireId] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  // Role checks
  const canManageAssessments = useHasRole(ASSESSMENT_MANAGE_ROLES);
  const canCompleteAssessments = useHasRole(ASSESSMENT_COMPLETE_ROLES);

  // Fetch assessment
  const { data: assessment, isLoading, error, refetch } = api.vendorAssessment.getById.useQuery(
    { id: assessmentId },
    { retry: false }
  );

  // Mutations
  const updateStatusMutation = api.vendorAssessment.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const addCommentMutation = api.vendorAssessment.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment added");
      setNewComment("");
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // Questionnaire queries and mutations
  const { data: questionnaires, refetch: refetchQuestionnaires } = api.questionnaire.getQuestionnairesForAssessment.useQuery(
    { assessmentId },
    { enabled: !!assessment }
  );

  const { data: templates } = api.questionnaire.listTemplates.useQuery({
    includeSystem: true,
    includeCustom: true,
    isActive: true,
  });

  const attachQuestionnaireMutation = api.questionnaire.attachToAssessment.useMutation({
    onSuccess: () => {
      toast.success("Questionnaire added");
      setAddQuestionnaireOpen(false);
      setSelectedTemplateId(null);
      void refetchQuestionnaires();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add questionnaire");
    },
  });

  const detachQuestionnaireMutation = api.questionnaire.detachFromAssessment.useMutation({
    onSuccess: () => {
      toast.success("Questionnaire removed");
      void refetchQuestionnaires();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove questionnaire");
    },
  });

  const sendQuestionnaireMutation = api.questionnaire.sendQuestionnaire.useMutation({
    onSuccess: () => {
      toast.success("Questionnaire sent to vendor");
      setSendDialogOpen(false);
      setSendingQuestionnaireId(null);
      setRecipientEmail("");
      void refetchQuestionnaires();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send questionnaire");
    },
  });

  const handleStatusChange = async (newStatus: VendorAssessmentStatus) => {
    await updateStatusMutation.mutateAsync({ id: assessmentId, status: newStatus });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addCommentMutation.mutateAsync({
        assessmentId,
        content: newComment.trim(),
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAttachQuestionnaire = async () => {
    if (!selectedTemplateId) return;
    await attachQuestionnaireMutation.mutateAsync({
      assessmentId,
      templateId: selectedTemplateId,
    });
  };

  const handleSendQuestionnaire = async () => {
    if (!sendingQuestionnaireId || !recipientEmail.trim()) return;
    await sendQuestionnaireMutation.mutateAsync({
      questionnaireId: sendingQuestionnaireId,
      recipientEmail: recipientEmail.trim(),
    });
  };

  const openSendDialog = (questionnaireId: string, defaultEmail?: string) => {
    setSendingQuestionnaireId(questionnaireId);
    setRecipientEmail(defaultEmail || "");
    setSendDialogOpen(true);
  };

  // Valid status transitions
  const getNextStatus = (current: VendorAssessmentStatus): VendorAssessmentStatus | null => {
    switch (current) {
      case VendorAssessmentStatus.DRAFT:
        return VendorAssessmentStatus.IN_PROGRESS;
      case VendorAssessmentStatus.IN_PROGRESS:
        return VendorAssessmentStatus.IN_REVIEW;
      case VendorAssessmentStatus.IN_REVIEW:
        return VendorAssessmentStatus.COMPLETED;
      default:
        return null;
    }
  };

  const getStatusActionLabel = (current: VendorAssessmentStatus): string => {
    switch (current) {
      case VendorAssessmentStatus.DRAFT:
        return "Start Assessment";
      case VendorAssessmentStatus.IN_PROGRESS:
        return "Submit for Review";
      case VendorAssessmentStatus.IN_REVIEW:
        return "Complete Assessment";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold">Assessment not found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "The assessment you're looking for doesn't exist or you don't have access."}
          </p>
          <Link href="/tprm/assessments">
            <Button className="mt-4" variant="outline">
              Back to Assessments
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const nextStatus = getNextStatus(assessment.status);
  const isOverdue = assessment.dueDate &&
    assessment.status !== VendorAssessmentStatus.COMPLETED &&
    new Date(assessment.dueDate) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <ClipboardCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{assessment.title}</h1>
              <AssessmentStatusBadge status={assessment.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {assessment.identifier}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageAssessments && assessment.status !== VendorAssessmentStatus.COMPLETED && (
            <Link href={`/tprm/assessments/${assessmentId}/edit`}>
              <Button variant="outline">Edit Assessment</Button>
            </Link>
          )}
          {nextStatus && canManageAssessments && (
            nextStatus === VendorAssessmentStatus.COMPLETED && !canCompleteAssessments ? null : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {getStatusActionLabel(assessment.status)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to change the status from{" "}
                      <strong>{assessment.status.replace(/_/g, " ")}</strong> to{" "}
                      <strong>{nextStatus.replace(/_/g, " ")}</strong>?
                      {nextStatus === VendorAssessmentStatus.COMPLETED && (
                        <span className="block mt-2 text-destructive">
                          This action cannot be undone. The assessment will be marked as final.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleStatusChange(nextStatus)}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          )}
        </div>
      </div>

      {/* Overdue Warning */}
      {isOverdue && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Assessment Overdue</p>
              <p className="text-sm text-muted-foreground">
                This assessment was due {formatDistanceToNow(new Date(assessment.dueDate!))} ago.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vendor Info */}
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Vendor</p>
                  <Link
                    href={`/vendors/${assessment.vendor.id}`}
                    className="text-primary hover:underline"
                  >
                    {assessment.vendor.name}
                  </Link>
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({assessment.vendor.identifier})
                  </span>
                  {assessment.vendor.riskTier && (
                    <div className="mt-1">
                      <VendorRiskTierBadge tier={assessment.vendor.riskTier as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Assessor */}
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Assessor</p>
                  <p className="text-sm">
                    {assessment.assessor
                      ? assessment.assessor.name || assessment.assessor.email
                      : "Unassigned"}
                  </p>
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className={`text-sm ${isOverdue ? "text-destructive" : ""}`}>
                    {assessment.dueDate
                      ? format(new Date(assessment.dueDate), "PPP")
                      : "No due date set"}
                  </p>
                </div>
              </div>

              {/* Summary */}
              {assessment.summary && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Summary</p>
                      <p className="text-sm whitespace-pre-wrap">{assessment.summary}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Questionnaires Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileQuestion className="h-5 w-5" />
                    Questionnaires
                    <Badge variant="secondary" className="ml-2">
                      {questionnaires?.length || 0}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Gather information from the vendor
                  </CardDescription>
                </div>
                {canManageAssessments &&
                 assessment.status !== VendorAssessmentStatus.COMPLETED && (
                  <Button
                    variant="outline"
                    onClick={() => setAddQuestionnaireOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Questionnaire
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!questionnaires || questionnaires.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileQuestion className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2">No questionnaires attached</p>
                  {canManageAssessments &&
                   assessment.status !== VendorAssessmentStatus.COMPLETED && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setAddQuestionnaireOpen(true)}
                    >
                      Add a questionnaire to gather vendor information
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {questionnaires.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{q.template.name}</p>
                          <QuestionnaireStatusBadge status={q.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {q.responseCount} responses
                          {q.scoredCount > 0 && ` (${q.scoredCount} scored)`}
                          {q.sentAt && (
                            <span className="ml-2">
                              • Sent to {q.recipientEmail}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.status === QuestionnaireStatus.DRAFT && canManageAssessments && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSendDialog(q.id)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Send
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => detachQuestionnaireMutation.mutate({ questionnaireId: q.id })}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {q.status === QuestionnaireStatus.COMPLETED && (
                          <Link href={`/tprm/questionnaires/responses/${q.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2 h-4 w-4" />
                              View Responses
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
                <Badge variant="secondary" className="ml-2">
                  {assessment.comments.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Discussion and stakeholder feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Add Comment
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Comments List */}
              {assessment.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              ) : (
                <div className="space-y-4">
                  {assessment.comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">
                          {comment.author.name || comment.author.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Scoring & Recommendation */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Risk Score */}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
                {assessment.riskScore !== null ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold">
                      {assessment.riskScore}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Not scored</p>
                )}
              </div>

              <Separator />

              {/* Recommendation */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Recommendation</p>
                <AssessmentRecommendationBadge recommendation={assessment.recommendation} />
              </div>

              {/* Conditions */}
              {assessment.conditions && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Conditions</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{assessment.conditions}</p>
                  </div>
                </>
              )}

              {/* Rejection Reason */}
              {assessment.rejectionReason && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rejection Reason</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap text-destructive">
                      {assessment.rejectionReason}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Completion Info */}
          {assessment.status === VendorAssessmentStatus.COMPLETED && assessment.completedAt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed On</p>
                  <p className="text-sm">
                    {format(new Date(assessment.completedAt), "PPP 'at' p")}
                  </p>
                </div>
                {assessment.completedBy && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed By</p>
                    <p className="text-sm">{assessment.completedBy.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(assessment.createdAt), "PP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{format(new Date(assessment.updatedAt), "PP")}</span>
              </div>
              {assessment.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span>{assessment.createdBy.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Questionnaire Dialog */}
      <Dialog open={addQuestionnaireOpen} onOpenChange={setAddQuestionnaireOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Questionnaire</DialogTitle>
            <DialogDescription>
              Select a questionnaire template to attach to this assessment
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedTemplateId || undefined}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      {t.isSystemTemplate && (
                        <Badge variant="secondary" className="text-xs">System</Badge>
                      )}
                      {t.name}
                      <span className="text-muted-foreground text-xs ml-2">
                        ({t.questionCount} questions)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddQuestionnaireOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAttachQuestionnaire}
              disabled={!selectedTemplateId || attachQuestionnaireMutation.isPending}
            >
              {attachQuestionnaireMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Questionnaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Questionnaire Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Questionnaire</DialogTitle>
            <DialogDescription>
              Send this questionnaire to the vendor contact for completion
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Recipient Email</label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A secure link will be sent to this email address
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendQuestionnaire}
              disabled={!recipientEmail.trim() || sendQuestionnaireMutation.isPending}
            >
              {sendQuestionnaireMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Mail className="mr-2 h-4 w-4" />
              Send to Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Questionnaire Status Badge Component
 */
function QuestionnaireStatusBadge({ status }: { status: QuestionnaireStatus }) {
  const config: Record<QuestionnaireStatus, { label: string; className: string; icon: React.ReactNode }> = {
    DRAFT: {
      label: "Draft",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
      icon: <FileText className="h-3 w-3" />,
    },
    SENT: {
      label: "Sent",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      icon: <Mail className="h-3 w-3" />,
    },
    VIEWED: {
      label: "Viewed",
      className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
      icon: <Eye className="h-3 w-3" />,
    },
    IN_PROGRESS: {
      label: "In Progress",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      icon: <Clock className="h-3 w-3" />,
    },
    COMPLETED: {
      label: "Completed",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    VOIDED: {
      label: "Voided",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };

  const { label, className, icon } = config[status];

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}
