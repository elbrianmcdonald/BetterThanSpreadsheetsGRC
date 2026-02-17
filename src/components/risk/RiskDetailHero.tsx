"use client";

/**
 * Risk Detail Hero Component
 *
 * Story 4.17: Risk Detail Page with Full Context and Actions (AC7-AC12)
 *
 * Hero section for risk detail page:
 * - AC7: Large risk title (H1) with edit button
 * - AC8: Severity badge (color-coded) and impact score (color-coded, large font)
 * - AC9: Status badge with last updated timestamp
 * - AC10: "Created by [name] on [date]" metadata
 * - AC11: Quick actions: "Edit", "Change Status", "Delete" (role-based)
 * - AC12: Breadcrumb navigation
 *
 * @see Story 4.17: Risk Detail Page
 */

import { format } from "date-fns";
import {
  Pencil,
  RefreshCw,
  Trash2,
  User,
  Calendar,
} from "lucide-react";
import { RiskStatus, UserRole, Severity } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { StatusBadge } from "@/components/risk/StatusBadge";
import { ImpactScoreBadge } from "@/components/risk/ImpactScoreBadge";
import { cn } from "@/lib/utils";

interface RiskDetailHeroProps {
  /** Risk data */
  risk: {
    id: string;
    title: string;
    severity: Severity;
    status: RiskStatus;
    impactScore: number | null;
    createdAt: Date;
    updatedAt: Date;
    CreatedBy?: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
  /** Current user's role */
  userRole?: UserRole;
  /** Current user's ID */
  userId?: string;
  /** Whether user is assigned as IT owner */
  isItOwner?: boolean;
  /** Whether user is assigned as business owner */
  isBusinessOwner?: boolean;
  /** Callback when Edit button is clicked */
  onEditClick?: () => void;
  /** Callback when Change Status button is clicked */
  onChangeStatusClick?: () => void;
  /** Callback when Delete button is clicked */
  onDeleteClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/** Roles that can edit risks */
const CAN_EDIT_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
];

/** Roles that can change risk status */
const CAN_CHANGE_STATUS_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.IT_STAKEHOLDER,
];

/** Roles that can delete risks */
const CAN_DELETE_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.ORG_ADMIN,
];

export function RiskDetailHero({
  risk,
  userRole,
  userId,
  isItOwner,
  isBusinessOwner,
  onEditClick,
  onChangeStatusClick,
  onDeleteClick,
  className,
}: RiskDetailHeroProps) {
  // Determine permissions
  const canEdit = userRole && CAN_EDIT_ROLES.includes(userRole);
  const canChangeStatus =
    userRole &&
    (CAN_CHANGE_STATUS_ROLES.includes(userRole) ||
      // IT_STAKEHOLDER can change status if assigned
      (userRole === UserRole.IT_STAKEHOLDER && isItOwner) ||
      // BUSINESS_STAKEHOLDER can change status if assigned
      (userRole === UserRole.BUSINESS_STAKEHOLDER && isBusinessOwner));
  const canDelete = userRole && CAN_DELETE_ROLES.includes(userRole);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hero content - Breadcrumbs handled by AppLayout */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Left side: Title and metadata */}
        <div className="space-y-3 flex-1 min-w-0">
          {/* AC7: Large risk title */}
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground break-words">
            {risk.title}
          </h1>

          {/* AC8 & AC9: Badges row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Severity badge */}
            <SeverityBadge severity={risk.severity} size="lg" />

            {/* Impact score */}
            <ImpactScoreBadge score={risk.impactScore ?? 0} size="lg" />

            {/* Status badge with timestamp */}
            <StatusBadge
              status={risk.status}
              updatedAt={risk.updatedAt}
              size="md"
            />
          </div>

          {/* AC10: Created by metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {risk.CreatedBy && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span>Created by</span>
                <span className="font-medium text-foreground">
                  {risk.CreatedBy.name || risk.CreatedBy.email || "Unknown"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>on</span>
              <span className="font-medium text-foreground">
                {format(new Date(risk.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>

        {/* AC11: Quick actions */}
        <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canChangeStatus && (
            <Button variant="outline" size="sm" onClick={onChangeStatusClick}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Change Status
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onDeleteClick}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
