"use client";

/**
 * Stale Draft Item Component
 *
 * Displays a single stale draft assessment in the StaleDraftsWidget.
 *
 * Story 7.13: Stale Draft Dashboard Widget
 * AC8: Each item shows: identifier, title, days stale, owner
 * AC15: Clicking assessment navigates to finding detail page
 * AC20: Days stale shown with visual indicator
 * AC21: Owner name displayed for accountability
 */

import Link from "next/link";
import { Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  calculateDaysStale,
  getDaysStaleBgColor,
  formatDaysStale,
} from "@/lib/utils/stale-drafts";

interface StaleDraftItemProps {
  assessment: {
    id: string;
    identifier: string;
    title: string;
    updatedAt: Date;
    finding: {
      id: string;
      identifier: string;
    } | null;
    owner: {
      id: string;
      name: string | null;
    } | null;
  };
}

/**
 * Renders a single stale draft assessment item.
 *
 * @example
 * ```tsx
 * <StaleDraftItem assessment={staleDraft} />
 * ```
 */
export function StaleDraftItem({ assessment }: StaleDraftItemProps) {
  const daysStale = calculateDaysStale(assessment.updatedAt);
  const daysColorClass = getDaysStaleBgColor(daysStale);

  // Link to finding detail page if finding exists, otherwise to assessment
  const href = assessment.finding
    ? `/findings/${assessment.finding.id}`
    : `/assessments/${assessment.id}`;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        {/* Identifier and Title */}
        <Link
          href={href}
          className="text-sm font-medium text-primary hover:underline block"
        >
          {assessment.identifier}
        </Link>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {assessment.title}
        </p>

        {/* Owner */}
        {assessment.owner && (
          <div className="flex items-center gap-1 mt-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {assessment.owner.name ?? "Unknown"}
            </span>
          </div>
        )}
      </div>

      {/* Days Stale Badge */}
      <Badge
        variant="outline"
        className={`${daysColorClass} flex items-center gap-1 shrink-0`}
      >
        <Clock className="h-3 w-3" />
        {formatDaysStale(daysStale)}
      </Badge>
    </div>
  );
}
