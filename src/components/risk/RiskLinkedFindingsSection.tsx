"use client";

/**
 * Linked Findings section on the risk detail page (Story 21.3).
 *
 * Lists the findings that evidence this risk (RiskFindingLink), with add
 * (multi-select picker over non-terminal findings) and per-row unlink. This
 * is the general-model management surface — the assessment workspace keeps
 * its own assessment-scoped linking.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileSearch, Loader2, Plus, Search, X } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import { FindingStatusBadge } from "@/components/findings/FindingStatusBadge";
import { TERMINAL_FINDING_STATUSES } from "@/lib/findings/terminal-statuses";

interface RiskLinkedFindingsSectionProps {
  riskId: string;
  /** Whether the current user can manage links (risk update roles). */
  canManage: boolean;
  /**
   * Story 23.5 (review MJ-6): called after a link change so the parent can
   * refetch the risk's derived score (link/unlink moves calculated/effective).
   */
  onScoreChanged?: () => void;
}

export function RiskLinkedFindingsSection({
  riskId,
  canManage,
  onScoreChanged,
}: RiskLinkedFindingsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const utils = api.useUtils();
  const { data: links, isLoading } = api.risk.getLinkedFindings.useQuery({ riskId });
  const { data: pickerFindings } = api.finding.listForPicker.useQuery(undefined, {
    enabled: dialogOpen,
  });

  const linkedIds = useMemo(() => (links ?? []).map((l) => l.finding.id), [links]);
  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (pickerFindings ?? [])
      .filter((f) => !linkedIds.includes(f.id))
      .filter(
        (f) =>
          !q ||
          f.title.toLowerCase().includes(q) ||
          f.identifier.toLowerCase().includes(q)
      );
  }, [pickerFindings, linkedIds, search]);

  const linkMutation = api.risk.linkFindings.useMutation({
    onSuccess: () => {
      toast.success("Findings linked");
      void utils.risk.getLinkedFindings.invalidate({ riskId });
      // Story 23.5 (review MJ-6): the rollup moved — refresh the risk itself.
      void utils.risk.getById.invalidate({ id: riskId });
      onScoreChanged?.();
      setSelected([]);
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message || "Failed to link findings"),
  });
  const unlinkMutation = api.risk.unlinkFinding.useMutation({
    onSuccess: () => {
      toast.success("Finding unlinked");
      void utils.risk.getLinkedFindings.invalidate({ riskId });
      void utils.risk.getById.invalidate({ id: riskId });
      onScoreChanged?.();
    },
    onError: (e) => toast.error(e.message || "Failed to unlink finding"),
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            Linked Findings
            {(links?.length ?? 0) > 0 && (
              <Badge variant="secondary">{links!.length}</Badge>
            )}
          </CardTitle>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Link finding
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Observations evidencing this risk. Their scores drive the risk&apos;s
          calculated severity once derived scoring lands (Epic 22).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (links?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No linked findings yet.
          </p>
        ) : (
          <ul className="divide-y">
            {links!.map((link) => (
              <li key={link.finding.id} className="flex items-center gap-3 py-2">
                <Link
                  href={`/findings/${link.finding.id}`}
                  className="font-mono text-xs text-primary hover:underline shrink-0"
                >
                  {link.finding.identifier}
                </Link>
                <span className="text-sm flex-1 line-clamp-1">{link.finding.title}</span>
                <FindingStatusBadge status={link.finding.status} size="sm" />
                <SeverityBadge
                  severity={link.finding.severity}
                  severityLabel={link.finding.severityLabel}
                  size="sm"
                  showTooltip={false}
                />
                {canManage &&
                  // Story 23.5 (review MJ-9): terminal findings' links are
                  // read-only from both sides (server enforces the same).
                  !TERMINAL_FINDING_STATUSES.includes(link.finding.status) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Unlink ${link.finding.identifier}`}
                      disabled={unlinkMutation.isPending}
                      onClick={() =>
                        unlinkMutation.mutate({ riskId, findingId: link.finding.id })
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Link findings</DialogTitle>
            <DialogDescription>
              Attach open findings from the register as evidence for this risk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings by identifier or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {options.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  {search ? "No findings match your search." : "No unlinked findings available."}
                </p>
              ) : (
                options.map((f) => (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.includes(f.id)}
                      onCheckedChange={() => toggle(f.id)}
                    />
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {f.identifier}
                    </span>
                    <span className="text-sm line-clamp-1 flex-1">{f.title}</span>
                    <SeverityBadge
                      severity={f.severity}
                      severityLabel={f.severityLabel}
                      size="sm"
                      showTooltip={false}
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={linkMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => linkMutation.mutate({ riskId, findingIds: selected })}
              disabled={selected.length === 0 || linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking…
                </>
              ) : (
                `Link ${selected.length} finding${selected.length === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
