"use client";

/**
 * Audit Trail Entry Component
 *
 * Story 4.12: Risk Audit Trail with Timestamps (AC11)
 *
 * Displays a single audit trail entry with:
 * - Action icon (AC11)
 * - Description (AC11)
 * - Actor name and role (AC11)
 * - Timestamp (AC11)
 * - Expandable change details (AC12)
 *
 * @see Story 4.12: Risk Audit Trail with Timestamps
 */

import { useState } from "react";
import {
  FileText,
  UserPlus,
  RefreshCw,
  Link,
  Unlink,
  MessageSquare,
  Edit,
  Trash2,
  CheckCircle,
  PlusCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatChangeDetails } from "@/lib/formatAuditChange";

interface AuditTrailEntryProps {
  entry: {
    id: string;
    action: string;
    timestamp: Date;
    changes: unknown;
    actorId: string | null;
    actorName: string;
    actorRole: string;
    actorEmail?: string | null;
  };
}

/**
 * Map of action types to icons and colors
 */
const ACTION_ICONS: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  CREATE_RISK: { icon: FileText, color: "text-green-500" },
  UPDATE_RISK: { icon: Edit, color: "text-blue-500" },
  ASSIGN_RISK: { icon: UserPlus, color: "text-purple-500" },
  REASSIGN_RISK: { icon: UserPlus, color: "text-purple-400" },
  UPDATE_RISK_STATUS: { icon: RefreshCw, color: "text-orange-500" },
  LINK_EVIDENCE_TO_RISK: { icon: Link, color: "text-teal-500" },
  UNLINK_EVIDENCE_FROM_RISK: { icon: Unlink, color: "text-red-400" },
  ADD_REMEDIATION_OPTION: { icon: PlusCircle, color: "text-green-400" },
  UPDATE_REMEDIATION_OPTION: { icon: Edit, color: "text-blue-400" },
  DELETE_REMEDIATION_OPTION: { icon: Trash2, color: "text-red-500" },
  ADD_RISK_COMMENT: { icon: MessageSquare, color: "text-blue-500" },
  UPDATE_RISK_COMMENT: { icon: Edit, color: "text-blue-400" },
  DELETE_RISK_COMMENT: { icon: Trash2, color: "text-red-400" },
  CLOSE_RISK: { icon: CheckCircle, color: "text-green-600" },
  REOPEN_RISK: { icon: AlertCircle, color: "text-yellow-500" },
};

/**
 * Get human-readable action name
 */
function getActionName(action: string): string {
  const actionNames: Record<string, string> = {
    CREATE_RISK: "Created Risk",
    UPDATE_RISK: "Updated Risk",
    ASSIGN_RISK: "Assigned Risk",
    REASSIGN_RISK: "Reassigned Risk",
    UPDATE_RISK_STATUS: "Status Changed",
    LINK_EVIDENCE_TO_RISK: "Evidence Linked",
    UNLINK_EVIDENCE_FROM_RISK: "Evidence Unlinked",
    ADD_REMEDIATION_OPTION: "Option Added",
    UPDATE_REMEDIATION_OPTION: "Option Updated",
    DELETE_REMEDIATION_OPTION: "Option Deleted",
    ADD_RISK_COMMENT: "Comment Added",
    UPDATE_RISK_COMMENT: "Comment Updated",
    DELETE_RISK_COMMENT: "Comment Deleted",
    CLOSE_RISK: "Risk Closed",
    REOPEN_RISK: "Risk Reopened",
  };

  return (
    actionNames[action] ??
    action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Format role for display
 */
function formatRole(role: string): string {
  const roleLabels: Record<string, string> = {
    ORG_ADMIN: "Org Admin",
    GRC_ANALYST: "GRC Analyst",
    SECURITY_ENGINEER: "Security Engineer",
    IT_STAKEHOLDER: "IT Stakeholder",
    BUSINESS_STAKEHOLDER: "Business Stakeholder",
    AUDITOR: "Auditor",
    CISO: "MANAGER",
    SYSTEM: "System",
    UNKNOWN: "Unknown",
  };

  return roleLabels[role] ?? role;
}

export function AuditTrailEntry({ entry }: AuditTrailEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const iconConfig = ACTION_ICONS[entry.action] ?? {
    icon: AlertCircle,
    color: "text-gray-500",
  };
  const Icon = iconConfig.icon;

  const formattedDescription: string = formatChangeDetails(
    entry.action,
    entry.changes as Record<string, unknown>
  );

  const timestamp = new Date(entry.timestamp);
  const relativeTime = formatDistanceToNow(timestamp, { addSuffix: true });
  const absoluteTime = timestamp.toLocaleString();

  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0">
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center ${iconConfig.color}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header: Action and Actor */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-medium text-sm">
              {getActionName(entry.action)}
            </span>
            <span className="text-muted-foreground text-sm ml-2">
              by{" "}
              <span className="font-medium text-foreground">
                {entry.actorName}
              </span>
            </span>
            <Badge variant="outline" className="ml-2 text-xs">
              {formatRole(entry.actorRole)}
            </Badge>
          </div>

          {/* Timestamp */}
          <span
            className="text-xs text-muted-foreground whitespace-nowrap"
            title={absoluteTime}
          >
            {relativeTime}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-1">
          {String(formattedDescription)}
        </p>

        {/* Expandable Change Details (AC12) */}
        {!!entry.changes && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show details
                </>
              )}
            </Button>

            {isExpanded && (
              <div className="mt-2 p-2 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(entry.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
