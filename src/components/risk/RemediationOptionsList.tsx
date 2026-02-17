"use client";

/**
 * Remediation Options List Component
 *
 * Displays all remediation options for a risk.
 *
 * Story 4.5: Task 4 - Remediation Options Display (AC29-AC35)
 * AC29: Risk detail page shows "Remediation Options" section
 * AC30: Options displayed as cards sorted by priority (RECOMMENDED first)
 * AC34: Empty state shows "No remediation options added" with "Add Option" CTA
 *
 * @see Story 4.5: Remediation Options Management
 */

import { useState } from "react";
import { Loader2, FileText, Plus } from "lucide-react";
import { UserRole } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RemediationOptionCard } from "./RemediationOptionCard";
import { AddRemediationOptionDialog } from "./AddRemediationOptionDialog";
import { EditRemediationOptionDialog } from "./EditRemediationOptionDialog";

/**
 * Roles that can manage remediation options
 */
const CAN_ADD_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
];

const CAN_DELETE_ROLES: UserRole[] = [UserRole.GRC_ANALYST, UserRole.ORG_ADMIN];

interface RemediationOptionsListProps {
  /** The risk ID to fetch options for */
  riskId: string;
  /** The current user's role */
  userRole?: UserRole;
}

export function RemediationOptionsList({
  riskId,
  userRole,
}: RemediationOptionsListProps) {
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch options
  const { data: options, isLoading, error } = api.risk.listRemediationOptions.useQuery(
    { riskId },
    { refetchOnWindowFocus: false }
  );

  // Delete mutation
  const deleteMutation = api.risk.deleteRemediationOption.useMutation({
    onSuccess: () => {
      toast.success("Remediation option deleted");
      void utils.risk.listRemediationOptions.invalidate({ riskId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Permission checks
  const canAdd = userRole && CAN_ADD_ROLES.includes(userRole);
  const canEdit = userRole && CAN_ADD_ROLES.includes(userRole);
  const canDelete = userRole && CAN_DELETE_ROLES.includes(userRole);

  // Get the option being edited
  const editingOption = options?.find((o) => o.id === editingOptionId);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Remediation Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Remediation Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load remediation options.</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Remediation Options
          {options && options.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({options.length})
            </span>
          )}
        </CardTitle>
        {/* AC23: Add button for authorized users */}
        {canAdd && <AddRemediationOptionDialog riskId={riskId} />}
      </CardHeader>
      <CardContent>
        {/* AC34: Empty state */}
        {!options || options.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h4 className="text-lg font-medium text-muted-foreground mb-2">
              No remediation options added
            </h4>
            <p className="text-sm text-muted-foreground mb-6">
              Add remediation options to help stakeholders evaluate different approaches
              to addressing this risk.
            </p>
            {/* AC34: Add Option CTA */}
            {canAdd && (
              <AddRemediationOptionDialog
                riskId={riskId}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Remediation Option
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          /* AC30: Options sorted by priority */
          <div className="space-y-4">
            {options.map((option) => (
              <RemediationOptionCard
                key={option.id}
                option={option}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => setEditingOptionId(option.id)}
                onDelete={() => deleteMutation.mutate({ optionId: option.id })}
                isDeleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables?.optionId === option.id
                }
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      {editingOption && (
        <EditRemediationOptionDialog
          option={editingOption}
          open={!!editingOptionId}
          onOpenChange={(open) => {
            if (!open) setEditingOptionId(null);
          }}
          onSuccess={() => setEditingOptionId(null)}
        />
      )}
    </Card>
  );
}
