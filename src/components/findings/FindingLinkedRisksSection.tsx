"use client";

/**
 * Linked Risks section on the finding detail page (Story 21.3).
 *
 * Lists the register risks this finding feeds (RiskFindingLink), with add
 * (reusing the Story 21.2 LinkFindingToRiskDialog) and per-row unlink.
 * Terminal findings render read-only.
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Plus, X } from "lucide-react";
import type { FindingStatus, Severity } from "@prisma/client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { LinkFindingToRiskDialog } from "./LinkFindingToRiskDialog";

import { TERMINAL_FINDING_STATUSES as TERMINAL_STATUSES } from "@/lib/findings/terminal-statuses";

interface LinkedRisk {
  riskId: string;
  risk: {
    id: string;
    identifier: string | null;
    title: string;
    severity: Severity;
    status: string;
    /** Story 23.1: latest treatment decision (take-1 desc) */
    Treatments?: { treatmentType: string; decidedAt: Date | string }[];
  };
}

interface FindingLinkedRisksSectionProps {
  findingId: string;
  findingIdentifier: string;
  status: FindingStatus;
  riskLinks: LinkedRisk[];
  /** Called after link changes (invalidate/refresh). */
  onChanged: () => void;
  /** Whether the current user can manage links (triage roles). */
  canManage: boolean;
}

export function FindingLinkedRisksSection({
  findingId,
  findingIdentifier,
  status,
  riskLinks,
  onChanged,
  canManage,
}: FindingLinkedRisksSectionProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const canEdit = canManage && !isTerminal;

  const utils = api.useUtils();
  const unlinkMutation = api.finding.unlinkRisk.useMutation({
    onSuccess: () => {
      toast.success("Risk unlinked");
      void utils.finding.getById.invalidate({ id: findingId });
      onChanged();
    },
    onError: (e) => toast.error(e.message || "Failed to unlink risk"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Linked Risks
            {riskLinks.length > 0 && (
              <Badge variant="secondary">{riskLinks.length}</Badge>
            )}
          </CardTitle>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Link risk
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {riskLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No linked risks yet. Linking is recommended — it rolls this
            observation up into the exposure it evidences.
          </p>
        ) : (
          <ul className="divide-y">
            {riskLinks.map((link) => (
              <li key={link.riskId} className="flex items-center gap-3 py-2">
                <Link
                  href={`/risks/${link.risk.id}`}
                  className="font-mono text-xs text-primary hover:underline shrink-0"
                >
                  {link.risk.identifier ?? "—"}
                </Link>
                <span className="text-sm flex-1 line-clamp-1">{link.risk.title}</span>
                {/* Story 23.1: risk treatment state — the finding stays an
                    open observation even when its risk is accepted */}
                {link.risk.Treatments?.[0]?.treatmentType === "ACCEPT" && (
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                    Accepted
                  </Badge>
                )}
                <SeverityBadge severity={link.risk.severity} size="sm" showTooltip={false} />
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Unlink ${link.risk.identifier ?? link.risk.title}`}
                    disabled={unlinkMutation.isPending}
                    onClick={() =>
                      unlinkMutation.mutate({ findingId, riskId: link.riskId })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <LinkFindingToRiskDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        findingId={findingId}
        findingIdentifier={findingIdentifier}
        linkedRiskIds={riskLinks.map((l) => l.riskId)}
        onLinked={onChanged}
      />
    </Card>
  );
}
