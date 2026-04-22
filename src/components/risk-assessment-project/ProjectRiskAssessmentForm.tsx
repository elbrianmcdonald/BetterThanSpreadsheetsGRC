"use client";

/**
 * Project Risk Assessment Form Component
 *
 * Form for creating/editing risks within a Risk Assessment Project context.
 * Replaces the workspace view with a unified form-based experience.
 *
 * Features:
 * - Project header info (subject, description, due date, status)
 * - Uses project's risk matrix for all risk scoring
 * - Multiple risk items with MITRE ATT&CK integration
 * - Inherent and residual severity calculations
 * - Controls documentation and linkage
 * - Treatment selection (Accept/Remediate) with SLA
 * - Submit/Rescind/Approve/Reject workflow
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Shield,
  ClipboardList,
  ArrowLeft,
  Send,
  Undo2,
  XCircle,
  Save,
  Calendar,
  User,
  FileText,
} from "lucide-react";
import { AssessmentProjectStatus, RiskDiscoveryStatus, UserRole } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

import { AssessmentProjectStatusBadge } from "./AssessmentProjectStatusBadge";
import { RiskItemCard } from "@/components/risk/RiskItemCard";
import { PersonPicker } from "@/components/person/PersonPicker";
import type { MatrixScales, Threshold } from "@/lib/matrix";

// ============================================================================
// Type Extensions for tRPC Response
// ============================================================================

/**
 * Extended project type that includes the discoveredRisks relation.
 * TypeScript can't always infer the full Prisma include type through tRPC,
 * so we define this explicitly.
 */
