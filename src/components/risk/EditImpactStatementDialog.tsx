"use client";

/**
 * Edit Impact Statement Dialog Component
 *
 * Dialog for GRC Analysts to manually edit the auto-generated business impact statement.
 *
 * Story 4.8: Manual Edit Dialog (AC33-AC36)
 * AC33: GRC_ANALYST can click "Edit Impact Statement" button
 * AC34: Opens dialog with markdown editor pre-filled with auto-generated statement
 * AC35: Analyst can customize statement while retaining structure
 * AC36: Manual edits saved to businessImpactStatement field with override flag
 *
 * @see Story 4.8: Automated Business Impact Statement Generation
 */

import { useState, useEffect } from "react";
import { AlertCircle, Save, X, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface EditImpactStatementDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The risk ID to update */
  riskId: string;
  /** The current impact statement content */
  currentStatement: string | null | undefined;
  /** Whether the statement is already manually edited */
  isManuallyEdited?: boolean;
  /** Callback when statement is successfully updated */
  onSuccess?: () => void;
}

/**
 * Word count helper
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Dialog for editing the business impact statement.
 *
 * @example
 * ```tsx
 * <EditImpactStatementDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   riskId={risk.id}
 *   currentStatement={risk.businessImpactStatement}
 *   onSuccess={() => refetch()}
 * />
 * ```
 */
export function EditImpactStatementDialog({
  open,
  onOpenChange,
  riskId,
  currentStatement,
  isManuallyEdited = false,
  onSuccess,
}: EditImpactStatementDialogProps) {
  const [statement, setStatement] = useState(currentStatement ?? "");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();

  // Reset statement when dialog opens with new content
  useEffect(() => {
    if (open) {
      setStatement(currentStatement ?? "");
      setError(null);
    }
  }, [open, currentStatement]);

  // Update mutation
  const updateMutation = api.risk.updateBusinessImpact.useMutation({
    onSuccess: () => {
      toast.success("Business impact statement updated");
      void utils.risk.getById.invalidate({ id: riskId });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      setError(error.message);
      toast.error("Failed to update statement", {
        description: error.message,
      });
    },
  });

  const wordCount = countWords(statement);
  const isValidLength = wordCount >= 50 && wordCount <= 2000;
  const isMinLength = statement.length >= 100;

  const handleSave = () => {
    if (!isMinLength) {
      setError("Impact statement must be at least 100 characters");
      return;
    }

    updateMutation.mutate({
      riskId,
      businessImpactStatement: statement,
    });
  };

  const handleCancel = () => {
    setStatement(currentStatement ?? "");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Business Impact Statement
          </DialogTitle>
          <DialogDescription>
            Customize the auto-generated impact statement for this risk. Use markdown
            formatting for headings (**bold**) and structure.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended structure:</strong>
              <ul className="list-disc list-inside mt-1 text-sm">
                <li>
                  <code>## Regulatory Impact</code> - Compliance and regulatory
                  consequences
                </li>
                <li>
                  <code>## Operational Impact</code> - Business operations and service
                  effects
                </li>
                <li>
                  <code>## Business Context</code> - Industry context and statistics
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Manual edit warning if already edited */}
          {isManuallyEdited && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                This statement was previously edited manually. Your changes will
                replace the existing customizations.
              </AlertDescription>
            </Alert>
          )}

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Statement editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="statement">Impact Statement</Label>
              <span
                className={`text-xs ${
                  wordCount < 50
                    ? "text-amber-600"
                    : wordCount > 2000
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {wordCount} words
                {wordCount < 50 && " (recommended: 50-500)"}
                {wordCount > 2000 && " (too long)"}
              </span>
            </div>
            <Textarea
              id="statement"
              value={statement}
              onChange={(e) => {
                setStatement(e.target.value);
                setError(null);
              }}
              placeholder="## Regulatory Impact

This finding affects **ISO 27001 certification** requirements...

## Operational Impact

**Critical risk of service outage** affecting all users...

## Business Context

Cloud misconfigurations are the **leading cause of data breaches**..."
              className="min-h-[400px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use **text** for bold. Keep each section focused and actionable.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isMinLength || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
