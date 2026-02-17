"use client";

/**
 * History Viewer Component
 *
 * Story 4.5: History Viewer UI
 * AC4: Timeline of all changes with timestamp, user name, change type, changed fields summary
 * AC5: Diff view showing old/new values with highlighting
 * AC6: CREATE entries show old values as "—"
 * AC7: DELETE entries show new values as "Deleted"
 * AC8: Consistent UI pattern across Strategy, Goal, Objective
 */

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Clock,
  User,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
} from "lucide-react";
import { ChangeType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

/** History entry from API */
interface HistoryEntry {
  id: string;
  changeType: ChangeType;
  changedFields: Record<string, { old: unknown; new: unknown }>;
  changedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  changedAt: Date | string;
}

interface HistoryViewerProps {
  history: HistoryEntry[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  entityType: "Strategy" | "Goal" | "Objective";
}

/** Change type badge configuration */
const changeTypeConfig: Record<ChangeType, { color: string; icon: React.ReactNode; label: string }> = {
  CREATE: {
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <Plus className="h-3 w-3" />,
    label: "Created",
  },
  UPDATE: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Pencil className="h-3 w-3" />,
    label: "Updated",
  },
  DELETE: {
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <Trash2 className="h-3 w-3" />,
    label: "Deleted",
  },
};

/** Field name display mapping for better readability */
const fieldDisplayNames: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  fiscalYearStart: "Fiscal Year Start",
  fiscalYearEnd: "Fiscal Year End",
  ownerId: "Owner",
  createdById: "Created By",
  organizationId: "Organization",
  targetDate: "Target Date",
  sortOrder: "Sort Order",
  strategyId: "Strategy",
  dueDate: "Due Date",
  kpiType: "KPI Type",
  targetValue: "Target Value",
  currentValue: "Current Value",
  goalId: "Goal",
};

/** Format a value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value instanceof Date) {
    return format(new Date(value), "MMM d, yyyy");
  }
  if (typeof value === "string") {
    // Check if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return format(new Date(value), "MMM d, yyyy");
      } catch {
        return value;
      }
    }
    // Truncate long strings
    if (value.length > 100) {
      return value.substring(0, 100) + "...";
    }
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return JSON.stringify(value);
}

/** Single field change diff display */
function FieldDiff({
  fieldName,
  oldValue,
  newValue,
  changeType,
}: {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: ChangeType;
}) {
  const displayName = fieldDisplayNames[fieldName] || fieldName;

  return (
    <div className="flex items-start gap-4 py-2 border-b last:border-0">
      <div className="w-32 flex-shrink-0 font-medium text-sm text-muted-foreground">
        {displayName}
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* AC6: Old value - show "—" for CREATE */}
        <div className="text-sm">
          {changeType === ChangeType.CREATE ? (
            <span className="text-muted-foreground italic">—</span>
          ) : (
            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">
              {formatValue(oldValue)}
            </span>
          )}
        </div>
        {/* AC7: New value - show "Deleted" for DELETE */}
        <div className="text-sm">
          {changeType === ChangeType.DELETE ? (
            <span className="text-muted-foreground italic">Deleted</span>
          ) : (
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
              {formatValue(newValue)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Single history entry with expandable diff */
function HistoryEntryCard({ entry }: { entry: HistoryEntry }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = changeTypeConfig[entry.changeType];
  const changedFieldNames = Object.keys(entry.changedFields);
  const changedAt = new Date(entry.changedAt);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Timeline connector line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center ${config.color} border`}
      >
        {config.icon}
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-card rounded-lg border p-3">
          {/* Header */}
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {changedFieldNames.length} field{changedFieldNames.length !== 1 ? "s" : ""} changed
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {entry.changedBy.name || entry.changedBy.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span title={format(changedAt, "PPpp")}>
                        {formatDistanceToNow(changedAt, { addSuffix: true })}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* AC5: Expandable diff view */}
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t">
              <div className="grid grid-cols-[1fr_1fr] gap-4 mb-2 px-2">
                <div className="text-xs font-medium text-muted-foreground ml-32">
                  Previous Value
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  New Value
                </div>
              </div>
              <div className="space-y-0">
                {changedFieldNames.map((fieldName) => {
                  const field = entry.changedFields[fieldName];
                  if (!field) return null;
                  return (
                    <FieldDiff
                      key={fieldName}
                      fieldName={fieldName}
                      oldValue={field.old}
                      newValue={field.new}
                      changeType={entry.changeType}
                    />
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/** Main history viewer component */
export function HistoryViewer({
  history,
  total,
  hasMore,
  isLoading,
  onLoadMore,
  entityType,
}: HistoryViewerProps) {
  if (history.length === 0 && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </CardTitle>
          <CardDescription>
            Track changes to this {entityType.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No history records yet.</p>
            <p className="text-sm">Changes will appear here when made.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              History
              {total > 0 && (
                <Badge variant="secondary">{total}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Track changes to this {entityType.toLowerCase()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-0">
            {history.map((entry) => (
              <HistoryEntryCard key={entry.id} entry={entry} />
            ))}
          </div>

          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load More ({total - history.length} remaining)</>
                )}
              </Button>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
