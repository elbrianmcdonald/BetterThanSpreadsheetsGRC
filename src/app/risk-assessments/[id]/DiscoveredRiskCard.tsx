"use client";

/**
 * Discovered Risk Card Component
 *
 * Story 2.1: Assessment Workspace Page
 * Story 2.3: Edit Discovered Risk
 * Story 2.4: Rescind Discovered Risk
 *
 * Displays a discovered risk in the assessment workspace with:
 * - Severity badge
 * - Title and brief description
 * - PENDING indicator
 * - Edit and Rescind buttons (if editable)
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { Severity, RiskDiscoveryStatus } from "@prisma/client";
import { toast } from "sonner";
import { EditDiscoveredRiskDialog } from "@/components/risk-assessment-project/EditDiscoveredRiskDialog";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DiscoveredRisk {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  discoveryStatus: RiskDiscoveryStatus | null;
  // Story 2.3: Include affectedSystems for edit dialog
  affectedSystems?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface DiscoveredRiskCardProps {
  risk: DiscoveredRisk;
  isEditable: boolean;
  assessmentId: string;
}

/**
 * Severity badge colors
 */
const severityConfig: Record<Severity, { color: string; label: string }> = {
  HIGH: { color: "bg-red-100 text-red-800 border-red-300", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-800 border-amber-300", label: "Medium" },
  LOW: { color: "bg-green-100 text-green-800 border-green-300", label: "Low" },
};

/**
 * Discovery status badge colors
 */
const discoveryStatusConfig: Record<RiskDiscoveryStatus, { color: string; label: string }> = {
  PENDING: { color: "bg-blue-100 text-blue-800 border-blue-300", label: "Pending Review" },
  PUBLISHED: { color: "bg-green-100 text-green-800 border-green-300", label: "Published" },
};

export function DiscoveredRiskCard({
  risk,
  isEditable,
  assessmentId,
}: DiscoveredRiskCardProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [isRescindDialogOpen, setIsRescindDialogOpen] = useState(false);
  // Story 2.3: Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Rescind mutation (soft-delete)
  const rescindMutation = api.risk.rescindFromAssessment.useMutation({
    onSuccess: () => {
      toast.success("Risk rescinded successfully");
      // Invalidate the assessment query to refresh the list
      void utils.riskAssessmentProject.getById.invalidate({ id: assessmentId });
      setIsRescindDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to rescind risk");
    },
  });

  // Story 2.3: Handle edit - open inline edit dialog
  const handleEdit = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  // Handle rescind
  const handleRescind = useCallback(() => {
    rescindMutation.mutate({ riskId: risk.id, assessmentId });
  }, [rescindMutation, risk.id, assessmentId]);

  // Handle view risk details
  const handleViewRisk = useCallback(() => {
    router.push(`/risks/${risk.id}`);
  }, [router, risk.id]);

  const severity = severityConfig[risk.severity];
  const discoveryStatus = risk.discoveryStatus
    ? discoveryStatusConfig[risk.discoveryStatus]
    : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Severity Badge */}
            <Badge
              variant="outline"
              className={`${severity.color} font-medium`}
            >
              {severity.label}
            </Badge>

            {/* Discovery Status Badge */}
            {discoveryStatus && (
              <Badge
                variant="outline"
                className={`${discoveryStatus.color} font-medium`}
              >
                {discoveryStatus.label}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* View Details Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleViewRisk}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View risk details</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Edit Button - only if editable and PENDING */}
            {isEditable && risk.discoveryStatus === RiskDiscoveryStatus.PENDING && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleEdit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit risk</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Rescind Button - only if editable and PENDING */}
            {isEditable && risk.discoveryStatus === RiskDiscoveryStatus.PENDING && (
              <AlertDialog
                open={isRescindDialogOpen}
                onOpenChange={setIsRescindDialogOpen}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Rescind risk</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Rescind Risk
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to rescind this risk? The risk will be
                      removed from this assessment but the record will be preserved
                      in the audit trail.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-4 rounded-lg border bg-muted/50 p-4">
                    <p className="font-medium">{risk.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {risk.description || "No description"}
                    </p>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={rescindMutation.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRescind}
                      disabled={rescindMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {rescindMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Rescinding...
                        </>
                      ) : (
                        "Confirm Rescind"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <CardTitle className="text-base font-semibold">{risk.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {risk.description || "No description provided"}
        </p>
      </CardContent>

      {/* Story 2.3: Edit Discovered Risk Dialog */}
      <EditDiscoveredRiskDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        risk={{
          id: risk.id,
          title: risk.title,
          description: risk.description,
          severity: risk.severity,
          affectedSystems: risk.affectedSystems,
        }}
        assessmentId={assessmentId}
      />
    </Card>
  );
}
