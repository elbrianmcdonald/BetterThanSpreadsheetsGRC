"use client";

/**
 * Verification Section Component
 *
 * Story 4.10: Remediation Workflow State Machine (AC36-AC40)
 *
 * Displays remediation verification status and allows GRC_ANALYST to:
 * - AC38: Verify remediation evidence before closing
 * - AC39: Reopen risk if verification fails
 * - AC40: Add verification comments
 *
 * @see Story 4.10: Remediation Workflow State Machine
 */

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Shield,
  User,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { RiskStatus, UserRole } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusTransitionDialog } from "./StatusTransitionDialog";

interface VerificationSectionProps {
  /** The risk ID */
  riskId: string;
  /** The risk title */
  riskTitle: string;
  /** The current risk status */
  currentStatus: RiskStatus;
  /** Existing verification comments (if any) */
  verificationComments?: string | null;
  /** User who verified (if any) */
  verifiedBy?: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  } | null;
  /** User's role */
  userRole?: UserRole;
  /** Callback when verification is updated */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from a user's name for avatar fallback
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function VerificationSection({
  riskId,
  riskTitle,
  currentStatus,
  verificationComments,
  verifiedBy,
  userRole,
  onSuccess,
  className,
}: VerificationSectionProps) {
  const [addCommentsOpen, setAddCommentsOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // Check if user can verify (AC38)
  const canVerify =
    userRole === UserRole.GRC_ANALYST || userRole === UserRole.ORG_ADMIN;

  // Check if this is a REMEDIATED risk that needs verification
  const needsVerification = currentStatus === RiskStatus.REMEDIATED;

  // Add verification comments mutation
  const addCommentsMutation = api.risk.addVerificationComments.useMutation({
    onSuccess: () => {
      toast.success("Verification comments added successfully");
      setAddCommentsOpen(false);
      setComments("");
      onSuccess?.();
    },
    onError: (error) => {
      setCommentsError(error.message);
      toast.error(error.message);
    },
  });

  const handleAddComments = () => {
    setCommentsError(null);

    if (comments.trim().length < 10) {
      setCommentsError("Comments must be at least 10 characters");
      return;
    }

    addCommentsMutation.mutate({
      riskId,
      verificationComments: comments.trim(),
    });
  };

  // Only show for REMEDIATED risks
  if (currentStatus !== RiskStatus.REMEDIATED) {
    return null;
  }

  return (
    <>
      <Card className={cn("border-yellow-200 dark:border-yellow-800", className)}>
        <CardHeader className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-yellow-600" />
            Remediation Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Status explanation */}
          <Alert className="border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              This risk has been marked as <strong>REMEDIATED</strong> and is
              awaiting verification before it can be closed.
            </AlertDescription>
          </Alert>

          {/* Existing verification comments */}
          {verificationComments && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Verification Comments
              </Label>
              <div className="rounded-md bg-muted/50 p-4">
                <p className="text-sm whitespace-pre-wrap">{verificationComments}</p>
                {verifiedBy && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t text-sm text-muted-foreground">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={verifiedBy.image ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(verifiedBy.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>Verified by {verifiedBy.name ?? verifiedBy.email ?? "Unknown"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions for GRC_ANALYST (AC38-AC39) */}
          {canVerify && needsVerification && (
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Add/Update Verification Comments */}
              <Button
                variant="outline"
                onClick={() => setAddCommentsOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {verificationComments ? "Update Comments" : "Add Verification Comments"}
              </Button>

              {/* AC39: Reopen if verification fails */}
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                onClick={() => setReopenDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Verification Failed - Reopen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Verification Comments Dialog */}
      <Dialog open={addCommentsOpen} onOpenChange={setAddCommentsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Verification Comments</DialogTitle>
            <DialogDescription>
              Document your review of the remediation work performed for this risk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="verificationComments">
                Verification Comments <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="verificationComments"
                placeholder="Describe your verification findings. What evidence did you review? Is the remediation adequate? Any observations or recommendations?"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={5}
                className={cn(commentsError && "border-destructive")}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters required
              </p>
              {commentsError && (
                <p className="text-xs text-destructive">{commentsError}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setAddCommentsOpen(false)}
              disabled={addCommentsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddComments}
              disabled={addCommentsMutation.isPending || comments.trim().length < 10}
            >
              {addCommentsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Comments"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AC39: Reopen Dialog - uses StatusTransitionDialog */}
      <StatusTransitionDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        riskId={riskId}
        riskTitle={riskTitle}
        currentStatus={currentStatus}
        onSuccess={onSuccess}
      />
    </>
  );
}
