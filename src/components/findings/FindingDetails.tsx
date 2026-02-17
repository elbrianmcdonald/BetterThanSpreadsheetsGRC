"use client";

/**
 * Finding Details Component
 *
 * Story 7.11: Finding Detail Page (AC13-AC18)
 *
 * Displays the finding details section:
 * - AC13: Title displayed as heading
 * - AC14: Description displayed (markdown rendered if applicable)
 * - AC15: Affected Assets list
 * - AC16: Business Units list
 * - AC17: Linked evidence files (if any)
 * - AC18: All fields read-only when status = ACCEPTED
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 */

import { type FindingStatus } from "@prisma/client";
import { Building2, Server, FileText, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface BusinessUnit {
  id: string;
  name: string;
}

interface FindingDetailsProps {
  /** The finding title */
  title: string;
  /** The finding description */
  description: string;
  /** List of affected assets */
  affectedAssets: string[];
  /** List of affected business units */
  affectedBusinessUnits: BusinessUnit[];
  /** Current status of the finding */
  status: FindingStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the finding details with title, description, affected assets and business units.
 *
 * @example
 * ```tsx
 * <FindingDetails
 *   title={finding.title}
 *   description={finding.description}
 *   affectedAssets={finding.affectedAssets}
 *   affectedBusinessUnits={finding.affectedBusinessUnits}
 *   status={finding.status}
 * />
 * ```
 */
export function FindingDetails({
  title,
  description,
  affectedAssets,
  affectedBusinessUnits,
  status,
  className,
}: FindingDetailsProps) {
  const isLocked = status === "ACCEPTED";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Finding Details</CardTitle>
          {/* AC18: Indicate read-only when accepted */}
          {isLocked && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Read-only
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AC13: Title displayed as heading */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        </div>

        <Separator />

        {/* AC14: Description displayed */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-foreground whitespace-pre-wrap">{description}</p>
          </div>
        </div>

        {/* AC15: Affected Assets list */}
        {affectedAssets.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Affected Assets
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {affectedAssets.map((asset, index) => (
                  <Badge key={index} variant="outline">
                    {asset}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* AC16: Business Units list */}
        {affectedBusinessUnits.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Affected Business Units
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {affectedBusinessUnits.map((bu) => (
                  <Badge key={bu.id} variant="secondary">
                    {bu.name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* AC17: Evidence files placeholder - can be expanded in future story */}
        {/* Evidence files would be displayed here if attached */}
      </CardContent>
    </Card>
  );
}
