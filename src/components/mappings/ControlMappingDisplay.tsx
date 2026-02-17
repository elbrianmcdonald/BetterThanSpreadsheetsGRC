"use client";

/**
 * Control Mapping Display Component
 *
 * Displays mapped OSCAL controls for a selected control domain.
 * Used in evidence tagging flow to preview which controls will be satisfied.
 *
 * @see Story 2.4: OSCAL Translation Engine (AC9.1-AC9.6)
 */

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, CheckCircle2, Shield } from "lucide-react";

// Framework code to display name mapping
const frameworkDisplayNames: Record<string, string> = {
  ISO27001: "ISO 27001",
  SOC2: "SOC 2",
  NISTCSF: "NIST CSF",
};

// Framework code to color mapping
const frameworkColors: Record<string, string> = {
  ISO27001: "bg-blue-100 text-blue-800",
  SOC2: "bg-green-100 text-green-800",
  NISTCSF: "bg-purple-100 text-purple-800",
};

interface ControlMappingDisplayProps {
  /** Control domain ID to display mappings for */
  controlDomainId: string;
  /** Optional: Filter to specific framework codes */
  frameworkCodes?: string[];
  /** Optional: Minimum confidence threshold (default: 0) */
  minConfidence?: number;
  /** Optional: Show as compact inline badges instead of accordion */
  compact?: boolean;
  /** Optional: Custom class name */
  className?: string;
}

export function ControlMappingDisplay({
  controlDomainId,
  frameworkCodes,
  minConfidence = 0,
  compact = false,
  className = "",
}: ControlMappingDisplayProps) {
  const { data, isLoading, error } = api.mapping.translateDomainToControls.useQuery(
    {
      controlDomainId,
      frameworkCodes,
      minConfidence,
    },
    { enabled: !!controlDomainId }
  );

  if (!controlDomainId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading mapped controls...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-red-500 ${className}`}>
        Error loading mappings: {error.message}
      </div>
    );
  }

  if (!data || data.frameworks.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No control mappings found for this domain.
      </div>
    );
  }

  // Compact view - inline badges
  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {data.frameworks.map((framework) => (
          <Badge
            key={framework.frameworkCode}
            variant="outline"
            className={`text-xs ${frameworkColors[framework.frameworkCode] ?? ""}`}
          >
            {frameworkDisplayNames[framework.frameworkCode] ?? framework.frameworkCode}:{" "}
            {framework.controls.length}
          </Badge>
        ))}
      </div>
    );
  }

  // Full accordion view
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          Mapped Controls ({data.totalControls} total)
        </span>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {data.frameworks.map((framework) => (
          <AccordionItem
            key={framework.frameworkCode}
            value={framework.frameworkCode}
          >
            <AccordionTrigger className="text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={frameworkColors[framework.frameworkCode] ?? ""}
                >
                  {frameworkDisplayNames[framework.frameworkCode] ??
                    framework.frameworkCode}
                </Badge>
                <span className="text-gray-500">
                  {framework.controls.length} control
                  {framework.controls.length !== 1 ? "s" : ""}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
                {framework.controls.map((control) => (
                  <div
                    key={control.controlId}
                    className="flex items-center gap-1 text-xs"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="font-mono">{control.controlId}</span>
                    {control.confidence < 100 && (
                      <span className="text-gray-400">
                        ({control.confidence}%)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/**
 * Evidence Amplification Preview Component
 *
 * Shows a summary of how many controls will be satisfied
 * when evidence is tagged with specific control domains.
 */
interface EvidenceAmplificationPreviewProps {
  /** Array of control domain IDs that will be tagged */
  controlDomainIds: string[];
  /** Optional: Custom class name */
  className?: string;
}

export function EvidenceAmplificationPreview({
  controlDomainIds,
  className = "",
}: EvidenceAmplificationPreviewProps) {
  // Fetch mappings for all selected domains
  const queries = controlDomainIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api.mapping.translateDomainToControls.useQuery(
      { controlDomainId: id },
      { enabled: !!id }
    )
  );

  const isLoading = queries.some((q) => q.isLoading);
  const hasData = queries.some((q) => q.data);

  if (controlDomainIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Calculating compliance coverage...</span>
      </div>
    );
  }

  if (!hasData) {
    return null;
  }

  // Aggregate control counts by framework
  const frameworkTotals = new Map<string, Set<string>>();

  for (const query of queries) {
    if (query.data) {
      for (const framework of query.data.frameworks) {
        if (!frameworkTotals.has(framework.frameworkCode)) {
          frameworkTotals.set(framework.frameworkCode, new Set());
        }
        for (const control of framework.controls) {
          frameworkTotals.get(framework.frameworkCode)!.add(control.controlId);
        }
      }
    }
  }

  const totalControls = Array.from(frameworkTotals.values()).reduce(
    (sum, set) => sum + set.size,
    0
  );

  if (totalControls === 0) {
    return null;
  }

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800">
          Evidence Amplification
        </span>
      </div>
      <p className="text-sm text-green-700 mb-3">
        This evidence will satisfy <strong>{totalControls}</strong> control
        {totalControls !== 1 ? "s" : ""} across {frameworkTotals.size} framework
        {frameworkTotals.size !== 1 ? "s" : ""}:
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from(frameworkTotals.entries()).map(([fwCode, controls]) => (
          <Badge
            key={fwCode}
            variant="outline"
            className={`${frameworkColors[fwCode] ?? ""} border-0`}
          >
            {frameworkDisplayNames[fwCode] ?? fwCode}: {controls.size}
          </Badge>
        ))}
      </div>
    </div>
  );
}
