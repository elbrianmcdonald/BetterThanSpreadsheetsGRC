"use client";

/**
 * Linked Risks Section Component
 *
 * Displays all risks that an evidence file is linked to,
 * with severity badges, status, and link type indicators.
 *
 * @see Story 3.6: AC15-AC18 - Linked Risks Section on Evidence Detail Page
 */

import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ExternalLink,
  FileWarning,
} from "lucide-react";

interface LinkedRisksSectionProps {
  /** Evidence ID to display linked risks for */
  evidenceId: string;
}

/**
 * Get severity badge styling
 */
function getSeverityBadge(severity: string) {
  switch (severity) {
    case "HIGH":
      return {
        className: "bg-red-100 text-red-700 border-red-200",
        icon: AlertTriangle,
      };
    case "MEDIUM":
      return {
        className: "bg-amber-100 text-amber-700 border-amber-200",
        icon: FileWarning,
      };
    case "LOW":
      return {
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: Shield,
      };
    default:
      return {
        className: "bg-gray-100 text-gray-700 border-gray-200",
        icon: Shield,
      };
  }
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-red-50 text-red-700 border-red-200";
    case "REMEDIATED":
      return "bg-green-50 text-green-700 border-green-200";
    case "CLOSED":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

/**
 * Get link type icon and color
 */
function getLinkTypeIndicator(linkType: string) {
  if (linkType === "FINDING") {
    return {
      icon: AlertTriangle,
      color: "text-amber-500",
      label: "Finding",
    };
  }
  return {
    icon: CheckCircle2,
    color: "text-green-500",
    label: "Remediation",
  };
}

/**
 * Risk Card Component
 */
function RiskCard({
  risk,
}: {
  risk: {
    id: string;
    title: string;
    severity: string;
    status: string;
    linkType: string;
    linkedAt: Date;
  };
}) {
  const severityStyle = getSeverityBadge(risk.severity);
  const SeverityIcon = severityStyle.icon;
  const linkTypeInfo = getLinkTypeIndicator(risk.linkType);
  const LinkTypeIcon = linkTypeInfo.icon;

  return (
    <a
      href={`/risks/${risk.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SeverityIcon className={`h-4 w-4 flex-shrink-0 ${
              risk.severity === "HIGH"
                ? "text-red-500"
                : risk.severity === "MEDIUM"
                ? "text-amber-500"
                : "text-yellow-500"
            }`} />
            <span className="font-medium text-gray-900 truncate">
              {risk.title}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Severity Badge */}
            <Badge
              variant="outline"
              className={`text-xs ${severityStyle.className}`}
            >
              {risk.severity}
            </Badge>

            {/* Status Badge */}
            <Badge
              variant="outline"
              className={`text-xs ${getStatusBadge(risk.status)}`}
            >
              {risk.status}
            </Badge>

            {/* Link Type Indicator */}
            <span className={`flex items-center gap-1 text-xs ${linkTypeInfo.color}`}>
              <LinkTypeIcon className="h-3 w-3" />
              {linkTypeInfo.label}
            </span>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </div>
    </a>
  );
}

export function LinkedRisksSection({ evidenceId }: LinkedRisksSectionProps) {
  // Fetch linked risks
  const { data, isLoading, error } = api.evidence.getLinkedRisks.useQuery(
    { evidenceId },
    { enabled: !!evidenceId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-500" />
            Linked Risks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-500" />
            Linked Risks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">
            Failed to load linked risks: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  const linkedRisks = data?.linkedRisks || [];
  const totalCount = data?.totalCount || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-blue-500" />
          Linked Risks
          {totalCount > 0 && (
            <Badge variant="secondary">{totalCount}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linkedRisks.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              This evidence is not linked to any risks
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Link this evidence to risks from the risk detail page
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedRisks.map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        )}

        {/* Legend */}
        {linkedRisks.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">Link Types:</p>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Finding - documents the risk
              </span>
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="h-3 w-3" />
                Remediation - proves the fix
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
