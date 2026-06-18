"use client";

/**
 * Dialog for tagging existing Risks and Findings to an Enterprise Risk.
 *
 * Two tabs (Risks / Findings), each a searchable checkbox list pulled from the
 * register. Items already tagged to THIS enterprise risk are pre-checked; items
 * tagged to a DIFFERENT enterprise risk show that risk's name and a move note.
 * On save we diff against the initial state and call assignChildRisk /
 * assignChildFinding only for items that actually changed.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PickerItem {
  id: string;
  identifier: string | null;
  title: string;
  severity: string;
  enterpriseRiskId: string | null;
}

function ItemList({
  items,
  selected,
  onToggle,
  erNameById,
  thisErId,
  emptyLabel,
}: {
  items: PickerItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  erNameById: Map<string, string>;
  thisErId: string;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.identifier ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or ID..."
          className="pl-8"
        />
      </div>
      <div className="max-h-[320px] overflow-y-auto rounded-md border divide-y">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          filtered.map((item) => {
            const taggedElsewhere =
              item.enterpriseRiskId !== null && item.enterpriseRiskId !== thisErId;
            const otherName = item.enterpriseRiskId
              ? erNameById.get(item.enterpriseRiskId)
              : null;
            return (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-secondary/60"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => onToggle(item.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.identifier && (
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                        {item.identifier}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium">{item.title}</span>
                  </div>
                  {taggedElsewhere && (
                    <p className="mt-0.5 text-[11px] text-warning">
                      Currently tagged to “{otherName ?? "another enterprise risk"}” — selecting moves it here.
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  {item.severity}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TagItemsDialog({
  enterpriseRiskId,
  open,
  onOpenChange,
  onChanged,
}: {
  enterpriseRiskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const risks = api.enterpriseRisk.listRisksForPicker.useQuery(undefined, { enabled: open });
  const findings = api.enterpriseRisk.listFindingsForPicker.useQuery(undefined, { enabled: open });
  const erList = api.enterpriseRisk.listForPicker.useQuery(undefined, { enabled: open });

  const assignRisk = api.enterpriseRisk.assignChildRisk.useMutation();
  const assignFinding = api.enterpriseRisk.assignChildFinding.useMutation();

  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set());
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Seed selections from items currently tagged to THIS enterprise risk.
  useEffect(() => {
    if (risks.data) {
      setSelectedRisks(
        new Set(risks.data.filter((r) => r.enterpriseRiskId === enterpriseRiskId).map((r) => r.id)),
      );
    }
  }, [risks.data, enterpriseRiskId]);
  useEffect(() => {
    if (findings.data) {
      setSelectedFindings(
        new Set(findings.data.filter((f) => f.enterpriseRiskId === enterpriseRiskId).map((f) => f.id)),
      );
    }
  }, [findings.data, enterpriseRiskId]);

  const erNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const er of erList.data ?? []) m.set(er.id, er.name);
    return m;
  }, [erList.data]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const riskData = risks.data ?? [];
      const findingData = findings.data ?? [];
      const initialRiskIds = new Set(
        riskData.filter((r) => r.enterpriseRiskId === enterpriseRiskId).map((r) => r.id),
      );
      const initialFindingIds = new Set(
        findingData.filter((f) => f.enterpriseRiskId === enterpriseRiskId).map((f) => f.id),
      );

      const ops: Promise<unknown>[] = [];
      // Risks: newly selected (incl. moves) → tag here; deselected → untag.
      for (const id of selectedRisks) {
        if (!initialRiskIds.has(id)) ops.push(assignRisk.mutateAsync({ riskId: id, enterpriseRiskId }));
      }
      for (const id of initialRiskIds) {
        if (!selectedRisks.has(id)) ops.push(assignRisk.mutateAsync({ riskId: id, enterpriseRiskId: null }));
      }
      // Findings.
      for (const id of selectedFindings) {
        if (!initialFindingIds.has(id)) ops.push(assignFinding.mutateAsync({ findingId: id, enterpriseRiskId }));
      }
      for (const id of initialFindingIds) {
        if (!selectedFindings.has(id)) ops.push(assignFinding.mutateAsync({ findingId: id, enterpriseRiskId: null }));
      }

      await Promise.all(ops);
      toast.success(ops.length === 0 ? "No changes" : `Updated ${ops.length} item${ops.length === 1 ? "" : "s"}`);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  const loading = risks.isLoading || findings.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tag risks &amp; findings</DialogTitle>
          <DialogDescription>
            Select existing risks and findings to align to this enterprise risk.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="risks">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="risks">Risks ({selectedRisks.size})</TabsTrigger>
              <TabsTrigger value="findings">Findings ({selectedFindings.size})</TabsTrigger>
            </TabsList>
            <TabsContent value="risks" className="mt-3">
              <ItemList
                items={risks.data ?? []}
                selected={selectedRisks}
                onToggle={(id) => toggle(selectedRisks, setSelectedRisks, id)}
                erNameById={erNameById}
                thisErId={enterpriseRiskId}
                emptyLabel="No risks in the register."
              />
            </TabsContent>
            <TabsContent value="findings" className="mt-3">
              <ItemList
                items={findings.data ?? []}
                selected={selectedFindings}
                onToggle={(id) => toggle(selectedFindings, setSelectedFindings, id)}
                erNameById={erNameById}
                thisErId={enterpriseRiskId}
                emptyLabel="No findings in the register."
              />
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
