"use client";

/**
 * Attack Chain Visualization Component
 *
 * Story 16.9: Attack Chain Visualization Component
 *
 * Visual representation of the MITRE ATT&CK attack chain:
 * - AC1: Component accepts risk with MITRE data
 * - AC2: Horizontal flow diagram: Initial Access → Steps → Objectives
 * - AC3: Each node shows technique ID and abbreviated name
 * - AC4: Nodes colored by tactic category
 * - AC5: Connecting arrows between steps
 * - AC6: Hover on node shows full technique name and description
 * - AC10: Responsive design for different screen sizes
 *
 * @see Story 16.9: Attack Chain Visualization Component
 */

import { useMemo, useState } from "react";
import { ExternalLink, ChevronRight, Target, Footprints, Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Technique data structure
 */
interface TechniqueData {
  id: string;
  externalId: string;
  name: string;
  description?: string | null;
  tactics?: { id: string; externalId: string; name: string; shortName: string }[];
}

/**
 * Threat step data structure
 */
interface ThreatStep {
  id: string;
  stepOrder: number;
  technique: TechniqueData;
}

/**
 * Threat objective data structure
 */
interface ThreatObjective {
  id: string;
  technique: TechniqueData;
}

/**
 * Props for AttackChainVisualization
 */
interface AttackChainVisualizationProps {
  /** Initial access vector technique */
  initialAccessVector?: TechniqueData | null;
  /** Ordered threat steps */
  threatSteps?: ThreatStep[];
  /** Threat objectives */
  threatObjectives?: ThreatObjective[];
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Get tactic-based color for node background and border
 * AC4: Nodes colored by tactic category
 */
function getTacticNodeColors(shortName: string): {
  bg: string;
  border: string;
  text: string;
  accent: string;
} {
  const colors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    reconnaissance: {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-300 dark:border-purple-700",
      text: "text-purple-800 dark:text-purple-200",
      accent: "bg-purple-500",
    },
    "resource-development": {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-300 dark:border-indigo-700",
      text: "text-indigo-800 dark:text-indigo-200",
      accent: "bg-indigo-500",
    },
    "initial-access": {
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-300 dark:border-red-700",
      text: "text-red-800 dark:text-red-200",
      accent: "bg-red-500",
    },
    execution: {
      bg: "bg-orange-50 dark:bg-orange-950/40",
      border: "border-orange-300 dark:border-orange-700",
      text: "text-orange-800 dark:text-orange-200",
      accent: "bg-orange-500",
    },
    persistence: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-300 dark:border-amber-700",
      text: "text-amber-800 dark:text-amber-200",
      accent: "bg-amber-500",
    },
    "privilege-escalation": {
      bg: "bg-yellow-50 dark:bg-yellow-950/40",
      border: "border-yellow-300 dark:border-yellow-700",
      text: "text-yellow-800 dark:text-yellow-200",
      accent: "bg-yellow-500",
    },
    "defense-evasion": {
      bg: "bg-lime-50 dark:bg-lime-950/40",
      border: "border-lime-300 dark:border-lime-700",
      text: "text-lime-800 dark:text-lime-200",
      accent: "bg-lime-500",
    },
    "credential-access": {
      bg: "bg-green-50 dark:bg-green-950/40",
      border: "border-green-300 dark:border-green-700",
      text: "text-green-800 dark:text-green-200",
      accent: "bg-green-500",
    },
    discovery: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-300 dark:border-emerald-700",
      text: "text-emerald-800 dark:text-emerald-200",
      accent: "bg-emerald-500",
    },
    "lateral-movement": {
      bg: "bg-teal-50 dark:bg-teal-950/40",
      border: "border-teal-300 dark:border-teal-700",
      text: "text-teal-800 dark:text-teal-200",
      accent: "bg-teal-500",
    },
    collection: {
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      border: "border-cyan-300 dark:border-cyan-700",
      text: "text-cyan-800 dark:text-cyan-200",
      accent: "bg-cyan-500",
    },
    "command-and-control": {
      bg: "bg-sky-50 dark:bg-sky-950/40",
      border: "border-sky-300 dark:border-sky-700",
      text: "text-sky-800 dark:text-sky-200",
      accent: "bg-sky-500",
    },
    exfiltration: {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-300 dark:border-blue-700",
      text: "text-blue-800 dark:text-blue-200",
      accent: "bg-blue-500",
    },
    impact: {
      bg: "bg-violet-50 dark:bg-violet-950/40",
      border: "border-violet-300 dark:border-violet-700",
      text: "text-violet-800 dark:text-violet-200",
      accent: "bg-violet-500",
    },
  };
  return colors[shortName] || {
    bg: "bg-gray-50 dark:bg-gray-900",
    border: "border-gray-300 dark:border-gray-700",
    text: "text-gray-800 dark:text-gray-200",
    accent: "bg-gray-500",
  };
}

