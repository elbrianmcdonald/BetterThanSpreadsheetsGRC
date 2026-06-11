"use client";

/**
 * Comment Type Badge Component
 *
 * Story 4.11: Risk Comments and Collaboration (AC25, AC35-AC38)
 *
 * Displays a color-coded badge for comment types with tooltips:
 * - AC25: Comment type badges color-coded
 * - AC35: Comment type selector includes tooltips explaining each type
 * - AC36: QUESTION: "Ask for clarification or additional information"
 * - AC37: REMEDIATION_UPDATE: "Provide progress update on remediation work"
 * - AC38: DECISION_RATIONALE: "Explain why a particular decision was made"
 *
 * @see Story 4.11: Risk Comments and Collaboration
 */

import { CommentType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  Brain,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Comment type configuration with colors, icons, labels, and tooltips
 */
interface CommentTypeConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
  label: string;
  tooltip: string;
}

export const commentTypeConfig: Record<CommentType, CommentTypeConfig> = {
  [CommentType.GENERAL]: {
    color: "text-secondary-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    icon: MessageSquare,
    label: "General",
    tooltip: "General comment or note",
  },
  [CommentType.QUESTION]: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-transparent",
    icon: HelpCircle,
    label: "Question",
    tooltip: "Ask for clarification or additional information",
  },
  [CommentType.REMEDIATION_UPDATE]: {
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-transparent",
    icon: CheckCircle2,
    label: "Remediation Update",
    tooltip: "Provide progress update on remediation work",
  },
  [CommentType.DECISION_RATIONALE]: {
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-transparent",
    icon: Brain,
    label: "Decision Rationale",
    tooltip: "Explain why a particular decision was made",
  },
  [CommentType.VERIFICATION_NOTE]: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-transparent",
    icon: Search,
    label: "Verification Note",
    tooltip: "Notes from remediation verification by GRC Analyst",
  },
};

interface CommentTypeBadgeProps {
  /** The comment type to display */
  type: CommentType;
  /** Size variant of the badge */
  size?: "sm" | "md" | "lg";
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Whether to show the tooltip */
  showTooltip?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Returns the label for a comment type
 */
export function getCommentTypeLabel(type: CommentType): string {
  return commentTypeConfig[type].label;
}

/**
 * Returns the tooltip/description for a comment type
 */
export function getCommentTypeTooltip(type: CommentType): string {
  return commentTypeConfig[type].tooltip;
}

/**
 * CommentTypeBadge component
 * Displays a color-coded badge with optional icon and tooltip
 */
export function CommentTypeBadge({
  type,
  size = "sm",
  showIcon = true,
  showTooltip = true,
  className,
}: CommentTypeBadgeProps) {
  const config = commentTypeConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium inline-flex items-center gap-1 border",
        config.bgColor,
        config.color,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Get all comment types with their configuration
 * Useful for populating dropdowns and selectors
 */
export function getAllCommentTypes(): Array<{
  value: CommentType;
  label: string;
  tooltip: string;
  icon: LucideIcon;
}> {
  return Object.entries(commentTypeConfig).map(([type, config]) => ({
    value: type as CommentType,
    label: config.label,
    tooltip: config.tooltip,
    icon: config.icon,
  }));
}
