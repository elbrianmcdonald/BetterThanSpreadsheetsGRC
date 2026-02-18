"use client";

/**
 * Risk Metadata Sidebar Component
 *
 * Story 4.17: Risk Detail Page with Full Context and Actions (AC53-AC57)
 *
 * Sidebar showing risk metadata:
 * - AC53: Asset criticality displayed with badge
 * - AC54: Next audit date shown with days countdown
 * - AC55: Frameworks affected displayed as badge list
 * - AC56: Assigned IT Owner and Business Owner with avatars
 * - AC57: Creation date, last updated date displayed
 *
 * @see Story 4.17: Risk Detail Page
 */

import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Calendar,
  User,
  Shield,
  Building2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AssetCriticality } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AssetCriticalityBadge } from "@/components/risk/AssetCriticalityBadge";
import { cn } from "@/lib/utils";

interface RiskMetadataSidebarProps {
  /** Risk data */
  risk: {
    id: string;
    assetCriticality: AssetCriticality | null;
    nextAuditDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    itOwner?: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    businessOwner?: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
    // Story 4.17 AC55: Frameworks affected (computed from evidence mappings)
    frameworksAffected?: Array<{
      code: string;
      name: string;
    }>;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get initials from a name for avatar fallback
 */
function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "?";
}

/**
 * Calculate days until audit and determine urgency
 */
function getAuditCountdown(nextAuditDate: Date | null): {
  text: string;
  variant: "default" | "warning" | "danger" | "muted";
  days: number | null;
} {
  if (!nextAuditDate) {
    return { text: "Not set", variant: "muted", days: null };
  }

  const days = differenceInDays(new Date(nextAuditDate), new Date());

  if (days < 0) {
    return { text: "Overdue", variant: "danger", days };
  } else if (days === 0) {
    return { text: "Today", variant: "danger", days };
  } else if (days <= 7) {
    return { text: `${days} day${days === 1 ? "" : "s"}`, variant: "danger", days };
  } else if (days <= 30) {
    return { text: `${days} days`, variant: "warning", days };
  } else {
    return { text: `${days} days`, variant: "default", days };
  }
}

export function RiskMetadataSidebar({
  risk,
  className,
}: RiskMetadataSidebarProps) {
  const auditCountdown = getAuditCountdown(risk.nextAuditDate);
  // Story 4.17 AC55: Frameworks affected now comes directly from API
  const affectedFrameworks = risk.frameworksAffected ?? [];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Asset Criticality & Audit Date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Risk Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AC53: Asset Criticality */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Asset Criticality</span>
            </div>
            <AssetCriticalityBadge criticality={risk.assetCriticality ?? "MEDIUM"} />
          </div>

          {/* AC54: Next Audit Date with countdown */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Next Audit</span>
            </div>
            <div className="flex items-center gap-2">
              {risk.nextAuditDate && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(risk.nextAuditDate), "MMM d, yyyy")}
                </span>
              )}
              <Badge
                variant={
                  auditCountdown.variant === "danger"
                    ? "destructive"
                    : auditCountdown.variant === "warning"
                    ? "outline"
                    : "secondary"
                }
                className={cn(
                  auditCountdown.variant === "warning" &&
                    "border-yellow-500 text-yellow-700 bg-yellow-50"
                )}
              >
                {auditCountdown.days !== null && auditCountdown.days < 0 && (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {auditCountdown.text}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AC55: Frameworks Affected */}
      {affectedFrameworks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Frameworks Affected ({affectedFrameworks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {affectedFrameworks.map((framework) => (
                <Badge
                  key={framework.code}
                  variant="outline"
                  className="text-xs"
                  title={framework.name}
                >
                  {framework.code}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AC56: Assigned Owners */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Assigned Owners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* IT Owner */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">IT Owner</span>
            </div>
            {risk.itOwner ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(risk.itOwner.name, risk.itOwner.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {risk.itOwner.name || risk.itOwner.email || "Unknown"}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Not assigned
              </span>
            )}
          </div>

          {/* Business Owner */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Business Owner</span>
            </div>
            {risk.businessOwner ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(risk.businessOwner.name, risk.businessOwner.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {risk.businessOwner.name || risk.businessOwner.email || "Unknown"}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Not assigned
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AC57: Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Created</span>
            </div>
            <span className="text-foreground">
              {format(new Date(risk.createdAt), "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last Updated</span>
            </div>
            <span className="text-foreground" title={format(new Date(risk.updatedAt), "PPpp")}>
              {formatDistanceToNow(new Date(risk.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