/**
 * Abbreviate technique name for display
 * AC3: Each node shows technique ID and abbreviated name
 */
function abbreviateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + "...";
}

/**
 * Individual technique node in the attack chain
 */
function TechniqueNode({
  technique,
  label,
  icon: Icon,
  compact = false,
}: {
  technique: TechniqueData;
  label?: string;
  icon?: React.ElementType;
  compact?: boolean;
}) {
  const primaryTactic = technique.tactics?.[0];
  const colors = getTacticNodeColors(primaryTactic?.shortName ?? "");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative rounded-lg border-2 transition-all hover:shadow-md cursor-pointer",
              colors.bg,
              colors.border,
              compact ? "p-2 min-w-[100px]" : "p-3 min-w-[140px]"
            )}
          >
            {/* Tactic accent bar */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1 rounded-l-md",
                colors.accent
              )}
            />

            {/* Label badge */}
            {label && (
              <Badge
                variant="outline"
                className={cn(
                  "absolute -top-2 left-2 text-[10px] px-1.5 py-0",
                  colors.text
                )}
              >
                {label}
              </Badge>
            )}

            <div className={cn("pl-2", label && "mt-1")}>
              {/* Icon and technique ID */}
              <div className="flex items-center gap-1 mb-1">
                {Icon && <Icon className={cn("h-3 w-3", colors.text)} />}
                <span className={cn("font-mono text-xs font-bold", colors.text)}>
                  {technique.externalId}
                </span>
              </div>

              {/* Technique name */}
              <p className={cn("text-xs font-medium leading-tight", colors.text)}>
                {abbreviateName(technique.name, compact ? 15 : 25)}
              </p>

              {/* Tactic name */}
              {primaryTactic && !compact && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {primaryTactic.name}
                </p>
              )}
            </div>
          </div>
        </TooltipTrigger>
        {/* AC6: Hover on node shows full technique name and description */}
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {technique.externalId}
              </Badge>
              <span className="font-medium">{technique.name}</span>
            </div>
            {primaryTactic && (
              <p className="text-xs text-muted-foreground">
                Tactic: {primaryTactic.name}
              </p>
            )}
            {technique.description && (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {technique.description}
              </p>
            )}
            <a
              href={`https://attack.mitre.org/techniques/${technique.externalId.replace(".", "/")}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on MITRE ATT&CK
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Arrow connector between nodes
 * AC5: Connecting arrows between steps
 */
function ArrowConnector({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center", compact ? "px-1" : "px-2")}>
      <ChevronRight
        className={cn(
          "text-muted-foreground",
          compact ? "h-4 w-4" : "h-5 w-5"
        )}
      />
    </div>
  );
}

/**
 * Section label for the attack chain
 */
function SectionLabel({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 mb-2", className)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/**
 * Main Attack Chain Visualization Component
 * AC1: Component accepts risk with MITRE data
 * AC2: Horizontal flow diagram
 */
export function AttackChainVisualization({
  initialAccessVector,
  threatSteps = [],
  threatObjectives = [],
  className,
  compact = false,
}: AttackChainVisualizationProps) {
  // Sort steps by order
  const sortedSteps = useMemo(
    () => [...threatSteps].sort((a, b) => a.stepOrder - b.stepOrder),
    [threatSteps]
  );

  // Check if there's any data to display
  const hasData =
    initialAccessVector || sortedSteps.length > 0 || threatObjectives.length > 0;

  if (!hasData) {
    return null;
  }

  // Calculate total nodes
  const totalNodes =
    (initialAccessVector ? 1 : 0) + sortedSteps.length + threatObjectives.length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-red-500" />
          Attack Chain
          <Badge variant="secondary" className="ml-auto">
            {totalNodes} technique{totalNodes !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* AC10: Responsive design - scrollable container for overflow */}
        <div className="overflow-x-auto">
          <div className={cn(
            "flex items-stretch gap-0 min-w-max",
            compact ? "py-2" : "py-4"
          )}>
            {/* Initial Access Section */}
            {initialAccessVector && (
              <div className="flex flex-col">
                <SectionLabel label="Initial Access" icon={Target} className="text-red-600" />
                <div className="flex items-center">
                  <TechniqueNode
                    technique={initialAccessVector}
                    icon={Target}
                    compact={compact}
                  />
                </div>
              </div>
            )}

            {/* Arrow to steps */}
            {initialAccessVector && (sortedSteps.length > 0 || threatObjectives.length > 0) && (
              <div className="flex items-end pb-[22px]">
                <ArrowConnector compact={compact} />
              </div>
            )}

            {/* Threat Steps Section */}
            {sortedSteps.length > 0 && (
              <div className="flex flex-col">
                <SectionLabel label="Attack Steps" icon={Footprints} className="text-amber-600" />
                <div className="flex items-center">
                  {sortedSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <TechniqueNode
                        technique={step.technique}
                        label={`Step ${index + 1}`}
                        compact={compact}
                      />
                      {index < sortedSteps.length - 1 && (
                        <ArrowConnector compact={compact} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Arrow to objectives */}
            {sortedSteps.length > 0 && threatObjectives.length > 0 && (
              <div className="flex items-end pb-[22px]">
                <ArrowConnector compact={compact} />
              </div>
            )}

            {/* Arrow from initial access to objectives (when no steps) */}
            {initialAccessVector && sortedSteps.length === 0 && threatObjectives.length > 0 && (
              <div className="flex items-end pb-[22px]">
                <ArrowConnector compact={compact} />
              </div>
            )}

            {/* Objectives Section */}
            {threatObjectives.length > 0 && (
              <div className="flex flex-col">
                <SectionLabel label="Objectives" icon={Flag} className="text-violet-600" />
                <div className="flex items-center gap-2">
                  {threatObjectives.map((objective, index) => (
                    <div key={objective.id} className="flex items-center">
                      <TechniqueNode
                        technique={objective.technique}
                        icon={Flag}
                        compact={compact}
                      />
                      {index < threatObjectives.length - 1 && (
                        <div className="w-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Tactic Categories:
          </p>
          <div className="flex flex-wrap gap-2">
            {initialAccessVector?.tactics?.[0] && (
              <LegendItem
                color={getTacticNodeColors(initialAccessVector.tactics[0].shortName).accent}
                label={initialAccessVector.tactics[0].name}
              />
            )}
            {sortedSteps.map((step) => {
              const tactic = step.technique.tactics?.[0];
              if (!tactic) return null;
              return (
                <LegendItem
                  key={`${step.id}-legend`}
                  color={getTacticNodeColors(tactic.shortName).accent}
                  label={tactic.name}
                />
              );
            })}
            {threatObjectives.map((obj) => {
              const tactic = obj.technique.tactics?.[0];
              if (!tactic) return null;
              return (
                <LegendItem
                  key={`${obj.id}-legend`}
                  color={getTacticNodeColors(tactic.shortName).accent}
                  label={tactic.name}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Legend item showing tactic color
 */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function AttackChainCompact({
  initialAccessVector,
  threatSteps = [],
  threatObjectives = [],
  className,
}: Omit<AttackChainVisualizationProps, "compact">) {
  return (
    <AttackChainVisualization
      initialAccessVector={initialAccessVector}
      threatSteps={threatSteps}
      threatObjectives={threatObjectives}
      className={className}
      compact
    />
  );
}
