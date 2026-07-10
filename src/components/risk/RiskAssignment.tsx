"use client";

/**
 * Risk Assignment Display Component
 *
 * Displays current risk ownership and provides reassignment functionality.
 *
 * Story 4.6: Risk Ownership Assignment (Task 6)
 * - AC26: Risk detail page displays IT Owner info
 * - AC27: Risk detail page displays Business Owner info
 * - AC28: Owner info shows: name, email, avatar
 * - AC29: Displays assignment timestamp and assigned by
 * - AC30: "Reassign" button visible to GRC_ANALYST, ORG_ADMIN
 * - AC31: Clicking reassign opens assignment dialog
 *
 * @see Story 4.6: Risk Ownership Assignment
 */

import { useState } from "react";
import { format } from "date-fns";
import { UserPlus, RefreshCw, User, Briefcase, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AssignRiskDialog } from "./AssignRiskDialog";
import type { UserRole } from "@prisma/client";

interface OwnerInfo {
  id: string;
  name: string | null;
  email: string;
}

interface RiskAssignmentProps {
  /** The risk ID */
  riskId: string;
  /** The risk title (for dialog display) */
  riskTitle: string;
  /** IT Owner details (null if not assigned) */
  itOwner: OwnerInfo | null;
  /** Business Owner details (null if not assigned) */
  businessOwner: OwnerInfo | null;
  /** When the risk was assigned */
  assignedAt: Date | null;
  /** Who assigned the risk */
  assignedBy: { id: string; name: string | null; email: string } | null;
  /** Current user's role (for permission checks) */
  userRole: UserRole;
  /** Callback when assignment changes */
  onAssignmentChange?: () => void;
}

/**
 * Roles that can assign/reassign risks (AC30, AC36)
 */
const ASSIGN_ROLES: UserRole[] = ["ANALYST", "ANALYST", "ADMINISTRATOR"];

export function RiskAssignment({
  riskId,
  riskTitle,
  itOwner,
  businessOwner,
  assignedAt,
  assignedBy,
  userRole,
  onAssignmentChange,
}: RiskAssignmentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if user can assign/reassign
  const canAssign = ASSIGN_ROLES.includes(userRole);

  // Check if risk is already assigned
  const isAssigned = itOwner !== null || businessOwner !== null;

  // Get initials for avatar fallback
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Owner card component
  const OwnerCard = ({
    title,
    icon: Icon,
    owner,
    roleLabel,
  }: {
    title: string;
    icon: React.ElementType;
    owner: OwnerInfo | null;
    roleLabel: string;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        {owner ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{getInitials(owner.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{owner.name ?? "Unknown"}</p>
              <p className="text-sm text-muted-foreground truncate">
                {owner.email}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No {roleLabel} assigned
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Risk Ownership
            </CardTitle>
            {/* AC30: Assign/Reassign button for authorized roles */}
            {canAssign && (
              <Button
                variant={isAssigned ? "outline" : "default"}
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                {isAssigned ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reassign
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status badge */}
          {isAssigned ? (
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
              Assigned
            </Badge>
          ) : (
            <Badge variant="secondary">Unassigned</Badge>
          )}

          {/* Owner cards (AC26, AC27, AC28) */}
          <div className="grid gap-3">
            <OwnerCard
              title="IT Owner"
              icon={User}
              owner={itOwner}
              roleLabel="IT Stakeholder"
            />
            <OwnerCard
              title="Business Owner"
              icon={Briefcase}
              owner={businessOwner}
              roleLabel="Business Stakeholder"
            />
          </div>

          {/* Assignment metadata (AC29) */}
          {isAssigned && assignedAt && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Assigned on {format(new Date(assignedAt), "MMM d, yyyy 'at' h:mm a")}
                  {assignedBy && (
                    <>
                      {" "}
                      by <span className="font-medium">{assignedBy.name ?? assignedBy.email}</span>
                    </>
                  )}
                </span>
              </div>
            </>
          )}

          {/* Empty state message for non-authorized users */}
          {!isAssigned && !canAssign && (
            <p className="text-sm text-muted-foreground">
              This risk has not been assigned to any owners yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog (AC20, AC31) */}
      <AssignRiskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        riskId={riskId}
        riskTitle={riskTitle}
        isReassign={isAssigned}
        currentITOwnerId={itOwner?.id}
        currentBusinessOwnerId={businessOwner?.id}
        onSuccess={onAssignmentChange}
      />
    </>
  );
}
