"use client";

/**
 * Link Finding to Risk dialog (Story 21.2 — replaces "Accept Finding").
 *
 * Link-existing is the primary path: a searchable multi-select of register
 * risks (already-linked risks excluded). "Create a new risk" is the secondary
 * escape to /risks/new — prefill from the finding arrives with Story 22.3's
 * ER-style risk form.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
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

interface LinkFindingToRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findingId: string;
  findingIdentifier: string;
  /** Risk ids already linked to this finding — excluded from the picker. */
  linkedRiskIds: string[];
  /** Called after links are created (invalidate/refresh). */
  onLinked?: () => void;
}

export function LinkFindingToRiskDialog({
  open,
  onOpenChange,
  findingId,
  findingIdentifier,
  linkedRiskIds,
  onLinked,
}: LinkFindingToRiskDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: risks, isLoading } = api.risk.listForPicker.useQuery(undefined, {
    enabled: open,
  });

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (risks ?? [])
      .filter((r) => !linkedRiskIds.includes(r.id))
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          (r.identifier ?? "").toLowerCase().includes(q)
      );
  }, [risks, linkedRiskIds, search]);

  const utils = api.useUtils();
  const linkMutation = api.finding.linkRisks.useMutation({
    onSuccess: (links) => {
      toast.success(
        `Finding ${findingIdentifier} linked to ${links.length} risk${links.length === 1 ? "" : "s"}`
      );
      void utils.finding.getById.invalidate({ id: findingId });
      setSelected([]);
      onOpenChange(false);
      onLinked?.();
    },
    onError: (e) => toast.error(e.message || "Failed to link risks"),
  });

  const toggle = (riskId: string) => {
    setSelected((prev) =>
      prev.includes(riskId) ? prev.filter((id) => id !== riskId) : [...prev, riskId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Link to Risk</DialogTitle>
          <DialogDescription>
            Attach this finding to one or more risks from the risk register.
            The finding stays an open observation — acceptance decisions happen
            on the risk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search risks by identifier or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {isLoading ? (
              <p className="p-2 text-sm text-muted-foreground">Loading risks…</p>
            ) : options.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                {search
                  ? "No risks match your search."
                  : "No unlinked risks available."}
              </p>
            ) : (
              options.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                  />
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {r.identifier ?? "—"}
                  </span>
                  <span className="text-sm line-clamp-1 flex-1">{r.title}</span>
                  <SeverityBadge severity={r.severity} size="sm" showTooltip={false} />
                </label>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Can&apos;t find the right risk?{" "}
            <Link href="/risks/new" className="underline" target="_blank">
              Create a new risk
            </Link>{" "}
            and link it afterwards.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={linkMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate({ findingId, riskIds: selected })}
            disabled={selected.length === 0 || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking…
              </>
            ) : (
              `Link ${selected.length || ""} risk${selected.length === 1 ? "" : "s"}`.replace("  ", " ")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
