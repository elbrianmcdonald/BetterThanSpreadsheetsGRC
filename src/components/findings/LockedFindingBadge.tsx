"use client";

/**
 * Locked Finding Badge Component
 *
 * Story 7.4: Finding Acceptance (AC10-AC12)
 *
 * Displays a visual indicator when a finding has been accepted and locked:
 * - AC10: Shows "Locked" indicator after acceptance
 * - AC11: Indicates finding cannot be edited
 * - AC12: Displays locked timestamp
 *
 * @see Story 7.4: Finding Acceptance (Creates Risk Assessment)
 */

import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

interface LockedFindingBadgeProps {
  /** When the finding was accepted/locked */
  acceptedAt: Date | string | null;
  /** Name of the user who accepted the finding */
  acceptedByName?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a badge indicating the finding is locked after acceptance.
 *
 * @example
 * ```tsx
 * <LockedFindingBadge
 *   acceptedAt={finding.acceptedAt}
 *   acceptedByName={finding.accepter?.name}
 * />
 * ```
 */
export function LockedFindingBadge({
  acceptedAt,
  acceptedByName,
  className,
}: LockedFindingBadgeProps) {
  // Only show if finding has been accepted
  if (!acceptedAt) {
    return null;
  }

  const acceptedDate = new Date(acceptedAt);
  const formattedDate = format(acceptedDate, "MMM d, yyyy 'at' h:mm a");
  const shortDate = format(acceptedDate, "MMM d, yyyy");

  const tooltipContent = acceptedByName
    ? `Locked on ${formattedDate} by ${acceptedByName}`
    : `Locked on ${formattedDate}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`gap-1.5 cursor-help ${className ?? ""}`}
          >
            <Lock className="h-3 w-3" />
            <span>
              Locked {shortDate}
              {acceptedByName && ` by ${acceptedByName}`}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
          <p className="text-xs text-muted-foreground mt-1">
            This finding cannot be edited after acceptance.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
