"use client";

/**
 * Remediation Option Card Component
 *
 * Displays a single remediation option with all details.
 *
 * Story 4.5: Task 4 - Remediation Options Display (AC29-AC35)
 * AC31: Each card shows: title, description, cost, timeline, effort badge, priority badge
 * AC32: RECOMMENDED option highlighted with accent border
 * AC33: Cards include "Edit" and "Delete" buttons for authorized users
 * AC35: Selected option (if any) shows "SELECTED" badge and acceptance timestamp
 *
 * @see Story 4.5: Remediation Options Management
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  Pencil,
  Trash2,
  DollarSign,
  Clock,
  User,
  CheckCircle2,
} from "lucide-react";
import type { RemediationOption, User as UserType } from "@prisma/client";
import { RemediationPriority, SelectionStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { EffortLevelBadge } from "./EffortLevelBadge";
import { RemediationPriorityBadge } from "./RemediationPriorityBadge";

/**
 * Format a number as currency (AC36)
 */
const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};

type RemediationOptionWithRelations = RemediationOption & {
  CreatedBy: Pick<UserType, "id" | "name" | "email"> | null;
  SelectedBy?: Pick<UserType, "id" | "name" | "email"> | null;
};

interface RemediationOptionCardProps {
  /** The remediation option to display */
  option: RemediationOptionWithRelations;
  /** Whether the user can edit this option */
  canEdit?: boolean;
  /** Whether the user can delete this option */
  canDelete?: boolean;
  /** Callback when edit is clicked */
  onEdit?: () => void;
  /** Callback when delete is confirmed */
  onDelete?: () => void;
  /** Whether a delete operation is pending */
  isDeleting?: boolean;
}

export function RemediationOptionCard({
  option,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  isDeleting = false,
}: RemediationOptionCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isRecommended = option.priority === RemediationPriority.RECOMMENDED;
  const isSelected = option.selectedStatus === SelectionStatus.ACCEPTED;

  const handleDelete = () => {
    onDelete?.();
    setDeleteDialogOpen(false);
  };

  return (
    <Card
      className={cn(
        "relative transition-all",
        // AC32: RECOMMENDED option highlighted with accent border
        isRecommended && "border-blue-300 dark:border-blue-700 border-2",
        // Selected option styling
        isSelected && "ring-2 ring-green-500 ring-offset-2"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-lg leading-tight">
                {option.title}
              </h4>
              {/* AC35: Selected badge */}
              {isSelected && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SELECTED
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* AC31: Priority badge */}
              <RemediationPriorityBadge priority={option.priority} size="sm" />
              {/* AC31: Effort badge (AC38) */}
              <EffortLevelBadge effortLevel={option.effortLevel} size="sm" />
            </div>
          </div>

          {/* AC33: Edit and Delete buttons */}
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onEdit}
                  title="Edit option"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
              {canDelete && (
                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete option"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Remediation Option</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{option.title}&quot;? This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cost and Timeline Row (AC36-AC37) */}
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {formatCurrency(Number(option.costEstimate))}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{option.timelineEstimate}</span>
          </div>
        </div>

        {/* AC31: Description */}
        <div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {option.description}
          </p>
        </div>

        {/* Approach */}
        <div className="border-t pt-3">
          <h5 className="text-sm font-medium mb-1">Implementation Approach</h5>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {option.approach}
          </p>
        </div>

        {/* Footer with metadata */}
        <div className="border-t pt-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>
                Added by {option.CreatedBy?.name ?? option.CreatedBy?.email ?? "Unknown"}{" "}
                on {format(new Date(option.createdAt), "MMM d, yyyy")}
              </span>
            </div>
            {/* AC35: Acceptance timestamp */}
            {isSelected && option.selectedAt && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>
                  Selected by{" "}
                  {option.SelectedBy?.name ?? option.SelectedBy?.email ?? "Unknown"} on{" "}
                  {format(new Date(option.selectedAt), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
