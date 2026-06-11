"use client";

/**
 * Action Plans panel — the per-assessment Remediation Roadmap tab.
 *
 * Queries `api.actionPlan.listForAssessment`, wraps the shared `RoadmapBody`
 * deliverable component in a `FindingDrawerProvider` (so ActionCards can open the
 * shared Finding Drawer), and provides an "Add initiative" affordance that opens
 * a create form. On create it refetches the list.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { RoadmapBody } from "@/components/deliverable/bodies/RoadmapBody";
import { FindingDrawerProvider } from "@/components/deliverable/FindingDrawerProvider";

type AssessmentKind = "COMPLIANCE" | "MATURITY";

interface Props {
  assessmentKind: AssessmentKind;
  assessmentId: string;
}

const EFFORT_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
] as const;

const TIMELINE_OPTIONS = ["0–30 days", "30–90 days", "1–2 quarters"] as const;

export function ActionPlansPanel({ assessmentKind, assessmentId }: Props) {
  const utils = api.useUtils();
  const listQuery = api.actionPlan.listForAssessment.useQuery({
    assessmentKind,
    assessmentId,
  });
  const [formOpen, setFormOpen] = useState(false);

  const actions = listQuery.data ?? [];

  const refetch = () =>
    utils.actionPlan.listForAssessment.invalidate({ assessmentKind, assessmentId });

  if (listQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading action plan…
      </div>
    );
  }

  return (
    <FindingDrawerProvider>
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="mr-2 size-4" />
          Add initiative
        </Button>
      </div>

      {actions.length === 0 ? (
        <div
          className="mt-4 rounded-lg border border-dashed px-4 py-16 text-center text-sm text-muted-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          No initiatives yet — add the first remediation step.
        </div>
      ) : (
        <div className="mt-4">
          <RoadmapBody actions={actions} prioritizeTop />
        </div>
      )}

      <AddInitiativeDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assessmentKind={assessmentKind}
        assessmentId={assessmentId}
        onCreated={() => {
          setFormOpen(false);
          void refetch();
        }}
      />
    </FindingDrawerProvider>
  );
}

function AddInitiativeDialog({
  open,
  onOpenChange,
  assessmentKind,
  assessmentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessmentKind: AssessmentKind;
  assessmentId: string;
  onCreated: () => void;
}) {
  const NO_OWNER = "__none__";
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [ownerId, setOwnerId] = useState<string>(NO_OWNER);
  const [ownerTeam, setOwnerTeam] = useState("");
  const [effort, setEffort] = useState<string>("MEDIUM");
  const [costMode, setCostMode] = useState<"quantitative" | "qualitative">(
    "quantitative",
  );
  const [costEstimate, setCostEstimate] = useState("");
  const [costBand, setCostBand] = useState<string>("1"); // 0=None,1=Low,2=Med,3=High
  const [timelineEstimate, setTimelineEstimate] = useState<string>("0–30 days");
  const [riskReduction, setRiskReduction] = useState<string>("3");
  const [breaksPathway, setBreaksPathway] = useState(false);
  const [findingIds, setFindingIds] = useState<string[]>([]);

  const findingsQuery = api.finding.listForAssessment.useQuery(
    { assessmentId, assessmentType: assessmentKind },
    { enabled: open },
  );
  const findings = findingsQuery.data ?? [];

  const peopleQuery = api.person.getAll.useQuery(undefined, { enabled: open });
  const people = peopleQuery.data ?? [];

  const createMutation = api.actionPlan.create.useMutation({
    onSuccess: () => {
      toast.success("Initiative added");
      reset();
      onCreated();
    },
    onError: (e) => toast.error(`Failed to add initiative: ${e.message}`),
  });

  const reset = () => {
    setTitle("");
    setDetail("");
    setOwnerId(NO_OWNER);
    setOwnerTeam("");
    setEffort("MEDIUM");
    setCostMode("quantitative");
    setCostEstimate("");
    setCostBand("1");
    setTimelineEstimate("0–30 days");
    setRiskReduction("3");
    setBreaksPathway(false);
    setFindingIds([]);
  };

  const toggleFinding = (id: string) =>
    setFindingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  const submit = () => {
    const costNum = costEstimate.trim() === "" ? undefined : Number(costEstimate);
    const quantitative = costMode === "quantitative";
    createMutation.mutate({
      assessmentKind,
      assessmentId,
      title: title.trim(),
      detail: detail.trim() || undefined,
      ownerId: ownerId === NO_OWNER ? undefined : ownerId,
      ownerTeam: ownerTeam.trim() || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      effort: effort as any,
      // Quantitative → dollar estimate (band derived). Qualitative → band directly.
      costEstimate:
        quantitative && costNum != null && !Number.isNaN(costNum)
          ? costNum
          : null,
      costBand: quantitative ? null : Number(costBand),
      timelineEstimate,
      riskReduction: Number(riskReduction),
      breaksPathway,
      findingIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add initiative</DialogTitle>
          <DialogDescription>
            A remediation step in this assessment&apos;s action plan. Map it to the
            findings it closes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-title">Title</Label>
            <Input
              id="ap-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Enforce MFA on all admin accounts"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-detail">Detail</Label>
            <Textarea
              id="ap-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="What this initiative does and why."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OWNER}>Unassigned</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-owner">Owner team</Label>
              <Input
                id="ap-owner"
                value={ownerTeam}
                onChange={(e) => setOwnerTeam(e.target.value)}
                placeholder="e.g. IT Security"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Effort</Label>
              <Select value={effort} onValueChange={setEffort}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ap-cost">Cost</Label>
                <div
                  className="inline-flex overflow-hidden rounded-md border text-xs"
                  style={{ borderColor: "var(--border)" }}
                >
                  {(
                    [
                      ["quantitative", "$"],
                      ["qualitative", "Band"],
                    ] as const
                  ).map(([mode, label]) => {
                    const active = costMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCostMode(mode)}
                        className="px-2 py-0.5 font-medium transition-colors"
                        style={{
                          background: active ? "var(--primary)" : "transparent",
                          color: active
                            ? "var(--primary-foreground)"
                            : "var(--muted-foreground)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {costMode === "quantitative" ? (
                <Input
                  id="ap-cost"
                  type="number"
                  min="0"
                  value={costEstimate}
                  onChange={(e) => setCostEstimate(e.target.value)}
                  placeholder="$ amount"
                />
              ) : (
                <Select value={costBand} onValueChange={setCostBand}>
                  <SelectTrigger id="ap-cost">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None ($0)</SelectItem>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Timeline</Label>
              <Select value={timelineEstimate} onValueChange={setTimelineEstimate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Risk reduction (1–5)</Label>
              <Select value={riskReduction} onValueChange={setRiskReduction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <Checkbox
              checked={breaksPathway}
              onCheckedChange={(v) => setBreaksPathway(v === true)}
            />
            Breaks the exploitation pathway
          </label>

          <div className="flex flex-col gap-1.5">
            <Label>Findings closed</Label>
            <div
              className="max-h-44 overflow-y-auto rounded-md border p-2"
              style={{ borderColor: "var(--border)" }}
            >
              {findingsQuery.isLoading ? (
                <div className="px-1 py-2 text-sm text-muted-foreground">
                  Loading findings…
                </div>
              ) : findings.length === 0 ? (
                <div className="px-1 py-2 text-sm text-muted-foreground">
                  No findings in this assessment.
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {findings.map((f) => (
                    <li key={f.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                        <Checkbox
                          checked={findingIds.includes(f.id)}
                          onCheckedChange={() => toggleFinding(f.id)}
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {f.identifier ?? f.id.slice(0, 8)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {f.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Add initiative
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
