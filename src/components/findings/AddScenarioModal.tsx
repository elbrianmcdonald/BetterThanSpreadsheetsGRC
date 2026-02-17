"use client";

/**
 * Add Scenario Modal Component
 *
 * Story 7.7: Risk Scenario Management (AC21-AC24)
 *
 * Modal dialog for adding a new risk scenario:
 * - AC21: "Add Scenario" opens modal with textarea
 * - AC22: Textarea placeholder: "Describe a specific threat scenario..."
 * - AC23: Modal has Cancel and Add buttons
 * - AC24: Add button disabled until description entered
 *
 * @see Story 7.7: Risk Scenario Management
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

interface AddScenarioModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
  /** Assessment ID to add scenario to */
  assessmentId: string;
  /** Callback when scenario is successfully added */
  onSuccess?: () => void;
}

/**
 * Modal dialog for adding a new risk scenario to an assessment.
 *
 * @example
 * ```tsx
 * <AddScenarioModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   assessmentId={assessment.id}
 *   onSuccess={() => refetch()}
 * />
 * ```
 */
export function AddScenarioModal({
  open,
  onOpenChange,
  assessmentId,
  onSuccess,
}: AddScenarioModalProps) {
  const [description, setDescription] = useState("");

  // Add scenario mutation
  const addMutation = api.riskAssessment.addScenario.useMutation({
    onSuccess: () => {
      setDescription("");
      onSuccess?.();
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      addMutation.mutate({
        assessmentId,
        description: description.trim(),
      });
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!addMutation.isPending) {
      setDescription("");
      addMutation.reset();
      onOpenChange(false);
    }
  };

  // AC24: Add button disabled until description entered
  const isSubmitDisabled = !description.trim() || addMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Risk Scenario</DialogTitle>
            <DialogDescription>
              Describe a specific way this risk could materialize and impact the
              organization. Be concrete and actionable.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-description">Scenario Description</Label>
              {/* AC22: Textarea with placeholder */}
              <Textarea
                id="scenario-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe a specific threat scenario... (e.g., An attacker could exploit this vulnerability to gain unauthorized access to customer data)"
                rows={4}
                className="resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {description.length > 0 && `${description.length} characters`}
              </p>
            </div>

            {addMutation.error && (
              <p className="text-sm text-destructive">
                {addMutation.error.message}
              </p>
            )}
          </div>

          {/* AC23: Cancel and Add buttons */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {addMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add Scenario"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
