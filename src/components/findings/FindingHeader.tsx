"use client";

/**
 * Finding Header Component
 *
 * Story 7.11: Finding Detail Page (AC7-AC12)
 *
 * Displays the finding header section with:
 * - AC7: Identifier displayed prominently
 * - AC8: Status badge with appropriate color
 * - AC9: Source badge (Audit, Pentest, etc.)
 * - AC10: Severity badge with color coding
 * - AC11: Created date and creator name
 * - AC12: Locked indicator (if status = ACCEPTED)
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 */

import { type FindingStatus, type FindingSource, type Severity } from "@prisma/client";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { FindingStatusBadge } from "./FindingStatusBadge";
import { LockedFindingBadge } from "./LockedFindingBadge";

/**
 * Source badge configuration
 */
const SOURCE_CONFIG: Record<FindingSource, { label: string; className: string }> = {
  AUDIT: { label: "Audit", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  PENTEST: { label: "Pentest", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  SCANNER: { label: "Scanner", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  INCIDENT: { label: "Incident", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  MANUAL: { label: "Manual", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

/**
 * Severity badge configuration
 */
const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  HIGH: { label: "High", className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600" },
  MEDIUM: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600" },
  LOW: { label: "Low", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600" },
};

interface FindingHeaderProps {
  /** The finding identifier (e.g., FND-001) */
  identifier: string;
  /** Current status of the finding */
  status: FindingStatus;
  /** Source of the finding (Audit, Pentest, etc.) */
  source: FindingSource;
  /** Severity level */
  severity: Severity;
  /** When the finding was created */
  createdAt: Date | string;
  /** Creator information */
  creator: {
    name: string | null;
    email: string | null;
  } | null;
  /** When the finding was accepted (for lock indicator) */
  acceptedAt?: Date | string | null;
  /** Who accepted the finding (for lock indicator) */
  accepter?: {
    name: string | null;
  } | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the finding header with identifier, status badges, and metadata.
 *
 * @example
 * ```tsx
 * <FindingHeader
 *   identifier="FND-001"
 *   status={FindingStatus.ACCEPTED}
 *   source={FindingSource.PENTEST}
 *   severity={Severity.HIGH}
 *   createdAt={finding.createdAt}
 *   creator={finding.creator}
 *   acceptedAt={finding.acceptedAt}
 *   accepter={finding.accepter}
 * />
 * ```
 */
export function FindingHeader({
  identifier,
  status,
  source,
  severity,
  createdAt,
  creator,
  acceptedAt,
  accepter,
  className,
}: FindingHeaderProps) {
  const sourceConfig = SOURCE_CONFIG[source];
  const severityConfig = SEVERITY_CONFIG[severity];
  const createdDate = new Date(createdAt);
  const formattedDate = format(createdDate, "MMM d, yyyy");

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {/* AC7: Identifier displayed prominently */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{identifier}</h1>

        {/* AC8: Status badge with appropriate color */}
        <FindingStatusBadge status={status} size="md" />

        {/* AC9: Source badge */}
        <Badge variant="outline" className={sourceConfig.className}>
          {sourceConfig.label}
        </Badge>

        {/* AC10: Severity badge with color coding */}
        <Badge variant="outline" className={`border ${severityConfig.className}`}>
          {severityConfig.label}
        </Badge>
      </div>

      {/* AC11: Created date and creator name */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>Created {formattedDate}</span>
        </div>
        {creator && (creator.name ?? creator.email) && (
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span>by {creator.name ?? creator.email ?? "Unknown"}</span>
          </div>
        )}
      </div>

      {/* AC12: Locked indicator (if status = ACCEPTED) */}
      {status === "ACCEPTED" && acceptedAt && (
        <LockedFindingBadge
          acceptedAt={acceptedAt}
          acceptedByName={accepter?.name}
        />
      )}
    </div>
  );
}
