"use client";

/**
 * Risk Finding Display Component
 *
 * Displays risk finding details including description, severity, affected systems,
 * and technical details with proper markdown rendering.
 *
 * Story 4.3: Risk Finding Documentation (AC23-AC27)
 * AC23: Risk detail page shows finding description as rendered markdown
 * AC24: Risk detail page shows affected systems as bulleted list
 * AC25: Risk detail page shows severity with color-coded badge
 * AC26: Risk detail page shows CVE ID as clickable link (if present)
 * AC27: Risk detail page shows technical details in collapsible section
 *
 * @see Story 4.3: Risk Finding Documentation
 */

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Server,
  Calendar,
  Search,
  Tag,
  Shield,
  ShieldCheck,
  ShieldPlus,
} from "lucide-react";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { RiskOrigin } from "@/lib/risk/origin";
import type { Severity, RiskFindingSource, RiskStatus } from "@prisma/client";

/**
 * Finding source display labels
 */
const FINDING_SOURCE_LABELS: Record<RiskFindingSource, string> = {
  VULNERABILITY_SCAN: "Vulnerability Scan",
  PENETRATION_TEST: "Penetration Test",
  AUDIT_FINDING: "Audit Finding",
  SECURITY_REVIEW: "Security Review",
  COMPLIANCE_ASSESSMENT: "Compliance Assessment",
  OTHER: "Other",
};

/**
 * Status display configuration
 */
const STATUS_CONFIG: Record<
  RiskStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-800 border-slate-200",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  OPEN: {
    label: "Open",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  ASSIGNED: {
    label: "Assigned",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  REMEDIATED: {
    label: "Remediated",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
};

interface RiskFindingDisplayProps {
  /** The risk data to display */
  risk: {
    id: string;
    title: string;
    description: string;
    affectedSystems: string | null;
    severity: Severity;
    status: RiskStatus;
    findingSource: RiskFindingSource | null;
    cveId: string | null;
    discoveryDate: Date | null;
    technicalDetails: string | null;
    createdAt: Date;
    updatedAt: Date;
    // Story 16.3: Controls documentation fields
    mitigatingControlsInPlace?: string | null;
    preventativeControlsInPlace?: string | null;
    mitigatingControlsNeeded?: string | null;
    preventativeControlsNeeded?: string | null;
  };
  /**
   * The assessment this risk was identified in, resolved via resolveRiskOrigin.
   * Rendered as a link (or plain text when href is null); omitted when the risk
   * has no assessment origin.
   */
  origin?: RiskOrigin | null;
  /** Whether to show the header with title */
  showHeader?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Parses affected systems text into an array
 * Supports comma-separated or newline-separated values
 */
function parseAffectedSystems(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Generates CVE link URL
 */
function getCveUrl(cveId: string): string {
  // Standard CVE format: CVE-YYYY-NNNNN
  const cleanCve = cveId.trim().toUpperCase();
  if (cleanCve.startsWith("CVE-")) {
    return `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cleanCve}`;
  }
  // If it's just a number, try to construct a CVE URL anyway
  return `https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-${cleanCve}`;
}

export function RiskFindingDisplay({
  risk,
  origin,
  showHeader = true,
  className,
}: RiskFindingDisplayProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const affectedSystems = parseAffectedSystems(risk.affectedSystems);
  const statusConfig = STATUS_CONFIG[risk.status];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with title and badges (AC25) */}
      {showHeader && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">{risk.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={risk.severity} size="lg" />
            <Badge variant="outline" className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
            {risk.findingSource && (
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3" />
                {FINDING_SOURCE_LABELS[risk.findingSource]}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Finding Context Metadata */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Assessment origin — "Identified in" the assessment that created
                this risk. A navigable link when the record has a page, else
                plain text. Absent for manually-created / imported risks. */}
            {origin && (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" />
                  Identified in
                </p>
                {origin.href ? (
                  <Link
                    href={origin.href}
                    className="text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    {origin.label}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </Link>
                ) : (
                  <p className="font-medium">{origin.label}</p>
                )}
              </div>
            )}

            {/* AC26: CVE ID as clickable link */}
            {risk.cveId && (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  CVE/Reference
                </p>
                <a
                  href={getCveUrl(risk.cveId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 font-mono"
                >
                  {risk.cveId}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Discovery Date */}
            {risk.discoveryDate && (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Discovered
                </p>
                <p className="font-medium">
                  {format(new Date(risk.discoveryDate), "PPP")}
                </p>
              </div>
            )}

            {/* Created Date */}
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created
              </p>
              <p className="font-medium">
                {format(new Date(risk.createdAt), "PPP")}
              </p>
            </div>

            {/* Last Updated */}
            <div className="space-y-1">
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last Updated
              </p>
              <p className="font-medium">
                {format(new Date(risk.updatedAt), "PPP")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AC23: Description as rendered markdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risk Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownPreview content={risk.description} />
        </CardContent>
      </Card>

      {/* AC24: Affected Systems as bulleted list */}
      {affectedSystems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-4 w-4" />
              Affected Systems ({affectedSystems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {affectedSystems.map((system, index) => (
                <li key={index} className="text-sm font-mono">
                  {system}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* AC27: Technical Details in collapsible section */}
      {risk.technicalDetails && (
        <Card>
          <button
            type="button"
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          >
            <div className="flex items-center gap-2">
              {showTechnicalDetails ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-medium">Technical Details</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {showTechnicalDetails ? "Click to collapse" : "Click to expand"}
            </span>
          </button>

          {showTechnicalDetails && (
            <>
              <Separator />
              <CardContent className="pt-4">
                <MarkdownPreview content={risk.technicalDetails} />
              </CardContent>
            </>
          )}
        </Card>
      )}

      {/* Story 16.3: Controls Documentation Display (AC15-AC17) */}
      {(risk.mitigatingControlsInPlace || risk.preventativeControlsInPlace ||
        risk.mitigatingControlsNeeded || risk.preventativeControlsNeeded) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Controls Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AC15: Controls in Place section */}
            {(risk.mitigatingControlsInPlace || risk.preventativeControlsInPlace) && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-4 w-4" />
                  Controls in Place
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {risk.mitigatingControlsInPlace && (
                    <div className="space-y-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Mitigating Controls
                      </p>
                      <MarkdownPreview content={risk.mitigatingControlsInPlace} />
                    </div>
                  )}
                  {risk.preventativeControlsInPlace && (
                    <div className="space-y-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Preventative Controls
                      </p>
                      <MarkdownPreview content={risk.preventativeControlsInPlace} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AC16: Controls Needed section */}
            {(risk.mitigatingControlsNeeded || risk.preventativeControlsNeeded) && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ShieldPlus className="h-4 w-4" />
                  Additional Controls Needed
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {risk.mitigatingControlsNeeded && (
                    <div className="space-y-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Mitigating Controls
                      </p>
                      <MarkdownPreview content={risk.mitigatingControlsNeeded} />
                    </div>
                  )}
                  {risk.preventativeControlsNeeded && (
                    <div className="space-y-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Preventative Controls
                      </p>
                      <MarkdownPreview content={risk.preventativeControlsNeeded} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
