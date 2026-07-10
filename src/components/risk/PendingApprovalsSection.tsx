"use client";

/**
 * Pending Approvals Section Component
 *
 * Story 4.3: Manager Approval Queue Tab
 *
 * Displays SUBMITTED assessment projects awaiting manager approval.
 * Shows badge count, allows navigation to review assessments.
 */

import { useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ClipboardCheck,
  Loader2,
  Calendar,
  User,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { UserRole } from "@prisma/client";

import { APPROVE_ROLES } from "@/lib/auth/roles";
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

/** Roles that can view/act on the pending-approval queue (approve tier) */
const MANAGER_ROLES: UserRole[] = APPROVE_ROLES;

interface PendingApprovalsSectionProps {
  userRole: UserRole;
}

export function PendingApprovalsSection({ userRole }: PendingApprovalsSectionProps) {
  const isManager = MANAGER_ROLES.includes(userRole);

  // Query pending approvals
  const { data, isLoading, error } = api.riskAssessmentProject.getPendingApprovals.useQuery(
    { limit: 5, offset: 0 },
    { enabled: isManager }
  );

  // Get count for badge
  const { data: countData } = api.riskAssessmentProject.getPendingApprovalCount.useQuery(
    undefined,
    { enabled: isManager }
  );

  if (!isManager) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Pending Assessment Approvals
              {countData && countData.count > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {countData.count}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Assessment projects submitted for your review
            </CardDescription>
          </div>
          {data && data.total > 5 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/risk-assessments?status=SUBMITTED">
                View All ({data.total})
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-600">{error.message}</p>
          </div>
        ) : !data?.assessments.length ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-12 w-12 mx-auto text-green-400 mb-4" />
            <p className="text-muted-foreground">No assessments pending approval</p>
            <p className="text-sm text-muted-foreground mt-1">
              All submitted assessments have been reviewed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.assessments.map((assessment) => {
              const riskCount = assessment._count?.discoveredRisks ?? 0;

              return (
                <div
                  key={assessment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{assessment.subject}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {riskCount} risk{riskCount !== 1 ? "s" : ""} discovered
                      </span>
                      {assessment.submittedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Submitted: {format(new Date(assessment.submittedAt), "MMM d, yyyy")}
                        </span>
                      )}
                      {assessment.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By: {assessment.assignee.name || assessment.assignee.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" variant="default" asChild>
                      <Link href={`/risk-assessments/${assessment.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Review
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
