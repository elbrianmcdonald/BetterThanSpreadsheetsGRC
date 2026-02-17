"use client";

/**
 * Framework Mapping Preview Component
 *
 * Shows a real-time preview of which framework controls will be satisfied
 * based on the selected control domains. This is the "Evidence Amplification"
 * visualization that demonstrates BetterThanSpreadsheetsGRC's value.
 *
 * @see Story 3.4: AC7-AC12 - Real-time mapping preview
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { FrameworkControlGroup, ExpandCollapseAll } from "./FrameworkControlGroup";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FrameworkMappingPreviewProps {
  /** Control domain IDs to calculate mappings for */
  controlDomainIds: string[];
  /** Whether to show in compact mode (fewer details) */
  compact?: boolean;
  /** Callback when a control is clicked */
  onControlClick?: (control: {
    controlId: string;
    title: string;
    description: string;
    guidance?: string | null;
  }) => void;
}

export function FrameworkMappingPreview({
  controlDomainIds,
  compact = false,
  onControlClick,
}: FrameworkMappingPreviewProps) {
  const [allExpanded, setAllExpanded] = useState(false);

  // Fetch mappings reactively when controlDomainIds change
  const {
    data: mappings,
    isLoading,
    isError,
    error,
  } = api.evidence.getFrameworkMappings.useQuery(
    { controlDomainIds },
    {
      enabled: controlDomainIds.length > 0,
      // Cache for 5 minutes (AC22)
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  );

  // Don't show anything if no domains selected
  if (controlDomainIds.length === 0) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Calculating framework mappings...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load framework mappings: {error?.message}</span>
        </div>
      </div>
    );
  }

  // No mappings found
  if (!mappings || mappings.totalControlCount === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-3 text-amber-700">
          <AlertCircle className="h-5 w-5" />
          <span>No active frameworks found. Activate frameworks to see control mappings.</span>
        </div>
      </div>
    );
  }

  const toggleAllExpanded = () => setAllExpanded(!allExpanded);

  return (
    <div className="space-y-4">
      {/* Header with total count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Framework Controls Satisfied
            </h3>
            <p className="text-sm text-gray-600">
              {mappings.totalControlCount} control{mappings.totalControlCount !== 1 ? "s" : ""} across{" "}
              {mappings.frameworkCount} framework{mappings.frameworkCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {!compact && mappings.frameworks.length > 1 && (
          <ExpandCollapseAll allExpanded={allExpanded} onToggle={toggleAllExpanded} />
        )}
      </div>

      {/* Total control count badge (AC12) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold">
          <span className="text-2xl">{mappings.totalControlCount}</span>
          <span className="text-sm">total controls</span>
        </div>
        {/* Framework breakdown */}
        {mappings.frameworks.map((framework) => (
          <div
            key={framework.frameworkCode}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
              framework.frameworkCode === "ISO27001" && "bg-blue-100 text-blue-700",
              framework.frameworkCode === "SOC2" && "bg-green-100 text-green-700",
              framework.frameworkCode === "NISTCSF" && "bg-purple-100 text-purple-700",
              !["ISO27001", "SOC2", "NISTCSF"].includes(framework.frameworkCode) &&
                "bg-gray-100 text-gray-700"
            )}
          >
            <span>{framework.frameworkName}:</span>
            <span className="font-semibold">{framework.controlCount}</span>
          </div>
        ))}
      </div>

      {/* Framework groups */}
      {!compact && (
        <div className="space-y-3">
          {mappings.frameworks.map((framework) => (
            <FrameworkControlGroup
              key={framework.frameworkCode}
              frameworkName={framework.frameworkName}
              frameworkCode={framework.frameworkCode}
              frameworkVersion={framework.frameworkVersion}
              controls={framework.controls}
              defaultExpanded={allExpanded}
              clickable={!!onControlClick}
              onControlClick={onControlClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for evidence list badges
 * Shows just the total count with a tooltip showing framework breakdown
 */
interface ControlCountBadgeProps {
  /** Control domain IDs to calculate count for */
  controlDomainIds: string[];
  /** Optional className for styling */
  className?: string;
}

export function ControlCountBadge({
  controlDomainIds,
  className,
}: ControlCountBadgeProps) {
  const { data: mappings, isLoading } = api.evidence.getFrameworkMappings.useQuery(
    { controlDomainIds },
    {
      enabled: controlDomainIds.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }
  );

  if (controlDomainIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-gray-400", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  if (!mappings || mappings.totalControlCount === 0) {
    return null;
  }

  // Build tooltip content
  const tooltipContent = mappings.frameworks
    .map((f) => `${f.frameworkName}: ${f.controlCount}`)
    .join("\n");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
        "bg-green-100 text-green-700",
        className
      )}
      title={tooltipContent}
    >
      <CheckCircle2 className="h-3 w-3" />
      {mappings.totalControlCount} controls
    </span>
  );
}
