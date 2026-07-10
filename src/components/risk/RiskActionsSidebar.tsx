"use client";

/**
 * Risk Actions Sidebar Component
 *
 * Story 4.17: Risk Detail Page with Full Context and Actions (AC58-AC63)
 *
 * Sidebar showing role-based action buttons:
 * - AC58: "Assign Risk" button (GRC_ANALYST, SECURITY_ENGINEER, ORG_ADMIN)
 * - AC59: "Change Status" button (role-based, per Story 4.10)
 * - AC60: "Mark Remediated" button for IT_STAKEHOLDER
 * - AC61: "Approve/Reject" buttons for BUSINESS_STAKEHOLDER
 * - AC62: "Close Risk" button (GRC_ANALYST after remediation verified)
 * - AC63: Action buttons disabled if user lacks permission
 *
 * @see Story 4.17: Risk Detail Page
 */

import Link from "next/link";
import {
  UserPlus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lock,
  Shield,
  ClipboardCheck,
} from "lucide-react";
import { RiskStatus, UserRole } from "@prisma/client";

import { WRITE_ROLES } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface RiskActionsSidebarProps {
  /** Risk data */
  risk: {
    id: string;
    status: RiskStatus;
  };
  /** Current user's role */
  userRole?: UserRole;
  /** Whether remediation options exist */
  hasRemediationOptions?: boolean;
  /** Callback for Assign Risk button */
  onAssignClick?: () => void;
  /** Callback for Change Status button */
  onChangeStatusClick?: () => void;
  /** Callback for Mark Remediated button */
  onMarkRemediatedClick?: () => void;
  /** Callback for Approve button */
  onApproveClick?: () => void;
  /** Callback for Reject button */
  onRejectClick?: () => void;
  /** Callback for Close Risk button */
  onCloseRiskClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/** Roles that can assign risks (AC58) — assign is a write action */
const CAN_ASSIGN_ROLES: UserRole[] = WRITE_ROLES;

/** Roles that can close risks (AC62) — write tier */
const CAN_CLOSE_ROLES: UserRole[] = WRITE_ROLES;

export function RiskActionsSidebar({
  risk,
  userRole,
  hasRemediationOptions = false,
  onAssignClick,
  onChangeStatusClick,
  onMarkRemediatedClick,
  onApproveClick,
  onRejectClick,
  onCloseRiskClick,
  className,
}: RiskActionsSidebarProps) {
  // Determine permissions
  const canAssign = userRole && CAN_ASSIGN_ROLES.includes(userRole);
  const canClose =
    userRole &&
    CAN_CLOSE_ROLES.includes(userRole) &&
    risk.status === RiskStatus.REMEDIATED;

  // IT Stakeholder can mark remediated based on role alone; owner check happens server-side
  const canMarkRemediated =
    userRole === UserRole.BUSINESS_USER &&
    risk.status === RiskStatus.ASSIGNED;

  // Business Stakeholder can approve/reject based on role alone; owner check happens server-side
  const canApproveReject =
    userRole === UserRole.BUSINESS_USER &&
    hasRemediationOptions;

  // General status change permission (for the dialog)
  const canChangeStatus =
    userRole &&
    (CAN_ASSIGN_ROLES.includes(userRole) ||
      userRole === UserRole.BUSINESS_USER);

  // Story 16.7: Can start treatment if user can assign and risk is OPEN
  const canStartTreatment = canAssign && risk.status === RiskStatus.OPEN;

  // Count available actions
  const actionsCount = [
    canAssign,
    canChangeStatus,
    canStartTreatment,
    canMarkRemediated,
    canApproveReject,
    canClose,
  ].filter(Boolean).length;

  // If no actions available, show read-only message
  if (actionsCount === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You have read-only access to this risk. Contact a GRC Analyst to
            request changes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* AC58: Assign Risk button */}
        {canAssign && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onAssignClick}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Assign Risk
          </Button>
        )}

        {/* AC59: Change Status button */}
        {canChangeStatus && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onChangeStatusClick}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Change Status
          </Button>
        )}

        {/* Story 16.7: Start Treatment button */}
        {canAssign && risk.status === RiskStatus.OPEN && (
          <Button
            variant="outline"
            className="w-full justify-start"
            asChild
          >
            <Link href={`/risks/${risk.id}/treatment`}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Start Treatment
            </Link>
          </Button>
        )}

        {/* AC60: Mark Remediated button for IT_STAKEHOLDER */}
        {canMarkRemediated && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                As IT Owner, you can mark this risk as remediated once fixes are
                complete.
              </p>
              <Button
                variant="default"
                className="w-full justify-start bg-green-600 hover:bg-green-700"
                onClick={onMarkRemediatedClick}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Remediated
              </Button>
            </div>
          </>
        )}

        {/* AC61: Approve/Reject buttons for BUSINESS_STAKEHOLDER */}
        {canApproveReject && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                As Business Owner, review the remediation options and make a
                decision.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={onApproveClick}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={onRejectClick}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          </>
        )}

        {/* AC62: Close Risk button */}
        {canClose && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This risk has been remediated. Verify and close it.
              </p>
              <Button
                variant="default"
                className="w-full justify-start"
                onClick={onCloseRiskClick}
              >
                <Lock className="h-4 w-4 mr-2" />
                Close Risk
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
