"use client";

/**
 * Framework Control Group Component
 *
 * Renders a collapsible accordion group for displaying framework controls.
 * Shows framework name with control count in header, and lists controls in body.
 *
 * @see Story 3.4: AC9, AC14 - Framework grouping UI
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface MappedControl {
  controlId: string;
  title: string;
  description: string;
  guidance?: string | null;
  confidence: number;
}

interface FrameworkControlGroupProps {
  /** Framework display name */
  frameworkName: string;
  /** Framework code (e.g., ISO27001, SOC2, NISTCSF) */
  frameworkCode: string;
  /** Framework version */
  frameworkVersion?: string;
  /** List of controls in this framework */
  controls: MappedControl[];
  /** Whether the group is initially expanded */
  defaultExpanded?: boolean;
  /** Callback when a control is clicked */
  onControlClick?: (control: MappedControl) => void;
  /** Whether controls are clickable */
  clickable?: boolean;
}

/**
 * Get framework-specific color classes
 */
function getFrameworkColor(code: string): string {
  switch (code.toUpperCase()) {
    case "ISO27001":
      return "bg-blue-50 border-blue-200 text-blue-700";
    case "SOC2":
      return "bg-green-50 border-green-200 text-green-700";
    case "NISTCSF":
      return "bg-purple-50 border-purple-200 text-purple-700";
    default:
      return "bg-gray-50 border-gray-200 text-gray-700";
  }
}

/**
 * Get framework-specific icon color
 */
function getIconColor(code: string): string {
  switch (code.toUpperCase()) {
    case "ISO27001":
      return "text-blue-500";
    case "SOC2":
      return "text-green-500";
    case "NISTCSF":
      return "text-purple-500";
    default:
      return "text-gray-500";
  }
}

export function FrameworkControlGroup({
  frameworkName,
  frameworkCode,
  frameworkVersion,
  controls,
  defaultExpanded = false,
  onControlClick,
  clickable = false,
}: FrameworkControlGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colorClasses = getFrameworkColor(frameworkCode);
  const iconColor = getIconColor(frameworkCode);

  return (
    <div className={cn("border rounded-lg overflow-hidden", colorClasses)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "hover:bg-opacity-80 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        )}
      >
        <div className="flex items-center gap-3">
          <Shield className={cn("h-5 w-5", iconColor)} />
          <div className="text-left">
            <span className="font-medium">{frameworkName}</span>
            {frameworkVersion && (
              <span className="text-xs opacity-70 ml-2">v{frameworkVersion}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {controls.length} control{controls.length !== 1 ? "s" : ""}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Body */}
      {isExpanded && controls.length > 0 && (
        <div className="border-t border-inherit bg-white">
          <ul className="divide-y divide-gray-100">
            {controls.map((control) => (
              <li key={control.controlId}>
                {clickable && onControlClick ? (
                  <button
                    type="button"
                    onClick={() => onControlClick(control)}
                    className={cn(
                      "w-full text-left px-4 py-3",
                      "hover:bg-gray-50 transition-colors",
                      "focus:outline-none focus:bg-gray-50"
                    )}
                  >
                    <ControlItem control={control} />
                  </button>
                ) : (
                  <div className="px-4 py-3">
                    <ControlItem control={control} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ControlItem({ control }: { control: MappedControl }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-sm font-medium text-gray-700 min-w-[80px]">
        {control.controlId}
      </span>
      <span className="text-sm text-gray-600 flex-1">{control.title}</span>
    </div>
  );
}

/**
 * Expand/Collapse All button component
 */
interface ExpandCollapseAllProps {
  /** Whether all groups are expanded */
  allExpanded: boolean;
  /** Callback to toggle all groups */
  onToggle: () => void;
}

export function ExpandCollapseAll({ allExpanded, onToggle }: ExpandCollapseAllProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
    >
      {allExpanded ? "Collapse All" : "Expand All"}
    </button>
  );
}