interface DiscoveredRisk {
  id: string;
  title: string | null;
  description: string | null;
  severity: string | null;
  discoveryStatus: string | null;
  affectedSystems: string | null;
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentExposure: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualExposure: number | null;
  inherentScore: number | null;
  residualScore: number | null;
  initialAccessVectorId: string | null;
  InitialAccessVector?: { id: string; name: string } | null;
  ThreatSteps?: Array<{ id: string; techniqueId: string; technique: { id: string; name: string } }>;
  ThreatObjectives?: Array<{ id: string; techniqueId: string; technique: { id: string; name: string } }>;
  ControlLinks?: Array<{
    id: string;
    controlId: string;
    linkType: string;
    control: {
      id: string;
      controlId: string;
      title: string;
      Framework: { id: string; code: string; name: string };
    };
  }>;
  Treatments?: Array<{
    id: string;
    treatmentType: string;
    dueDate: Date | string | null;
    completedAt: Date | string | null;
    detail: string | null;
  }>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ProjectWithRisks {
  id: string;
  subject: string;
  description: string | null;
  status: AssessmentProjectStatus;
  dueDate: Date | string;
  matrixVersionId: string | null;
  assigneeId: string | null;
  riskOwnerId: string | null;
  rejectionNotes: string | null;
  reviewedAt: Date | string | null;
  reassessmentDueDate: Date | string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  reviewer: { id: string; name: string | null; email: string } | null;
  riskOwner: { id: string; name: string; email: string | null; jobTitle: string | null } | null;
  matrixVersion: {
    id: string;
    template: { id: string; name: string } | null;
  } | null;
  discoveredRisks: DiscoveredRisk[];
}

// ============================================================================
// Form Schema
// ============================================================================

const riskItemSchema = z.object({
  id: z.string(), // Client-side ID for tracking, or database ID for existing risks
  riskStatement: z.string().min(10, "Risk statement must be at least 10 characters"),
  // MITRE ATT&CK
  initialAccessVectorId: z.string().nullable().optional(),
  threatStepIds: z.array(z.string()),
  threatObjectiveIds: z.array(z.string()),
  // Controls - IDs of linked controls
  mitigatingControlIds: z.array(z.string()),
  controlGapIds: z.array(z.string()),
  // Inherent severity
  inherentLikelihood: z.number().nullable().optional(),
  inherentImpact: z.number().nullable().optional(),
  inherentExposure: z.number().nullable().optional(),
  // Residual severity
  residualLikelihood: z.number().nullable().optional(),
  residualImpact: z.number().nullable().optional(),
  residualExposure: z.number().nullable().optional(),
  // Treatment
  treatment: z.enum(["ACCEPT", "REMEDIATE"]).nullable().optional(),
  treatmentDueDate: z.date().nullable().optional(),
  treatmentPlan: z.string().nullable().optional(),
  // Evidence (file IDs after upload)
  evidenceIds: z.array(z.string()),
  // Track if this is an existing risk or new
  isExisting: z.boolean().optional(),
  dbId: z.string().optional(), // The actual database ID for existing risks
});

type RiskItemValues = z.infer<typeof riskItemSchema>;

const projectFormSchema = z.object({
  risks: z.array(riskItemSchema),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ============================================================================
// Component
// ============================================================================

interface ProjectRiskAssessmentFormProps {
  projectId: string;
}

export function ProjectRiskAssessmentForm({ projectId }: ProjectRiskAssessmentFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const currentUserRole = session?.user?.role as UserRole | undefined;
  const utils = api.useUtils();

  const [expandedRiskIndex, setExpandedRiskIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showRescindDialog, setShowRescindDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");

  // Editable details state
  const [editableDescription, setEditableDescription] = useState("");
  const [editableRiskOwnerId, setEditableRiskOwnerId] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  // Manager roles that can approve/reject
  const MANAGER_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.CISO];
  const isManager = currentUserRole ? MANAGER_ROLES.includes(currentUserRole) : false;

  // ============================================================================
  // Data Fetching
  // ============================================================================

  // Fetch project details with risks
  // Note: Type assertion needed because tRPC can't infer complex Prisma includes
  const {
    data: projectData,
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
  } = api.riskAssessmentProject.getById.useQuery({ id: projectId });

  // Cast to our explicit type that includes discoveredRisks
  const project = projectData as ProjectWithRisks | undefined;

  // Fetch matrix version details for the project's matrix
  const { data: matrixVersion } = api.riskMatrix.getVersion.useQuery(
    { id: project?.matrixVersionId ?? "" },
    { enabled: !!project?.matrixVersionId }
  );

  // Parse matrix scales and thresholds
  const matrixScales = useMemo<MatrixScales | null>(() => {
    if (!matrixVersion?.scales) return null;
    return matrixVersion.scales as MatrixScales;
  }, [matrixVersion]);

  const matrixThresholds = useMemo<Threshold[]>(() => {
    if (!matrixVersion?.thresholds) return [];
    return matrixVersion.thresholds as Threshold[];
  }, [matrixVersion]);

  const is3DMatrix = useMemo(() => {
    return !!matrixScales?.exposure && matrixScales.exposure.length > 0;
  }, [matrixScales]);

  // ============================================================================
  // Form Setup
  // ============================================================================

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      risks: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "risks",
  });

  // Initialize editable details when project loads
  useEffect(() => {
    if (project) {
      setEditableDescription(project.description ?? "");
      setEditableRiskOwnerId(project.riskOwnerId ?? null);
    }
  }, [project]);

  // Populate form when project data loads
  useEffect(() => {
    if (project?.discoveredRisks && project.discoveredRisks.length > 0) {
      const existingRisks: RiskItemValues[] = project.discoveredRisks.map((risk) => {
        // Get the most recent treatment if exists
        const latestTreatment = risk.Treatments?.[0];
        const treatmentType = latestTreatment?.treatmentType;
        // Extract control IDs by link type
        const mitigatingControlIds = risk.ControlLinks
          ?.filter(link => link.linkType === "MITIGATING")
          .map(link => link.control.id) ?? [];
        const controlGapIds = risk.ControlLinks
          ?.filter(link => link.linkType === "GAP")
          .map(link => link.control.id) ?? [];
        return {
          id: risk.id,
          dbId: risk.id,
          isExisting: true,
          riskStatement: risk.title || "",
          initialAccessVectorId: risk.initialAccessVectorId ?? null,
          threatStepIds: risk.ThreatSteps?.map(ts => ts.techniqueId) ?? [],
          threatObjectiveIds: risk.ThreatObjectives?.map(to => to.techniqueId) ?? [],
          mitigatingControlIds,
          controlGapIds,
          inherentLikelihood: risk.inherentLikelihood ?? null,
          inherentImpact: risk.inherentImpact ?? null,
          inherentExposure: risk.inherentExposure ?? null,
          residualLikelihood: risk.residualLikelihood ?? null,
          residualImpact: risk.residualImpact ?? null,
          residualExposure: risk.residualExposure ?? null,
          treatment: (treatmentType === "ACCEPT" || treatmentType === "REMEDIATE") ? treatmentType : null,
          treatmentDueDate: latestTreatment?.dueDate ? new Date(latestTreatment.dueDate) : null,
          treatmentPlan: latestTreatment?.detail ?? null,
          evidenceIds: [],
        };
      });
      replace(existingRisks);
    } else if (project && (!project.discoveredRisks || project.discoveredRisks.length === 0)) {
      // Add empty risk if no risks exist
      replace([createEmptyRiskItem()]);
    }
  }, [project, replace]);

  // ============================================================================
  // Permissions
  // ============================================================================

  const isAssignee = useMemo(() => {
    return project?.assigneeId === currentUserId;
  }, [project?.assigneeId, currentUserId]);

  const isEditable = useMemo(() => {
    return project?.status === AssessmentProjectStatus.IN_PROGRESS && isAssignee;
  }, [project?.status, isAssignee]);

  const canSubmit = useMemo(() => {
    return (
      project?.status === AssessmentProjectStatus.IN_PROGRESS &&
      isAssignee &&
      fields.length > 0
    );
  }, [project?.status, isAssignee, fields.length]);

  const canRescind = useMemo(() => {
    return project?.status === AssessmentProjectStatus.SUBMITTED && isAssignee;
  }, [project?.status, isAssignee]);

  const canApprove = useMemo(() => {
    return project?.status === AssessmentProjectStatus.SUBMITTED && isManager;
  }, [project?.status, isManager]);

  // ============================================================================
  // Mutations
  // ============================================================================

  const createRiskMutation = api.risk.create.useMutation();
  const updateRiskMutation = api.risk.updateRisk.useMutation();
  const createTreatmentMutation = api.risk.createTreatment.useMutation();
  const bulkLinkControlsMutation = api.controlLink.bulkLinkRiskToControls.useMutation();

  const submitMutation = api.riskAssessmentProject.submit.useMutation({
    onSuccess: () => {
      toast.success("Assessment submitted for review");
      setShowSubmitDialog(false);
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit assessment");
    },
  });

  const rescindMutation = api.riskAssessmentProject.rescindSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission rescinded. You can now make changes.");
      setShowRescindDialog(false);
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to rescind submission");
    },
  });

  const approveMutation = api.riskAssessmentProject.approve.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Assessment approved! ${data.riskCount} risk${data.riskCount !== 1 ? "s" : ""} published to the register.`
      );
      setShowApproveDialog(false);
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
      void utils.riskAssessmentProject.getPendingApprovalCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve assessment");
    },
  });

  const rejectMutation = api.riskAssessmentProject.reject.useMutation({
    onSuccess: () => {
      toast.success("Assessment rejected and returned to analyst for revision.");
      setShowRejectDialog(false);
      setRejectionNotes("");
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
      void utils.riskAssessmentProject.getPendingApprovalCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject assessment");
    },
  });

  const updateDetailsMutation = api.riskAssessmentProject.updateDetails.useMutation({
    onSuccess: () => {
      toast.success("Assessment details updated");
      setIsEditingDetails(false);
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update details");
    },
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  function createEmptyRiskItem(): RiskItemValues {
    return {
      id: crypto.randomUUID(),
      riskStatement: "",
      initialAccessVectorId: null,
      threatStepIds: [],
      threatObjectiveIds: [],
      mitigatingControlIds: [],
      controlGapIds: [],
      inherentLikelihood: null,
      inherentImpact: null,
      inherentExposure: null,
      residualLikelihood: null,
      residualImpact: null,
      residualExposure: null,
      treatment: null,
      treatmentDueDate: null,
      treatmentPlan: null,
      evidenceIds: [],
      isExisting: false,
    };
  }

  const handleAddRisk = useCallback(() => {
    const newRisk = createEmptyRiskItem();
    append(newRisk);
    setExpandedRiskIndex(fields.length);
  }, [append, fields.length]);

  const handleRemoveRisk = useCallback(
    (index: number) => {
      if (fields.length <= 1) {
        toast.error("At least one risk must be identified");
        return;
      }
      remove(index);
      if (expandedRiskIndex >= index && expandedRiskIndex > 0) {
        setExpandedRiskIndex(expandedRiskIndex - 1);
      }
    },
    [remove, fields.length, expandedRiskIndex]
  );

  const toggleRiskExpanded = useCallback((index: number) => {
    setExpandedRiskIndex((prev) => (prev === index ? -1 : index));
  }, []);

  // Save all risks
  const handleSaveRisks = async () => {
    if (!isEditable) return;

    const values = form.getValues();
    const validRisks = values.risks.filter((r) => r.riskStatement.trim().length >= 10);

    if (validRisks.length === 0) {
      toast.error("At least one risk with a valid statement is required");
      return;
    }

    setIsSaving(true);

    try {
      for (const risk of validRisks) {
        let riskId: string | undefined;

        if (risk.isExisting && risk.dbId) {
          // Update existing risk
          await updateRiskMutation.mutateAsync({
            riskId: risk.dbId,
            title: risk.riskStatement,
          });
          riskId = risk.dbId;
        } else {
          // Create new risk
          const newRisk = await createRiskMutation.mutateAsync({
            title: risk.riskStatement,
            description: risk.riskStatement,
            severity: "MEDIUM",
            discoveryProjectId: projectId,
          });
          riskId = newRisk.id;
        }

        // Link mitigating controls to the risk
        if (riskId && risk.mitigatingControlIds?.length > 0) {
          await bulkLinkControlsMutation.mutateAsync({
            riskId,
            controlIds: risk.mitigatingControlIds,
            linkType: "MITIGATING",
          });
        }

        // Link control gaps to the risk
        if (riskId && risk.controlGapIds?.length > 0) {
          await bulkLinkControlsMutation.mutateAsync({
            riskId,
            controlIds: risk.controlGapIds,
            linkType: "GAP",
          });
        }

        // Save treatment data if a treatment decision has been made
        if (riskId && risk.treatment) {
          // Calculate SLA days from due date if provided
          let slaDays: number | undefined;
          if (risk.treatmentDueDate) {
            const now = new Date();
            const diffTime = risk.treatmentDueDate.getTime() - now.getTime();
            slaDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          }

          await createTreatmentMutation.mutateAsync({
            riskId,
            treatmentType: risk.treatment,
            justification: risk.treatmentPlan || `Risk ${risk.treatment.toLowerCase()}ed as part of assessment`,
            slaDays,
            detail: risk.treatmentPlan ?? null,
            residualLikelihood: risk.residualLikelihood ?? undefined,
            residualImpact: risk.residualImpact ?? undefined,
            residualExposure: risk.residualExposure ?? undefined,
          });
        }
      }

      toast.success("Risks saved successfully");
      void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
    } catch (error) {
      toast.error("Failed to save risks");
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = useCallback(() => {
    submitMutation.mutate({ id: projectId });
  }, [submitMutation, projectId]);

  const handleRescind = useCallback(() => {
    rescindMutation.mutate({ id: projectId });
  }, [rescindMutation, projectId]);

  const handleApprove = useCallback(() => {
    approveMutation.mutate({ id: projectId });
  }, [approveMutation, projectId]);

  const handleReject = useCallback(() => {
    if (rejectionNotes.length < 20) {
      toast.error("Rejection notes must be at least 20 characters");
      return;
    }
    rejectMutation.mutate({ id: projectId, rejectionNotes });
  }, [rejectMutation, projectId, rejectionNotes]);

  const handleSaveDetails = useCallback(() => {
    updateDetailsMutation.mutate({
      id: projectId,
      description: editableDescription || null,
      riskOwnerId: editableRiskOwnerId,
    });
  }, [updateDetailsMutation, projectId, editableDescription, editableRiskOwnerId]);

  const hasDetailsChanged = useMemo(() => {
    if (!project) return false;
    return (
      editableDescription !== (project.description ?? "") ||
      editableRiskOwnerId !== (project.riskOwnerId ?? null)
    );
  }, [project, editableDescription, editableRiskOwnerId]);

  // Due date styling
  const getDueDateStyle = useCallback((dueDate: Date | string) => {
    const date = new Date(dueDate);
    const now = new Date();

    if (isPast(date)) {
      return "text-red-600 font-medium";
    }

    if (isWithinInterval(date, { start: now, end: addDays(now, 7) })) {
      return "text-amber-600 font-medium";
    }

    return "text-muted-foreground";
  }, []);

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoadingProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-96" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (isProjectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">Assessment not found</h2>
        <p className="mt-2 text-muted-foreground">
          {projectError?.message || "The assessment could not be found or you don't have access."}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/risk-assessments")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assessments
        </Button>
      </div>
    );
  }

  // ============================================================================
  // Render: Main Form
  // ============================================================================

  const riskCount = fields.length;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/risk-assessments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assessments
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{project.subject}</h1>
          </div>
          {!isAssignee && project.status === AssessmentProjectStatus.IN_PROGRESS && (
            <p className="text-sm text-muted-foreground">
              <Shield className="mr-1 inline h-4 w-4" />
              View-only mode — you are not the assigned analyst
            </p>
          )}
        </div>
        <AssessmentProjectStatusBadge status={project.status} size="lg" />
      </div>

      {/* Assessment Description & Risk Owner */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assessment Details</CardTitle>
          <CardDescription>
            Description and ownership information for this risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            {isEditable ? (
              <Textarea
                id="description"
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                placeholder="Describe the scope and objectives of this assessment..."
                className="min-h-[80px]"
                maxLength={5000}
              />
            ) : (
              <p className="text-sm text-muted-foreground min-h-[40px]">
                {project.description || (
                  <span className="italic">No description provided</span>
                )}
              </p>
            )}
          </div>

          {/* Risk Owner Field */}
          <div className="space-y-2">
            <Label>Risk Owner</Label>
            {isEditable ? (
              <PersonPicker
                value={editableRiskOwnerId}
                onChange={(value) => setEditableRiskOwnerId(value)}
                placeholder="Select risk owner..."
              />
            ) : (
              <p className="text-sm">
                {project.riskOwner ? (
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {project.riskOwner.name}
                    {project.riskOwner.jobTitle && (
                      <span className="text-muted-foreground">
                        ({project.riskOwner.jobTitle})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">No risk owner assigned</span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Person accountable for risks identified in this assessment
            </p>
          </div>

          {/* Save Details Button */}
          {isEditable && hasDetailsChanged && (
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDetails}
                disabled={updateDetailsMutation.isPending}
              >
                {updateDetailsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Details
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Details Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Due Date */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className={getDueDateStyle(project.dueDate)}>
                  {format(new Date(project.dueDate), "MMM d, yyyy")}
                  {isPast(new Date(project.dueDate)) && " (Overdue)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignee */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="font-medium">
                  {project.assignee?.name || (
                    <span className="italic text-muted-foreground">Unassigned</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Matrix */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Risk Matrix</p>
                <p className="font-medium">
                  {matrixVersion?.template?.name || (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Count */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Discovered Risks</p>
                <p className="text-2xl font-bold">{riskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection Notes (if any) */}
      {project.rejectionNotes && project.status === AssessmentProjectStatus.IN_PROGRESS && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              Reviewer Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-900">{project.rejectionNotes}</p>
            {project.reviewer && (
              <p className="mt-2 text-sm text-amber-700">
                From {project.reviewer.name} on{" "}
                {project.reviewedAt
                  ? format(new Date(project.reviewedAt), "MMM d, yyyy 'at' h:mm a")
                  : "Unknown date"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk Form */}
      <Form {...form}>
        <form className="space-y-6">
          {/* Identified Risks Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Identified Risks ({riskCount})
                </CardTitle>
                <CardDescription>
                  Document risks discovered during your assessment
                </CardDescription>
              </div>
              {isEditable && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddRisk}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Risk
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No risks identified yet.</p>
                  {isEditable && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleAddRisk}
                      className="mt-2"
                    >
                      Add your first risk
                    </Button>
                  )}
                </div>
              )}

              {fields.map((field, index) => (
                <RiskItemCard
                  key={field.id}
                  index={index}
                  control={form.control}
                  isExpanded={expandedRiskIndex === index}
                  onToggle={() => toggleRiskExpanded(index)}
                  onRemove={() => handleRemoveRisk(index)}
                  canRemove={fields.length > 1 && isEditable}
                  matrixScales={matrixScales}
                  matrixThresholds={matrixThresholds}
                  is3DMatrix={is3DMatrix}
                />
              ))}

              {form.formState.errors.risks?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.risks.message}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {project.status === AssessmentProjectStatus.IN_PROGRESS && isAssignee && (
            <div className="flex justify-end gap-3 border-t pt-6">
              <Button type="button" variant="outline" asChild>
                <Link href="/risk-assessments">Cancel</Link>
              </Button>
              <Button type="button" variant="outline" asChild>
                <a
                  href={`/api/risk-assessments/${projectId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveRisks}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Draft
                  </>
                )}
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || isSaving}
                onClick={() => setShowSubmitDialog(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
            </div>
          )}
        </form>
      </Form>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Assessment for Review?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to submit this assessment with{" "}
                  <strong>
                    {riskCount} discovered risk{riskCount !== 1 ? "s" : ""}
                  </strong>{" "}
                  for manager review.
                </p>
                <p>
                  Once submitted, the assessment will be locked and you will not be able to
                  make changes unless the reviewer returns it for revisions.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for Review
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rescind Confirmation Dialog */}
      <AlertDialog open={showRescindDialog} onOpenChange={setShowRescindDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rescind Submission?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to rescind this submission? The assessment will be
                  returned to &quot;In Progress&quot; status and you will be able to make
                  changes.
                </p>
                <p className="text-amber-600">
                  Note: The manager will no longer see this in their approval queue until you
                  resubmit.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rescindMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRescind} disabled={rescindMutation.isPending}>
              {rescindMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rescinding...
                </>
              ) : (
                <>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Rescind Submission
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Assessment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to approve this assessment. This will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>
                      {riskCount} risk{riskCount !== 1 ? "s" : ""}
                    </strong>{" "}
                    will be published to the risk register
                  </li>
                  <li>The assessment will be marked as approved</li>
                  <li>A reassessment due date will be calculated based on risk severity</li>
                </ul>
                <p className="text-green-600 font-medium">
                  Approved risks will be visible to all users in the organization.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Approval
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog with Notes */}
      <AlertDialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          setShowRejectDialog(open);
          if (!open) setRejectionNotes("");
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide feedback explaining what needs to be addressed before
              resubmission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-notes">
                Reason for rejection <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-notes"
                placeholder="Please explain what needs to be addressed..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={4}
                className={
                  rejectionNotes.length > 0 && rejectionNotes.length < 20
                    ? "border-red-500"
                    : ""
                }
              />
              <p
                className={`text-xs ${
                  rejectionNotes.length > 0 && rejectionNotes.length < 20
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {rejectionNotes.length}/20 minimum characters
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectMutation.isPending || rejectionNotes.length < 20}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirm Rejection
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Read-only message for submitted/approved */}
      {project.status !== AssessmentProjectStatus.IN_PROGRESS && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-center text-muted-foreground">
                {project.status === AssessmentProjectStatus.SUBMITTED
                  ? "This assessment has been submitted for review and cannot be modified."
                  : "This assessment has been approved. All risks have been published to the risk register."}
              </p>

              {/* Assignee actions for SUBMITTED */}
              {canRescind && (
                <Button variant="outline" onClick={() => setShowRescindDialog(true)}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Rescind Submission
                </Button>
              )}

              {/* Manager actions for SUBMITTED */}
              {canApprove && (
                <div className="flex gap-3">
                  <Button variant="default" onClick={() => setShowApproveDialog(true)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
