"use client";

/**
 * Audit Trail Display Component
 *
 * Displays audit trail for an evidence record including:
 * - Chronological list of all operations (newest first)
 * - Action type with icons
 * - User name and timestamp
 * - Changes summary in human-readable format
 * - Expandable entries for detailed JSON view
 * - Pagination (10 entries per page)
 *
 * @see Story 3.9: AC14-AC19 - Audit trail UI
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Download,
  Link2,
  Tag,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  User,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditTrailProps {
  /** Evidence ID to show audit trail for */
  evidenceId: string;
  /** Whether the component is in a dialog/modal (uses different layout) */
  inDialog?: boolean;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return formatDate(date);
}

/**
 * Get action icon and color based on action type
 */
function getActionDisplay(action: string): {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
} {
  const actionMap: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
    UPLOAD_EVIDENCE: {
      icon: Upload,
      color: "text-green-600",
      bgColor: "bg-green-100",
      label: "Uploaded",
    },
    UPDATE_EVIDENCE: {
      icon: Edit2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      label: "Updated",
    },
    DELETE_EVIDENCE: {
      icon: Trash2,
      color: "text-red-600",
      bgColor: "bg-red-100",
      label: "Deleted",
    },
    RESTORE_EVIDENCE: {
      icon: RefreshCw,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      label: "Restored",
    },
    VIEW_EVIDENCE: {
      icon: Eye,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      label: "Viewed",
    },
    DOWNLOAD_EVIDENCE: {
      icon: Download,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      label: "Downloaded",
    },
    REPLACE_EVIDENCE_FILE: {
      icon: RefreshCw,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      label: "File Replaced",
    },
    TAG_EVIDENCE: {
      icon: Tag,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
      label: "Tags Updated",
    },
    LINK_EVIDENCE_TO_RISK: {
      icon: Link2,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      label: "Linked to Risk",
    },
    UNLINK_EVIDENCE_FROM_RISK: {
      icon: Link2,
      color: "text-rose-600",
      bgColor: "bg-rose-100",
      label: "Unlinked from Risk",
    },
  };

  return actionMap[action] ?? {
    icon: History,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    label: action.replace(/_/g, " ").toLowerCase(),
  };
}

/**
 * Format changes for human-readable display
 */
function formatChanges(changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];

  const result: string[] = [];
  const changesObj = changes as Record<string, unknown>;

  // Handle before/after format
  if ("before" in changesObj && "after" in changesObj) {
    const before = changesObj.before as Record<string, unknown> | null;
    const after = changesObj.after as Record<string, unknown> | null;

    // Special cases for specific fields
    if (after?.["permanentlyDeleted"]) {
      result.push("Evidence was permanently deleted");
      return result;
    }

    if (after?.["blocked"]) {
      result.push(`Upload blocked: ${after["reason"]}`);
      return result;
    }

    // Compare before and after
    if (before && after) {
      for (const key of Object.keys(after)) {
        const beforeVal = before[key];
        const afterVal = after[key];

        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          const fieldName = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();

          if (Array.isArray(afterVal)) {
            const beforeArr = (beforeVal as string[] | undefined) ?? [];
            const added = afterVal.filter((v) => !beforeArr.includes(v as string));
            const removed = beforeArr.filter((v) => !afterVal.includes(v));

            if (added.length > 0) {
              result.push(`Added ${fieldName}: ${added.join(", ")}`);
            }
            if (removed.length > 0) {
              result.push(`Removed ${fieldName}: ${removed.join(", ")}`);
            }
          } else if (beforeVal !== undefined && afterVal !== undefined) {
            result.push(`${fieldName} changed from "${String(beforeVal)}" to "${String(afterVal)}"`);
          } else if (afterVal !== undefined) {
            result.push(`Set ${fieldName} to "${String(afterVal)}"`);
          }
        }
      }
    } else if (after) {
      // Only after state (e.g., for uploads, views)
      for (const [key, value] of Object.entries(after)) {
        if (value !== null && value !== undefined && key !== "timestamp") {
          const fieldName = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
          if (Array.isArray(value)) {
            result.push(`${fieldName}: ${(value as string[]).join(", ")}`);
          } else if (typeof value === "object") {
            result.push(`${fieldName}: ${JSON.stringify(value)}`);
          } else {
            result.push(`${fieldName}: ${String(value)}`);
          }
        }
      }
    }
  }

  return result.length > 0 ? result : ["Changes recorded"];
}

interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: Date | string;
  changes: Record<string, unknown> | null;
  User: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
}

export function AuditTrail({ evidenceId, inDialog = false }: AuditTrailProps) {
  const [page, setPage] = useState(1);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const pageSize = 10;

  const {
    data: auditData,
    isLoading,
    isError,
    error,
  } = api.audit.getEvidenceAuditLog.useQuery(
    { evidenceId, page, pageSize },
    {
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  const toggleExpanded = (entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  if (isLoading) {
    return (
      <Card className={cn(inDialog && "border-0 shadow-none")}>
        <CardHeader className={cn("pb-3", inDialog && "px-0")}>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(inDialog && "px-0")}>
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading audit trail...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn(inDialog && "border-0 shadow-none")}>
        <CardHeader className={cn("pb-3", inDialog && "px-0")}>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(inDialog && "px-0")}>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error?.message || "Failed to load audit trail"}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!auditData || auditData.logs.length === 0) {
    return (
      <Card className={cn(inDialog && "border-0 shadow-none")}>
        <CardHeader className={cn("pb-3", inDialog && "px-0")}>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(inDialog && "px-0")}>
          <div className="text-center py-6 text-gray-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No audit entries</p>
            <p className="text-sm">Activities will appear here as they occur.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const logs = auditData.logs as AuditLogEntry[];

  return (
    <Card className={cn(inDialog && "border-0 shadow-none")}>
      <CardHeader className={cn("pb-3", inDialog && "px-0")}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            Audit Trail
          </CardTitle>
          <Badge variant="outline" className="text-amber-600">
            {auditData.total} entr{auditData.total !== 1 ? "ies" : "y"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(inDialog && "px-0")}>
        <div className="space-y-3">
          {logs.map((entry: AuditLogEntry) => {
            const actionDisplay = getActionDisplay(entry.action);
            const Icon = actionDisplay.icon;
            const changesText = formatChanges(entry.changes);
            const isExpanded = expandedEntryId === entry.id;

            return (
              <div
                key={entry.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Action Icon */}
                  <div
                    className={cn(
                      "p-2 rounded-full flex-shrink-0",
                      actionDisplay.bgColor
                    )}
                  >
                    <Icon className={cn("h-4 w-4", actionDisplay.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{actionDisplay.label}</span>
                        <Badge
                          variant="outline"
                          className="text-xs"
                        >
                          {entry.User?.role?.replace(/_/g, " ") ?? "Unknown Role"}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span title={formatDate(entry.timestamp)}>
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </span>
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                      <User className="h-3 w-3" />
                      <span>
                        {entry.User?.name ?? entry.User?.email ?? "Unknown User"}
                      </span>
                    </div>

                    {/* Changes Summary (AC17) */}
                    {changesText.length > 0 && (
                      <div className="mt-2 text-sm text-gray-700">
                        {changesText.slice(0, isExpanded ? undefined : 2).map((text, i) => (
                          <p key={i} className="truncate" title={text}>
                            • {text}
                          </p>
                        ))}
                        {!isExpanded && changesText.length > 2 && (
                          <p className="text-gray-400 italic">
                            +{changesText.length - 2} more changes
                          </p>
                        )}
                      </div>
                    )}

                    {/* Expand/Collapse Button for JSON View (AC18) */}
                    {entry.changes && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs text-gray-500"
                        onClick={() => toggleExpanded(entry.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show details
                          </>
                        )}
                      </Button>
                    )}

                    {/* Expanded JSON View */}
                    {isExpanded && entry.changes && (
                      <div className="mt-2 p-3 bg-gray-100 rounded-md overflow-x-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination (AC19) */}
        {auditData.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">
              Page {page} of {auditData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(auditData.totalPages, p + 1))}
                disabled={page >= auditData.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
